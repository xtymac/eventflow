/**
 * Nagoya Building Zones Sync Service
 *
 * Downloads and parses MVT (Mapbox Vector Tiles) from Nagoya City's
 * building information (建築情報) data source and stores in PostgreSQL.
 *
 * Data source: https://www.shiteidourozu.city.nagoya.jp/mvt/data/kenchiku
 */

import Pbf from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';
import pLimit from 'p-limit';
import { nanoid } from 'nanoid';
import type { Feature, Polygon, GeoJsonProperties } from 'geojson';

import { db } from '../db/index.js';
import {
  nagoyaBuildingZones,
  nagoyaSyncLogs,
  type NewNagoyaBuildingZone,
} from '../db/schema.js';
import { toGeomSql } from '../db/geometry.js';
import { sql, eq } from 'drizzle-orm';

// Configuration
const BASE_URL = 'https://www.shiteidourozu.city.nagoya.jp/mvt/data/kenchiku';
const CONCURRENCY = 5;
const DELAY_MS = 100;
const ZOOM_LEVEL = 14;

// Nagoya bounds (from metadata)
const BOUNDS = {
  minLng: 136.790771,
  minLat: 35.034494,
  maxLng: 137.059937,
  maxLat: 35.260198,
};

// All kenchiku layers (all polygons)
const BUILDING_LAYERS = new Set([
  'danchinintei_pg',                    // 団地認定
  'kenchiku_mokuzo_pg',                 // 木造住宅密集地域
  'kenchikukyoutei_pg',                 // 建築協定
  'machinamihozon_pg',                  // 町並み保存
  'rinkaibubousai_dai1_syu_pg',         // 臨海部防災第1種
  'rinkaibubousai_dai2_syu_pg',         // 臨海部防災第2種
  'rinkaibubousai_dai3_syu_pg',         // 臨海部防災第3種
  'rinkaibubousai_dai4_syu_pg',         // 臨海部防災第4種
  'toshikeikan_keisei_pg',              // 都市景観形成
  'toshikeikan_kyoutei_pg',             // 都市景観協定
  'takuchizousei_koujikisei_pg',        // 宅地造成工事規制
  'tochikukakuseirijigyo_koukyou_pg',   // 土地区画整理(公共)
  'tochikukakuseirijigyo_kumiai_pg',    // 土地区画整理(組合)
]);

// Layer to zone type mapping
const LAYER_ZONE_TYPES: Record<string, string> = {
  'danchinintei_pg': '団地認定',
  'kenchiku_mokuzo_pg': '木造住宅密集地域',
  'kenchikukyoutei_pg': '建築協定',
  'machinamihozon_pg': '町並み保存',
  'rinkaibubousai_dai1_syu_pg': '臨海部防災区域(第1種)',
  'rinkaibubousai_dai2_syu_pg': '臨海部防災区域(第2種)',
  'rinkaibubousai_dai3_syu_pg': '臨海部防災区域(第3種)',
  'rinkaibubousai_dai4_syu_pg': '臨海部防災区域(第4種)',
  'toshikeikan_keisei_pg': '都市景観形成地区',
  'toshikeikan_kyoutei_pg': '都市景観協定',
  'takuchizousei_koujikisei_pg': '宅地造成工事規制区域',
  'tochikukakuseirijigyo_koukyou_pg': '土地区画整理事業(公共)',
  'tochikukakuseirijigyo_kumiai_pg': '土地区画整理事業(組合)',
};

// Interface definitions
interface TileCoord {
  x: number;
  y: number;
  z: number;
}

interface SyncState {
  completedTiles: string[];
  errorTiles: string[];
}

interface SyncProgress {
  logId: string;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  totalTiles: number;
  completedTiles: number;
  errorTiles: number;
  zonesCreated: number;
  zonesUpdated: number;
  errors: string[];
}

// Running sync state (in-memory)
let currentSync: {
  logId: string;
  abortController: AbortController;
  progress: SyncProgress;
} | null = null;

/**
 * Convert longitude/latitude to tile coordinates
 */
function lngLatToTile(lng: number, lat: number, zoom: number): { x: number; y: number } {
  const x = Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
  const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
  return { x, y };
}

/**
 * Get all tiles covering the Nagoya bounds
 */
function getTilesToFetch(zoom: number = ZOOM_LEVEL): TileCoord[] {
  const minTile = lngLatToTile(BOUNDS.minLng, BOUNDS.maxLat, zoom);
  const maxTile = lngLatToTile(BOUNDS.maxLng, BOUNDS.minLat, zoom);

  const tiles: TileCoord[] = [];
  for (let x = minTile.x; x <= maxTile.x; x++) {
    for (let y = minTile.y; y <= maxTile.y; y++) {
      tiles.push({ x, y, z: zoom });
    }
  }

  return tiles;
}

/**
 * Fetch a single PBF tile
 */
async function fetchTile(tile: TileCoord, signal: AbortSignal): Promise<ArrayBuffer | null> {
  const url = `${BASE_URL}/${tile.z}/${tile.x}/${tile.y}.pbf`;

  try {
    const response = await fetch(url, {
      signal,
      headers: {
        'User-Agent': 'EventFlow-NagoyaSync/1.0',
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.arrayBuffer();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
    throw error;
  }
}

/**
 * Parse PBF tile and extract polygon features
 */
function parseTile(
  buffer: ArrayBuffer,
  tile: TileCoord
): Feature<Polygon>[] {
  const pbf = new Pbf(new Uint8Array(buffer));
  const vectorTile = new VectorTile(pbf);

  const polygons: Feature<Polygon>[] = [];

  for (const layerName of Object.keys(vectorTile.layers)) {
    if (!BUILDING_LAYERS.has(layerName)) continue;

    const layer = vectorTile.layers[layerName];

    for (let i = 0; i < layer.length; i++) {
      const feature = layer.feature(i);

      // Convert to GeoJSON with proper WGS84 coordinates
      const geojson = feature.toGeoJSON(tile.x, tile.y, tile.z) as Feature;

      const props = {
        ...geojson.properties,
        _sourceLayer: layerName,
        _tileCoord: `${tile.z}/${tile.x}/${tile.y}`,
      };

      if (geojson.geometry.type === 'Polygon') {
        polygons.push({
          type: 'Feature',
          properties: props,
          geometry: geojson.geometry as Polygon,
        });
      } else if (geojson.geometry.type === 'MultiPolygon') {
        // Split MultiPolygon into individual Polygons
        for (const coords of geojson.geometry.coordinates) {
          polygons.push({
            type: 'Feature',
            properties: props,
            geometry: { type: 'Polygon', coordinates: coords },
          });
        }
      }
    }
  }

  return polygons;
}

/**
 * Generate dedup key from properties
 */
function generateDedupKey(props: GeoJsonProperties): string {
  if (!props) return 'unknown';

  const keycode = props.keycode as string | undefined;
  const gid = props.gid as number | undefined;

  return keycode || (gid !== undefined ? String(gid) : 'unknown');
}

/**
 * Upsert building zone features to database
 */
async function upsertBuildingZones(
  features: Feature<Polygon>[],
  progress: SyncProgress
): Promise<void> {
  // Group by source_layer + dedup_key
  const uniqueFeatures = new Map<string, Feature<Polygon>>();

  for (const feature of features) {
    const props = feature.properties || {};
    const sourceLayer = props._sourceLayer as string;
    const dedupKey = generateDedupKey(props);
    const key = `${sourceLayer}:${dedupKey}`;

    if (!uniqueFeatures.has(key)) {
      uniqueFeatures.set(key, feature);
    }
  }

  for (const [, feature] of uniqueFeatures) {
    const props = feature.properties || {};
    const sourceLayer = props._sourceLayer as string;
    const dedupKey = generateDedupKey(props);
    const zoneType = LAYER_ZONE_TYPES[sourceLayer] || sourceLayer;

    const record: Omit<NewNagoyaBuildingZone, 'id' | 'syncedAt'> = {
      sourceLayer,
      dedupKey,
      gid: props.gid as number | null,
      keycode: props.keycode as string | null,
      zoneType,
      name: props.name as string | null,
      kyoteiName: props.kyotei_name as string | null,
      kubun: props.kubun as string | null,
      ninteiYmd: props.nintei_ymd as string | null,
      ninteiNo: props.nintei_no as string | null,
      shiteiYmd: props.shitei_ymd as string | null,
      kokokuYmd: props.kokoku_ymd as string | null,
      menseki: props.menseki as string | null,
      rawProps: props,
      geometry: feature.geometry as unknown as Polygon,
    };

    try {
      const result = await db.execute(sql`
        INSERT INTO nagoya_building_zones (
          source_layer, dedup_key, gid, keycode, zone_type, name,
          kyotei_name, kubun, nintei_ymd, nintei_no, shitei_ymd, kokoku_ymd,
          menseki, raw_props, geometry, synced_at
        ) VALUES (
          ${record.sourceLayer},
          ${record.dedupKey},
          ${record.gid},
          ${record.keycode},
          ${record.zoneType},
          ${record.name},
          ${record.kyoteiName},
          ${record.kubun},
          ${record.ninteiYmd},
          ${record.ninteiNo},
          ${record.shiteiYmd},
          ${record.kokokuYmd},
          ${record.menseki},
          ${JSON.stringify(record.rawProps)}::jsonb,
          ${toGeomSql(feature.geometry)},
          NOW()
        )
        ON CONFLICT (source_layer, dedup_key)
        DO UPDATE SET
          gid = EXCLUDED.gid,
          keycode = EXCLUDED.keycode,
          zone_type = EXCLUDED.zone_type,
          name = EXCLUDED.name,
          kyotei_name = EXCLUDED.kyotei_name,
          kubun = EXCLUDED.kubun,
          nintei_ymd = EXCLUDED.nintei_ymd,
          nintei_no = EXCLUDED.nintei_no,
          shitei_ymd = EXCLUDED.shitei_ymd,
          kokoku_ymd = EXCLUDED.kokoku_ymd,
          menseki = EXCLUDED.menseki,
          raw_props = EXCLUDED.raw_props,
          geometry = EXCLUDED.geometry,
          synced_at = NOW()
        RETURNING (xmax = 0) as is_insert
      `);

      const isInsert = (result.rows[0] as { is_insert: boolean })?.is_insert;
      if (isInsert) {
        progress.zonesCreated++;
      } else {
        progress.zonesUpdated++;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      progress.errors.push(`Building zone upsert failed: ${message}`);
    }
  }
}

/**
 * Nagoya Building Sync Service
 */
export class NagoyaBuildingSyncService {
  /**
   * Start a new sync operation
   */
  async startSync(resume = false): Promise<SyncProgress> {
    if (currentSync) {
      return currentSync.progress;
    }

    const logId = `NBL-${nanoid(10)}`;
    const startedAt = new Date();
    const tiles = getTilesToFetch();

    let resumeState: SyncState | null = null;
    if (resume) {
      const lastLog = await db.select()
        .from(nagoyaSyncLogs)
        .where(eq(nagoyaSyncLogs.status, 'stopped'))
        .orderBy(sql`${nagoyaSyncLogs.startedAt} DESC`)
        .limit(1);

      if (lastLog[0]?.resumeState) {
        resumeState = lastLog[0].resumeState as SyncState;
      }
    }

    const completedSet = new Set(resumeState?.completedTiles || []);
    const tilesToProcess = tiles.filter(t => !completedSet.has(`${t.z}/${t.x}/${t.y}`));

    const progress: SyncProgress = {
      logId,
      status: 'running',
      totalTiles: tiles.length,
      completedTiles: completedSet.size,
      errorTiles: 0,
      zonesCreated: 0,
      zonesUpdated: 0,
      errors: [],
    };

    await db.insert(nagoyaSyncLogs).values({
      id: logId,
      status: 'running',
      startedAt,
      totalTiles: tiles.length,
      completedTiles: completedSet.size,
    });

    const abortController = new AbortController();
    currentSync = { logId, abortController, progress };

    this.runSync(tilesToProcess, completedSet, progress, abortController.signal)
      .catch(error => {
        console.error('[Nagoya Building Sync] Error:', error);
        progress.status = 'failed';
        progress.errors.push(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        currentSync = null;
      });

    return progress;
  }

  /**
   * Run the sync operation
   */
  private async runSync(
    tiles: TileCoord[],
    completedSet: Set<string>,
    progress: SyncProgress,
    signal: AbortSignal
  ): Promise<void> {
    const limit = pLimit(CONCURRENCY);
    const errorTiles: string[] = [];

    console.log(`[Nagoya Building Sync] Starting sync of ${tiles.length} tiles`);

    const tasks = tiles.map(tile => limit(async () => {
      if (signal.aborted) {
        throw new Error('Aborted');
      }

      const tileKey = `${tile.z}/${tile.x}/${tile.y}`;

      try {
        await new Promise(r => setTimeout(r, DELAY_MS));

        const buffer = await fetchTile(tile, signal);

        if (buffer) {
          const polygons = parseTile(buffer, tile);

          if (polygons.length > 0) {
            await upsertBuildingZones(polygons, progress);
          }
        }

        completedSet.add(tileKey);
        progress.completedTiles++;

        if (progress.completedTiles % 10 === 0) {
          await this.updateLog(progress, completedSet, errorTiles);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw error;
        }

        errorTiles.push(tileKey);
        progress.errorTiles++;
        progress.errors.push(`Tile ${tileKey}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }));

    try {
      await Promise.all(tasks);
      progress.status = 'completed';
    } catch (error) {
      if (signal.aborted) {
        progress.status = 'stopped';
      } else {
        progress.status = 'failed';
      }
    }

    await this.updateLog(progress, completedSet, errorTiles, true);

    console.log(`[Nagoya Building Sync] Completed: ${progress.zonesCreated} zones created`);
  }

  /**
   * Update sync log in database
   */
  private async updateLog(
    progress: SyncProgress,
    completedSet: Set<string>,
    errorTiles: string[],
    isFinal = false
  ): Promise<void> {
    const resumeState: SyncState = {
      completedTiles: Array.from(completedSet),
      errorTiles,
    };

    await db.update(nagoyaSyncLogs).set({
      status: progress.status,
      completedAt: isFinal ? new Date() : null,
      completedTiles: progress.completedTiles,
      errorTiles: progress.errorTiles,
      areasCreated: progress.zonesCreated,
      areasUpdated: progress.zonesUpdated,
      resumeState,
      errorMessage: progress.errors.length > 0 ? progress.errors.slice(-10).join('; ') : null,
      errorDetails: progress.errors.length > 0 ? { errors: progress.errors } : null,
    }).where(eq(nagoyaSyncLogs.id, progress.logId));
  }

  /**
   * Stop the current sync operation
   */
  async stopSync(): Promise<SyncProgress | null> {
    if (!currentSync) {
      return null;
    }

    currentSync.abortController.abort();
    currentSync.progress.status = 'stopped';

    return currentSync.progress;
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncProgress | null {
    return currentSync?.progress || null;
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<{
    totalZones: number;
    zonesByLayer: Record<string, number>;
    zonesByType: Record<string, number>;
    lastSyncAt: string | null;
  }> {
    const totalResult = await db.execute<{ count: number }>(sql`
      SELECT COUNT(*)::int as count FROM nagoya_building_zones
    `);

    const byLayerResult = await db.execute<{ source_layer: string; count: number }>(sql`
      SELECT source_layer, COUNT(*)::int as count
      FROM nagoya_building_zones
      GROUP BY source_layer
    `);

    const byTypeResult = await db.execute<{ zone_type: string; count: number }>(sql`
      SELECT zone_type, COUNT(*)::int as count
      FROM nagoya_building_zones
      GROUP BY zone_type
    `);

    const lastSyncResult = await db.execute<{ completed_at: Date }>(sql`
      SELECT completed_at FROM nagoya_sync_logs
      WHERE status = 'completed' AND id LIKE 'NBL-%'
      ORDER BY completed_at DESC
      LIMIT 1
    `);

    const zonesByLayer: Record<string, number> = {};
    for (const row of byLayerResult.rows) {
      zonesByLayer[row.source_layer] = row.count;
    }

    const zonesByType: Record<string, number> = {};
    for (const row of byTypeResult.rows) {
      zonesByType[row.zone_type] = row.count;
    }

    return {
      totalZones: totalResult.rows[0]?.count || 0,
      zonesByLayer,
      zonesByType,
      lastSyncAt: lastSyncResult.rows[0]?.completed_at?.toISOString() || null,
    };
  }
}

// Export singleton instance
export const nagoyaBuildingSyncService = new NagoyaBuildingSyncService();

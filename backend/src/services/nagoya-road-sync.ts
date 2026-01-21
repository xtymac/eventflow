/**
 * Nagoya Designated Road Sync Service
 *
 * Downloads and parses MVT (Mapbox Vector Tiles) from Nagoya City's
 * designated road map (指定道路図) website and stores in PostgreSQL.
 *
 * Data source: https://www.shiteidourozu.city.nagoya.jp/
 */

import Pbf from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';
import pLimit from 'p-limit';
import { nanoid } from 'nanoid';
import type { Feature, LineString, Polygon, GeoJsonProperties } from 'geojson';

import { db } from '../db/index.js';
import {
  nagoyaDesignatedRoads,
  nagoyaDesignatedAreas,
  nagoyaSyncLogs,
  type NewNagoyaDesignatedRoad,
  type NewNagoyaDesignatedArea,
} from '../db/schema.js';
import { toGeomSql } from '../db/geometry.js';
import { sql, eq } from 'drizzle-orm';

// Configuration
const BASE_URL = 'https://www.shiteidourozu.city.nagoya.jp/mvt/data/shiteidouro';
const PDF_BASE_URL = 'https://www.shiteidourozu.city.nagoya.jp/pdf';
const CONCURRENCY = 5;
const DELAY_MS = 100;
const ZOOM_LEVEL = 14;  // Use lower zoom for fewer tiles with full data

// Nagoya bounds (from metadata)
const BOUNDS = {
  minLng: 136.790771,
  minLat: 35.034494,
  maxLng: 137.059937,
  maxLat: 35.260198,
};

// Layer classification
const LINE_LAYERS = new Set([
  'shiteidouro_2gou_pl_web',
  'shiteidouro_5gou_pl_web',
  'shiteidouro_2kou_kobetsu_pl',
  'shiteidouro_2kou_kenchikusen_pl',
  'shiteidouro_3gou_kobetsu_pl',
  'shiteidouro_3gou_syuji_pl',
  'shiteidouro_tokuteitsuuro_2gou_pl',
  'shiteidouro_tokuteitsuuro_3gou_pl',
]);

const POLYGON_LAYERS = new Set([
  'shiteidouro_1gou_pg',
  'shiteidouro_2kou_pg',
  'shiteidouro_3gou_syuji_pg',
  'shiteidouro_kukakuseiri_pg',
  'shiteidouro_kairyouku_pg',
]);

// Interface definitions
interface TileCoord {
  x: number;
  y: number;
  z: number;
}

interface SyncState {
  completedTiles: string[];  // "z/x/y"
  errorTiles: string[];
}

interface SyncProgress {
  logId: string;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  totalTiles: number;
  completedTiles: number;
  errorTiles: number;
  roadsCreated: number;
  roadsUpdated: number;
  areasCreated: number;
  areasUpdated: number;
  errors: string[];
}

// Running sync state (in-memory for simplicity)
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
  const n = Math.PI - 2 * Math.PI * lat / 180;
  const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
  return { x, y };
}

/**
 * Get all tiles covering the Nagoya bounds
 */
function getTilesToFetch(zoom: number = ZOOM_LEVEL): TileCoord[] {
  const minTile = lngLatToTile(BOUNDS.minLng, BOUNDS.maxLat, zoom);  // NW corner
  const maxTile = lngLatToTile(BOUNDS.maxLng, BOUNDS.minLat, zoom);  // SE corner

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
      // Tile doesn't exist (outside data bounds)
      return null;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.arrayBuffer();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;  // Re-throw abort errors
    }
    throw error;
  }
}

/**
 * Parse PBF tile and extract features
 */
function parseTile(
  buffer: ArrayBuffer,
  tile: TileCoord
): { lines: Feature<LineString>[]; polygons: Feature<Polygon>[] } {
  const pbf = new Pbf(new Uint8Array(buffer));
  const vectorTile = new VectorTile(pbf);

  const lines: Feature<LineString>[] = [];
  const polygons: Feature<Polygon>[] = [];

  for (const layerName of Object.keys(vectorTile.layers)) {
    const layer = vectorTile.layers[layerName];
    const isLine = LINE_LAYERS.has(layerName);
    const isPolygon = POLYGON_LAYERS.has(layerName);

    if (!isLine && !isPolygon) continue;

    for (let i = 0; i < layer.length; i++) {
      const feature = layer.feature(i);

      // Convert to GeoJSON with proper WGS84 coordinates
      // toGeoJSON(x, y, z) converts tile coordinates to lng/lat
      const geojson = feature.toGeoJSON(tile.x, tile.y, tile.z) as Feature;

      // Add source layer to properties
      const props = {
        ...geojson.properties,
        _sourceLayer: layerName,
        _tileCoord: `${tile.z}/${tile.x}/${tile.y}`,
      };

      if (isLine && geojson.geometry.type === 'LineString') {
        lines.push({
          type: 'Feature',
          properties: props,
          geometry: geojson.geometry as LineString,
        });
      } else if (isLine && geojson.geometry.type === 'MultiLineString') {
        // Split MultiLineString into individual LineStrings
        for (const coords of geojson.geometry.coordinates) {
          lines.push({
            type: 'Feature',
            properties: props,
            geometry: { type: 'LineString', coordinates: coords },
          });
        }
      } else if (isPolygon && geojson.geometry.type === 'Polygon') {
        polygons.push({
          type: 'Feature',
          properties: props,
          geometry: geojson.geometry as Polygon,
        });
      } else if (isPolygon && geojson.geometry.type === 'MultiPolygon') {
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

  return { lines, polygons };
}

/**
 * Generate dedup key from properties
 */
function generateDedupKey(props: GeoJsonProperties): string {
  if (!props) return 'unknown';

  const keycode = props.keycode as string | undefined;
  const daicyoBan = props.daicyo_ban as string | undefined;
  const gid = props.gid as number | undefined;

  return keycode || daicyoBan || (gid !== undefined ? String(gid) : 'unknown');
}

/**
 * Build full PDF URL from filename
 */
function buildPdfUrl(filename: string | undefined): string | null {
  if (!filename) return null;
  return `${PDF_BASE_URL}/${filename}`;
}

/**
 * Upsert line features to database
 */
async function upsertLineFeatures(
  features: Feature<LineString>[],
  progress: SyncProgress
): Promise<void> {
  // Group by source_layer + dedup_key
  const uniqueFeatures = new Map<string, Feature<LineString>>();

  for (const feature of features) {
    const props = feature.properties || {};
    const sourceLayer = props._sourceLayer as string;
    const dedupKey = generateDedupKey(props);
    const key = `${sourceLayer}:${dedupKey}`;

    // Keep the first occurrence (or merge if needed)
    if (!uniqueFeatures.has(key)) {
      uniqueFeatures.set(key, feature);
    }
  }

  for (const [, feature] of uniqueFeatures) {
    const props = feature.properties || {};
    const sourceLayer = props._sourceLayer as string;
    const dedupKey = generateDedupKey(props);

    // Skip features with invalid geometry
    if (!feature.geometry || !feature.geometry.coordinates || feature.geometry.coordinates.length === 0) {
      progress.errors.push(`Skipping line with empty geometry: ${sourceLayer}/${dedupKey}`);
      continue;
    }

    const record: Omit<NewNagoyaDesignatedRoad, 'id' | 'syncedAt'> = {
      sourceLayer,
      dedupKey,
      keycode: (props.keycode as string | undefined) ?? null,
      daicyoBan: (props.daicyo_ban as string | undefined) ?? null,
      gid: (props.gid as number | undefined) ?? null,
      encyo: (props.encyo as string | undefined) ?? null,
      fukuin: (props.fukuin as string | undefined) ?? null,
      kyokaBan: (props.kyoka_ban as string | undefined) ?? null,
      kyokaYmd: (props.kyoka_ymd as string | undefined) ?? null,
      shiteiBan: (props.shitei_ban as string | undefined) ?? null,
      shiteiYmd: (props.shitei_ymd as string | undefined) ?? null,
      filename: buildPdfUrl(props.filename as string | undefined) ?? null,
      rawProps: props,
      geometry: feature.geometry as unknown as LineString,
    };

    try {
      // Use raw SQL for UPSERT with geometry
      // Note: geometry is passed as JSON string, converted via ST_GeomFromGeoJSON
      const geomJson = JSON.stringify(feature.geometry);
      const result = await db.execute(sql`
        INSERT INTO nagoya_designated_roads (
          source_layer, dedup_key, keycode, daicyo_ban, gid,
          encyo, fukuin, kyoka_ban, kyoka_ymd, shitei_ban, shitei_ymd,
          filename, raw_props, geometry, synced_at
        ) VALUES (
          ${record.sourceLayer},
          ${record.dedupKey},
          ${record.keycode},
          ${record.daicyoBan},
          ${record.gid},
          ${record.encyo},
          ${record.fukuin},
          ${record.kyokaBan},
          ${record.kyokaYmd},
          ${record.shiteiBan},
          ${record.shiteiYmd},
          ${record.filename},
          CAST(${JSON.stringify(record.rawProps)} AS jsonb),
          ST_SetSRID(ST_GeomFromGeoJSON(${geomJson}), 4326),
          NOW()
        )
        ON CONFLICT (source_layer, dedup_key)
        DO UPDATE SET
          keycode = EXCLUDED.keycode,
          daicyo_ban = EXCLUDED.daicyo_ban,
          gid = EXCLUDED.gid,
          encyo = EXCLUDED.encyo,
          fukuin = EXCLUDED.fukuin,
          kyoka_ban = EXCLUDED.kyoka_ban,
          kyoka_ymd = EXCLUDED.kyoka_ymd,
          shitei_ban = EXCLUDED.shitei_ban,
          shitei_ymd = EXCLUDED.shitei_ymd,
          filename = EXCLUDED.filename,
          raw_props = EXCLUDED.raw_props,
          geometry = EXCLUDED.geometry,
          synced_at = NOW()
        RETURNING (xmax = 0) as is_insert
      `);

      const isInsert = (result.rows[0] as { is_insert: boolean })?.is_insert;
      if (isInsert) {
        progress.roadsCreated++;
      } else {
        progress.roadsUpdated++;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Include context in first few errors for debugging
      if (progress.errors.length < 5) {
        progress.errors.push(`Line upsert failed [${sourceLayer}/${dedupKey}, geom:${feature.geometry?.type}/${feature.geometry?.coordinates?.length}]: ${message}`);
      } else {
        progress.errors.push(`Line upsert failed: ${message}`);
      }
    }
  }
}

/**
 * Upsert polygon features to database
 */
async function upsertPolygonFeatures(
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

    // Skip features with invalid geometry
    if (!feature.geometry || !feature.geometry.coordinates || feature.geometry.coordinates.length === 0) {
      progress.errors.push(`Skipping polygon with empty geometry: ${sourceLayer}/${dedupKey}`);
      continue;
    }

    const record: Omit<NewNagoyaDesignatedArea, 'id' | 'syncedAt'> = {
      sourceLayer,
      dedupKey,
      gid: (props.gid as number | undefined) ?? null,
      keycode: (props.keycode as string | undefined) ?? null,
      rawProps: props,
      geometry: feature.geometry as unknown as Polygon,
    };

    try {
      const geomJson = JSON.stringify(feature.geometry);
      const result = await db.execute(sql`
        INSERT INTO nagoya_designated_areas (
          source_layer, dedup_key, gid, keycode, raw_props, geometry, synced_at
        ) VALUES (
          ${record.sourceLayer},
          ${record.dedupKey},
          ${record.gid},
          ${record.keycode},
          CAST(${JSON.stringify(record.rawProps)} AS jsonb),
          ST_SetSRID(ST_GeomFromGeoJSON(${geomJson}), 4326),
          NOW()
        )
        ON CONFLICT (source_layer, dedup_key)
        DO UPDATE SET
          gid = EXCLUDED.gid,
          keycode = EXCLUDED.keycode,
          raw_props = EXCLUDED.raw_props,
          geometry = EXCLUDED.geometry,
          synced_at = NOW()
        RETURNING (xmax = 0) as is_insert
      `);

      const isInsert = (result.rows[0] as { is_insert: boolean })?.is_insert;
      if (isInsert) {
        progress.areasCreated++;
      } else {
        progress.areasUpdated++;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      progress.errors.push(`Polygon upsert failed: ${message}`);
    }
  }
}

/**
 * Nagoya Road Sync Service
 */
export class NagoyaRoadSyncService {
  /**
   * Start a new sync operation
   */
  async startSync(resume = false): Promise<SyncProgress> {
    // Check if sync is already running
    if (currentSync) {
      return currentSync.progress;
    }

    const logId = `NSL-${nanoid(10)}`;
    const startedAt = new Date();
    const tiles = getTilesToFetch();

    // Load resume state if requested
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
      roadsCreated: 0,
      roadsUpdated: 0,
      areasCreated: 0,
      areasUpdated: 0,
      errors: [],
    };

    // Create log entry
    await db.insert(nagoyaSyncLogs).values({
      id: logId,
      status: 'running',
      startedAt,
      totalTiles: tiles.length,
      completedTiles: completedSet.size,
    });

    // Create abort controller
    const abortController = new AbortController();
    currentSync = { logId, abortController, progress };

    // Run sync in background
    this.runSync(tilesToProcess, completedSet, progress, abortController.signal)
      .catch(error => {
        console.error('[Nagoya Sync] Error:', error);
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

    console.log(`[Nagoya Sync] Starting sync of ${tiles.length} tiles`);

    const tasks = tiles.map(tile => limit(async () => {
      if (signal.aborted) {
        throw new Error('Aborted');
      }

      const tileKey = `${tile.z}/${tile.x}/${tile.y}`;

      try {
        // Add delay for rate limiting
        await new Promise(r => setTimeout(r, DELAY_MS));

        const buffer = await fetchTile(tile, signal);

        if (buffer) {
          const { lines, polygons } = parseTile(buffer, tile);

          // Upsert features
          if (lines.length > 0) {
            await upsertLineFeatures(lines, progress);
          }
          if (polygons.length > 0) {
            await upsertPolygonFeatures(polygons, progress);
          }
        }

        completedSet.add(tileKey);
        progress.completedTiles++;

        // Update log periodically (every 10 tiles)
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

    // Final update
    await this.updateLog(progress, completedSet, errorTiles, true);

    console.log(`[Nagoya Sync] Completed: ${progress.roadsCreated} roads, ${progress.areasCreated} areas created`);
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
      roadsCreated: progress.roadsCreated,
      roadsUpdated: progress.roadsUpdated,
      areasCreated: progress.areasCreated,
      areasUpdated: progress.areasUpdated,
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
   * Get sync logs
   */
  async getLogs(limit = 20, offset = 0): Promise<{
    data: Array<typeof nagoyaSyncLogs.$inferSelect>;
    total: number;
  }> {
    const logs = await db.select()
      .from(nagoyaSyncLogs)
      .orderBy(sql`${nagoyaSyncLogs.startedAt} DESC`)
      .limit(limit)
      .offset(offset);

    const countResult = await db.execute<{ count: number }>(sql`
      SELECT COUNT(*)::int as count FROM nagoya_sync_logs
    `);

    return {
      data: logs,
      total: countResult.rows[0]?.count || 0,
    };
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<{
    totalRoads: number;
    totalAreas: number;
    roadsByLayer: Record<string, number>;
    areasByLayer: Record<string, number>;
    lastSyncAt: string | null;
  }> {
    const roadsResult = await db.execute<{ count: number }>(sql`
      SELECT COUNT(*)::int as count FROM nagoya_designated_roads
    `);

    const areasResult = await db.execute<{ count: number }>(sql`
      SELECT COUNT(*)::int as count FROM nagoya_designated_areas
    `);

    const roadsByLayerResult = await db.execute<{ source_layer: string; count: number }>(sql`
      SELECT source_layer, COUNT(*)::int as count
      FROM nagoya_designated_roads
      GROUP BY source_layer
    `);

    const areasByLayerResult = await db.execute<{ source_layer: string; count: number }>(sql`
      SELECT source_layer, COUNT(*)::int as count
      FROM nagoya_designated_areas
      GROUP BY source_layer
    `);

    const lastSyncResult = await db.execute<{ completed_at: Date }>(sql`
      SELECT completed_at FROM nagoya_sync_logs
      WHERE status = 'completed'
      ORDER BY completed_at DESC
      LIMIT 1
    `);

    const roadsByLayer: Record<string, number> = {};
    for (const row of roadsByLayerResult.rows) {
      roadsByLayer[row.source_layer] = row.count;
    }

    const areasByLayer: Record<string, number> = {};
    for (const row of areasByLayerResult.rows) {
      areasByLayer[row.source_layer] = row.count;
    }

    return {
      totalRoads: roadsResult.rows[0]?.count || 0,
      totalAreas: areasResult.rows[0]?.count || 0,
      roadsByLayer,
      areasByLayer,
      lastSyncAt: lastSyncResult.rows[0]?.completed_at
        ? (lastSyncResult.rows[0].completed_at instanceof Date
            ? lastSyncResult.rows[0].completed_at.toISOString()
            : String(lastSyncResult.rows[0].completed_at))
        : null,
    };
  }

  /**
   * Run spatial matching to link road_assets with nagoya_designated_roads
   */
  async runSpatialMatching(): Promise<{
    linksCreated: number;
    errors: string[];
  }> {
    const result = { linksCreated: 0, errors: [] as string[] };

    try {
      const matchResult = await db.execute<{ count: number }>(sql`
        INSERT INTO road_asset_nagoya_links (road_asset_id, nagoya_road_id, match_type, match_confidence, overlap_meters)
        SELECT
          ra.id,
          nr.id,
          'spatial',
          LEAST(1.0, ST_Length(ST_Intersection(ra.geometry, nr.geometry)::geography) /
            NULLIF(ST_Length(nr.geometry::geography), 0)),
          ST_Length(ST_Intersection(ra.geometry, nr.geometry)::geography)
        FROM road_assets ra
        JOIN nagoya_designated_roads nr
          ON ST_DWithin(ra.geometry::geography, nr.geometry::geography, 10)
        WHERE ST_Length(ST_Intersection(ra.geometry, nr.geometry)::geography) > 5
        ON CONFLICT (road_asset_id, nagoya_road_id) DO NOTHING
        RETURNING 1
      `);

      result.linksCreated = matchResult.rowCount || 0;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    return result;
  }
}

// Export singleton instance
export const nagoyaRoadSyncService = new NagoyaRoadSyncService();

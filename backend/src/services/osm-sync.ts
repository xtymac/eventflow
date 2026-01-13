/**
 * OSM Sync Service
 *
 * Handles synchronization of road data from OpenStreetMap via Overpass API.
 * Supports bbox-based and ward-based sync with intelligent rate limiting,
 * road segmentation, and manual edit protection.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Feature, FeatureCollection, LineString, Polygon, MultiPolygon, Position } from 'geojson';
import * as turf from '@turf/turf';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { roadAssets, osmSyncLogs, type NewOsmSyncLog } from '../db/schema.js';
import { eq, sql, and, isNotNull } from 'drizzle-orm';
import { toGeomSql } from '../db/geometry.js';
import {
  segmentSingleRoad,
  getWardPrefix,
  MIN_SEGMENT_LENGTH,
} from './segment-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration from environment variables
const OVERPASS_API_URL = process.env.OVERPASS_API_URL || 'https://overpass-api.de/api/interpreter';
const RATE_LIMIT_MS = parseInt(process.env.OVERPASS_RATE_LIMIT_MS || '2000', 10);
const TIMEOUT_MS = parseInt(process.env.OVERPASS_TIMEOUT_MS || '90000', 10);
const MAX_AREA_M2 = parseInt(process.env.OSM_SYNC_MAX_AREA_M2 || '1000000', 10);  // 1km²
const MAX_SIDE_KM = parseFloat(process.env.OSM_SYNC_MAX_SIDE_KM || '1.0');
const USER_AGENT = process.env.OVERPASS_USER_AGENT || 'EventFlow-OsmSync/1.0 (https://github.com/eventflow)';

// OSM highway types to include (from fetch-road-network.ts)
export const HIGHWAY_TYPES = [
  'primary',
  'primary_link',
  'secondary',
  'secondary_link',
  'tertiary',
  'tertiary_link',
  'residential',
  'unclassified',
  'living_street',
  'service',
];

// Mapping from OSM highway to our roadType
export const ROAD_TYPE_MAP: Record<string, string> = {
  primary: 'arterial',
  primary_link: 'arterial',
  secondary: 'arterial',
  secondary_link: 'arterial',
  tertiary: 'collector',
  tertiary_link: 'collector',
  residential: 'local',
  unclassified: 'local',
  living_street: 'local',
  service: 'local',
};

export interface BBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export interface SyncResult {
  logId: string;
  status: 'completed' | 'failed' | 'partial';
  osmRoadsFetched: number;
  roadsCreated: number;
  roadsUpdated: number;
  roadsMarkedInactive: number;
  roadsSkipped: number;
  errors: string[];
}

interface OsmWay {
  id: number;
  type: 'way';
  geometry: Array<{ lat: number; lon: number }>;
  tags: Record<string, string>;
  timestamp?: string;
}

/**
 * OSM Sync Service
 */
export class OsmSyncService {
  private lastRequestTime = 0;

  /**
   * Rate limit requests to Overpass API
   */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < RATE_LIMIT_MS) {
      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Split bbox into smaller cells if too large (using meter-based area)
   */
  private splitBbox(bbox: BBox): BBox[] {
    // Calculate dimensions using turf
    const widthKm = turf.distance(
      [bbox.minLng, bbox.minLat],
      [bbox.maxLng, bbox.minLat],
      { units: 'kilometers' }
    );
    const heightKm = turf.distance(
      [bbox.minLng, bbox.minLat],
      [bbox.minLng, bbox.maxLat],
      { units: 'kilometers' }
    );

    // Check if within limits
    if (widthKm <= MAX_SIDE_KM && heightKm <= MAX_SIDE_KM) {
      return [bbox];
    }

    // Alternatively check area
    const polygon = turf.bboxPolygon([bbox.minLng, bbox.minLat, bbox.maxLng, bbox.maxLat]);
    const areaM2 = turf.area(polygon);
    if (areaM2 <= MAX_AREA_M2) {
      return [bbox];
    }

    // Split into 4 cells
    const midLng = (bbox.minLng + bbox.maxLng) / 2;
    const midLat = (bbox.minLat + bbox.maxLat) / 2;

    const cells: BBox[] = [
      { minLng: bbox.minLng, minLat: bbox.minLat, maxLng: midLng, maxLat: midLat },
      { minLng: midLng, minLat: bbox.minLat, maxLng: bbox.maxLng, maxLat: midLat },
      { minLng: bbox.minLng, minLat: midLat, maxLng: midLng, maxLat: bbox.maxLat },
      { minLng: midLng, minLat: midLat, maxLng: bbox.maxLng, maxLat: bbox.maxLat },
    ];

    // Recursively split if needed
    return cells.flatMap((cell) => this.splitBbox(cell));
  }

  /**
   * Query Overpass API for roads in a bbox
   */
  private async fetchOsmRoads(bbox: BBox, maxRetries = 3): Promise<OsmWay[]> {
    const { minLng, minLat, maxLng, maxLat } = bbox;
    const bboxStr = `${minLat},${minLng},${maxLat},${maxLng}`;

    const highwayRegex = HIGHWAY_TYPES.join('|');
    const query = `
[out:json][timeout:${Math.floor(TIMEOUT_MS / 1000)}];
(
  way["highway"~"^(${highwayRegex})$"](${bboxStr});
);
out geom meta;
`;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.rateLimit();

        const response = await fetch(OVERPASS_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': USER_AGENT,
          },
          body: `data=${encodeURIComponent(query)}`,
        });

        if (response.status === 429) {
          // Rate limited - exponential backoff
          const waitTime = attempt * 10000;
          console.log(`[OSM Sync] Rate limited (429), waiting ${waitTime / 1000}s (attempt ${attempt}/${maxRetries})`);
          await new Promise((r) => setTimeout(r, waitTime));
          continue;
        }

        if (response.status === 504) {
          // Timeout - will be handled by bbox splitting
          throw new Error(`Overpass API timeout (504)`);
        }

        if (!response.ok) {
          throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return (data.elements || []).filter((e: OsmWay) => e.type === 'way');
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        const waitTime = attempt * 10000;
        console.log(`[OSM Sync] Request failed, retrying in ${waitTime / 1000}s (attempt ${attempt}/${maxRetries})`);
        await new Promise((r) => setTimeout(r, waitTime));
      }
    }

    return [];
  }

  /**
   * Convert OSM way to GeoJSON feature
   */
  private osmWayToGeoJSON(way: OsmWay, wardName: string): Feature<LineString> | null {
    if (!way.geometry || way.geometry.length < 2) {
      return null;
    }

    const coordinates: Position[] = way.geometry.map((node) => [node.lon, node.lat]);
    const tags = way.tags || {};

    return {
      type: 'Feature',
      properties: {
        osmId: way.id,
        name: tags.name || tags['name:en'] || null,
        name_ja: tags['name:ja'] || null,
        ref: tags.ref || null,
        local_ref: tags.local_ref || null,
        roadType: ROAD_TYPE_MAP[tags.highway] || 'local',
        lanes: parseInt(tags.lanes, 10) || 2,
        direction: tags.oneway === 'yes' || tags.oneway === '1' ? 'one-way' : 'two-way',
        ward: wardName,
        osmHighway: tags.highway,
        osmTimestamp: way.timestamp,
      },
      geometry: {
        type: 'LineString',
        coordinates,
      },
    };
  }

  /**
   * Get nearby roads from database for segmentation
   */
  private async getNearbyRoads(bbox: BBox): Promise<Feature<LineString>[]> {
    const { minLng, minLat, maxLng, maxLat } = bbox;

    const result = await db.execute<{
      id: string;
      geometry: { type: string; coordinates: Position[] };
    }>(sql`
      SELECT id, ST_AsGeoJSON(geometry)::json as geometry
      FROM road_assets
      WHERE ST_Intersects(
        geometry,
        ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326)
      )
      LIMIT 5000
    `);

    return result.rows.map((row) => ({
      type: 'Feature' as const,
      properties: { id: row.id },
      geometry: row.geometry as LineString,
    }));
  }

  /**
   * Generate a new road asset ID
   */
  private generateRoadAssetId(wardName: string): string {
    const prefix = getWardPrefix(wardName);
    return `RA-${prefix}-${nanoid(8)}`;
  }

  /**
   * Sync roads in a specific bbox
   */
  async syncBbox(bbox: BBox, triggeredBy = 'api'): Promise<SyncResult> {
    const logId = `OSL-${nanoid(10)}`;
    const bboxStr = `${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}`;
    const startedAt = new Date();

    // Create sync log entry
    await db.insert(osmSyncLogs).values({
      id: logId,
      syncType: 'bbox',
      bboxParam: bboxStr,
      status: 'running',
      startedAt,
      triggeredBy,
    });

    const result: SyncResult = {
      logId,
      status: 'completed',
      osmRoadsFetched: 0,
      roadsCreated: 0,
      roadsUpdated: 0,
      roadsMarkedInactive: 0,
      roadsSkipped: 0,
      errors: [],
    };

    try {
      // Split bbox into manageable cells
      const cells = this.splitBbox(bbox);
      console.log(`[OSM Sync] Processing ${cells.length} cell(s) for bbox: ${bboxStr}`);

      // Get nearby roads for segmentation
      const nearbyRoads = await this.getNearbyRoads(bbox);

      // Fetch OSM roads for each cell
      const allOsmWays: OsmWay[] = [];
      for (const cell of cells) {
        try {
          const ways = await this.fetchOsmRoads(cell);
          allOsmWays.push(...ways);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`Cell fetch failed: ${message}`);
          result.status = 'partial';
        }
      }

      // Deduplicate by OSM ID
      const uniqueWays = new Map<number, OsmWay>();
      for (const way of allOsmWays) {
        uniqueWays.set(way.id, way);
      }

      result.osmRoadsFetched = uniqueWays.size;
      console.log(`[OSM Sync] Fetched ${result.osmRoadsFetched} unique OSM ways`);

      // Determine ward from centroid of bbox
      const wardName = await this.determineWardName(bbox);

      // Process each OSM way
      for (const osmWay of uniqueWays.values()) {
        try {
          await this.processOsmWay(osmWay, wardName, nearbyRoads, result);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`Way ${osmWay.id} failed: ${message}`);
        }
      }

      // Update sync log
      await db.update(osmSyncLogs).set({
        status: result.errors.length > 0 ? 'partial' : 'completed',
        completedAt: new Date(),
        osmRoadsFetched: result.osmRoadsFetched,
        roadsCreated: result.roadsCreated,
        roadsUpdated: result.roadsUpdated,
        roadsMarkedInactive: result.roadsMarkedInactive,
        roadsSkipped: result.roadsSkipped,
        errorMessage: result.errors.length > 0 ? result.errors.join('; ') : null,
      }).where(eq(osmSyncLogs.id, logId));

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.status = 'failed';
      result.errors.push(message);

      await db.update(osmSyncLogs).set({
        status: 'failed',
        completedAt: new Date(),
        errorMessage: message,
      }).where(eq(osmSyncLogs.id, logId));
    }

    return result;
  }

  /**
   * Determine ward name from bbox (using centroid)
   */
  private async determineWardName(bbox: BBox): Promise<string> {
    // For simplicity, query database for roads in the area and use their ward
    const result = await db.execute<{ ward: string }>(sql`
      SELECT ward FROM road_assets
      WHERE ward IS NOT NULL
        AND ST_Intersects(
          geometry,
          ST_MakeEnvelope(${bbox.minLng}, ${bbox.minLat}, ${bbox.maxLng}, ${bbox.maxLat}, 4326)
        )
      LIMIT 1
    `);

    return result.rows[0]?.ward || 'Unknown';
  }

  /**
   * Process a single OSM way
   */
  private async processOsmWay(
    osmWay: OsmWay,
    wardName: string,
    nearbyRoads: Feature<LineString>[],
    result: SyncResult
  ): Promise<void> {
    // Check if any existing segments are manually edited
    const existingSegments = await db.select({
      id: roadAssets.id,
      isManuallyEdited: roadAssets.isManuallyEdited,
      osmId: roadAssets.osmId,
      segmentIndex: roadAssets.segmentIndex,
    })
      .from(roadAssets)
      .where(eq(roadAssets.osmId, BigInt(osmWay.id)));

    // If any segment is manually edited, skip the entire way
    const hasManualEdits = existingSegments.some((s) => s.isManuallyEdited);
    if (hasManualEdits) {
      result.roadsSkipped += existingSegments.length;
      return;
    }

    // Convert to GeoJSON
    const geoJsonRoad = this.osmWayToGeoJSON(osmWay, wardName);
    if (!geoJsonRoad) {
      return;
    }

    // Segment the road
    const segments = segmentSingleRoad(geoJsonRoad, nearbyRoads, MIN_SEGMENT_LENGTH);

    // Delete existing segments (if any)
    if (existingSegments.length > 0) {
      await db.delete(roadAssets).where(eq(roadAssets.osmId, BigInt(osmWay.id)));
      result.roadsUpdated += existingSegments.length;
    }

    // Insert new segments
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const props = segment.properties || {};
      const id = this.generateRoadAssetId(wardName);
      const now = new Date();

      await db.execute(sql`
        INSERT INTO road_assets (
          id, osm_id, segment_index, name, name_ja, ref, local_ref,
          display_name, name_source, geometry, road_type, lanes, direction,
          status, valid_from, ward, data_source, sync_source, is_manually_edited,
          last_synced_at, osm_timestamp, updated_at
        ) VALUES (
          ${id},
          ${osmWay.id},
          ${i},
          ${props.name || null},
          ${props.name_ja || null},
          ${props.ref || null},
          ${props.local_ref || null},
          ${props.name || props.ref || null},
          'osm',
          ${toGeomSql(segment.geometry)},
          ${props.roadType || 'local'},
          ${props.lanes || 2},
          ${props.direction || 'two-way'},
          'active',
          ${now},
          ${wardName},
          'osm_test',
          'osm-sync',
          false,
          ${now},
          ${props.osmTimestamp ? new Date(props.osmTimestamp) : null},
          ${now}
        )
      `);

      result.roadsCreated++;
    }
  }

  /**
   * Sync roads for a specific ward
   */
  async syncWard(wardName: string, triggeredBy = 'api'): Promise<SyncResult> {
    // Load ward boundary
    const boundaryPath = join(
      __dirname,
      '../../../sample-data/ward-boundaries',
      `${wardName.toLowerCase()}.geojson`
    );

    if (!existsSync(boundaryPath)) {
      throw new Error(`Ward boundary file not found: ${boundaryPath}`);
    }

    const content = readFileSync(boundaryPath, 'utf-8');
    const collection = JSON.parse(content) as FeatureCollection<Polygon | MultiPolygon>;

    if (collection.features.length === 0) {
      throw new Error(`No features in ward boundary file: ${boundaryPath}`);
    }

    // Get bbox from ward boundary
    const boundary = collection.features[0];
    const turfBbox = turf.bbox(boundary);
    const bbox: BBox = {
      minLng: turfBbox[0],
      minLat: turfBbox[1],
      maxLng: turfBbox[2],
      maxLat: turfBbox[3],
    };

    // Update log with ward param
    const result = await this.syncBbox(bbox, triggeredBy);

    // Update the log to include ward param
    await db.update(osmSyncLogs).set({
      syncType: 'ward',
      wardParam: wardName,
    }).where(eq(osmSyncLogs.id, result.logId));

    return result;
  }

  /**
   * Get sync status
   */
  async getStatus(): Promise<{
    runningSyncs: number;
    lastSyncAt: string | null;
    totalRoadsWithOsmId: number;
  }> {
    // Count running syncs
    const runningResult = await db.execute<{ count: number }>(sql`
      SELECT COUNT(*)::int as count FROM osm_sync_logs WHERE status = 'running'
    `);

    // Get last sync time
    const lastSyncResult = await db.execute<{ started_at: Date }>(sql`
      SELECT started_at FROM osm_sync_logs
      WHERE status IN ('completed', 'partial')
      ORDER BY started_at DESC
      LIMIT 1
    `);

    // Count roads with OSM ID
    const roadsResult = await db.execute<{ count: number }>(sql`
      SELECT COUNT(*)::int as count FROM road_assets WHERE osm_id IS NOT NULL
    `);

    return {
      runningSyncs: runningResult.rows[0]?.count || 0,
      lastSyncAt: lastSyncResult.rows[0]?.started_at?.toISOString() || null,
      totalRoadsWithOsmId: roadsResult.rows[0]?.count || 0,
    };
  }

  /**
   * Get sync logs
   */
  async getLogs(limit = 20, offset = 0): Promise<{
    data: Array<typeof osmSyncLogs.$inferSelect>;
    total: number;
  }> {
    const logs = await db.select()
      .from(osmSyncLogs)
      .orderBy(sql`${osmSyncLogs.startedAt} DESC`)
      .limit(limit)
      .offset(offset);

    const countResult = await db.execute<{ count: number }>(sql`
      SELECT COUNT(*)::int as count FROM osm_sync_logs
    `);

    return {
      data: logs,
      total: countResult.rows[0]?.count || 0,
    };
  }
}

// Export singleton instance
export const osmSyncService = new OsmSyncService();

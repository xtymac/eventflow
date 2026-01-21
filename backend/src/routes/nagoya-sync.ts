/**
 * Nagoya Designated Road Sync API Routes
 *
 * Endpoints for syncing 名古屋市指定道路 data from MVT tiles
 * and querying the synced data.
 */

import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { db } from '../db/index.js';
import { nagoyaDesignatedRoads, nagoyaDesignatedAreas, nagoyaBuildingZones, roadAssetNagoyaLinks } from '../db/schema.js';
import { sql } from 'drizzle-orm';
import { nagoyaRoadSyncService } from '../services/nagoya-road-sync.js';
import { nagoyaBuildingSyncService } from '../services/nagoya-building-sync.js';
import { fromGeomSql } from '../db/geometry.js';

// BBOX validation helper
function parseBbox(bbox: string): { minLng: number; minLat: number; maxLng: number; maxLat: number } | null {
  const parts = bbox.split(',').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return null;
  const [minLng, minLat, maxLng, maxLat] = parts;
  if (minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90) return null;
  if (minLng > maxLng || minLat > maxLat) return null;
  return { minLng, minLat, maxLng, maxLat };
}

// TypeBox schemas
const GeometrySchema = Type.Object({
  type: Type.String(),
  coordinates: Type.Any(),
});

const NagoyaRoadSchema = Type.Object({
  id: Type.Number(),
  sourceLayer: Type.String(),
  dedupKey: Type.String(),
  keycode: Type.Union([Type.String(), Type.Null()]),
  daicyoBan: Type.Union([Type.String(), Type.Null()]),
  gid: Type.Union([Type.Number(), Type.Null()]),
  encyo: Type.Union([Type.String(), Type.Null()]),
  fukuin: Type.Union([Type.String(), Type.Null()]),
  kyokaBan: Type.Union([Type.String(), Type.Null()]),
  kyokaYmd: Type.Union([Type.String(), Type.Null()]),
  shiteiBan: Type.Union([Type.String(), Type.Null()]),
  shiteiYmd: Type.Union([Type.String(), Type.Null()]),
  filename: Type.Union([Type.String(), Type.Null()]),
  geometry: GeometrySchema,
  syncedAt: Type.String(),
});

const NagoyaAreaSchema = Type.Object({
  id: Type.Number(),
  sourceLayer: Type.String(),
  dedupKey: Type.String(),
  gid: Type.Union([Type.Number(), Type.Null()]),
  keycode: Type.Union([Type.String(), Type.Null()]),
  geometry: GeometrySchema,
  syncedAt: Type.String(),
});

const NagoyaBuildingZoneSchema = Type.Object({
  id: Type.String(),
  sourceLayer: Type.String(),
  dedupKey: Type.String(),
  gid: Type.Union([Type.Number(), Type.Null()]),
  keycode: Type.Union([Type.String(), Type.Null()]),
  zoneType: Type.Union([Type.String(), Type.Null()]),
  name: Type.Union([Type.String(), Type.Null()]),
  kyoteiName: Type.Union([Type.String(), Type.Null()]),
  kubun: Type.Union([Type.String(), Type.Null()]),
  ninteiYmd: Type.Union([Type.String(), Type.Null()]),
  ninteiNo: Type.Union([Type.String(), Type.Null()]),
  shiteiYmd: Type.Union([Type.String(), Type.Null()]),
  kokokuYmd: Type.Union([Type.String(), Type.Null()]),
  menseki: Type.Union([Type.String(), Type.Null()]),
  geometry: GeometrySchema,
  syncedAt: Type.String(),
});

const BuildingSyncProgressSchema = Type.Object({
  logId: Type.String(),
  status: Type.String(),
  totalTiles: Type.Number(),
  completedTiles: Type.Number(),
  errorTiles: Type.Number(),
  zonesCreated: Type.Number(),
  zonesUpdated: Type.Number(),
  errors: Type.Array(Type.String()),
});

const SyncProgressSchema = Type.Object({
  logId: Type.String(),
  status: Type.String(),
  totalTiles: Type.Number(),
  completedTiles: Type.Number(),
  errorTiles: Type.Number(),
  roadsCreated: Type.Number(),
  roadsUpdated: Type.Number(),
  areasCreated: Type.Number(),
  areasUpdated: Type.Number(),
  errors: Type.Array(Type.String()),
});

export default async function nagoyaSyncRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // ============================================
  // SYNC OPERATIONS
  // ============================================

  /**
   * Start sync operation
   * POST /nagoya-sync/start
   */
  app.post('/nagoya-sync/start', {
    schema: {
      body: Type.Object({
        resume: Type.Optional(Type.Boolean()),
      }),
      response: {
        200: SyncProgressSchema,
      },
    },
  }, async (request) => {
    const { resume = false } = request.body;
    return await nagoyaRoadSyncService.startSync(resume);
  });

  /**
   * Stop sync operation
   * POST /nagoya-sync/stop
   */
  app.post('/nagoya-sync/stop', {
    schema: {
      response: {
        200: Type.Union([SyncProgressSchema, Type.Null()]),
      },
    },
  }, async () => {
    return await nagoyaRoadSyncService.stopSync();
  });

  /**
   * Get current sync status
   * GET /nagoya-sync/status
   */
  app.get('/nagoya-sync/status', {
    schema: {
      response: {
        200: Type.Object({
          isRunning: Type.Boolean(),
          progress: Type.Union([SyncProgressSchema, Type.Null()]),
          statistics: Type.Object({
            totalRoads: Type.Number(),
            totalAreas: Type.Number(),
            roadsByLayer: Type.Record(Type.String(), Type.Number()),
            areasByLayer: Type.Record(Type.String(), Type.Number()),
            lastSyncAt: Type.Union([Type.String(), Type.Null()]),
          }),
        }),
      },
    },
  }, async () => {
    const progress = nagoyaRoadSyncService.getStatus();
    const statistics = await nagoyaRoadSyncService.getStatistics();

    return {
      isRunning: progress?.status === 'running',
      progress,
      statistics,
    };
  });

  /**
   * Get sync logs
   * GET /nagoya-sync/logs
   */
  app.get('/nagoya-sync/logs', {
    schema: {
      querystring: Type.Object({
        limit: Type.Optional(Type.Number({ default: 20 })),
        offset: Type.Optional(Type.Number({ default: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(Type.Any()),
          total: Type.Number(),
        }),
      },
    },
  }, async (request) => {
    const { limit = 20, offset = 0 } = request.query;
    return await nagoyaRoadSyncService.getLogs(limit, offset);
  });

  /**
   * Run spatial matching
   * POST /nagoya-sync/match-roads
   */
  app.post('/nagoya-sync/match-roads', {
    schema: {
      response: {
        200: Type.Object({
          linksCreated: Type.Number(),
          errors: Type.Array(Type.String()),
        }),
      },
    },
  }, async () => {
    return await nagoyaRoadSyncService.runSpatialMatching();
  });

  // ============================================
  // DATA QUERIES
  // ============================================

  /**
   * Get designated roads (line features)
   * GET /nagoya-designated-roads
   */
  app.get('/nagoya-designated-roads', {
    schema: {
      querystring: Type.Object({
        bbox: Type.Optional(Type.String()),
        sourceLayer: Type.Optional(Type.String()),
        daicyoBan: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ default: 100, maximum: 1000 })),
        offset: Type.Optional(Type.Number({ default: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(NagoyaRoadSchema),
          total: Type.Number(),
        }),
      },
    },
  }, async (request) => {
    const { bbox, sourceLayer, daicyoBan, limit = 100, offset = 0 } = request.query;

    let whereClause = sql`1=1`;

    if (bbox) {
      const parsed = parseBbox(bbox);
      if (parsed) {
        whereClause = sql`${whereClause} AND ST_Intersects(
          geometry,
          ST_MakeEnvelope(${parsed.minLng}, ${parsed.minLat}, ${parsed.maxLng}, ${parsed.maxLat}, 4326)
        )`;
      }
    }

    if (sourceLayer) {
      whereClause = sql`${whereClause} AND source_layer = ${sourceLayer}`;
    }

    if (daicyoBan) {
      whereClause = sql`${whereClause} AND daicyo_ban = ${daicyoBan}`;
    }

    const dataResult = await db.execute<{
      id: number;
      source_layer: string;
      dedup_key: string;
      keycode: string | null;
      daicyo_ban: string | null;
      gid: number | null;
      encyo: string | null;
      fukuin: string | null;
      kyoka_ban: string | null;
      kyoka_ymd: string | null;
      shitei_ban: string | null;
      shitei_ymd: string | null;
      filename: string | null;
      geometry: object;
      synced_at: Date;
    }>(sql`
      SELECT
        id,
        source_layer,
        dedup_key,
        keycode,
        daicyo_ban,
        gid,
        encyo,
        fukuin,
        kyoka_ban,
        kyoka_ymd,
        shitei_ban,
        shitei_ymd,
        filename,
        ST_AsGeoJSON(geometry)::json as geometry,
        synced_at
      FROM nagoya_designated_roads
      WHERE ${whereClause}
      ORDER BY id
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    const countResult = await db.execute<{ count: number }>(sql`
      SELECT COUNT(*)::int as count
      FROM nagoya_designated_roads
      WHERE ${whereClause}
    `);

    const data = dataResult.rows.map(row => ({
      id: row.id,
      sourceLayer: row.source_layer,
      dedupKey: row.dedup_key,
      keycode: row.keycode,
      daicyoBan: row.daicyo_ban,
      gid: row.gid,
      encyo: row.encyo,
      fukuin: row.fukuin,
      kyokaBan: row.kyoka_ban,
      kyokaYmd: row.kyoka_ymd,
      shiteiBan: row.shitei_ban,
      shiteiYmd: row.shitei_ymd,
      filename: row.filename,
      geometry: row.geometry,
      syncedAt: row.synced_at.toISOString(),
    }));

    return {
      data,
      total: countResult.rows[0]?.count || 0,
    };
  });

  /**
   * Get single designated road by ID
   * GET /nagoya-designated-roads/:id
   */
  app.get('/nagoya-designated-roads/:id', {
    schema: {
      params: Type.Object({
        id: Type.Number(),
      }),
      response: {
        200: NagoyaRoadSchema,
        404: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    const result = await db.execute<{
      id: number;
      source_layer: string;
      dedup_key: string;
      keycode: string | null;
      daicyo_ban: string | null;
      gid: number | null;
      encyo: string | null;
      fukuin: string | null;
      kyoka_ban: string | null;
      kyoka_ymd: string | null;
      shitei_ban: string | null;
      shitei_ymd: string | null;
      filename: string | null;
      geometry: object;
      synced_at: Date;
    }>(sql`
      SELECT
        id,
        source_layer,
        dedup_key,
        keycode,
        daicyo_ban,
        gid,
        encyo,
        fukuin,
        kyoka_ban,
        kyoka_ymd,
        shitei_ban,
        shitei_ymd,
        filename,
        ST_AsGeoJSON(geometry)::json as geometry,
        synced_at
      FROM nagoya_designated_roads
      WHERE id = ${id}
    `);

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Road not found' });
    }

    const row = result.rows[0];
    return {
      id: row.id,
      sourceLayer: row.source_layer,
      dedupKey: row.dedup_key,
      keycode: row.keycode,
      daicyoBan: row.daicyo_ban,
      gid: row.gid,
      encyo: row.encyo,
      fukuin: row.fukuin,
      kyokaBan: row.kyoka_ban,
      kyokaYmd: row.kyoka_ymd,
      shiteiBan: row.shitei_ban,
      shiteiYmd: row.shitei_ymd,
      filename: row.filename,
      geometry: row.geometry,
      syncedAt: row.synced_at.toISOString(),
    };
  });

  /**
   * Get designated areas (polygon features)
   * GET /nagoya-designated-areas
   */
  app.get('/nagoya-designated-areas', {
    schema: {
      querystring: Type.Object({
        bbox: Type.Optional(Type.String()),
        sourceLayer: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ default: 100, maximum: 1000 })),
        offset: Type.Optional(Type.Number({ default: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(NagoyaAreaSchema),
          total: Type.Number(),
        }),
      },
    },
  }, async (request) => {
    const { bbox, sourceLayer, limit = 100, offset = 0 } = request.query;

    let whereClause = sql`1=1`;

    if (bbox) {
      const parsed = parseBbox(bbox);
      if (parsed) {
        whereClause = sql`${whereClause} AND ST_Intersects(
          geometry,
          ST_MakeEnvelope(${parsed.minLng}, ${parsed.minLat}, ${parsed.maxLng}, ${parsed.maxLat}, 4326)
        )`;
      }
    }

    if (sourceLayer) {
      whereClause = sql`${whereClause} AND source_layer = ${sourceLayer}`;
    }

    const dataResult = await db.execute<{
      id: number;
      source_layer: string;
      dedup_key: string;
      gid: number | null;
      keycode: string | null;
      geometry: object;
      synced_at: Date;
    }>(sql`
      SELECT
        id,
        source_layer,
        dedup_key,
        gid,
        keycode,
        ST_AsGeoJSON(geometry)::json as geometry,
        synced_at
      FROM nagoya_designated_areas
      WHERE ${whereClause}
      ORDER BY id
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    const countResult = await db.execute<{ count: number }>(sql`
      SELECT COUNT(*)::int as count
      FROM nagoya_designated_areas
      WHERE ${whereClause}
    `);

    const data = dataResult.rows.map(row => ({
      id: row.id,
      sourceLayer: row.source_layer,
      dedupKey: row.dedup_key,
      gid: row.gid,
      keycode: row.keycode,
      geometry: row.geometry,
      syncedAt: row.synced_at.toISOString(),
    }));

    return {
      data,
      total: countResult.rows[0]?.count || 0,
    };
  });

  /**
   * Get road asset links
   * GET /nagoya-road-links/:roadAssetId
   */
  app.get('/nagoya-road-links/:roadAssetId', {
    schema: {
      params: Type.Object({
        roadAssetId: Type.String(),
      }),
      response: {
        200: Type.Object({
          links: Type.Array(Type.Object({
            nagoyaRoadId: Type.Number(),
            matchType: Type.Union([Type.String(), Type.Null()]),
            matchConfidence: Type.Union([Type.Number(), Type.Null()]),
            overlapMeters: Type.Union([Type.Number(), Type.Null()]),
            nagoyaRoad: NagoyaRoadSchema,
          })),
        }),
      },
    },
  }, async (request) => {
    const { roadAssetId } = request.params;

    const result = await db.execute<{
      nagoya_road_id: number;
      match_type: string | null;
      match_confidence: string | null;
      overlap_meters: string | null;
      id: number;
      source_layer: string;
      dedup_key: string;
      keycode: string | null;
      daicyo_ban: string | null;
      gid: number | null;
      encyo: string | null;
      fukuin: string | null;
      kyoka_ban: string | null;
      kyoka_ymd: string | null;
      shitei_ban: string | null;
      shitei_ymd: string | null;
      filename: string | null;
      geometry: object;
      synced_at: Date;
    }>(sql`
      SELECT
        l.nagoya_road_id,
        l.match_type,
        l.match_confidence,
        l.overlap_meters,
        r.id,
        r.source_layer,
        r.dedup_key,
        r.keycode,
        r.daicyo_ban,
        r.gid,
        r.encyo,
        r.fukuin,
        r.kyoka_ban,
        r.kyoka_ymd,
        r.shitei_ban,
        r.shitei_ymd,
        r.filename,
        ST_AsGeoJSON(r.geometry)::json as geometry,
        r.synced_at
      FROM road_asset_nagoya_links l
      JOIN nagoya_designated_roads r ON l.nagoya_road_id = r.id
      WHERE l.road_asset_id = ${roadAssetId}
      ORDER BY l.match_confidence DESC NULLS LAST
    `);

    const links = result.rows.map(row => ({
      nagoyaRoadId: row.nagoya_road_id,
      matchType: row.match_type,
      matchConfidence: row.match_confidence ? parseFloat(row.match_confidence) : null,
      overlapMeters: row.overlap_meters ? parseFloat(row.overlap_meters) : null,
      nagoyaRoad: {
        id: row.id,
        sourceLayer: row.source_layer,
        dedupKey: row.dedup_key,
        keycode: row.keycode,
        daicyoBan: row.daicyo_ban,
        gid: row.gid,
        encyo: row.encyo,
        fukuin: row.fukuin,
        kyokaBan: row.kyoka_ban,
        kyokaYmd: row.kyoka_ymd,
        shiteiBan: row.shitei_ban,
        shiteiYmd: row.shitei_ymd,
        filename: row.filename,
        geometry: row.geometry,
        syncedAt: row.synced_at.toISOString(),
      },
    }));

    return { links };
  });

  // ============================================
  // BUILDING ZONES SYNC OPERATIONS
  // ============================================

  /**
   * Start building zones sync operation
   * POST /nagoya-building-sync/start
   */
  app.post('/nagoya-building-sync/start', {
    schema: {
      body: Type.Object({
        resume: Type.Optional(Type.Boolean()),
      }),
      response: {
        200: BuildingSyncProgressSchema,
      },
    },
  }, async (request) => {
    const { resume = false } = request.body;
    return await nagoyaBuildingSyncService.startSync(resume);
  });

  /**
   * Stop building zones sync operation
   * POST /nagoya-building-sync/stop
   */
  app.post('/nagoya-building-sync/stop', {
    schema: {
      response: {
        200: Type.Union([BuildingSyncProgressSchema, Type.Null()]),
      },
    },
  }, async () => {
    return await nagoyaBuildingSyncService.stopSync();
  });

  /**
   * Get building zones sync status
   * GET /nagoya-building-sync/status
   */
  app.get('/nagoya-building-sync/status', {
    schema: {
      response: {
        200: Type.Object({
          isRunning: Type.Boolean(),
          progress: Type.Union([BuildingSyncProgressSchema, Type.Null()]),
          statistics: Type.Object({
            totalZones: Type.Number(),
            zonesByLayer: Type.Record(Type.String(), Type.Number()),
            zonesByType: Type.Record(Type.String(), Type.Number()),
            lastSyncAt: Type.Union([Type.String(), Type.Null()]),
          }),
        }),
      },
    },
  }, async () => {
    const progress = nagoyaBuildingSyncService.getStatus();
    const statistics = await nagoyaBuildingSyncService.getStatistics();

    return {
      isRunning: progress?.status === 'running',
      progress,
      statistics,
    };
  });

  // ============================================
  // BUILDING ZONES DATA QUERIES
  // ============================================

  /**
   * Get building zones (polygon features)
   * GET /nagoya-building-zones
   */
  app.get('/nagoya-building-zones', {
    schema: {
      querystring: Type.Object({
        bbox: Type.Optional(Type.String()),
        sourceLayer: Type.Optional(Type.String()),
        zoneType: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ default: 100, maximum: 1000 })),
        offset: Type.Optional(Type.Number({ default: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(NagoyaBuildingZoneSchema),
          total: Type.Number(),
        }),
      },
    },
  }, async (request) => {
    const { bbox, sourceLayer, zoneType, limit = 100, offset = 0 } = request.query;

    let whereClause = sql`1=1`;

    if (bbox) {
      const parsed = parseBbox(bbox);
      if (parsed) {
        whereClause = sql`${whereClause} AND ST_Intersects(
          geometry,
          ST_MakeEnvelope(${parsed.minLng}, ${parsed.minLat}, ${parsed.maxLng}, ${parsed.maxLat}, 4326)
        )`;
      }
    }

    if (sourceLayer) {
      whereClause = sql`${whereClause} AND source_layer = ${sourceLayer}`;
    }

    if (zoneType) {
      whereClause = sql`${whereClause} AND zone_type = ${zoneType}`;
    }

    const dataResult = await db.execute<{
      id: string;
      source_layer: string;
      dedup_key: string;
      gid: number | null;
      keycode: string | null;
      zone_type: string | null;
      name: string | null;
      kyotei_name: string | null;
      kubun: string | null;
      nintei_ymd: string | null;
      nintei_no: string | null;
      shitei_ymd: string | null;
      kokoku_ymd: string | null;
      menseki: string | null;
      geometry: object;
      synced_at: Date;
    }>(sql`
      SELECT
        id,
        source_layer,
        dedup_key,
        gid,
        keycode,
        zone_type,
        name,
        kyotei_name,
        kubun,
        nintei_ymd,
        nintei_no,
        shitei_ymd,
        kokoku_ymd,
        menseki,
        ST_AsGeoJSON(geometry)::json as geometry,
        synced_at
      FROM nagoya_building_zones
      WHERE ${whereClause}
      ORDER BY id
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    const countResult = await db.execute<{ count: number }>(sql`
      SELECT COUNT(*)::int as count
      FROM nagoya_building_zones
      WHERE ${whereClause}
    `);

    const data = dataResult.rows.map(row => ({
      id: row.id,
      sourceLayer: row.source_layer,
      dedupKey: row.dedup_key,
      gid: row.gid,
      keycode: row.keycode,
      zoneType: row.zone_type,
      name: row.name,
      kyoteiName: row.kyotei_name,
      kubun: row.kubun,
      ninteiYmd: row.nintei_ymd,
      ninteiNo: row.nintei_no,
      shiteiYmd: row.shitei_ymd,
      kokokuYmd: row.kokoku_ymd,
      menseki: row.menseki,
      geometry: row.geometry,
      syncedAt: row.synced_at.toISOString(),
    }));

    return {
      data,
      total: countResult.rows[0]?.count || 0,
    };
  });

  /**
   * Get single building zone by ID
   * GET /nagoya-building-zones/:id
   */
  app.get('/nagoya-building-zones/:id', {
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      response: {
        200: NagoyaBuildingZoneSchema,
        404: Type.Object({
          error: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    const result = await db.execute<{
      id: string;
      source_layer: string;
      dedup_key: string;
      gid: number | null;
      keycode: string | null;
      zone_type: string | null;
      name: string | null;
      kyotei_name: string | null;
      kubun: string | null;
      nintei_ymd: string | null;
      nintei_no: string | null;
      shitei_ymd: string | null;
      kokoku_ymd: string | null;
      menseki: string | null;
      geometry: object;
      synced_at: Date;
    }>(sql`
      SELECT
        id,
        source_layer,
        dedup_key,
        gid,
        keycode,
        zone_type,
        name,
        kyotei_name,
        kubun,
        nintei_ymd,
        nintei_no,
        shitei_ymd,
        kokoku_ymd,
        menseki,
        ST_AsGeoJSON(geometry)::json as geometry,
        synced_at
      FROM nagoya_building_zones
      WHERE id = ${id}
    `);

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Building zone not found' });
    }

    const row = result.rows[0];
    return {
      id: row.id,
      sourceLayer: row.source_layer,
      dedupKey: row.dedup_key,
      gid: row.gid,
      keycode: row.keycode,
      zoneType: row.zone_type,
      name: row.name,
      kyoteiName: row.kyotei_name,
      kubun: row.kubun,
      ninteiYmd: row.nintei_ymd,
      ninteiNo: row.nintei_no,
      shiteiYmd: row.shitei_ymd,
      kokokuYmd: row.kokoku_ymd,
      menseki: row.menseki,
      geometry: row.geometry,
      syncedAt: row.synced_at.toISOString(),
    };
  });
}

/**
 * PMTiles Export Routes
 *
 * Provides streaming GeoJSON export endpoints for generating PMTiles.
 * Exports data in NDJSON (Newline Delimited JSON) format for efficient
 * processing with tippecanoe.
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

const BATCH_SIZE = 1000;

/**
 * Stream GeoJSON features as NDJSON (one feature per line)
 * This format is ideal for tippecanoe processing
 */
async function streamNdjsonFeatures(
  reply: FastifyReply,
  tableName: string,
  layerName: string,
  geometryColumn: string = 'geometry',
  propertiesColumns: string[] = []
): Promise<void> {
  reply.raw.writeHead(200, {
    'Content-Type': 'application/x-ndjson',
    'Transfer-Encoding': 'chunked',
    'Cache-Control': 'no-cache',
  });

  let offset = 0;
  let hasMore = true;

  // Build properties selection SQL
  const propsSelect = propertiesColumns.length > 0
    ? propertiesColumns.map(col => `"${col}"`).join(', ') + ','
    : '';

  while (hasMore) {
    const result = await db.execute<{
      geometry: object;
      [key: string]: unknown;
    }>(sql.raw(`
      SELECT
        ${propsSelect}
        ST_AsGeoJSON(${geometryColumn})::json as geometry
      FROM ${tableName}
      ORDER BY id
      LIMIT ${BATCH_SIZE}
      OFFSET ${offset}
    `));

    if (result.rows.length === 0) {
      hasMore = false;
      break;
    }

    for (const row of result.rows) {
      const { geometry, ...properties } = row;

      // Add layer name as tippecanoe property for layer assignment
      const feature = {
        type: 'Feature',
        tippecanoe: { layer: layerName },
        properties,
        geometry,
      };

      reply.raw.write(JSON.stringify(feature) + '\n');
    }

    offset += BATCH_SIZE;

    if (result.rows.length < BATCH_SIZE) {
      hasMore = false;
    }
  }

  reply.raw.end();
}

export async function pmtilesExportRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  /**
   * Export designated roads as NDJSON
   * GET /pmtiles-export/roads.ndjson
   */
  app.get('/pmtiles-export/roads.ndjson', {
    schema: {
      description: 'Export designated roads as NDJSON for tippecanoe',
    },
  }, async (request, reply) => {
    await streamNdjsonFeatures(
      reply,
      'nagoya_designated_roads',
      'shiteidouro',
      'geometry',
      ['source_layer', 'dedup_key', 'keycode', 'daicyo_ban', 'encyo', 'fukuin', 'shitei_ban', 'filename']
    );
  });

  /**
   * Export designated areas as NDJSON
   * GET /pmtiles-export/areas.ndjson
   */
  app.get('/pmtiles-export/areas.ndjson', {
    schema: {
      description: 'Export designated areas as NDJSON for tippecanoe',
    },
  }, async (request, reply) => {
    await streamNdjsonFeatures(
      reply,
      'nagoya_designated_areas',
      'shiteidouro_area',
      'geometry',
      ['source_layer', 'dedup_key', 'keycode', 'gid']
    );
  });

  /**
   * Export building zones as NDJSON
   * GET /pmtiles-export/buildings.ndjson
   */
  app.get('/pmtiles-export/buildings.ndjson', {
    schema: {
      description: 'Export building zones as NDJSON for tippecanoe',
    },
  }, async (request, reply) => {
    await streamNdjsonFeatures(
      reply,
      'nagoya_building_zones',
      'kenchiku',
      'geometry',
      ['source_layer', 'dedup_key', 'zone_type', 'name', 'keycode', 'gid']
    );
  });

  /**
   * Export all data as combined NDJSON
   * GET /pmtiles-export/all.ndjson
   */
  app.get('/pmtiles-export/all.ndjson', {
    schema: {
      description: 'Export all nagoya data as combined NDJSON for tippecanoe',
    },
  }, async (request, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'application/x-ndjson',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    });

    // Export roads
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      const result = await db.execute<{
        geometry: object;
        source_layer: string;
        dedup_key: string;
        keycode: string | null;
        daicyo_ban: string | null;
        encyo: string | null;
        fukuin: string | null;
        shitei_ban: string | null;
        filename: string | null;
      }>(sql`
        SELECT
          source_layer, dedup_key, keycode, daicyo_ban, encyo, fukuin, shitei_ban, filename,
          ST_AsGeoJSON(geometry)::json as geometry
        FROM nagoya_designated_roads
        ORDER BY id
        LIMIT ${BATCH_SIZE}
        OFFSET ${offset}
      `);

      for (const row of result.rows) {
        const { geometry, ...properties } = row;
        const feature = {
          type: 'Feature',
          tippecanoe: { layer: 'shiteidouro' },
          properties,
          geometry,
        };
        reply.raw.write(JSON.stringify(feature) + '\n');
      }

      offset += BATCH_SIZE;
      hasMore = result.rows.length === BATCH_SIZE;
    }

    // Export areas
    offset = 0;
    hasMore = true;
    while (hasMore) {
      const result = await db.execute<{
        geometry: object;
        source_layer: string;
        dedup_key: string;
        keycode: string | null;
        gid: number | null;
      }>(sql`
        SELECT
          source_layer, dedup_key, keycode, gid,
          ST_AsGeoJSON(geometry)::json as geometry
        FROM nagoya_designated_areas
        ORDER BY id
        LIMIT ${BATCH_SIZE}
        OFFSET ${offset}
      `);

      for (const row of result.rows) {
        const { geometry, ...properties } = row;
        const feature = {
          type: 'Feature',
          tippecanoe: { layer: 'shiteidouro_area' },
          properties,
          geometry,
        };
        reply.raw.write(JSON.stringify(feature) + '\n');
      }

      offset += BATCH_SIZE;
      hasMore = result.rows.length === BATCH_SIZE;
    }

    // Export building zones
    offset = 0;
    hasMore = true;
    while (hasMore) {
      const result = await db.execute<{
        geometry: object;
        source_layer: string;
        dedup_key: string;
        zone_type: string | null;
        name: string | null;
        keycode: string | null;
        gid: number | null;
      }>(sql`
        SELECT
          source_layer, dedup_key, zone_type, name, keycode, gid,
          ST_AsGeoJSON(geometry)::json as geometry
        FROM nagoya_building_zones
        ORDER BY id
        LIMIT ${BATCH_SIZE}
        OFFSET ${offset}
      `);

      for (const row of result.rows) {
        const { geometry, ...properties } = row;
        const feature = {
          type: 'Feature',
          tippecanoe: { layer: 'kenchiku' },
          properties,
          geometry,
        };
        reply.raw.write(JSON.stringify(feature) + '\n');
      }

      offset += BATCH_SIZE;
      hasMore = result.rows.length === BATCH_SIZE;
    }

    reply.raw.end();
  });

  /**
   * Get export statistics
   * GET /pmtiles-export/stats
   */
  app.get('/pmtiles-export/stats', {
    schema: {
      response: {
        200: Type.Object({
          roads: Type.Number(),
          areas: Type.Number(),
          buildingZones: Type.Number(),
          total: Type.Number(),
        }),
      },
    },
  }, async () => {
    const [roadsResult, areasResult, zonesResult] = await Promise.all([
      db.execute<{ count: number }>(sql`SELECT COUNT(*)::int as count FROM nagoya_designated_roads`),
      db.execute<{ count: number }>(sql`SELECT COUNT(*)::int as count FROM nagoya_designated_areas`),
      db.execute<{ count: number }>(sql`SELECT COUNT(*)::int as count FROM nagoya_building_zones`),
    ]);

    const roads = roadsResult.rows[0]?.count || 0;
    const areas = areasResult.rows[0]?.count || 0;
    const buildingZones = zonesResult.rows[0]?.count || 0;

    return {
      roads,
      areas,
      buildingZones,
      total: roads + areas + buildingZones,
    };
  });
}

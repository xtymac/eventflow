/**
 * OSM Sync API Routes
 *
 * Provides endpoints for syncing road data from OpenStreetMap.
 */

import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { osmSyncService, type BBox } from '../services/osm-sync.js';

// TypeBox schemas
const BboxSchema = Type.Object({
  minLng: Type.Number({ minimum: -180, maximum: 180 }),
  minLat: Type.Number({ minimum: -90, maximum: 90 }),
  maxLng: Type.Number({ minimum: -180, maximum: 180 }),
  maxLat: Type.Number({ minimum: -90, maximum: 90 }),
});

const SyncRequestSchema = Type.Object({
  bbox: BboxSchema,
  triggeredBy: Type.Optional(Type.String()),
});

const SyncResultSchema = Type.Object({
  logId: Type.String(),
  status: Type.Union([
    Type.Literal('completed'),
    Type.Literal('failed'),
    Type.Literal('partial'),
  ]),
  osmRoadsFetched: Type.Number(),
  roadsCreated: Type.Number(),
  roadsUpdated: Type.Number(),
  roadsMarkedInactive: Type.Number(),
  roadsSkipped: Type.Number(),
  errors: Type.Array(Type.String()),
});

const SyncLogSchema = Type.Object({
  id: Type.String(),
  syncType: Type.String(),
  bboxParam: Type.Union([Type.String(), Type.Null()]),
  wardParam: Type.Union([Type.String(), Type.Null()]),
  status: Type.String(),
  startedAt: Type.String({ format: 'date-time' }),
  completedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  osmRoadsFetched: Type.Union([Type.Number(), Type.Null()]),
  roadsCreated: Type.Union([Type.Number(), Type.Null()]),
  roadsUpdated: Type.Union([Type.Number(), Type.Null()]),
  roadsMarkedInactive: Type.Union([Type.Number(), Type.Null()]),
  roadsSkipped: Type.Union([Type.Number(), Type.Null()]),
  errorMessage: Type.Union([Type.String(), Type.Null()]),
  triggeredBy: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
});

const SyncStatusSchema = Type.Object({
  runningSyncs: Type.Number(),
  lastSyncAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  totalRoadsWithOsmId: Type.Number(),
});

export async function osmSyncRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // POST /osm-sync/bbox - Sync roads in a specific bbox
  app.post('/bbox', {
    schema: {
      body: SyncRequestSchema,
      response: {
        200: Type.Object({ data: SyncResultSchema }),
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { bbox, triggeredBy } = request.body;

    // Validate bbox logic
    if (bbox.minLng > bbox.maxLng) {
      return reply.status(400).send({ error: 'minLng must be less than maxLng' });
    }
    if (bbox.minLat > bbox.maxLat) {
      return reply.status(400).send({ error: 'minLat must be less than maxLat' });
    }

    try {
      const result = await osmSyncService.syncBbox(bbox, triggeredBy || 'frontend-user');
      return { data: result };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[OSM Sync] Bbox sync failed:', error);
      return reply.status(500).send({ error: `Sync failed: ${message}` });
    }
  });

  // POST /osm-sync/ward/:wardName - Sync roads for a specific ward
  app.post('/ward/:wardName', {
    schema: {
      params: Type.Object({
        wardName: Type.String(),
      }),
      querystring: Type.Object({
        triggeredBy: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({ data: SyncResultSchema }),
        400: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { wardName } = request.params;
    const { triggeredBy } = request.query;

    // Validate ward name (basic sanitization)
    if (!/^[a-zA-Z-]+(-ku)?$/.test(wardName)) {
      return reply.status(400).send({ error: 'Invalid ward name format' });
    }

    try {
      const result = await osmSyncService.syncWard(wardName, triggeredBy || 'frontend-user');
      return { data: result };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      // Check for specific error types
      if (message.includes('not found')) {
        return reply.status(404).send({ error: message });
      }

      console.error('[OSM Sync] Ward sync failed:', error);
      return reply.status(500).send({ error: `Sync failed: ${message}` });
    }
  });

  // GET /osm-sync/status - Get sync status
  app.get('/status', {
    schema: {
      response: {
        200: Type.Object({ data: SyncStatusSchema }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (_request, reply) => {
    try {
      const status = await osmSyncService.getStatus();
      return { data: status };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[OSM Sync] Status query failed:', error);
      return reply.status(500).send({ error: `Failed to get status: ${message}` });
    }
  });

  // GET /osm-sync/logs - Get sync logs
  app.get('/logs', {
    schema: {
      querystring: Type.Object({
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
        offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(SyncLogSchema),
          meta: Type.Object({
            total: Type.Number(),
            limit: Type.Number(),
            offset: Type.Number(),
          }),
        }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const limit = request.query.limit ?? 20;
    const offset = request.query.offset ?? 0;

    try {
      const result = await osmSyncService.getLogs(limit, offset);

      // Format dates for response
      const formattedData = result.data.map((log) => ({
        ...log,
        startedAt: log.startedAt.toISOString(),
        completedAt: log.completedAt?.toISOString() || null,
        createdAt: log.createdAt?.toISOString() || null,
      }));

      return {
        data: formattedData,
        meta: {
          total: result.total,
          limit,
          offset,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[OSM Sync] Logs query failed:', error);
      return reply.status(500).send({ error: `Failed to get logs: ${message}` });
    }
  });
}

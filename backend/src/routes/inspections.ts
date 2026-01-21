import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { db } from '../db/index.js';
import { inspectionRecords } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { toGeomSql, fromGeomSql } from '../db/geometry.js';

// TypeBox schemas
const PointGeometrySchema = Type.Object({
  type: Type.Literal('Point'),
  coordinates: Type.Tuple([Type.Number(), Type.Number()]),
});

const InspectionSchema = Type.Object({
  id: Type.String(),
  eventId: Type.Union([Type.String(), Type.Null()]),
  roadAssetId: Type.Union([Type.String(), Type.Null()]),
  inspectionDate: Type.String({ format: 'date' }),
  result: Type.String(),
  notes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  geometry: PointGeometrySchema,
  createdAt: Type.String({ format: 'date-time' }),
});

// Exactly one of eventId or roadAssetId must be provided
const CreateInspectionSchema = Type.Object({
  eventId: Type.Optional(Type.String()),
  roadAssetId: Type.Optional(Type.String()),
  inspectionDate: Type.String({ format: 'date' }),
  result: Type.String(),
  notes: Type.Optional(Type.String()),
  geometry: PointGeometrySchema,
});

// Schema for update - allow null to clear FK fields
const UpdateInspectionSchema = Type.Object({
  eventId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  roadAssetId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  inspectionDate: Type.Optional(Type.String({ format: 'date' })),
  result: Type.Optional(Type.String()),
  notes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  geometry: Type.Optional(PointGeometrySchema),
});

export async function inspectionsRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // GET /inspections - List inspections
  app.get('/', {
    schema: {
      querystring: Type.Object({
        eventId: Type.Optional(Type.String()),
        roadAssetId: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(InspectionSchema),
          meta: Type.Object({
            total: Type.Number(),
          }),
        }),
      },
    },
  }, async (request) => {
    const { eventId, roadAssetId } = request.query;

    const conditions = [];

    if (eventId) {
      conditions.push(eq(inspectionRecords.eventId, eventId));
    }
    if (roadAssetId) {
      conditions.push(eq(inspectionRecords.roadAssetId, roadAssetId));
    }

    // Select with explicit geometry conversion
    const inspectionSelect = {
      id: inspectionRecords.id,
      eventId: inspectionRecords.eventId,
      roadAssetId: inspectionRecords.roadAssetId,
      inspectionDate: inspectionRecords.inspectionDate,
      result: inspectionRecords.result,
      notes: inspectionRecords.notes,
      geometry: fromGeomSql(inspectionRecords.geometry),
      createdAt: inspectionRecords.createdAt,
    };

    const query = conditions.length > 0
      ? db.select(inspectionSelect).from(inspectionRecords).where(and(...conditions))
      : db.select(inspectionSelect).from(inspectionRecords);

    const inspections = await query;

    return {
      data: inspections.map(i => ({
        ...i,
        inspectionDate: i.inspectionDate.toISOString().split('T')[0],
        createdAt: i.createdAt.toISOString(),
      })),
      meta: { total: inspections.length },
    };
  });

  // GET /inspections/:id - Get inspection detail
  app.get('/:id', {
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      response: {
        200: Type.Object({ data: InspectionSchema }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    const inspectionSelect = {
      id: inspectionRecords.id,
      eventId: inspectionRecords.eventId,
      roadAssetId: inspectionRecords.roadAssetId,
      inspectionDate: inspectionRecords.inspectionDate,
      result: inspectionRecords.result,
      notes: inspectionRecords.notes,
      geometry: fromGeomSql(inspectionRecords.geometry),
      createdAt: inspectionRecords.createdAt,
    };

    const inspections = await db.select(inspectionSelect).from(inspectionRecords).where(eq(inspectionRecords.id, id));

    if (inspections.length === 0) {
      return reply.status(404).send({ error: 'Inspection not found' });
    }

    const inspection = inspections[0];
    return {
      data: {
        ...inspection,
        inspectionDate: inspection.inspectionDate.toISOString().split('T')[0],
        createdAt: inspection.createdAt.toISOString(),
      },
    };
  });

  // POST /inspections - Create inspection
  app.post('/', {
    schema: {
      body: CreateInspectionSchema,
      response: {
        201: Type.Object({ data: InspectionSchema }),
        400: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const body = request.body;

    // Validate: exactly one of eventId or roadAssetId must be provided
    if ((body.eventId && body.roadAssetId) || (!body.eventId && !body.roadAssetId)) {
      return reply.status(400).send({
        error: 'Exactly one of eventId or roadAssetId must be provided',
      });
    }

    const id = `INS-${nanoid(8)}`;
    const now = new Date();
    const inspectionDate = new Date(body.inspectionDate);

    // Use raw SQL for geometry insert
    await db.execute(sql`
      INSERT INTO inspection_records (
        id, event_id, road_asset_id, inspection_date, result, notes, geometry, created_at
      ) VALUES (
        ${id}, ${body.eventId ?? null}, ${body.roadAssetId ?? null},
        ${inspectionDate}, ${body.result}, ${body.notes ?? null},
        ${toGeomSql(body.geometry)}, ${now}
      )
    `);

    return reply.status(201).send({
      data: {
        id,
        eventId: body.eventId ?? null,
        roadAssetId: body.roadAssetId ?? null,
        inspectionDate: inspectionDate.toISOString().split('T')[0],
        result: body.result,
        notes: body.notes ?? null,
        geometry: body.geometry,
        createdAt: now.toISOString(),
      },
    });
  });

  // PUT /inspections/:id - Update inspection
  app.put('/:id', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: UpdateInspectionSchema,
      response: {
        200: Type.Object({ data: InspectionSchema }),
        400: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const body = request.body;

    // Fetch existing record to merge values
    const existing = await db.select({
      id: inspectionRecords.id,
      eventId: inspectionRecords.eventId,
      roadAssetId: inspectionRecords.roadAssetId,
    }).from(inspectionRecords).where(eq(inspectionRecords.id, id));

    if (existing.length === 0) {
      return reply.status(404).send({ error: 'Inspection not found' });
    }

    const current = existing[0];

    // Normalize empty strings to null (UI may send "" instead of null)
    const normalizeEmpty = (v: string | null | undefined) => v === '' ? null : v;

    // Compute effective FK values (merge body with existing)
    const effectiveEventId = body.eventId !== undefined ? normalizeEmpty(body.eventId) : current.eventId;
    const effectiveRoadAssetId = body.roadAssetId !== undefined ? normalizeEmpty(body.roadAssetId) : current.roadAssetId;

    // Validate FK constraint: exactly one must be non-null
    if ((effectiveEventId && effectiveRoadAssetId) || (!effectiveEventId && !effectiveRoadAssetId)) {
      return reply.status(400).send({
        error: 'Exactly one of eventId or roadAssetId must be provided',
      });
    }

    // Build update (geometry handled via raw SQL if present)
    if (body.geometry) {
      await db.execute(sql`
        UPDATE inspection_records
        SET geometry = ${toGeomSql(body.geometry)}
        WHERE id = ${id}
      `);
    }

    // Non-geometry updates - use normalized FK values to avoid sending '' to DB
    const updates: Record<string, unknown> = {};
    if (body.eventId !== undefined) updates.eventId = effectiveEventId;
    if (body.roadAssetId !== undefined) updates.roadAssetId = effectiveRoadAssetId;
    if (body.inspectionDate !== undefined) updates.inspectionDate = new Date(body.inspectionDate);
    if (body.result !== undefined) updates.result = body.result;
    if (body.notes !== undefined) updates.notes = body.notes === '' ? null : body.notes;

    if (Object.keys(updates).length > 0) {
      await db.update(inspectionRecords).set(updates).where(eq(inspectionRecords.id, id));
    }

    // Fetch updated record
    const inspectionSelect = {
      id: inspectionRecords.id,
      eventId: inspectionRecords.eventId,
      roadAssetId: inspectionRecords.roadAssetId,
      inspectionDate: inspectionRecords.inspectionDate,
      result: inspectionRecords.result,
      notes: inspectionRecords.notes,
      geometry: fromGeomSql(inspectionRecords.geometry),
      createdAt: inspectionRecords.createdAt,
    };

    const updated = await db.select(inspectionSelect)
      .from(inspectionRecords).where(eq(inspectionRecords.id, id));
    const inspection = updated[0];

    return {
      data: {
        ...inspection,
        inspectionDate: inspection.inspectionDate.toISOString().split('T')[0],
        createdAt: inspection.createdAt.toISOString(),
      },
    };
  });

  // DELETE /inspections/:id - Delete inspection
  app.delete('/:id', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      response: {
        204: Type.Null(),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    const existing = await db.select({ id: inspectionRecords.id })
      .from(inspectionRecords).where(eq(inspectionRecords.id, id));
    if (existing.length === 0) {
      return reply.status(404).send({ error: 'Inspection not found' });
    }

    await db.delete(inspectionRecords).where(eq(inspectionRecords.id, id));
    return reply.status(204).send(null);
  });
}

import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { db } from '../db/index.js';
import { inspectionRecords } from '../db/schema.js';
import { eq, and, sql, desc } from 'drizzle-orm';
/** Generate a 5-digit numeric ID using a DB sequence */
async function nextInspectionId(): Promise<string> {
  const result = await db.execute(sql`SELECT nextval('inspection_id_seq') AS val`);
  const rows = (result as { rows?: { val: string }[] }).rows ?? result;
  const val = Array.isArray(rows) ? (rows[0] as { val: string }).val : (rows as unknown as { val: string }).val;
  return String(val);
}
import { toGeomSql, fromGeomSql } from '../db/geometry.js';

// TypeBox schemas
const PointGeometrySchema = Type.Object({
  type: Type.Literal('Point'),
  coordinates: Type.Tuple([Type.Number(), Type.Number()]),
});

/** Reusable media URL validation: max 3 items, each ≤400k chars, data:image or https:// only */
const MediaUrlItem = Type.String({
  maxLength: 400_000,
  pattern: '^(data:image\\/[a-zA-Z0-9.+-]+;base64,|https:\\/\\/)',
});
const MediaUrlsSchema = Type.Optional(
  Type.Array(MediaUrlItem, { maxItems: 3 }),
);

const InspectionSchema = Type.Object({
  id: Type.String(),
  eventId: Type.Union([Type.String(), Type.Null()]),
  roadAssetId: Type.Union([Type.String(), Type.Null()]),
  assetType: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  assetId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  inspectionDate: Type.String({ format: 'date' }),
  result: Type.String(),
  conditionGrade: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  findings: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  notes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  inspector: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  measurements: Type.Optional(Type.Union([Type.Record(Type.String(), Type.Unknown()), Type.Null()])),
  mediaUrls: Type.Optional(Type.Union([Type.Array(Type.String()), Type.Null()])),
  geometry: PointGeometrySchema,
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
  status: Type.String(),
});

// At least one reference must be provided: eventId, roadAssetId, or assetType+assetId
const CreateInspectionSchema = Type.Object({
  eventId: Type.Optional(Type.String()),
  roadAssetId: Type.Optional(Type.String()),
  assetType: Type.Optional(Type.String()),
  assetId: Type.Optional(Type.String()),
  inspectionDate: Type.String({ format: 'date' }),
  result: Type.Optional(Type.String()),
  conditionGrade: Type.Optional(Type.String()),
  findings: Type.Optional(Type.String()),
  notes: Type.Optional(Type.String()),
  inspector: Type.Optional(Type.String()),
  measurements: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  mediaUrls: MediaUrlsSchema,
  geometry: PointGeometrySchema,
  status: Type.Optional(Type.String()),
});

// Schema for update - allow null to clear FK fields
const UpdateInspectionSchema = Type.Object({
  eventId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  roadAssetId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  inspectionDate: Type.Optional(Type.String({ format: 'date' })),
  result: Type.Optional(Type.String()),
  conditionGrade: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  findings: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  notes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  inspector: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  measurements: Type.Optional(Type.Union([Type.Record(Type.String(), Type.Unknown()), Type.Null()])),
  mediaUrls: Type.Optional(Type.Union([Type.Array(MediaUrlItem, { maxItems: 3 }), Type.Null()])),
  geometry: Type.Optional(PointGeometrySchema),
  status: Type.Optional(Type.String()),
});

export async function inspectionsRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // GET /inspections - List inspections
  app.get('/', {
    schema: {
      querystring: Type.Object({
        eventId: Type.Optional(Type.String()),
        roadAssetId: Type.Optional(Type.String()),
        assetType: Type.Optional(Type.String()),
        assetId: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(InspectionSchema),
          meta: Type.Object({
            total: Type.Number(),
          }),
        }),
        400: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { eventId, roadAssetId, assetType, assetId } = request.query;

    // Pair validation: assetType and assetId must be provided together
    if ((assetType && !assetId) || (!assetType && assetId)) {
      return reply.status(400).send({
        error: 'assetType and assetId must be provided together',
      });
    }

    const conditions = [];

    if (eventId) {
      conditions.push(eq(inspectionRecords.eventId, eventId));
    }
    if (roadAssetId) {
      conditions.push(eq(inspectionRecords.roadAssetId, roadAssetId));
    }
    if (assetType && assetId) {
      conditions.push(eq(inspectionRecords.assetType, assetType));
      conditions.push(eq(inspectionRecords.assetId, assetId));
    }

    // Select with explicit geometry conversion
    const inspectionSelect = {
      id: inspectionRecords.id,
      eventId: inspectionRecords.eventId,
      roadAssetId: inspectionRecords.roadAssetId,
      assetType: inspectionRecords.assetType,
      assetId: inspectionRecords.assetId,
      inspectionDate: inspectionRecords.inspectionDate,
      result: inspectionRecords.result,
      conditionGrade: inspectionRecords.conditionGrade,
      findings: inspectionRecords.findings,
      notes: inspectionRecords.notes,
      inspector: inspectionRecords.inspector,
      measurements: inspectionRecords.measurements,
      mediaUrls: inspectionRecords.mediaUrls,
      geometry: fromGeomSql(inspectionRecords.geometry),
      createdAt: inspectionRecords.createdAt,
      updatedAt: inspectionRecords.updatedAt,
      status: inspectionRecords.status,
    };

    const query = conditions.length > 0
      ? db.select(inspectionSelect).from(inspectionRecords).where(and(...conditions)).orderBy(desc(inspectionRecords.createdAt))
      : db.select(inspectionSelect).from(inspectionRecords).orderBy(desc(inspectionRecords.createdAt));

    const inspections = await query;

    return {
      data: inspections.map(i => ({
        ...i,
        inspectionDate: i.inspectionDate.toISOString().split('T')[0],
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString(),
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
      assetType: inspectionRecords.assetType,
      assetId: inspectionRecords.assetId,
      inspectionDate: inspectionRecords.inspectionDate,
      result: inspectionRecords.result,
      conditionGrade: inspectionRecords.conditionGrade,
      findings: inspectionRecords.findings,
      notes: inspectionRecords.notes,
      inspector: inspectionRecords.inspector,
      measurements: inspectionRecords.measurements,
      mediaUrls: inspectionRecords.mediaUrls,
      geometry: fromGeomSql(inspectionRecords.geometry),
      createdAt: inspectionRecords.createdAt,
      updatedAt: inspectionRecords.updatedAt,
      status: inspectionRecords.status,
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
        updatedAt: inspection.updatedAt.toISOString(),
      },
    };
  });

  // POST /inspections - Create inspection
  app.post('/', {
    bodyLimit: 2 * 1024 * 1024,
    schema: {
      body: CreateInspectionSchema,
      response: {
        201: Type.Object({ data: InspectionSchema }),
        400: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const body = request.body;
    const status = body.status === 'draft' ? 'draft' : 'submitted';

    // For submitted records, result is required
    if (status === 'submitted' && !body.result) {
      return reply.status(400).send({
        error: 'result is required for submitted inspections',
      });
    }

    // Validate: at least one reference must be provided
    const hasLegacyRef = !!(body.eventId || body.roadAssetId);
    const hasAssetRef = !!(body.assetType && body.assetId);
    if (!hasLegacyRef && !hasAssetRef) {
      return reply.status(400).send({
        error: 'At least one reference must be provided: eventId, roadAssetId, or assetType+assetId',
      });
    }

    const id = await nextInspectionId();
    const now = new Date();
    const inspectionDate = new Date(body.inspectionDate);
    const result = body.result || '';

    // Use raw SQL for geometry insert (includes all new fields)
    await db.execute(sql`
      INSERT INTO inspection_records (
        id, event_id, road_asset_id, asset_type, asset_id,
        inspection_date, result, condition_grade,
        findings, notes, inspector, measurements, media_urls,
        geometry, created_at, updated_at, status
      ) VALUES (
        ${id}, ${body.eventId ?? null}, ${body.roadAssetId ?? null},
        ${body.assetType ?? null}, ${body.assetId ?? null},
        ${inspectionDate}, ${result},
        ${body.conditionGrade ?? null}, ${body.findings ?? null},
        ${body.notes ?? null}, ${body.inspector ?? null},
        ${body.measurements ? sql`${JSON.stringify(body.measurements)}::jsonb` : sql`null`},
        ${body.mediaUrls ? sql`${JSON.stringify(body.mediaUrls)}::jsonb` : sql`null`},
        ${toGeomSql(body.geometry)}, ${now}, ${now}, ${status}
      )
    `);

    return reply.status(201).send({
      data: {
        id,
        eventId: body.eventId ?? null,
        roadAssetId: body.roadAssetId ?? null,
        assetType: body.assetType ?? null,
        assetId: body.assetId ?? null,
        inspectionDate: inspectionDate.toISOString().split('T')[0],
        result,
        conditionGrade: body.conditionGrade ?? null,
        findings: body.findings ?? null,
        notes: body.notes ?? null,
        inspector: body.inspector ?? null,
        mediaUrls: body.mediaUrls ?? null,
        geometry: body.geometry,
        createdAt: now.toISOString(),
        status,
      },
    });
  });

  // PUT /inspections/:id - Update inspection
  app.put('/:id', {
    bodyLimit: 2 * 1024 * 1024,
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
      assetType: inspectionRecords.assetType,
      status: inspectionRecords.status,
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

    // Validate FK constraint: exactly one must be non-null (unless record uses assetType/assetId)
    if (!current.assetType && ((effectiveEventId && effectiveRoadAssetId) || (!effectiveEventId && !effectiveRoadAssetId))) {
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
    if (body.conditionGrade !== undefined) updates.conditionGrade = body.conditionGrade === '' ? null : body.conditionGrade;
    if (body.findings !== undefined) updates.findings = body.findings === '' ? null : body.findings;
    if (body.notes !== undefined) updates.notes = body.notes === '' ? null : body.notes;
    if (body.inspector !== undefined) updates.inspector = body.inspector === '' ? null : body.inspector;
    if (body.measurements !== undefined) updates.measurements = body.measurements;
    if (body.mediaUrls !== undefined) updates.mediaUrls = body.mediaUrls;
    if (body.status !== undefined) updates.status = body.status;

    if (Object.keys(updates).length > 0) {
      await db.update(inspectionRecords).set(updates).where(eq(inspectionRecords.id, id));
    }

    // Fetch updated record
    const inspectionSelect = {
      id: inspectionRecords.id,
      eventId: inspectionRecords.eventId,
      roadAssetId: inspectionRecords.roadAssetId,
      assetType: inspectionRecords.assetType,
      assetId: inspectionRecords.assetId,
      inspectionDate: inspectionRecords.inspectionDate,
      result: inspectionRecords.result,
      conditionGrade: inspectionRecords.conditionGrade,
      findings: inspectionRecords.findings,
      notes: inspectionRecords.notes,
      inspector: inspectionRecords.inspector,
      measurements: inspectionRecords.measurements,
      mediaUrls: inspectionRecords.mediaUrls,
      geometry: fromGeomSql(inspectionRecords.geometry),
      createdAt: inspectionRecords.createdAt,
      updatedAt: inspectionRecords.updatedAt,
      status: inspectionRecords.status,
    };

    const updated = await db.select(inspectionSelect)
      .from(inspectionRecords).where(eq(inspectionRecords.id, id));
    const inspection = updated[0];

    return {
      data: {
        ...inspection,
        inspectionDate: inspection.inspectionDate.toISOString().split('T')[0],
        createdAt: inspection.createdAt.toISOString(),
        updatedAt: inspection.updatedAt.toISOString(),
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

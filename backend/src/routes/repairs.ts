import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { db } from '../db/index.js';
import { repairRecords } from '../db/schema.js';
import { eq, and, sql, desc } from 'drizzle-orm';
import { toGeomSql, fromGeomSql } from '../db/geometry.js';

/** Generate a 5-digit numeric ID using a DB sequence */
async function nextRepairId(): Promise<string> {
  const result = await db.execute(sql`SELECT nextval('repair_id_seq') AS val`);
  const rows = (result as { rows?: { val: string }[] }).rows ?? result;
  const val = Array.isArray(rows) ? (rows[0] as { val: string }).val : (rows as unknown as { val: string }).val;
  return String(val);
}

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

const RepairSchema = Type.Object({
  id: Type.String(),
  assetType: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  assetId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  repairDate: Type.String({ format: 'date' }),
  repairType: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  conditionGrade: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  mainReplacementParts: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  repairNotes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  designDocNumber: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  vendor: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  measurements: Type.Optional(Type.Union([Type.Record(Type.String(), Type.Unknown()), Type.Null()])),
  mediaUrls: Type.Optional(Type.Union([Type.Array(Type.String()), Type.Null()])),
  geometry: PointGeometrySchema,
  createdAt: Type.String({ format: 'date-time' }),
  status: Type.String(),
});

const CreateRepairSchema = Type.Object({
  assetType: Type.Optional(Type.String()),
  assetId: Type.Optional(Type.String()),
  repairDate: Type.String({ format: 'date' }),
  repairType: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  conditionGrade: Type.Optional(Type.String()),
  mainReplacementParts: Type.Optional(Type.String()),
  repairNotes: Type.Optional(Type.String()),
  designDocNumber: Type.Optional(Type.String()),
  vendor: Type.Optional(Type.String()),
  measurements: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  mediaUrls: MediaUrlsSchema,
  geometry: PointGeometrySchema,
  status: Type.Optional(Type.String()),
});

export async function repairsRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // GET /repairs - List repairs
  app.get('/', {
    schema: {
      querystring: Type.Object({
        assetType: Type.Optional(Type.String()),
        assetId: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(RepairSchema),
          meta: Type.Object({ total: Type.Number() }),
        }),
        400: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { assetType, assetId } = request.query;

    if ((assetType && !assetId) || (!assetType && assetId)) {
      return reply.status(400).send({
        error: 'assetType and assetId must be provided together',
      });
    }

    const conditions = [];
    if (assetType && assetId) {
      conditions.push(eq(repairRecords.assetType, assetType));
      conditions.push(eq(repairRecords.assetId, assetId));
    }

    const repairSelect = {
      id: repairRecords.id,
      assetType: repairRecords.assetType,
      assetId: repairRecords.assetId,
      repairDate: repairRecords.repairDate,
      repairType: repairRecords.repairType,
      description: repairRecords.description,
      conditionGrade: repairRecords.conditionGrade,
      mainReplacementParts: repairRecords.mainReplacementParts,
      repairNotes: repairRecords.repairNotes,
      designDocNumber: repairRecords.designDocNumber,
      vendor: repairRecords.vendor,
      measurements: repairRecords.measurements,
      mediaUrls: repairRecords.mediaUrls,
      geometry: fromGeomSql(repairRecords.geometry),
      createdAt: repairRecords.createdAt,
      status: repairRecords.status,
    };

    const query = conditions.length > 0
      ? db.select(repairSelect).from(repairRecords).where(and(...conditions)).orderBy(desc(repairRecords.createdAt))
      : db.select(repairSelect).from(repairRecords).orderBy(desc(repairRecords.createdAt));

    const repairs = await query;

    return {
      data: repairs.map(r => ({
        ...r,
        repairDate: r.repairDate.toISOString().split('T')[0],
        createdAt: r.createdAt.toISOString(),
      })),
      meta: { total: repairs.length },
    };
  });

  // GET /repairs/:id - Get repair detail
  app.get('/:id', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      response: {
        200: Type.Object({ data: RepairSchema }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    const repairSelect = {
      id: repairRecords.id,
      assetType: repairRecords.assetType,
      assetId: repairRecords.assetId,
      repairDate: repairRecords.repairDate,
      repairType: repairRecords.repairType,
      description: repairRecords.description,
      conditionGrade: repairRecords.conditionGrade,
      mainReplacementParts: repairRecords.mainReplacementParts,
      repairNotes: repairRecords.repairNotes,
      designDocNumber: repairRecords.designDocNumber,
      vendor: repairRecords.vendor,
      measurements: repairRecords.measurements,
      mediaUrls: repairRecords.mediaUrls,
      geometry: fromGeomSql(repairRecords.geometry),
      createdAt: repairRecords.createdAt,
      status: repairRecords.status,
    };

    const repairs = await db.select(repairSelect).from(repairRecords).where(eq(repairRecords.id, id));

    if (repairs.length === 0) {
      return reply.status(404).send({ error: 'Repair not found' });
    }

    const repair = repairs[0];
    return {
      data: {
        ...repair,
        repairDate: repair.repairDate.toISOString().split('T')[0],
        createdAt: repair.createdAt.toISOString(),
      },
    };
  });

  // POST /repairs - Create repair
  app.post('/', {
    bodyLimit: 2 * 1024 * 1024,
    schema: {
      body: CreateRepairSchema,
      response: {
        201: Type.Object({ data: RepairSchema }),
        400: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const body = request.body;
    const status = body.status === 'draft' ? 'draft' : 'submitted';

    if (!body.assetType || !body.assetId) {
      return reply.status(400).send({
        error: 'assetType and assetId are required',
      });
    }

    const id = await nextRepairId();
    const now = new Date();
    const repairDate = new Date(body.repairDate);

    await db.execute(sql`
      INSERT INTO repair_records (
        id, asset_type, asset_id,
        repair_date, repair_type, description, condition_grade,
        main_replacement_parts, repair_notes, design_doc_number, vendor,
        measurements, media_urls, geometry, created_at, updated_at, status
      ) VALUES (
        ${id}, ${body.assetType ?? null}, ${body.assetId ?? null},
        ${repairDate}, ${body.repairType ?? null}, ${body.description ?? null},
        ${body.conditionGrade ?? null}, ${body.mainReplacementParts ?? null},
        ${body.repairNotes ?? null}, ${body.designDocNumber ?? null},
        ${body.vendor ?? null},
        ${body.measurements ? sql`${JSON.stringify(body.measurements)}::jsonb` : sql`null`},
        ${body.mediaUrls ? sql`${JSON.stringify(body.mediaUrls)}::jsonb` : sql`null`},
        ${toGeomSql(body.geometry)}, ${now}, ${now}, ${status}
      )
    `);

    return reply.status(201).send({
      data: {
        id,
        assetType: body.assetType ?? null,
        assetId: body.assetId ?? null,
        repairDate: repairDate.toISOString().split('T')[0],
        repairType: body.repairType ?? null,
        description: body.description ?? null,
        conditionGrade: body.conditionGrade ?? null,
        mainReplacementParts: body.mainReplacementParts ?? null,
        repairNotes: body.repairNotes ?? null,
        designDocNumber: body.designDocNumber ?? null,
        vendor: body.vendor ?? null,
        mediaUrls: body.mediaUrls ?? null,
        geometry: body.geometry,
        createdAt: now.toISOString(),
        status,
      },
    });
  });

  // PUT /repairs/:id - Update repair
  app.put('/:id', {
    bodyLimit: 2 * 1024 * 1024,
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: Type.Object({
        repairDate: Type.Optional(Type.String({ format: 'date' })),
        repairType: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        conditionGrade: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        mainReplacementParts: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        repairNotes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        designDocNumber: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        vendor: Type.Optional(Type.Union([Type.String(), Type.Null()])),
        measurements: Type.Optional(Type.Union([Type.Record(Type.String(), Type.Unknown()), Type.Null()])),
        mediaUrls: Type.Optional(Type.Union([Type.Array(MediaUrlItem, { maxItems: 3 }), Type.Null()])),
        geometry: Type.Optional(PointGeometrySchema),
        status: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({ data: RepairSchema }),
        400: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const body = request.body;

    const existing = await db.select({
      id: repairRecords.id,
      status: repairRecords.status,
    }).from(repairRecords).where(eq(repairRecords.id, id));

    if (existing.length === 0) {
      return reply.status(404).send({ error: 'Repair not found' });
    }

    const current = existing[0];

    // Handle geometry update via raw SQL
    if (body.geometry) {
      await db.execute(sql`
        UPDATE repair_records SET geometry = ${toGeomSql(body.geometry)} WHERE id = ${id}
      `);
    }

    // Build non-geometry updates
    const updates: Record<string, unknown> = {};
    if (body.repairDate !== undefined) updates.repairDate = new Date(body.repairDate);
    if (body.repairType !== undefined) updates.repairType = body.repairType;
    if (body.description !== undefined) updates.description = body.description;
    if (body.conditionGrade !== undefined) updates.conditionGrade = body.conditionGrade;
    if (body.mainReplacementParts !== undefined) updates.mainReplacementParts = body.mainReplacementParts;
    if (body.repairNotes !== undefined) updates.repairNotes = body.repairNotes;
    if (body.designDocNumber !== undefined) updates.designDocNumber = body.designDocNumber;
    if (body.vendor !== undefined) updates.vendor = body.vendor;
    if (body.measurements !== undefined) updates.measurements = body.measurements;
    if (body.mediaUrls !== undefined) updates.mediaUrls = body.mediaUrls;
    if (body.status !== undefined) updates.status = body.status;
    updates.updatedAt = new Date();

    if (Object.keys(updates).length > 0) {
      await db.update(repairRecords).set(updates).where(eq(repairRecords.id, id));
    }

    // Fetch updated record
    const repairSelect = {
      id: repairRecords.id,
      assetType: repairRecords.assetType,
      assetId: repairRecords.assetId,
      repairDate: repairRecords.repairDate,
      repairType: repairRecords.repairType,
      description: repairRecords.description,
      conditionGrade: repairRecords.conditionGrade,
      mainReplacementParts: repairRecords.mainReplacementParts,
      repairNotes: repairRecords.repairNotes,
      designDocNumber: repairRecords.designDocNumber,
      vendor: repairRecords.vendor,
      measurements: repairRecords.measurements,
      mediaUrls: repairRecords.mediaUrls,
      geometry: fromGeomSql(repairRecords.geometry),
      createdAt: repairRecords.createdAt,
      status: repairRecords.status,
    };

    const updated = await db.select(repairSelect).from(repairRecords).where(eq(repairRecords.id, id));
    const repair = updated[0];

    return {
      data: {
        ...repair,
        repairDate: repair.repairDate.toISOString().split('T')[0],
        createdAt: repair.createdAt.toISOString(),
      },
    };
  });

  // DELETE /repairs/:id - Delete repair
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

    const existing = await db.select({ id: repairRecords.id })
      .from(repairRecords).where(eq(repairRecords.id, id));
    if (existing.length === 0) {
      return reply.status(404).send({ error: 'Repair not found' });
    }

    await db.delete(repairRecords).where(eq(repairRecords.id, id));
    return reply.status(204).send(null);
  });
}

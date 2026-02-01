/**
 * WorkOrder API Routes
 *
 * Phase 1: WorkOrder management for construction events
 * WorkOrders represent tasks (inspection, repair, update) spawned from events.
 */

import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { db } from '../db/index.js';
import { workOrders, workOrderLocations, workOrderPartners, evidence, constructionEvents } from '../db/schema.js';
import { eq, and, or, gte, lte, inArray, sql, desc, asc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { toGeomSql, fromGeomSql } from '../db/geometry.js';

// TypeBox schemas
const GeometrySchema = Type.Object({
  type: Type.String(),
  coordinates: Type.Any(),
});

const WorkOrderTypeSchema = Type.Union([
  Type.Literal('inspection'),
  Type.Literal('repair'),
  Type.Literal('update'),
]);

const WorkOrderStatusSchema = Type.Union([
  Type.Literal('draft'),
  Type.Literal('assigned'),
  Type.Literal('in_progress'),
  Type.Literal('completed'),
  Type.Literal('cancelled'),
]);

const PartnerRoleSchema = Type.Union([
  Type.Literal('contractor'),
  Type.Literal('inspector'),
  Type.Literal('reviewer'),
]);

const WorkOrderLocationSchema = Type.Object({
  id: Type.String(),
  workOrderId: Type.String(),
  geometry: GeometrySchema,
  assetType: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  assetId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  note: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  sequenceOrder: Type.Number(),
  createdAt: Type.String({ format: 'date-time' }),
});

const WorkOrderPartnerSchema = Type.Object({
  workOrderId: Type.String(),
  partnerId: Type.String(),
  partnerName: Type.String(),
  role: Type.String(),
  assignedAt: Type.String({ format: 'date-time' }),
});

const WorkOrderSchema = Type.Object({
  id: Type.String(),
  eventId: Type.String(),
  type: WorkOrderTypeSchema,
  title: Type.String(),
  description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  status: WorkOrderStatusSchema,
  assignedDept: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  assignedBy: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  assignedAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
  dueDate: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
  startedAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
  completedAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
  reviewedBy: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  reviewedAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
  reviewNotes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  createdBy: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
  locations: Type.Optional(Type.Array(WorkOrderLocationSchema)),
  partners: Type.Optional(Type.Array(WorkOrderPartnerSchema)),
});

const CreateWorkOrderSchema = Type.Object({
  eventId: Type.String(),
  type: WorkOrderTypeSchema,
  title: Type.String(),
  description: Type.Optional(Type.String()),
  assignedDept: Type.Optional(Type.String()),
  dueDate: Type.Optional(Type.String({ format: 'date-time' })),
});

const UpdateWorkOrderSchema = Type.Partial(Type.Object({
  title: Type.String(),
  description: Type.String(),
  assignedDept: Type.String(),
  dueDate: Type.String({ format: 'date-time' }),
  reviewNotes: Type.String(),
}));

const StatusChangeSchema = Type.Object({
  status: WorkOrderStatusSchema,
});

const AssignSchema = Type.Object({
  assignedDept: Type.String(),
  assignedBy: Type.Optional(Type.String()),
});

const AddLocationSchema = Type.Object({
  geometry: GeometrySchema,
  assetType: Type.Optional(Type.String()),
  assetId: Type.Optional(Type.String()),
  note: Type.Optional(Type.String()),
  sequenceOrder: Type.Optional(Type.Number()),
});

const AddPartnerSchema = Type.Object({
  partnerId: Type.String(),
  partnerName: Type.String(),
  role: Type.Optional(PartnerRoleSchema),
});

// Helper to format WorkOrder for response
function formatWorkOrder(wo: typeof workOrders.$inferSelect) {
  return {
    ...wo,
    assignedAt: wo.assignedAt?.toISOString() ?? null,
    dueDate: wo.dueDate?.toISOString() ?? null,
    startedAt: wo.startedAt?.toISOString() ?? null,
    completedAt: wo.completedAt?.toISOString() ?? null,
    reviewedAt: wo.reviewedAt?.toISOString() ?? null,
    createdAt: wo.createdAt.toISOString(),
    updatedAt: wo.updatedAt.toISOString(),
  };
}

export async function workordersRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // GET /workorders - List work orders with filters
  app.get('/', {
    schema: {
      querystring: Type.Object({
        eventId: Type.Optional(Type.String()),
        status: Type.Optional(Type.String()),
        type: Type.Optional(Type.String()),
        assignedDept: Type.Optional(Type.String()),
        dueDateFrom: Type.Optional(Type.String()),
        dueDateTo: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 50 })),
        offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(WorkOrderSchema),
          meta: Type.Object({
            total: Type.Number(),
            limit: Type.Number(),
            offset: Type.Number(),
          }),
        }),
      },
    },
  }, async (request) => {
    const { eventId, status, type, assignedDept, dueDateFrom, dueDateTo, limit = 50, offset = 0 } = request.query;

    // Build conditions
    const conditions = [];
    if (eventId) conditions.push(eq(workOrders.eventId, eventId));
    if (status) {
      const statuses = status.split(',');
      conditions.push(inArray(workOrders.status, statuses));
    }
    if (type) {
      const types = type.split(',');
      conditions.push(inArray(workOrders.type, types));
    }
    if (assignedDept) conditions.push(eq(workOrders.assignedDept, assignedDept));
    if (dueDateFrom) conditions.push(gte(workOrders.dueDate, new Date(dueDateFrom)));
    if (dueDateTo) conditions.push(lte(workOrders.dueDate, new Date(dueDateTo)));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Count total
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(workOrders)
      .where(whereClause);
    const total = countResult[0]?.count ?? 0;

    // Fetch work orders
    const results = await db
      .select()
      .from(workOrders)
      .where(whereClause)
      .orderBy(desc(workOrders.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      data: results.map(formatWorkOrder),
      meta: { total, limit, offset },
    };
  });

  // GET /workorders/:id - Get work order detail with locations, partners, evidence
  app.get('/:id', {
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      response: {
        200: Type.Object({
          data: Type.Intersect([
            WorkOrderSchema,
            Type.Object({
              locations: Type.Array(WorkOrderLocationSchema),
              partners: Type.Array(WorkOrderPartnerSchema),
            }),
          ]),
        }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    const wo = await db.select().from(workOrders).where(eq(workOrders.id, id)).limit(1);
    if (wo.length === 0) {
      return reply.status(404).send({ error: 'Work order not found' });
    }

    // Fetch locations with geometry conversion
    const locationsRaw = await db
      .select({
        id: workOrderLocations.id,
        workOrderId: workOrderLocations.workOrderId,
        geometry: fromGeomSql(workOrderLocations.geometry),
        assetType: workOrderLocations.assetType,
        assetId: workOrderLocations.assetId,
        note: workOrderLocations.note,
        sequenceOrder: workOrderLocations.sequenceOrder,
        createdAt: workOrderLocations.createdAt,
      })
      .from(workOrderLocations)
      .where(eq(workOrderLocations.workOrderId, id))
      .orderBy(asc(workOrderLocations.sequenceOrder));

    const locations = locationsRaw.map(loc => ({
      ...loc,
      createdAt: loc.createdAt.toISOString(),
    }));

    // Fetch partners
    const partnersRaw = await db
      .select()
      .from(workOrderPartners)
      .where(eq(workOrderPartners.workOrderId, id));

    const partners = partnersRaw.map(p => ({
      ...p,
      assignedAt: p.assignedAt.toISOString(),
    }));

    return {
      data: {
        ...formatWorkOrder(wo[0]),
        locations,
        partners,
      },
    };
  });

  // POST /workorders - Create work order
  app.post('/', {
    schema: {
      body: CreateWorkOrderSchema,
      response: {
        201: Type.Object({ data: WorkOrderSchema }),
        400: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { eventId, type, title, description, assignedDept, dueDate } = request.body;

    // Verify event exists
    const event = await db.select({ id: constructionEvents.id, status: constructionEvents.status })
      .from(constructionEvents)
      .where(eq(constructionEvents.id, eventId))
      .limit(1);

    if (event.length === 0) {
      return reply.status(404).send({ error: 'Event not found' });
    }

    const id = `WO-${nanoid(12)}`;
    const now = new Date();

    const newWorkOrder = {
      id,
      eventId,
      type,
      title,
      description: description ?? null,
      status: 'draft' as const,
      assignedDept: assignedDept ?? null,
      assignedBy: null,
      assignedAt: null,
      dueDate: dueDate ? new Date(dueDate) : null,
      startedAt: null,
      completedAt: null,
      reviewedBy: null,
      reviewedAt: null,
      reviewNotes: null,
      createdBy: null, // TODO: Get from auth context
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(workOrders).values(newWorkOrder);

    return reply.status(201).send({
      data: formatWorkOrder(newWorkOrder),
    });
  });

  // PUT /workorders/:id - Update work order
  app.put('/:id', {
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      body: UpdateWorkOrderSchema,
      response: {
        200: Type.Object({ data: WorkOrderSchema }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const updates = request.body;

    const existing = await db.select().from(workOrders).where(eq(workOrders.id, id)).limit(1);
    if (existing.length === 0) {
      return reply.status(404).send({ error: 'Work order not found' });
    }

    const now = new Date();
    const updateData: Record<string, unknown> = {
      ...updates,
      updatedAt: now,
    };

    if (updates.dueDate) {
      updateData.dueDate = new Date(updates.dueDate);
    }

    await db.update(workOrders).set(updateData).where(eq(workOrders.id, id));

    const updated = await db.select().from(workOrders).where(eq(workOrders.id, id)).limit(1);

    return {
      data: formatWorkOrder(updated[0]),
    };
  });

  // PATCH /workorders/:id/status - Change work order status
  app.patch('/:id/status', {
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      body: StatusChangeSchema,
      response: {
        200: Type.Object({ data: WorkOrderSchema }),
        400: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { status: newStatus } = request.body;

    const existing = await db.select().from(workOrders).where(eq(workOrders.id, id)).limit(1);
    if (existing.length === 0) {
      return reply.status(404).send({ error: 'Work order not found' });
    }

    const currentStatus = existing[0].status;
    const now = new Date();

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      draft: ['assigned', 'cancelled'],
      assigned: ['in_progress', 'cancelled'],
      in_progress: ['completed', 'cancelled'],
      completed: [], // Terminal state
      cancelled: [], // Terminal state
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      return reply.status(400).send({
        error: `Invalid status transition: ${currentStatus} → ${newStatus}`,
      });
    }

    const updateData: Record<string, unknown> = {
      status: newStatus,
      updatedAt: now,
    };

    // Set timestamps based on status
    if (newStatus === 'in_progress' && !existing[0].startedAt) {
      updateData.startedAt = now;
    }
    if (newStatus === 'completed') {
      updateData.completedAt = now;
    }

    await db.update(workOrders).set(updateData).where(eq(workOrders.id, id));

    const updated = await db.select().from(workOrders).where(eq(workOrders.id, id)).limit(1);

    return {
      data: formatWorkOrder(updated[0]),
    };
  });

  // PATCH /workorders/:id/assign - Assign work order to department
  app.patch('/:id/assign', {
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      body: AssignSchema,
      response: {
        200: Type.Object({ data: WorkOrderSchema }),
        400: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { assignedDept, assignedBy } = request.body;

    const existing = await db.select().from(workOrders).where(eq(workOrders.id, id)).limit(1);
    if (existing.length === 0) {
      return reply.status(404).send({ error: 'Work order not found' });
    }

    // Only draft work orders can be assigned
    if (existing[0].status !== 'draft') {
      return reply.status(400).send({
        error: `Cannot assign work order in ${existing[0].status} status`,
      });
    }

    const now = new Date();

    await db.update(workOrders).set({
      assignedDept,
      assignedBy: assignedBy ?? null,
      assignedAt: now,
      status: 'assigned',
      updatedAt: now,
    }).where(eq(workOrders.id, id));

    const updated = await db.select().from(workOrders).where(eq(workOrders.id, id)).limit(1);

    return {
      data: formatWorkOrder(updated[0]),
    };
  });

  // POST /workorders/:id/locations - Add location to work order
  app.post('/:id/locations', {
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      body: AddLocationSchema,
      response: {
        201: Type.Object({ data: WorkOrderLocationSchema }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id: workOrderId } = request.params;
    const { geometry, assetType, assetId, note, sequenceOrder } = request.body;

    // Verify work order exists
    const wo = await db.select({ id: workOrders.id }).from(workOrders).where(eq(workOrders.id, workOrderId)).limit(1);
    if (wo.length === 0) {
      return reply.status(404).send({ error: 'Work order not found' });
    }

    const id = `WOL-${nanoid(12)}`;
    const now = new Date();

    // Get next sequence order if not provided
    let seq = sequenceOrder;
    if (seq === undefined) {
      const maxSeq = await db
        .select({ max: sql<number>`COALESCE(MAX(sequence_order), -1)` })
        .from(workOrderLocations)
        .where(eq(workOrderLocations.workOrderId, workOrderId));
      seq = (maxSeq[0]?.max ?? -1) + 1;
    }

    await db.execute(sql`
      INSERT INTO work_order_locations (id, work_order_id, geometry, asset_type, asset_id, note, sequence_order, created_at)
      VALUES (${id}, ${workOrderId}, ${toGeomSql(geometry)}, ${assetType ?? null}, ${assetId ?? null}, ${note ?? null}, ${seq}, ${now})
    `);

    return reply.status(201).send({
      data: {
        id,
        workOrderId,
        geometry,
        assetType: assetType ?? null,
        assetId: assetId ?? null,
        note: note ?? null,
        sequenceOrder: seq,
        createdAt: now.toISOString(),
      },
    });
  });

  // DELETE /workorders/:id/locations/:locationId - Remove location from work order
  app.delete('/:id/locations/:locationId', {
    schema: {
      params: Type.Object({
        id: Type.String(),
        locationId: Type.String(),
      }),
      response: {
        204: Type.Null(),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id: workOrderId, locationId } = request.params;

    const location = await db
      .select({ id: workOrderLocations.id })
      .from(workOrderLocations)
      .where(and(
        eq(workOrderLocations.id, locationId),
        eq(workOrderLocations.workOrderId, workOrderId),
      ))
      .limit(1);

    if (location.length === 0) {
      return reply.status(404).send({ error: 'Location not found' });
    }

    await db.delete(workOrderLocations).where(eq(workOrderLocations.id, locationId));

    return reply.status(204).send();
  });

  // POST /workorders/:id/partners - Add partner to work order
  app.post('/:id/partners', {
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      body: AddPartnerSchema,
      response: {
        201: Type.Object({ data: WorkOrderPartnerSchema }),
        400: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id: workOrderId } = request.params;
    const { partnerId, partnerName, role = 'contractor' } = request.body;

    // Verify work order exists
    const wo = await db.select({ id: workOrders.id }).from(workOrders).where(eq(workOrders.id, workOrderId)).limit(1);
    if (wo.length === 0) {
      return reply.status(404).send({ error: 'Work order not found' });
    }

    // Check if partner already assigned
    const existing = await db
      .select()
      .from(workOrderPartners)
      .where(and(
        eq(workOrderPartners.workOrderId, workOrderId),
        eq(workOrderPartners.partnerId, partnerId),
      ))
      .limit(1);

    if (existing.length > 0) {
      return reply.status(400).send({ error: 'Partner already assigned to this work order' });
    }

    const now = new Date();

    await db.insert(workOrderPartners).values({
      workOrderId,
      partnerId,
      partnerName,
      role,
      assignedAt: now,
    });

    return reply.status(201).send({
      data: {
        workOrderId,
        partnerId,
        partnerName,
        role,
        assignedAt: now.toISOString(),
      },
    });
  });

  // DELETE /workorders/:id/partners/:partnerId - Remove partner from work order
  app.delete('/:id/partners/:partnerId', {
    schema: {
      params: Type.Object({
        id: Type.String(),
        partnerId: Type.String(),
      }),
      response: {
        204: Type.Null(),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id: workOrderId, partnerId } = request.params;

    const partner = await db
      .select()
      .from(workOrderPartners)
      .where(and(
        eq(workOrderPartners.workOrderId, workOrderId),
        eq(workOrderPartners.partnerId, partnerId),
      ))
      .limit(1);

    if (partner.length === 0) {
      return reply.status(404).send({ error: 'Partner not found' });
    }

    await db.delete(workOrderPartners).where(and(
      eq(workOrderPartners.workOrderId, workOrderId),
      eq(workOrderPartners.partnerId, partnerId),
    ));

    return reply.status(204).send();
  });

  // GET /workorders/locations/geojson - Get all work order locations as GeoJSON FeatureCollection
  app.get('/locations/geojson', {
    schema: {
      querystring: Type.Object({
        eventId: Type.Optional(Type.String()),
        status: Type.Optional(Type.String()),
        type: Type.Optional(Type.String()),
        bbox: Type.Optional(Type.String()),
      }),
      response: {
        200: Type.Object({
          type: Type.Literal('FeatureCollection'),
          features: Type.Array(Type.Object({
            type: Type.Literal('Feature'),
            geometry: GeometrySchema,
            properties: Type.Object({
              locationId: Type.String(),
              workOrderId: Type.String(),
              workOrderTitle: Type.String(),
              workOrderType: Type.String(),
              workOrderStatus: Type.String(),
              eventId: Type.String(),
              assetType: Type.Optional(Type.Union([Type.String(), Type.Null()])),
              assetId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
              note: Type.Optional(Type.Union([Type.String(), Type.Null()])),
            }),
          })),
        }),
      },
    },
  }, async (request) => {
    const { eventId, status, type, bbox } = request.query;

    // Build work order conditions
    const woConditions = [];
    if (eventId) woConditions.push(eq(workOrders.eventId, eventId));
    if (status) {
      const statuses = status.split(',');
      woConditions.push(inArray(workOrders.status, statuses));
    }
    if (type) {
      const types = type.split(',');
      woConditions.push(inArray(workOrders.type, types));
    }

    // Build location conditions (bbox filter)
    let bboxCondition;
    if (bbox) {
      const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
      bboxCondition = sql`ST_Intersects(
        ${workOrderLocations.geometry},
        ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326)
      )`;
    }

    // Join work_orders with work_order_locations
    const results = await db
      .select({
        locationId: workOrderLocations.id,
        workOrderId: workOrderLocations.workOrderId,
        geometry: fromGeomSql(workOrderLocations.geometry),
        assetType: workOrderLocations.assetType,
        assetId: workOrderLocations.assetId,
        note: workOrderLocations.note,
        workOrderTitle: workOrders.title,
        workOrderType: workOrders.type,
        workOrderStatus: workOrders.status,
        eventId: workOrders.eventId,
      })
      .from(workOrderLocations)
      .innerJoin(workOrders, eq(workOrderLocations.workOrderId, workOrders.id))
      .where(and(
        woConditions.length > 0 ? and(...woConditions) : undefined,
        bboxCondition,
      ));

    const features = results.map(r => ({
      type: 'Feature' as const,
      geometry: r.geometry,
      properties: {
        locationId: r.locationId,
        workOrderId: r.workOrderId,
        workOrderTitle: r.workOrderTitle,
        workOrderType: r.workOrderType,
        workOrderStatus: r.workOrderStatus,
        eventId: r.eventId,
        assetType: r.assetType,
        assetId: r.assetId,
        note: r.note,
      },
    }));

    return {
      type: 'FeatureCollection' as const,
      features,
    };
  });

  // ============================================
  // Evidence Endpoints
  // ============================================

  const EvidenceTypeSchema = Type.Union([
    Type.Literal('photo'),
    Type.Literal('document'),
    Type.Literal('report'),
    Type.Literal('cad'),
    Type.Literal('other'),
  ]);

  const EvidenceReviewStatusSchema = Type.Union([
    Type.Literal('pending'),
    Type.Literal('approved'),
    Type.Literal('rejected'),
  ]);

  const EvidenceSchema = Type.Object({
    id: Type.String(),
    workOrderId: Type.String(),
    type: EvidenceTypeSchema,
    fileName: Type.String(),
    filePath: Type.String(),
    fileSizeBytes: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    mimeType: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    title: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    captureDate: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
    geometry: Type.Optional(Type.Union([GeometrySchema, Type.Null()])),
    submittedBy: Type.String(),
    submittedAt: Type.String({ format: 'date-time' }),
    reviewedBy: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    reviewedAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
    reviewStatus: EvidenceReviewStatusSchema,
    reviewNotes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  });

  const ReviewEvidenceSchema = Type.Object({
    reviewStatus: Type.Union([Type.Literal('approved'), Type.Literal('rejected')]),
    reviewNotes: Type.Optional(Type.String()),
  });

  // Helper to format Evidence for response
  function formatEvidence(ev: typeof evidence.$inferSelect) {
    return {
      ...ev,
      captureDate: ev.captureDate?.toISOString() ?? null,
      submittedAt: ev.submittedAt.toISOString(),
      reviewedAt: ev.reviewedAt?.toISOString() ?? null,
    };
  }

  // GET /workorders/:id/evidence - List evidence for a work order
  app.get('/:id/evidence', {
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      querystring: Type.Object({
        type: Type.Optional(Type.String()),
        reviewStatus: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 50 })),
        offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(EvidenceSchema),
          meta: Type.Object({
            total: Type.Number(),
            limit: Type.Number(),
            offset: Type.Number(),
          }),
        }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id: workOrderId } = request.params;
    const { type: typeFilter, reviewStatus, limit = 50, offset = 0 } = request.query;

    // Verify work order exists
    const wo = await db.select({ id: workOrders.id }).from(workOrders).where(eq(workOrders.id, workOrderId)).limit(1);
    if (wo.length === 0) {
      return reply.status(404).send({ error: 'Work order not found' });
    }

    // Build conditions
    const conditions = [eq(evidence.workOrderId, workOrderId)];
    if (typeFilter) {
      const types = typeFilter.split(',');
      conditions.push(inArray(evidence.type, types));
    }
    if (reviewStatus) {
      const statuses = reviewStatus.split(',');
      conditions.push(inArray(evidence.reviewStatus, statuses));
    }

    // Count total
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(evidence)
      .where(and(...conditions));
    const total = countResult[0]?.count ?? 0;

    // Fetch evidence with geometry conversion
    const results = await db
      .select({
        id: evidence.id,
        workOrderId: evidence.workOrderId,
        type: evidence.type,
        fileName: evidence.fileName,
        filePath: evidence.filePath,
        fileSizeBytes: evidence.fileSizeBytes,
        mimeType: evidence.mimeType,
        title: evidence.title,
        description: evidence.description,
        captureDate: evidence.captureDate,
        geometry: fromGeomSql(evidence.geometry),
        submittedBy: evidence.submittedBy,
        submittedAt: evidence.submittedAt,
        reviewedBy: evidence.reviewedBy,
        reviewedAt: evidence.reviewedAt,
        reviewStatus: evidence.reviewStatus,
        reviewNotes: evidence.reviewNotes,
      })
      .from(evidence)
      .where(and(...conditions))
      .orderBy(desc(evidence.submittedAt))
      .limit(limit)
      .offset(offset);

    return {
      data: results.map(ev => ({
        ...ev,
        captureDate: ev.captureDate?.toISOString() ?? null,
        submittedAt: ev.submittedAt.toISOString(),
        reviewedAt: ev.reviewedAt?.toISOString() ?? null,
      })),
      meta: { total, limit, offset },
    };
  });

  // POST /workorders/:id/evidence - Upload evidence (metadata only - actual file upload handled separately)
  app.post('/:id/evidence', {
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      body: Type.Object({
        type: EvidenceTypeSchema,
        fileName: Type.String(),
        filePath: Type.String(),
        fileSizeBytes: Type.Optional(Type.Number()),
        mimeType: Type.Optional(Type.String()),
        title: Type.Optional(Type.String()),
        description: Type.Optional(Type.String()),
        captureDate: Type.Optional(Type.String({ format: 'date-time' })),
        geometry: Type.Optional(GeometrySchema),
        submittedBy: Type.String(),
      }),
      response: {
        201: Type.Object({ data: EvidenceSchema }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id: workOrderId } = request.params;
    const { type: evidenceType, fileName, filePath, fileSizeBytes, mimeType, title, description, captureDate, geometry, submittedBy } = request.body;

    // Verify work order exists
    const wo = await db.select({ id: workOrders.id }).from(workOrders).where(eq(workOrders.id, workOrderId)).limit(1);
    if (wo.length === 0) {
      return reply.status(404).send({ error: 'Work order not found' });
    }

    const id = `EV-${nanoid(12)}`;
    const now = new Date();

    // Insert with or without geometry
    if (geometry) {
      await db.execute(sql`
        INSERT INTO evidence (id, work_order_id, type, file_name, file_path, file_size_bytes, mime_type, title, description, capture_date, geometry, submitted_by, submitted_at, review_status)
        VALUES (${id}, ${workOrderId}, ${evidenceType}, ${fileName}, ${filePath}, ${fileSizeBytes ?? null}, ${mimeType ?? null}, ${title ?? null}, ${description ?? null}, ${captureDate ? new Date(captureDate) : null}, ${toGeomSql(geometry)}, ${submittedBy}, ${now}, 'pending')
      `);
    } else {
      await db.insert(evidence).values({
        id,
        workOrderId,
        type: evidenceType,
        fileName,
        filePath,
        fileSizeBytes: fileSizeBytes ?? null,
        mimeType: mimeType ?? null,
        title: title ?? null,
        description: description ?? null,
        captureDate: captureDate ? new Date(captureDate) : null,
        submittedBy,
        submittedAt: now,
        reviewStatus: 'pending',
      });
    }

    return reply.status(201).send({
      data: {
        id,
        workOrderId,
        type: evidenceType,
        fileName,
        filePath,
        fileSizeBytes: fileSizeBytes ?? null,
        mimeType: mimeType ?? null,
        title: title ?? null,
        description: description ?? null,
        captureDate: captureDate ?? null,
        geometry: geometry ?? null,
        submittedBy,
        submittedAt: now.toISOString(),
        reviewedBy: null,
        reviewedAt: null,
        reviewStatus: 'pending' as const,
        reviewNotes: null,
      },
    });
  });

  // GET /workorders/evidence/:evidenceId - Get single evidence item
  app.get('/evidence/:evidenceId', {
    schema: {
      params: Type.Object({
        evidenceId: Type.String(),
      }),
      response: {
        200: Type.Object({ data: EvidenceSchema }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { evidenceId } = request.params;

    const results = await db
      .select({
        id: evidence.id,
        workOrderId: evidence.workOrderId,
        type: evidence.type,
        fileName: evidence.fileName,
        filePath: evidence.filePath,
        fileSizeBytes: evidence.fileSizeBytes,
        mimeType: evidence.mimeType,
        title: evidence.title,
        description: evidence.description,
        captureDate: evidence.captureDate,
        geometry: fromGeomSql(evidence.geometry),
        submittedBy: evidence.submittedBy,
        submittedAt: evidence.submittedAt,
        reviewedBy: evidence.reviewedBy,
        reviewedAt: evidence.reviewedAt,
        reviewStatus: evidence.reviewStatus,
        reviewNotes: evidence.reviewNotes,
      })
      .from(evidence)
      .where(eq(evidence.id, evidenceId))
      .limit(1);

    if (results.length === 0) {
      return reply.status(404).send({ error: 'Evidence not found' });
    }

    const ev = results[0];
    return {
      data: {
        ...ev,
        captureDate: ev.captureDate?.toISOString() ?? null,
        submittedAt: ev.submittedAt.toISOString(),
        reviewedAt: ev.reviewedAt?.toISOString() ?? null,
      },
    };
  });

  // PATCH /workorders/evidence/:evidenceId/review - Review evidence
  app.patch('/evidence/:evidenceId/review', {
    schema: {
      params: Type.Object({
        evidenceId: Type.String(),
      }),
      body: ReviewEvidenceSchema,
      response: {
        200: Type.Object({ data: EvidenceSchema }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { evidenceId } = request.params;
    const { reviewStatus, reviewNotes } = request.body;

    const existing = await db.select().from(evidence).where(eq(evidence.id, evidenceId)).limit(1);
    if (existing.length === 0) {
      return reply.status(404).send({ error: 'Evidence not found' });
    }

    const now = new Date();
    const reviewedBy = 'system'; // TODO: Get from auth context

    await db.update(evidence).set({
      reviewStatus,
      reviewNotes: reviewNotes ?? null,
      reviewedBy,
      reviewedAt: now,
    }).where(eq(evidence.id, evidenceId));

    // Fetch updated record
    const results = await db
      .select({
        id: evidence.id,
        workOrderId: evidence.workOrderId,
        type: evidence.type,
        fileName: evidence.fileName,
        filePath: evidence.filePath,
        fileSizeBytes: evidence.fileSizeBytes,
        mimeType: evidence.mimeType,
        title: evidence.title,
        description: evidence.description,
        captureDate: evidence.captureDate,
        geometry: fromGeomSql(evidence.geometry),
        submittedBy: evidence.submittedBy,
        submittedAt: evidence.submittedAt,
        reviewedBy: evidence.reviewedBy,
        reviewedAt: evidence.reviewedAt,
        reviewStatus: evidence.reviewStatus,
        reviewNotes: evidence.reviewNotes,
      })
      .from(evidence)
      .where(eq(evidence.id, evidenceId))
      .limit(1);

    const ev = results[0];
    return {
      data: {
        ...ev,
        captureDate: ev.captureDate?.toISOString() ?? null,
        submittedAt: ev.submittedAt.toISOString(),
        reviewedAt: ev.reviewedAt?.toISOString() ?? null,
      },
    };
  });

  // DELETE /workorders/evidence/:evidenceId - Delete evidence
  app.delete('/evidence/:evidenceId', {
    schema: {
      params: Type.Object({
        evidenceId: Type.String(),
      }),
      response: {
        204: Type.Null(),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { evidenceId } = request.params;

    const existing = await db.select({ id: evidence.id }).from(evidence).where(eq(evidence.id, evidenceId)).limit(1);
    if (existing.length === 0) {
      return reply.status(404).send({ error: 'Evidence not found' });
    }

    // TODO: Delete actual file from storage

    await db.delete(evidence).where(eq(evidence.id, evidenceId));

    return reply.status(204).send();
  });
}

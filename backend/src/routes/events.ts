import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { db } from '../db/index.js';
import { constructionEvents, eventRoadAssets, roadAssets, workOrders, evidence } from '../db/schema.js';
import { eq, and, or, gte, lte, like, ilike, inArray, sql, isNotNull, isNull, asc, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { syncEventToOrion } from '../services/ngsi-sync.js';
import { toGeomSql, fromGeomSql } from '../db/geometry.js';
import { enrichRoadNamesForEvent, enrichAllEventRoadNames, countAllEventUnnamedRoads, countNearbyUnnamedRoads, enrichNearbyRoadNames } from '../services/road-name-enrichment.js';
import { isGoogleMapsConfigured, getRoadNameForLineString } from '../services/google-maps.js';

// TypeBox schemas
const GeometrySchema = Type.Object({
  type: Type.String(),
  coordinates: Type.Any(),
});

// Asset type enum for refAsset (matches all 8 asset types)
const RefAssetTypeEnum = Type.Union([
  Type.Literal('road'),
  Type.Literal('river'),
  Type.Literal('streetlight'),
  Type.Literal('greenspace'),
  Type.Literal('street_tree'),
  Type.Literal('park_facility'),
  Type.Literal('pavement_section'),
  Type.Literal('pump_station'),
]);

const RoadAssetSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  geometry: GeometrySchema,
  roadType: Type.String(),
  lanes: Type.Number(),
  direction: Type.String(),
  status: Type.String(),
  validFrom: Type.String({ format: 'date-time' }),
  validTo: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
  replacedBy: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  ownerDepartment: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  ward: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  landmark: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  updatedAt: Type.String({ format: 'date-time' }),
});

// Phase 1: Extended EventSchema with new statuses and close fields
const EventSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  status: Type.Union([
    Type.Literal('planned'),
    Type.Literal('active'),
    Type.Literal('pending_review'),
    Type.Literal('closed'),
    Type.Literal('archived'),
    Type.Literal('cancelled'),
  ]),
  startDate: Type.String({ format: 'date-time' }),
  endDate: Type.String({ format: 'date-time' }),
  restrictionType: Type.String(),
  geometry: GeometrySchema,
  geometrySource: Type.Optional(Type.Union([Type.Literal('manual'), Type.Literal('auto')])),
  postEndDecision: Type.Union([Type.Literal('pending'), Type.Literal('no-change'), Type.Literal('permanent-change')]),
  archivedAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
  roadAssets: Type.Optional(Type.Array(RoadAssetSchema)),
  department: Type.String(),
  ward: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  createdBy: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  // Phase 1: Close tracking fields
  closedBy: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  closedAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
  closeNotes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  // Reference to a related asset (singular)
  refAssetId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  refAssetType: Type.Optional(Type.Union([RefAssetTypeEnum, Type.Null()])),
  updatedAt: Type.String({ format: 'date-time' }),
});

const CreateEventSchema = Type.Object({
  name: Type.String(),
  startDate: Type.String({ format: 'date-time' }),
  endDate: Type.String({ format: 'date-time' }),
  restrictionType: Type.String(),
  geometry: GeometrySchema, // Required - Phase 0: no auto-generate from road assets
  department: Type.String(),
  ward: Type.Optional(Type.String()),
  // Phase 0: roadAssetIds is ignored - Road-Event linking is disabled
  roadAssetIds: Type.Optional(Type.Array(Type.String())),
  // Reference to a related asset (singular)
  refAssetId: Type.Optional(Type.String()),
  refAssetType: Type.Optional(RefAssetTypeEnum),
});

const UpdateEventSchema = Type.Partial(Type.Object({
  name: Type.String(),
  startDate: Type.String({ format: 'date-time' }),
  endDate: Type.String({ format: 'date-time' }),
  restrictionType: Type.String(),
  geometry: GeometrySchema,
  department: Type.String(),
  ward: Type.String(),
  // Phase 0: roadAssetIds is ignored - Road-Event linking is disabled
  roadAssetIds: Type.Array(Type.String()),
  // Phase 0: regenerateGeometry is disabled - no road asset geometry union
  regenerateGeometry: Type.Boolean(),
  // Reference to a related asset (singular) - can set to null to clear
  refAssetId: Type.Union([Type.String(), Type.Null()]),
  refAssetType: Type.Union([RefAssetTypeEnum, Type.Null()]),
}));

// Phase 1: Extended status transitions
// planned → active, cancelled
// active → pending_review, cancelled
// pending_review → closed (via /close), active (reopen)
// closed → archived
const StatusChangeSchema = Type.Object({
  status: Type.Union([
    Type.Literal('active'),
    Type.Literal('pending_review'),
    Type.Literal('cancelled'),
  ]),
});

const PostEndDecisionSchema = Type.Object({
  decision: Type.Union([Type.Literal('no-change'), Type.Literal('permanent-change')]),
});

export async function eventsRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // GET /events - List events with filters
  app.get('/', {
    schema: {
      querystring: Type.Object({
        status: Type.Optional(Type.String()),
        department: Type.Optional(Type.String()),
        startDateFrom: Type.Optional(Type.String()),
        startDateTo: Type.Optional(Type.String()),
        endDateFrom: Type.Optional(Type.String()),
        endDateTo: Type.Optional(Type.String()),
        name: Type.Optional(Type.String()),
        ward: Type.Optional(Type.String()),
        includeArchived: Type.Optional(Type.String()), // 'true' to include archived events
      }),
      response: {
        200: Type.Object({
          data: Type.Array(EventSchema),
          meta: Type.Object({
            total: Type.Number(),
            archivedCount: Type.Number(),
          }),
        }),
      },
    },
  }, async (request) => {
    const { status, department, startDateFrom, startDateTo, endDateFrom, endDateTo, name, ward, includeArchived } = request.query;

    const conditions = [];

    if (status) {
      conditions.push(eq(constructionEvents.status, status));
    }
    if (department) {
      conditions.push(ilike(constructionEvents.department, `%${department}%`));
    }
    if (ward) {
      conditions.push(ilike(constructionEvents.ward, `%${ward}%`));
    }
    if (name) {
      // Search across both name and department fields
      conditions.push(or(
        ilike(constructionEvents.name, `%${name}%`),
        ilike(constructionEvents.department, `%${name}%`)
      ));
    }
    if (startDateFrom) {
      conditions.push(gte(constructionEvents.startDate, new Date(startDateFrom)));
    }
    if (startDateTo) {
      conditions.push(lte(constructionEvents.startDate, new Date(startDateTo)));
    }
    if (endDateFrom) {
      conditions.push(gte(constructionEvents.endDate, new Date(endDateFrom)));
    }
    if (endDateTo) {
      conditions.push(lte(constructionEvents.endDate, new Date(endDateTo)));
    }

    // Filter out archived events unless explicitly requested
    const shouldIncludeArchived = includeArchived === 'true';
    if (!shouldIncludeArchived) {
      conditions.push(isNull(constructionEvents.archivedAt));
    }

    // Select events with explicit geometry conversion
    const eventSelect = {
      id: constructionEvents.id,
      name: constructionEvents.name,
      status: constructionEvents.status,
      startDate: constructionEvents.startDate,
      endDate: constructionEvents.endDate,
      restrictionType: constructionEvents.restrictionType,
      geometry: fromGeomSql(constructionEvents.geometry),
      geometrySource: constructionEvents.geometrySource,
      postEndDecision: constructionEvents.postEndDecision,
      archivedAt: constructionEvents.archivedAt,
      department: constructionEvents.department,
      ward: constructionEvents.ward,
      createdBy: constructionEvents.createdBy,
      refAssetId: constructionEvents.refAssetId,
      refAssetType: constructionEvents.refAssetType,
      updatedAt: constructionEvents.updatedAt,
    };

    // Sort: Active → Pending Review → Planned → Closed → Cancelled
    // Within same status: Active/Pending/Planned by startDate ASC, Closed/Cancelled by endDate DESC
    const orderByClause = [
      sql`CASE ${constructionEvents.status}
        WHEN 'active' THEN 1
        WHEN 'pending_review' THEN 2
        WHEN 'planned' THEN 3
        WHEN 'closed' THEN 4
        WHEN 'cancelled' THEN 5
        ELSE 6
      END`,
      sql`CASE
        WHEN ${constructionEvents.status} IN ('closed', 'cancelled') THEN ${constructionEvents.endDate}
        END DESC`,
      asc(constructionEvents.startDate),
    ];

    const query = conditions.length > 0
      ? db.select(eventSelect).from(constructionEvents).where(and(...conditions)).orderBy(...orderByClause)
      : db.select(eventSelect).from(constructionEvents).orderBy(...orderByClause);

    const events = await query;

    // Fetch road assets for all events
    const eventIds = events.map(e => e.id);
    const allRelations = eventIds.length > 0
      ? await db.select().from(eventRoadAssets).where(inArray(eventRoadAssets.eventId, eventIds))
      : [];

    // Select road assets with explicit geometry conversion
    const assetSelect = {
      id: roadAssets.id,
      name: roadAssets.name,
      geometry: fromGeomSql(roadAssets.geometry),
      roadType: roadAssets.roadType,
      lanes: roadAssets.lanes,
      direction: roadAssets.direction,
      status: roadAssets.status,
      validFrom: roadAssets.validFrom,
      validTo: roadAssets.validTo,
      replacedBy: roadAssets.replacedBy,
      ownerDepartment: roadAssets.ownerDepartment,
      ward: roadAssets.ward,
      landmark: roadAssets.landmark,
      updatedAt: roadAssets.updatedAt,
    };

    const allAssetIds = [...new Set(allRelations.map(r => r.roadAssetId))];
    const allAssets = allAssetIds.length > 0
      ? await db.select(assetSelect).from(roadAssets).where(inArray(roadAssets.id, allAssetIds))
      : [];

    const assetMap = new Map(allAssets.map(a => [a.id, a]));

    // Get archived count for meta (always count total archived regardless of filter)
    const archivedCountResult = await db.select({
      count: sql<number>`count(*)`.as('count'),
    }).from(constructionEvents).where(isNotNull(constructionEvents.archivedAt));
    const archivedCount = Number(archivedCountResult[0]?.count ?? 0);

    return {
      data: events.map(e => {
        const eventRelations = allRelations.filter(r => r.eventId === e.id);
        const eventAssets = eventRelations
          .map(r => assetMap.get(r.roadAssetId))
          .filter((a): a is NonNullable<typeof a> => a !== undefined)
          .map(a => ({
            ...a,
            validFrom: a.validFrom.toISOString(),
            validTo: a.validTo?.toISOString() ?? null,
            updatedAt: a.updatedAt.toISOString(),
          }));

        return {
          ...e,
          startDate: e.startDate.toISOString(),
          endDate: e.endDate.toISOString(),
          archivedAt: e.archivedAt?.toISOString() ?? null,
          updatedAt: e.updatedAt.toISOString(),
          roadAssets: eventAssets,
        };
      }),
      meta: { total: events.length, archivedCount },
    };
  });

  // GET /events/:id - Get event detail
  app.get('/:id', {
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      response: {
        200: Type.Object({ data: EventSchema }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    const eventSelect = {
      id: constructionEvents.id,
      name: constructionEvents.name,
      status: constructionEvents.status,
      startDate: constructionEvents.startDate,
      endDate: constructionEvents.endDate,
      restrictionType: constructionEvents.restrictionType,
      geometry: fromGeomSql(constructionEvents.geometry),
      geometrySource: constructionEvents.geometrySource,
      postEndDecision: constructionEvents.postEndDecision,
      archivedAt: constructionEvents.archivedAt,
      department: constructionEvents.department,
      ward: constructionEvents.ward,
      createdBy: constructionEvents.createdBy,
      refAssetId: constructionEvents.refAssetId,
      refAssetType: constructionEvents.refAssetType,
      updatedAt: constructionEvents.updatedAt,
    };

    const events = await db.select(eventSelect).from(constructionEvents).where(eq(constructionEvents.id, id));

    if (events.length === 0) {
      return reply.status(404).send({ error: 'Event not found' });
    }

    const event = events[0];

    // Fetch related road assets
    const relations = await db.select().from(eventRoadAssets).where(eq(eventRoadAssets.eventId, id));
    const assetIds = relations.map(r => r.roadAssetId);

    const assetSelect = {
      id: roadAssets.id,
      name: roadAssets.name,
      geometry: fromGeomSql(roadAssets.geometry),
      roadType: roadAssets.roadType,
      lanes: roadAssets.lanes,
      direction: roadAssets.direction,
      status: roadAssets.status,
      validFrom: roadAssets.validFrom,
      validTo: roadAssets.validTo,
      replacedBy: roadAssets.replacedBy,
      ownerDepartment: roadAssets.ownerDepartment,
      ward: roadAssets.ward,
      landmark: roadAssets.landmark,
      updatedAt: roadAssets.updatedAt,
    };

    const assets = assetIds.length > 0
      ? await db.select(assetSelect).from(roadAssets).where(inArray(roadAssets.id, assetIds))
      : [];

    const eventAssets = assets.map(a => ({
      ...a,
      validFrom: a.validFrom.toISOString(),
      validTo: a.validTo?.toISOString() ?? null,
      updatedAt: a.updatedAt.toISOString(),
    }));

    return {
      data: {
        ...event,
        startDate: event.startDate.toISOString(),
        endDate: event.endDate.toISOString(),
        archivedAt: event.archivedAt?.toISOString() ?? null,
        updatedAt: event.updatedAt.toISOString(),
        roadAssets: eventAssets,
      },
    };
  });

  // POST /events - Create new event
  app.post('/', {
    schema: {
      body: CreateEventSchema,
      response: {
        201: Type.Object({ data: EventSchema }),
        400: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const body = request.body;
    const id = `CE-${nanoid(8)}`;
    const now = new Date();
    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);

    // Phase 0: roadAssetIds is ignored - Road-Event linking is disabled
    if (body.roadAssetIds?.length) {
      console.log(`[Phase 0] Event ${id}: roadAssetIds ignored - Road-Event linking disabled`);
    }

    // Phase 0: geometry is required (no auto-generate from road assets)
    if (!body.geometry) {
      return reply.status(400).send({
        error: 'geometry is required. Road-Event auto-geometry generation is disabled in Phase 0.',
      });
    }

    // Validate refAsset fields are paired (both or neither)
    if ((body.refAssetId && !body.refAssetType) || (!body.refAssetId && body.refAssetType)) {
      return reply.status(400).send({
        error: 'refAssetId and refAssetType must both be provided or both be omitted',
      });
    }

    const geometrySource: 'manual' | 'auto' = 'manual';
    const eventGeometry = body.geometry;

    // Insert event with geometry (no road asset relations)
    await db.execute(sql`
      INSERT INTO construction_events (
        id, name, status, start_date, end_date, restriction_type,
        geometry, geometry_source, post_end_decision, department, ward,
        ref_asset_id, ref_asset_type, updated_at
      ) VALUES (
        ${id}, ${body.name}, 'planned', ${startDate}, ${endDate}, ${body.restrictionType},
        ${toGeomSql(eventGeometry)}, ${geometrySource}, 'pending', ${body.department}, ${body.ward ?? null},
        ${body.refAssetId ?? null}, ${body.refAssetType ?? null}, ${now}
      )
    `);

    // Phase 0: No road asset relations are created
    // Historical relations can still be queried via GET /events/:id

    // Prepare event object for response and sync
    const newEvent = {
      id,
      name: body.name,
      status: 'planned' as const,
      startDate,
      endDate,
      restrictionType: body.restrictionType,
      geometry: eventGeometry,
      geometrySource,
      postEndDecision: 'pending' as const,
      archivedAt: null as Date | null,
      department: body.department,
      ward: body.ward,
      createdBy: null,
      // Phase 1: Close tracking fields (default null for new events)
      closedBy: null,
      closedAt: null as Date | null,
      closeNotes: null,
      // Reference to related asset (singular)
      refAssetId: body.refAssetId ?? null,
      refAssetType: body.refAssetType ?? null,
      updatedAt: now,
    };

    // Sync to Orion-LD
    await syncEventToOrion(newEvent);

    return reply.status(201).send({
      data: {
        ...newEvent,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        archivedAt: null,
        updatedAt: now.toISOString(),
        refAssetId: body.refAssetId ?? null,
        refAssetType: body.refAssetType ?? null,
        roadAssets: [], // Phase 0: No road asset relations
      },
    });
  });

  // PUT /events/:id - Update event
  app.put('/:id', {
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      body: UpdateEventSchema,
      response: {
        200: Type.Object({ data: EventSchema }),
        400: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const body = request.body;

    // Check if event exists and get its status
    const existingEvents = await db.select({
      id: constructionEvents.id,
      status: constructionEvents.status,
    }).from(constructionEvents).where(eq(constructionEvents.id, id));

    if (existingEvents.length === 0) {
      return reply.status(404).send({ error: 'Event not found' });
    }

    const { status } = existingEvents[0];

    // Only planned and active events can be edited
    if (status === 'pending_review' || status === 'closed' || status === 'cancelled') {
      return reply.status(400).send({
        error: `Cannot edit ${status} events. Historical records must be preserved for audit.`,
      });
    }

    const now = new Date();

    // Phase 0: roadAssetIds is ignored - Road-Event linking is disabled
    if (body.roadAssetIds?.length) {
      console.log(`[Phase 0] Event ${id}: roadAssetIds ignored - Road-Event linking disabled`);
    }

    // Phase 0: regenerateGeometry is disabled
    if (body.regenerateGeometry === true) {
      console.log(`[Phase 0] Event ${id}: regenerateGeometry ignored - Road-Event auto-geometry disabled`);
    }

    // Validate refAsset fields are paired (both or neither) when updating
    const hasRefAssetId = body.refAssetId !== undefined;
    const hasRefAssetType = body.refAssetType !== undefined;
    if (hasRefAssetId !== hasRefAssetType) {
      return reply.status(400).send({
        error: 'refAssetId and refAssetType must both be provided or both be omitted when updating',
      });
    }

    // Handle geometry update (only explicit geometry is supported in Phase 0)
    if (body.geometry) {
      await db.execute(sql`
        UPDATE construction_events
        SET geometry = ${toGeomSql(body.geometry)}, geometry_source = 'manual', updated_at = ${now}
        WHERE id = ${id}
      `);
    }

    // Handle non-geometry updates with Drizzle
    const updates: Record<string, unknown> = { updatedAt: now };
    if (body.name) updates.name = body.name;
    if (body.startDate) updates.startDate = new Date(body.startDate);
    if (body.endDate) updates.endDate = new Date(body.endDate);
    if (body.restrictionType) updates.restrictionType = body.restrictionType;
    if (body.department) updates.department = body.department;
    if (body.ward !== undefined) updates.ward = body.ward;
    // Handle refAsset update (can set to null to clear)
    if (body.refAssetId !== undefined) updates.refAssetId = body.refAssetId;
    if (body.refAssetType !== undefined) updates.refAssetType = body.refAssetType;

    // Only run non-geometry update if there are non-geometry fields
    const hasNonGeomUpdates = Object.keys(updates).length > 1; // more than just updatedAt
    if (hasNonGeomUpdates || (!body.geometry && !body.regenerateGeometry)) {
      await db.update(constructionEvents).set(updates).where(eq(constructionEvents.id, id));
    }

    // Phase 0: Road asset relations are not updated
    // Historical relations are preserved for reference

    // Fetch updated event with geometry conversion
    const eventSelect = {
      id: constructionEvents.id,
      name: constructionEvents.name,
      status: constructionEvents.status,
      startDate: constructionEvents.startDate,
      endDate: constructionEvents.endDate,
      restrictionType: constructionEvents.restrictionType,
      geometry: fromGeomSql(constructionEvents.geometry),
      geometrySource: constructionEvents.geometrySource,
      postEndDecision: constructionEvents.postEndDecision,
      archivedAt: constructionEvents.archivedAt,
      department: constructionEvents.department,
      ward: constructionEvents.ward,
      createdBy: constructionEvents.createdBy,
      refAssetId: constructionEvents.refAssetId,
      refAssetType: constructionEvents.refAssetType,
      updatedAt: constructionEvents.updatedAt,
    };

    const updatedEvents = await db.select(eventSelect).from(constructionEvents).where(eq(constructionEvents.id, id));
    const event = updatedEvents[0];

    // Fetch related road assets
    const relations = await db.select().from(eventRoadAssets).where(eq(eventRoadAssets.eventId, id));
    const assetIds = relations.map(r => r.roadAssetId);

    const assetSelect = {
      id: roadAssets.id,
      name: roadAssets.name,
      geometry: fromGeomSql(roadAssets.geometry),
      roadType: roadAssets.roadType,
      lanes: roadAssets.lanes,
      direction: roadAssets.direction,
      status: roadAssets.status,
      validFrom: roadAssets.validFrom,
      validTo: roadAssets.validTo,
      replacedBy: roadAssets.replacedBy,
      ownerDepartment: roadAssets.ownerDepartment,
      ward: roadAssets.ward,
      landmark: roadAssets.landmark,
      updatedAt: roadAssets.updatedAt,
    };

    const assets = assetIds.length > 0
      ? await db.select(assetSelect).from(roadAssets).where(inArray(roadAssets.id, assetIds))
      : [];

    const eventAssets = assets.map(a => ({
      ...a,
      validFrom: a.validFrom.toISOString(),
      validTo: a.validTo?.toISOString() ?? null,
      updatedAt: a.updatedAt.toISOString(),
    }));

    // Sync to Orion-LD
    await syncEventToOrion(event);

    // Phase 0: Road name enrichment disabled (no road asset relations)

    return {
      data: {
        ...event,
        startDate: event.startDate.toISOString(),
        endDate: event.endDate.toISOString(),
        archivedAt: event.archivedAt?.toISOString() ?? null,
        updatedAt: event.updatedAt.toISOString(),
        roadAssets: eventAssets, // Historical relations only
      },
    };
  });

  // PATCH /events/:id/status - Change status
  app.patch('/:id/status', {
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      body: StatusChangeSchema,
      response: {
        200: Type.Object({ data: EventSchema }),
        400: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { status: newStatus } = request.body;

    // Check current status (no geometry needed)
    const existingEvents = await db.select({ id: constructionEvents.id, status: constructionEvents.status })
      .from(constructionEvents).where(eq(constructionEvents.id, id));

    if (existingEvents.length === 0) {
      return reply.status(404).send({ error: 'Event not found' });
    }

    const currentEvent = existingEvents[0];

    // Phase 1: Validate status transitions
    // planned → active, cancelled
    // active → pending_review, cancelled
    // pending_review → active (reopen), cancelled (note: closed via /close endpoint)
    // closed → no transitions via this endpoint (use archive)
    // cancelled → terminal
    // archived → terminal
    const validTransitions: Record<string, string[]> = {
      planned: ['active', 'cancelled'],
      active: ['pending_review', 'cancelled'],
      pending_review: ['active', 'cancelled'],  // 'closed' via /close endpoint only
      closed: [],  // Use archive endpoint
      cancelled: [],
      archived: [],
    };

    const allowed = validTransitions[currentEvent.status] || [];
    if (!allowed.includes(newStatus)) {
      return reply.status(400).send({
        error: `Invalid status transition: ${currentEvent.status} → ${newStatus}. Allowed: ${allowed.join(', ') || 'none'}`
      });
    }

    await db.update(constructionEvents).set({
      status: newStatus,
      updatedAt: new Date(),
    }).where(eq(constructionEvents.id, id));

    // Fetch updated event with geometry conversion
    const eventSelect = {
      id: constructionEvents.id,
      name: constructionEvents.name,
      status: constructionEvents.status,
      startDate: constructionEvents.startDate,
      endDate: constructionEvents.endDate,
      restrictionType: constructionEvents.restrictionType,
      geometry: fromGeomSql(constructionEvents.geometry),
      geometrySource: constructionEvents.geometrySource,
      postEndDecision: constructionEvents.postEndDecision,
      archivedAt: constructionEvents.archivedAt,
      department: constructionEvents.department,
      ward: constructionEvents.ward,
      createdBy: constructionEvents.createdBy,
      refAssetId: constructionEvents.refAssetId,
      refAssetType: constructionEvents.refAssetType,
      updatedAt: constructionEvents.updatedAt,
    };

    const updatedEvents = await db.select(eventSelect).from(constructionEvents).where(eq(constructionEvents.id, id));
    const event = updatedEvents[0];

    // Fetch related road assets
    const relations = await db.select().from(eventRoadAssets).where(eq(eventRoadAssets.eventId, id));
    const assetIds = relations.map(r => r.roadAssetId);

    const assetSelect = {
      id: roadAssets.id,
      name: roadAssets.name,
      geometry: fromGeomSql(roadAssets.geometry),
      roadType: roadAssets.roadType,
      lanes: roadAssets.lanes,
      direction: roadAssets.direction,
      status: roadAssets.status,
      validFrom: roadAssets.validFrom,
      validTo: roadAssets.validTo,
      replacedBy: roadAssets.replacedBy,
      ownerDepartment: roadAssets.ownerDepartment,
      ward: roadAssets.ward,
      landmark: roadAssets.landmark,
      updatedAt: roadAssets.updatedAt,
    };

    const assets = assetIds.length > 0
      ? await db.select(assetSelect).from(roadAssets).where(inArray(roadAssets.id, assetIds))
      : [];

    const eventAssets = assets.map(a => ({
      ...a,
      validFrom: a.validFrom.toISOString(),
      validTo: a.validTo?.toISOString() ?? null,
      updatedAt: a.updatedAt.toISOString(),
    }));

    // Sync to Orion-LD
    await syncEventToOrion(event);

    return {
      data: {
        ...event,
        startDate: event.startDate.toISOString(),
        endDate: event.endDate.toISOString(),
        archivedAt: event.archivedAt?.toISOString() ?? null,
        updatedAt: event.updatedAt.toISOString(),
        roadAssets: eventAssets,
      },
    };
  });

  // GET /events/:id/intersecting-assets - Find roads intersecting with event geometry
  app.get('/:id/intersecting-assets', {
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(RoadAssetSchema),
        }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    // Get event geometry
    const eventSelect = {
      id: constructionEvents.id,
      geometry: fromGeomSql(constructionEvents.geometry),
    };

    const events = await db.select(eventSelect).from(constructionEvents).where(eq(constructionEvents.id, id));

    if (events.length === 0) {
      return reply.status(404).send({ error: 'Event not found' });
    }

    const event = events[0];

    // Find road assets that intersect with the event geometry
    const assetSelect = {
      id: roadAssets.id,
      name: roadAssets.name,
      geometry: fromGeomSql(roadAssets.geometry),
      roadType: roadAssets.roadType,
      lanes: roadAssets.lanes,
      direction: roadAssets.direction,
      status: roadAssets.status,
      validFrom: roadAssets.validFrom,
      validTo: roadAssets.validTo,
      replacedBy: roadAssets.replacedBy,
      ownerDepartment: roadAssets.ownerDepartment,
      ward: roadAssets.ward,
      landmark: roadAssets.landmark,
      updatedAt: roadAssets.updatedAt,
    };

    // Use ST_Intersects to find roads that intersect with event geometry
    const intersectingAssets = await db.select(assetSelect)
      .from(roadAssets)
      .where(
        and(
          eq(roadAssets.status, 'active'),
          isNotNull(roadAssets.geometry),
          sql`ST_Intersects(${roadAssets.geometry}, ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(event.geometry)}), 4326))`
        )
      )
      .limit(500);

    return {
      data: intersectingAssets.map(a => ({
        ...a,
        validFrom: a.validFrom.toISOString(),
        validTo: a.validTo?.toISOString() ?? null,
        updatedAt: a.updatedAt.toISOString(),
      })),
    };
  });

  // Evidence schema for event-level evidence query
  const EvidenceReviewStatusSchema = Type.Union([
    Type.Literal('pending'),
    Type.Literal('approved'),
    Type.Literal('rejected'),
    Type.Literal('accepted_by_authority'),
  ]);

  const EvidenceSchema = Type.Object({
    id: Type.String(),
    workOrderId: Type.String(),
    type: Type.String(),
    fileName: Type.String(),
    filePath: Type.String(),
    fileSizeBytes: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
    mimeType: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    title: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    captureDate: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
    submittedBy: Type.String(),
    submittedAt: Type.String({ format: 'date-time' }),
    submitterPartnerId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    submitterRole: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    reviewedBy: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    reviewedAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
    reviewStatus: EvidenceReviewStatusSchema,
    reviewNotes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    decisionBy: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    decisionAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
    decisionNotes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    // Additional info from work order join
    workOrderTitle: Type.String(),
    workOrderType: Type.String(),
  });

  // GET /events/:id/evidence - Get all evidence for an event (across all work orders)
  app.get('/:id/evidence', {
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      querystring: Type.Object({
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
    const { id: eventId } = request.params;
    const { reviewStatus, limit = 50, offset = 0 } = request.query;

    // Verify event exists
    const existingEvent = await db
      .select({ id: constructionEvents.id })
      .from(constructionEvents)
      .where(eq(constructionEvents.id, eventId))
      .limit(1);

    if (existingEvent.length === 0) {
      return reply.status(404).send({ error: 'Event not found' });
    }

    // Build filter conditions
    const conditions = [eq(workOrders.eventId, eventId)];

    if (reviewStatus) {
      const statuses = reviewStatus.split(',').map(s => s.trim());
      conditions.push(inArray(evidence.reviewStatus, statuses));
    }

    // Count total
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(evidence)
      .innerJoin(workOrders, eq(evidence.workOrderId, workOrders.id))
      .where(and(...conditions));

    const total = countResult[0]?.count ?? 0;

    // Fetch evidence with work order info
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
        submittedBy: evidence.submittedBy,
        submittedAt: evidence.submittedAt,
        submitterPartnerId: evidence.submitterPartnerId,
        submitterRole: evidence.submitterRole,
        reviewedBy: evidence.reviewedBy,
        reviewedAt: evidence.reviewedAt,
        reviewStatus: evidence.reviewStatus,
        reviewNotes: evidence.reviewNotes,
        decisionBy: evidence.decisionBy,
        decisionAt: evidence.decisionAt,
        decisionNotes: evidence.decisionNotes,
        workOrderTitle: workOrders.title,
        workOrderType: workOrders.type,
      })
      .from(evidence)
      .innerJoin(workOrders, eq(evidence.workOrderId, workOrders.id))
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
        decisionAt: ev.decisionAt?.toISOString() ?? null,
      })),
      meta: { total, limit, offset },
    };
  });

  // DELETE /events/:id - Cancel event (soft delete)
  app.delete('/:id', {
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      response: {
        200: Type.Object({
          data: EventSchema,
        }),
        400: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    // Check current status
    const existingEvents = await db.select({
      id: constructionEvents.id,
      status: constructionEvents.status,
    }).from(constructionEvents).where(eq(constructionEvents.id, id));

    if (existingEvents.length === 0) {
      return reply.status(404).send({ error: 'Event not found' });
    }

    const { status } = existingEvents[0];

    // Validate status - only planned events can be cancelled
    if (status === 'active') {
      return reply.status(400).send({
        error: 'Active events cannot be deleted. End the event first.',
      });
    }

    if (status === 'pending_review' || status === 'closed') {
      return reply.status(400).send({
        error: 'Events in review/closed status cannot be deleted. Archive instead.',
      });
    }

    if (status === 'cancelled') {
      return reply.status(400).send({ error: 'Event is already cancelled.' });
    }

    // Soft delete: change status to 'cancelled'
    await db.update(constructionEvents).set({
      status: 'cancelled',
      updatedAt: new Date(),
    }).where(eq(constructionEvents.id, id));

    // Fetch updated event with geometry conversion
    const eventSelect = {
      id: constructionEvents.id,
      name: constructionEvents.name,
      status: constructionEvents.status,
      startDate: constructionEvents.startDate,
      endDate: constructionEvents.endDate,
      restrictionType: constructionEvents.restrictionType,
      geometry: fromGeomSql(constructionEvents.geometry),
      geometrySource: constructionEvents.geometrySource,
      postEndDecision: constructionEvents.postEndDecision,
      archivedAt: constructionEvents.archivedAt,
      department: constructionEvents.department,
      ward: constructionEvents.ward,
      createdBy: constructionEvents.createdBy,
      refAssetId: constructionEvents.refAssetId,
      refAssetType: constructionEvents.refAssetType,
      updatedAt: constructionEvents.updatedAt,
    };

    const updatedEvents = await db.select(eventSelect).from(constructionEvents).where(eq(constructionEvents.id, id));
    const event = updatedEvents[0];

    // Fetch related road assets
    const relations = await db.select().from(eventRoadAssets).where(eq(eventRoadAssets.eventId, id));
    const assetIds = relations.map(r => r.roadAssetId);

    const assetSelect = {
      id: roadAssets.id,
      name: roadAssets.name,
      geometry: fromGeomSql(roadAssets.geometry),
      roadType: roadAssets.roadType,
      lanes: roadAssets.lanes,
      direction: roadAssets.direction,
      status: roadAssets.status,
      validFrom: roadAssets.validFrom,
      validTo: roadAssets.validTo,
      replacedBy: roadAssets.replacedBy,
      ownerDepartment: roadAssets.ownerDepartment,
      ward: roadAssets.ward,
      landmark: roadAssets.landmark,
      updatedAt: roadAssets.updatedAt,
    };

    const assets = assetIds.length > 0
      ? await db.select(assetSelect).from(roadAssets).where(inArray(roadAssets.id, assetIds))
      : [];

    const eventAssets = assets.map(a => ({
      ...a,
      validFrom: a.validFrom.toISOString(),
      validTo: a.validTo?.toISOString() ?? null,
      updatedAt: a.updatedAt.toISOString(),
    }));

    // Sync to Orion-LD (updates status to 'cancelled')
    await syncEventToOrion(event);

    return {
      data: {
        ...event,
        startDate: event.startDate.toISOString(),
        endDate: event.endDate.toISOString(),
        archivedAt: event.archivedAt?.toISOString() ?? null,
        updatedAt: event.updatedAt.toISOString(),
        roadAssets: eventAssets,
      },
    };
  });

  // PATCH /events/:id/archive - Archive a closed event
  app.patch('/:id/archive', {
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      response: {
        200: Type.Object({ data: EventSchema }),
        400: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    // Check current status and archive state
    const existingEvents = await db.select({
      id: constructionEvents.id,
      status: constructionEvents.status,
      archivedAt: constructionEvents.archivedAt,
    }).from(constructionEvents).where(eq(constructionEvents.id, id));

    if (existingEvents.length === 0) {
      return reply.status(404).send({ error: 'Event not found' });
    }

    const currentEvent = existingEvents[0];

    // Only closed events can be archived
    if (currentEvent.status !== 'closed') {
      return reply.status(400).send({ error: 'Only closed events can be archived' });
    }

    // Check if already archived
    if (currentEvent.archivedAt !== null) {
      return reply.status(400).send({ error: 'Event is already archived' });
    }

    const now = new Date();
    await db.update(constructionEvents).set({
      archivedAt: now,
      updatedAt: now,
    }).where(eq(constructionEvents.id, id));

    // Fetch updated event with geometry conversion
    const eventSelect = {
      id: constructionEvents.id,
      name: constructionEvents.name,
      status: constructionEvents.status,
      startDate: constructionEvents.startDate,
      endDate: constructionEvents.endDate,
      restrictionType: constructionEvents.restrictionType,
      geometry: fromGeomSql(constructionEvents.geometry),
      geometrySource: constructionEvents.geometrySource,
      postEndDecision: constructionEvents.postEndDecision,
      archivedAt: constructionEvents.archivedAt,
      department: constructionEvents.department,
      ward: constructionEvents.ward,
      createdBy: constructionEvents.createdBy,
      refAssetId: constructionEvents.refAssetId,
      refAssetType: constructionEvents.refAssetType,
      updatedAt: constructionEvents.updatedAt,
    };

    const updatedEvents = await db.select(eventSelect).from(constructionEvents).where(eq(constructionEvents.id, id));
    const event = updatedEvents[0];

    // Fetch related road assets
    const relations = await db.select().from(eventRoadAssets).where(eq(eventRoadAssets.eventId, id));
    const assetIds = relations.map(r => r.roadAssetId);

    const assetSelect = {
      id: roadAssets.id,
      name: roadAssets.name,
      geometry: fromGeomSql(roadAssets.geometry),
      roadType: roadAssets.roadType,
      lanes: roadAssets.lanes,
      direction: roadAssets.direction,
      status: roadAssets.status,
      validFrom: roadAssets.validFrom,
      validTo: roadAssets.validTo,
      replacedBy: roadAssets.replacedBy,
      ownerDepartment: roadAssets.ownerDepartment,
      ward: roadAssets.ward,
      landmark: roadAssets.landmark,
      updatedAt: roadAssets.updatedAt,
    };

    const assets = assetIds.length > 0
      ? await db.select(assetSelect).from(roadAssets).where(inArray(roadAssets.id, assetIds))
      : [];

    const eventAssets = assets.map(a => ({
      ...a,
      validFrom: a.validFrom.toISOString(),
      validTo: a.validTo?.toISOString() ?? null,
      updatedAt: a.updatedAt.toISOString(),
    }));

    return {
      data: {
        ...event,
        startDate: event.startDate.toISOString(),
        endDate: event.endDate.toISOString(),
        archivedAt: event.archivedAt?.toISOString() ?? null,
        updatedAt: event.updatedAt.toISOString(),
        roadAssets: eventAssets,
      },
    };
  });

  // PATCH /events/:id/unarchive - Unarchive an archived event
  app.patch('/:id/unarchive', {
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      response: {
        200: Type.Object({ data: EventSchema }),
        400: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    // Check current archive state
    const existingEvents = await db.select({
      id: constructionEvents.id,
      archivedAt: constructionEvents.archivedAt,
    }).from(constructionEvents).where(eq(constructionEvents.id, id));

    if (existingEvents.length === 0) {
      return reply.status(404).send({ error: 'Event not found' });
    }

    const currentEvent = existingEvents[0];

    // Check if event is archived
    if (currentEvent.archivedAt === null) {
      return reply.status(400).send({ error: 'Event is not archived' });
    }

    const now = new Date();
    await db.update(constructionEvents).set({
      archivedAt: null,
      updatedAt: now,
    }).where(eq(constructionEvents.id, id));

    // Fetch updated event with geometry conversion
    const eventSelect = {
      id: constructionEvents.id,
      name: constructionEvents.name,
      status: constructionEvents.status,
      startDate: constructionEvents.startDate,
      endDate: constructionEvents.endDate,
      restrictionType: constructionEvents.restrictionType,
      geometry: fromGeomSql(constructionEvents.geometry),
      geometrySource: constructionEvents.geometrySource,
      postEndDecision: constructionEvents.postEndDecision,
      archivedAt: constructionEvents.archivedAt,
      department: constructionEvents.department,
      ward: constructionEvents.ward,
      createdBy: constructionEvents.createdBy,
      refAssetId: constructionEvents.refAssetId,
      refAssetType: constructionEvents.refAssetType,
      updatedAt: constructionEvents.updatedAt,
    };

    const updatedEvents = await db.select(eventSelect).from(constructionEvents).where(eq(constructionEvents.id, id));
    const event = updatedEvents[0];

    // Fetch related road assets
    const relations = await db.select().from(eventRoadAssets).where(eq(eventRoadAssets.eventId, id));
    const assetIds = relations.map(r => r.roadAssetId);

    const assetSelect = {
      id: roadAssets.id,
      name: roadAssets.name,
      geometry: fromGeomSql(roadAssets.geometry),
      roadType: roadAssets.roadType,
      lanes: roadAssets.lanes,
      direction: roadAssets.direction,
      status: roadAssets.status,
      validFrom: roadAssets.validFrom,
      validTo: roadAssets.validTo,
      replacedBy: roadAssets.replacedBy,
      ownerDepartment: roadAssets.ownerDepartment,
      ward: roadAssets.ward,
      landmark: roadAssets.landmark,
      updatedAt: roadAssets.updatedAt,
    };

    const assets = assetIds.length > 0
      ? await db.select(assetSelect).from(roadAssets).where(inArray(roadAssets.id, assetIds))
      : [];

    const eventAssets = assets.map(a => ({
      ...a,
      validFrom: a.validFrom.toISOString(),
      validTo: a.validTo?.toISOString() ?? null,
      updatedAt: a.updatedAt.toISOString(),
    }));

    return {
      data: {
        ...event,
        startDate: event.startDate.toISOString(),
        endDate: event.endDate.toISOString(),
        archivedAt: event.archivedAt?.toISOString() ?? null,
        updatedAt: event.updatedAt.toISOString(),
        roadAssets: eventAssets,
      },
    };
  });

  // ============================================
  // Phase 1: Event Close Flow (Gov-only)
  // ============================================

  const CloseEventSchema = Type.Object({
    closeNotes: Type.Optional(Type.String()),
  });

  // Temporary Gov role check (Phase 3 will have full RBAC)
  const GOV_ROLES = ['gov_admin', 'gov_event_ops'];

  // POST /events/:id/close - Close an event (Gov-only)
  app.post('/:id/close', {
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      body: CloseEventSchema,
      response: {
        200: Type.Object({
          data: EventSchema,
        }),
        400: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String(), hint: Type.Optional(Type.String()) }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { closeNotes } = request.body;

    // Phase 1: Temporary Gov role check via header
    const userRole = request.headers['x-user-role'] as string;
    if (!GOV_ROLES.includes(userRole)) {
      return reply.status(403).send({
        error: 'Gov role required to close events',
        hint: 'Set X-User-Role header to gov_admin or gov_event_ops',
      });
    }

    // Check current status
    const existingEvents = await db.select({
      id: constructionEvents.id,
      name: constructionEvents.name,
      status: constructionEvents.status,
      archivedAt: constructionEvents.archivedAt,
      department: constructionEvents.department,
      ward: constructionEvents.ward,
    }).from(constructionEvents).where(eq(constructionEvents.id, id));

    if (existingEvents.length === 0) {
      return reply.status(404).send({ error: 'Event not found' });
    }

    const currentEvent = existingEvents[0];

    // Only pending_review events can be closed
    if (currentEvent.status !== 'pending_review') {
      return reply.status(400).send({
        error: `Cannot close event in ${currentEvent.status} status. Must be pending_review.`
      });
    }

    // Check if already archived
    if (currentEvent.archivedAt !== null) {
      return reply.status(400).send({ error: 'Event is already archived' });
    }

    // Check all work orders are completed or cancelled
    const pendingWorkOrders = await db
      .select({ id: workOrders.id, status: workOrders.status })
      .from(workOrders)
      .where(and(
        eq(workOrders.eventId, id),
        inArray(workOrders.status, ['draft', 'assigned', 'in_progress'])
      ));

    if (pendingWorkOrders.length > 0) {
      return reply.status(400).send({
        error: `Cannot close event: ${pendingWorkOrders.length} work order(s) are not completed. Complete or cancel all work orders first.`
      });
    }

    // Check all evidence has been accepted by authority (pending/approved blocks closure, rejected does not)
    const pendingEvidence = await db
      .select({ id: evidence.id })
      .from(evidence)
      .innerJoin(workOrders, eq(evidence.workOrderId, workOrders.id))
      .where(and(
        eq(workOrders.eventId, id),
        inArray(evidence.reviewStatus, ['pending', 'approved'])  // rejected does not block
      ));

    if (pendingEvidence.length > 0) {
      return reply.status(400).send({
        error: `Cannot close event: ${pendingEvidence.length} evidence item(s) pending final decision. All evidence must be accepted by authority before closing.`
      });
    }

    const now = new Date();
    const closedBy = userRole;  // TODO: Get actual user ID from auth

    // Update event status to closed
    await db.update(constructionEvents).set({
      status: 'closed',
      closedBy,
      closedAt: now,
      closeNotes: closeNotes ?? null,
      updatedAt: now,
    }).where(eq(constructionEvents.id, id));

    // Fetch updated event with geometry conversion
    const eventSelect = {
      id: constructionEvents.id,
      name: constructionEvents.name,
      status: constructionEvents.status,
      startDate: constructionEvents.startDate,
      endDate: constructionEvents.endDate,
      restrictionType: constructionEvents.restrictionType,
      geometry: fromGeomSql(constructionEvents.geometry),
      geometrySource: constructionEvents.geometrySource,
      postEndDecision: constructionEvents.postEndDecision,
      archivedAt: constructionEvents.archivedAt,
      department: constructionEvents.department,
      ward: constructionEvents.ward,
      createdBy: constructionEvents.createdBy,
      closedBy: constructionEvents.closedBy,
      closedAt: constructionEvents.closedAt,
      closeNotes: constructionEvents.closeNotes,
      refAssetId: constructionEvents.refAssetId,
      refAssetType: constructionEvents.refAssetType,
      updatedAt: constructionEvents.updatedAt,
    };

    const updatedEvents = await db.select(eventSelect).from(constructionEvents).where(eq(constructionEvents.id, id));
    const event = updatedEvents[0];

    // Fetch related road assets (historical)
    const relations = await db.select().from(eventRoadAssets).where(eq(eventRoadAssets.eventId, id));
    const assetIds = relations.map(r => r.roadAssetId);

    const assetSelect = {
      id: roadAssets.id,
      name: roadAssets.name,
      geometry: fromGeomSql(roadAssets.geometry),
      roadType: roadAssets.roadType,
      lanes: roadAssets.lanes,
      direction: roadAssets.direction,
      status: roadAssets.status,
      validFrom: roadAssets.validFrom,
      validTo: roadAssets.validTo,
      replacedBy: roadAssets.replacedBy,
      ownerDepartment: roadAssets.ownerDepartment,
      ward: roadAssets.ward,
      landmark: roadAssets.landmark,
      updatedAt: roadAssets.updatedAt,
    };

    const assets = assetIds.length > 0
      ? await db.select(assetSelect).from(roadAssets).where(inArray(roadAssets.id, assetIds))
      : [];

    const eventAssets = assets.map(a => ({
      ...a,
      validFrom: a.validFrom.toISOString(),
      validTo: a.validTo?.toISOString() ?? null,
      updatedAt: a.updatedAt.toISOString(),
    }));

    // Sync to Orion-LD
    try {
      await syncEventToOrion({
        ...event,
        geometry: event.geometry!,
      });
    } catch (syncError) {
      console.error('[Event Close] Orion-LD sync failed:', syncError);
      // Don't fail the request, just log the error
    }

    return {
      data: {
        ...event,
        startDate: event.startDate.toISOString(),
        endDate: event.endDate.toISOString(),
        archivedAt: event.archivedAt?.toISOString() ?? null,
        closedAt: event.closedAt?.toISOString() ?? null,
        updatedAt: event.updatedAt.toISOString(),
        roadAssets: eventAssets,
      },
    };
  });

  // GET /events/enrich-road-names/status - Check status of unnamed event-covered roads
  app.get('/enrich-road-names/status', {
    schema: {
      response: {
        200: Type.Object({
          data: Type.Object({
            unnamedCount: Type.Number(),
            googleMapsConfigured: Type.Boolean(),
          }),
        }),
      },
    },
  }, async () => {
    const unnamedCount = await countAllEventUnnamedRoads();
    return {
      data: {
        unnamedCount,
        googleMapsConfigured: isGoogleMapsConfigured(),
      },
    };
  });

  // POST /events/enrich-road-names - Batch enrich road names for all event-covered roads
  app.post('/enrich-road-names', {
    schema: {
      querystring: Type.Object({
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Object({
            processed: Type.Number(),
            enriched: Type.Number(),
            skipped: Type.Number(),
            errors: Type.Array(Type.String()),
          }),
        }),
        503: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    if (!isGoogleMapsConfigured()) {
      return reply.status(503).send({
        error: 'Google Maps API is not configured. Set GOOGLE_MAPS_API_KEY environment variable.',
      });
    }

    const limit = request.query.limit ?? 50;
    const result = await enrichAllEventRoadNames(limit);

    return {
      data: result,
    };
  });

  // GET /events/enrich-nearby-roads/status - Check status of unnamed roads near events
  app.get('/enrich-nearby-roads/status', {
    schema: {
      querystring: Type.Object({
        distance: Type.Optional(Type.Integer({ minimum: 10, maximum: 500, default: 100 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Object({
            unnamedCount: Type.Number(),
            distanceMeters: Type.Number(),
            googleMapsConfigured: Type.Boolean(),
          }),
        }),
      },
    },
  }, async (request) => {
    const distance = request.query.distance ?? 100;
    const unnamedCount = await countNearbyUnnamedRoads(distance);
    return {
      data: {
        unnamedCount,
        distanceMeters: distance,
        googleMapsConfigured: isGoogleMapsConfigured(),
      },
    };
  });

  // POST /events/enrich-nearby-roads - Enrich road names for roads near event-covered roads
  app.post('/enrich-nearby-roads', {
    schema: {
      querystring: Type.Object({
        distance: Type.Optional(Type.Integer({ minimum: 10, maximum: 500, default: 100 })),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500, default: 100 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Object({
            processed: Type.Number(),
            enriched: Type.Number(),
            skipped: Type.Number(),
            errors: Type.Array(Type.String()),
            distanceMeters: Type.Number(),
          }),
        }),
        503: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    if (!isGoogleMapsConfigured()) {
      return reply.status(503).send({
        error: 'Google Maps API is not configured. Set GOOGLE_MAPS_API_KEY environment variable.',
      });
    }

    const distance = request.query.distance ?? 100;
    const limit = request.query.limit ?? 100;
    const result = await enrichNearbyRoadNames(distance, limit);

    return {
      data: {
        ...result,
        distanceMeters: distance,
      },
    };
  });

  // POST /events/update-sublocality - Update sublocality for roads with generic names like "道路"
  app.post('/update-sublocality', {
    schema: {
      querystring: Type.Object({
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Object({
            processed: Type.Number(),
            enriched: Type.Number(),
            skipped: Type.Number(),
            errors: Type.Array(Type.String()),
          }),
        }),
        503: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    if (!isGoogleMapsConfigured()) {
      return reply.status(503).send({
        error: 'Google Maps API is not configured. Set GOOGLE_MAPS_API_KEY environment variable.',
      });
    }

    const limit = request.query.limit ?? 50;
    const result = {
      processed: 0,
      enriched: 0,
      skipped: 0,
      errors: [] as string[],
    };

    try {
      // Find roads with generic names that don't have sublocality yet
      const genericRoads = await db.execute(sql`
        SELECT
          id,
          ST_AsGeoJSON(geometry)::json as geometry
        FROM road_assets
        WHERE display_name = '道路'
          AND (sublocality IS NULL OR sublocality = '')
          AND geometry IS NOT NULL
        LIMIT ${limit}
      `);

      const roads = genericRoads.rows as Array<{
        id: string;
        geometry: { type: string; coordinates: [number, number][] };
      }>;

      console.log(`[UpdateSublocality] Found ${roads.length} roads needing sublocality`);

      for (const road of roads) {
        result.processed++;

        if (!road.geometry || road.geometry.type !== 'LineString') {
          result.skipped++;
          continue;
        }

        try {
          const lookupResult = await getRoadNameForLineString(road.geometry.coordinates);

          if (lookupResult.sublocality) {
            await db
              .update(roadAssets)
              .set({
                sublocality: lookupResult.sublocality,
                updatedAt: new Date(),
              })
              .where(eq(roadAssets.id, road.id));

            result.enriched++;
            console.log(`[UpdateSublocality] Road ${road.id}: sublocality = "${lookupResult.sublocality}"`);
          } else {
            result.skipped++;
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Road ${road.id}: ${message}`);
        }
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Query failed: ${message}`);
    }

    return { data: result };
  });
}

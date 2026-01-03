import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { db } from '../db/index.js';
import { constructionEvents, eventRoadAssets, roadAssets } from '../db/schema.js';
import { eq, and, gte, lte, like, ilike, inArray, sql, isNotNull, isNull, asc, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { syncEventToOrion } from '../services/ngsi-sync.js';
import { toGeomSql, fromGeomSql } from '../db/geometry.js';
import { enrichRoadNamesForEvent, enrichAllEventRoadNames, countAllEventUnnamedRoads } from '../services/road-name-enrichment.js';
import { isGoogleMapsConfigured } from '../services/google-maps.js';

// TypeBox schemas
const GeometrySchema = Type.Object({
  type: Type.String(),
  coordinates: Type.Any(),
});

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

const EventSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  status: Type.Union([Type.Literal('planned'), Type.Literal('active'), Type.Literal('ended'), Type.Literal('cancelled')]),
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
  updatedAt: Type.String({ format: 'date-time' }),
});

const CreateEventSchema = Type.Object({
  name: Type.String(),
  startDate: Type.String({ format: 'date-time' }),
  endDate: Type.String({ format: 'date-time' }),
  restrictionType: Type.String(),
  geometry: Type.Optional(GeometrySchema), // Optional - auto-generate from road assets if not provided
  department: Type.String(),
  ward: Type.Optional(Type.String()),
  roadAssetIds: Type.Array(Type.String(), { minItems: 1 }), // Required with at least 1 item
});

const UpdateEventSchema = Type.Partial(Type.Object({
  name: Type.String(),
  startDate: Type.String({ format: 'date-time' }),
  endDate: Type.String({ format: 'date-time' }),
  restrictionType: Type.String(),
  geometry: GeometrySchema,
  department: Type.String(),
  ward: Type.String(),
  roadAssetIds: Type.Array(Type.String(), { minItems: 1 }),
  regenerateGeometry: Type.Boolean(), // Explicit flag to regenerate from roads
}));

const StatusChangeSchema = Type.Object({
  status: Type.Union([Type.Literal('active'), Type.Literal('ended')]),
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
      conditions.push(ilike(constructionEvents.name, `%${name}%`));
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
      updatedAt: constructionEvents.updatedAt,
    };

    // Sort: Active first, then Planned (by startDate ASC), then Ended (by endDate DESC)
    const orderByClause = [
      sql`CASE ${constructionEvents.status}
        WHEN 'active' THEN 1
        WHEN 'planned' THEN 2
        WHEN 'ended' THEN 3
      END`,
      sql`CASE WHEN ${constructionEvents.status} = 'ended' THEN ${constructionEvents.endDate} END DESC`,
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
    const roadAssetIds = body.roadAssetIds;

    // Validate roadAssetIds exist and have geometry
    const validAssets = await db.select({
      id: roadAssets.id,
      hasGeometry: sql<boolean>`geometry IS NOT NULL`.as('hasGeometry'),
    }).from(roadAssets).where(inArray(roadAssets.id, roadAssetIds));

    if (validAssets.length !== roadAssetIds.length) {
      const foundIds = new Set(validAssets.map(a => a.id));
      const missingIds = roadAssetIds.filter(id => !foundIds.has(id));
      return reply.status(400).send({ error: `Invalid road asset IDs: ${missingIds.join(', ')}` });
    }

    const assetsWithoutGeometry = validAssets.filter(a => !a.hasGeometry);
    if (assetsWithoutGeometry.length > 0) {
      return reply.status(400).send({ error: `Road assets without geometry: ${assetsWithoutGeometry.map(a => a.id).join(', ')}` });
    }

    // Determine geometry and source
    let geometrySource: 'manual' | 'auto' = 'manual';
    let eventGeometry = body.geometry;

    if (!body.geometry) {
      // Auto-generate geometry from road assets using ST_Buffer(ST_Union(...))
      // Use inArray for proper SQL generation instead of raw ANY
      const result = await db.select({
        geometry: sql<unknown>`ST_AsGeoJSON(
          ST_Buffer(
            ST_Union(geometry)::geography,
            15
          )::geometry
        )::json`.as('geometry'),
      }).from(roadAssets).where(
        and(
          inArray(roadAssets.id, roadAssetIds),
          isNotNull(roadAssets.geometry)
        )
      );

      if (!result[0]?.geometry) {
        return reply.status(400).send({ error: 'Failed to generate geometry from road assets' });
      }

      eventGeometry = result[0].geometry as typeof body.geometry;
      geometrySource = 'auto';
    }

    // Use transaction for atomicity
    await db.transaction(async (tx) => {
      // Insert event with geometry
      await tx.execute(sql`
        INSERT INTO construction_events (
          id, name, status, start_date, end_date, restriction_type,
          geometry, geometry_source, post_end_decision, department, ward, updated_at
        ) VALUES (
          ${id}, ${body.name}, 'planned', ${startDate}, ${endDate}, ${body.restrictionType},
          ${toGeomSql(eventGeometry!)}, ${geometrySource}, 'pending', ${body.department}, ${body.ward ?? null}, ${now}
        )
      `);

      // Insert road asset relations
      for (const assetId of roadAssetIds) {
        await tx.insert(eventRoadAssets).values({
          eventId: id,
          roadAssetId: assetId,
          relationType: 'affected',
        }).onConflictDoNothing();
      }
    });

    // Fetch the created event with road assets for response
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

    // Prepare event object for response and sync
    const newEvent = {
      id,
      name: body.name,
      status: 'planned' as const,
      startDate,
      endDate,
      restrictionType: body.restrictionType,
      geometry: eventGeometry!,
      geometrySource,
      postEndDecision: 'pending' as const,
      department: body.department,
      ward: body.ward,
      createdBy: null,
      updatedAt: now,
    };

    // Sync to Orion-LD
    await syncEventToOrion(newEvent);

    // Async: Enrich unnamed road names from Google Maps
    if (isGoogleMapsConfigured()) {
      enrichRoadNamesForEvent(id).then(result => {
        console.log(`[RoadNameEnrich] Event ${id}: ${result.enriched}/${result.processed} roads enriched`);
        if (result.errors.length > 0) {
          console.warn(`[RoadNameEnrich] Event ${id} errors:`, result.errors);
        }
      }).catch(err => {
        console.error(`[RoadNameEnrich] Event ${id} failed:`, err);
      });
    }

    return reply.status(201).send({
      data: {
        ...newEvent,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        archivedAt: null,
        updatedAt: now.toISOString(),
        roadAssets: eventAssets,
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

    // Only planned and active events can be edited (ended/cancelled are read-only for audit)
    if (status === 'ended' || status === 'cancelled') {
      return reply.status(400).send({
        error: `Cannot edit ${status} events. Historical records must be preserved for audit.`,
      });
    }

    const now = new Date();

    // Validate roadAssetIds if provided
    if (body.roadAssetIds !== undefined && body.roadAssetIds.length > 0) {
      const validAssets = await db.select({ id: roadAssets.id })
        .from(roadAssets)
        .where(inArray(roadAssets.id, body.roadAssetIds));

      if (validAssets.length !== body.roadAssetIds.length) {
        const foundIds = new Set(validAssets.map(a => a.id));
        const missingIds = body.roadAssetIds.filter(aid => !foundIds.has(aid));
        return reply.status(400).send({ error: `Invalid road asset IDs: ${missingIds.join(', ')}` });
      }
    }

    // Handle geometry update with priority: explicit geometry > regenerateGeometry
    if (body.geometry) {
      // Explicit geometry takes priority (set geometrySource = 'manual')
      await db.execute(sql`
        UPDATE construction_events
        SET geometry = ${toGeomSql(body.geometry)}, geometry_source = 'manual', updated_at = ${now}
        WHERE id = ${id}
      `);
    } else if (body.regenerateGeometry === true) {
      // Regenerate geometry from road assets
      // Use updated roadAssetIds if provided, otherwise fetch current ones
      let targetRoadAssetIds = body.roadAssetIds;
      if (!targetRoadAssetIds) {
        const currentRelations = await db.select({ roadAssetId: eventRoadAssets.roadAssetId })
          .from(eventRoadAssets)
          .where(eq(eventRoadAssets.eventId, id));
        targetRoadAssetIds = currentRelations.map(r => r.roadAssetId);
      }

      if (targetRoadAssetIds.length === 0) {
        return reply.status(400).send({ error: 'Cannot regenerate geometry: no road assets linked' });
      }

      // Auto-generate geometry from road assets using inArray for proper SQL generation
      const result = await db.select({
        geometry: sql<unknown>`ST_AsGeoJSON(
          ST_Buffer(
            ST_Union(geometry)::geography,
            15
          )::geometry
        )::json`.as('geometry'),
      }).from(roadAssets).where(
        and(
          inArray(roadAssets.id, targetRoadAssetIds),
          isNotNull(roadAssets.geometry)
        )
      );

      if (!result[0]?.geometry) {
        return reply.status(400).send({ error: 'Failed to regenerate geometry from road assets' });
      }

      await db.execute(sql`
        UPDATE construction_events
        SET geometry = ${toGeomSql(result[0].geometry as object)}, geometry_source = 'auto', updated_at = ${now}
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

    // Only run non-geometry update if there are non-geometry fields
    const hasNonGeomUpdates = Object.keys(updates).length > 1; // more than just updatedAt
    if (hasNonGeomUpdates || (!body.geometry && !body.regenerateGeometry)) {
      await db.update(constructionEvents).set(updates).where(eq(constructionEvents.id, id));
    }

    // Update road asset relations if provided
    if (body.roadAssetIds !== undefined) {
      // Delete existing relations
      await db.delete(eventRoadAssets).where(eq(eventRoadAssets.eventId, id));

      // Insert new relations
      for (const assetId of body.roadAssetIds) {
        await db.insert(eventRoadAssets).values({
          eventId: id,
          roadAssetId: assetId,
          relationType: 'affected',
        }).onConflictDoNothing();
      }
    }

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

    // Async: Enrich unnamed road names from Google Maps (only if roadAssetIds changed)
    if (body.roadAssetIds !== undefined && isGoogleMapsConfigured()) {
      enrichRoadNamesForEvent(id).then(result => {
        console.log(`[RoadNameEnrich] Event ${id}: ${result.enriched}/${result.processed} roads enriched`);
        if (result.errors.length > 0) {
          console.warn(`[RoadNameEnrich] Event ${id} errors:`, result.errors);
        }
      }).catch(err => {
        console.error(`[RoadNameEnrich] Event ${id} failed:`, err);
      });
    }

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

    // Validate status transition
    if (currentEvent.status === 'planned' && newStatus !== 'active') {
      return reply.status(400).send({ error: 'Planned events can only transition to active' });
    }
    if (currentEvent.status === 'active' && newStatus !== 'ended') {
      return reply.status(400).send({ error: 'Active events can only transition to ended' });
    }
    if (currentEvent.status === 'ended') {
      return reply.status(400).send({ error: 'Ended events cannot change status' });
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

  // PATCH /events/:id/decision - Set post-end decision
  app.patch('/:id/decision', {
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      body: PostEndDecisionSchema,
      response: {
        200: Type.Object({ data: EventSchema }),
        400: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { decision } = request.body;

    // Check current status and decision (no geometry needed)
    const existingEvents = await db.select({
      id: constructionEvents.id,
      status: constructionEvents.status,
      postEndDecision: constructionEvents.postEndDecision,
    }).from(constructionEvents).where(eq(constructionEvents.id, id));

    if (existingEvents.length === 0) {
      return reply.status(404).send({ error: 'Event not found' });
    }

    const currentEvent = existingEvents[0];

    if (currentEvent.status !== 'ended') {
      return reply.status(400).send({ error: 'Post-end decision can only be set for ended events' });
    }

    if (currentEvent.postEndDecision !== 'pending') {
      return reply.status(400).send({ error: 'Post-end decision has already been made' });
    }

    await db.update(constructionEvents).set({
      postEndDecision: decision,
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

    if (status === 'ended') {
      return reply.status(400).send({
        error: 'Ended events cannot be deleted. Historical records must be preserved for traceability.',
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

  // PATCH /events/:id/archive - Archive an ended event
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

    // Only ended events can be archived
    if (currentEvent.status !== 'ended') {
      return reply.status(400).send({ error: 'Only ended events can be archived' });
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
}

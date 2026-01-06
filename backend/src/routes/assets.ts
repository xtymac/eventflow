import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { db } from '../db/index.js';
import { roadAssets, roadAssetChanges, constructionEvents, eventRoadAssets } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { toGeomSql, toGeomSqlNullable, fromGeomSql } from '../db/geometry.js';
import { getRoadNameForLineString, isGoogleMapsConfigured } from '../services/google-maps.js';

// BBOX validation helper
function parseBbox(bbox: string): { minLng: number; minLat: number; maxLng: number; maxLat: number } | null {
  const parts = bbox.split(',').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return null;
  const [minLng, minLat, maxLng, maxLat] = parts;
  // Validate ranges
  if (minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90) return null;
  if (minLng > maxLng || minLat > maxLat) return null;
  return { minLng, minLat, maxLng, maxLat };
}

// TypeBox schemas
const GeometrySchema = Type.Object({
  type: Type.String(),
  coordinates: Type.Any(),
});

const AssetSchema = Type.Object({
  id: Type.String(),
  name: Type.Optional(Type.String()),           // Nullable - no placeholder for unnamed
  nameJa: Type.Optional(Type.String()),         // Japanese name from OSM
  ref: Type.Optional(Type.String()),            // Route reference
  localRef: Type.Optional(Type.String()),       // Local reference code
  displayName: Type.Optional(Type.String()),    // Computed fallback for display
  nameSource: Type.Optional(Type.String()),     // Source of name: osm, municipal, manual
  nameConfidence: Type.Optional(Type.String()), // Match confidence: high, medium, low
  geometry: GeometrySchema,
  roadType: Type.String(),
  lanes: Type.Number(),
  direction: Type.String(),
  status: Type.Union([Type.Literal('active'), Type.Literal('inactive')]),
  validFrom: Type.String({ format: 'date-time' }),
  validTo: Type.Optional(Type.String({ format: 'date-time' })),
  replacedBy: Type.Optional(Type.String()),
  ownerDepartment: Type.Optional(Type.String()),
  ward: Type.Optional(Type.String()),
  landmark: Type.Optional(Type.String()),
  sublocality: Type.Optional(Type.String()),    // 町名/丁目 from Google Maps
  updatedAt: Type.String({ format: 'date-time' }),
});

const CreateAssetSchema = Type.Object({
  name: Type.Optional(Type.String()),
  nameJa: Type.Optional(Type.String()),
  ref: Type.Optional(Type.String()),
  localRef: Type.Optional(Type.String()),
  geometry: GeometrySchema,
  roadType: Type.String(),
  lanes: Type.Number(),
  direction: Type.String(),
  ownerDepartment: Type.Optional(Type.String()),
  ward: Type.Optional(Type.String()),
  landmark: Type.Optional(Type.String()),
  eventId: Type.Optional(Type.String()),
});

const UpdateAssetSchema = Type.Partial(Type.Omit(CreateAssetSchema, ['eventId']));

const RetireAssetSchema = Type.Object({
  eventId: Type.String(),
  replacedBy: Type.Optional(Type.String()),
});

export async function assetsRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // GET /assets/wards - Get distinct ward names
  app.get('/wards', {
    schema: {
      response: {
        200: Type.Object({
          data: Type.Array(Type.String()),
        }),
      },
    },
  }, async () => {
    const result = await db.selectDistinct({ ward: roadAssets.ward })
      .from(roadAssets)
      .where(sql`${roadAssets.ward} IS NOT NULL`);

    const wards = result
      .map((r) => r.ward)
      .filter((w): w is string => w !== null)
      .sort();

    return { data: wards };
  });

  // GET /assets - List road assets
  app.get('/', {
    schema: {
      querystring: Type.Object({
        // Filter params
        status: Type.Optional(Type.String()),
        roadType: Type.Optional(Type.String()),
        ownerDepartment: Type.Optional(Type.String()),
        ward: Type.Optional(Type.String()),
        q: Type.Optional(Type.String()),          // search query (name or ID)
        searchName: Type.Optional(Type.String()), // deprecated - backwards compat
        unnamed: Type.Optional(Type.Union([Type.Boolean(), Type.Literal('true'), Type.Literal('false')])), // filter unnamed roads
        // Spatial & pagination params
        bbox: Type.Optional(Type.String()),  // "minLng,minLat,maxLng,maxLat"
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000 })),
        offset: Type.Optional(Type.Integer({ minimum: 0 })),
        includeTotal: Type.Optional(Type.Boolean()),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(AssetSchema),
          meta: Type.Object({
            total: Type.Union([Type.Integer(), Type.Null()]),
            limit: Type.Integer(),
            offset: Type.Integer(),
          }),
        }),
        400: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { status, roadType, ownerDepartment, ward, q, searchName, bbox, unnamed: unnamedParam } = request.query;
    // Backwards compat: support both q and searchName, prefer q
    const searchQuery = q ?? searchName;
    // Parse unnamed boolean (handles string 'true' from querystring if coerceTypes is off)
    const unnamed = unnamedParam === true || (unnamedParam as unknown) === 'true';
    // Pagination with server-side hard limit enforcement
    const MAX_LIMIT = 1000;
    const limit = Math.min(request.query.limit ?? 200, MAX_LIMIT);
    const offset = request.query.offset ?? 0;
    // Boolean from querystring may be string "false" - handle explicitly
    const includeTotal = request.query.includeTotal !== false && request.query.includeTotal !== 'false';

    // Validate bbox if provided
    let bboxParsed: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null = null;
    if (bbox) {
      bboxParsed = parseBbox(bbox);
      if (!bboxParsed) {
        return reply.status(400).send({ error: 'Invalid bbox format. Expected: minLng,minLat,maxLng,maxLat' });
      }
    }

    // Build WHERE conditions
    const conditions: ReturnType<typeof sql>[] = [];

    if (status) conditions.push(sql`status = ${status}`);
    // Support comma-separated roadType values with whitelist validation
    if (roadType) {
      const VALID_ROAD_TYPES = ['arterial', 'collector', 'local'] as const;
      const types = roadType
        .split(',')
        .map(t => t.trim().toLowerCase())
        .filter(t => VALID_ROAD_TYPES.includes(t as typeof VALID_ROAD_TYPES[number]));

      if (types.length === 1) {
        conditions.push(sql`road_type = ${types[0]}`);
      } else if (types.length > 1) {
        conditions.push(sql`road_type IN (${sql.join(types.map(t => sql`${t}`), sql`, `)})`);
      }
      // If all values are invalid, no condition is added (shows all)
    }
    if (ownerDepartment) conditions.push(sql`owner_department = ${ownerDepartment}`);
    if (ward) conditions.push(sql`ward = ${ward}`);
    // Search by name, ID, or ward (with trim to avoid inefficient %% patterns)
    if (searchQuery) {
      const trimmed = searchQuery.trim();
      if (trimmed) {
        const pattern = `%${trimmed}%`;
        conditions.push(sql`(
          COALESCE(name, '') ILIKE ${pattern}
          OR id ILIKE ${pattern}
          OR COALESCE(ward, '') ILIKE ${pattern}
        )`);
      }
    }
    // Unnamed filter: NULL, empty, whitespace-only, or 'Unnamed Road' (case-insensitive)
    if (unnamed) {
      conditions.push(sql`(
        COALESCE(TRIM(name), '') = ''
        OR LOWER(COALESCE(TRIM(name), '')) = 'unnamed road'
      )`);
    }

    // Add bbox spatial filter (uses GIST index)
    if (bboxParsed) {
      const { minLng, minLat, maxLng, maxLat } = bboxParsed;
      conditions.push(
        sql`ST_Intersects(geometry, ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326))`
      );
    }

    const whereClause = conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;

    // Get total count matching filters (skip if includeTotal=false for performance)
    let total: number | null = null;
    if (includeTotal) {
      const countResult = await db.execute<{ total: number }>(sql`
        SELECT COUNT(*)::int as total FROM road_assets ${whereClause}
      `);
      total = countResult.rows[0]?.total ?? 0;
    }

    // Get paginated results with geometry conversion
    // Use stable sort (id) to avoid duplicates/missing items when records update during pagination
    const assetsResult = await db.execute(sql`
      SELECT
        id, name,
        name_ja as "nameJa",
        ref,
        local_ref as "localRef",
        display_name as "displayName",
        name_source as "nameSource",
        name_confidence as "nameConfidence",
        CASE WHEN geometry IS NULL THEN NULL ELSE ST_AsGeoJSON(geometry)::json END as geometry,
        road_type as "roadType", lanes, direction, status,
        valid_from as "validFrom", valid_to as "validTo",
        replaced_by as "replacedBy", owner_department as "ownerDepartment",
        ward, landmark, sublocality, updated_at as "updatedAt"
      FROM road_assets
      ${whereClause}
      ORDER BY id
      LIMIT ${limit} OFFSET ${offset}
    `);

    // Format timestamps (raw SQL returns Date objects for timestamp columns)
    const assets = assetsResult.rows.map((a: Record<string, unknown>) => ({
      ...a,
      validFrom: a.validFrom instanceof Date ? a.validFrom.toISOString() : a.validFrom,
      validTo: a.validTo instanceof Date ? a.validTo.toISOString() : a.validTo,
      updatedAt: a.updatedAt instanceof Date ? a.updatedAt.toISOString() : a.updatedAt,
    }));

    return {
      data: assets,
      meta: { total, limit, offset },
    };
  });

  // GET /assets/:id - Get asset detail
  app.get('/:id', {
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      response: {
        200: Type.Object({ data: AssetSchema }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    const assetSelect = {
      id: roadAssets.id,
      name: roadAssets.name,
      nameJa: roadAssets.nameJa,
      ref: roadAssets.ref,
      localRef: roadAssets.localRef,
      displayName: roadAssets.displayName,
      nameSource: roadAssets.nameSource,
      nameConfidence: roadAssets.nameConfidence,
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
      sublocality: roadAssets.sublocality,
      updatedAt: roadAssets.updatedAt,
    };

    const assets = await db.select(assetSelect).from(roadAssets).where(eq(roadAssets.id, id));

    if (assets.length === 0) {
      return reply.status(404).send({ error: 'Asset not found' });
    }

    const asset = assets[0];
    return {
      data: {
        ...asset,
        validFrom: asset.validFrom.toISOString(),
        validTo: asset.validTo?.toISOString(),
        updatedAt: asset.updatedAt.toISOString(),
      },
    };
  });

  // GET /assets/:id/events - List events affecting this asset
  app.get('/:id/events', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      response: {
        200: Type.Object({
          data: Type.Array(Type.Object({
            id: Type.String(),
            name: Type.String(),
            status: Type.String(),
            startDate: Type.String({ format: 'date-time' }),
            endDate: Type.Optional(Type.String({ format: 'date-time' })),
          })),
        }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    // Check asset exists
    const asset = await db.select({ id: roadAssets.id })
      .from(roadAssets).where(eq(roadAssets.id, id));
    if (asset.length === 0) {
      return reply.status(404).send({ error: 'Asset not found' });
    }

    // Query via join table with stable ordering (date + id for deterministic results)
    const events = await db
      .select({
        id: constructionEvents.id,
        name: constructionEvents.name,
        status: constructionEvents.status,
        startDate: constructionEvents.startDate,
        endDate: constructionEvents.endDate,
      })
      .from(eventRoadAssets)
      .innerJoin(constructionEvents, eq(eventRoadAssets.eventId, constructionEvents.id))
      .where(eq(eventRoadAssets.roadAssetId, id))
      .orderBy(constructionEvents.startDate, constructionEvents.id);

    return {
      data: events.map(e => ({
        ...e,
        startDate: e.startDate.toISOString(),
        endDate: e.endDate?.toISOString(),
      })),
    };
  });

  // POST /assets - Create new road asset
  app.post('/', {
    schema: {
      body: CreateAssetSchema,
      response: {
        201: Type.Object({ data: AssetSchema }),
      },
    },
  }, async (request, reply) => {
    const body = request.body;
    const id = `RA-${nanoid(8)}`;
    const now = new Date();

    // Use raw SQL for geometry insert
    await db.execute(sql`
      INSERT INTO road_assets (
        id, name, geometry, road_type, lanes, direction,
        status, valid_from, owner_department, ward, landmark, updated_at
      ) VALUES (
        ${id}, ${body.name}, ${toGeomSql(body.geometry)}, ${body.roadType},
        ${body.lanes}, ${body.direction}, 'active', ${now},
        ${body.ownerDepartment ?? null}, ${body.ward ?? null},
        ${body.landmark ?? null}, ${now}
      )
    `);

    // Create RoadAssetChange if eventId provided (for traceability)
    if (body.eventId) {
      await db.execute(sql`
        INSERT INTO road_asset_changes (
          id, event_id, change_type, new_road_asset_id, geometry, created_at
        ) VALUES (
          ${`RAC-${nanoid(8)}`}, ${body.eventId}, 'create', ${id},
          ${toGeomSql(body.geometry)}, ${now}
        )
      `);

      // Add event-asset relation for Road Update Mode tracking
      await db.execute(sql`
        INSERT INTO event_road_assets (event_id, road_asset_id, relation_type, created_at)
        VALUES (${body.eventId}, ${id}, 'updated', ${now})
        ON CONFLICT (event_id, road_asset_id) DO UPDATE SET relation_type = 'updated'
      `);
    }

    return reply.status(201).send({
      data: {
        id,
        name: body.name,
        geometry: body.geometry,
        roadType: body.roadType,
        lanes: body.lanes,
        direction: body.direction,
        status: 'active' as const,
        validFrom: now.toISOString(),
        validTo: undefined,
        replacedBy: undefined,
        ownerDepartment: body.ownerDepartment,
        ward: body.ward,
        landmark: body.landmark,
        updatedAt: now.toISOString(),
      },
    });
  });

  // PUT /assets/:id - Update asset
  app.put('/:id', {
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      body: Type.Intersect([UpdateAssetSchema, Type.Object({ eventId: Type.Optional(Type.String()) })]),
      response: {
        200: Type.Object({ data: AssetSchema }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const body = request.body;

    // Check if asset exists (no geometry needed for existence check)
    const existingAssets = await db.select({ id: roadAssets.id }).from(roadAssets).where(eq(roadAssets.id, id));

    if (existingAssets.length === 0) {
      return reply.status(404).send({ error: 'Asset not found' });
    }

    const now = new Date();

    // Handle geometry update separately with raw SQL
    if (body.geometry) {
      await db.execute(sql`
        UPDATE road_assets
        SET geometry = ${toGeomSql(body.geometry)}, updated_at = ${now}
        WHERE id = ${id}
      `);
    }

    // Handle non-geometry updates with Drizzle
    const updates: Record<string, unknown> = { updatedAt: now };
    if (body.name) updates.name = body.name;
    if (body.roadType) updates.roadType = body.roadType;
    if (body.lanes !== undefined) updates.lanes = body.lanes;
    if (body.direction) updates.direction = body.direction;
    if (body.ownerDepartment) updates.ownerDepartment = body.ownerDepartment;
    if (body.ward) updates.ward = body.ward;
    if (body.landmark) updates.landmark = body.landmark;

    // Only run non-geometry update if there are non-geometry fields
    const hasNonGeomUpdates = Object.keys(updates).length > 1;
    if (hasNonGeomUpdates || !body.geometry) {
      await db.update(roadAssets).set(updates).where(eq(roadAssets.id, id));
    }

    // Create RoadAssetChange if eventId provided (for traceability)
    if (body.eventId) {
      // Use the provided geometry or fetch current geometry
      const changeGeom = body.geometry ?? null;
      if (changeGeom) {
        await db.execute(sql`
          INSERT INTO road_asset_changes (
            id, event_id, change_type, old_road_asset_id, new_road_asset_id, geometry, created_at
          ) VALUES (
            ${`RAC-${nanoid(8)}`}, ${body.eventId}, 'update', ${id}, ${id},
            ${toGeomSql(changeGeom)}, ${now}
          )
        `);
      } else {
        // Copy geometry from asset if not provided in body
        await db.execute(sql`
          INSERT INTO road_asset_changes (
            id, event_id, change_type, old_road_asset_id, new_road_asset_id, geometry, created_at
          )
          SELECT ${`RAC-${nanoid(8)}`}, ${body.eventId}, 'update', ${id}, ${id}, geometry, ${now}
          FROM road_assets WHERE id = ${id}
        `);
      }

      // Add event-asset relation for Road Update Mode tracking
      await db.execute(sql`
        INSERT INTO event_road_assets (event_id, road_asset_id, relation_type, created_at)
        VALUES (${body.eventId}, ${id}, 'updated', ${now})
        ON CONFLICT (event_id, road_asset_id) DO UPDATE SET relation_type = 'updated'
      `);
    }

    // Fetch updated asset with geometry conversion
    const assetSelect = {
      id: roadAssets.id,
      name: roadAssets.name,
      nameJa: roadAssets.nameJa,
      ref: roadAssets.ref,
      localRef: roadAssets.localRef,
      displayName: roadAssets.displayName,
      nameSource: roadAssets.nameSource,
      nameConfidence: roadAssets.nameConfidence,
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

    const updatedAssets = await db.select(assetSelect).from(roadAssets).where(eq(roadAssets.id, id));
    const asset = updatedAssets[0];

    return {
      data: {
        ...asset,
        validFrom: asset.validFrom.toISOString(),
        validTo: asset.validTo?.toISOString(),
        updatedAt: asset.updatedAt.toISOString(),
      },
    };
  });

  // PATCH /assets/:id/retire - Retire asset
  app.patch('/:id/retire', {
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      body: RetireAssetSchema,
      response: {
        200: Type.Object({ data: AssetSchema }),
        404: Type.Object({ error: Type.String() }),
        400: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { eventId, replacedBy } = request.body;

    // Check current status (no geometry needed for validation)
    const existingAssets = await db.select({ id: roadAssets.id, status: roadAssets.status })
      .from(roadAssets).where(eq(roadAssets.id, id));

    if (existingAssets.length === 0) {
      return reply.status(404).send({ error: 'Asset not found' });
    }

    const currentAsset = existingAssets[0];

    if (currentAsset.status === 'inactive') {
      return reply.status(400).send({ error: 'Asset is already retired' });
    }

    const now = new Date();

    await db.update(roadAssets).set({
      status: 'inactive',
      validTo: now,
      replacedBy: replacedBy,
      updatedAt: now,
    }).where(eq(roadAssets.id, id));

    // Create RoadAssetChange for traceability - copy geometry from asset
    await db.execute(sql`
      INSERT INTO road_asset_changes (
        id, event_id, change_type, old_road_asset_id, new_road_asset_id, geometry, created_at
      )
      SELECT ${`RAC-${nanoid(8)}`}, ${eventId}, 'retire', ${id}, ${replacedBy ?? null}, geometry, ${now}
      FROM road_assets WHERE id = ${id}
    `);

    // Add event-asset relation for Road Update Mode tracking
    await db.execute(sql`
      INSERT INTO event_road_assets (event_id, road_asset_id, relation_type, created_at)
      VALUES (${eventId}, ${id}, 'updated', ${now})
      ON CONFLICT (event_id, road_asset_id) DO UPDATE SET relation_type = 'updated'
    `);

    // Fetch updated asset with geometry conversion
    const assetSelect = {
      id: roadAssets.id,
      name: roadAssets.name,
      nameJa: roadAssets.nameJa,
      ref: roadAssets.ref,
      localRef: roadAssets.localRef,
      displayName: roadAssets.displayName,
      nameSource: roadAssets.nameSource,
      nameConfidence: roadAssets.nameConfidence,
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

    const updatedAssets = await db.select(assetSelect).from(roadAssets).where(eq(roadAssets.id, id));
    const asset = updatedAssets[0];

    return {
      data: {
        ...asset,
        validFrom: asset.validFrom.toISOString(),
        validTo: asset.validTo?.toISOString(),
        updatedAt: asset.updatedAt.toISOString(),
      },
    };
  });

  // PATCH /api/assets/:id/name - Manual naming for unnamed roads
  app.patch<{ Params: { id: string }; Body: { displayName: string } }>(
    '/:id/name',
    {
      schema: {
        params: Type.Object({ id: Type.String() }),
        body: Type.Object({ displayName: Type.String({ minLength: 1 }) }),
        response: {
          200: Type.Object({
            data: AssetSchema,
          }),
          400: Type.Object({ error: Type.String() }),
          404: Type.Object({ error: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const displayName = request.body.displayName.trim();

      if (!displayName) {
        return reply.status(400).send({ error: 'displayName cannot be empty' });
      }

      // Check if asset exists
      const existing = await db
        .select({ id: roadAssets.id })
        .from(roadAssets)
        .where(eq(roadAssets.id, id))
        .limit(1);

      if (existing.length === 0) {
        return reply.status(404).send({ error: 'Asset not found' });
      }

      // Update with manual source
      await db
        .update(roadAssets)
        .set({
          displayName,
          nameSource: 'manual',
          nameConfidence: 'high',
        })
        .where(eq(roadAssets.id, id));

      // Fetch updated asset with geometry conversion
      const assetSelect = {
        id: roadAssets.id,
        name: roadAssets.name,
        nameJa: roadAssets.nameJa,
        ref: roadAssets.ref,
        localRef: roadAssets.localRef,
        displayName: roadAssets.displayName,
        nameSource: roadAssets.nameSource,
        nameConfidence: roadAssets.nameConfidence,
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

      const updatedAssets = await db.select(assetSelect).from(roadAssets).where(eq(roadAssets.id, id));
      const asset = updatedAssets[0];

      return {
        data: {
          ...asset,
          validFrom: asset.validFrom.toISOString(),
          validTo: asset.validTo?.toISOString(),
          updatedAt: asset.updatedAt.toISOString(),
        },
      };
    }
  );

  // POST /api/assets/:id/lookup-google-name - Lookup road name from Google Maps
  app.post<{ Params: { id: string } }>(
    '/:id/lookup-google-name',
    {
      schema: {
        params: Type.Object({ id: Type.String() }),
        response: {
          200: Type.Object({
            data: Type.Object({
              roadName: Type.Union([Type.String(), Type.Null()]),
              formattedAddress: Type.Union([Type.String(), Type.Null()]),
              placeId: Type.Union([Type.String(), Type.Null()]),
            }),
          }),
          400: Type.Object({ error: Type.String() }),
          404: Type.Object({ error: Type.String() }),
          503: Type.Object({ error: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      // Check if Google Maps is configured
      if (!isGoogleMapsConfigured()) {
        return reply.status(503).send({
          error: 'Google Maps API is not configured. Set GOOGLE_MAPS_API_KEY environment variable.',
        });
      }

      const { id } = request.params;

      // Get asset with geometry
      const assetResult = await db.execute(sql`
        SELECT id, ST_AsGeoJSON(geometry)::json as geometry
        FROM road_assets
        WHERE id = ${id}
      `);

      if (assetResult.rows.length === 0) {
        return reply.status(404).send({ error: 'Asset not found' });
      }

      const asset = assetResult.rows[0] as { id: string; geometry: { type: string; coordinates: unknown } };

      if (!asset.geometry || asset.geometry.type !== 'LineString') {
        return reply.status(400).send({ error: 'Asset geometry must be a LineString' });
      }

      try {
        const result = await getRoadNameForLineString(
          asset.geometry.coordinates as [number, number][]
        );

        return {
          data: result,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(400).send({ error: `Google Maps lookup failed: ${message}` });
      }
    }
  );

  // POST /api/assets/:id/apply-google-name - Lookup and apply road name from Google Maps
  app.post<{ Params: { id: string } }>(
    '/:id/apply-google-name',
    {
      schema: {
        params: Type.Object({ id: Type.String() }),
        response: {
          200: Type.Object({
            data: AssetSchema,
          }),
          400: Type.Object({ error: Type.String() }),
          404: Type.Object({ error: Type.String() }),
          503: Type.Object({ error: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      // Check if Google Maps is configured
      if (!isGoogleMapsConfigured()) {
        return reply.status(503).send({
          error: 'Google Maps API is not configured. Set GOOGLE_MAPS_API_KEY environment variable.',
        });
      }

      const { id } = request.params;

      // Get asset with geometry
      const assetResult = await db.execute(sql`
        SELECT id, ST_AsGeoJSON(geometry)::json as geometry
        FROM road_assets
        WHERE id = ${id}
      `);

      if (assetResult.rows.length === 0) {
        return reply.status(404).send({ error: 'Asset not found' });
      }

      const asset = assetResult.rows[0] as { id: string; geometry: { type: string; coordinates: unknown } };

      if (!asset.geometry || asset.geometry.type !== 'LineString') {
        return reply.status(400).send({ error: 'Asset geometry must be a LineString' });
      }

      try {
        const result = await getRoadNameForLineString(
          asset.geometry.coordinates as [number, number][]
        );

        if (!result.roadName) {
          return reply.status(400).send({ error: 'No road name found from Google Maps' });
        }

        // Update the asset with Google Maps name
        await db
          .update(roadAssets)
          .set({
            displayName: result.roadName,
            nameSource: 'google',
            nameConfidence: 'medium',
            updatedAt: new Date(),
          })
          .where(eq(roadAssets.id, id));

        // Fetch updated asset
        const assetSelect = {
          id: roadAssets.id,
          name: roadAssets.name,
          nameJa: roadAssets.nameJa,
          ref: roadAssets.ref,
          localRef: roadAssets.localRef,
          displayName: roadAssets.displayName,
          nameSource: roadAssets.nameSource,
          nameConfidence: roadAssets.nameConfidence,
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

        const updatedAssets = await db.select(assetSelect).from(roadAssets).where(eq(roadAssets.id, id));
        const updatedAsset = updatedAssets[0];

        return {
          data: {
            ...updatedAsset,
            validFrom: updatedAsset.validFrom.toISOString(),
            validTo: updatedAsset.validTo?.toISOString(),
            updatedAt: updatedAsset.updatedAt.toISOString(),
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(400).send({ error: `Google Maps lookup failed: ${message}` });
      }
    }
  );
}

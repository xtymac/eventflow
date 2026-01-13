import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { db } from '../db/index.js';
import { roadAssets, roadAssetChanges, constructionEvents, eventRoadAssets } from '../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { toGeomSql, toGeomSqlNullable, fromGeomSql } from '../db/geometry.js';
import { getRoadNameForLineString, isGoogleMapsConfigured } from '../services/google-maps.js';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Regenerate PMTiles in the background
// Runs: export-road-assets.ts then tiles:generate
function regenerateTilesInBackground(): void {
  const projectRoot = join(__dirname, '../../..');

  console.log('[TileRefresh] Starting background tile regeneration...');

  // Run export script first, then generate tiles
  const exportProcess = spawn('npx', ['tsx', 'scripts/export-road-assets.ts'], {
    cwd: projectRoot,
    stdio: 'pipe',
    shell: true,
  });

  exportProcess.stdout?.on('data', (data) => {
    console.log(`[TileRefresh/Export] ${data.toString().trim()}`);
  });

  exportProcess.stderr?.on('data', (data) => {
    console.error(`[TileRefresh/Export] ${data.toString().trim()}`);
  });

  exportProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`[TileRefresh] Export failed with code ${code}`);
      return;
    }

    console.log('[TileRefresh] Export complete, generating PMTiles...');

    // Now run tiles:generate
    const tilesProcess = spawn('npm', ['run', 'tiles:generate'], {
      cwd: projectRoot,
      stdio: 'pipe',
      shell: true,
    });

    tilesProcess.stdout?.on('data', (data) => {
      console.log(`[TileRefresh/Tiles] ${data.toString().trim()}`);
    });

    tilesProcess.stderr?.on('data', (data) => {
      console.error(`[TileRefresh/Tiles] ${data.toString().trim()}`);
    });

    tilesProcess.on('close', (tilesCode) => {
      if (tilesCode === 0) {
        console.log('[TileRefresh] PMTiles regeneration complete!');
      } else {
        console.error(`[TileRefresh] PMTiles generation failed with code ${tilesCode}`);
      }
    });
  });
}

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
  name: Type.Union([Type.String(), Type.Null()]),           // Nullable - no placeholder for unnamed
  nameJa: Type.Union([Type.String(), Type.Null()]),         // Japanese name from OSM
  ref: Type.Union([Type.String(), Type.Null()]),            // Route reference
  localRef: Type.Union([Type.String(), Type.Null()]),       // Local reference code
  displayName: Type.Union([Type.String(), Type.Null()]),    // Computed fallback for display
  nameSource: Type.Union([Type.String(), Type.Null()]),     // Source of name: osm, municipal, manual
  nameConfidence: Type.Union([Type.String(), Type.Null()]), // Match confidence: high, medium, low
  geometry: GeometrySchema,
  roadType: Type.String(),
  lanes: Type.Number(),
  direction: Type.String(),
  status: Type.Union([Type.Literal('active'), Type.Literal('inactive')]),
  validFrom: Type.String({ format: 'date-time' }),
  validTo: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  replacedBy: Type.Union([Type.String(), Type.Null()]),
  ownerDepartment: Type.Union([Type.String(), Type.Null()]),
  ward: Type.Union([Type.String(), Type.Null()]),
  landmark: Type.Union([Type.String(), Type.Null()]),
  sublocality: Type.Union([Type.String(), Type.Null()]),    // 町名/丁目 from Google Maps
  // Road polygon-specific fields
  crossSection: Type.Union([Type.String(), Type.Null()]),
  managingDept: Type.Union([Type.String(), Type.Null()]),
  intersection: Type.Union([Type.String(), Type.Null()]),
  pavementState: Type.Union([Type.String(), Type.Null()]),
  // Data source tracking fields
  dataSource: Type.Union([Type.Literal('osm_test'), Type.Literal('official_ledger'), Type.Literal('manual')]),
  sourceVersion: Type.Union([Type.String(), Type.Null()]),
  sourceDate: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  lastVerifiedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
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
  // Road polygon-specific fields (all optional)
  crossSection: Type.Optional(Type.String()),
  managingDept: Type.Optional(Type.String()),
  intersection: Type.Optional(Type.String()),
  pavementState: Type.Optional(Type.String()),
  // Data source tracking fields
  dataSource: Type.Optional(Type.Union([Type.Literal('osm_test'), Type.Literal('official_ledger'), Type.Literal('manual')])),
  sourceVersion: Type.Optional(Type.String()),
  sourceDate: Type.Optional(Type.String({ format: 'date-time' })),
  lastVerifiedAt: Type.Optional(Type.String({ format: 'date-time' })),
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

  // GET /assets/recent-edits - Get recent road asset edits for notification bar
  app.get('/recent-edits', {
    schema: {
      querystring: Type.Object({
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(Type.Object({
            id: Type.String(),
            roadAssetId: Type.String(),
            editType: Type.String(),
            roadName: Type.Union([Type.String(), Type.Null()]),
            roadDisplayName: Type.Union([Type.String(), Type.Null()]),
            roadWard: Type.Union([Type.String(), Type.Null()]),
            roadType: Type.Union([Type.String(), Type.Null()]),
            centroid: Type.Object({
              type: Type.Literal('Point'),
              coordinates: Type.Array(Type.Number()),
            }),
            bbox: Type.Array(Type.Number()),
            editSource: Type.Union([Type.String(), Type.Null()]),
            editedAt: Type.String({ format: 'date-time' }),
          })),
          meta: Type.Object({
            total: Type.Integer(),
            hasMore: Type.Boolean(),
          }),
        }),
      },
    },
  }, async (request) => {
    const { limit = 10 } = request.query;

    // Get total count of manual edits
    const countResult = await db.execute<{ total: number }>(sql`
      SELECT COUNT(*)::int as total FROM road_asset_edit_logs
      WHERE edit_source IN ('manual', 'initial', '')
         OR edit_source IS NULL
    `);
    const total = countResult.rows[0]?.total ?? 0;

    // Get recent edits with DISTINCT ON to avoid duplicates for same road
    // Filter for manual/QGIS edits only (exclude osm-sync and api)
    const editsResult = await db.execute(sql`
      SELECT DISTINCT ON (road_asset_id)
        id,
        road_asset_id as "roadAssetId",
        edit_type as "editType",
        road_name as "roadName",
        road_display_name as "roadDisplayName",
        road_ward as "roadWard",
        road_type as "roadType",
        ST_AsGeoJSON(centroid)::json as centroid,
        bbox,
        edit_source as "editSource",
        edited_at as "editedAt"
      FROM road_asset_edit_logs
      WHERE edit_source IN ('manual', 'initial', '')
         OR edit_source IS NULL
      ORDER BY road_asset_id, edited_at DESC
    `);

    // Define the expected row type
    interface EditLogRow {
      id: string;
      roadAssetId: string;
      editType: string;
      roadName: string | null;
      roadDisplayName: string | null;
      roadWard: string | null;
      roadType: string | null;
      centroid: { type: 'Point'; coordinates: number[] };
      bbox: number[];
      editSource: string | null;
      editedAt: Date | string;
    }

    // Sort by editedAt DESC and apply limit
    const typedRows = editsResult.rows as unknown as EditLogRow[];
    const sortedEdits = typedRows
      .sort((a, b) =>
        new Date(b.editedAt).getTime() - new Date(a.editedAt).getTime()
      )
      .slice(0, limit + 1);

    const hasMore = sortedEdits.length > limit;
    const data = sortedEdits.slice(0, limit).map((row) => ({
      id: row.id,
      roadAssetId: row.roadAssetId,
      editType: row.editType,
      roadName: row.roadName,
      roadDisplayName: row.roadDisplayName,
      roadWard: row.roadWard,
      roadType: row.roadType,
      centroid: row.centroid,
      bbox: row.bbox,
      editSource: row.editSource,
      editedAt: row.editedAt instanceof Date ? row.editedAt.toISOString() : String(row.editedAt),
    }));

    return {
      data,
      meta: { total, hasMore },
    };
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
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 10000 })),
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
    // Higher limits for viewport-based loading at low zoom (dense areas need more assets)
    const MAX_LIMIT = 10000;
    const limit = Math.min(request.query.limit ?? 200, MAX_LIMIT);
    const offset = request.query.offset ?? 0;
    // Boolean from querystring - TypeBox coerces to boolean, but handle string edge case
    const includeTotal = request.query.includeTotal !== false && String(request.query.includeTotal) !== 'false';

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
        CASE WHEN geometry_polygon IS NULL THEN NULL ELSE ST_AsGeoJSON(geometry_polygon)::json END as geometry,
        road_type as "roadType", lanes, direction, status,
        valid_from as "validFrom", valid_to as "validTo",
        replaced_by as "replacedBy", owner_department as "ownerDepartment",
        ward, landmark, sublocality,
        cross_section as "crossSection",
        managing_dept as "managingDept",
        intersection,
        pavement_state as "pavementState",
        data_source as "dataSource",
        source_version as "sourceVersion",
        source_date as "sourceDate",
        last_verified_at as "lastVerifiedAt",
        updated_at as "updatedAt"
      FROM road_assets
      ${whereClause}
      ORDER BY id
      LIMIT ${limit} OFFSET ${offset}
    `);

    // Format timestamps (raw SQL returns Date objects for timestamp columns)
    // Cast to expected shape for TypeBox response validation
    type RawAssetRow = {
      id: string;
      name: string | null;
      nameJa: string | null;
      ref: string | null;
      localRef: string | null;
      displayName: string | null;
      nameSource: string | null;
      nameConfidence: string | null;
      geometry: { type: string; coordinates: unknown };
      roadType: string;
      lanes: number;
      direction: string;
      status: 'active' | 'inactive';
      validFrom: Date | string;
      validTo: Date | string | null;
      replacedBy: string | null;
      ownerDepartment: string | null;
      ward: string | null;
      landmark: string | null;
      sublocality: string | null;
      crossSection: string | null;
      managingDept: string | null;
      intersection: string | null;
      pavementState: string | null;
      dataSource: 'osm_test' | 'official_ledger' | 'manual';
      sourceVersion: string | null;
      sourceDate: Date | string | null;
      lastVerifiedAt: Date | string | null;
      updatedAt: Date | string;
    };

    const assets = (assetsResult.rows as RawAssetRow[]).map((a) => ({
      ...a,
      validFrom: a.validFrom instanceof Date ? a.validFrom.toISOString() : String(a.validFrom),
      validTo: a.validTo instanceof Date ? a.validTo.toISOString() : a.validTo ? String(a.validTo) : null,
      sourceDate: a.sourceDate instanceof Date ? a.sourceDate.toISOString() : a.sourceDate ? String(a.sourceDate) : null,
      lastVerifiedAt: a.lastVerifiedAt instanceof Date ? a.lastVerifiedAt.toISOString() : a.lastVerifiedAt ? String(a.lastVerifiedAt) : null,
      updatedAt: a.updatedAt instanceof Date ? a.updatedAt.toISOString() : String(a.updatedAt),
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
      geometry: fromGeomSql(roadAssets.geometryPolygon),
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
      crossSection: roadAssets.crossSection,
      managingDept: roadAssets.managingDept,
      intersection: roadAssets.intersection,
      pavementState: roadAssets.pavementState,
      dataSource: roadAssets.dataSource,
      sourceVersion: roadAssets.sourceVersion,
      sourceDate: roadAssets.sourceDate,
      lastVerifiedAt: roadAssets.lastVerifiedAt,
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
    // Set isManuallyEdited=true to protect from OSM sync overwrites
    await db.execute(sql`
      INSERT INTO road_assets (
        id, name, geometry, road_type, lanes, direction,
        status, valid_from, owner_department, ward, landmark,
        cross_section, managing_dept, intersection, pavement_state,
        data_source, source_version, source_date, last_verified_at,
        updated_at, sync_source, is_manually_edited
      ) VALUES (
        ${id}, ${body.name ?? null}, ${toGeomSql(body.geometry)}, ${body.roadType},
        ${body.lanes}, ${body.direction}, 'active', ${now},
        ${body.ownerDepartment ?? null}, ${body.ward ?? null},
        ${body.landmark ?? null},
        ${body.crossSection ?? null}, ${body.managingDept ?? null},
        ${body.intersection ?? null}, ${body.pavementState ?? null},
        ${body.dataSource ?? 'manual'}, ${body.sourceVersion ?? null},
        ${body.sourceDate ? new Date(body.sourceDate) : null},
        ${body.lastVerifiedAt ? new Date(body.lastVerifiedAt) : null},
        ${now}, 'manual', true
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
        name: body.name ?? null,
        nameJa: null,
        ref: null,
        localRef: null,
        displayName: body.name ?? null,
        nameSource: null,
        nameConfidence: null,
        geometry: body.geometry,
        roadType: body.roadType,
        lanes: body.lanes,
        direction: body.direction,
        status: 'active' as const,
        validFrom: now.toISOString(),
        validTo: null,
        replacedBy: null,
        ownerDepartment: body.ownerDepartment ?? null,
        ward: body.ward ?? null,
        landmark: body.landmark ?? null,
        sublocality: null,
        crossSection: body.crossSection ?? null,
        managingDept: body.managingDept ?? null,
        intersection: body.intersection ?? null,
        pavementState: body.pavementState ?? null,
        dataSource: body.dataSource ?? 'manual',
        sourceVersion: body.sourceVersion ?? null,
        sourceDate: body.sourceDate ?? null,
        lastVerifiedAt: body.lastVerifiedAt ?? null,
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
    // Also set isManuallyEdited=true to protect from OSM sync overwrites
    if (body.geometry) {
      await db.execute(sql`
        UPDATE road_assets
        SET geometry = ${toGeomSql(body.geometry)}, updated_at = ${now},
            is_manually_edited = true, sync_source = 'manual'
        WHERE id = ${id}
      `);
    }

    // Handle non-geometry updates with Drizzle
    // Set isManuallyEdited=true for any manual update
    const updates: Record<string, unknown> = { updatedAt: now, isManuallyEdited: true, syncSource: 'manual' };
    if (body.name !== undefined) updates.name = body.name;
    if (body.roadType) updates.roadType = body.roadType;
    if (body.lanes !== undefined) updates.lanes = body.lanes;
    if (body.direction) updates.direction = body.direction;
    if (body.ownerDepartment !== undefined) updates.ownerDepartment = body.ownerDepartment;
    if (body.ward !== undefined) updates.ward = body.ward;
    if (body.landmark !== undefined) updates.landmark = body.landmark;

    // Road polygon-specific fields
    if (body.crossSection !== undefined) updates.crossSection = body.crossSection;
    if (body.managingDept !== undefined) updates.managingDept = body.managingDept;
    if (body.intersection !== undefined) updates.intersection = body.intersection;
    if (body.pavementState !== undefined) updates.pavementState = body.pavementState;

    // Data source tracking fields
    if (body.dataSource !== undefined) updates.dataSource = body.dataSource;
    if (body.sourceVersion !== undefined) updates.sourceVersion = body.sourceVersion;
    if (body.sourceDate !== undefined) updates.sourceDate = body.sourceDate ? new Date(body.sourceDate) : null;
    if (body.lastVerifiedAt !== undefined) updates.lastVerifiedAt = body.lastVerifiedAt ? new Date(body.lastVerifiedAt) : null;

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
      geometry: fromGeomSql(roadAssets.geometryPolygon),
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
      crossSection: roadAssets.crossSection,
      managingDept: roadAssets.managingDept,
      intersection: roadAssets.intersection,
      pavementState: roadAssets.pavementState,
      dataSource: roadAssets.dataSource,
      sourceVersion: roadAssets.sourceVersion,
      sourceDate: roadAssets.sourceDate,
      lastVerifiedAt: roadAssets.lastVerifiedAt,
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
      geometry: fromGeomSql(roadAssets.geometryPolygon),
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
      crossSection: roadAssets.crossSection,
      managingDept: roadAssets.managingDept,
      intersection: roadAssets.intersection,
      pavementState: roadAssets.pavementState,
      dataSource: roadAssets.dataSource,
      sourceVersion: roadAssets.sourceVersion,
      sourceDate: roadAssets.sourceDate,
      lastVerifiedAt: roadAssets.lastVerifiedAt,
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
      // Set isManuallyEdited=true to protect from OSM sync overwrites
      await db
        .update(roadAssets)
        .set({
          displayName,
          nameSource: 'manual',
          nameConfidence: 'high',
          isManuallyEdited: true,
          syncSource: 'manual',
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
        geometry: fromGeomSql(roadAssets.geometryPolygon),
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
        // Set isManuallyEdited=true since user initiated this lookup
        await db
          .update(roadAssets)
          .set({
            displayName: result.roadName,
            nameSource: 'google',
            nameConfidence: 'medium',
            updatedAt: new Date(),
            isManuallyEdited: true,
            syncSource: 'manual',
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
          geometry: fromGeomSql(roadAssets.geometryPolygon),
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

  // DELETE /assets/bulk - Bulk delete assets by bbox or IDs
  // Used for cleaning up QGIS leftovers or incorrect data
  app.delete('/bulk', {
    schema: {
      querystring: Type.Object({
        bbox: Type.Optional(Type.String()), // "minLng,minLat,maxLng,maxLat"
        ids: Type.Optional(Type.String()),  // Comma-separated IDs
        dryRun: Type.Optional(Type.Boolean({ default: true })), // Preview mode by default
        refreshTiles: Type.Optional(Type.Boolean({ default: true })), // Auto-regenerate PMTiles
      }),
      response: {
        200: Type.Object({
          dryRun: Type.Boolean(),
          deletedCount: Type.Integer(),
          deletedIds: Type.Array(Type.String()),
          message: Type.String(),
          tilesRefreshing: Type.Optional(Type.Boolean()),
        }),
        400: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { bbox, ids, dryRun = true, refreshTiles = true } = request.query;

    if (!bbox && !ids) {
      return reply.status(400).send({ error: 'Either bbox or ids parameter is required' });
    }

    const conditions: ReturnType<typeof sql>[] = [];

    // Handle bbox filter
    if (bbox) {
      const bboxParsed = parseBbox(bbox);
      if (!bboxParsed) {
        return reply.status(400).send({ error: 'Invalid bbox format. Expected: minLng,minLat,maxLng,maxLat' });
      }
      const { minLng, minLat, maxLng, maxLat } = bboxParsed;
      conditions.push(sql`ST_Intersects(geometry, ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326))`);
    }

    // Handle IDs filter
    if (ids) {
      const idList = ids.split(',').map(id => id.trim()).filter(Boolean);
      if (idList.length === 0) {
        return reply.status(400).send({ error: 'No valid IDs provided' });
      }
      conditions.push(sql`id IN (${sql.join(idList.map(id => sql`${id}`), sql`, `)})`);
    }

    const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

    // First, get the IDs that will be deleted
    const selectResult = await db.execute<{ id: string }>(sql`
      SELECT id FROM road_assets ${whereClause}
    `);
    const deletedIds = selectResult.rows.map(r => r.id);

    if (dryRun) {
      return {
        dryRun: true,
        deletedCount: deletedIds.length,
        deletedIds,
        message: `Dry run: ${deletedIds.length} assets would be deleted. Set dryRun=false to execute.`,
      };
    }

    // Actually delete the assets
    // First, remove from event_road_assets to avoid FK constraint errors
    if (deletedIds.length > 0) {
      await db.execute(sql`
        DELETE FROM event_road_assets
        WHERE road_asset_id IN (${sql.join(deletedIds.map(id => sql`${id}`), sql`, `)})
      `);

      // Delete the road assets
      await db.execute(sql`
        DELETE FROM road_assets ${whereClause}
      `);
    }

    // Trigger tile refresh in background if requested
    const shouldRefreshTiles = refreshTiles && deletedIds.length > 0;
    if (shouldRefreshTiles) {
      regenerateTilesInBackground();
    }

    return {
      dryRun: false,
      deletedCount: deletedIds.length,
      deletedIds,
      message: shouldRefreshTiles
        ? `Successfully deleted ${deletedIds.length} assets. Martin tiles updated immediately. PMTiles refreshing in background (~1 min).`
        : `Successfully deleted ${deletedIds.length} assets. Martin tiles updated immediately. PMTiles not refreshed (refreshTiles=false).`,
      tilesRefreshing: shouldRefreshTiles,
    };
  });
}

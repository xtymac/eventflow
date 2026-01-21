import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { db } from '../db/index.js';
import { greenSpaceAssets } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { fromGeomSql } from '../db/geometry.js';

// BBOX validation helper
function parseBbox(bbox: string): { minLng: number; minLat: number; maxLng: number; maxLat: number } | null {
  const parts = bbox.split(',').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return null;
  const [minLng, minLat, maxLng, maxLat] = parts;
  if (minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90) return null;
  if (minLng > maxLng || minLat > maxLat) return null;
  return { minLng, minLat, maxLng, maxLat };
}

// Get simplification tolerance based on zoom level
function getSimplifyTolerance(zoom: number): number {
  if (zoom >= 16) return 0; // No simplification at high zoom
  if (zoom >= 14) return 0.00005; // ~5m
  if (zoom >= 12) return 0.0002; // ~20m
  return 0.001; // ~100m for lower zoom
}

// TypeBox schemas
const GeometrySchema = Type.Object({
  type: Type.String(),
  coordinates: Type.Any(),
});

const GreenSpaceAssetSchema = Type.Object({
  id: Type.String(),
  name: Type.Union([Type.String(), Type.Null()]),
  nameJa: Type.Union([Type.String(), Type.Null()]),
  displayName: Type.Union([Type.String(), Type.Null()]),
  geometry: GeometrySchema,
  greenSpaceType: Type.String(),
  leisureType: Type.Union([Type.String(), Type.Null()]),
  landuseType: Type.Union([Type.String(), Type.Null()]),
  naturalType: Type.Union([Type.String(), Type.Null()]),
  areaM2: Type.Union([Type.Number(), Type.Null()]),
  vegetationType: Type.Union([Type.String(), Type.Null()]),
  operator: Type.Union([Type.String(), Type.Null()]),
  dataSource: Type.Union([Type.String(), Type.Null()]),
  osmType: Type.Union([Type.String(), Type.Null()]),
  osmId: Type.Union([Type.String(), Type.Null()]),
  status: Type.String(),
  ward: Type.Union([Type.String(), Type.Null()]),
  updatedAt: Type.String({ format: 'date-time' }),
});

export async function greenspacesRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // GET /greenspaces - List green space assets with required bbox
  app.get('/', {
    schema: {
      querystring: Type.Object({
        bbox: Type.String(), // REQUIRED: "minLng,minLat,maxLng,maxLat"
        zoom: Type.Optional(Type.Integer({ minimum: 1, maximum: 22 })), // Map zoom level for simplification
        status: Type.Optional(Type.String()),
        greenSpaceType: Type.Optional(Type.String()),
        ward: Type.Optional(Type.String()),
        dataSource: Type.Optional(Type.String()),
        minArea: Type.Optional(Type.Number()), // Filter by minimum area in m²
        q: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000 })),
        offset: Type.Optional(Type.Integer({ minimum: 0 })),
        includeTotal: Type.Optional(Type.Boolean()),
      }),
      response: {
        200: Type.Object({
          type: Type.Literal('FeatureCollection'),
          features: Type.Array(Type.Object({
            type: Type.Literal('Feature'),
            properties: Type.Omit(GreenSpaceAssetSchema, ['geometry']),
            geometry: GeometrySchema,
          })),
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
    const { bbox, zoom, status, greenSpaceType, ward, dataSource, minArea, q } = request.query;
    const limit = Math.min(request.query.limit ?? 200, 1000);
    const offset = request.query.offset ?? 0;
    const includeTotal = request.query.includeTotal !== false;

    // Validate bbox (required)
    const bboxParsed = parseBbox(bbox);
    if (!bboxParsed) {
      return reply.status(400).send({ error: 'Invalid bbox format. Expected: minLng,minLat,maxLng,maxLat' });
    }

    const { minLng, minLat, maxLng, maxLat } = bboxParsed;

    // Calculate simplification tolerance based on zoom
    const simplifyTolerance = getSimplifyTolerance(zoom ?? 14);

    // Build WHERE conditions
    const conditions: ReturnType<typeof sql>[] = [
      sql`ST_Intersects(geometry, ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326))`,
    ];

    if (status) conditions.push(sql`status = ${status}`);
    if (greenSpaceType) {
      const types = greenSpaceType.split(',').map(t => t.trim());
      if (types.length === 1) {
        conditions.push(sql`green_space_type = ${types[0]}`);
      } else {
        conditions.push(sql`green_space_type IN (${sql.join(types.map(t => sql`${t}`), sql`, `)})`);
      }
    }
    if (ward) conditions.push(sql`ward = ${ward}`);
    if (dataSource) {
      const sources = dataSource.split(',').map(s => s.trim());
      if (sources.length === 1) {
        conditions.push(sql`data_source = ${sources[0]}`);
      } else {
        conditions.push(sql`data_source IN (${sql.join(sources.map(s => sql`${s}`), sql`, `)})`);
      }
    }
    // Filter by minimum area (useful for low zoom levels)
    if (minArea !== undefined && minArea > 0) {
      conditions.push(sql`COALESCE(area_m2, 0) >= ${minArea}`);
    }
    if (q) {
      const trimmed = q.trim();
      if (trimmed) {
        const pattern = `%${trimmed}%`;
        conditions.push(sql`(
          COALESCE(name, '') ILIKE ${pattern}
          OR COALESCE(display_name, '') ILIKE ${pattern}
          OR id ILIKE ${pattern}
        )`);
      }
    }

    const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

    // Get total count if requested
    let total: number | null = null;
    if (includeTotal) {
      const countResult = await db.execute<{ total: number }>(sql`
        SELECT COUNT(*)::int as total FROM greenspace_assets ${whereClause}
      `);
      total = countResult.rows[0]?.total ?? 0;
    }

    // Get paginated results with optional geometry simplification
    const geometryExpr = simplifyTolerance > 0
      ? sql`ST_AsGeoJSON(ST_Simplify(geometry, ${simplifyTolerance}))::json`
      : sql`ST_AsGeoJSON(geometry)::json`;

    const result = await db.execute(sql`
      SELECT
        id, name, name_ja as "nameJa", display_name as "displayName",
        ${geometryExpr} as geometry,
        green_space_type as "greenSpaceType",
        leisure_type as "leisureType", landuse_type as "landuseType",
        natural_type as "naturalType", area_m2 as "areaM2",
        vegetation_type as "vegetationType", operator,
        data_source as "dataSource", osm_type as "osmType", osm_id as "osmId",
        status, ward, updated_at as "updatedAt"
      FROM greenspace_assets
      ${whereClause}
      ORDER BY id
      LIMIT ${limit} OFFSET ${offset}
    `);

    // Convert to GeoJSON FeatureCollection
    const features = result.rows.map((row: Record<string, unknown>) => ({
      type: 'Feature' as const,
      properties: {
        id: row.id as string,
        name: row.name as string | null,
        nameJa: row.nameJa as string | null,
        displayName: row.displayName as string | null,
        greenSpaceType: row.greenSpaceType as string,
        leisureType: row.leisureType as string | null,
        landuseType: row.landuseType as string | null,
        naturalType: row.naturalType as string | null,
        areaM2: row.areaM2 as number | null,
        vegetationType: row.vegetationType as string | null,
        operator: row.operator as string | null,
        dataSource: row.dataSource as string | null,
        osmType: row.osmType as string | null,
        osmId: row.osmId as string | null,
        status: row.status as string,
        ward: row.ward as string | null,
        updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
      },
      geometry: row.geometry,
    }));

    return {
      type: 'FeatureCollection' as const,
      features,
      meta: { total, limit, offset },
    };
  });

  // GET /greenspaces/:id - Get single green space asset
  app.get('/:id', {
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      response: {
        200: Type.Object({
          type: Type.Literal('Feature'),
          properties: Type.Omit(GreenSpaceAssetSchema, ['geometry']),
          geometry: GeometrySchema,
        }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    const result = await db.execute(sql`
      SELECT
        id, name, name_ja as "nameJa", display_name as "displayName",
        ST_AsGeoJSON(geometry)::json as geometry,
        green_space_type as "greenSpaceType",
        leisure_type as "leisureType", landuse_type as "landuseType",
        natural_type as "naturalType", area_m2 as "areaM2",
        vegetation_type as "vegetationType", operator,
        data_source as "dataSource", osm_type as "osmType", osm_id as "osmId",
        status, ward, updated_at as "updatedAt"
      FROM greenspace_assets
      WHERE id = ${id}
    `);

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Green space asset not found' });
    }

    const row = result.rows[0] as Record<string, unknown>;

    return {
      type: 'Feature' as const,
      properties: {
        id: row.id as string,
        name: row.name as string | null,
        nameJa: row.nameJa as string | null,
        displayName: row.displayName as string | null,
        greenSpaceType: row.greenSpaceType as string,
        leisureType: row.leisureType as string | null,
        landuseType: row.landuseType as string | null,
        naturalType: row.naturalType as string | null,
        areaM2: row.areaM2 as number | null,
        vegetationType: row.vegetationType as string | null,
        operator: row.operator as string | null,
        dataSource: row.dataSource as string | null,
        osmType: row.osmType as string | null,
        osmId: row.osmId as string | null,
        status: row.status as string,
        ward: row.ward as string | null,
        updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
      },
      geometry: row.geometry,
    };
  });

  // GET /greenspaces/wards - Get distinct ward names for green spaces
  app.get('/wards', {
    schema: {
      response: {
        200: Type.Object({
          data: Type.Array(Type.String()),
        }),
      },
    },
  }, async () => {
    const result = await db.selectDistinct({ ward: greenSpaceAssets.ward })
      .from(greenSpaceAssets)
      .where(sql`${greenSpaceAssets.ward} IS NOT NULL`);

    const wards = result
      .map((r) => r.ward)
      .filter((w): w is string => w !== null)
      .sort();

    return { data: wards };
  });
}

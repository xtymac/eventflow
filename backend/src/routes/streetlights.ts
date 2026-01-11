import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { db } from '../db/index.js';
import { streetLightAssets } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { fromGeomSql } from '../db/geometry.js';

// Maximum bbox area in square meters (2 km²)
// Street lights are dense, so we limit the query area
const MAX_BBOX_AREA_M2 = 2_000_000;

// BBOX validation helper
function parseBbox(bbox: string): { minLng: number; minLat: number; maxLng: number; maxLat: number } | null {
  const parts = bbox.split(',').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return null;
  const [minLng, minLat, maxLng, maxLat] = parts;
  if (minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90) return null;
  if (minLng > maxLng || minLat > maxLat) return null;
  return { minLng, minLat, maxLng, maxLat };
}

// TypeBox schemas
const GeometrySchema = Type.Object({
  type: Type.Literal('Point'),
  coordinates: Type.Array(Type.Number()),
});

const StreetLightAssetSchema = Type.Object({
  id: Type.String(),
  lampId: Type.Union([Type.String(), Type.Null()]),
  displayName: Type.Union([Type.String(), Type.Null()]),
  geometry: GeometrySchema,
  lampType: Type.String(),
  wattage: Type.Union([Type.Number(), Type.Null()]),
  installDate: Type.Union([Type.String(), Type.Null()]),
  lampStatus: Type.String(),
  roadRef: Type.Union([Type.String(), Type.Null()]),
  dataSource: Type.Union([Type.String(), Type.Null()]),
  osmType: Type.Union([Type.String(), Type.Null()]),
  osmId: Type.Union([Type.String(), Type.Null()]),
  status: Type.String(),
  ward: Type.Union([Type.String(), Type.Null()]),
  updatedAt: Type.String({ format: 'date-time' }),
});

export async function streetlightsRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // GET /streetlights - List street light assets with required bbox
  app.get('/', {
    schema: {
      querystring: Type.Object({
        bbox: Type.String(), // REQUIRED: "minLng,minLat,maxLng,maxLat"
        status: Type.Optional(Type.String()),
        lampType: Type.Optional(Type.String()),
        lampStatus: Type.Optional(Type.String()),
        ward: Type.Optional(Type.String()),
        dataSource: Type.Optional(Type.String()),
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
            properties: Type.Omit(StreetLightAssetSchema, ['geometry']),
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
    const { bbox, status, lampType, lampStatus, ward, dataSource, q } = request.query;
    const limit = Math.min(request.query.limit ?? 200, 1000);
    const offset = request.query.offset ?? 0;
    const includeTotal = request.query.includeTotal !== false;

    // Validate bbox (required)
    const bboxParsed = parseBbox(bbox);
    if (!bboxParsed) {
      return reply.status(400).send({ error: 'Invalid bbox format. Expected: minLng,minLat,maxLng,maxLat' });
    }

    const { minLng, minLat, maxLng, maxLat } = bboxParsed;

    // Validate bbox area using geography for accurate meters calculation (R5)
    const areaResult = await db.execute<{ area: string }>(sql`
      SELECT ST_Area(
        ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326)::geography
      )::numeric as area
    `);
    const bboxArea = Number(areaResult.rows[0]?.area || 0);

    if (bboxArea > MAX_BBOX_AREA_M2) {
      return reply.status(400).send({
        error: `Requested area (${(bboxArea / 1_000_000).toFixed(1)}km²) exceeds maximum (${MAX_BBOX_AREA_M2 / 1_000_000}km²). Please zoom in.`,
      });
    }

    // Build WHERE conditions
    const conditions: ReturnType<typeof sql>[] = [
      sql`ST_Intersects(geometry, ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326))`,
    ];

    if (status) conditions.push(sql`status = ${status}`);
    if (lampType) {
      const types = lampType.split(',').map(t => t.trim());
      if (types.length === 1) {
        conditions.push(sql`lamp_type = ${types[0]}`);
      } else {
        conditions.push(sql`lamp_type IN (${sql.join(types.map(t => sql`${t}`), sql`, `)})`);
      }
    }
    if (lampStatus) {
      const statuses = lampStatus.split(',').map(s => s.trim());
      if (statuses.length === 1) {
        conditions.push(sql`lamp_status = ${statuses[0]}`);
      } else {
        conditions.push(sql`lamp_status IN (${sql.join(statuses.map(s => sql`${s}`), sql`, `)})`);
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
    if (q) {
      const trimmed = q.trim();
      if (trimmed) {
        const pattern = `%${trimmed}%`;
        conditions.push(sql`(
          COALESCE(lamp_id, '') ILIKE ${pattern}
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
        SELECT COUNT(*)::int as total FROM streetlight_assets ${whereClause}
      `);
      total = countResult.rows[0]?.total ?? 0;
    }

    // Get paginated results
    const result = await db.execute(sql`
      SELECT
        id, lamp_id as "lampId", display_name as "displayName",
        ST_AsGeoJSON(geometry)::json as geometry,
        lamp_type as "lampType", wattage,
        install_date as "installDate", lamp_status as "lampStatus",
        road_ref as "roadRef",
        data_source as "dataSource", osm_type as "osmType", osm_id as "osmId",
        status, ward, updated_at as "updatedAt"
      FROM streetlight_assets
      ${whereClause}
      ORDER BY id
      LIMIT ${limit} OFFSET ${offset}
    `);

    // Convert to GeoJSON FeatureCollection
    const features = result.rows.map((row: Record<string, unknown>) => ({
      type: 'Feature' as const,
      properties: {
        id: row.id as string,
        lampId: row.lampId as string | null,
        displayName: row.displayName as string | null,
        lampType: row.lampType as string,
        wattage: row.wattage as number | null,
        installDate: row.installDate instanceof Date
          ? row.installDate.toISOString().split('T')[0]
          : row.installDate as string | null,
        lampStatus: row.lampStatus as string,
        roadRef: row.roadRef as string | null,
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

  // GET /streetlights/:id - Get single street light asset
  app.get('/:id', {
    schema: {
      params: Type.Object({
        id: Type.String(),
      }),
      response: {
        200: Type.Object({
          type: Type.Literal('Feature'),
          properties: Type.Omit(StreetLightAssetSchema, ['geometry']),
          geometry: GeometrySchema,
        }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    const result = await db.execute(sql`
      SELECT
        id, lamp_id as "lampId", display_name as "displayName",
        ST_AsGeoJSON(geometry)::json as geometry,
        lamp_type as "lampType", wattage,
        install_date as "installDate", lamp_status as "lampStatus",
        road_ref as "roadRef",
        data_source as "dataSource", osm_type as "osmType", osm_id as "osmId",
        status, ward, updated_at as "updatedAt"
      FROM streetlight_assets
      WHERE id = ${id}
    `);

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Street light asset not found' });
    }

    const row = result.rows[0] as Record<string, unknown>;

    return {
      type: 'Feature' as const,
      properties: {
        id: row.id as string,
        lampId: row.lampId as string | null,
        displayName: row.displayName as string | null,
        lampType: row.lampType as string,
        wattage: row.wattage as number | null,
        installDate: row.installDate instanceof Date
          ? row.installDate.toISOString().split('T')[0]
          : row.installDate as string | null,
        lampStatus: row.lampStatus as string,
        roadRef: row.roadRef as string | null,
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

  // GET /streetlights/wards - Get distinct ward names for street lights
  app.get('/wards', {
    schema: {
      response: {
        200: Type.Object({
          data: Type.Array(Type.String()),
        }),
      },
    },
  }, async () => {
    const result = await db.selectDistinct({ ward: streetLightAssets.ward })
      .from(streetLightAssets)
      .where(sql`${streetLightAssets.ward} IS NOT NULL`);

    const wards = result
      .map((r) => r.ward)
      .filter((w): w is string => w !== null)
      .sort();

    return { data: wards };
  });
}

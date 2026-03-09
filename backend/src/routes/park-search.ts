import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

/**
 * Park-focused search API for the search MVP.
 * Searches greenspace_assets (parks) and park_facilities.
 * Ranking: exact name/id match > prefix > substring > stable tie-break by id.
 */
export async function parkSearchRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // GET /api/park-search/parks - List parks (greenspace_assets) with optional search
  app.get('/parks', {
    schema: {
      querystring: Type.Object({
        q: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
        offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
      }),
    },
  }, async (request) => {
    const q = request.query.q?.trim() || '';
    const limit = request.query.limit ?? 20;
    const offset = request.query.offset ?? 0;

    const conditions: ReturnType<typeof sql>[] = [];

    // Only include park-like greenspaces
    conditions.push(sql`green_space_type IN ('park', 'garden', 'recreation_ground', 'playground')`);

    if (q) {
      const pattern = `%${q}%`;
      conditions.push(sql`(
        COALESCE(name, '') ILIKE ${pattern}
        OR COALESCE(display_name, '') ILIKE ${pattern}
        OR COALESCE(name_ja, '') ILIKE ${pattern}
        OR id ILIKE ${pattern}
        OR COALESCE(ward, '') ILIKE ${pattern}
      )`);
    }

    const whereClause = conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;

    // Ranked ordering when searching
    const orderClause = q
      ? sql`ORDER BY
          CASE
            WHEN LOWER(COALESCE(name, '')) = LOWER(${q}) OR LOWER(COALESCE(display_name, '')) = LOWER(${q}) THEN 0
            WHEN LOWER(COALESCE(name, '')) LIKE LOWER(${q + '%'}) OR LOWER(COALESCE(display_name, '')) LIKE LOWER(${q + '%'}) THEN 1
            WHEN LOWER(COALESCE(name, '')) LIKE LOWER(${'%' + q + '%'}) OR LOWER(COALESCE(display_name, '')) LIKE LOWER(${'%' + q + '%'}) THEN 2
            ELSE 3
          END,
          id`
      : sql`ORDER BY COALESCE(display_name, name, id)`;

    const result = await db.execute(sql`
      SELECT
        id,
        COALESCE(display_name, name, name_ja) as name,
        ward as address,
        ST_X(ST_Centroid(geometry)) as lng,
        ST_Y(ST_Centroid(geometry)) as lat,
        COALESCE(area_m2, 0)::float as "areaSqm",
        status,
        ST_AsGeoJSON(geometry)::json as geometry
      FROM greenspace_assets
      ${whereClause}
      ${orderClause}
      LIMIT ${limit} OFFSET ${offset}
    `);

    const countResult = await db.execute<{ total: number }>(sql`
      SELECT COUNT(*)::int as total FROM greenspace_assets ${whereClause}
    `);

    const parks = result.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      name: row.name as string,
      address: row.address as string | null,
      coordinates: row.lng != null && row.lat != null
        ? [row.lng as number, row.lat as number] as [number, number]
        : null,
      areaSqm: row.areaSqm as number,
      status: row.status as string,
      geometry: row.geometry,
    }));

    return {
      success: true,
      data: parks,
      meta: {
        total: countResult.rows[0]?.total ?? 0,
        limit,
        offset,
      },
    };
  });

  // GET /api/park-search/facilities - List park facilities with optional search
  app.get('/facilities', {
    schema: {
      querystring: Type.Object({
        q: Type.Optional(Type.String()),
        parkId: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
        offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
      }),
    },
  }, async (request) => {
    const q = request.query.q?.trim() || '';
    const parkId = request.query.parkId;
    const limit = request.query.limit ?? 20;
    const offset = request.query.offset ?? 0;

    const conditions: ReturnType<typeof sql>[] = [];

    if (parkId) {
      conditions.push(sql`pf.green_space_ref = ${parkId}`);
    }

    if (q) {
      const pattern = `%${q}%`;
      conditions.push(sql`(
        COALESCE(pf.name, '') ILIKE ${pattern}
        OR COALESCE(pf.description, '') ILIKE ${pattern}
        OR pf.id ILIKE ${pattern}
        OR COALESCE(pf.facility_id, '') ILIKE ${pattern}
        OR COALESCE(pf.category, '') ILIKE ${pattern}
      )`);
    }

    const whereClause = conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;

    const orderClause = q
      ? sql`ORDER BY
          CASE
            WHEN LOWER(pf.name) = LOWER(${q}) OR LOWER(COALESCE(pf.facility_id, '')) = LOWER(${q}) THEN 0
            WHEN LOWER(pf.name) LIKE LOWER(${q + '%'}) OR LOWER(COALESCE(pf.facility_id, '')) LIKE LOWER(${q + '%'}) THEN 1
            WHEN LOWER(pf.name) LIKE LOWER(${'%' + q + '%'}) THEN 2
            ELSE 3
          END,
          pf.id`
      : sql`ORDER BY pf.name, pf.id`;

    const result = await db.execute(sql`
      SELECT
        pf.id,
        pf.name,
        pf.category as "assetCategory",
        pf.green_space_ref as "parkId",
        COALESCE(gs.display_name, gs.name, gs.name_ja) as "parkName",
        ST_X(ST_Centroid(pf.geometry)) as lng,
        ST_Y(ST_Centroid(pf.geometry)) as lat,
        pf.status,
        pf.condition_grade as "conditionScore",
        pf.last_inspection_date as "lastInspectionAt",
        pf.facility_id as "facilityId",
        pf.ward,
        ST_AsGeoJSON(pf.geometry)::json as geometry
      FROM park_facilities pf
      LEFT JOIN greenspace_assets gs ON gs.id = pf.green_space_ref
      ${whereClause}
      ${orderClause}
      LIMIT ${limit} OFFSET ${offset}
    `);

    const countResult = await db.execute<{ total: number }>(sql`
      SELECT COUNT(*)::int as total
      FROM park_facilities pf
      LEFT JOIN greenspace_assets gs ON gs.id = pf.green_space_ref
      ${whereClause}
    `);

    const facilities = result.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      name: row.name as string,
      assetCategory: row.assetCategory as string,
      parkId: row.parkId as string,
      parkName: row.parkName as string | null,
      coordinates: row.lng != null && row.lat != null
        ? [row.lng as number, row.lat as number] as [number, number]
        : null,
      status: row.status as string,
      conditionScore: row.conditionScore as string | null,
      lastInspectionAt: row.lastInspectionAt instanceof Date
        ? row.lastInspectionAt.toISOString()
        : row.lastInspectionAt as string | null,
      facilityId: row.facilityId as string | null,
      ward: row.ward as string | null,
      geometry: row.geometry,
    }));

    return {
      success: true,
      data: facilities,
      meta: {
        total: countResult.rows[0]?.total ?? 0,
        limit,
        offset,
      },
    };
  });

  // GET /api/park-search/search - Unified ranked search across parks and facilities
  app.get('/search', {
    schema: {
      querystring: Type.Object({
        q: Type.String({ minLength: 1 }),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 10 })),
      }),
    },
  }, async (request) => {
    const q = request.query.q.trim();
    const limit = request.query.limit ?? 10;

    if (!q) {
      return {
        success: true,
        data: { query: q, parks: [], facilities: [] },
      };
    }

    const pattern = `%${q}%`;

    // Search parks (greenspace_assets)
    const parksResult = await db.execute(sql`
      SELECT
        id,
        COALESCE(display_name, name, name_ja) as name,
        ward as address,
        ST_X(ST_Centroid(geometry)) as lng,
        ST_Y(ST_Centroid(geometry)) as lat,
        COALESCE(area_m2, 0)::float as "areaSqm",
        status,
        ST_AsGeoJSON(geometry)::json as geometry
      FROM greenspace_assets
      WHERE green_space_type IN ('park', 'garden', 'recreation_ground', 'playground')
        AND (
          COALESCE(name, '') ILIKE ${pattern}
          OR COALESCE(display_name, '') ILIKE ${pattern}
          OR COALESCE(name_ja, '') ILIKE ${pattern}
          OR id ILIKE ${pattern}
          OR COALESCE(ward, '') ILIKE ${pattern}
        )
      ORDER BY
        CASE
          WHEN LOWER(COALESCE(name, '')) = LOWER(${q}) OR LOWER(COALESCE(display_name, '')) = LOWER(${q}) THEN 0
          WHEN LOWER(COALESCE(name, '')) LIKE LOWER(${q + '%'}) OR LOWER(COALESCE(display_name, '')) LIKE LOWER(${q + '%'}) THEN 1
          WHEN LOWER(COALESCE(name, '')) LIKE LOWER(${'%' + q + '%'}) OR LOWER(COALESCE(display_name, '')) LIKE LOWER(${'%' + q + '%'}) THEN 2
          ELSE 3
        END,
        id
      LIMIT ${limit}
    `);

    // Search facilities (park_facilities with parent park name)
    const facilitiesResult = await db.execute(sql`
      SELECT
        pf.id,
        pf.name,
        pf.category as "assetCategory",
        pf.green_space_ref as "parkId",
        COALESCE(gs.display_name, gs.name, gs.name_ja) as "parkName",
        ST_X(ST_Centroid(pf.geometry)) as lng,
        ST_Y(ST_Centroid(pf.geometry)) as lat,
        pf.status,
        pf.condition_grade as "conditionScore",
        pf.last_inspection_date as "lastInspectionAt",
        pf.facility_id as "facilityId",
        pf.ward,
        ST_AsGeoJSON(pf.geometry)::json as geometry
      FROM park_facilities pf
      LEFT JOIN greenspace_assets gs ON gs.id = pf.green_space_ref
      WHERE (
        COALESCE(pf.name, '') ILIKE ${pattern}
        OR COALESCE(pf.description, '') ILIKE ${pattern}
        OR pf.id ILIKE ${pattern}
        OR COALESCE(pf.facility_id, '') ILIKE ${pattern}
        OR COALESCE(pf.category, '') ILIKE ${pattern}
      )
      ORDER BY
        CASE
          WHEN LOWER(pf.name) = LOWER(${q}) OR LOWER(COALESCE(pf.facility_id, '')) = LOWER(${q}) THEN 0
          WHEN LOWER(pf.name) LIKE LOWER(${q + '%'}) OR LOWER(COALESCE(pf.facility_id, '')) LIKE LOWER(${q + '%'}) THEN 1
          WHEN LOWER(pf.name) LIKE LOWER(${'%' + q + '%'}) THEN 2
          ELSE 3
        END,
        pf.id
      LIMIT ${limit}
    `);

    const parks = parksResult.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      name: row.name as string,
      address: row.address as string | null,
      coordinates: row.lng != null && row.lat != null
        ? [row.lng as number, row.lat as number] as [number, number]
        : null,
      areaSqm: row.areaSqm as number,
      status: row.status as string,
      geometry: row.geometry,
    }));

    const facilities = facilitiesResult.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      name: row.name as string,
      assetCategory: row.assetCategory as string,
      parkId: row.parkId as string,
      parkName: row.parkName as string | null,
      coordinates: row.lng != null && row.lat != null
        ? [row.lng as number, row.lat as number] as [number, number]
        : null,
      status: row.status as string,
      conditionScore: row.conditionScore as string | null,
      lastInspectionAt: row.lastInspectionAt instanceof Date
        ? row.lastInspectionAt.toISOString()
        : row.lastInspectionAt as string | null,
      facilityId: row.facilityId as string | null,
      ward: row.ward as string | null,
      geometry: row.geometry,
    }));

    return {
      success: true,
      data: { query: q, parks, facilities },
    };
  });

  // GET /api/park-search/suggestions - Empty-state suggestions (top parks + facilities)
  app.get('/suggestions', {
    schema: {
      querystring: Type.Object({
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 10, default: 4 })),
      }),
    },
  }, async (request) => {
    const limit = request.query.limit ?? 4;

    const parksResult = await db.execute(sql`
      SELECT
        id,
        COALESCE(display_name, name, name_ja) as name,
        ward as address,
        ST_X(ST_Centroid(geometry)) as lng,
        ST_Y(ST_Centroid(geometry)) as lat,
        COALESCE(area_m2, 0)::float as "areaSqm",
        status,
        ST_AsGeoJSON(geometry)::json as geometry
      FROM greenspace_assets
      WHERE green_space_type IN ('park', 'garden', 'recreation_ground', 'playground')
        AND name IS NOT NULL
      ORDER BY COALESCE(area_m2, 0) DESC
      LIMIT ${limit}
    `);

    const facilitiesResult = await db.execute(sql`
      SELECT
        pf.id,
        pf.name,
        pf.category as "assetCategory",
        pf.green_space_ref as "parkId",
        COALESCE(gs.display_name, gs.name, gs.name_ja) as "parkName",
        ST_X(ST_Centroid(pf.geometry)) as lng,
        ST_Y(ST_Centroid(pf.geometry)) as lat,
        pf.status,
        pf.condition_grade as "conditionScore",
        pf.facility_id as "facilityId",
        pf.ward,
        ST_AsGeoJSON(pf.geometry)::json as geometry
      FROM park_facilities pf
      LEFT JOIN greenspace_assets gs ON gs.id = pf.green_space_ref
      WHERE pf.name IS NOT NULL
      ORDER BY pf.name
      LIMIT ${limit}
    `);

    const parks = parksResult.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      name: row.name as string,
      address: row.address as string | null,
      coordinates: row.lng != null && row.lat != null
        ? [row.lng as number, row.lat as number] as [number, number]
        : null,
      areaSqm: row.areaSqm as number,
      status: row.status as string,
      geometry: row.geometry,
    }));

    const facilities = facilitiesResult.rows.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      name: row.name as string,
      assetCategory: row.assetCategory as string,
      parkId: row.parkId as string,
      parkName: row.parkName as string | null,
      coordinates: row.lng != null && row.lat != null
        ? [row.lng as number, row.lat as number] as [number, number]
        : null,
      status: row.status as string,
      conditionScore: row.conditionScore as string | null,
      facilityId: row.facilityId as string | null,
      ward: row.ward as string | null,
      geometry: row.geometry,
    }));

    return {
      success: true,
      data: { parks, facilities },
    };
  });
}

import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

function parseBbox(bbox: string): { minLng: number; minLat: number; maxLng: number; maxLat: number } | null {
  const parts = bbox.split(',').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return null;
  const [minLng, minLat, maxLng, maxLat] = parts;
  if (minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90) return null;
  if (minLng > maxLng || minLat > maxLat) return null;
  return { minLng, minLat, maxLng, maxLat };
}

export async function parkFacilitiesRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // GET /park-facilities - List park facilities with required bbox
  app.get('/', {
    schema: {
      querystring: Type.Object({
        bbox: Type.String(),
        category: Type.Optional(Type.String()),
        conditionGrade: Type.Optional(Type.String()),
        greenSpaceRef: Type.Optional(Type.String()),
        ward: Type.Optional(Type.String()),
        q: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000 })),
        offset: Type.Optional(Type.Integer({ minimum: 0 })),
        includeTotal: Type.Optional(Type.Boolean()),
      }),
    },
  }, async (request, reply) => {
    const { bbox, category, conditionGrade, greenSpaceRef, ward, q } = request.query;
    const limit = Math.min(request.query.limit ?? 200, 1000);
    const offset = request.query.offset ?? 0;
    const includeTotal = request.query.includeTotal !== false;

    const bboxParsed = parseBbox(bbox);
    if (!bboxParsed) {
      return reply.status(400).send({ error: 'Invalid bbox format. Expected: minLng,minLat,maxLng,maxLat' });
    }

    const { minLng, minLat, maxLng, maxLat } = bboxParsed;

    const conditions: ReturnType<typeof sql>[] = [
      sql`ST_Intersects(geometry, ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326))`,
    ];

    if (category) {
      const vals = category.split(',').map(v => v.trim());
      if (vals.length === 1) conditions.push(sql`category = ${vals[0]}`);
      else conditions.push(sql`category IN (${sql.join(vals.map(v => sql`${v}`), sql`, `)})`);
    }
    if (conditionGrade) {
      const vals = conditionGrade.split(',').map(v => v.trim());
      if (vals.length === 1) conditions.push(sql`condition_grade = ${vals[0]}`);
      else conditions.push(sql`condition_grade IN (${sql.join(vals.map(v => sql`${v}`), sql`, `)})`);
    }
    if (greenSpaceRef) conditions.push(sql`green_space_ref = ${greenSpaceRef}`);
    if (ward) conditions.push(sql`ward = ${ward}`);
    if (q) {
      const pattern = `%${q.trim()}%`;
      conditions.push(sql`(
        COALESCE(name, '') ILIKE ${pattern}
        OR COALESCE(description, '') ILIKE ${pattern}
        OR id ILIKE ${pattern}
      )`);
    }

    const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

    let total: number | null = null;
    if (includeTotal) {
      const countResult = await db.execute<{ total: number }>(sql`
        SELECT COUNT(*)::int as total FROM park_facilities ${whereClause}
      `);
      total = countResult.rows[0]?.total ?? 0;
    }

    const result = await db.execute(sql`
      SELECT
        id, facility_id as "facilityId", name, description,
        category, sub_category as "subCategory",
        date_installed as "dateInstalled", manufacturer, material,
        quantity, design_life as "designLife",
        condition_grade as "conditionGrade",
        last_inspection_date as "lastInspectionDate",
        next_inspection_date as "nextInspectionDate",
        safety_concern as "safetyConcern",
        ST_AsGeoJSON(geometry)::json as geometry,
        status, ward, managing_dept as "managingDept",
        condition, risk_level as "riskLevel",
        green_space_ref as "greenSpaceRef",
        data_source as "dataSource", updated_at as "updatedAt"
      FROM park_facilities
      ${whereClause}
      ORDER BY id
      LIMIT ${limit} OFFSET ${offset}
    `);

    const features = result.rows.map((row: Record<string, unknown>) => ({
      type: 'Feature' as const,
      properties: {
        id: row.id,
        facilityId: row.facilityId,
        name: row.name,
        description: row.description,
        category: row.category,
        subCategory: row.subCategory,
        dateInstalled: row.dateInstalled instanceof Date ? row.dateInstalled.toISOString() : row.dateInstalled,
        manufacturer: row.manufacturer,
        material: row.material,
        quantity: row.quantity,
        designLife: row.designLife,
        conditionGrade: row.conditionGrade,
        lastInspectionDate: row.lastInspectionDate instanceof Date ? row.lastInspectionDate.toISOString() : row.lastInspectionDate,
        nextInspectionDate: row.nextInspectionDate instanceof Date ? row.nextInspectionDate.toISOString() : row.nextInspectionDate,
        safetyConcern: row.safetyConcern,
        status: row.status,
        condition: row.condition,
        riskLevel: row.riskLevel,
        ward: row.ward,
        managingDept: row.managingDept,
        greenSpaceRef: row.greenSpaceRef,
        dataSource: row.dataSource,
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

  // GET /park-facilities/:id
  app.get('/:id', {
    schema: {
      params: Type.Object({ id: Type.String() }),
    },
  }, async (request, reply) => {
    const { id } = request.params;

    const result = await db.execute(sql`
      SELECT
        id, facility_id as "facilityId", name, description,
        category, sub_category as "subCategory",
        date_installed as "dateInstalled", manufacturer, material,
        quantity, design_life as "designLife",
        condition_grade as "conditionGrade",
        last_inspection_date as "lastInspectionDate",
        next_inspection_date as "nextInspectionDate",
        safety_concern as "safetyConcern",
        ST_AsGeoJSON(geometry)::json as geometry,
        status, ward, managing_dept as "managingDept",
        condition, risk_level as "riskLevel",
        green_space_ref as "greenSpaceRef",
        data_source as "dataSource", updated_at as "updatedAt"
      FROM park_facilities
      WHERE id = ${id}
    `);

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Park facility not found' });
    }

    const row = result.rows[0] as Record<string, unknown>;
    return {
      type: 'Feature' as const,
      properties: {
        id: row.id,
        facilityId: row.facilityId,
        name: row.name,
        description: row.description,
        category: row.category,
        subCategory: row.subCategory,
        dateInstalled: row.dateInstalled instanceof Date ? row.dateInstalled.toISOString() : row.dateInstalled,
        manufacturer: row.manufacturer,
        material: row.material,
        quantity: row.quantity,
        designLife: row.designLife,
        conditionGrade: row.conditionGrade,
        lastInspectionDate: row.lastInspectionDate instanceof Date ? row.lastInspectionDate.toISOString() : row.lastInspectionDate,
        nextInspectionDate: row.nextInspectionDate instanceof Date ? row.nextInspectionDate.toISOString() : row.nextInspectionDate,
        safetyConcern: row.safetyConcern,
        status: row.status,
        condition: row.condition,
        riskLevel: row.riskLevel,
        ward: row.ward,
        managingDept: row.managingDept,
        greenSpaceRef: row.greenSpaceRef,
        dataSource: row.dataSource,
        updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
      },
      geometry: row.geometry,
    };
  });
}

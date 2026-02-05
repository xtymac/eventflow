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

function getSimplifyTolerance(zoom: number): number {
  if (zoom >= 16) return 0;
  if (zoom >= 14) return 0.00005;
  if (zoom >= 12) return 0.0002;
  return 0.001;
}

export async function pavementSectionsRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // GET /pavement-sections - List pavement sections with required bbox
  app.get('/', {
    schema: {
      querystring: Type.Object({
        bbox: Type.String(),
        zoom: Type.Optional(Type.Integer({ minimum: 1, maximum: 22 })),
        pavementType: Type.Optional(Type.String()),
        priorityRank: Type.Optional(Type.Integer()),
        roadRef: Type.Optional(Type.String()),
        ward: Type.Optional(Type.String()),
        q: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000 })),
        offset: Type.Optional(Type.Integer({ minimum: 0 })),
        includeTotal: Type.Optional(Type.Boolean()),
      }),
    },
  }, async (request, reply) => {
    const { bbox, zoom, pavementType, priorityRank, roadRef, ward, q } = request.query;
    const limit = Math.min(request.query.limit ?? 200, 1000);
    const offset = request.query.offset ?? 0;
    const includeTotal = request.query.includeTotal !== false;

    const bboxParsed = parseBbox(bbox);
    if (!bboxParsed) {
      return reply.status(400).send({ error: 'Invalid bbox format. Expected: minLng,minLat,maxLng,maxLat' });
    }

    const { minLng, minLat, maxLng, maxLat } = bboxParsed;
    const simplifyTolerance = getSimplifyTolerance(zoom ?? 14);

    const conditions: ReturnType<typeof sql>[] = [
      sql`ST_Intersects(geometry, ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326))`,
    ];

    if (pavementType) {
      const vals = pavementType.split(',').map(v => v.trim());
      if (vals.length === 1) conditions.push(sql`pavement_type = ${vals[0]}`);
      else conditions.push(sql`pavement_type IN (${sql.join(vals.map(v => sql`${v}`), sql`, `)})`);
    }
    if (priorityRank != null) conditions.push(sql`priority_rank <= ${priorityRank}`);
    if (roadRef) conditions.push(sql`road_ref = ${roadRef}`);
    if (ward) conditions.push(sql`ward = ${ward}`);
    if (q) {
      const pattern = `%${q.trim()}%`;
      conditions.push(sql`(
        COALESCE(name, '') ILIKE ${pattern}
        OR COALESCE(section_id, '') ILIKE ${pattern}
        OR id ILIKE ${pattern}
      )`);
    }

    const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

    let total: number | null = null;
    if (includeTotal) {
      const countResult = await db.execute<{ total: number }>(sql`
        SELECT COUNT(*)::int as total FROM pavement_sections ${whereClause}
      `);
      total = countResult.rows[0]?.total ?? 0;
    }

    const geometryExpr = simplifyTolerance > 0
      ? sql`ST_AsGeoJSON(ST_SimplifyPreserveTopology(geometry, ${simplifyTolerance}))::json`
      : sql`ST_AsGeoJSON(geometry)::json`;

    const result = await db.execute(sql`
      SELECT
        id, section_id as "sectionId", name, route_number as "routeNumber",
        pavement_type as "pavementType",
        length, width, thickness,
        last_resurfacing_date as "lastResurfacingDate",
        mci, crack_rate as "crackRate", rut_depth as "rutDepth", iri,
        last_measurement_date as "lastMeasurementDate",
        planned_intervention_year as "plannedInterventionYear",
        estimated_cost as "estimatedCost", priority_rank as "priorityRank",
        ${geometryExpr} as geometry,
        status, ward, managing_dept as "managingDept",
        condition, risk_level as "riskLevel",
        road_ref as "roadRef",
        data_source as "dataSource", updated_at as "updatedAt"
      FROM pavement_sections
      ${whereClause}
      ORDER BY COALESCE(priority_rank, 9999), id
      LIMIT ${limit} OFFSET ${offset}
    `);

    const features = result.rows.map((row: Record<string, unknown>) => ({
      type: 'Feature' as const,
      properties: {
        id: row.id,
        sectionId: row.sectionId,
        name: row.name,
        routeNumber: row.routeNumber,
        pavementType: row.pavementType,
        length: row.length != null ? Number(row.length) : null,
        width: row.width != null ? Number(row.width) : null,
        thickness: row.thickness != null ? Number(row.thickness) : null,
        lastResurfacingDate: row.lastResurfacingDate instanceof Date ? row.lastResurfacingDate.toISOString() : row.lastResurfacingDate,
        mci: row.mci != null ? Number(row.mci) : null,
        crackRate: row.crackRate != null ? Number(row.crackRate) : null,
        rutDepth: row.rutDepth != null ? Number(row.rutDepth) : null,
        iri: row.iri != null ? Number(row.iri) : null,
        lastMeasurementDate: row.lastMeasurementDate instanceof Date ? row.lastMeasurementDate.toISOString() : row.lastMeasurementDate,
        plannedInterventionYear: row.plannedInterventionYear,
        estimatedCost: row.estimatedCost != null ? Number(row.estimatedCost) : null,
        priorityRank: row.priorityRank,
        status: row.status,
        condition: row.condition,
        riskLevel: row.riskLevel,
        ward: row.ward,
        managingDept: row.managingDept,
        roadRef: row.roadRef,
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

  // GET /pavement-sections/:id
  app.get('/:id', {
    schema: {
      params: Type.Object({ id: Type.String() }),
    },
  }, async (request, reply) => {
    const { id } = request.params;

    const result = await db.execute(sql`
      SELECT
        id, section_id as "sectionId", name, route_number as "routeNumber",
        pavement_type as "pavementType",
        length, width, thickness,
        last_resurfacing_date as "lastResurfacingDate",
        mci, crack_rate as "crackRate", rut_depth as "rutDepth", iri,
        last_measurement_date as "lastMeasurementDate",
        planned_intervention_year as "plannedInterventionYear",
        estimated_cost as "estimatedCost", priority_rank as "priorityRank",
        ST_AsGeoJSON(geometry)::json as geometry,
        status, ward, managing_dept as "managingDept",
        condition, risk_level as "riskLevel",
        road_ref as "roadRef",
        data_source as "dataSource", updated_at as "updatedAt"
      FROM pavement_sections
      WHERE id = ${id}
    `);

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Pavement section not found' });
    }

    const row = result.rows[0] as Record<string, unknown>;
    return {
      type: 'Feature' as const,
      properties: {
        id: row.id,
        sectionId: row.sectionId,
        name: row.name,
        routeNumber: row.routeNumber,
        pavementType: row.pavementType,
        length: row.length != null ? Number(row.length) : null,
        width: row.width != null ? Number(row.width) : null,
        thickness: row.thickness != null ? Number(row.thickness) : null,
        lastResurfacingDate: row.lastResurfacingDate instanceof Date ? row.lastResurfacingDate.toISOString() : row.lastResurfacingDate,
        mci: row.mci != null ? Number(row.mci) : null,
        crackRate: row.crackRate != null ? Number(row.crackRate) : null,
        rutDepth: row.rutDepth != null ? Number(row.rutDepth) : null,
        iri: row.iri != null ? Number(row.iri) : null,
        lastMeasurementDate: row.lastMeasurementDate instanceof Date ? row.lastMeasurementDate.toISOString() : row.lastMeasurementDate,
        plannedInterventionYear: row.plannedInterventionYear,
        estimatedCost: row.estimatedCost != null ? Number(row.estimatedCost) : null,
        priorityRank: row.priorityRank,
        status: row.status,
        condition: row.condition,
        riskLevel: row.riskLevel,
        ward: row.ward,
        managingDept: row.managingDept,
        roadRef: row.roadRef,
        dataSource: row.dataSource,
        updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
      },
      geometry: row.geometry,
    };
  });
}

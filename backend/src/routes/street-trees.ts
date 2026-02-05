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

const GeometrySchema = Type.Object({
  type: Type.String(),
  coordinates: Type.Any(),
});

export async function streetTreesRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // GET /street-trees - List street trees with required bbox
  app.get('/', {
    schema: {
      querystring: Type.Object({
        bbox: Type.String(),
        category: Type.Optional(Type.String()),
        healthStatus: Type.Optional(Type.String()),
        conditionGrade: Type.Optional(Type.String()),
        ward: Type.Optional(Type.String()),
        q: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000 })),
        offset: Type.Optional(Type.Integer({ minimum: 0 })),
        includeTotal: Type.Optional(Type.Boolean()),
      }),
    },
  }, async (request, reply) => {
    const { bbox, category, healthStatus, conditionGrade, ward, q } = request.query;
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
    if (healthStatus) {
      const vals = healthStatus.split(',').map(v => v.trim());
      if (vals.length === 1) conditions.push(sql`health_status = ${vals[0]}`);
      else conditions.push(sql`health_status IN (${sql.join(vals.map(v => sql`${v}`), sql`, `)})`);
    }
    if (conditionGrade) {
      const vals = conditionGrade.split(',').map(v => v.trim());
      if (vals.length === 1) conditions.push(sql`condition_grade = ${vals[0]}`);
      else conditions.push(sql`condition_grade IN (${sql.join(vals.map(v => sql`${v}`), sql`, `)})`);
    }
    if (ward) conditions.push(sql`ward = ${ward}`);
    if (q) {
      const pattern = `%${q.trim()}%`;
      conditions.push(sql`(
        COALESCE(display_name, '') ILIKE ${pattern}
        OR COALESCE(species_name, '') ILIKE ${pattern}
        OR COALESCE(scientific_name, '') ILIKE ${pattern}
        OR id ILIKE ${pattern}
      )`);
    }

    const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

    let total: number | null = null;
    if (includeTotal) {
      const countResult = await db.execute<{ total: number }>(sql`
        SELECT COUNT(*)::int as total FROM street_tree_assets ${whereClause}
      `);
      total = countResult.rows[0]?.total ?? 0;
    }

    const result = await db.execute(sql`
      SELECT
        id, ledger_id as "ledgerId", display_name as "displayName",
        species_name as "speciesName", scientific_name as "scientificName",
        category, trunk_diameter as "trunkDiameter", height, crown_spread as "crownSpread",
        date_planted as "datePlanted", estimated_age as "estimatedAge",
        health_status as "healthStatus", condition_grade as "conditionGrade",
        last_diagnostic_date as "lastDiagnosticDate", diagnostic_notes as "diagnosticNotes",
        ST_AsGeoJSON(geometry)::json as geometry,
        status, ward, managing_dept as "managingDept",
        condition, risk_level as "riskLevel",
        road_ref as "roadRef", green_space_ref as "greenSpaceRef",
        data_source as "dataSource", updated_at as "updatedAt"
      FROM street_tree_assets
      ${whereClause}
      ORDER BY id
      LIMIT ${limit} OFFSET ${offset}
    `);

    const features = result.rows.map((row: Record<string, unknown>) => ({
      type: 'Feature' as const,
      properties: {
        id: row.id,
        ledgerId: row.ledgerId,
        displayName: row.displayName,
        speciesName: row.speciesName,
        scientificName: row.scientificName,
        category: row.category,
        trunkDiameter: row.trunkDiameter != null ? Number(row.trunkDiameter) : null,
        height: row.height != null ? Number(row.height) : null,
        crownSpread: row.crownSpread != null ? Number(row.crownSpread) : null,
        datePlanted: row.datePlanted instanceof Date ? row.datePlanted.toISOString() : row.datePlanted,
        estimatedAge: row.estimatedAge,
        healthStatus: row.healthStatus,
        conditionGrade: row.conditionGrade,
        lastDiagnosticDate: row.lastDiagnosticDate instanceof Date ? row.lastDiagnosticDate.toISOString() : row.lastDiagnosticDate,
        diagnosticNotes: row.diagnosticNotes,
        status: row.status,
        condition: row.condition,
        riskLevel: row.riskLevel,
        ward: row.ward,
        managingDept: row.managingDept,
        roadRef: row.roadRef,
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

  // GET /street-trees/:id
  app.get('/:id', {
    schema: {
      params: Type.Object({ id: Type.String() }),
    },
  }, async (request, reply) => {
    const { id } = request.params;

    const result = await db.execute(sql`
      SELECT
        id, ledger_id as "ledgerId", display_name as "displayName",
        species_name as "speciesName", scientific_name as "scientificName",
        category, trunk_diameter as "trunkDiameter", height, crown_spread as "crownSpread",
        date_planted as "datePlanted", estimated_age as "estimatedAge",
        health_status as "healthStatus", condition_grade as "conditionGrade",
        last_diagnostic_date as "lastDiagnosticDate", diagnostic_notes as "diagnosticNotes",
        ST_AsGeoJSON(geometry)::json as geometry,
        status, ward, managing_dept as "managingDept",
        condition, risk_level as "riskLevel",
        road_ref as "roadRef", green_space_ref as "greenSpaceRef",
        data_source as "dataSource", updated_at as "updatedAt"
      FROM street_tree_assets
      WHERE id = ${id}
    `);

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Street tree not found' });
    }

    const row = result.rows[0] as Record<string, unknown>;
    return {
      type: 'Feature' as const,
      properties: {
        id: row.id,
        ledgerId: row.ledgerId,
        displayName: row.displayName,
        speciesName: row.speciesName,
        scientificName: row.scientificName,
        category: row.category,
        trunkDiameter: row.trunkDiameter != null ? Number(row.trunkDiameter) : null,
        height: row.height != null ? Number(row.height) : null,
        crownSpread: row.crownSpread != null ? Number(row.crownSpread) : null,
        datePlanted: row.datePlanted instanceof Date ? row.datePlanted.toISOString() : row.datePlanted,
        estimatedAge: row.estimatedAge,
        healthStatus: row.healthStatus,
        conditionGrade: row.conditionGrade,
        lastDiagnosticDate: row.lastDiagnosticDate instanceof Date ? row.lastDiagnosticDate.toISOString() : row.lastDiagnosticDate,
        diagnosticNotes: row.diagnosticNotes,
        status: row.status,
        condition: row.condition,
        riskLevel: row.riskLevel,
        ward: row.ward,
        managingDept: row.managingDept,
        roadRef: row.roadRef,
        greenSpaceRef: row.greenSpaceRef,
        dataSource: row.dataSource,
        updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
      },
      geometry: row.geometry,
    };
  });
}

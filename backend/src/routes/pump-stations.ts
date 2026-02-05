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

export async function pumpStationsRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // GET /pump-stations - List pump stations with required bbox
  app.get('/', {
    schema: {
      querystring: Type.Object({
        bbox: Type.String(),
        category: Type.Optional(Type.String()),
        equipmentStatus: Type.Optional(Type.String()),
        conditionGrade: Type.Optional(Type.String()),
        ward: Type.Optional(Type.String()),
        q: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000 })),
        offset: Type.Optional(Type.Integer({ minimum: 0 })),
        includeTotal: Type.Optional(Type.Boolean()),
      }),
    },
  }, async (request, reply) => {
    const { bbox, category, equipmentStatus, conditionGrade, ward, q } = request.query;
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
    if (equipmentStatus) {
      const vals = equipmentStatus.split(',').map(v => v.trim());
      if (vals.length === 1) conditions.push(sql`equipment_status = ${vals[0]}`);
      else conditions.push(sql`equipment_status IN (${sql.join(vals.map(v => sql`${v}`), sql`, `)})`);
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
        COALESCE(name, '') ILIKE ${pattern}
        OR COALESCE(station_id, '') ILIKE ${pattern}
        OR id ILIKE ${pattern}
      )`);
    }

    const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

    let total: number | null = null;
    if (includeTotal) {
      const countResult = await db.execute<{ total: number }>(sql`
        SELECT COUNT(*)::int as total FROM pump_stations ${whereClause}
      `);
      total = countResult.rows[0]?.total ?? 0;
    }

    const result = await db.execute(sql`
      SELECT
        id, station_id as "stationId", name, description,
        category,
        date_commissioned as "dateCommissioned",
        design_capacity as "designCapacity", pump_count as "pumpCount",
        total_power as "totalPower", drainage_area as "drainageArea",
        equipment_status as "equipmentStatus",
        condition_grade as "conditionGrade",
        last_maintenance_date as "lastMaintenanceDate",
        next_maintenance_date as "nextMaintenanceDate",
        ST_AsGeoJSON(geometry)::json as geometry,
        status, ward, managing_dept as "managingDept",
        condition, risk_level as "riskLevel",
        managing_office as "managingOffice",
        river_ref as "riverRef",
        data_source as "dataSource", updated_at as "updatedAt"
      FROM pump_stations
      ${whereClause}
      ORDER BY id
      LIMIT ${limit} OFFSET ${offset}
    `);

    const features = result.rows.map((row: Record<string, unknown>) => ({
      type: 'Feature' as const,
      properties: {
        id: row.id,
        stationId: row.stationId,
        name: row.name,
        description: row.description,
        category: row.category,
        dateCommissioned: row.dateCommissioned instanceof Date ? row.dateCommissioned.toISOString() : row.dateCommissioned,
        designCapacity: row.designCapacity != null ? Number(row.designCapacity) : null,
        pumpCount: row.pumpCount,
        totalPower: row.totalPower != null ? Number(row.totalPower) : null,
        drainageArea: row.drainageArea != null ? Number(row.drainageArea) : null,
        equipmentStatus: row.equipmentStatus,
        conditionGrade: row.conditionGrade,
        lastMaintenanceDate: row.lastMaintenanceDate instanceof Date ? row.lastMaintenanceDate.toISOString() : row.lastMaintenanceDate,
        nextMaintenanceDate: row.nextMaintenanceDate instanceof Date ? row.nextMaintenanceDate.toISOString() : row.nextMaintenanceDate,
        status: row.status,
        condition: row.condition,
        riskLevel: row.riskLevel,
        ward: row.ward,
        managingDept: row.managingDept,
        managingOffice: row.managingOffice,
        riverRef: row.riverRef,
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

  // GET /pump-stations/:id
  app.get('/:id', {
    schema: {
      params: Type.Object({ id: Type.String() }),
    },
  }, async (request, reply) => {
    const { id } = request.params;

    const result = await db.execute(sql`
      SELECT
        id, station_id as "stationId", name, description,
        category,
        date_commissioned as "dateCommissioned",
        design_capacity as "designCapacity", pump_count as "pumpCount",
        total_power as "totalPower", drainage_area as "drainageArea",
        equipment_status as "equipmentStatus",
        condition_grade as "conditionGrade",
        last_maintenance_date as "lastMaintenanceDate",
        next_maintenance_date as "nextMaintenanceDate",
        ST_AsGeoJSON(geometry)::json as geometry,
        status, ward, managing_dept as "managingDept",
        condition, risk_level as "riskLevel",
        managing_office as "managingOffice",
        river_ref as "riverRef",
        data_source as "dataSource", updated_at as "updatedAt"
      FROM pump_stations
      WHERE id = ${id}
    `);

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Pump station not found' });
    }

    const row = result.rows[0] as Record<string, unknown>;
    return {
      type: 'Feature' as const,
      properties: {
        id: row.id,
        stationId: row.stationId,
        name: row.name,
        description: row.description,
        category: row.category,
        dateCommissioned: row.dateCommissioned instanceof Date ? row.dateCommissioned.toISOString() : row.dateCommissioned,
        designCapacity: row.designCapacity != null ? Number(row.designCapacity) : null,
        pumpCount: row.pumpCount,
        totalPower: row.totalPower != null ? Number(row.totalPower) : null,
        drainageArea: row.drainageArea != null ? Number(row.drainageArea) : null,
        equipmentStatus: row.equipmentStatus,
        conditionGrade: row.conditionGrade,
        lastMaintenanceDate: row.lastMaintenanceDate instanceof Date ? row.lastMaintenanceDate.toISOString() : row.lastMaintenanceDate,
        nextMaintenanceDate: row.nextMaintenanceDate instanceof Date ? row.nextMaintenanceDate.toISOString() : row.nextMaintenanceDate,
        status: row.status,
        condition: row.condition,
        riskLevel: row.riskLevel,
        ward: row.ward,
        managingDept: row.managingDept,
        managingOffice: row.managingOffice,
        riverRef: row.riverRef,
        dataSource: row.dataSource,
        updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
      },
      geometry: row.geometry,
    };
  });
}

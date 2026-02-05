import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

export async function lifecyclePlansRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // GET /lifecycle-plans - List lifecycle plans (no bbox required, non-geographic)
  app.get('/', {
    schema: {
      querystring: Type.Object({
        assetType: Type.Optional(Type.String()),
        planStatus: Type.Optional(Type.String()),
        assetRef: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000 })),
        offset: Type.Optional(Type.Integer({ minimum: 0 })),
        includeTotal: Type.Optional(Type.Boolean()),
      }),
    },
  }, async (request) => {
    const { assetType, planStatus, assetRef } = request.query;
    const limit = Math.min(request.query.limit ?? 50, 1000);
    const offset = request.query.offset ?? 0;
    const includeTotal = request.query.includeTotal !== false;

    const conditions: ReturnType<typeof sql>[] = [];

    if (assetType) conditions.push(sql`asset_type = ${assetType}`);
    if (planStatus) {
      const vals = planStatus.split(',').map(v => v.trim());
      if (vals.length === 1) conditions.push(sql`plan_status = ${vals[0]}`);
      else conditions.push(sql`plan_status IN (${sql.join(vals.map(v => sql`${v}`), sql`, `)})`);
    }
    if (assetRef) conditions.push(sql`asset_ref = ${assetRef}`);

    const whereClause = conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;

    let total: number | null = null;
    if (includeTotal) {
      const countResult = await db.execute<{ total: number }>(sql`
        SELECT COUNT(*)::int as total FROM lifecycle_plans ${whereClause}
      `);
      total = countResult.rows[0]?.total ?? 0;
    }

    const result = await db.execute(sql`
      SELECT
        id, title, version,
        plan_start_year as "planStartYear", plan_end_year as "planEndYear",
        plan_status as "planStatus",
        asset_type as "assetType",
        baseline_condition as "baselineCondition",
        design_life as "designLife", remaining_life as "remainingLife",
        interventions,
        total_lifecycle_cost_jpy as "totalLifecycleCostJpy",
        annual_average_cost_jpy as "annualAverageCostJpy",
        asset_ref as "assetRef",
        managing_dept as "managingDept",
        created_by as "createdBy",
        approved_at as "approvedAt",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM lifecycle_plans
      ${whereClause}
      ORDER BY plan_start_year DESC, id
      LIMIT ${limit} OFFSET ${offset}
    `);

    const data = result.rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      title: row.title,
      version: row.version,
      planStartYear: row.planStartYear,
      planEndYear: row.planEndYear,
      planStatus: row.planStatus,
      assetType: row.assetType,
      baselineCondition: row.baselineCondition,
      designLife: row.designLife,
      remainingLife: row.remainingLife,
      interventions: row.interventions,
      totalLifecycleCostJpy: row.totalLifecycleCostJpy != null ? Number(row.totalLifecycleCostJpy) : null,
      annualAverageCostJpy: row.annualAverageCostJpy != null ? Number(row.annualAverageCostJpy) : null,
      assetRef: row.assetRef,
      managingDept: row.managingDept,
      createdBy: row.createdBy,
      approvedAt: row.approvedAt instanceof Date ? row.approvedAt.toISOString() : row.approvedAt,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    }));

    return {
      data,
      meta: { total, limit, offset },
    };
  });

  // GET /lifecycle-plans/:id
  app.get('/:id', {
    schema: {
      params: Type.Object({ id: Type.String() }),
    },
  }, async (request, reply) => {
    const { id } = request.params;

    const result = await db.execute(sql`
      SELECT
        id, title, version,
        plan_start_year as "planStartYear", plan_end_year as "planEndYear",
        plan_status as "planStatus",
        asset_type as "assetType",
        baseline_condition as "baselineCondition",
        design_life as "designLife", remaining_life as "remainingLife",
        interventions,
        total_lifecycle_cost_jpy as "totalLifecycleCostJpy",
        annual_average_cost_jpy as "annualAverageCostJpy",
        asset_ref as "assetRef",
        managing_dept as "managingDept",
        created_by as "createdBy",
        approved_at as "approvedAt",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM lifecycle_plans
      WHERE id = ${id}
    `);

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Lifecycle plan not found' });
    }

    const row = result.rows[0] as Record<string, unknown>;
    return {
      data: {
        id: row.id,
        title: row.title,
        version: row.version,
        planStartYear: row.planStartYear,
        planEndYear: row.planEndYear,
        planStatus: row.planStatus,
        assetType: row.assetType,
        baselineCondition: row.baselineCondition,
        designLife: row.designLife,
        remainingLife: row.remainingLife,
        interventions: row.interventions,
        totalLifecycleCostJpy: row.totalLifecycleCostJpy != null ? Number(row.totalLifecycleCostJpy) : null,
        annualAverageCostJpy: row.annualAverageCostJpy != null ? Number(row.annualAverageCostJpy) : null,
        assetRef: row.assetRef,
        managingDept: row.managingDept,
        createdBy: row.createdBy,
        approvedAt: row.approvedAt instanceof Date ? row.approvedAt.toISOString() : row.approvedAt,
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
        updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
      },
    };
  });
}

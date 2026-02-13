/**
 * PoC Audit Logs route — GET list/detail (read-only).
 *
 * Registered conditionally when POC_ENABLED=true.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../backend/src/db/index.js';
import { sql } from 'drizzle-orm';
import { requirePermission, extractIdentity } from '../middleware/permission-guard.js';

export async function pocAuditLogsRoutes(fastify: FastifyInstance) {
  // -----------------------------------------------------------------------
  // GET /poc/audit-logs — list audit logs with filters
  // -----------------------------------------------------------------------
  fastify.get('/', {
    preHandler: requirePermission('audit_logs', 'list'),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const { role, partnerId } = extractIdentity(request);

    const conditions: ReturnType<typeof sql>[] = [];

    if (query.entityType) {
      conditions.push(sql`al.entity_type = ${query.entityType}`);
    }
    if (query.entityId) {
      conditions.push(sql`al.entity_id = ${query.entityId}`);
    }
    if (query.action) {
      conditions.push(sql`al.action = ${query.action}`);
    }
    if (query.actor) {
      conditions.push(sql`al.actor = ${query.actor}`);
    }
    if (query.from) {
      conditions.push(sql`al.created_at >= ${query.from}::timestamptz`);
    }
    if (query.to) {
      conditions.push(sql`al.created_at < ${query.to}::timestamptz`);
    }

    // Partner scoping: only see own actions
    if (role === 'partner' && partnerId) {
      conditions.push(sql`al.actor_partner_id = ${partnerId}`);
    }

    const limit = Math.min(parseInt(query.limit ?? '50', 10), 200);
    const offset = parseInt(query.offset ?? '0', 10);

    const whereClause = conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;

    const data = await db.execute<Record<string, unknown>>(sql`
      SELECT al.id,
             al.entity_type as "entityType", al.entity_id as "entityId",
             al.action, al.description,
             al.before_snapshot as "beforeSnapshot",
             al.after_snapshot as "afterSnapshot",
             al.changed_fields as "changedFields",
             al.actor, al.actor_role as "actorRole",
             al.actor_partner_id as "actorPartnerId",
             al.request_id as "requestId",
             al.decision_id as "decisionId",
             al.created_at as "createdAt"
      FROM audit_logs al
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    // Total count for pagination
    const countResult = await db.execute<{ count: number }>(sql`
      SELECT COUNT(*)::int as count
      FROM audit_logs al
      ${whereClause}
    `);

    return reply.send({
      data: data.rows,
      total: countResult.rows[0]?.count ?? 0,
      limit,
      offset,
    });
  });

  // -----------------------------------------------------------------------
  // GET /poc/audit-logs/:id — get audit detail with decision info
  // -----------------------------------------------------------------------
  fastify.get('/:id', {
    preHandler: requirePermission('audit_logs', 'view'),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const result = await db.execute<Record<string, unknown>>(sql`
      SELECT al.id,
             al.entity_type as "entityType", al.entity_id as "entityId",
             al.action, al.description,
             al.before_snapshot as "beforeSnapshot",
             al.after_snapshot as "afterSnapshot",
             al.changed_fields as "changedFields",
             al.actor, al.actor_role as "actorRole",
             al.actor_partner_id as "actorPartnerId",
             al.ip_address as "ipAddress",
             al.request_id as "requestId",
             al.decision_id as "decisionId",
             al.created_at as "createdAt",
             d.id as "decision.id",
             d.decision_type as "decision.decisionType",
             d.outcome as "decision.outcome",
             d.decided_by as "decision.decidedBy",
             d.decided_at as "decision.decidedAt"
      FROM audit_logs al
      LEFT JOIN decisions d ON d.id = al.decision_id
      WHERE al.id = ${id}
    `);

    if (result.rows.length === 0) {
      return reply.status(404).send({ error: 'Audit log not found' });
    }

    const row = result.rows[0];

    // Reshape flat row to nested object
    const auditLog: Record<string, unknown> = {
      id: row.id,
      entityType: row.entityType,
      entityId: row.entityId,
      action: row.action,
      description: row.description,
      beforeSnapshot: row.beforeSnapshot,
      afterSnapshot: row.afterSnapshot,
      changedFields: row.changedFields,
      actor: row.actor,
      actorRole: row.actorRole,
      actorPartnerId: row.actorPartnerId,
      ipAddress: row.ipAddress,
      requestId: row.requestId,
      createdAt: row.createdAt,
    };

    if (row['decision.id']) {
      auditLog.decision = {
        id: row['decision.id'],
        decisionType: row['decision.decisionType'],
        outcome: row['decision.outcome'],
        decidedBy: row['decision.decidedBy'],
        decidedAt: row['decision.decidedAt'],
      };
    } else {
      auditLog.decision = null;
    }

    return reply.send(auditLog);
  });

  // -----------------------------------------------------------------------
  // GET /poc/audit-logs/report/activity — aggregate activity report
  // -----------------------------------------------------------------------
  fastify.get('/report/activity', {
    preHandler: requirePermission('audit_logs', 'list'),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;

    const from = query.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const to = query.to ?? new Date().toISOString();

    const data = await db.execute<Record<string, unknown>>(sql`
      SELECT DATE_TRUNC('day', al.created_at) as "day",
             al.entity_type as "entityType",
             al.action,
             COUNT(*)::int as "count",
             COUNT(DISTINCT al.actor)::int as "uniqueActors"
      FROM audit_logs al
      WHERE al.created_at >= ${from}::timestamptz
        AND al.created_at < ${to}::timestamptz
      GROUP BY 1, 2, 3
      ORDER BY 1 DESC, 4 DESC
    `);

    return reply.send({ data: data.rows, from, to });
  });
}

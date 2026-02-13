/**
 * PoC Decisions route — GET list/detail, POST create.
 *
 * Registered conditionally when POC_ENABLED=true.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../backend/src/db/index.js';
import { sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { requirePermission, extractIdentity } from '../middleware/permission-guard.js';
import { withTransaction } from '../middleware/transaction-wrapper.js';
import { writeAuditLog } from '../middleware/audit-writer.js';

export async function pocDecisionsRoutes(fastify: FastifyInstance) {
  // -----------------------------------------------------------------------
  // GET /poc/decisions — list decisions with filters
  // -----------------------------------------------------------------------
  fastify.get('/', {
    preHandler: requirePermission('decisions', 'list'),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const { role, partnerId } = extractIdentity(request);

    const conditions: ReturnType<typeof sql>[] = [];

    if (query.entityType) {
      conditions.push(sql`d.entity_type = ${query.entityType}`);
    }
    if (query.entityId) {
      conditions.push(sql`d.entity_id = ${query.entityId}`);
    }
    if (query.decisionType) {
      conditions.push(sql`d.decision_type = ${query.decisionType}`);
    }
    if (query.outcome) {
      conditions.push(sql`d.outcome = ${query.outcome}`);
    }

    // Partner scoping: only see decisions related to their work orders' evidence
    if (role === 'partner' && partnerId) {
      conditions.push(sql`(
        d.entity_type = 'evidence' AND d.entity_id IN (
          SELECT e.id FROM evidence e
          JOIN work_orders wo ON wo.id = e.work_order_id
          JOIN work_order_partners wop ON wop.work_order_id = wo.id
          WHERE wop.partner_id = ${partnerId}
        )
      )`);
    }

    const whereClause = conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;

    const limit = Math.min(parseInt(query.limit ?? '50', 10), 200);
    const offset = parseInt(query.offset ?? '0', 10);

    const data = await db.execute<Record<string, unknown>>(sql`
      SELECT d.id, d.entity_type as "entityType", d.entity_id as "entityId",
             d.decision_type as "decisionType", d.outcome,
             d.rationale, d.conditions,
             d.previous_status as "previousStatus", d.new_status as "newStatus",
             d.decided_by as "decidedBy", d.decided_by_role as "decidedByRole",
             d.decided_at as "decidedAt",
             d.created_at as "createdAt"
      FROM decisions d
      ${whereClause}
      ORDER BY d.decided_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    return reply.send({ data: data.rows, limit, offset });
  });

  // -----------------------------------------------------------------------
  // GET /poc/decisions/:id — get decision detail with linked audit logs
  // -----------------------------------------------------------------------
  fastify.get('/:id', {
    preHandler: requirePermission('decisions', 'view'),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const decisionResult = await db.execute<Record<string, unknown>>(sql`
      SELECT d.id, d.entity_type as "entityType", d.entity_id as "entityId",
             d.decision_type as "decisionType", d.outcome,
             d.rationale, d.conditions,
             d.previous_status as "previousStatus", d.new_status as "newStatus",
             d.decided_by as "decidedBy", d.decided_by_role as "decidedByRole",
             d.decided_at as "decidedAt",
             d.created_at as "createdAt"
      FROM decisions d
      WHERE d.id = ${id}
    `);

    if (decisionResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Decision not found' });
    }

    // Linked audit logs
    const auditResult = await db.execute<Record<string, unknown>>(sql`
      SELECT al.id, al.action, al.description,
             al.before_snapshot as "beforeSnapshot",
             al.after_snapshot as "afterSnapshot",
             al.changed_fields as "changedFields",
             al.actor, al.actor_role as "actorRole",
             al.created_at as "createdAt"
      FROM audit_logs al
      WHERE al.decision_id = ${id}
      ORDER BY al.created_at DESC
    `);

    return reply.send({
      decision: decisionResult.rows[0],
      auditLogs: auditResult.rows,
    });
  });

  // -----------------------------------------------------------------------
  // POST /poc/decisions — create a decision (with audit log in transaction)
  // -----------------------------------------------------------------------
  fastify.post('/', {
    preHandler: requirePermission('decisions', 'create'),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const { role, partnerId } = extractIdentity(request);

    // Validate required fields
    const required = ['entityType', 'entityId', 'decisionType', 'outcome'];
    for (const field of required) {
      if (!body[field]) {
        return reply.status(400).send({ error: `Missing required field: ${field}` });
      }
    }

    const decisionId = `DEC-${nanoid(12)}`;

    const result = await withTransaction(async (client) => {
      // Insert decision
      await client.query(
        `INSERT INTO decisions (
          id, entity_type, entity_id, decision_type, outcome,
          rationale, conditions, previous_status, new_status,
          decided_by, decided_by_role
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          decisionId,
          body.entityType,
          body.entityId,
          body.decisionType,
          body.outcome,
          (body.rationale as string) ?? null,
          (body.conditions as string) ?? null,
          (body.previousStatus as string) ?? null,
          (body.newStatus as string) ?? null,
          role,
          role,
        ],
      );

      // Write audit log
      await writeAuditLog(client, {
        entityType: body.entityType as string,
        entityId: body.entityId as string,
        action: 'decision',
        description: `Decision ${decisionId}: ${body.decisionType} → ${body.outcome}`,
        afterSnapshot: {
          decisionId,
          decisionType: body.decisionType,
          outcome: body.outcome,
          decidedBy: role,
        },
        actor: role,
        actorRole: role,
        actorPartnerId: partnerId ?? undefined,
        decisionId,
      });

      return { decisionId };
    }, { label: 'create-decision' });

    return reply.status(201).send({
      id: result.data.decisionId,
      durationMs: result.durationMs,
      retries: result.retries,
    });
  });
}

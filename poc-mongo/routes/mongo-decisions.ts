/**
 * MongoDB-backed Decisions route — mirrors poc/routes/decisions.ts.
 *
 * Registered conditionally when POC_MONGO_ENABLED=true.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MongoClient } from 'mongodb';
import { nanoid } from 'nanoid';
import { requirePermission, extractIdentity } from '../../poc/middleware/permission-guard.js';

const MONGO_URL = process.env.MONGO_BENCH_URL ?? 'mongodb://localhost:27019/nagoya_bench?directConnection=true';
let client: MongoClient;

function getDb() {
  return client.db();
}

export async function mongoDecisionsRoutes(fastify: FastifyInstance) {
  client = new MongoClient(MONGO_URL, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });
  await client.connect();

  fastify.addHook('onClose', async () => {
    await client.close();
  });

  // -----------------------------------------------------------------------
  // GET / — list decisions with filters
  // -----------------------------------------------------------------------
  fastify.get('/', {
    preHandler: requirePermission('decisions', 'list'),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const { role, partnerId } = extractIdentity(request);
    const db = getDb();

    const filter: Record<string, unknown> = {};

    if (query.entityType) filter.entity_type = query.entityType;
    if (query.entityId) filter.entity_id = query.entityId;
    if (query.decisionType) filter.decision_type = query.decisionType;
    if (query.outcome) filter.outcome = query.outcome;

    // Partner scoping
    if (role === 'partner' && partnerId) {
      const partnerWoIds = await db.collection('work_order_partners')
        .find({ partner_id: partnerId })
        .project({ work_order_id: 1 })
        .toArray();
      const woIds = partnerWoIds.map(p => p.work_order_id);

      const partnerEvIds = await db.collection('evidence')
        .find({ work_order_id: { $in: woIds } })
        .project({ id: 1 })
        .toArray();
      const evIds = partnerEvIds.map(e => e.id);

      filter.entity_type = 'evidence';
      filter.entity_id = { $in: evIds };
    }

    const limit = Math.min(parseInt(query.limit ?? '50', 10), 200);
    const offset = parseInt(query.offset ?? '0', 10);

    const data = await db.collection('decisions')
      .find(filter)
      .sort({ decided_at: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    // Map to camelCase
    const mapped = data.map(d => ({
      id: d.id,
      entityType: d.entity_type,
      entityId: d.entity_id,
      decisionType: d.decision_type,
      outcome: d.outcome,
      rationale: d.rationale,
      conditions: d.conditions,
      previousStatus: d.previous_status,
      newStatus: d.new_status,
      decidedBy: d.decided_by,
      decidedByRole: d.decided_by_role,
      decidedAt: d.decided_at,
      createdAt: d.created_at,
    }));

    return reply.send({ data: mapped, limit, offset });
  });

  // -----------------------------------------------------------------------
  // GET /:id — decision detail with linked audit logs
  // -----------------------------------------------------------------------
  fastify.get('/:id', {
    preHandler: requirePermission('decisions', 'view'),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const db = getDb();

    const doc = await db.collection('decisions').findOne({ id });
    if (!doc) {
      return reply.status(404).send({ error: 'Decision not found' });
    }

    const auditLogs = await db.collection('audit_logs')
      .find({ decision_id: id })
      .sort({ created_at: -1 })
      .toArray();

    return reply.send({
      decision: {
        id: doc.id,
        entityType: doc.entity_type,
        entityId: doc.entity_id,
        decisionType: doc.decision_type,
        outcome: doc.outcome,
        rationale: doc.rationale,
        conditions: doc.conditions,
        previousStatus: doc.previous_status,
        newStatus: doc.new_status,
        decidedBy: doc.decided_by,
        decidedByRole: doc.decided_by_role,
        decidedAt: doc.decided_at,
        createdAt: doc.created_at,
      },
      auditLogs: auditLogs.map(al => ({
        id: al.id,
        action: al.action,
        description: al.description,
        beforeSnapshot: al.before_snapshot,
        afterSnapshot: al.after_snapshot,
        changedFields: al.changed_fields,
        actor: al.actor,
        actorRole: al.actor_role,
        createdAt: al.created_at,
      })),
    });
  });

  // -----------------------------------------------------------------------
  // POST / — create a decision (with audit log in transaction)
  // -----------------------------------------------------------------------
  fastify.post('/', {
    preHandler: requirePermission('decisions', 'create'),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const { role, partnerId } = extractIdentity(request);
    const db = getDb();

    const required = ['entityType', 'entityId', 'decisionType', 'outcome'];
    for (const field of required) {
      if (!body[field]) {
        return reply.status(400).send({ error: `Missing required field: ${field}` });
      }
    }

    const decisionId = `DEC-${nanoid(12)}`;
    const auditId = `AUD-${nanoid(12)}`;
    const now = new Date();

    const session = client.startSession();
    const start = performance.now();
    let retries = 0;

    try {
      await session.withTransaction(async () => {
        await db.collection('decisions').insertOne({
          id: decisionId,
          entity_type: body.entityType,
          entity_id: body.entityId,
          decision_type: body.decisionType,
          outcome: body.outcome,
          rationale: (body.rationale as string) ?? null,
          conditions: (body.conditions as string) ?? null,
          previous_status: (body.previousStatus as string) ?? null,
          new_status: (body.newStatus as string) ?? null,
          decided_by: role,
          decided_by_role: role,
          decided_at: now,
          created_at: now,
          updated_at: now,
        }, { session });

        await db.collection('audit_logs').insertOne({
          id: auditId,
          entity_type: body.entityType as string,
          entity_id: body.entityId as string,
          action: 'decision',
          description: `Decision ${decisionId}: ${body.decisionType} → ${body.outcome}`,
          after_snapshot: {
            decisionId,
            decisionType: body.decisionType,
            outcome: body.outcome,
            decidedBy: role,
          },
          actor: role,
          actor_role: role,
          actor_partner_id: partnerId ?? null,
          decision_id: decisionId,
          created_at: now,
        }, { session });
      }, {
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
      });
    } finally {
      await session.endSession();
    }

    const durationMs = performance.now() - start;

    return reply.status(201).send({
      id: decisionId,
      durationMs,
      retries,
    });
  });
}

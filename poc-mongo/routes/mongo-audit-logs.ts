/**
 * MongoDB-backed Audit Logs route — mirrors poc/routes/audit-logs.ts.
 *
 * Registered conditionally when POC_MONGO_ENABLED=true.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { MongoClient } from 'mongodb';
import { requirePermission, extractIdentity } from '../../poc/middleware/permission-guard.js';

const MONGO_URL = process.env.MONGO_BENCH_URL ?? 'mongodb://localhost:27019/nagoya_bench?directConnection=true';
let client: MongoClient;

function getDb() {
  return client.db();
}

export async function mongoAuditLogsRoutes(fastify: FastifyInstance) {
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
  // GET / — list audit logs with filters
  // -----------------------------------------------------------------------
  fastify.get('/', {
    preHandler: requirePermission('audit_logs', 'list'),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const { role, partnerId } = extractIdentity(request);
    const db = getDb();

    const filter: Record<string, unknown> = {};

    if (query.entityType) filter.entity_type = query.entityType;
    if (query.entityId) filter.entity_id = query.entityId;
    if (query.action) filter.action = query.action;
    if (query.actor) filter.actor = query.actor;
    if (query.from || query.to) {
      filter.created_at = {};
      if (query.from) (filter.created_at as Record<string, unknown>).$gte = new Date(query.from);
      if (query.to) (filter.created_at as Record<string, unknown>).$lt = new Date(query.to);
    }

    // Partner scoping
    if (role === 'partner' && partnerId) {
      filter.actor_partner_id = partnerId;
    }

    const limit = Math.min(parseInt(query.limit ?? '50', 10), 200);
    const offset = parseInt(query.offset ?? '0', 10);

    const [data, total] = await Promise.all([
      db.collection('audit_logs')
        .find(filter)
        .sort({ created_at: -1 })
        .skip(offset)
        .limit(limit)
        .toArray(),
      db.collection('audit_logs').countDocuments(filter),
    ]);

    const mapped = data.map(al => ({
      id: al.id,
      entityType: al.entity_type,
      entityId: al.entity_id,
      action: al.action,
      description: al.description,
      beforeSnapshot: al.before_snapshot,
      afterSnapshot: al.after_snapshot,
      changedFields: al.changed_fields,
      actor: al.actor,
      actorRole: al.actor_role,
      actorPartnerId: al.actor_partner_id,
      requestId: al.request_id,
      decisionId: al.decision_id,
      createdAt: al.created_at,
    }));

    return reply.send({ data: mapped, total, limit, offset });
  });

  // -----------------------------------------------------------------------
  // GET /:id — audit detail with decision info
  // -----------------------------------------------------------------------
  fastify.get('/:id', {
    preHandler: requirePermission('audit_logs', 'view'),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const db = getDb();

    const doc = await db.collection('audit_logs').findOne({ id });
    if (!doc) {
      return reply.status(404).send({ error: 'Audit log not found' });
    }

    let decision = null;
    if (doc.decision_id) {
      const decDoc = await db.collection('decisions').findOne({ id: doc.decision_id });
      if (decDoc) {
        decision = {
          id: decDoc.id,
          decisionType: decDoc.decision_type,
          outcome: decDoc.outcome,
          decidedBy: decDoc.decided_by,
          decidedAt: decDoc.decided_at,
        };
      }
    }

    return reply.send({
      id: doc.id,
      entityType: doc.entity_type,
      entityId: doc.entity_id,
      action: doc.action,
      description: doc.description,
      beforeSnapshot: doc.before_snapshot,
      afterSnapshot: doc.after_snapshot,
      changedFields: doc.changed_fields,
      actor: doc.actor,
      actorRole: doc.actor_role,
      actorPartnerId: doc.actor_partner_id,
      ipAddress: doc.ip_address,
      requestId: doc.request_id,
      createdAt: doc.created_at,
      decision,
    });
  });

  // -----------------------------------------------------------------------
  // GET /report/activity — aggregate activity report
  // -----------------------------------------------------------------------
  fastify.get('/report/activity', {
    preHandler: requirePermission('audit_logs', 'list'),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const db = getDb();

    const from = query.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const to = query.to ?? new Date().toISOString();

    const data = await db.collection('audit_logs').aggregate([
      { $match: { created_at: { $gte: new Date(from), $lt: new Date(to) } } },
      { $group: {
        _id: {
          day: { $dateTrunc: { date: '$created_at', unit: 'day' } },
          entityType: '$entity_type',
          action: '$action',
        },
        count: { $sum: 1 },
        uniqueActors: { $addToSet: '$actor' },
      }},
      { $project: {
        _id: 0,
        day: '$_id.day',
        entityType: '$_id.entityType',
        action: '$_id.action',
        count: 1,
        uniqueActors: { $size: '$uniqueActors' },
      }},
      { $sort: { day: -1, count: -1 } },
    ]).toArray();

    return reply.send({ data, from, to });
  });
}

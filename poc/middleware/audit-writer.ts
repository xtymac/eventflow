/**
 * Audit log writer — called within transactions to record audit entries.
 *
 * Usage (inside a withTransaction callback):
 *   await writeAuditLog(client, {
 *     entityType: 'event',
 *     entityId: 'CE-001',
 *     action: 'close',
 *     description: 'Event CE-001 closed by gov_admin',
 *     beforeSnapshot: { status: 'pending_review' },
 *     afterSnapshot: { status: 'closed', closedBy: 'gov_admin' },
 *     changedFields: ['status', 'closedBy', 'closedAt'],
 *     actor: 'gov_admin',
 *     actorRole: 'gov_admin',
 *     decisionId: 'DEC-001',
 *   });
 */

import pg from 'pg';
import { nanoid } from 'nanoid';

export interface AuditEntry {
  entityType: string;
  entityId: string;
  action: string;
  description?: string;
  beforeSnapshot?: Record<string, unknown> | null;
  afterSnapshot?: Record<string, unknown> | null;
  changedFields?: string[];
  actor: string;
  actorRole?: string;
  actorPartnerId?: string;
  ipAddress?: string;
  requestId?: string;
  decisionId?: string;
}

/**
 * Insert an audit log entry using a transactional client.
 * Returns the generated audit log ID.
 */
export async function writeAuditLog(
  client: pg.PoolClient,
  entry: AuditEntry,
): Promise<string> {
  const id = `AUD-${nanoid(12)}`;

  await client.query(
    `INSERT INTO audit_logs (
      id, entity_type, entity_id, action, description,
      before_snapshot, after_snapshot, changed_fields,
      actor, actor_role, actor_partner_id,
      ip_address, request_id, decision_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      id,
      entry.entityType,
      entry.entityId,
      entry.action,
      entry.description ?? null,
      entry.beforeSnapshot ? JSON.stringify(entry.beforeSnapshot) : null,
      entry.afterSnapshot ? JSON.stringify(entry.afterSnapshot) : null,
      entry.changedFields ? JSON.stringify(entry.changedFields) : null,
      entry.actor,
      entry.actorRole ?? null,
      entry.actorPartnerId ?? null,
      entry.ipAddress ?? null,
      entry.requestId ?? null,
      entry.decisionId ?? null,
    ],
  );

  return id;
}

/**
 * Insert multiple audit log entries in a single batch.
 * Used when a transaction affects multiple entities (e.g., TX3: WO complete + event cascade).
 */
export async function writeAuditLogBatch(
  client: pg.PoolClient,
  entries: AuditEntry[],
): Promise<string[]> {
  const ids: string[] = [];
  for (const entry of entries) {
    const id = await writeAuditLog(client, entry);
    ids.push(id);
  }
  return ids;
}

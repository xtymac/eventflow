/**
 * Permission guard — application-level RBAC for the PoC.
 *
 * Wraps the existing x-user-role / x-partner-id header pattern
 * into a reusable permission checking function.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../backend/src/db/index.js';
import { sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Role definitions
// ---------------------------------------------------------------------------
export type Role = 'gov_event_ops' | 'gov_master_data' | 'partner' | 'public';

export type Resource =
  | 'events'
  | 'work_orders'
  | 'evidence'
  | 'assets'
  | 'inspections'
  | 'decisions'
  | 'audit_logs';

export type Action = 'list' | 'view' | 'create' | 'update' | 'delete' | 'close' | 'review' | 'decide';

// ---------------------------------------------------------------------------
// Permission matrix (static)
// ---------------------------------------------------------------------------
type PermissionEntry = {
  allow: boolean;
  /** If true, partner/public visibility is scoped (row-level filtering needed) */
  scoped?: boolean;
};

const MATRIX: Record<Role, Partial<Record<Resource, Partial<Record<Action, PermissionEntry>>>>> = {
  gov_event_ops: {
    events:      { list: { allow: true }, view: { allow: true }, create: { allow: true }, update: { allow: true }, close: { allow: true } },
    work_orders: { list: { allow: true }, view: { allow: true }, create: { allow: true }, update: { allow: true } },
    evidence:    { list: { allow: true }, view: { allow: true }, create: { allow: true }, review: { allow: true }, decide: { allow: true } },
    assets:      { list: { allow: true }, view: { allow: true } },
    inspections: { list: { allow: true }, view: { allow: true } },
    decisions:   { list: { allow: true }, view: { allow: true }, create: { allow: true } },
    audit_logs:  { list: { allow: true }, view: { allow: true } },
  },
  gov_master_data: {
    events:      { list: { allow: true }, view: { allow: true } },
    work_orders: { list: { allow: true }, view: { allow: true } },
    evidence:    { list: { allow: true }, view: { allow: true } },
    assets:      { list: { allow: true }, view: { allow: true }, create: { allow: true }, update: { allow: true } },
    inspections: { list: { allow: true }, view: { allow: true }, create: { allow: true } },
    decisions:   { list: { allow: true }, view: { allow: true }, create: { allow: true } },
    audit_logs:  { list: { allow: true }, view: { allow: true } },
  },
  partner: {
    events:      { list: { allow: true, scoped: true }, view: { allow: true, scoped: true } },
    work_orders: { list: { allow: true, scoped: true }, view: { allow: true, scoped: true }, update: { allow: true, scoped: true } },
    evidence:    { list: { allow: true, scoped: true }, view: { allow: true, scoped: true }, create: { allow: true, scoped: true } },
    assets:      { list: { allow: true }, view: { allow: true } },
    inspections: { list: { allow: true, scoped: true }, view: { allow: true, scoped: true } },
    decisions:   { list: { allow: true, scoped: true }, view: { allow: true, scoped: true } },
    audit_logs:  { list: { allow: true, scoped: true }, view: { allow: true, scoped: true } },
  },
  public: {
    events:      { list: { allow: true, scoped: true }, view: { allow: true, scoped: true } },
    work_orders: {},
    evidence:    {},
    assets:      { list: { allow: true, scoped: true }, view: { allow: true, scoped: true } },
    inspections: {},
    decisions:   {},
    audit_logs:  {},
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface PermissionCheckResult {
  allowed: boolean;
  scoped: boolean;
  reason?: string;
}

/**
 * Check if a role is allowed to perform an action on a resource.
 */
export function checkPermission(role: Role, resource: Resource, action: Action): PermissionCheckResult {
  const roleDef = MATRIX[role];
  if (!roleDef) {
    return { allowed: false, scoped: false, reason: `Unknown role: ${role}` };
  }

  const resourceDef = roleDef[resource];
  if (!resourceDef) {
    return { allowed: false, scoped: false, reason: `${role} has no access to ${resource}` };
  }

  const actionDef = resourceDef[action];
  if (!actionDef) {
    return { allowed: false, scoped: false, reason: `${role} cannot ${action} ${resource}` };
  }

  return {
    allowed: actionDef.allow,
    scoped: actionDef.scoped ?? false,
  };
}

/**
 * Extract role and partner ID from Fastify request headers.
 */
export function extractIdentity(request: FastifyRequest): { role: Role; partnerId: string | null } {
  const roleHeader = (request.headers['x-user-role'] as string) ?? 'public';
  const partnerId = (request.headers['x-partner-id'] as string) ?? null;

  const validRoles: Role[] = ['gov_event_ops', 'gov_master_data', 'partner', 'public'];
  const role: Role = validRoles.includes(roleHeader as Role) ? (roleHeader as Role) : 'public';

  return { role, partnerId };
}

/**
 * Verify that a partner is assigned to a specific work order.
 * Used for row-level scoping.
 */
export async function checkPartnerScope(partnerId: string, workOrderId: string): Promise<boolean> {
  const result = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*)::int as count
    FROM work_order_partners
    WHERE partner_id = ${partnerId} AND work_order_id = ${workOrderId}
  `);
  return (result.rows[0]?.count ?? 0) > 0;
}

/**
 * Fastify preHandler hook for permission checking.
 * Usage: { preHandler: requirePermission('decisions', 'list') }
 */
export function requirePermission(resource: Resource, action: Action) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const { role } = extractIdentity(request);
    const check = checkPermission(role, resource, action);

    if (!check.allowed) {
      return reply.status(403).send({
        error: check.reason ?? 'Forbidden',
        role,
        resource,
        action,
        hint: `Set X-User-Role header to an authorized role`,
      });
    }
  };
}

/**
 * Get the full permission matrix (for testing / reports).
 */
export function getPermissionMatrix() {
  return MATRIX;
}

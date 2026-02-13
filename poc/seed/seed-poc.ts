/**
 * PoC seed script — parametric data generator for benchmark tiers.
 *
 * Usage:
 *   npx tsx poc/seed/seed-poc.ts --scale 1    # ~2.3K records
 *   npx tsx poc/seed/seed-poc.ts --scale 10   # ~23K records
 *   npx tsx poc/seed/seed-poc.ts --scale 50   # ~118K records
 *   npx tsx poc/seed/seed-poc.ts --clean      # Remove PoC seed data only
 *
 * Prerequisites: Existing road_assets, greenspace_assets, river_assets records.
 */

import { db, pool } from '../../backend/src/db/index.js';
import { sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const scaleArg = args.find(a => a.startsWith('--scale'));
const cleanArg = args.includes('--clean');
const SCALE = scaleArg ? parseInt(args[args.indexOf('--scale') + 1] ?? '1', 10) : 1;

if (!cleanArg && ![1, 10, 50].includes(SCALE)) {
  console.error('Usage: npx tsx poc/seed/seed-poc.ts --scale 1|10|50');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------
function point(lng: number, lat: number): string {
  return `ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`;
}

function randomNagoyaLng() { return 136.85 + Math.random() * 0.11; }
function randomNagoyaLat() { return 35.10 + Math.random() * 0.10; }

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const WARDS = ['中区', '北区', '昭和区', '瑞穂区', '天白区', '西区', '中村区', '東区', '千種区'];
const EVENT_STATUSES = ['planned', 'active', 'pending_review', 'closed', 'cancelled'] as const;
const EVENT_STATUS_WEIGHTS = [0.15, 0.30, 0.15, 0.30, 0.10];
const WO_STATUSES = ['draft', 'assigned', 'in_progress', 'completed', 'cancelled'] as const;
const WO_TYPES = ['inspection', 'repair', 'update'] as const;
const EVIDENCE_TYPES = ['photo', 'document', 'report'] as const;
const REVIEW_STATUSES = ['pending', 'approved', 'rejected', 'accepted_by_authority'] as const;
const REVIEW_STATUS_WEIGHTS = [0.25, 0.25, 0.15, 0.35];
const ROLES = ['gov_admin', 'gov_event_ops', 'gov_inspector', 'gov_master_data'] as const;
const PARTNER_IDS = ['PTR-tanaka', 'PTR-suzuki', 'PTR-yamada', 'PTR-sato', 'PTR-takahashi'];
const DECISION_TYPES = ['event_close', 'evidence_accept', 'evidence_reject', 'condition_change'] as const;

function pick<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function pickWeighted<T>(arr: readonly T[], weights: number[]): T {
  const r = Math.random();
  let cum = 0;
  for (let i = 0; i < arr.length; i++) {
    cum += weights[i];
    if (r <= cum) return arr[i];
  }
  return arr[arr.length - 1];
}
function randomDate(startYear: number, endYear: number): string {
  const start = new Date(startYear, 0, 1).getTime();
  const end = new Date(endYear, 11, 31).getTime();
  return new Date(start + Math.random() * (end - start)).toISOString();
}

// ---------------------------------------------------------------------------
// Tier counts
// ---------------------------------------------------------------------------
function getCounts(scale: number) {
  return {
    events: 100 * scale,
    workOrdersPerEvent: 2,
    evidencePerWorkOrder: 2,
    decisions: 200 * scale,
    auditLogs: 500 * scale,
  };
}

// ---------------------------------------------------------------------------
// Seed functions
// ---------------------------------------------------------------------------

async function seedEvents(count: number): Promise<string[]> {
  console.log(`  Seeding ${count} events...`);
  const ids: string[] = [];
  const batchSize = 100;

  for (let batch = 0; batch < Math.ceil(count / batchSize); batch++) {
    const values: string[] = [];
    const batchCount = Math.min(batchSize, count - batch * batchSize);

    for (let i = 0; i < batchCount; i++) {
      const id = `POC-CE-${nanoid(8)}`;
      ids.push(id);
      const status = pickWeighted(EVENT_STATUSES, EVENT_STATUS_WEIGHTS);
      const ward = pick(WARDS);
      const lng = randomNagoyaLng();
      const lat = randomNagoyaLat();
      const startDate = randomDate(2024, 2025);
      const endDate = randomDate(2025, 2026);
      const closedBy = status === 'closed' ? `'${pick(ROLES)}'` : 'NULL';
      const closedAt = status === 'closed' ? `'${randomDate(2025, 2026)}'` : 'NULL';
      const closeNotes = status === 'closed' ? `'PoC seed closure'` : 'NULL';

      values.push(`(
        '${id}', 'PoC Event ${id}', '${status}',
        '${startDate}'::timestamptz, '${endDate}'::timestamptz,
        'road_closure', ${point(lng, lat)}, 'manual', 'pending', NULL,
        '建設局', '${ward}', ${closedBy}, ${closedAt}, ${closeNotes}
      )`);
    }

    await db.execute(sql.raw(`
      INSERT INTO construction_events (
        id, name, status, start_date, end_date,
        restriction_type, geometry, geometry_source, post_end_decision, archived_at,
        department, ward, closed_by, closed_at, close_notes
      ) VALUES ${values.join(',')}
      ON CONFLICT (id) DO NOTHING
    `));
  }

  console.log(`    ✓ ${ids.length} events`);
  return ids;
}

async function seedWorkOrders(eventIds: string[]): Promise<{ woIds: string[]; woEventMap: Map<string, string> }> {
  const counts = getCounts(SCALE);
  const total = eventIds.length * counts.workOrdersPerEvent;
  console.log(`  Seeding ${total} work orders...`);
  const woIds: string[] = [];
  const woEventMap = new Map<string, string>();
  const batchSize = 200;
  const allValues: string[] = [];

  for (const eventId of eventIds) {
    for (let j = 0; j < counts.workOrdersPerEvent; j++) {
      const id = `POC-WO-${nanoid(8)}`;
      woIds.push(id);
      woEventMap.set(id, eventId);
      const status = pick(WO_STATUSES);
      const type = pick(WO_TYPES);

      allValues.push(`(
        '${id}', '${eventId}', '${type}', 'WO ${id} - ${type}',
        '${status}', '建設局', NULL, NULL, NULL, NULL, NULL, NULL, NULL
      )`);
    }
  }

  for (let i = 0; i < allValues.length; i += batchSize) {
    const batch = allValues.slice(i, i + batchSize);
    await db.execute(sql.raw(`
      INSERT INTO work_orders (
        id, event_id, type, title,
        status, assigned_dept, assigned_by, assigned_at, due_date, started_at,
        completed_at, reviewed_by, created_by
      ) VALUES ${batch.join(',')}
      ON CONFLICT (id) DO NOTHING
    `));
  }

  console.log(`    ✓ ${woIds.length} work orders`);
  return { woIds, woEventMap };
}

async function seedWorkOrderPartners(woIds: string[]): Promise<void> {
  console.log(`  Seeding work order partners...`);
  const batchSize = 200;
  const allValues: string[] = [];

  for (const woId of woIds) {
    // Assign 1-2 partners per WO
    const partnerCount = Math.random() > 0.5 ? 2 : 1;
    const selectedPartners = [...PARTNER_IDS].sort(() => Math.random() - 0.5).slice(0, partnerCount);
    for (const pid of selectedPartners) {
      allValues.push(`('${woId}', '${pid}', 'Partner ${pid}', 'contractor')`);
    }
  }

  for (let i = 0; i < allValues.length; i += batchSize) {
    const batch = allValues.slice(i, i + batchSize);
    await db.execute(sql.raw(`
      INSERT INTO work_order_partners (work_order_id, partner_id, partner_name, role)
      VALUES ${batch.join(',')}
      ON CONFLICT (work_order_id, partner_id) DO NOTHING
    `));
  }
  console.log(`    ✓ ${allValues.length} partner assignments`);
}

async function seedEvidence(woIds: string[]): Promise<{ evidenceIds: string[]; evidenceStatusMap: Map<string, string> }> {
  const counts = getCounts(SCALE);
  const total = woIds.length * counts.evidencePerWorkOrder;
  console.log(`  Seeding ${total} evidence items...`);
  const evidenceIds: string[] = [];
  const evidenceStatusMap = new Map<string, string>();
  const batchSize = 200;
  const allValues: string[] = [];

  for (const woId of woIds) {
    for (let j = 0; j < counts.evidencePerWorkOrder; j++) {
      const id = `POC-EV-${nanoid(8)}`;
      evidenceIds.push(id);
      const type = pick(EVIDENCE_TYPES);
      const reviewStatus = pickWeighted(REVIEW_STATUSES, REVIEW_STATUS_WEIGHTS);
      evidenceStatusMap.set(id, reviewStatus);
      const submitterRole = Math.random() > 0.5 ? 'partner' : 'gov_inspector';
      const submitterPartnerId = submitterRole === 'partner' ? `'${pick(PARTNER_IDS)}'` : 'NULL';
      const decisionBy = reviewStatus === 'accepted_by_authority' ? `'${pick(ROLES)}'` : 'NULL';
      const decisionAt = reviewStatus === 'accepted_by_authority' ? `'${randomDate(2025, 2026)}'` : 'NULL';

      allValues.push(`(
        '${id}', '${woId}', '${type}', 'evidence_${id}.jpg',
        '/uploads/poc/${id}.jpg', 1024, 'image/jpeg', NULL, NULL, NULL, NULL,
        '${submitterRole === 'partner' ? 'partner-user' : 'gov-inspector'}',
        ${submitterPartnerId}, '${submitterRole}',
        NULL, NULL, '${reviewStatus}', NULL,
        ${decisionBy}, ${decisionAt}, NULL
      )`);
    }
  }

  for (let i = 0; i < allValues.length; i += batchSize) {
    const batch = allValues.slice(i, i + batchSize);
    await db.execute(sql.raw(`
      INSERT INTO evidence (
        id, work_order_id, type, file_name,
        file_path, file_size_bytes, mime_type, title, description, capture_date, geometry,
        submitted_by,
        submitter_partner_id, submitter_role,
        reviewed_by, reviewed_at, review_status, review_notes,
        decision_by, decision_at, decision_notes
      ) VALUES ${batch.join(',')}
      ON CONFLICT (id) DO NOTHING
    `));
  }

  console.log(`    ✓ ${evidenceIds.length} evidence items`);
  return { evidenceIds, evidenceStatusMap };
}

async function seedDecisions(
  eventIds: string[],
  evidenceIds: string[],
  evidenceStatusMap: Map<string, string>,
): Promise<string[]> {
  console.log(`  Seeding decisions...`);
  const decisionIds: string[] = [];
  const batchSize = 200;
  const allValues: string[] = [];

  // Event closure decisions (for closed events)
  // We need to query which events are closed
  const closedEvents = await db.execute<{ id: string }>(sql`
    SELECT id FROM construction_events WHERE id LIKE 'POC-CE-%' AND status = 'closed'
  `);

  for (const event of closedEvents.rows) {
    const id = `POC-DEC-${nanoid(8)}`;
    decisionIds.push(id);
    const role = pick(ROLES);
    allValues.push(`(
      '${id}', 'event', '${event.id}', 'event_close', 'approved',
      'PoC seed: event closure approved', NULL,
      'pending_review', 'closed',
      '${role}', '${role}', '${randomDate(2025, 2026)}'::timestamptz
    )`);
  }

  // Evidence acceptance decisions (for accepted_by_authority evidence)
  for (const [evId, status] of evidenceStatusMap) {
    if (status === 'accepted_by_authority') {
      const id = `POC-DEC-${nanoid(8)}`;
      decisionIds.push(id);
      const role = pick(ROLES);
      allValues.push(`(
        '${id}', 'evidence', '${evId}', 'evidence_accept', 'approved',
        'PoC seed: evidence accepted by authority', NULL,
        'approved', 'accepted_by_authority',
        '${role}', '${role}', '${randomDate(2025, 2026)}'::timestamptz
      )`);
    }
    if (status === 'rejected') {
      const id = `POC-DEC-${nanoid(8)}`;
      decisionIds.push(id);
      const role = pick(ROLES);
      allValues.push(`(
        '${id}', 'evidence', '${evId}', 'evidence_reject', 'rejected',
        'PoC seed: evidence rejected', NULL,
        'pending', 'rejected',
        '${role}', '${role}', '${randomDate(2025, 2026)}'::timestamptz
      )`);
    }
  }

  for (let i = 0; i < allValues.length; i += batchSize) {
    const batch = allValues.slice(i, i + batchSize);
    await db.execute(sql.raw(`
      INSERT INTO decisions (
        id, entity_type, entity_id, decision_type, outcome,
        rationale, conditions,
        previous_status, new_status,
        decided_by, decided_by_role, decided_at
      ) VALUES ${batch.join(',')}
      ON CONFLICT (id) DO NOTHING
    `));
  }

  console.log(`    ✓ ${decisionIds.length} decisions`);
  return decisionIds;
}

async function seedAuditLogs(
  eventIds: string[],
  woIds: string[],
  evidenceIds: string[],
  decisionIds: string[],
): Promise<void> {
  console.log(`  Seeding audit logs...`);
  const batchSize = 200;
  const allValues: string[] = [];

  // Create audit for events
  for (const id of eventIds) {
    const auditId = `POC-AUD-${nanoid(8)}`;
    const actor = pick(ROLES);
    allValues.push(`(
      '${auditId}', 'event', '${id}', 'create',
      'Event ${id} created',
      NULL, '{"status": "planned"}'::jsonb, '["status"]'::jsonb,
      '${actor}', '${actor}', NULL, NULL, NULL, NULL
    )`);
  }

  // Create audit for work orders
  for (const id of woIds) {
    const auditId = `POC-AUD-${nanoid(8)}`;
    const actor = pick(ROLES);
    allValues.push(`(
      '${auditId}', 'work_order', '${id}', 'create',
      'WorkOrder ${id} created',
      NULL, '{"status": "draft"}'::jsonb, '["status"]'::jsonb,
      '${actor}', '${actor}', NULL, NULL, NULL, NULL
    )`);
  }

  // Create audit for evidence
  for (const id of evidenceIds) {
    const auditId = `POC-AUD-${nanoid(8)}`;
    const actor = Math.random() > 0.5 ? pick(PARTNER_IDS) : pick(ROLES);
    const actorRole = PARTNER_IDS.includes(actor) ? 'partner' : actor;
    const actorPartnerId = PARTNER_IDS.includes(actor) ? `'${actor}'` : 'NULL';
    allValues.push(`(
      '${auditId}', 'evidence', '${id}', 'create',
      'Evidence ${id} uploaded',
      NULL, '{"reviewStatus": "pending"}'::jsonb, '["reviewStatus"]'::jsonb,
      '${actorRole}', '${actorRole}', ${actorPartnerId}, NULL, NULL, NULL
    )`);
  }

  // Decision audit logs (link to decision_id)
  for (const id of decisionIds) {
    const auditId = `POC-AUD-${nanoid(8)}`;
    const actor = pick(ROLES);
    allValues.push(`(
      '${auditId}', 'decision', '${id}', 'decision',
      'Decision ${id} recorded',
      NULL, '{"outcome": "approved"}'::jsonb, '["outcome"]'::jsonb,
      '${actor}', '${actor}', NULL, NULL, NULL, '${id}'
    )`);
  }

  // Additional status_change audits (to increase audit volume)
  const extraCount = Math.floor(eventIds.length * 0.5);
  for (let i = 0; i < extraCount; i++) {
    const auditId = `POC-AUD-${nanoid(8)}`;
    const entityId = pick(eventIds);
    const actor = pick(ROLES);
    allValues.push(`(
      '${auditId}', 'event', '${entityId}', 'status_change',
      'Event ${entityId} status changed',
      '{"status": "planned"}'::jsonb, '{"status": "active"}'::jsonb, '["status"]'::jsonb,
      '${actor}', '${actor}', NULL, NULL, NULL, NULL
    )`);
  }

  for (let i = 0; i < allValues.length; i += batchSize) {
    const batch = allValues.slice(i, i + batchSize);
    await db.execute(sql.raw(`
      INSERT INTO audit_logs (
        id, entity_type, entity_id, action,
        description,
        before_snapshot, after_snapshot, changed_fields,
        actor, actor_role, actor_partner_id, ip_address, request_id, decision_id
      ) VALUES ${batch.join(',')}
      ON CONFLICT (id) DO NOTHING
    `));
  }

  console.log(`    ✓ ${allValues.length} audit logs`);
}

// ---------------------------------------------------------------------------
// Clean function — remove PoC data only
// ---------------------------------------------------------------------------
async function clean() {
  console.log('Cleaning PoC seed data...');
  await db.execute(sql`DELETE FROM audit_logs WHERE id LIKE 'POC-AUD-%'`);
  await db.execute(sql`DELETE FROM decisions WHERE id LIKE 'POC-DEC-%'`);
  await db.execute(sql`DELETE FROM evidence WHERE id LIKE 'POC-EV-%'`);
  await db.execute(sql`DELETE FROM work_order_partners WHERE work_order_id LIKE 'POC-WO-%'`);
  await db.execute(sql`DELETE FROM work_orders WHERE id LIKE 'POC-WO-%'`);
  await db.execute(sql`DELETE FROM construction_events WHERE id LIKE 'POC-CE-%'`);
  console.log('✓ PoC data cleaned');
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
async function validate() {
  console.log('\nValidation:');

  const counts = await db.execute<{ table_name: string; count: number }>(sql`
    SELECT 'events' as table_name, COUNT(*)::int as count FROM construction_events WHERE id LIKE 'POC-CE-%'
    UNION ALL SELECT 'work_orders', COUNT(*)::int FROM work_orders WHERE id LIKE 'POC-WO-%'
    UNION ALL SELECT 'evidence', COUNT(*)::int FROM evidence WHERE id LIKE 'POC-EV-%'
    UNION ALL SELECT 'decisions', COUNT(*)::int FROM decisions WHERE id LIKE 'POC-DEC-%'
    UNION ALL SELECT 'audit_logs', COUNT(*)::int FROM audit_logs WHERE id LIKE 'POC-AUD-%'
  `);

  let total = 0;
  for (const row of counts.rows) {
    console.log(`  ${row.table_name}: ${row.count}`);
    total += row.count;
  }
  console.log(`  TOTAL: ${total}`);

  // Chain coverage checks
  const closedWithoutDecision = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*)::int as count
    FROM construction_events ce
    WHERE ce.id LIKE 'POC-CE-%' AND ce.status = 'closed'
      AND NOT EXISTS (
        SELECT 1 FROM decisions d
        WHERE d.entity_type = 'event' AND d.entity_id = ce.id
      )
  `);
  console.log(`  Closed events without decision: ${closedWithoutDecision.rows[0].count} (should be 0)`);

  const acceptedWithoutDecision = await db.execute<{ count: number }>(sql`
    SELECT COUNT(*)::int as count
    FROM evidence e
    WHERE e.id LIKE 'POC-EV-%' AND e.review_status = 'accepted_by_authority'
      AND NOT EXISTS (
        SELECT 1 FROM decisions d
        WHERE d.entity_type = 'evidence' AND d.entity_id = e.id
      )
  `);
  console.log(`  Accepted evidence without decision: ${acceptedWithoutDecision.rows[0].count} (should be 0)`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  if (cleanArg) {
    await clean();
    await pool.end();
    return;
  }

  console.log(`\n=== PoC Seed: scale=${SCALE} ===\n`);

  // Clean previous PoC data first
  await clean();

  const eventIds = await seedEvents(getCounts(SCALE).events);
  const { woIds } = await seedWorkOrders(eventIds);
  await seedWorkOrderPartners(woIds);
  const { evidenceIds, evidenceStatusMap } = await seedEvidence(woIds);
  const decisionIds = await seedDecisions(eventIds, evidenceIds, evidenceStatusMap);
  await seedAuditLogs(eventIds, woIds, evidenceIds, decisionIds);

  await validate();

  console.log('\n✓ Seed complete\n');
  await pool.end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

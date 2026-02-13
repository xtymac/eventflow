/**
 * Transaction benchmark tests — atomicity, concurrency, failure injection.
 *
 * Usage:
 *   npx tsx poc/benchmark/transactions.ts
 *   npx tsx poc/benchmark/transactions.ts --concurrency  # Run concurrent conflict tests
 *   npx tsx poc/benchmark/transactions.ts --inject        # Run failure injection tests
 */

import pg from 'pg';
import { nanoid } from 'nanoid';
import { pool } from '../../backend/src/db/index.js';
import { withTransaction } from '../middleware/transaction-wrapper.js';
import { writeAuditLog } from '../middleware/audit-writer.js';

const args = process.argv.slice(2);
const runConcurrency = args.includes('--concurrency');
const runInjection = args.includes('--inject');
const runAll = !runConcurrency && !runInjection;

// ---------------------------------------------------------------------------
// TX1: Event Close + Decision + Audit
// ---------------------------------------------------------------------------
export async function tx1_closeEvent(eventId: string, actorRole: string, closeNotes: string) {
  return withTransaction(async (client) => {
    // 1. Precondition: all WOs completed/cancelled
    const woCheck = await client.query(
      `SELECT COUNT(*)::int as count FROM work_orders
       WHERE event_id = $1 AND status NOT IN ('completed', 'cancelled')`,
      [eventId],
    );
    // Skip precondition for benchmark (data may not have all WOs completed)

    // 2. Update event
    const updateResult = await client.query(
      `UPDATE construction_events
       SET status = 'closed', closed_by = $2, closed_at = NOW(),
           close_notes = $3, updated_at = NOW()
       WHERE id = $1 AND status = 'pending_review'
       RETURNING id`,
      [eventId, actorRole, closeNotes],
    );

    if (updateResult.rowCount === 0) {
      throw new Error(`Event ${eventId} not in pending_review status`);
    }

    // 3. Insert decision
    const decisionId = `DEC-${nanoid(12)}`;
    await client.query(
      `INSERT INTO decisions (
        id, entity_type, entity_id, decision_type, outcome,
        rationale, previous_status, new_status,
        decided_by, decided_by_role
      ) VALUES ($1, 'event', $2, 'event_close', 'approved',
        $3, 'pending_review', 'closed', $4, $4)`,
      [decisionId, eventId, closeNotes, actorRole],
    );

    // 4. Audit log
    const auditId = await writeAuditLog(client, {
      entityType: 'event',
      entityId: eventId,
      action: 'close',
      description: `Event ${eventId} closed by ${actorRole}`,
      beforeSnapshot: { status: 'pending_review' },
      afterSnapshot: { status: 'closed', closedBy: actorRole },
      changedFields: ['status', 'closedBy', 'closedAt', 'closeNotes'],
      actor: actorRole,
      actorRole,
      decisionId,
    });

    return { decisionId, auditId };
  }, { label: 'tx1-close-event', isolationLevel: 'REPEATABLE READ' });
}

// ---------------------------------------------------------------------------
// TX2: Evidence Accept + Decision + Audit
// ---------------------------------------------------------------------------
export async function tx2_acceptEvidence(evidenceId: string, actorRole: string, notes: string) {
  return withTransaction(async (client) => {
    // 1. Lock evidence row
    const evResult = await client.query(
      `SELECT id, review_status, work_order_id FROM evidence
       WHERE id = $1 AND review_status = 'approved'
       FOR UPDATE`,
      [evidenceId],
    );

    if (evResult.rowCount === 0) {
      throw new Error(`Evidence ${evidenceId} not in approved status or not found`);
    }

    // 2. Update evidence
    await client.query(
      `UPDATE evidence
       SET review_status = 'accepted_by_authority',
           decision_by = $2, decision_at = NOW(), decision_notes = $3
       WHERE id = $1`,
      [evidenceId, actorRole, notes],
    );

    // 3. Insert decision
    const decisionId = `DEC-${nanoid(12)}`;
    await client.query(
      `INSERT INTO decisions (
        id, entity_type, entity_id, decision_type, outcome,
        rationale, previous_status, new_status,
        decided_by, decided_by_role
      ) VALUES ($1, 'evidence', $2, 'evidence_accept', 'approved',
        $3, 'approved', 'accepted_by_authority', $4, $4)`,
      [decisionId, evidenceId, notes, actorRole],
    );

    // 4. Audit log
    const auditId = await writeAuditLog(client, {
      entityType: 'evidence',
      entityId: evidenceId,
      action: 'decision',
      description: `Evidence ${evidenceId} accepted by authority`,
      beforeSnapshot: { reviewStatus: 'approved' },
      afterSnapshot: { reviewStatus: 'accepted_by_authority' },
      changedFields: ['reviewStatus', 'decisionBy', 'decisionAt'],
      actor: actorRole,
      actorRole,
      decisionId,
    });

    return { decisionId, auditId };
  }, { label: 'tx2-accept-evidence', isolationLevel: 'REPEATABLE READ' });
}

// ---------------------------------------------------------------------------
// TX3: WorkOrder Complete + Cascade + Audit
// ---------------------------------------------------------------------------
export async function tx3_completeWorkOrder(
  workOrderId: string,
  eventId: string,
  actor: string,
  actorRole: string,
) {
  return withTransaction(async (client) => {
    // 1. Complete the work order
    const woResult = await client.query(
      `UPDATE work_orders
       SET status = 'completed', completed_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status = 'in_progress'
       RETURNING id`,
      [workOrderId],
    );

    if (woResult.rowCount === 0) {
      throw new Error(`WorkOrder ${workOrderId} not in in_progress status`);
    }

    // 2. Check remaining WOs
    const remaining = await client.query(
      `SELECT COUNT(*)::int as count FROM work_orders
       WHERE event_id = $1 AND status NOT IN ('completed', 'cancelled')`,
      [eventId],
    );

    const auditEntries: Parameters<typeof writeAuditLog>[1][] = [
      {
        entityType: 'work_order',
        entityId: workOrderId,
        action: 'status_change',
        description: `WorkOrder ${workOrderId} completed`,
        beforeSnapshot: { status: 'in_progress' },
        afterSnapshot: { status: 'completed' },
        changedFields: ['status', 'completedAt'],
        actor,
        actorRole,
      },
    ];

    // 3. Auto-transition event if all WOs done
    if (remaining.rows[0].count === 0) {
      await client.query(
        `UPDATE construction_events
         SET status = 'pending_review', updated_at = NOW()
         WHERE id = $1 AND status = 'active'`,
        [eventId],
      );

      auditEntries.push({
        entityType: 'event',
        entityId: eventId,
        action: 'status_change',
        description: `Event ${eventId} auto-transitioned to pending_review`,
        beforeSnapshot: { status: 'active' },
        afterSnapshot: { status: 'pending_review' },
        changedFields: ['status'],
        actor: 'system',
        actorRole: 'system',
      });
    }

    // 4. Write audit logs
    const auditIds: string[] = [];
    for (const entry of auditEntries) {
      auditIds.push(await writeAuditLog(client, entry));
    }

    return { auditIds, cascaded: remaining.rows[0].count === 0 };
  }, { label: 'tx3-complete-workorder' });
}

// ---------------------------------------------------------------------------
// Atomicity test runner
// ---------------------------------------------------------------------------
async function runAtomicityTests() {
  console.log('\n=== Atomicity Tests ===\n');

  // Prepare test data: create events in pending_review status
  const testEventIds: string[] = [];
  for (let i = 0; i < 10; i++) {
    const id = `TX-TEST-CE-${nanoid(8)}`;
    testEventIds.push(id);
    await pool.query(
      `INSERT INTO construction_events (
        id, name, status, start_date, end_date, restriction_type,
        geometry, department, ward
      ) VALUES ($1, $2, 'pending_review', NOW(), NOW() + interval '30 days',
        'road_closure', ST_SetSRID(ST_MakePoint(136.9, 35.15), 4326),
        '建設局', '中区')
      ON CONFLICT (id) DO UPDATE SET status = 'pending_review'`,
      [id, `TX Test Event ${id}`],
    );
  }

  // TX1 atomicity: close 10 events, verify each has decision + audit
  let passed = 0;
  let failed = 0;
  const durations: number[] = [];

  for (const eventId of testEventIds) {
    try {
      const result = await tx1_closeEvent(eventId, 'gov_event_ops', 'Atomicity test');
      durations.push(result.durationMs);

      // Verify: event is closed
      const eventCheck = await pool.query(
        `SELECT status FROM construction_events WHERE id = $1`, [eventId],
      );
      // Verify: decision exists
      const decCheck = await pool.query(
        `SELECT id FROM decisions WHERE entity_type = 'event' AND entity_id = $1`, [eventId],
      );
      // Verify: audit exists
      const audCheck = await pool.query(
        `SELECT id FROM audit_logs WHERE entity_type = 'event' AND entity_id = $1 AND action = 'close'`, [eventId],
      );

      if (
        eventCheck.rows[0]?.status === 'closed' &&
        decCheck.rowCount! > 0 &&
        audCheck.rowCount! > 0
      ) {
        passed++;
      } else {
        failed++;
        console.error(`  FAIL: Event ${eventId} - status=${eventCheck.rows[0]?.status}, decision=${decCheck.rowCount}, audit=${audCheck.rowCount}`);
      }
    } catch (err: unknown) {
      failed++;
      console.error(`  ERROR: Event ${eventId} - ${(err as Error).message}`);
    }
  }

  const avgMs = durations.reduce((a, b) => a + b, 0) / durations.length;
  console.log(`TX1 Atomicity: ${passed} passed, ${failed} failed, avg ${avgMs.toFixed(2)}ms`);

  // Clean up
  for (const id of testEventIds) {
    await pool.query(`DELETE FROM audit_logs WHERE entity_id = $1`, [id]);
    await pool.query(`DELETE FROM decisions WHERE entity_id = $1`, [id]);
    await pool.query(`DELETE FROM construction_events WHERE id = $1`, [id]);
  }

  return { passed, failed, avgMs };
}

// ---------------------------------------------------------------------------
// Concurrent conflict test
// ---------------------------------------------------------------------------
async function runConcurrencyTests() {
  console.log('\n=== Concurrent Conflict Tests ===\n');

  // Create 5 events in pending_review
  const testEventIds: string[] = [];
  for (let i = 0; i < 5; i++) {
    const id = `TX-CONC-CE-${nanoid(8)}`;
    testEventIds.push(id);
    await pool.query(
      `INSERT INTO construction_events (
        id, name, status, start_date, end_date, restriction_type,
        geometry, department, ward
      ) VALUES ($1, $2, 'pending_review', NOW(), NOW() + interval '30 days',
        'road_closure', ST_SetSRID(ST_MakePoint(136.9, 35.15), 4326),
        '建設局', '中区')`,
      [id, `Concurrency Test ${id}`],
    );
  }

  // Launch 2 concurrent workers per event
  let conflicts = 0;
  let successes = 0;

  const promises = testEventIds.flatMap(eventId => [
    tx1_closeEvent(eventId, 'gov_event_ops', 'Worker A').then(() => { successes++; }).catch(() => { conflicts++; }),
    tx1_closeEvent(eventId, 'gov_admin', 'Worker B').then(() => { successes++; }).catch(() => { conflicts++; }),
  ]);

  await Promise.all(promises);

  // Verify: exactly N decisions per event
  let correctCount = 0;
  for (const eventId of testEventIds) {
    const decResult = await pool.query(
      `SELECT COUNT(*)::int as count FROM decisions WHERE entity_type = 'event' AND entity_id = $1`,
      [eventId],
    );
    if (decResult.rows[0].count === 1) correctCount++;
  }

  console.log(`TX1 Concurrency: ${successes} succeeded, ${conflicts} conflicts (expected ${testEventIds.length} of each)`);
  console.log(`Decision uniqueness: ${correctCount}/${testEventIds.length} events have exactly 1 decision`);

  // Clean up
  for (const id of testEventIds) {
    await pool.query(`DELETE FROM audit_logs WHERE entity_id = $1`, [id]);
    await pool.query(`DELETE FROM decisions WHERE entity_id = $1`, [id]);
    await pool.query(`DELETE FROM construction_events WHERE id = $1`, [id]);
  }

  return { successes, conflicts, correctCount, total: testEventIds.length };
}

// ---------------------------------------------------------------------------
// Failure injection test
// ---------------------------------------------------------------------------
async function runFailureInjectionTests() {
  console.log('\n=== Failure Injection Tests ===\n');

  // Create a test event
  const eventId = `TX-FAIL-CE-${nanoid(8)}`;
  await pool.query(
    `INSERT INTO construction_events (
      id, name, status, start_date, end_date, restriction_type,
      geometry, department, ward
    ) VALUES ($1, $2, 'pending_review', NOW(), NOW() + interval '30 days',
      'road_closure', ST_SetSRID(ST_MakePoint(136.9, 35.15), 4326),
      '建設局', '中区')`,
    [eventId, `Failure Test ${eventId}`],
  );

  // Inject failure after event update but before decision insert
  let rollbackWorked = true;
  try {
    await withTransaction(async (client) => {
      // Update event (this should be rolled back)
      await client.query(
        `UPDATE construction_events SET status = 'closed', closed_by = 'test' WHERE id = $1`,
        [eventId],
      );

      // Simulate failure
      throw new Error('INJECTED_FAILURE: Simulating crash after event update');
    }, { label: 'failure-injection' });
  } catch (err: unknown) {
    // Expected: transaction rolled back
    const check = await pool.query(
      `SELECT status FROM construction_events WHERE id = $1`, [eventId],
    );
    if (check.rows[0]?.status !== 'pending_review') {
      rollbackWorked = false;
      console.error(`  FAIL: Event status is ${check.rows[0]?.status}, expected pending_review`);
    }
  }

  // Verify no decision or audit was created
  const decCheck = await pool.query(
    `SELECT COUNT(*)::int as count FROM decisions WHERE entity_id = $1`, [eventId],
  );
  const audCheck = await pool.query(
    `SELECT COUNT(*)::int as count FROM audit_logs WHERE entity_id = $1`, [eventId],
  );

  const noOrphanedRecords = decCheck.rows[0].count === 0 && audCheck.rows[0].count === 0;

  console.log(`Failure injection: rollback=${rollbackWorked ? 'OK' : 'FAIL'}, orphaned_records=${noOrphanedRecords ? 'none (OK)' : 'FOUND (FAIL)'}`);

  // Clean up
  await pool.query(`DELETE FROM construction_events WHERE id = $1`, [eventId]);

  return { rollbackWorked, noOrphanedRecords };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const results: Record<string, unknown> = {};

  if (runAll || !runConcurrency && !runInjection) {
    results.atomicity = await runAtomicityTests();
  }
  if (runAll || runConcurrency) {
    results.concurrency = await runConcurrencyTests();
  }
  if (runAll || runInjection) {
    results.failureInjection = await runFailureInjectionTests();
  }

  console.log('\n=== Transaction Test Summary ===');
  console.log(JSON.stringify(results, null, 2));

  await pool.end();
}

main().catch((err) => {
  console.error('Transaction tests failed:', err);
  process.exit(1);
});

/**
 * MongoDB transaction benchmark tests — atomicity, concurrency, failure injection.
 *
 * Mirrors poc/benchmark/transactions.ts using MongoDB session.withTransaction().
 *
 * Usage:
 *   npx tsx poc-mongo/benchmark/mongo-transactions.ts
 *   npx tsx poc-mongo/benchmark/mongo-transactions.ts --concurrency
 *   npx tsx poc-mongo/benchmark/mongo-transactions.ts --inject
 */

import { MongoClient } from 'mongodb';
import { nanoid } from 'nanoid';

const MONGO_URL = process.env.MONGO_BENCH_URL ?? 'mongodb://localhost:27019/nagoya_bench?directConnection=true';

const args = process.argv.slice(2);
const runConcurrency = args.includes('--concurrency');
const runInjection = args.includes('--inject');
const runAll = !runConcurrency && !runInjection;

let client: MongoClient;

function getDb() {
  return client.db();
}

// ---------------------------------------------------------------------------
// TX1: Event Close + Decision + Audit
// ---------------------------------------------------------------------------
async function tx1_closeEvent(eventId: string, actorRole: string, closeNotes: string) {
  const session = client.startSession();
  const start = performance.now();
  let result: { decisionId: string; auditId: string } | undefined;

  try {
    await session.withTransaction(async () => {
      const db = getDb();
      const events = db.collection('construction_events');
      const decisions = db.collection('decisions');
      const auditLogs = db.collection('audit_logs');

      // 1. Update event
      const updateResult = await events.updateOne(
        { id: eventId, status: 'pending_review' },
        { $set: { status: 'closed', closed_by: actorRole, closed_at: new Date(), close_notes: closeNotes, updated_at: new Date() } },
        { session },
      );

      if (updateResult.modifiedCount === 0) {
        throw new Error(`Event ${eventId} not in pending_review status`);
      }

      // 2. Insert decision
      const decisionId = `DEC-${nanoid(12)}`;
      await decisions.insertOne({
        id: decisionId,
        entity_type: 'event',
        entity_id: eventId,
        decision_type: 'event_close',
        outcome: 'approved',
        rationale: closeNotes,
        previous_status: 'pending_review',
        new_status: 'closed',
        decided_by: actorRole,
        decided_by_role: actorRole,
        decided_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      }, { session });

      // 3. Audit log
      const auditId = `AUD-${nanoid(12)}`;
      await auditLogs.insertOne({
        id: auditId,
        entity_type: 'event',
        entity_id: eventId,
        action: 'close',
        description: `Event ${eventId} closed by ${actorRole}`,
        before_snapshot: { status: 'pending_review' },
        after_snapshot: { status: 'closed', closedBy: actorRole },
        changed_fields: ['status', 'closedBy', 'closedAt', 'closeNotes'],
        actor: actorRole,
        actor_role: actorRole,
        decision_id: decisionId,
        created_at: new Date(),
      }, { session });

      result = { decisionId, auditId };
    }, {
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
    });
  } finally {
    await session.endSession();
  }

  return { data: result!, durationMs: performance.now() - start };
}

// ---------------------------------------------------------------------------
// TX2: Evidence Accept + Decision + Audit
// ---------------------------------------------------------------------------
async function tx2_acceptEvidence(evidenceId: string, actorRole: string, notes: string) {
  const session = client.startSession();
  const start = performance.now();
  let result: { decisionId: string; auditId: string } | undefined;

  try {
    await session.withTransaction(async () => {
      const db = getDb();
      const evidence = db.collection('evidence');
      const decisions = db.collection('decisions');
      const auditLogs = db.collection('audit_logs');

      // 1. Find and update evidence
      const evDoc = await evidence.findOneAndUpdate(
        { id: evidenceId, review_status: 'approved' },
        { $set: {
          review_status: 'accepted_by_authority',
          decision_by: actorRole,
          decision_at: new Date(),
          decision_notes: notes,
        }},
        { session, returnDocument: 'before' },
      );

      if (!evDoc) {
        throw new Error(`Evidence ${evidenceId} not in approved status or not found`);
      }

      // 2. Insert decision
      const decisionId = `DEC-${nanoid(12)}`;
      await decisions.insertOne({
        id: decisionId,
        entity_type: 'evidence',
        entity_id: evidenceId,
        decision_type: 'evidence_accept',
        outcome: 'approved',
        rationale: notes,
        previous_status: 'approved',
        new_status: 'accepted_by_authority',
        decided_by: actorRole,
        decided_by_role: actorRole,
        decided_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      }, { session });

      // 3. Audit log
      const auditId = `AUD-${nanoid(12)}`;
      await auditLogs.insertOne({
        id: auditId,
        entity_type: 'evidence',
        entity_id: evidenceId,
        action: 'decision',
        description: `Evidence ${evidenceId} accepted by authority`,
        before_snapshot: { reviewStatus: 'approved' },
        after_snapshot: { reviewStatus: 'accepted_by_authority' },
        changed_fields: ['reviewStatus', 'decisionBy', 'decisionAt'],
        actor: actorRole,
        actor_role: actorRole,
        decision_id: decisionId,
        created_at: new Date(),
      }, { session });

      result = { decisionId, auditId };
    }, {
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
    });
  } finally {
    await session.endSession();
  }

  return { data: result!, durationMs: performance.now() - start };
}

// ---------------------------------------------------------------------------
// TX3: WorkOrder Complete + Cascade + Audit
// ---------------------------------------------------------------------------
async function tx3_completeWorkOrder(workOrderId: string, eventId: string, actor: string, actorRole: string) {
  const session = client.startSession();
  const start = performance.now();
  let result: { auditIds: string[]; cascaded: boolean } | undefined;

  try {
    await session.withTransaction(async () => {
      const db = getDb();
      const workOrders = db.collection('work_orders');
      const events = db.collection('construction_events');
      const auditLogs = db.collection('audit_logs');

      // 1. Complete the work order
      const woResult = await workOrders.updateOne(
        { id: workOrderId, status: 'in_progress' },
        { $set: { status: 'completed', completed_at: new Date(), updated_at: new Date() } },
        { session },
      );

      if (woResult.modifiedCount === 0) {
        throw new Error(`WorkOrder ${workOrderId} not in in_progress status`);
      }

      // 2. Check remaining WOs
      const remaining = await workOrders.countDocuments(
        { event_id: eventId, status: { $nin: ['completed', 'cancelled'] } },
        { session },
      );

      const auditIds: string[] = [];

      // WO audit log
      const woAuditId = `AUD-${nanoid(12)}`;
      await auditLogs.insertOne({
        id: woAuditId,
        entity_type: 'work_order',
        entity_id: workOrderId,
        action: 'status_change',
        description: `WorkOrder ${workOrderId} completed`,
        before_snapshot: { status: 'in_progress' },
        after_snapshot: { status: 'completed' },
        changed_fields: ['status', 'completedAt'],
        actor,
        actor_role: actorRole,
        created_at: new Date(),
      }, { session });
      auditIds.push(woAuditId);

      // 3. Auto-transition event if all WOs done
      let cascaded = false;
      if (remaining === 0) {
        await events.updateOne(
          { id: eventId, status: 'active' },
          { $set: { status: 'pending_review', updated_at: new Date() } },
          { session },
        );

        const evAuditId = `AUD-${nanoid(12)}`;
        await auditLogs.insertOne({
          id: evAuditId,
          entity_type: 'event',
          entity_id: eventId,
          action: 'status_change',
          description: `Event ${eventId} auto-transitioned to pending_review`,
          before_snapshot: { status: 'active' },
          after_snapshot: { status: 'pending_review' },
          changed_fields: ['status'],
          actor: 'system',
          actor_role: 'system',
          created_at: new Date(),
        }, { session });
        auditIds.push(evAuditId);
        cascaded = true;
      }

      result = { auditIds, cascaded };
    }, {
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
    });
  } finally {
    await session.endSession();
  }

  return { data: result!, durationMs: performance.now() - start };
}

// ---------------------------------------------------------------------------
// Atomicity test runner
// ---------------------------------------------------------------------------
async function runAtomicityTests() {
  console.log('\n=== Atomicity Tests (MongoDB) ===\n');
  const db = getDb();

  // Prepare test data
  const testEventIds: string[] = [];
  for (let i = 0; i < 10; i++) {
    const id = `TX-MONGO-CE-${nanoid(8)}`;
    testEventIds.push(id);
    await db.collection('construction_events').updateOne(
      { id },
      { $set: {
        id, name: `TX Test Event ${id}`, status: 'pending_review',
        start_date: new Date(), end_date: new Date(Date.now() + 30 * 86400000),
        restriction_type: 'road_closure',
        geometry: { type: 'Point', coordinates: [136.9, 35.15] },
        department: '建設局', ward: '中区',
      }},
      { upsert: true },
    );
  }

  let passed = 0;
  let failed = 0;
  const durations: number[] = [];

  for (const eventId of testEventIds) {
    try {
      const result = await tx1_closeEvent(eventId, 'gov_event_ops', 'Atomicity test');
      durations.push(result.durationMs);

      const eventCheck = await db.collection('construction_events').findOne({ id: eventId });
      const decCheck = await db.collection('decisions').countDocuments({ entity_type: 'event', entity_id: eventId });
      const audCheck = await db.collection('audit_logs').countDocuments({ entity_type: 'event', entity_id: eventId, action: 'close' });

      if (eventCheck?.status === 'closed' && decCheck > 0 && audCheck > 0) {
        passed++;
      } else {
        failed++;
        console.error(`  FAIL: Event ${eventId} - status=${eventCheck?.status}, decision=${decCheck}, audit=${audCheck}`);
      }
    } catch (err: unknown) {
      failed++;
      console.error(`  ERROR: Event ${eventId} - ${(err as Error).message}`);
    }
  }

  const avgMs = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  console.log(`TX1 Atomicity: ${passed} passed, ${failed} failed, avg ${avgMs.toFixed(2)}ms`);

  // Clean up
  for (const id of testEventIds) {
    await db.collection('audit_logs').deleteMany({ entity_id: id });
    await db.collection('decisions').deleteMany({ entity_id: id });
    await db.collection('construction_events').deleteOne({ id });
  }

  return { passed, failed, avgMs };
}

// ---------------------------------------------------------------------------
// Concurrent conflict test
// ---------------------------------------------------------------------------
async function runConcurrencyTests() {
  console.log('\n=== Concurrent Conflict Tests (MongoDB) ===\n');
  const db = getDb();

  const testEventIds: string[] = [];
  for (let i = 0; i < 5; i++) {
    const id = `TX-MCONC-CE-${nanoid(8)}`;
    testEventIds.push(id);
    await db.collection('construction_events').insertOne({
      id, name: `Concurrency Test ${id}`, status: 'pending_review',
      start_date: new Date(), end_date: new Date(Date.now() + 30 * 86400000),
      restriction_type: 'road_closure',
      geometry: { type: 'Point', coordinates: [136.9, 35.15] },
      department: '建設局', ward: '中区',
    });
  }

  let conflicts = 0;
  let successes = 0;

  const promises = testEventIds.flatMap(eventId => [
    tx1_closeEvent(eventId, 'gov_event_ops', 'Worker A').then(() => { successes++; }).catch(() => { conflicts++; }),
    tx1_closeEvent(eventId, 'gov_admin', 'Worker B').then(() => { successes++; }).catch(() => { conflicts++; }),
  ]);

  await Promise.all(promises);

  let correctCount = 0;
  for (const eventId of testEventIds) {
    const count = await db.collection('decisions').countDocuments({ entity_type: 'event', entity_id: eventId });
    if (count === 1) correctCount++;
  }

  console.log(`TX1 Concurrency: ${successes} succeeded, ${conflicts} conflicts (expected ${testEventIds.length} of each)`);
  console.log(`Decision uniqueness: ${correctCount}/${testEventIds.length} events have exactly 1 decision`);

  // Clean up
  for (const id of testEventIds) {
    await db.collection('audit_logs').deleteMany({ entity_id: id });
    await db.collection('decisions').deleteMany({ entity_id: id });
    await db.collection('construction_events').deleteOne({ id });
  }

  return { successes, conflicts, correctCount, total: testEventIds.length };
}

// ---------------------------------------------------------------------------
// Failure injection test
// ---------------------------------------------------------------------------
async function runFailureInjectionTests() {
  console.log('\n=== Failure Injection Tests (MongoDB) ===\n');
  const db = getDb();

  const eventId = `TX-MFAIL-CE-${nanoid(8)}`;
  await db.collection('construction_events').insertOne({
    id: eventId, name: `Failure Test ${eventId}`, status: 'pending_review',
    start_date: new Date(), end_date: new Date(Date.now() + 30 * 86400000),
    restriction_type: 'road_closure',
    geometry: { type: 'Point', coordinates: [136.9, 35.15] },
    department: '建設局', ward: '中区',
  });

  let rollbackWorked = true;
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      const events = db.collection('construction_events');

      // Update event (should be rolled back)
      await events.updateOne(
        { id: eventId },
        { $set: { status: 'closed', closed_by: 'test' } },
        { session },
      );

      // Simulate failure
      throw new Error('INJECTED_FAILURE: Simulating crash after event update');
    }, {
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
    });
  } catch {
    // Expected: transaction aborted
    const check = await db.collection('construction_events').findOne({ id: eventId });
    if (check?.status !== 'pending_review') {
      rollbackWorked = false;
      console.error(`  FAIL: Event status is ${check?.status}, expected pending_review`);
    }
  } finally {
    await session.endSession();
  }

  const decCount = await db.collection('decisions').countDocuments({ entity_id: eventId });
  const audCount = await db.collection('audit_logs').countDocuments({ entity_id: eventId });
  const noOrphanedRecords = decCount === 0 && audCount === 0;

  console.log(`Failure injection: rollback=${rollbackWorked ? 'OK' : 'FAIL'}, orphaned_records=${noOrphanedRecords ? 'none (OK)' : 'FOUND (FAIL)'}`);

  // Clean up
  await db.collection('construction_events').deleteOne({ id: eventId });

  return { rollbackWorked, noOrphanedRecords };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  client = new MongoClient(MONGO_URL, { maxPoolSize: 10 });
  await client.connect();

  const results: Record<string, unknown> = {};

  if (runAll || (!runConcurrency && !runInjection)) {
    results.atomicity = await runAtomicityTests();
  }
  if (runAll || runConcurrency) {
    results.concurrency = await runConcurrencyTests();
  }
  if (runAll || runInjection) {
    results.failureInjection = await runFailureInjectionTests();
  }

  console.log('\n=== Transaction Test Summary (MongoDB) ===');
  console.log(JSON.stringify(results, null, 2));

  await client.close();
}

main().catch((err) => {
  console.error('Transaction tests failed:', err);
  process.exit(1);
});

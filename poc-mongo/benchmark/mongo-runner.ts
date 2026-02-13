/**
 * MongoDB benchmark runner — orchestrates all 12 queries.
 * Mirrors poc/benchmark/runner.ts with identical CLI args and output format.
 *
 * Usage:
 *   npx tsx poc-mongo/benchmark/mongo-runner.ts
 *   npx tsx poc-mongo/benchmark/mongo-runner.ts --concurrency 10
 *   npx tsx poc-mongo/benchmark/mongo-runner.ts --output poc/reports/benchmark-mongo-50x.json
 */

import { MongoClient } from 'mongodb';
import * as Q from './mongo-queries.js';
import { calculateStats, printSummary, generateReport, type TimingSample, type QueryStats } from '../../poc/benchmark/reporter.js';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const MONGO_URL = process.env.MONGO_BENCH_URL ?? 'mongodb://localhost:27019/nagoya_bench?directConnection=true';

// ---------------------------------------------------------------------------
// CLI args (identical to PG runner)
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
function getArg(name: string, defaultVal: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
}
const ITERATIONS = parseInt(getArg('iterations', '100'), 10);
const WARMUP = parseInt(getArg('warmup', '20'), 10);
const CONCURRENCY = parseInt(getArg('concurrency', '1'), 10);
const ENV = getArg('env', 'local');
const OUTPUT = getArg('output', '');
const IS_COLD = args.includes('--cold');

// Same thresholds as PG runner
const THRESHOLDS: Record<string, number> = {
  Q1: 5, Q2: 200, Q3: 20, Q4: 50, Q5: 100,
  Q6: 200, Q7: 50, Q8: 100, Q9: 500, Q10: 100,
  Q11: 100, Q12: 200,
};

// ---------------------------------------------------------------------------
// Fetch test params from MongoDB data
// ---------------------------------------------------------------------------
async function fetchTestParams(db: import('mongodb').Db) {
  const roadAsset = await db.collection('road_assets').findOne({ status: 'active' });
  const event = await db.collection('construction_events').findOne({ id: { $regex: /^POC-CE-/ } });
  const eventAny = await db.collection('construction_events').findOne();
  const inspection = await db.collection('inspection_records').findOne();
  const auditEntity = await db.collection('audit_logs').findOne({ id: { $regex: /^POC-AUD-/ } });

  return {
    roadAssetId: roadAsset?.id ?? 'RA-000',
    eventId: event?.id ?? eventAny?.id ?? 'CE-000',
    inspectionAssetType: inspection?.asset_type ?? 'road',
    inspectionAssetId: inspection?.asset_id ?? 'RA-000',
    auditEntityType: auditEntity?.entity_type ?? 'event',
    auditEntityId: auditEntity?.entity_id ?? 'CE-000',
    partnerId: 'PTR-tanaka',
    from: '2024-01-01T00:00:00Z',
    to: '2027-01-01T00:00:00Z',
    bbox: { minLng: 136.88, minLat: 35.12, maxLng: 136.93, maxLat: 35.17 },
  };
}

// ---------------------------------------------------------------------------
// Run a single query N times
// ---------------------------------------------------------------------------
async function benchmarkQuery(
  name: string,
  fn: () => Promise<Q.MongoQueryResult>,
  iterations: number,
  warmup: number,
): Promise<TimingSample[]> {
  for (let i = 0; i < warmup; i++) {
    await fn();
  }

  const samples: TimingSample[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const result = await fn();
    const durationMs = performance.now() - start;
    samples.push({ queryName: name, durationMs, rowCount: result.count });
  }
  return samples;
}

// ---------------------------------------------------------------------------
// Run concurrent benchmark
// ---------------------------------------------------------------------------
async function benchmarkQueryConcurrent(
  name: string,
  fn: () => Promise<Q.MongoQueryResult>,
  totalIterations: number,
  concurrency: number,
): Promise<TimingSample[]> {
  const samples: TimingSample[] = [];
  const iterPerWorker = Math.ceil(totalIterations / concurrency);

  const workers = Array.from({ length: concurrency }, async () => {
    for (let i = 0; i < iterPerWorker; i++) {
      const start = performance.now();
      const result = await fn();
      const durationMs = performance.now() - start;
      samples.push({ queryName: name, durationMs, rowCount: result.count });
    }
  });

  await Promise.all(workers);
  return samples;
}

// ---------------------------------------------------------------------------
// Detect data tier
// ---------------------------------------------------------------------------
async function detectTier(db: import('mongodb').Db): Promise<string> {
  const count = await db.collection('construction_events').countDocuments({ id: { $regex: /^POC-CE-/ } });
  if (count >= 4000) return '50x';
  if (count >= 800) return '10x';
  if (count >= 50) return '1x';
  return 'baseline';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\n=== MongoDB Benchmark Runner ===`);
  console.log(`  Environment: ${ENV}`);
  console.log(`  Iterations: ${ITERATIONS} (warmup: ${IS_COLD ? 0 : WARMUP})`);
  console.log(`  Concurrency: ${CONCURRENCY}`);
  console.log(`  MongoDB: ${MONGO_URL}`);
  console.log();

  const client = new MongoClient(MONGO_URL, { maxPoolSize: 10 });
  await client.connect();
  const db = client.db();

  const params = await fetchTestParams(db);
  console.log(`Test params:`, JSON.stringify(params, null, 2));

  // Define query runners
  const queryRunners: Array<{ name: string; label: string; fn: () => Promise<Q.MongoQueryResult> }> = [
    { name: 'Q1', label: 'Asset PK lookup + geometry', fn: () => Q.q1_assetLookup(db, params.roadAssetId) },
    { name: 'Q2', label: 'Event list + status filter + sort', fn: () => Q.q2_eventList(db) },
    { name: 'Q3', label: 'Event detail + road assets (2 $lookup)', fn: () => Q.q3_eventDetail(db, params.eventId) },
    { name: 'Q4', label: 'Event + WO + evidence count (3 $lookup)', fn: () => Q.q4_eventWorkOrderEvidence(db, params.eventId) },
    { name: 'Q5', label: 'Full chain Event→WO→Evidence→Decision', fn: () => Q.q5_fullChain(db, params.eventId) },
    { name: 'Q6', label: 'Spatial $geoWithin (2dsphere)', fn: () => Q.q6_spatialNear(db, params.eventId) },
    { name: 'Q7', label: 'Inspection + decision (polymorphic)', fn: () => Q.q7_inspectionDecision(db, params.inspectionAssetType, params.inspectionAssetId) },
    { name: 'Q8', label: 'Audit trail + BSON snapshots', fn: () => Q.q8_auditTrail(db, params.auditEntityType, params.auditEntityId) },
    { name: 'Q9', label: 'Dashboard aggregate (3 $lookup)', fn: () => Q.q9_dashboardAggregate(db) },
    { name: 'Q10', label: 'Partner-filtered WO view', fn: () => Q.q10_partnerWorkOrders(db, params.partnerId) },
    { name: 'Q11', label: 'Audit activity report (time range)', fn: () => Q.q11_auditReport(db, params.from, params.to) },
    { name: 'Q12', label: 'Multi-asset spatial bbox (3 queries)', fn: () => Q.q12_spatialBbox(db, params.bbox.minLng, params.bbox.minLat, params.bbox.maxLng, params.bbox.maxLat) },
  ];

  const allStats: QueryStats[] = [];

  for (const qr of queryRunners) {
    process.stdout.write(`  Running ${qr.name}: ${qr.label}...`);

    let samples: TimingSample[];
    if (CONCURRENCY > 1) {
      samples = await benchmarkQueryConcurrent(qr.name, qr.fn, ITERATIONS, CONCURRENCY);
    } else {
      samples = await benchmarkQuery(qr.name, qr.fn, ITERATIONS, IS_COLD ? 0 : WARMUP);
    }

    const stats = calculateStats(qr.name, qr.label, samples);
    allStats.push(stats);
    console.log(` p50=${stats.p50.toFixed(1)}ms p95=${stats.p95.toFixed(1)}ms rows=${stats.avgRowCount.toFixed(0)}`);
  }

  // Summary
  printSummary(allStats, THRESHOLDS);

  // Generate report
  const tier = await detectTier(db);
  const report = generateReport(`${ENV}-mongo`, tier, allStats, THRESHOLDS);

  if (OUTPUT) {
    mkdirSync(dirname(OUTPUT), { recursive: true });
    writeFileSync(OUTPUT, JSON.stringify(report, null, 2));
    console.log(`\nReport saved to: ${OUTPUT}`);
  }

  console.log(`\nVerdict: ${(report as { summary: { verdict: string } }).summary.verdict}`);

  await client.close();
}

main().catch((err) => {
  console.error('MongoDB benchmark failed:', err);
  process.exit(1);
});

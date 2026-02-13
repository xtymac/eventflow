/**
 * Benchmark runner — orchestrates all 12 queries across data tiers.
 *
 * Usage:
 *   npx tsx poc/benchmark/runner.ts                        # Default: hot cache, 100 iterations
 *   npx tsx poc/benchmark/runner.ts --cold                 # Cold start test
 *   npx tsx poc/benchmark/runner.ts --concurrency 10       # Concurrent workers
 *   npx tsx poc/benchmark/runner.ts --env ec2              # Tag results as EC2
 *   npx tsx poc/benchmark/runner.ts --output reports/out.json
 */

import { pool } from '../../backend/src/db/index.js';
import * as Q from './queries.js';
import { calculateStats, printSummary, generateReport, type TimingSample, type QueryStats } from './reporter.js';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// ---------------------------------------------------------------------------
// CLI args
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

// Acceptance thresholds (p95 in ms)
const THRESHOLDS: Record<string, number> = {
  Q1: 5,
  Q2: 200,
  Q3: 20,
  Q4: 50,
  Q5: 100,
  Q6: 200,
  Q7: 50,
  Q8: 100,
  Q9: 500,
  Q10: 100,
  Q11: 100,
  Q12: 200,
};

// ---------------------------------------------------------------------------
// Fetch random test data IDs from the database
// ---------------------------------------------------------------------------
async function fetchTestParams() {
  const client = await pool.connect();
  try {
    const roadAsset = await client.query(`SELECT id FROM road_assets WHERE status = 'active' LIMIT 1`);
    const event = await client.query(`SELECT id FROM construction_events WHERE id LIKE 'POC-CE-%' LIMIT 1`);
    const eventAny = await client.query(`SELECT id FROM construction_events LIMIT 1`);
    const inspection = await client.query(`SELECT asset_type, asset_id FROM inspection_records LIMIT 1`);
    const auditEntity = await client.query(`SELECT entity_type, entity_id FROM audit_logs WHERE id LIKE 'POC-AUD-%' LIMIT 1`);

    return {
      roadAssetId: roadAsset.rows[0]?.id ?? 'RA-000',
      eventId: event.rows[0]?.id ?? eventAny.rows[0]?.id ?? 'CE-000',
      inspectionAssetType: inspection.rows[0]?.asset_type ?? 'road',
      inspectionAssetId: inspection.rows[0]?.asset_id ?? 'RA-000',
      auditEntityType: auditEntity.rows[0]?.entity_type ?? 'event',
      auditEntityId: auditEntity.rows[0]?.entity_id ?? 'CE-000',
      partnerId: 'PTR-tanaka',
      from: '2024-01-01T00:00:00Z',
      to: '2027-01-01T00:00:00Z',
      bbox: { minLng: 136.88, minLat: 35.12, maxLng: 136.93, maxLat: 35.17 },
    };
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Run a single query N times and collect samples
// ---------------------------------------------------------------------------
async function benchmarkQuery(
  name: string,
  fn: (client: import('pg').PoolClient) => Promise<import('pg').QueryResult>,
  iterations: number,
  warmup: number,
): Promise<TimingSample[]> {
  // Warmup
  for (let i = 0; i < warmup; i++) {
    const client = await pool.connect();
    try { await fn(client); } finally { client.release(); }
  }

  // Measured runs
  const samples: TimingSample[] = [];
  for (let i = 0; i < iterations; i++) {
    const client = await pool.connect();
    const start = performance.now();
    try {
      const result = await fn(client);
      const durationMs = performance.now() - start;
      samples.push({ queryName: name, durationMs, rowCount: result.rowCount ?? 0 });
    } finally {
      client.release();
    }
  }

  return samples;
}

// ---------------------------------------------------------------------------
// Run concurrent benchmark
// ---------------------------------------------------------------------------
async function benchmarkQueryConcurrent(
  name: string,
  fn: (client: import('pg').PoolClient) => Promise<import('pg').QueryResult>,
  totalIterations: number,
  concurrency: number,
): Promise<TimingSample[]> {
  const samples: TimingSample[] = [];
  const iterPerWorker = Math.ceil(totalIterations / concurrency);

  const workers = Array.from({ length: concurrency }, async () => {
    for (let i = 0; i < iterPerWorker; i++) {
      const client = await pool.connect();
      const start = performance.now();
      try {
        const result = await fn(client);
        const durationMs = performance.now() - start;
        samples.push({ queryName: name, durationMs, rowCount: result.rowCount ?? 0 });
      } finally {
        client.release();
      }
    }
  });

  await Promise.all(workers);
  return samples;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\n=== Benchmark Runner ===`);
  console.log(`  Environment: ${ENV}`);
  console.log(`  Iterations: ${ITERATIONS} (warmup: ${IS_COLD ? 0 : WARMUP})`);
  console.log(`  Concurrency: ${CONCURRENCY}`);
  console.log();

  const params = await fetchTestParams();
  console.log(`Test params:`, JSON.stringify(params, null, 2));

  // Define query runners
  const queryRunners: Array<{ name: string; label: string; fn: (c: import('pg').PoolClient) => Promise<import('pg').QueryResult> }> = [
    { name: 'Q1', label: 'Asset PK lookup + geometry', fn: (c) => Q.q1_assetLookup(c, params.roadAssetId) },
    { name: 'Q2', label: 'Event list + status filter + sort', fn: (c) => Q.q2_eventList(c) },
    { name: 'Q3', label: 'Event detail + road assets (2 joins)', fn: (c) => Q.q3_eventDetail(c, params.eventId) },
    { name: 'Q4', label: 'Event + WO + evidence count (3 joins)', fn: (c) => Q.q4_eventWorkOrderEvidence(c, params.eventId) },
    { name: 'Q5', label: 'Full chain Event→WO→Evidence→Decision', fn: (c) => Q.q5_fullChain(c, params.eventId) },
    { name: 'Q6', label: 'Spatial ST_DWithin (GIST)', fn: (c) => Q.q6_spatialIntersect(c, params.eventId) },
    { name: 'Q7', label: 'Inspection + decision (polymorphic)', fn: (c) => Q.q7_inspectionDecision(c, params.inspectionAssetType, params.inspectionAssetId) },
    { name: 'Q8', label: 'Audit trail + JSONB snapshots', fn: (c) => Q.q8_auditTrail(c, params.auditEntityType, params.auditEntityId) },
    { name: 'Q9', label: 'Dashboard aggregate (3 LEFT JOINs)', fn: (c) => Q.q9_dashboardAggregate(c) },
    { name: 'Q10', label: 'Partner-filtered WO view', fn: (c) => Q.q10_partnerWorkOrders(c, params.partnerId) },
    { name: 'Q11', label: 'Audit activity report (time range)', fn: (c) => Q.q11_auditReport(c, params.from, params.to) },
    { name: 'Q12', label: 'Multi-asset spatial bbox (UNION ALL)', fn: (c) => Q.q12_spatialBbox(c, params.bbox.minLng, params.bbox.minLat, params.bbox.maxLng, params.bbox.maxLat) },
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
  const tier = await detectTier();
  const report = generateReport(ENV, tier, allStats, THRESHOLDS);

  if (OUTPUT) {
    mkdirSync(dirname(OUTPUT), { recursive: true });
    writeFileSync(OUTPUT, JSON.stringify(report, null, 2));
    console.log(`\nReport saved to: ${OUTPUT}`);
  }

  console.log(`\nVerdict: ${(report as { summary: { verdict: string } }).summary.verdict}`);

  await pool.end();
}

async function detectTier(): Promise<string> {
  const client = await pool.connect();
  try {
    const result = await client.query(`SELECT COUNT(*)::int as count FROM construction_events WHERE id LIKE 'POC-CE-%'`);
    const count = result.rows[0]?.count ?? 0;
    if (count >= 4000) return '50x';
    if (count >= 800) return '10x';
    if (count >= 50) return '1x';
    return 'baseline';
  } finally {
    client.release();
  }
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});

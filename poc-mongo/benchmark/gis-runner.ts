/**
 * GIS spatial benchmark runner — orchestrates G1-G12 queries across
 * index configurations, execution modes, and optional PostGIS comparison.
 *
 * Usage:
 *   npx tsx poc-mongo/benchmark/gis-runner.ts --tier S --index-config B --mode single
 *   npx tsx poc-mongo/benchmark/gis-runner.ts --tier L --index-config all --mode all --with-pg
 *   npx tsx poc-mongo/benchmark/gis-runner.ts --tier M --index-config B --mode concurrent --concurrency 30
 *   npx tsx poc-mongo/benchmark/gis-runner.ts --tier M --index-config B --mode single --iterations 50 --output poc/reports/gis-M-B-single.json
 */

import { MongoClient, type Db } from 'mongodb';
import * as GQ from './gis-queries.js';
import { NAKAKU_POLYGON } from './gis-seed.js';
import { calculateStats, printSummary, generateReport, type TimingSample, type QueryStats } from '../../poc/benchmark/reporter.js';
import { pool } from '../../backend/src/db/index.js';
import * as PGQ from '../../poc/benchmark/gis-pg-queries.js';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import * as turf from '@turf/turf';

const MONGO_URL = process.env.MONGO_BENCH_URL ?? 'mongodb://localhost:27019/nagoya_bench?directConnection=true';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
function getArg(name: string, defaultVal: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

const TIER = getArg('tier', 'S');
const INDEX_CONFIG = getArg('index-config', 'B');
const MODE = getArg('mode', 'single');
const ITERATIONS = parseInt(getArg('iterations', '100'), 10);
const WARMUP = parseInt(getArg('warmup', '20'), 10);
const CONCURRENCY = parseInt(getArg('concurrency', '10'), 10);
const OUTPUT = getArg('output', '');
const WITH_PG = args.includes('--with-pg');

// Proximity queries that require 2dsphere index
const PROXIMITY_QUERIES = new Set(['G1', 'G2', 'G3', 'G4']);

// ---------------------------------------------------------------------------
// Index configuration management
// ---------------------------------------------------------------------------
async function applyIndexConfig(db: Db, config: string): Promise<void> {
  console.log(`  Applying index config: ${config}`);
  const assets = db.collection('gis_assets');
  const events = db.collection('gis_events');

  // Drop all non-_id indexes
  try { await assets.dropIndexes(); } catch { /* no indexes to drop */ }
  try { await events.dropIndexes(); } catch { /* no indexes to drop */ }

  // Always keep id unique index
  await assets.createIndex({ id: 1 }, { unique: true });
  await events.createIndex({ id: 1 }, { unique: true });
  await events.createIndex({ asset_id: 1 });

  switch (config) {
    case 'A':
      // No spatial indexes (baseline)
      console.log('    Config A: no spatial indexes');
      break;
    case 'B':
      // Single 2dsphere indexes
      await assets.createIndex({ geometry: '2dsphere' });
      await events.createIndex({ geometry: '2dsphere' });
      console.log('    Config B: 2dsphere single');
      break;
    case 'C':
      // Compound 2dsphere + status indexes
      await assets.createIndex({ geometry: '2dsphere', status: 1 });
      await events.createIndex({ geometry: '2dsphere', status: 1 });
      console.log('    Config C: 2dsphere + status compound');
      break;
    default:
      throw new Error(`Unknown index config: ${config}`);
  }
}

// ---------------------------------------------------------------------------
// Test parameter sampling
// ---------------------------------------------------------------------------
interface GisTestParams {
  assetPoint: [number, number];
  eventPolygon: GeoJSON.Polygon;
  eventPolygons5: GeoJSON.Polygon[];
  bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number };
  wardPolygon: GeoJSON.Polygon;
  eventId: string;
}

async function fetchTestParams(db: Db): Promise<GisTestParams> {
  // Sample a Point asset for proximity queries
  const pointAsset = await db.collection('gis_assets').findOne(
    { 'geometry.type': 'Point' },
  );
  const coords = pointAsset?.geometry?.coordinates ?? [136.9, 35.17];

  // Sample event polygons for intersection queries
  const eventDocs = await db.collection('gis_events').find().limit(5).toArray();
  const eventPolygons = eventDocs.map(e => e.geometry as GeoJSON.Polygon);
  const eventPolygon = eventPolygons[0] ?? turf.buffer(turf.point(coords), 200, { units: 'meters' })!.geometry;

  // Compute a realistic sub-bbox (~2km viewport)
  const bboxCenter = coords as [number, number];
  const bbox = {
    minLng: bboxCenter[0] - 0.01,
    minLat: bboxCenter[1] - 0.01,
    maxLng: bboxCenter[0] + 0.01,
    maxLat: bboxCenter[1] + 0.01,
  };

  // Sample an event ID for PG comparison
  const eventDoc = await db.collection('gis_events').findOne();

  return {
    assetPoint: coords as [number, number],
    eventPolygon,
    eventPolygons5: eventPolygons.length >= 5
      ? eventPolygons.slice(0, 5)
      : [...eventPolygons, ...Array(5 - eventPolygons.length).fill(eventPolygon)],
    bbox,
    wardPolygon: NAKAKU_POLYGON,
    eventId: eventDoc?.id ?? 'GIS-E-unknown',
  };
}

// ---------------------------------------------------------------------------
// Benchmark helpers (mirrors mongo-runner.ts patterns)
// ---------------------------------------------------------------------------
async function benchmarkQuery(
  name: string,
  fn: () => Promise<{ count: number }>,
  iterations: number,
  warmup: number,
): Promise<TimingSample[]> {
  // Warmup
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

async function benchmarkQueryConcurrent(
  name: string,
  fn: () => Promise<{ count: number }>,
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
// Define query runners
// ---------------------------------------------------------------------------
function defineQueryRunners(
  db: Db,
  params: GisTestParams,
  indexConfig: string,
): Array<{ name: string; label: string; fn: () => Promise<GQ.GisQueryResult>; skip: boolean }> {
  const skipProximity = indexConfig === 'A'; // $nearSphere requires 2dsphere index

  return [
    // Proximity
    { name: 'G1', label: '$nearSphere assets within 500m', skip: skipProximity,
      fn: () => GQ.g1_nearSphereAssets500m(db, params.assetPoint[0], params.assetPoint[1]) },
    { name: 'G2', label: '$nearSphere events within 1km', skip: skipProximity,
      fn: () => GQ.g2_nearSphereEvents1km(db, params.assetPoint[0], params.assetPoint[1]) },
    { name: 'G3', label: '$geoNear + $lookup events', skip: skipProximity,
      fn: () => GQ.g3_nearSphereWithLookup(db, params.assetPoint[0], params.assetPoint[1]) },
    { name: 'G4', label: 'Nearest 10 assets', skip: skipProximity,
      fn: () => GQ.g4_nearest10(db, params.assetPoint[0], params.assetPoint[1]) },
    // BBox
    { name: 'G5', label: '$geoWithin $box assets', skip: false,
      fn: () => GQ.g5_bboxAssets(db, params.bbox.minLng, params.bbox.minLat, params.bbox.maxLng, params.bbox.maxLat) },
    { name: 'G6', label: '$geoWithin $box events', skip: false,
      fn: () => GQ.g6_bboxEvents(db, params.bbox.minLng, params.bbox.minLat, params.bbox.maxLng, params.bbox.maxLat) },
    { name: 'G7', label: '$geoWithin ward polygon', skip: false,
      fn: () => GQ.g7_withinWardPolygon(db, params.wardPolygon) },
    { name: 'G8', label: '$geoWithin + status filter', skip: false,
      fn: () => GQ.g8_bboxWithStatusFilter(db, params.bbox.minLng, params.bbox.minLat, params.bbox.maxLng, params.bbox.maxLat) },
    // Intersection
    { name: 'G9', label: '$geoIntersects event → assets', skip: false,
      fn: () => GQ.g9_intersectsEventAssets(db, params.eventPolygon) },
    { name: 'G10', label: '$geoIntersects zone → events', skip: false,
      fn: () => GQ.g10_intersectsPolygons(db, params.wardPolygon) },
    { name: 'G11', label: 'Turf.js buffer + $geoIntersects', skip: false,
      fn: () => GQ.g11_bufferIntersects(db, params.assetPoint[0], params.assetPoint[1], 200) },
    { name: 'G12', label: 'Batch 5x $geoIntersects', skip: false,
      fn: () => GQ.g12_batchIntersects(db, params.eventPolygons5) },
  ];
}

// ---------------------------------------------------------------------------
// Single-user mode
// ---------------------------------------------------------------------------
async function runSingleMode(
  db: Db, params: GisTestParams, indexConfig: string,
): Promise<QueryStats[]> {
  const runners = defineQueryRunners(db, params, indexConfig);
  const allStats: QueryStats[] = [];

  for (const qr of runners) {
    if (qr.skip) {
      console.log(`  SKIP ${qr.name}: ${qr.label} (requires 2dsphere index)`);
      allStats.push({ name: qr.name, label: qr.label, samples: 0, min: 0, p50: 0, p95: 0, p99: 0, max: 0, avgRowCount: 0 });
      continue;
    }

    process.stdout.write(`  Running ${qr.name}: ${qr.label}...`);
    const samples = await benchmarkQuery(qr.name, qr.fn, ITERATIONS, WARMUP);
    const stats = calculateStats(qr.name, qr.label, samples);
    allStats.push(stats);
    console.log(` p50=${stats.p50.toFixed(1)}ms p95=${stats.p95.toFixed(1)}ms rows=${stats.avgRowCount.toFixed(0)}`);
  }

  return allStats;
}

// ---------------------------------------------------------------------------
// Concurrent mode (weighted random: G1 40%, G5 40%, G9 20%)
// ---------------------------------------------------------------------------
async function runConcurrentMode(
  db: Db, params: GisTestParams, concurrency: number,
): Promise<QueryStats[]> {
  console.log(`\n  Concurrent mode: ${concurrency} workers, weighted G1/G5/G9`);

  const queryFns = {
    G1: () => GQ.g1_nearSphereAssets500m(db, params.assetPoint[0], params.assetPoint[1]),
    G5: () => GQ.g5_bboxAssets(db, params.bbox.minLng, params.bbox.minLat, params.bbox.maxLng, params.bbox.maxLat),
    G9: () => GQ.g9_intersectsEventAssets(db, params.eventPolygon),
  };
  const weights = { G1: 0.4, G5: 0.4, G9: 0.2 };
  const entries = Object.entries(weights);

  function pickQuery(): [string, () => Promise<GQ.GisQueryResult>] {
    const r = Math.random();
    let cum = 0;
    for (const [name, w] of entries) {
      cum += w;
      if (r <= cum) return [name, queryFns[name as keyof typeof queryFns]];
    }
    return ['G9', queryFns.G9];
  }

  const allSamples: TimingSample[] = [];
  const iterPerWorker = Math.ceil(ITERATIONS / concurrency);

  const workers = Array.from({ length: concurrency }, async () => {
    for (let i = 0; i < iterPerWorker; i++) {
      const [name, fn] = pickQuery();
      const start = performance.now();
      const result = await fn();
      const durationMs = performance.now() - start;
      allSamples.push({ queryName: name, durationMs, rowCount: result.count });
    }
  });

  // Warmup first
  for (let i = 0; i < WARMUP; i++) {
    const [, fn] = pickQuery();
    await fn();
  }

  await Promise.all(workers);

  // Group samples by query name
  const grouped = new Map<string, TimingSample[]>();
  for (const s of allSamples) {
    if (!grouped.has(s.queryName)) grouped.set(s.queryName, []);
    grouped.get(s.queryName)!.push(s);
  }

  const stats: QueryStats[] = [];
  for (const [name, samples] of grouped) {
    const label = name === 'G1' ? 'Concurrent $nearSphere 500m'
      : name === 'G5' ? 'Concurrent $geoWithin $box'
      : 'Concurrent $geoIntersects';
    const s = calculateStats(name, label, samples);
    stats.push(s);
    console.log(`    ${name}: p50=${s.p50.toFixed(1)}ms p95=${s.p95.toFixed(1)}ms (${samples.length} samples)`);
  }

  // Add throughput stat
  const totalSamples = allSamples.length;
  const totalDurationMs = allSamples.reduce((a, s) => a + s.durationMs, 0);
  console.log(`    Throughput: ${(totalSamples / (totalDurationMs / 1000 / concurrency)).toFixed(0)} q/s`);

  return stats;
}

// ---------------------------------------------------------------------------
// Mixed read+write mode
// ---------------------------------------------------------------------------
async function runMixedMode(
  db: Db, params: GisTestParams,
): Promise<QueryStats[]> {
  console.log('\n  Mixed mode: 10 read + 5 write workers');

  const readSamples: TimingSample[] = [];
  const writeSamples: TimingSample[] = [];
  const iterPerReader = Math.ceil(ITERATIONS / 10);
  const iterPerWriter = Math.ceil(ITERATIONS / 10); // writers do half the iters

  const queryFns = {
    G1: () => GQ.g1_nearSphereAssets500m(db, params.assetPoint[0], params.assetPoint[1]),
    G5: () => GQ.g5_bboxAssets(db, params.bbox.minLng, params.bbox.minLat, params.bbox.maxLng, params.bbox.maxLat),
    G9: () => GQ.g9_intersectsEventAssets(db, params.eventPolygon),
  };
  const entries = [['G1', 0.4], ['G5', 0.4], ['G9', 0.2]] as const;

  function pickQuery(): [string, () => Promise<GQ.GisQueryResult>] {
    const r = Math.random();
    let cum = 0;
    for (const [name, w] of entries) {
      cum += w;
      if (r <= cum) return [name, queryFns[name as keyof typeof queryFns]];
    }
    return ['G9', queryFns.G9];
  }

  // Read workers
  const readers = Array.from({ length: 10 }, async () => {
    for (let i = 0; i < iterPerReader; i++) {
      const [name, fn] = pickQuery();
      const start = performance.now();
      const result = await fn();
      const durationMs = performance.now() - start;
      readSamples.push({ queryName: name, durationMs, rowCount: result.count });
    }
  });

  // Write workers (insert random events)
  const BBOX = { minLng: 136.8, minLat: 35.05, maxLng: 137.05, maxLat: 35.25 };
  const writers = Array.from({ length: 5 }, async () => {
    for (let i = 0; i < iterPerWriter; i++) {
      const lng = BBOX.minLng + Math.random() * (BBOX.maxLng - BBOX.minLng);
      const lat = BBOX.minLat + Math.random() * (BBOX.maxLat - BBOX.minLat);
      const poly = turf.buffer(turf.point([lng, lat]), 100 + Math.random() * 400, { units: 'meters' })!.geometry;
      const start = performance.now();
      await db.collection('gis_events').insertOne({
        id: `GIS-MIX-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        geometry: poly,
        status: 'active',
        asset_id: 'GIS-A-mixed',
      });
      const durationMs = performance.now() - start;
      writeSamples.push({ queryName: 'WRITE', durationMs, rowCount: 1 });
    }
  });

  await Promise.all([...readers, ...writers]);

  // Clean up mixed-mode data
  await db.collection('gis_events').deleteMany({ id: { $regex: /^GIS-MIX-/ } });

  // Aggregate read stats
  const grouped = new Map<string, TimingSample[]>();
  for (const s of readSamples) {
    if (!grouped.has(s.queryName)) grouped.set(s.queryName, []);
    grouped.get(s.queryName)!.push(s);
  }

  const stats: QueryStats[] = [];
  for (const [name, samples] of grouped) {
    const label = `Mixed-read ${name}`;
    const s = calculateStats(name, label, samples);
    stats.push(s);
    console.log(`    Read ${name}: p50=${s.p50.toFixed(1)}ms p95=${s.p95.toFixed(1)}ms`);
  }

  // Write stats
  const writeStats = calculateStats('WRITE', 'Mixed-write insert', writeSamples);
  stats.push(writeStats);
  console.log(`    WRITE: p50=${writeStats.p50.toFixed(1)}ms p95=${writeStats.p95.toFixed(1)}ms`);

  return stats;
}

// ---------------------------------------------------------------------------
// PostGIS comparison
// ---------------------------------------------------------------------------
async function runPgComparison(params: GisTestParams): Promise<QueryStats[]> {
  console.log('\n  PostGIS comparison (G1\', G9\', G11\')...');
  const stats: QueryStats[] = [];

  // G1'
  process.stdout.write('    G1\': ST_DWithin 500m...');
  const g1Samples = await benchmarkQuery("G1'", async () => {
    const r = await PGQ.g1_pg_dwithin(pool, params.assetPoint[0], params.assetPoint[1]);
    return { count: r.count };
  }, ITERATIONS, WARMUP);
  const g1Stats = calculateStats("G1'", 'PG ST_DWithin 500m', g1Samples);
  stats.push(g1Stats);
  console.log(` p50=${g1Stats.p50.toFixed(1)}ms p95=${g1Stats.p95.toFixed(1)}ms`);

  // G9'
  process.stdout.write('    G9\': ST_Intersects event...');
  const g9Samples = await benchmarkQuery("G9'", async () => {
    const r = await PGQ.g9_pg_intersects(pool, params.eventId);
    return { count: r.count };
  }, ITERATIONS, WARMUP);
  const g9Stats = calculateStats("G9'", 'PG ST_Intersects event→assets', g9Samples);
  stats.push(g9Stats);
  console.log(` p50=${g9Stats.p50.toFixed(1)}ms p95=${g9Stats.p95.toFixed(1)}ms`);

  // G11'
  process.stdout.write('    G11\': ST_Buffer + ST_Intersects...');
  const g11Samples = await benchmarkQuery("G11'", async () => {
    const r = await PGQ.g11_pg_bufferIntersects(pool, params.assetPoint[0], params.assetPoint[1], 200);
    return { count: r.count };
  }, ITERATIONS, WARMUP);
  const g11Stats = calculateStats("G11'", 'PG ST_Buffer + ST_Intersects', g11Samples);
  stats.push(g11Stats);
  console.log(` p50=${g11Stats.p50.toFixed(1)}ms p95=${g11Stats.p95.toFixed(1)}ms`);

  return stats;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\n=== GIS Spatial Benchmark Runner ===`);
  console.log(`  Tier: ${TIER}`);
  console.log(`  Index config: ${INDEX_CONFIG}`);
  console.log(`  Mode: ${MODE}`);
  console.log(`  Iterations: ${ITERATIONS} (warmup: ${WARMUP})`);
  if (MODE === 'concurrent') console.log(`  Concurrency: ${CONCURRENCY}`);
  console.log(`  PostGIS comparison: ${WITH_PG ? 'yes' : 'no'}`);
  console.log(`  MongoDB: ${MONGO_URL}`);
  console.log();

  const client = new MongoClient(MONGO_URL, { maxPoolSize: 50 });
  await client.connect();
  const mdb = client.db();

  // Verify data exists
  const assetCount = await mdb.collection('gis_assets').countDocuments();
  const eventCount = await mdb.collection('gis_events').countDocuments();
  console.log(`  Data: ${assetCount} assets, ${eventCount} events`);
  if (assetCount === 0) {
    console.error('\nNo GIS data found! Run gis-seed.ts first.');
    process.exit(1);
  }

  const configs = INDEX_CONFIG === 'all' ? ['A', 'B', 'C'] : [INDEX_CONFIG];
  const modes = MODE === 'all' ? ['single', 'concurrent', 'mixed'] : [MODE];

  for (const config of configs) {
    await applyIndexConfig(mdb, config);
    const params = await fetchTestParams(mdb);
    console.log(`\n  Test params: point=[${params.assetPoint.map(c => c.toFixed(4))}], bbox=[${Object.values(params.bbox).map(c => c.toFixed(4))}]`);

    for (const mode of modes) {
      console.log(`\n--- Config ${config}, Mode: ${mode} ---`);

      let mongoStats: QueryStats[];
      switch (mode) {
        case 'single':
          mongoStats = await runSingleMode(mdb, params, config);
          break;
        case 'concurrent':
          mongoStats = await runConcurrentMode(mdb, params, CONCURRENCY);
          break;
        case 'mixed':
          mongoStats = await runMixedMode(mdb, params);
          break;
        default:
          throw new Error(`Unknown mode: ${mode}`);
      }

      // Print summary
      printSummary(mongoStats, GQ.GIS_THRESHOLDS);

      // PostGIS comparison (only in single mode with config B)
      let pgStats: QueryStats[] | undefined;
      if (WITH_PG && mode === 'single' && config === 'B') {
        pgStats = await runPgComparison(params);
      }

      // Generate report
      const report = {
        ...generateReport(`local-mongo-gis`, TIER, mongoStats, GQ.GIS_THRESHOLDS),
        indexConfig: config,
        mode,
        concurrency: mode === 'concurrent' ? CONCURRENCY : undefined,
        pgComparison: pgStats?.map(s => ({ ...s })),
      };

      // Save report
      const outputPath = OUTPUT || `poc/reports/gis-${TIER}-${config}-${mode}.json`;
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, JSON.stringify(report, null, 2));
      console.log(`\n  Report saved: ${outputPath}`);
      console.log(`  Verdict: ${(report as unknown as { summary: { verdict: string } }).summary.verdict}`);
    }
  }

  await client.close();
  if (WITH_PG) await pool.end();
  console.log('\nDone.\n');
}

main().catch((err) => {
  console.error('GIS benchmark failed:', err);
  process.exit(1);
});

/**
 * GIS benchmark data generator — seeds MongoDB + PostgreSQL with spatial test data.
 *
 * Usage:
 *   npx tsx poc-mongo/benchmark/gis-seed.ts --tier S       # 1K assets + 500 events
 *   npx tsx poc-mongo/benchmark/gis-seed.ts --tier M       # 10K assets + 5K events
 *   npx tsx poc-mongo/benchmark/gis-seed.ts --tier L       # 50K assets + 25K events
 *   npx tsx poc-mongo/benchmark/gis-seed.ts --tier XL      # 200K assets + 100K events
 *   npx tsx poc-mongo/benchmark/gis-seed.ts --clean        # Remove GIS data only
 *   npx tsx poc-mongo/benchmark/gis-seed.ts --tier M --mongo-only
 *   npx tsx poc-mongo/benchmark/gis-seed.ts --tier M --pg-only
 */

import { MongoClient, type Db } from 'mongodb';
import { db, pool } from '../../backend/src/db/index.js';
import { sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import * as turf from '@turf/turf';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
function getArg(name: string, defaultVal: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
}
const TIER = getArg('tier', 'S').toUpperCase() as 'S' | 'M' | 'L' | 'XL';
const CLEAN = args.includes('--clean');
const MONGO_ONLY = args.includes('--mongo-only');
const PG_ONLY = args.includes('--pg-only');

const MONGO_URL = process.env.MONGO_BENCH_URL ?? 'mongodb://localhost:27019/nagoya_bench?directConnection=true';

// ---------------------------------------------------------------------------
// Tier configuration
// ---------------------------------------------------------------------------
const TIER_CONFIG = {
  S:  { assets: 1_000,   events: 500 },
  M:  { assets: 10_000,  events: 5_000 },
  L:  { assets: 50_000,  events: 25_000 },
  XL: { assets: 200_000, events: 100_000 },
} as const;

if (!CLEAN && !TIER_CONFIG[TIER]) {
  console.error('Usage: npx tsx poc-mongo/benchmark/gis-seed.ts --tier S|M|L|XL');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const BBOX = { minLng: 136.8, minLat: 35.05, maxLng: 137.05, maxLat: 35.25 } as const;
const WARDS = ['中区', '北区', '昭和区', '瑞穂区', '天白区', '西区', '中村区', '東区', '千種区',
  '守山区', '名東区', '南区', '港区', '熱田区', '緑区', '中川区'] as const;
const ASSET_TYPES = ['road', 'greenspace', 'street_tree', 'park_facility', 'streetlight', 'pump_station'] as const;
const STATUSES = ['active', 'inactive'] as const;
const STATUS_WEIGHTS = [0.85, 0.15];
const EVENT_STATUSES = ['planned', 'active', 'pending_review', 'closed'] as const;
const EVENT_STATUS_WEIGHTS = [0.15, 0.40, 0.20, 0.25];

// Naka-ku ward polygon (for G7 query)
export const NAKAKU_POLYGON = turf.bboxPolygon([136.89, 35.15, 136.93, 35.19]).geometry;

const BATCH_SIZE = 5000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
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

function randomInBbox(): [number, number] {
  const lng = BBOX.minLng + Math.random() * (BBOX.maxLng - BBOX.minLng);
  const lat = BBOX.minLat + Math.random() * (BBOX.maxLat - BBOX.minLat);
  return [lng, lat];
}

function randomPointGeom(): GeoJSON.Point {
  const [lng, lat] = randomInBbox();
  return { type: 'Point', coordinates: [lng, lat] };
}

function randomPolygonGeom(): GeoJSON.Polygon {
  const [lng, lat] = randomInBbox();
  const radiusM = 20 + Math.random() * 180; // 20-200m
  const buffered = turf.buffer(turf.point([lng, lat]), radiusM, { units: 'meters' });
  return buffered!.geometry as GeoJSON.Polygon;
}

function randomEventPolygon(assetGeom: GeoJSON.Point | GeoJSON.Polygon): GeoJSON.Polygon {
  const center = turf.centroid(assetGeom);
  const radiusM = 50 + Math.random() * 450; // 50-500m
  const buffered = turf.buffer(center, radiusM, { units: 'meters' });
  return buffered!.geometry as GeoJSON.Polygon;
}

// ---------------------------------------------------------------------------
// Data generation
// ---------------------------------------------------------------------------
interface GisAsset {
  id: string;
  geometry: GeoJSON.Point | GeoJSON.Polygon;
  status: string;
  ward: string;
  asset_type: string;
}

interface GisEvent {
  id: string;
  geometry: GeoJSON.Polygon;
  status: string;
  asset_id: string;
}

function generateAssets(count: number): GisAsset[] {
  console.log(`  Generating ${count} assets (60% Point, 40% Polygon)...`);
  const assets: GisAsset[] = [];
  for (let i = 0; i < count; i++) {
    const isPoint = Math.random() < 0.6;
    assets.push({
      id: `GIS-A-${nanoid(10)}`,
      geometry: isPoint ? randomPointGeom() : randomPolygonGeom(),
      status: pickWeighted(STATUSES, STATUS_WEIGHTS),
      ward: pick(WARDS),
      asset_type: pick(ASSET_TYPES),
    });
  }
  return assets;
}

function generateEvents(count: number, assets: GisAsset[]): GisEvent[] {
  console.log(`  Generating ${count} events (Polygon impact areas)...`);
  const events: GisEvent[] = [];
  for (let i = 0; i < count; i++) {
    const asset = assets[Math.floor(Math.random() * assets.length)];
    events.push({
      id: `GIS-E-${nanoid(10)}`,
      geometry: randomEventPolygon(asset.geometry),
      status: pickWeighted(EVENT_STATUSES, EVENT_STATUS_WEIGHTS),
      asset_id: asset.id,
    });
  }
  return events;
}

// ---------------------------------------------------------------------------
// MongoDB seeding
// ---------------------------------------------------------------------------
async function seedMongo(mdb: Db, assets: GisAsset[], events: GisEvent[]): Promise<void> {
  console.log(`  Seeding MongoDB (${assets.length} assets + ${events.length} events)...`);

  // Drop existing collections
  const collections = await mdb.listCollections().toArray();
  if (collections.some(c => c.name === 'gis_assets')) await mdb.dropCollection('gis_assets');
  if (collections.some(c => c.name === 'gis_events')) await mdb.dropCollection('gis_events');

  // Insert assets in batches
  for (let i = 0; i < assets.length; i += BATCH_SIZE) {
    const batch = assets.slice(i, i + BATCH_SIZE);
    await mdb.collection('gis_assets').insertMany(batch);
    process.stdout.write(`    Assets: ${Math.min(i + BATCH_SIZE, assets.length)}/${assets.length}\r`);
  }
  console.log();

  // Insert events in batches
  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE);
    await mdb.collection('gis_events').insertMany(batch);
    process.stdout.write(`    Events: ${Math.min(i + BATCH_SIZE, events.length)}/${events.length}\r`);
  }
  console.log();

  // Create default 2dsphere indexes
  await mdb.collection('gis_assets').createIndex({ geometry: '2dsphere' });
  await mdb.collection('gis_assets').createIndex({ id: 1 }, { unique: true });
  await mdb.collection('gis_events').createIndex({ geometry: '2dsphere' });
  await mdb.collection('gis_events').createIndex({ id: 1 }, { unique: true });
  await mdb.collection('gis_events').createIndex({ asset_id: 1 });

  console.log('    MongoDB: indexes created');
}

// ---------------------------------------------------------------------------
// PostgreSQL seeding (dedicated benchmark tables — avoids trigger conflicts)
// ---------------------------------------------------------------------------
async function createPgTables(): Promise<void> {
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS gis_benchmark_assets (
      id varchar(50) PRIMARY KEY,
      geometry geometry(Geometry, 4326) NOT NULL,
      status varchar(20) NOT NULL DEFAULT 'active',
      ward varchar(100),
      asset_type varchar(50)
    )
  `));
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS gis_benchmark_events (
      id varchar(50) PRIMARY KEY,
      geometry geometry(Geometry, 4326) NOT NULL,
      status varchar(20) NOT NULL DEFAULT 'active',
      asset_id varchar(50)
    )
  `));
  // GIST indexes for spatial queries
  await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_gis_bench_assets_geom ON gis_benchmark_assets USING GIST (geometry)`));
  await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_gis_bench_events_geom ON gis_benchmark_events USING GIST (geometry)`));
  await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_gis_bench_assets_status ON gis_benchmark_assets (status)`));
}

async function seedPostgres(assets: GisAsset[], events: GisEvent[]): Promise<void> {
  console.log(`  Seeding PostgreSQL (${assets.length} assets + ${events.length} events)...`);

  await createPgTables();
  // Clean existing data
  await db.execute(sql.raw(`TRUNCATE gis_benchmark_assets, gis_benchmark_events`));

  // Insert assets
  for (let i = 0; i < assets.length; i += BATCH_SIZE) {
    const batch = assets.slice(i, i + BATCH_SIZE);
    const values = batch.map(a => {
      const geomJson = JSON.stringify(a.geometry).replace(/'/g, "''");
      return `(
        '${a.id}', ST_SetSRID(ST_GeomFromGeoJSON('${geomJson}'), 4326),
        '${a.status}', '${a.ward}', '${a.asset_type}'
      )`;
    });
    await db.execute(sql.raw(`
      INSERT INTO gis_benchmark_assets (id, geometry, status, ward, asset_type)
      VALUES ${values.join(',')}
      ON CONFLICT (id) DO NOTHING
    `));
    process.stdout.write(`    PG Assets: ${Math.min(i + BATCH_SIZE, assets.length)}/${assets.length}\r`);
  }
  console.log();

  // Insert events
  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE);
    const values = batch.map(e => {
      const geomJson = JSON.stringify(e.geometry).replace(/'/g, "''");
      return `(
        '${e.id}', ST_SetSRID(ST_GeomFromGeoJSON('${geomJson}'), 4326),
        '${e.status}', '${e.asset_id}'
      )`;
    });
    await db.execute(sql.raw(`
      INSERT INTO gis_benchmark_events (id, geometry, status, asset_id)
      VALUES ${values.join(',')}
      ON CONFLICT (id) DO NOTHING
    `));
    process.stdout.write(`    PG Events: ${Math.min(i + BATCH_SIZE, events.length)}/${events.length}\r`);
  }
  console.log();
}

// ---------------------------------------------------------------------------
// Clean functions
// ---------------------------------------------------------------------------
async function cleanMongo(mdb: Db): Promise<void> {
  console.log('  Cleaning MongoDB GIS data...');
  const collections = await mdb.listCollections().toArray();
  if (collections.some(c => c.name === 'gis_assets')) await mdb.dropCollection('gis_assets');
  if (collections.some(c => c.name === 'gis_events')) await mdb.dropCollection('gis_events');
  console.log('    MongoDB: gis_assets + gis_events dropped');
}

async function cleanPostgres(): Promise<void> {
  console.log('  Cleaning PostgreSQL GIS data...');
  await db.execute(sql.raw(`DROP TABLE IF EXISTS gis_benchmark_assets CASCADE`));
  await db.execute(sql.raw(`DROP TABLE IF EXISTS gis_benchmark_events CASCADE`));
  console.log('    PG: gis_benchmark_assets + gis_benchmark_events dropped');
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
async function validate(mdb: Db | null): Promise<void> {
  console.log('\nValidation:');

  if (mdb) {
    const mongoAssets = await mdb.collection('gis_assets').countDocuments();
    const mongoEvents = await mdb.collection('gis_events').countDocuments();
    console.log(`  MongoDB: ${mongoAssets} assets, ${mongoEvents} events`);
  }

  if (!MONGO_ONLY) {
    try {
      const pgCounts = await db.execute<{ table_name: string; count: number }>(sql`
        SELECT 'assets' as table_name, COUNT(*)::int as count FROM gis_benchmark_assets
        UNION ALL SELECT 'events', COUNT(*)::int FROM gis_benchmark_events
      `);
      for (const row of pgCounts.rows) {
        console.log(`  PG: ${row.table_name} = ${row.count}`);
      }
    } catch {
      console.log('  PG: tables not created (use --pg-only or without --mongo-only)');
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  let mongoClient: MongoClient | null = null;
  let mdb: Db | null = null;

  if (!PG_ONLY) {
    mongoClient = new MongoClient(MONGO_URL, { maxPoolSize: 10 });
    await mongoClient.connect();
    mdb = mongoClient.db();
  }

  if (CLEAN) {
    console.log('\n=== GIS Seed: Clean ===\n');
    if (mdb) await cleanMongo(mdb);
    if (!MONGO_ONLY) await cleanPostgres();
    console.log('\nDone.');
  } else {
    const config = TIER_CONFIG[TIER];
    console.log(`\n=== GIS Seed: tier=${TIER} (${config.assets} assets + ${config.events} events) ===\n`);

    const assets = generateAssets(config.assets);
    const events = generateEvents(config.events, assets);

    if (mdb && !PG_ONLY) await seedMongo(mdb, assets, events);
    if (!MONGO_ONLY) await seedPostgres(assets, events);

    await validate(mdb);
  }

  if (mongoClient) await mongoClient.close();
  await pool.end();
  console.log('\nSeed complete.\n');
}

// Only run main() when this file is the entry point (not when imported)
const isMain = process.argv[1]?.includes('gis-seed');
if (isMain) {
  main().catch((err) => {
    console.error('GIS seed failed:', err);
    process.exit(1);
  });
}

/**
 * PG → MongoDB data export/import pipeline.
 *
 * Reads all relevant tables from PostgreSQL and imports them into MongoDB
 * with proper GeoJSON geometry conversion and index creation.
 *
 * Usage:
 *   npx tsx poc-mongo/import/pg-to-mongo.ts
 *   npx tsx poc-mongo/import/pg-to-mongo.ts --clean   # Drop collections first
 */

import { MongoClient } from 'mongodb';
import { pool } from '../../backend/src/db/index.js';

const MONGO_URL = process.env.MONGO_BENCH_URL ?? 'mongodb://localhost:27019/nagoya_bench?directConnection=true';
const CLEAN = process.argv.includes('--clean');

// Tables to export and whether they have geometry columns
const TABLE_CONFIG: Array<{
  table: string;
  geometryCols: string[];    // columns that need ST_AsGeoJSON conversion
  extraSelect?: string;      // additional SELECT expressions
}> = [
  { table: 'road_assets', geometryCols: ['geometry', 'geometry_polygon'] },
  { table: 'construction_events', geometryCols: ['geometry'] },
  { table: 'event_road_assets', geometryCols: [] },
  { table: 'work_orders', geometryCols: [] },
  { table: 'work_order_partners', geometryCols: [] },
  { table: 'evidence', geometryCols: ['geometry'] },
  { table: 'inspection_records', geometryCols: ['geometry'] },
  { table: 'decisions', geometryCols: [] },
  { table: 'audit_logs', geometryCols: [] },
  { table: 'greenspace_assets', geometryCols: ['geometry'] },
  { table: 'street_tree_assets', geometryCols: ['geometry'] },
];

// Index definitions per collection
const INDEX_CONFIG: Record<string, Array<{ key: Record<string, unknown>; options?: Record<string, unknown> }>> = {
  road_assets: [
    { key: { id: 1 }, options: { unique: true } },
    { key: { geometry: '2dsphere' } },
    { key: { status: 1 } },
  ],
  construction_events: [
    { key: { id: 1 }, options: { unique: true } },
    { key: { status: 1, archived_at: 1 } },
    { key: { geometry: '2dsphere' } },
  ],
  event_road_assets: [
    { key: { event_id: 1 } },
    { key: { road_asset_id: 1 } },
  ],
  work_orders: [
    { key: { id: 1 }, options: { unique: true } },
    { key: { event_id: 1 } },
    { key: { status: 1 } },
  ],
  work_order_partners: [
    { key: { work_order_id: 1 } },
    { key: { partner_id: 1 } },
  ],
  evidence: [
    { key: { id: 1 }, options: { unique: true } },
    { key: { work_order_id: 1 } },
    { key: { review_status: 1 } },
  ],
  inspection_records: [
    { key: { id: 1 }, options: { unique: true } },
    { key: { asset_type: 1, asset_id: 1 } },
  ],
  decisions: [
    { key: { id: 1 }, options: { unique: true } },
    { key: { entity_type: 1, entity_id: 1 } },
    { key: { decided_at: -1 } },
  ],
  audit_logs: [
    { key: { id: 1 }, options: { unique: true } },
    { key: { entity_type: 1, entity_id: 1 } },
    { key: { created_at: -1 } },
    { key: { entity_type: 1, created_at: -1 } },
    { key: { action: 1 } },
    { key: { actor: 1 } },
    { key: { decision_id: 1 } },
  ],
  greenspace_assets: [
    { key: { id: 1 }, options: { unique: true } },
    { key: { geometry: '2dsphere' } },
    { key: { status: 1 } },
  ],
  street_tree_assets: [
    { key: { id: 1 }, options: { unique: true } },
    { key: { geometry: '2dsphere' } },
    { key: { status: 1 } },
  ],
};

function buildSelectQuery(table: string, geometryCols: string[]): string {
  if (geometryCols.length === 0) {
    return `SELECT * FROM ${table}`;
  }

  // Build SELECT with ST_AsGeoJSON for geometry columns
  // We select *, then override geometry columns with their GeoJSON equivalents
  const geojsonCols = geometryCols
    .map(col => `ST_AsGeoJSON(${col})::json as "${col}"`)
    .join(', ');

  // Use a CTE to get all columns, then override geometry ones
  return `SELECT t.*, ${geometryCols.map(col => `geo.${col} as "${col}__geo"`).join(', ')}
    FROM ${table} t,
    LATERAL (SELECT ${geojsonCols}) geo`;
}

async function exportTable(
  pgClient: import('pg').PoolClient,
  mongoDb: import('mongodb').Db,
  config: typeof TABLE_CONFIG[0],
): Promise<number> {
  const { table, geometryCols } = config;

  // Simple approach: SELECT all, convert geometry columns
  let query: string;
  if (geometryCols.length === 0) {
    query = `SELECT * FROM ${table}`;
  } else {
    // Build column list: replace geometry columns with ST_AsGeoJSON versions
    const colResult = await pgClient.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = $1 AND table_schema = 'public'
      ORDER BY ordinal_position
    `, [table]);

    const columns = colResult.rows.map((r: { column_name: string }) => {
      if (geometryCols.includes(r.column_name)) {
        return `ST_AsGeoJSON(${r.column_name})::json as "${r.column_name}"`;
      }
      return `"${r.column_name}"`;
    });

    query = `SELECT ${columns.join(', ')} FROM ${table}`;
  }

  const result = await pgClient.query(query);
  const rows = result.rows;

  if (rows.length === 0) {
    console.log(`  ${table}: 0 rows (empty)`);
    return 0;
  }

  // Convert date strings to Date objects for MongoDB
  const docs = rows.map((row: Record<string, unknown>) => {
    const doc: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (value instanceof Date) {
        doc[key] = value;
      } else {
        doc[key] = value;
      }
    }
    return doc;
  });

  // Insert in batches of 5000
  const collection = mongoDb.collection(table);
  const batchSize = 5000;
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);
    await collection.insertMany(batch, { ordered: false });
  }

  return docs.length;
}

async function createIndexes(mongoDb: import('mongodb').Db) {
  console.log('\nCreating indexes...');
  for (const [collectionName, indexes] of Object.entries(INDEX_CONFIG)) {
    const collection = mongoDb.collection(collectionName);
    for (const idx of indexes) {
      try {
        await collection.createIndex(idx.key as any, idx.options as any);
      } catch (err: unknown) {
        // Skip if geometry index fails on null geometries
        const msg = (err as Error).message;
        if (msg.includes('2dsphere')) {
          console.warn(`  Warning: 2dsphere index on ${collectionName} skipped (null geometries). Filtering nulls...`);
          // Create partial index excluding null geometry
          const geoKey = Object.keys(idx.key)[0];
          try {
            await collection.createIndex(idx.key as any, {
              ...idx.options,
              partialFilterExpression: { [geoKey]: { $exists: true, $ne: null } },
            } as any);
          } catch {
            console.warn(`  Warning: Partial 2dsphere index on ${collectionName}.${geoKey} also failed`);
          }
        } else {
          console.warn(`  Warning: Index creation failed on ${collectionName}: ${msg}`);
        }
      }
    }
    console.log(`  ${collectionName}: indexes created`);
  }
}

async function main() {
  console.log('=== PG → MongoDB Import ===\n');
  console.log(`  PG: ${pool.options.host ?? 'localhost'}:${pool.options.port ?? 5432}`);
  console.log(`  Mongo: ${MONGO_URL}`);
  console.log();

  const mongo = new MongoClient(MONGO_URL, { maxPoolSize: 10 });
  await mongo.connect();
  const mongoDb = mongo.db();

  if (CLEAN) {
    console.log('Cleaning existing collections...');
    const collections = await mongoDb.listCollections().toArray();
    for (const col of collections) {
      await mongoDb.dropCollection(col.name);
    }
    console.log(`  Dropped ${collections.length} collections\n`);
  }

  const pgClient = await pool.connect();
  try {
    const totals: Record<string, number> = {};

    for (const config of TABLE_CONFIG) {
      process.stdout.write(`  Exporting ${config.table}...`);
      const count = await exportTable(pgClient, mongoDb, config);
      totals[config.table] = count;
      console.log(` ${count} rows`);
    }

    // Create indexes
    await createIndexes(mongoDb);

    // Summary
    console.log('\n=== Import Summary ===');
    let total = 0;
    for (const [table, count] of Object.entries(totals)) {
      console.log(`  ${table.padEnd(25)} ${count.toString().padStart(8)}`);
      total += count;
    }
    console.log(`  ${'TOTAL'.padEnd(25)} ${total.toString().padStart(8)}`);
    console.log('\nImport complete.');
  } finally {
    pgClient.release();
    await pool.end();
    await mongo.close();
  }
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});

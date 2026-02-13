/**
 * Validates data parity between PostgreSQL and MongoDB after import.
 *
 * Checks:
 *   1. Row counts match per table/collection
 *   2. Chain coverage: decisions → entity exists, audit_logs → entity exists
 *   3. Geometry spot-check: sample records have valid GeoJSON
 *   4. Index verification
 *
 * Usage:
 *   npx tsx poc-mongo/import/validate.ts
 */

import { MongoClient } from 'mongodb';
import { pool } from '../../backend/src/db/index.js';

const MONGO_URL = process.env.MONGO_BENCH_URL ?? 'mongodb://localhost:27019/nagoya_bench?directConnection=true';

const TABLES = [
  'road_assets', 'construction_events', 'event_road_assets',
  'work_orders', 'work_order_partners', 'evidence',
  'inspection_records', 'decisions', 'audit_logs',
  'greenspace_assets', 'street_tree_assets',
];

const GEOMETRY_COLLECTIONS = [
  'road_assets', 'construction_events', 'evidence',
  'inspection_records', 'greenspace_assets', 'street_tree_assets',
];

async function main() {
  console.log('=== PG ↔ MongoDB Validation ===\n');

  const mongo = new MongoClient(MONGO_URL, { maxPoolSize: 5 });
  await mongo.connect();
  const mongoDb = mongo.db();
  const pgClient = await pool.connect();

  let errors = 0;

  // 1. Row count comparison
  console.log('1. Row Count Comparison\n');
  for (const table of TABLES) {
    const pgResult = await pgClient.query(`SELECT COUNT(*)::int as count FROM ${table}`);
    const pgCount = pgResult.rows[0].count;
    const mongoCount = await mongoDb.collection(table).countDocuments();

    const match = pgCount === mongoCount;
    const icon = match ? '✓' : '✗';
    console.log(`  ${icon} ${table.padEnd(25)} PG=${pgCount.toString().padStart(8)}  Mongo=${mongoCount.toString().padStart(8)}`);
    if (!match) errors++;
  }

  // 2. Chain coverage
  console.log('\n2. Chain Coverage\n');

  // Check decisions → entity exists
  const decisions = await mongoDb.collection('decisions').find({}, { projection: { entity_type: 1, entity_id: 1 } }).toArray();
  let decisionMissing = 0;
  const entityCollectionMap: Record<string, string> = {
    event: 'construction_events',
    evidence: 'evidence',
    work_order: 'work_orders',
    inspection: 'inspection_records',
    asset_condition: 'road_assets', // fallback
  };

  for (const dec of decisions) {
    const targetCollection = entityCollectionMap[dec.entity_type];
    if (!targetCollection) continue;
    const exists = await mongoDb.collection(targetCollection).findOne({ id: dec.entity_id });
    if (!exists) decisionMissing++;
  }
  const decIcon = decisionMissing === 0 ? '✓' : '✗';
  console.log(`  ${decIcon} decisions → entity: ${decisions.length} checked, ${decisionMissing} missing`);
  if (decisionMissing > 0) errors++;

  // Check audit_logs → entity exists
  const audits = await mongoDb.collection('audit_logs')
    .find({}, { projection: { entity_type: 1, entity_id: 1 } })
    .limit(1000)
    .toArray();
  let auditMissing = 0;
  for (const aud of audits) {
    const targetCollection = entityCollectionMap[aud.entity_type];
    if (!targetCollection) continue;
    const exists = await mongoDb.collection(targetCollection).findOne({ id: aud.entity_id });
    if (!exists) auditMissing++;
  }
  const audIcon = auditMissing === 0 ? '✓' : '✗';
  console.log(`  ${audIcon} audit_logs → entity: ${audits.length} checked, ${auditMissing} missing`);
  if (auditMissing > 0) errors++;

  // 3. Geometry spot-check
  console.log('\n3. Geometry Spot-Check\n');
  for (const coll of GEOMETRY_COLLECTIONS) {
    const sample = await mongoDb.collection(coll)
      .find({ geometry: { $ne: null } })
      .limit(5)
      .toArray();

    let validCount = 0;
    for (const doc of sample) {
      if (doc.geometry && doc.geometry.type && doc.geometry.coordinates) {
        validCount++;
      }
    }
    const geoIcon = validCount === sample.length ? '✓' : '✗';
    console.log(`  ${geoIcon} ${coll.padEnd(25)} ${validCount}/${sample.length} valid GeoJSON`);
    if (validCount !== sample.length) errors++;
  }

  // 4. Index verification
  console.log('\n4. Index Verification\n');
  for (const table of TABLES) {
    const indexes = await mongoDb.collection(table).indexes();
    // Count non-_id indexes
    const customIndexes = indexes.filter(idx => idx.name !== '_id_');
    console.log(`  ${table.padEnd(25)} ${customIndexes.length} indexes`);
  }

  // Summary
  console.log(`\n=== Validation ${errors === 0 ? 'PASSED' : 'FAILED'} (${errors} errors) ===`);

  pgClient.release();
  await pool.end();
  await mongo.close();
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Validation failed:', err);
  process.exit(1);
});

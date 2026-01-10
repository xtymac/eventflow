/**
 * Export Road Assets Script
 *
 * Exports road_assets from the database to GeoJSON format.
 * Used to sync database changes (like name enrichment) back to the GeoJSON file
 * for PMTiles generation.
 *
 * Usage:
 * npx tsx scripts/export-road-assets.ts
 *
 * Output:
 * sample-data/road_assets.geojson
 */

import { writeFileSync, existsSync, copyFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
import type { FeatureCollection, Feature, LineString } from 'geojson';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SAMPLE_DATA_DIR = join(__dirname, '../sample-data');
const OUTPUT_PATH = join(SAMPLE_DATA_DIR, 'road_assets.geojson');

async function main() {
  console.log('=== Export Road Assets to GeoJSON ===\n');

  // Connect to database
  const pool = new pg.Pool({
    connectionString:
      process.env.DATABASE_URL ||
      'postgresql://mac@localhost:5432/nagoya_construction',
  });

  const client = await pool.connect();

  try {
    // Get total count
    const countResult = await client.query('SELECT COUNT(*)::int as count FROM road_assets');
    const totalCount = countResult.rows[0].count;
    console.log(`Exporting ${totalCount} road assets...`);

    // Export all road assets with geometry (including OSM sync tracking fields)
    const result = await client.query(`
      SELECT
        id,
        name,
        name_ja,
        ref,
        local_ref,
        display_name,
        name_source,
        name_confidence,
        ST_AsGeoJSON(geometry)::json as geometry,
        road_type,
        lanes,
        direction,
        status,
        valid_from,
        valid_to,
        replaced_by,
        owner_department,
        ward,
        landmark,
        updated_at,
        osm_id,
        segment_index,
        sync_source,
        is_manually_edited,
        last_synced_at
      FROM road_assets
      ORDER BY id
    `);

    // Convert to GeoJSON FeatureCollection
    const features: Feature<LineString>[] = result.rows.map((row) => ({
      type: 'Feature' as const,
      properties: {
        id: row.id,
        name: row.name,
        name_ja: row.name_ja,
        ref: row.ref,
        local_ref: row.local_ref,
        displayName: row.display_name, // camelCase for PMTiles compatibility
        nameSource: row.name_source,
        nameConfidence: row.name_confidence,
        roadType: row.road_type,
        lanes: row.lanes,
        direction: row.direction,
        status: row.status,
        validFrom: row.valid_from?.toISOString()?.split('T')[0] || null,
        validTo: row.valid_to?.toISOString()?.split('T')[0] || null,
        replacedBy: row.replaced_by,
        ownerDepartment: row.owner_department,
        ward: row.ward,
        landmark: row.landmark,
        // OSM sync tracking fields
        osmId: row.osm_id,
        segmentIndex: row.segment_index,
        syncSource: row.sync_source,
        isManuallyEdited: row.is_manually_edited,
        lastSyncedAt: row.last_synced_at?.toISOString() || null,
      },
      geometry: row.geometry,
    }));

    const featureCollection: FeatureCollection = {
      type: 'FeatureCollection',
      features,
    };

    // Backup existing file
    if (existsSync(OUTPUT_PATH)) {
      const backupPath = OUTPUT_PATH.replace('.geojson', '_backup.geojson');
      copyFileSync(OUTPUT_PATH, backupPath);
      console.log(`Backed up existing file to: ${backupPath}`);
    }

    // Write GeoJSON file
    writeFileSync(OUTPUT_PATH, JSON.stringify(featureCollection, null, 2));
    console.log(`\nExported ${features.length} features to:`);
    console.log(`  ${OUTPUT_PATH}`);

    // Print statistics
    const namedCount = features.filter((f) => f.properties?.displayName).length;
    const unnamedCount = features.length - namedCount;

    console.log('\n=== Statistics ===');
    console.log(`Total features: ${features.length}`);
    console.log(`Named: ${namedCount} (${((namedCount / features.length) * 100).toFixed(1)}%)`);
    console.log(`Unnamed: ${unnamedCount}`);

    // Name source distribution
    const bySource: Record<string, number> = {};
    for (const feature of features) {
      const source = feature.properties?.nameSource || 'none';
      bySource[source] = (bySource[source] || 0) + 1;
    }
    console.log('\nBy name source:');
    for (const [source, count] of Object.entries(bySource)) {
      console.log(`  ${source}: ${count}`);
    }

    // OSM sync statistics
    const osmTracked = features.filter((f) => f.properties?.osmId).length;
    const manuallyEdited = features.filter((f) => f.properties?.isManuallyEdited).length;
    const syncedRecently = features.filter((f) => {
      if (!f.properties?.lastSyncedAt) return false;
      const syncDate = new Date(f.properties.lastSyncedAt as string);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return syncDate > oneDayAgo;
    }).length;

    console.log('\nOSM Sync Status:');
    console.log(`  OSM-tracked: ${osmTracked} (${((osmTracked / features.length) * 100).toFixed(1)}%)`);
    console.log(`  Manually edited (protected): ${manuallyEdited}`);
    console.log(`  Synced in last 24h: ${syncedRecently}`);

    // Sync source distribution
    const bySyncSource: Record<string, number> = {};
    for (const feature of features) {
      const source = feature.properties?.syncSource || 'unknown';
      bySyncSource[source] = (bySyncSource[source] || 0) + 1;
    }
    console.log('\nBy sync source:');
    for (const [source, count] of Object.entries(bySyncSource)) {
      console.log(`  ${source}: ${count}`);
    }

    console.log('\nNext steps:');
    console.log('1. Regenerate PMTiles: npm run tiles:generate');
    console.log('2. Verify labels on map');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

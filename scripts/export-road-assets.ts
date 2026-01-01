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
      'postgresql://postgres:postgres@localhost:5433/nagoya_construction',
  });

  const client = await pool.connect();

  try {
    // Get total count
    const countResult = await client.query('SELECT COUNT(*)::int as count FROM road_assets');
    const totalCount = countResult.rows[0].count;
    console.log(`Exporting ${totalCount} road assets...`);

    // Export all road assets with geometry
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
        updated_at
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

    // Source distribution
    const bySource: Record<string, number> = {};
    for (const feature of features) {
      const source = feature.properties?.nameSource || 'none';
      bySource[source] = (bySource[source] || 0) + 1;
    }
    console.log('\nBy source:');
    for (const [source, count] of Object.entries(bySource)) {
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

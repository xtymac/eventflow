/**
 * Import OSM Roads to road_assets table
 *
 * Reads GeoJSON files from sample-data/raw-roads and inserts into road_assets.
 * Generates unique IDs and maps OSM properties to our schema.
 *
 * Usage:
 *   npx tsx scripts/import-osm-roads.ts
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { FeatureCollection, LineString } from 'geojson';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://mac@localhost:5432/nagoya_construction';

interface RoadProperties {
  osmId: number;
  name: string | null;
  name_ja: string | null;
  ref: string | null;
  local_ref: string | null;
  roadType: string;
  lanes: number;
  direction: string;
  ward: string;
  osmHighway: string;
  surface: string | null;
}

async function importOsmRoads() {
  const client = new pg.Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('Connected to database');

    const dataDir = join(__dirname, '../sample-data/raw-roads');

    if (!existsSync(dataDir)) {
      console.error('No raw-roads directory found. Run fetch-road-network.ts first.');
      process.exit(1);
    }

    const files = readdirSync(dataDir).filter(f => f.endsWith('.geojson'));
    console.log(`Found ${files.length} road files to import`);

    // Check existing counts
    const existingResult = await client.query(`
      SELECT COUNT(*) as count FROM road_assets WHERE data_source = 'osm'
    `);
    const existingCount = parseInt(existingResult.rows[0].count);
    console.log(`Existing OSM roads in database: ${existingCount}`);

    if (existingCount > 0) {
      console.log('Clearing existing OSM roads...');
      await client.query(`DELETE FROM road_assets WHERE data_source = 'osm'`);
    }

    let totalImported = 0;
    let totalFiles = 0;

    for (const file of files) {
      const filePath = join(dataDir, file);
      console.log(`\nProcessing ${file}...`);

      try {
        const content = readFileSync(filePath, 'utf-8');
        const collection = JSON.parse(content) as FeatureCollection<LineString, RoadProperties>;

        const BATCH_SIZE = 500;
        let batchCount = 0;

        for (let i = 0; i < collection.features.length; i += BATCH_SIZE) {
          const batch = collection.features.slice(i, i + BATCH_SIZE);
          const values: string[] = [];
          const params: (string | number | null)[] = [];
          let paramIndex = 1;

          // Dedupe within batch by osmId
          const seenIds = new Set<number>();
          const dedupedBatch = batch.filter(f => {
            const osmId = f.properties.osmId;
            if (seenIds.has(osmId)) return false;
            seenIds.add(osmId);
            return true;
          });

          for (const feature of dedupedBatch) {
            const props = feature.properties;
            const geojson = JSON.stringify(feature.geometry);

            // Generate unique ID: RA-OSM-{osmId}
            const id = `RA-OSM-${props.osmId}`;

            // Build display name from available info
            let displayName = props.name || props.name_ja || props.ref || props.local_ref || `${props.osmHighway} road`;
            if (props.ward) {
              displayName = `${displayName} (${props.ward})`;
            }

            // Map direction
            const direction = props.direction === 'one-way' ? 'one-way' : 'two-way';

            values.push(`(
              $${paramIndex++},
              $${paramIndex++},
              $${paramIndex++},
              $${paramIndex++},
              $${paramIndex++},
              $${paramIndex++},
              $${paramIndex++},
              $${paramIndex++},
              $${paramIndex++},
              'active',
              NOW(),
              'osm',
              $${paramIndex++},
              ST_SetSRID(ST_GeomFromGeoJSON($${paramIndex++}), 4326)
            )`);

            params.push(
              id,
              props.name,
              props.name_ja,
              props.ref,
              props.local_ref,
              displayName,
              props.roadType,
              props.lanes,
              direction,
              props.ward,
              geojson
            );
          }

          // Batch insert
          await client.query(`
            INSERT INTO road_assets (
              id,
              name,
              name_ja,
              ref,
              local_ref,
              display_name,
              road_type,
              lanes,
              direction,
              status,
              valid_from,
              data_source,
              ward,
              geometry
            ) VALUES ${values.join(', ')}
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              name_ja = EXCLUDED.name_ja,
              ref = EXCLUDED.ref,
              display_name = EXCLUDED.display_name,
              geometry = EXCLUDED.geometry,
              ward = EXCLUDED.ward,
              updated_at = NOW()
          `, params);

          batchCount += dedupedBatch.length;
          process.stdout.write(`\r  Imported: ${batchCount}/${collection.features.length}`);
        }

        console.log(`\n  Done: ${collection.features.length} roads`);
        totalImported += collection.features.length;
        totalFiles++;
      } catch (err) {
        console.error(`  Error processing ${file}:`, err);
      }
    }

    console.log('\n=== Import Summary ===');
    console.log(`Files processed: ${totalFiles}`);
    console.log(`Total roads imported: ${totalImported}`);

    // Verify
    const verifyResult = await client.query(`
      SELECT road_type, COUNT(*) as count
      FROM road_assets
      WHERE data_source = 'osm'
      GROUP BY road_type
      ORDER BY count DESC
    `);

    console.log('\nRoads by type:');
    for (const row of verifyResult.rows) {
      console.log(`  ${row.road_type}: ${row.count}`);
    }

    const totalResult = await client.query(`SELECT COUNT(*) as total FROM road_assets`);
    console.log(`\nTotal road_assets: ${totalResult.rows[0].total}`);

  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

importOsmRoads();

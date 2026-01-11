/**
 * Import GeoJSON to Database Script
 *
 * Reads GeoJSON files from sample-data directories and inserts into database.
 * Supports upsert (INSERT ... ON CONFLICT DO UPDATE) based on OSM ID.
 *
 * Usage:
 *   npx tsx scripts/osm/import-to-db.ts [--type=rivers|greenspaces|streetlights|all]
 *
 * Options:
 *   --type=TYPE   Import specific asset type (default: all)
 *   --dry-run     Show what would be imported without inserting
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { FeatureCollection, Geometry, Point } from 'geojson';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database connection
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/nagoya_construction';

interface ImportStats {
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
}

/**
 * Connect to database
 */
async function connectDb() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  return drizzle(pool);
}

/**
 * Import rivers from GeoJSON
 */
async function importRivers(db: ReturnType<typeof drizzle>, dryRun: boolean): Promise<ImportStats> {
  const stats: ImportStats = { inserted: 0, updated: 0, skipped: 0, errors: 0 };
  const dataDir = join(__dirname, '../../sample-data/raw-rivers');

  if (!existsSync(dataDir)) {
    console.log('  No rivers data directory found');
    return stats;
  }

  const files = readdirSync(dataDir).filter(f => f.endsWith('.geojson') && f !== 'all-rivers.geojson');

  for (const file of files) {
    const filePath = join(dataDir, file);
    console.log(`  Processing ${file}...`);

    try {
      const content = readFileSync(filePath, 'utf-8');
      const collection = JSON.parse(content) as FeatureCollection<Geometry>;

      for (const feature of collection.features) {
        const props = feature.properties as Record<string, unknown>;
        const geojson = JSON.stringify(feature.geometry);

        if (dryRun) {
          console.log(`    [DRY-RUN] Would insert river: ${props.id}`);
          stats.inserted++;
          continue;
        }

        try {
          await db.execute(sql`
            INSERT INTO river_assets (
              id, name, name_ja, display_name, geometry, geometry_type,
              waterway_type, water_type, width, management_level, maintainer,
              data_source, osm_type, osm_id, osm_timestamp, last_synced_at,
              status, ward, updated_at
            ) VALUES (
              ${props.id as string},
              ${props.name as string | null},
              ${props.nameJa as string | null},
              ${props.displayName as string},
              ST_GeomFromGeoJSON(${geojson}),
              ${props.geometryType as string},
              ${props.waterwayType as string | null},
              ${props.waterType as string | null},
              ${props.width as number | null},
              ${props.managementLevel as string | null},
              ${props.maintainer as string | null},
              ${props.dataSource as string},
              ${props.osmType as string},
              ${props.osmId as string},
              ${props.osmTimestamp ? new Date(props.osmTimestamp as string) : null},
              NOW(),
              ${props.status as string},
              ${props.ward as string | null},
              NOW()
            )
            ON CONFLICT (osm_type, osm_id) DO UPDATE SET
              name = EXCLUDED.name,
              name_ja = EXCLUDED.name_ja,
              display_name = EXCLUDED.display_name,
              geometry = EXCLUDED.geometry,
              geometry_type = EXCLUDED.geometry_type,
              waterway_type = EXCLUDED.waterway_type,
              water_type = EXCLUDED.water_type,
              width = EXCLUDED.width,
              last_synced_at = NOW(),
              ward = EXCLUDED.ward,
              updated_at = NOW()
            WHERE river_assets.is_manually_edited = FALSE
          `);
          stats.inserted++;
        } catch (err) {
          console.error(`    Error inserting river ${props.id}:`, err);
          stats.errors++;
        }
      }
    } catch (err) {
      console.error(`  Error processing ${file}:`, err);
    }
  }

  return stats;
}

/**
 * Import green spaces from GeoJSON
 */
async function importGreenSpaces(db: ReturnType<typeof drizzle>, dryRun: boolean): Promise<ImportStats> {
  const stats: ImportStats = { inserted: 0, updated: 0, skipped: 0, errors: 0 };
  const dataDir = join(__dirname, '../../sample-data/raw-greenspaces');

  if (!existsSync(dataDir)) {
    console.log('  No greenspaces data directory found');
    return stats;
  }

  const files = readdirSync(dataDir).filter(f => f.endsWith('.geojson') && f !== 'all-greenspaces.geojson');

  for (const file of files) {
    const filePath = join(dataDir, file);
    console.log(`  Processing ${file}...`);

    try {
      const content = readFileSync(filePath, 'utf-8');
      const collection = JSON.parse(content) as FeatureCollection<Geometry>;

      for (const feature of collection.features) {
        const props = feature.properties as Record<string, unknown>;
        const geojson = JSON.stringify(feature.geometry);

        if (dryRun) {
          console.log(`    [DRY-RUN] Would insert greenspace: ${props.id}`);
          stats.inserted++;
          continue;
        }

        try {
          await db.execute(sql`
            INSERT INTO greenspace_assets (
              id, name, name_ja, display_name, geometry,
              green_space_type, leisure_type, landuse_type, natural_type,
              area_m2, vegetation_type, operator,
              data_source, osm_type, osm_id, osm_timestamp, last_synced_at,
              status, ward, updated_at
            ) VALUES (
              ${props.id as string},
              ${props.name as string | null},
              ${props.nameJa as string | null},
              ${props.displayName as string},
              ST_GeomFromGeoJSON(${geojson}),
              ${props.greenSpaceType as string},
              ${props.leisureType as string | null},
              ${props.landuseType as string | null},
              ${props.naturalType as string | null},
              ${props.areaM2 as number | null},
              ${props.vegetationType as string | null},
              ${props.operator as string | null},
              ${props.dataSource as string},
              ${props.osmType as string},
              ${props.osmId as string},
              ${props.osmTimestamp ? new Date(props.osmTimestamp as string) : null},
              NOW(),
              ${props.status as string},
              ${props.ward as string | null},
              NOW()
            )
            ON CONFLICT (osm_type, osm_id) DO UPDATE SET
              name = EXCLUDED.name,
              name_ja = EXCLUDED.name_ja,
              display_name = EXCLUDED.display_name,
              geometry = EXCLUDED.geometry,
              green_space_type = EXCLUDED.green_space_type,
              leisure_type = EXCLUDED.leisure_type,
              landuse_type = EXCLUDED.landuse_type,
              natural_type = EXCLUDED.natural_type,
              area_m2 = EXCLUDED.area_m2,
              last_synced_at = NOW(),
              ward = EXCLUDED.ward,
              updated_at = NOW()
            WHERE greenspace_assets.is_manually_edited = FALSE
          `);
          stats.inserted++;
        } catch (err) {
          console.error(`    Error inserting greenspace ${props.id}:`, err);
          stats.errors++;
        }
      }
    } catch (err) {
      console.error(`  Error processing ${file}:`, err);
    }
  }

  return stats;
}

/**
 * Import street lights from GeoJSON
 */
async function importStreetLights(db: ReturnType<typeof drizzle>, dryRun: boolean): Promise<ImportStats> {
  const stats: ImportStats = { inserted: 0, updated: 0, skipped: 0, errors: 0 };
  const dataDir = join(__dirname, '../../sample-data/raw-streetlights');

  if (!existsSync(dataDir)) {
    console.log('  No streetlights data directory found');
    return stats;
  }

  const files = readdirSync(dataDir).filter(f => f.endsWith('.geojson') && f !== 'all-streetlights.geojson');

  for (const file of files) {
    const filePath = join(dataDir, file);
    console.log(`  Processing ${file}...`);

    try {
      const content = readFileSync(filePath, 'utf-8');
      const collection = JSON.parse(content) as FeatureCollection<Point>;

      for (const feature of collection.features) {
        const props = feature.properties as Record<string, unknown>;
        const geojson = JSON.stringify(feature.geometry);

        if (dryRun) {
          console.log(`    [DRY-RUN] Would insert streetlight: ${props.id}`);
          stats.inserted++;
          continue;
        }

        try {
          await db.execute(sql`
            INSERT INTO streetlight_assets (
              id, lamp_id, display_name, geometry,
              lamp_type, wattage, install_date, lamp_status, road_ref,
              data_source, osm_type, osm_id, osm_timestamp, last_synced_at,
              status, ward, updated_at
            ) VALUES (
              ${props.id as string},
              ${props.lampId as string | null},
              ${props.displayName as string},
              ST_GeomFromGeoJSON(${geojson}),
              ${props.lampType as string},
              ${props.wattage as number | null},
              ${props.installDate ? new Date(props.installDate as string) : null},
              ${props.lampStatus as string},
              ${props.roadRef as string | null},
              ${props.dataSource as string},
              ${props.osmType as string},
              ${props.osmId as string},
              ${props.osmTimestamp ? new Date(props.osmTimestamp as string) : null},
              NOW(),
              ${props.status as string},
              ${props.ward as string | null},
              NOW()
            )
            ON CONFLICT (osm_type, osm_id) DO UPDATE SET
              lamp_id = EXCLUDED.lamp_id,
              display_name = EXCLUDED.display_name,
              geometry = EXCLUDED.geometry,
              lamp_type = EXCLUDED.lamp_type,
              wattage = EXCLUDED.wattage,
              last_synced_at = NOW(),
              ward = EXCLUDED.ward,
              updated_at = NOW()
            WHERE streetlight_assets.is_manually_edited = FALSE
          `);
          stats.inserted++;
        } catch (err) {
          console.error(`    Error inserting streetlight ${props.id}:`, err);
          stats.errors++;
        }
      }
    } catch (err) {
      console.error(`  Error processing ${file}:`, err);
    }
  }

  return stats;
}

/**
 * Main function
 */
async function main() {
  console.log('=== Import GeoJSON to Database ===\n');

  // Parse arguments
  const args = process.argv.slice(2);
  const typeArg = args.find(a => a.startsWith('--type='));
  const importType = typeArg ? typeArg.split('=')[1] : 'all';
  const dryRun = args.includes('--dry-run');

  if (dryRun) {
    console.log('*** DRY RUN MODE - No data will be inserted ***\n');
  }

  console.log(`Connecting to database: ${DATABASE_URL.replace(/:[^:@]+@/, ':***@')}`);

  const db = await connectDb();

  const allStats: Record<string, ImportStats> = {};

  // Import rivers
  if (importType === 'all' || importType === 'rivers') {
    console.log('\n--- Importing Rivers ---');
    allStats.rivers = await importRivers(db, dryRun);
    console.log(`  Rivers: ${allStats.rivers.inserted} inserted, ${allStats.rivers.errors} errors`);
  }

  // Import green spaces
  if (importType === 'all' || importType === 'greenspaces') {
    console.log('\n--- Importing Green Spaces ---');
    allStats.greenspaces = await importGreenSpaces(db, dryRun);
    console.log(`  Green Spaces: ${allStats.greenspaces.inserted} inserted, ${allStats.greenspaces.errors} errors`);
  }

  // Import street lights
  if (importType === 'all' || importType === 'streetlights') {
    console.log('\n--- Importing Street Lights ---');
    allStats.streetlights = await importStreetLights(db, dryRun);
    console.log(`  Street Lights: ${allStats.streetlights.inserted} inserted, ${allStats.streetlights.errors} errors`);
  }

  // Summary
  console.log('\n=== Summary ===');
  let totalInserted = 0;
  let totalErrors = 0;
  for (const [type, stats] of Object.entries(allStats)) {
    console.log(`  ${type}: ${stats.inserted} inserted, ${stats.errors} errors`);
    totalInserted += stats.inserted;
    totalErrors += stats.errors;
  }
  console.log(`\nTotal: ${totalInserted} inserted, ${totalErrors} errors`);

  if (dryRun) {
    console.log('\n*** DRY RUN - No data was actually inserted ***');
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

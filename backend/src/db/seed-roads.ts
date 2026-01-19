import { db } from './index.js';
import { roadAssets } from './schema.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { FeatureCollection } from 'geojson';
import { sql } from 'drizzle-orm';
import { toGeomSql } from './geometry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SAMPLE_DATA_DIR = join(__dirname, '../../../sample-data');

async function seedRoads() {
  console.log('Importing road assets (preserving events)...');

  try {
    // Only clear road_assets (preserving events)
    console.log('Clearing road_assets table...');
    await db.execute(sql`TRUNCATE road_assets CASCADE`);

    // Load and seed road assets
    const assetsPath = join(SAMPLE_DATA_DIR, 'road_assets.geojson');
    const assetsGeojson = JSON.parse(readFileSync(assetsPath, 'utf-8')) as FeatureCollection;

    console.log(`Loading ${assetsGeojson.features.length} road assets...`);

    let imported = 0;
    let errors = 0;

    for (const feature of assetsGeojson.features) {
      const props = feature.properties || {};
      const now = new Date();
      const validFrom = props.validFrom ? new Date(props.validFrom) : now;
      const validTo = props.validTo ? new Date(props.validTo) : null;

      // Preserve nameSource from GeoJSON (includes 'google' for enriched roads)
      const nameSource = props.nameSource || (props.displayName ? 'osm' : null);

      try {
        await db.execute(sql`
          INSERT INTO road_assets (
            id, name, name_ja, ref, local_ref, display_name, name_source, name_confidence, sublocality,
            geometry, road_type, lanes, direction,
            status, valid_from, valid_to, owner_department, ward, landmark, updated_at
          ) VALUES (
            ${props.id}, ${props.name ?? null}, ${props.name_ja ?? null}, ${props.ref ?? null},
            ${props.local_ref ?? null}, ${props.displayName ?? null}, ${nameSource},
            ${props.nameConfidence ?? null}, ${props.sublocality ?? null},
            ${toGeomSql(feature.geometry)}, ${props.roadType ?? 'local'},
            ${props.lanes ?? null}, ${props.direction ?? null}, ${props.status || 'active'}, ${validFrom},
            ${validTo}, ${props.ownerDepartment ?? null}, ${props.ward ?? null},
            ${props.landmark ?? null}, ${now}
          )
          ON CONFLICT DO NOTHING
        `);
        imported++;
        if (imported % 10000 === 0) {
          console.log(`  Imported ${imported} roads...`);
        }
      } catch (error) {
        errors++;
        if (errors <= 5) {
          console.error(`Error importing ${props.id}:`, error);
        }
      }
    }

    console.log(`Road assets import complete: ${imported} imported, ${errors} errors`);

    // Verify counts
    const result = await db.execute(sql`
      SELECT
        COUNT(*)::int as total,
        COUNT(CASE WHEN name_source = 'google' THEN 1 END)::int as google_named,
        COUNT(CASE WHEN display_name IS NOT NULL AND display_name != '' THEN 1 END)::int as with_names
      FROM road_assets
    `);
    console.log('Final counts:', result.rows[0]);

  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

seedRoads();

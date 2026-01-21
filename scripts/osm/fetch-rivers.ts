/**
 * Fetch Rivers Script
 *
 * Queries Overpass API for rivers and waterways within Nagoya,
 * processes them into GeoJSON, and inserts into database.
 *
 * Usage:
 *   npx tsx scripts/osm/fetch-rivers.ts [--output-only] [--ward=Naka-ku]
 *
 * Options:
 *   --output-only  Save to GeoJSON file only, don't insert into database
 *   --ward=NAME    Fetch only for specified ward (e.g., --ward=Naka-ku)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Feature, FeatureCollection, Geometry, Polygon, MultiPolygon } from 'geojson';
import * as turf from '@turf/turf';
import { sql } from 'drizzle-orm';

import {
  overpassClient,
  delay,
  toBboxString,
  WARDS,
  type WardConfig,
} from './shared/overpass-client.js';
import {
  type OsmElement,
  osmElementToGeometry,
  getGeometryCategory,
  generateId,
} from './shared/geometry-utils.js';
import { db, pool } from '../../backend/src/db/index.js';
import { riverAssets } from '../../backend/src/db/schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// River/waterway types to include
const WATERWAY_TYPES = ['river', 'stream', 'canal', 'drain'];
const WATER_TYPES = ['river', 'pond', 'lake'];

/**
 * River asset properties (matching schema)
 */
interface RiverAssetProperties {
  id: string;
  name: string | null;
  nameJa: string | null;
  displayName: string;
  geometryType: 'line' | 'polygon' | 'collection';
  waterwayType: string | null;
  waterType: string | null;
  width: number | null;
  managementLevel: string | null;
  maintainer: string | null;
  dataSource: 'osm_test';
  osmType: 'node' | 'way' | 'relation';
  osmId: string;
  osmTimestamp: string | null;
  status: 'active';
  ward: string | null;
}

/**
 * Build Overpass query for rivers
 */
function buildRiversQuery(bboxString: string): string {
  return `
[out:json][timeout:180];
(
  // Waterways (line features)
  way["waterway"~"^(${WATERWAY_TYPES.join('|')})$"](${bboxString});

  // Water bodies (polygon features)
  way["natural"="water"]["water"~"^(${WATER_TYPES.join('|')})$"](${bboxString});

  // Relations for large rivers (important!)
  relation["natural"="water"]["water"="river"](${bboxString});
  relation["waterway"~"^(river|riverbank)$"](${bboxString});
);
out geom;
`;
}

/**
 * Parse width from OSM tags
 */
function parseWidth(widthTag: string | undefined): number | null {
  if (!widthTag) return null;

  // Handle formats like "5", "5m", "5 m", "5 meters"
  const match = widthTag.match(/^(\d+(?:\.\d+)?)/);
  if (match) {
    return parseFloat(match[1]);
  }
  return null;
}

/**
 * Map OSM element to river asset properties
 */
function mapRiverAsset(
  element: OsmElement,
  geometry: Geometry,
  ward: string | null
): RiverAssetProperties {
  const tags = element.tags || {};
  const geometryCategory = getGeometryCategory(geometry);

  // Map geometry category to our type
  let geometryType: 'line' | 'polygon' | 'collection';
  switch (geometryCategory) {
    case 'line':
      geometryType = 'line';
      break;
    case 'polygon':
      geometryType = 'polygon';
      break;
    default:
      geometryType = 'collection';
  }

  // Extract names
  const name = tags.name || tags['name:en'] || null;
  const nameJa = tags['name:ja'] || null;
  const id = generateId('RV-');

  // Compute display name
  const displayName = nameJa || name || id;

  return {
    id,
    name,
    nameJa,
    displayName,
    geometryType,
    waterwayType: tags.waterway || null,
    waterType: tags.water || null,
    width: parseWidth(tags.width),
    managementLevel: null, // To be set from official data
    maintainer: tags.operator || null,
    dataSource: 'osm_test',
    osmType: element.type,
    osmId: String(element.id),
    osmTimestamp: element.timestamp || null,
    status: 'active',
    ward,
  };
}

/**
 * Load ward boundary from GeoJSON file
 */
function loadWardBoundary(wardConfig: WardConfig): Feature<Polygon | MultiPolygon> | null {
  const boundaryPath = join(__dirname, '../../sample-data/ward-boundaries', wardConfig.fileName);

  if (!existsSync(boundaryPath)) {
    console.error(`  Boundary file not found: ${boundaryPath}`);
    return null;
  }

  const content = readFileSync(boundaryPath, 'utf-8');
  const collection = JSON.parse(content) as FeatureCollection;

  if (collection.features.length === 0) {
    console.error(`  No features in boundary file: ${boundaryPath}`);
    return null;
  }

  return collection.features[0] as Feature<Polygon | MultiPolygon>;
}

/**
 * Get bounding box string from boundary feature
 */
function getBboxFromBoundary(boundary: Feature<Polygon | MultiPolygon>): string {
  const bbox = turf.bbox(boundary);
  // Overpass uses: south,west,north,east
  return toBboxString(bbox[0], bbox[1], bbox[2], bbox[3]);
}

/**
 * Check if geometry intersects with ward boundary
 */
function intersectsWard(geometry: Geometry, boundary: Feature<Polygon | MultiPolygon>): boolean {
  try {
    const feature: Feature<Geometry> = {
      type: 'Feature',
      properties: {},
      geometry,
    };

    // Use centroid for point-in-polygon check (faster than full intersection)
    const centroid = turf.centroid(feature);
    return turf.booleanPointInPolygon(centroid, boundary);
  } catch {
    return false;
  }
}

/**
 * Fetch rivers for a single ward
 */
async function fetchRiversForWard(
  wardConfig: WardConfig
): Promise<Feature<Geometry, RiverAssetProperties>[]> {
  console.log(`\nFetching rivers for ${wardConfig.englishName}...`);

  // Load ward boundary
  const boundary = loadWardBoundary(wardConfig);
  if (!boundary) {
    return [];
  }

  const bboxString = getBboxFromBoundary(boundary);
  console.log(`  Bounding box: ${bboxString}`);

  const query = buildRiversQuery(bboxString);

  try {
    const result = await overpassClient.query(query);

    if (!result.elements || result.elements.length === 0) {
      console.log(`  No rivers found in bounding box`);
      return [];
    }

    console.log(`  Found ${result.elements.length} elements`);

    // Convert to GeoJSON features
    const features: Feature<Geometry, RiverAssetProperties>[] = [];
    let skipped = 0;

    for (const element of result.elements as OsmElement[]) {
      const geometry = osmElementToGeometry(element);
      if (!geometry) {
        skipped++;
        continue;
      }

      // Check if intersects with ward
      if (!intersectsWard(geometry, boundary)) {
        skipped++;
        continue;
      }

      const properties = mapRiverAsset(element, geometry, wardConfig.englishName);

      features.push({
        type: 'Feature',
        properties,
        geometry,
      });
    }

    console.log(`  Converted ${features.length} rivers (skipped ${skipped})`);
    return features;
  } catch (error) {
    console.error(`  Error fetching rivers: ${error}`);
    return [];
  }
}

/**
 * Insert rivers into database with upsert (ON CONFLICT)
 */
async function insertRiversToDatabase(
  features: Feature<Geometry, RiverAssetProperties>[]
): Promise<{ inserted: number; updated: number; errors: number }> {
  let inserted = 0;
  let updated = 0;
  let errors = 0;

  console.log(`\nInserting ${features.length} rivers into database...`);

  for (const feature of features) {
    const props = feature.properties;
    const geojson = JSON.stringify(feature.geometry);

    try {
      // Use raw SQL for upsert with geometry
      await db.execute(sql`
        INSERT INTO river_assets (
          id, name, name_ja, display_name,
          geometry, geometry_type,
          waterway_type, water_type, width,
          management_level, maintainer,
          status, ward,
          data_source, osm_type, osm_id, osm_timestamp,
          last_synced_at, is_manually_edited, updated_at
        ) VALUES (
          ${props.id},
          ${props.name},
          ${props.nameJa},
          ${props.displayName},
          ST_SetSRID(ST_GeomFromGeoJSON(${geojson}), 4326),
          ${props.geometryType},
          ${props.waterwayType},
          ${props.waterType},
          ${props.width},
          ${props.managementLevel},
          ${props.maintainer},
          ${props.status},
          ${props.ward},
          ${props.dataSource},
          ${props.osmType},
          ${props.osmId},
          ${props.osmTimestamp ? new Date(props.osmTimestamp) : null},
          NOW(),
          FALSE,
          NOW()
        )
        ON CONFLICT (osm_type, osm_id) WHERE osm_type IS NOT NULL AND osm_id IS NOT NULL
        DO UPDATE SET
          name = EXCLUDED.name,
          name_ja = EXCLUDED.name_ja,
          display_name = CASE
            WHEN river_assets.display_name_override = TRUE THEN river_assets.display_name
            ELSE EXCLUDED.display_name
          END,
          geometry = CASE
            WHEN river_assets.is_manually_edited = TRUE THEN river_assets.geometry
            ELSE EXCLUDED.geometry
          END,
          geometry_type = EXCLUDED.geometry_type,
          waterway_type = EXCLUDED.waterway_type,
          water_type = EXCLUDED.water_type,
          width = EXCLUDED.width,
          maintainer = EXCLUDED.maintainer,
          ward = EXCLUDED.ward,
          osm_timestamp = EXCLUDED.osm_timestamp,
          last_synced_at = NOW(),
          updated_at = NOW()
        WHERE river_assets.is_manually_edited = FALSE
          OR river_assets.osm_timestamp < EXCLUDED.osm_timestamp
      `);

      // Check if it was an insert or update (simplified - count as insert)
      inserted++;
    } catch (error) {
      errors++;
      if (errors <= 5) {
        console.error(`  Error inserting river ${props.id}:`, error);
      } else if (errors === 6) {
        console.error(`  ... suppressing further errors`);
      }
    }
  }

  console.log(`  Inserted/updated: ${inserted}, Errors: ${errors}`);
  return { inserted, updated, errors };
}

/**
 * Main function
 */
async function main() {
  console.log('=== Fetch Rivers ===\n');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const outputOnly = args.includes('--output-only');
  const wardArg = args.find((arg) => arg.startsWith('--ward='));
  const specificWard = wardArg ? wardArg.split('=')[1] : null;

  const outputDir = join(__dirname, '../../sample-data/raw-rivers');
  mkdirSync(outputDir, { recursive: true });

  const wardsToProcess = specificWard
    ? WARDS.filter((w) => w.englishName === specificWard)
    : WARDS;

  if (specificWard && wardsToProcess.length === 0) {
    console.error(`Ward not found: ${specificWard}`);
    console.log('Available wards:', WARDS.map((w) => w.englishName).join(', '));
    process.exit(1);
  }

  const allFeatures: Feature<Geometry, RiverAssetProperties>[] = [];

  for (const ward of wardsToProcess) {
    const features = await fetchRiversForWard(ward);
    allFeatures.push(...features);

    // Save per-ward file
    if (features.length > 0) {
      const outputPath = join(outputDir, `${ward.englishName.toLowerCase()}-rivers.geojson`);
      const collection: FeatureCollection<Geometry, RiverAssetProperties> = {
        type: 'FeatureCollection',
        features,
      };
      writeFileSync(outputPath, JSON.stringify(collection, null, 2));
      console.log(`  Saved to: ${outputPath}`);
    }

    // Rate limiting between wards
    await delay(5000);
  }

  // Save combined file
  const combinedPath = join(outputDir, 'all-rivers.geojson');
  const combinedCollection: FeatureCollection<Geometry, RiverAssetProperties> = {
    type: 'FeatureCollection',
    features: allFeatures,
  };
  writeFileSync(combinedPath, JSON.stringify(combinedCollection, null, 2));
  console.log(`\nSaved combined file: ${combinedPath}`);

  console.log(`\n=== Summary ===`);
  console.log(`Total rivers fetched: ${allFeatures.length}`);
  console.log(`Overpass requests: ${overpassClient.getStats().requestCount}`);

  // Insert into database unless --output-only is specified
  if (!outputOnly && allFeatures.length > 0) {
    const dbResult = await insertRiversToDatabase(allFeatures);
    console.log(`\nDatabase: ${dbResult.inserted} inserted/updated, ${dbResult.errors} errors`);
  } else if (outputOnly) {
    console.log('\n--output-only mode: Skipping database insertion');
  }

  // Close database connection
  await pool.end();
  console.log('\nDone!');
}

main().catch(async (error) => {
  console.error('Fatal error:', error);
  await pool.end();
  process.exit(1);
});

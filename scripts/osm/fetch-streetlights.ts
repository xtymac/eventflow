/**
 * Fetch Street Lights Script
 *
 * Queries Overpass API for street lights within Nagoya,
 * processes them into GeoJSON, and inserts into database.
 *
 * Usage:
 *   npx tsx scripts/osm/fetch-streetlights.ts [--output-only] [--ward=Naka-ku]
 *
 * Options:
 *   --output-only  Save to GeoJSON file only, don't insert into database
 *   --ward=NAME    Fetch only for specified ward (e.g., --ward=Naka-ku)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Feature, FeatureCollection, Point, Polygon, MultiPolygon } from 'geojson';
import * as turf from '@turf/turf';
import { sql } from 'drizzle-orm';

import {
  overpassClient,
  delay,
  toBboxString,
  WARDS,
  type WardConfig,
} from './shared/overpass-client.js';
import { type OsmElement, generateId } from './shared/geometry-utils.js';
import { db, pool } from '../../backend/src/db/index.js';
import { streetLightAssets } from '../../backend/src/db/schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Lamp types mapping
type LampType = 'led' | 'sodium' | 'mercury' | 'fluorescent' | 'halogen';

/**
 * Street light asset properties (matching schema)
 */
interface StreetLightAssetProperties {
  id: string;
  lampId: string | null;
  displayName: string;
  lampType: LampType;
  wattage: number | null;
  installDate: string | null;
  lampStatus: 'operational' | 'maintenance' | 'damaged' | 'replaced';
  roadRef: string | null;
  dataSource: 'osm_test';
  osmType: 'node';
  osmId: string;
  osmTimestamp: string | null;
  status: 'active';
  ward: string | null;
}

/**
 * Build Overpass query for street lights
 */
function buildStreetLightsQuery(bboxString: string): string {
  return `
[out:json][timeout:120];
(
  // Standard street lamps
  node["highway"="street_lamp"](${bboxString});

  // Alternative tags
  node["amenity"="street_lamp"](${bboxString});
  node["light:method"="street_lamp"](${bboxString});
);
out meta;
`;
}

/**
 * Map OSM lamp_type to our LampType
 */
function mapLampType(lampTypeTag: string | undefined): LampType {
  if (!lampTypeTag) return 'led'; // Default to LED for modern lamps

  const lower = lampTypeTag.toLowerCase();

  if (lower.includes('led')) return 'led';
  if (lower.includes('sodium') || lower.includes('hps') || lower.includes('sod')) return 'sodium';
  if (lower.includes('mercury') || lower.includes('hg')) return 'mercury';
  if (lower.includes('fluorescent') || lower.includes('fl')) return 'fluorescent';
  if (lower.includes('halogen')) return 'halogen';

  return 'led'; // Default
}

/**
 * Parse wattage from OSM tags
 */
function parseWattage(powerTag: string | undefined): number | null {
  if (!powerTag) return null;

  // Handle formats like "100", "100W", "100 W", "100 watts"
  const match = powerTag.match(/^(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

/**
 * Parse install date from OSM tags
 */
function parseInstallDate(startDateTag: string | undefined): string | null {
  if (!startDateTag) return null;

  // Handle various date formats
  // YYYY-MM-DD, YYYY-MM, YYYY
  const dateMatch = startDateTag.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (dateMatch) {
    const year = dateMatch[1];
    const month = dateMatch[2] || '01';
    const day = dateMatch[3] || '01';
    return `${year}-${month}-${day}`;
  }
  return null;
}

/**
 * Map OSM element to street light asset properties
 */
function mapStreetLightAsset(
  element: OsmElement,
  ward: string | null
): StreetLightAssetProperties {
  const tags = element.tags || {};
  const id = generateId('SL-');

  // Use ref tag as lampId if available
  const lampId = tags.ref || tags['lamp:ref'] || null;
  const displayName = lampId || id;

  return {
    id,
    lampId,
    displayName,
    lampType: mapLampType(tags.lamp_type || tags['light:type']),
    wattage: parseWattage(tags.power || tags['lamp:power']),
    installDate: parseInstallDate(tags.start_date),
    lampStatus: 'operational', // Default - can be updated later
    roadRef: null, // Would need spatial join with roads
    dataSource: 'osm_test',
    osmType: 'node',
    osmId: String(element.id),
    osmTimestamp: element.timestamp || null,
    status: 'active',
    ward,
  };
}

/**
 * Convert OSM node to Point geometry
 */
function nodeToPoint(element: OsmElement): Point | null {
  if (element.lat === undefined || element.lon === undefined) {
    return null;
  }

  return {
    type: 'Point',
    coordinates: [element.lon, element.lat],
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
  return toBboxString(bbox[0], bbox[1], bbox[2], bbox[3]);
}

/**
 * Check if point is within ward boundary
 */
function isPointInWard(point: Point, boundary: Feature<Polygon | MultiPolygon>): boolean {
  try {
    const pointFeature = turf.point(point.coordinates);
    return turf.booleanPointInPolygon(pointFeature, boundary);
  } catch {
    return false;
  }
}

/**
 * Fetch street lights for a single ward
 */
async function fetchStreetLightsForWard(
  wardConfig: WardConfig
): Promise<Feature<Point, StreetLightAssetProperties>[]> {
  console.log(`\nFetching street lights for ${wardConfig.englishName}...`);

  const boundary = loadWardBoundary(wardConfig);
  if (!boundary) {
    return [];
  }

  const bboxString = getBboxFromBoundary(boundary);
  console.log(`  Bounding box: ${bboxString}`);

  const query = buildStreetLightsQuery(bboxString);

  try {
    const result = await overpassClient.query(query);

    if (!result.elements || result.elements.length === 0) {
      console.log(`  No street lights found in bounding box`);
      return [];
    }

    console.log(`  Found ${result.elements.length} elements`);

    const features: Feature<Point, StreetLightAssetProperties>[] = [];
    let skipped = 0;

    for (const element of result.elements as OsmElement[]) {
      if (element.type !== 'node') {
        skipped++;
        continue;
      }

      const geometry = nodeToPoint(element);
      if (!geometry) {
        skipped++;
        continue;
      }

      // Check if within ward
      if (!isPointInWard(geometry, boundary)) {
        skipped++;
        continue;
      }

      const properties = mapStreetLightAsset(element, wardConfig.englishName);

      features.push({
        type: 'Feature',
        properties,
        geometry,
      });
    }

    console.log(`  Converted ${features.length} street lights (skipped ${skipped})`);
    return features;
  } catch (error) {
    console.error(`  Error fetching street lights: ${error}`);
    return [];
  }
}

/**
 * Insert street lights into database with upsert (ON CONFLICT)
 */
async function insertStreetLightsToDatabase(
  features: Feature<Point, StreetLightAssetProperties>[]
): Promise<{ inserted: number; updated: number; errors: number }> {
  let inserted = 0;
  let updated = 0;
  let errors = 0;

  console.log(`\nInserting ${features.length} street lights into database...`);

  // Process in batches to avoid memory issues
  const batchSize = 500;
  for (let i = 0; i < features.length; i += batchSize) {
    const batch = features.slice(i, i + batchSize);
    console.log(`  Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(features.length / batchSize)}...`);

    for (const feature of batch) {
      const props = feature.properties;
      const geojson = JSON.stringify(feature.geometry);

      try {
        await db.execute(sql`
          INSERT INTO streetlight_assets (
            id, lamp_id, display_name,
            geometry,
            lamp_type, wattage, install_date, lamp_status,
            road_ref,
            status, ward,
            data_source, osm_type, osm_id, osm_timestamp,
            last_synced_at, is_manually_edited, updated_at
          ) VALUES (
            ${props.id},
            ${props.lampId},
            ${props.displayName},
            ST_SetSRID(ST_GeomFromGeoJSON(${geojson}), 4326),
            ${props.lampType},
            ${props.wattage},
            ${props.installDate},
            ${props.lampStatus},
            ${props.roadRef},
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
            lamp_id = EXCLUDED.lamp_id,
            display_name = EXCLUDED.display_name,
            geometry = CASE
              WHEN streetlight_assets.is_manually_edited = TRUE THEN streetlight_assets.geometry
              ELSE EXCLUDED.geometry
            END,
            lamp_type = EXCLUDED.lamp_type,
            wattage = EXCLUDED.wattage,
            install_date = EXCLUDED.install_date,
            ward = EXCLUDED.ward,
            osm_timestamp = EXCLUDED.osm_timestamp,
            last_synced_at = NOW(),
            updated_at = NOW()
          WHERE streetlight_assets.is_manually_edited = FALSE
            OR streetlight_assets.osm_timestamp < EXCLUDED.osm_timestamp
        `);

        inserted++;
      } catch (error) {
        errors++;
        if (errors <= 5) {
          console.error(`  Error inserting street light ${props.id}:`, error);
        } else if (errors === 6) {
          console.error(`  ... suppressing further errors`);
        }
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
  console.log('=== Fetch Street Lights ===\n');

  const args = process.argv.slice(2);
  const outputOnly = args.includes('--output-only');
  const wardArg = args.find((arg) => arg.startsWith('--ward='));
  const specificWard = wardArg ? wardArg.split('=')[1] : null;

  const outputDir = join(__dirname, '../../sample-data/raw-streetlights');
  mkdirSync(outputDir, { recursive: true });

  const wardsToProcess = specificWard
    ? WARDS.filter((w) => w.englishName === specificWard)
    : WARDS;

  if (specificWard && wardsToProcess.length === 0) {
    console.error(`Ward not found: ${specificWard}`);
    console.log('Available wards:', WARDS.map((w) => w.englishName).join(', '));
    process.exit(1);
  }

  const allFeatures: Feature<Point, StreetLightAssetProperties>[] = [];

  for (const ward of wardsToProcess) {
    const features = await fetchStreetLightsForWard(ward);
    allFeatures.push(...features);

    if (features.length > 0) {
      const outputPath = join(outputDir, `${ward.englishName.toLowerCase()}-streetlights.geojson`);
      const collection: FeatureCollection<Point, StreetLightAssetProperties> = {
        type: 'FeatureCollection',
        features,
      };
      writeFileSync(outputPath, JSON.stringify(collection, null, 2));
      console.log(`  Saved to: ${outputPath}`);
    }

    await delay(5000);
  }

  const combinedPath = join(outputDir, 'all-streetlights.geojson');
  const combinedCollection: FeatureCollection<Point, StreetLightAssetProperties> = {
    type: 'FeatureCollection',
    features: allFeatures,
  };
  writeFileSync(combinedPath, JSON.stringify(combinedCollection, null, 2));
  console.log(`\nSaved combined file: ${combinedPath}`);

  console.log(`\n=== Summary ===`);
  console.log(`Total street lights fetched: ${allFeatures.length}`);
  console.log(`Overpass requests: ${overpassClient.getStats().requestCount}`);

  // Insert into database unless --output-only is specified
  if (!outputOnly && allFeatures.length > 0) {
    const dbResult = await insertStreetLightsToDatabase(allFeatures);
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

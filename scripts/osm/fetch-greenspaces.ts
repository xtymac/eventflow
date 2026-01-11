/**
 * Fetch Green Spaces Script
 *
 * Queries Overpass API for parks, gardens, and green spaces within Nagoya,
 * processes them into GeoJSON, and inserts into database.
 *
 * Usage:
 *   npx tsx scripts/osm/fetch-greenspaces.ts [--output-only] [--ward=Naka-ku]
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
  generateId,
} from './shared/geometry-utils.js';
import { db, pool } from '../../backend/src/db/index.js';
import { greenSpaceAssets } from '../../backend/src/db/schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Green space types to query
const LEISURE_TYPES = ['park', 'garden', 'playground', 'nature_reserve'];
const LANDUSE_TYPES = ['grass', 'forest', 'meadow', 'recreation_ground'];
const NATURAL_TYPES = ['grassland', 'scrub', 'wood'];

// Mapping to our greenSpaceType
type GreenSpaceType = 'park' | 'garden' | 'grass' | 'forest' | 'meadow' | 'playground';

/**
 * Green space asset properties (matching schema)
 */
interface GreenSpaceAssetProperties {
  id: string;
  name: string | null;
  nameJa: string | null;
  displayName: string;
  greenSpaceType: GreenSpaceType;
  leisureType: string | null;
  landuseType: string | null;
  naturalType: string | null;
  areaM2: number | null;
  vegetationType: string | null;
  operator: string | null;
  dataSource: 'osm_test';
  osmType: 'node' | 'way' | 'relation';
  osmId: string;
  osmTimestamp: string | null;
  status: 'active';
  ward: string | null;
}

/**
 * Build Overpass query for green spaces
 */
function buildGreenSpacesQuery(bboxString: string): string {
  return `
[out:json][timeout:180];
(
  // Leisure-based green spaces (ways)
  way["leisure"~"^(${LEISURE_TYPES.join('|')})$"](${bboxString});

  // Landuse-based green spaces (ways)
  way["landuse"~"^(${LANDUSE_TYPES.join('|')})$"](${bboxString});

  // Natural green spaces (ways)
  way["natural"~"^(${NATURAL_TYPES.join('|')})$"](${bboxString});

  // Relations for large parks (important!)
  relation["leisure"~"^(${LEISURE_TYPES.join('|')})$"](${bboxString});
  relation["landuse"~"^(${LANDUSE_TYPES.join('|')})$"](${bboxString});
  relation["boundary"="national_park"](${bboxString});
);
out geom;
`;
}

/**
 * Map OSM tags to greenSpaceType
 */
function mapGreenSpaceType(tags: Record<string, string>): GreenSpaceType {
  // Priority: leisure > landuse > natural
  if (tags.leisure === 'park') return 'park';
  if (tags.leisure === 'garden') return 'garden';
  if (tags.leisure === 'playground') return 'playground';
  if (tags.leisure === 'nature_reserve') return 'forest';

  if (tags.landuse === 'grass') return 'grass';
  if (tags.landuse === 'forest') return 'forest';
  if (tags.landuse === 'meadow') return 'meadow';
  if (tags.landuse === 'recreation_ground') return 'park';

  if (tags.natural === 'wood') return 'forest';
  if (tags.natural === 'grassland') return 'meadow';
  if (tags.natural === 'scrub') return 'grass';

  return 'park'; // Default
}

/**
 * Map OSM element to green space asset properties
 */
function mapGreenSpaceAsset(
  element: OsmElement,
  geometry: Geometry,
  ward: string | null
): GreenSpaceAssetProperties {
  const tags = element.tags || {};

  // Extract names
  const name = tags.name || tags['name:en'] || null;
  const nameJa = tags['name:ja'] || null;
  const id = generateId('GS-');

  // Compute display name
  const displayName = nameJa || name || id;

  // Calculate area (approximate using turf)
  let areaM2: number | null = null;
  try {
    const feature: Feature<Geometry> = {
      type: 'Feature',
      properties: {},
      geometry,
    };
    areaM2 = Math.round(turf.area(feature));
  } catch {
    // Ignore area calculation errors
  }

  return {
    id,
    name,
    nameJa,
    displayName,
    greenSpaceType: mapGreenSpaceType(tags),
    leisureType: tags.leisure || null,
    landuseType: tags.landuse || null,
    naturalType: tags.natural || null,
    areaM2,
    vegetationType: null, // Not typically in OSM
    operator: tags.operator || null,
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

    const centroid = turf.centroid(feature);
    return turf.booleanPointInPolygon(centroid, boundary);
  } catch {
    return false;
  }
}

/**
 * Check if geometry is a valid polygon type
 */
function isPolygonGeometry(geometry: Geometry): boolean {
  return geometry.type === 'Polygon' || geometry.type === 'MultiPolygon';
}

/**
 * Fetch green spaces for a single ward
 */
async function fetchGreenSpacesForWard(
  wardConfig: WardConfig
): Promise<Feature<Geometry, GreenSpaceAssetProperties>[]> {
  console.log(`\nFetching green spaces for ${wardConfig.englishName}...`);

  const boundary = loadWardBoundary(wardConfig);
  if (!boundary) {
    return [];
  }

  const bboxString = getBboxFromBoundary(boundary);
  console.log(`  Bounding box: ${bboxString}`);

  const query = buildGreenSpacesQuery(bboxString);

  try {
    const result = await overpassClient.query(query);

    if (!result.elements || result.elements.length === 0) {
      console.log(`  No green spaces found in bounding box`);
      return [];
    }

    console.log(`  Found ${result.elements.length} elements`);

    const features: Feature<Geometry, GreenSpaceAssetProperties>[] = [];
    let skipped = 0;
    let nonPolygon = 0;

    for (const element of result.elements as OsmElement[]) {
      const geometry = osmElementToGeometry(element);
      if (!geometry) {
        skipped++;
        continue;
      }

      // Green spaces should be polygons
      if (!isPolygonGeometry(geometry)) {
        nonPolygon++;
        continue;
      }

      // Check if intersects with ward
      if (!intersectsWard(geometry, boundary)) {
        skipped++;
        continue;
      }

      const properties = mapGreenSpaceAsset(element, geometry, wardConfig.englishName);

      features.push({
        type: 'Feature',
        properties,
        geometry,
      });
    }

    console.log(`  Converted ${features.length} green spaces (skipped ${skipped}, non-polygon ${nonPolygon})`);
    return features;
  } catch (error) {
    console.error(`  Error fetching green spaces: ${error}`);
    return [];
  }
}

/**
 * Insert green spaces into database with upsert (ON CONFLICT)
 */
async function insertGreenSpacesToDatabase(
  features: Feature<Geometry, GreenSpaceAssetProperties>[]
): Promise<{ inserted: number; updated: number; errors: number }> {
  let inserted = 0;
  let updated = 0;
  let errors = 0;

  console.log(`\nInserting ${features.length} green spaces into database...`);

  for (const feature of features) {
    const props = feature.properties;
    const geojson = JSON.stringify(feature.geometry);

    try {
      await db.execute(sql`
        INSERT INTO greenspace_assets (
          id, name, name_ja, display_name,
          geometry,
          green_space_type, leisure_type, landuse_type, natural_type,
          area_m2, vegetation_type, operator,
          status, ward,
          data_source, osm_type, osm_id, osm_timestamp,
          last_synced_at, is_manually_edited, updated_at
        ) VALUES (
          ${props.id},
          ${props.name},
          ${props.nameJa},
          ${props.displayName},
          ST_SetSRID(ST_GeomFromGeoJSON(${geojson}), 4326),
          ${props.greenSpaceType},
          ${props.leisureType},
          ${props.landuseType},
          ${props.naturalType},
          ${props.areaM2},
          ${props.vegetationType},
          ${props.operator},
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
            WHEN greenspace_assets.display_name_override = TRUE THEN greenspace_assets.display_name
            ELSE EXCLUDED.display_name
          END,
          geometry = CASE
            WHEN greenspace_assets.is_manually_edited = TRUE THEN greenspace_assets.geometry
            ELSE EXCLUDED.geometry
          END,
          green_space_type = EXCLUDED.green_space_type,
          leisure_type = EXCLUDED.leisure_type,
          landuse_type = EXCLUDED.landuse_type,
          natural_type = EXCLUDED.natural_type,
          area_m2 = EXCLUDED.area_m2,
          operator = EXCLUDED.operator,
          ward = EXCLUDED.ward,
          osm_timestamp = EXCLUDED.osm_timestamp,
          last_synced_at = NOW(),
          updated_at = NOW()
        WHERE greenspace_assets.is_manually_edited = FALSE
          OR greenspace_assets.osm_timestamp < EXCLUDED.osm_timestamp
      `);

      inserted++;
    } catch (error) {
      errors++;
      if (errors <= 5) {
        console.error(`  Error inserting green space ${props.id}:`, error);
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
  console.log('=== Fetch Green Spaces ===\n');

  const args = process.argv.slice(2);
  const outputOnly = args.includes('--output-only');
  const wardArg = args.find((arg) => arg.startsWith('--ward='));
  const specificWard = wardArg ? wardArg.split('=')[1] : null;

  const outputDir = join(__dirname, '../../sample-data/raw-greenspaces');
  mkdirSync(outputDir, { recursive: true });

  const wardsToProcess = specificWard
    ? WARDS.filter((w) => w.englishName === specificWard)
    : WARDS;

  if (specificWard && wardsToProcess.length === 0) {
    console.error(`Ward not found: ${specificWard}`);
    console.log('Available wards:', WARDS.map((w) => w.englishName).join(', '));
    process.exit(1);
  }

  const allFeatures: Feature<Geometry, GreenSpaceAssetProperties>[] = [];

  for (const ward of wardsToProcess) {
    const features = await fetchGreenSpacesForWard(ward);
    allFeatures.push(...features);

    if (features.length > 0) {
      const outputPath = join(outputDir, `${ward.englishName.toLowerCase()}-greenspaces.geojson`);
      const collection: FeatureCollection<Geometry, GreenSpaceAssetProperties> = {
        type: 'FeatureCollection',
        features,
      };
      writeFileSync(outputPath, JSON.stringify(collection, null, 2));
      console.log(`  Saved to: ${outputPath}`);
    }

    await delay(5000);
  }

  const combinedPath = join(outputDir, 'all-greenspaces.geojson');
  const combinedCollection: FeatureCollection<Geometry, GreenSpaceAssetProperties> = {
    type: 'FeatureCollection',
    features: allFeatures,
  };
  writeFileSync(combinedPath, JSON.stringify(combinedCollection, null, 2));
  console.log(`\nSaved combined file: ${combinedPath}`);

  console.log(`\n=== Summary ===`);
  console.log(`Total green spaces fetched: ${allFeatures.length}`);
  console.log(`Overpass requests: ${overpassClient.getStats().requestCount}`);

  // Insert into database unless --output-only is specified
  if (!outputOnly && allFeatures.length > 0) {
    const dbResult = await insertGreenSpacesToDatabase(allFeatures);
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

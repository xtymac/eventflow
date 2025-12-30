/**
 * Road Matching Script
 *
 * Uses OSRM Route API to snap 2-point road segments to actual OSM road network.
 * This produces road geometries that follow real road curves instead of straight lines.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { FeatureCollection, Feature, LineString, Position } from 'geojson';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const OSRM_BASE_URL = process.env.OSRM_BASE_URL || 'https://router.project-osrm.org';
const DELAY_BETWEEN_REQUESTS = parseInt(process.env.DELAY_MS || '1000', 10);
const SNAP_RADIUS = parseInt(process.env.SNAP_RADIUS || '50', 10);
const DETOUR_RATIO_THRESHOLD = parseFloat(process.env.DETOUR_RATIO || '3.0');
const MAX_SNAP_DISTANCE = 100; // meters

interface RoadAssetProperties {
  id: string;
  name: string;
  roadType: string;
  lanes: number;
  direction: string;
  status: string;
  validFrom: string;
  landmark?: string;
  ward?: string;
  // Matching metadata (only in GeoJSON, not stored in DB)
  matched?: boolean;
  snapDistance?: number;
  detourRatio?: number;
  originalPointCount?: number;
  matchedPointCount?: number;
}

interface OSRMRouteResponse {
  code: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: LineString;
  }>;
  waypoints?: Array<{
    location: [number, number];
    name: string;
    distance: number; // distance to snapped point in meters
  }>;
}

/**
 * Calculate Haversine distance between two points (in meters)
 */
function haversineDistance(coord1: Position, coord2: Position): number {
  const R = 6371000; // Earth radius in meters
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;

  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Delay helper for rate limiting
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call OSRM Route API with retry
 * @param profile - 'driving' or 'foot'
 */
async function callRouteAPI(
  coordinates: Position[],
  profile: 'driving' | 'foot' = 'driving',
  retryCount = 1
): Promise<OSRMRouteResponse | null> {
  const coordString = coordinates.map(([lng, lat]) => `${lng},${lat}`).join(';');
  const radiuses = coordinates.map(() => SNAP_RADIUS).join(';');

  const url = `${OSRM_BASE_URL}/route/v1/${profile}/${coordString}?geometries=geojson&overview=full&radiuses=${radiuses}`;

  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      const response = await fetch(url);

      if (response.status === 429) {
        // Rate limited, wait longer
        console.log('  Rate limited, waiting 2s...');
        await delay(2000);
        continue;
      }

      if (!response.ok) {
        if (attempt === retryCount) {
          console.error(`  HTTP error: ${response.status} (profile: ${profile})`);
        }
        return null;
      }

      return (await response.json()) as OSRMRouteResponse;
    } catch (error) {
      if (attempt < retryCount) {
        console.log(`  Retry ${attempt + 1}/${retryCount}...`);
        await delay(1000);
      } else {
        console.error(`  Fetch error: ${error}`);
        return null;
      }
    }
  }

  return null;
}

/**
 * Process a single road asset
 */
async function processRoadAsset(
  feature: Feature<LineString, RoadAssetProperties>
): Promise<Feature<LineString, RoadAssetProperties>> {
  const { id, name } = feature.properties;
  const originalCoords = feature.geometry.coordinates;

  console.log(`Processing ${id}: ${name}`);

  // Try driving profile first
  let routeResult = await callRouteAPI(originalCoords, 'driving');
  let usedProfile: 'driving' | 'foot' = 'driving';

  // If driving fails, try foot profile (for parks, pedestrian areas, etc.)
  if (!routeResult || routeResult.code !== 'Ok' || !routeResult.routes?.length) {
    console.log(`  Driving failed, trying foot profile...`);
    await delay(500);
    routeResult = await callRouteAPI(originalCoords, 'foot');
    usedProfile = 'foot';
  }

  // Check for API failure
  if (!routeResult || routeResult.code !== 'Ok' || !routeResult.routes?.length) {
    console.warn(`  [WARN] Route API failed (both driving and foot), keeping original geometry`);
    return {
      ...feature,
      properties: {
        ...feature.properties,
        matched: false,
        originalPointCount: originalCoords.length,
        matchedPointCount: originalCoords.length,
      },
    };
  }

  console.log(`  Using ${usedProfile} profile`);

  const route = routeResult.routes[0];
  const waypoints = routeResult.waypoints || [];

  // Check snap distance
  const maxSnapDistance = Math.max(...waypoints.map((wp) => wp.distance));
  if (maxSnapDistance > MAX_SNAP_DISTANCE) {
    console.warn(`  [WARN] Snap distance too large: ${maxSnapDistance.toFixed(1)}m, keeping original`);
    return {
      ...feature,
      properties: {
        ...feature.properties,
        matched: false,
        snapDistance: maxSnapDistance,
        originalPointCount: originalCoords.length,
        matchedPointCount: originalCoords.length,
      },
    };
  }

  // Check for detour
  const straightLineDistance = haversineDistance(originalCoords[0], originalCoords[originalCoords.length - 1]);
  const detourRatio = straightLineDistance > 0 ? route.distance / straightLineDistance : 1;

  if (detourRatio > DETOUR_RATIO_THRESHOLD) {
    console.warn(
      `  [WARN] Detour detected: ratio=${detourRatio.toFixed(2)} (${route.distance.toFixed(0)}m / ${straightLineDistance.toFixed(0)}m), keeping original`
    );
    return {
      ...feature,
      properties: {
        ...feature.properties,
        matched: false,
        snapDistance: maxSnapDistance,
        detourRatio: detourRatio,
        originalPointCount: originalCoords.length,
        matchedPointCount: originalCoords.length,
      },
    };
  }

  // Success - use matched geometry
  console.log(
    `  [OK] Matched: points ${originalCoords.length} -> ${route.geometry.coordinates.length}, snap=${maxSnapDistance.toFixed(1)}m, ratio=${detourRatio.toFixed(2)}`
  );

  return {
    ...feature,
    geometry: route.geometry,
    properties: {
      ...feature.properties,
      matched: true,
      matchProfile: usedProfile,
      snapDistance: maxSnapDistance,
      detourRatio: detourRatio,
      originalPointCount: originalCoords.length,
      matchedPointCount: route.geometry.coordinates.length,
    },
  };
}

/**
 * Process all road assets
 */
async function processAllRoads(geojson: FeatureCollection): Promise<FeatureCollection> {
  const processedFeatures: Feature[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const feature of geojson.features) {
    if (feature.geometry.type !== 'LineString') {
      console.warn(`Skipping non-LineString feature: ${feature.properties?.id}`);
      processedFeatures.push(feature);
      continue;
    }

    const processed = await processRoadAsset(feature as Feature<LineString, RoadAssetProperties>);

    if (processed.properties?.matched) {
      successCount++;
    } else {
      failCount++;
    }

    processedFeatures.push(processed);

    // Rate limiting
    await delay(DELAY_BETWEEN_REQUESTS);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total: ${geojson.features.length}`);
  console.log(`Matched: ${successCount}`);
  console.log(`Failed (kept original): ${failCount}`);

  return {
    ...geojson,
    features: processedFeatures,
  };
}

/**
 * Main function
 */
async function main() {
  console.log('=== Road Matching Script ===\n');
  console.log(`OSRM URL: ${OSRM_BASE_URL}`);
  console.log(`Snap radius: ${SNAP_RADIUS}m`);
  console.log(`Detour threshold: ${DETOUR_RATIO_THRESHOLD}x`);
  console.log(`Request delay: ${DELAY_BETWEEN_REQUESTS}ms\n`);

  const inputPath = join(__dirname, '../sample-data/road_assets.geojson');
  const outputPath = join(__dirname, '../sample-data/road_assets_matched.geojson');

  console.log(`Input: ${inputPath}`);
  console.log(`Output: ${outputPath}\n`);

  // Load input
  let geojson: FeatureCollection;
  try {
    const content = readFileSync(inputPath, 'utf-8');
    geojson = JSON.parse(content) as FeatureCollection;
  } catch (error) {
    console.error(`Failed to read input file: ${error}`);
    process.exit(1);
  }

  console.log(`Loaded ${geojson.features.length} road assets\n`);

  // Process all roads
  const matched = await processAllRoads(geojson);

  // Save output
  try {
    writeFileSync(outputPath, JSON.stringify(matched, null, 2));
    console.log(`\nOutput saved to: ${outputPath}`);
  } catch (error) {
    console.error(`Failed to write output file: ${error}`);
    process.exit(1);
  }

  // List failed matches
  const failedRoads = matched.features.filter((f) => f.properties?.matched === false);
  if (failedRoads.length > 0) {
    console.log('\n=== Failed Matches (Kept Original) ===');
    failedRoads.forEach((f) => {
      const reason = f.properties?.detourRatio && f.properties.detourRatio > DETOUR_RATIO_THRESHOLD
        ? `detour ratio ${f.properties.detourRatio.toFixed(2)}`
        : f.properties?.snapDistance && f.properties.snapDistance > MAX_SNAP_DISTANCE
          ? `snap distance ${f.properties.snapDistance.toFixed(1)}m`
          : 'API error';
      console.log(`- ${f.properties?.id}: ${f.properties?.name} (${reason})`);
    });
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

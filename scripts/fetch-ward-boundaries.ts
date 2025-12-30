/**
 * Fetch Ward Boundaries Script
 *
 * Queries Overpass API for administrative boundary polygons of Naka-ku and Nakamura-ku
 * within Nagoya City and saves them as GeoJSON files.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Feature, Polygon, MultiPolygon, FeatureCollection, Position } from 'geojson';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

interface WardConfig {
  japaneseName: string;
  englishName: string;
  fileName: string;
}

const WARDS: WardConfig[] = [
  // 現有
  { japaneseName: '中区', englishName: 'Naka-ku', fileName: 'naka-ku.geojson' },
  { japaneseName: '中村区', englishName: 'Nakamura-ku', fileName: 'nakamura-ku.geojson' },
  // 新增 14 区
  { japaneseName: '東区', englishName: 'Higashi-ku', fileName: 'higashi-ku.geojson' },
  { japaneseName: '北区', englishName: 'Kita-ku', fileName: 'kita-ku.geojson' },
  { japaneseName: '西区', englishName: 'Nishi-ku', fileName: 'nishi-ku.geojson' },
  { japaneseName: '千種区', englishName: 'Chikusa-ku', fileName: 'chikusa-ku.geojson' },
  { japaneseName: '昭和区', englishName: 'Showa-ku', fileName: 'showa-ku.geojson' },
  { japaneseName: '瑞穂区', englishName: 'Mizuho-ku', fileName: 'mizuho-ku.geojson' },
  { japaneseName: '熱田区', englishName: 'Atsuta-ku', fileName: 'atsuta-ku.geojson' },
  { japaneseName: '中川区', englishName: 'Nakagawa-ku', fileName: 'nakagawa-ku.geojson' },
  { japaneseName: '港区', englishName: 'Minato-ku', fileName: 'minato-ku.geojson' },
  { japaneseName: '南区', englishName: 'Minami-ku', fileName: 'minami-ku.geojson' },
  { japaneseName: '守山区', englishName: 'Moriyama-ku', fileName: 'moriyama-ku.geojson' },
  { japaneseName: '緑区', englishName: 'Midori-ku', fileName: 'midori-ku.geojson' },
  { japaneseName: '名東区', englishName: 'Meito-ku', fileName: 'meito-ku.geojson' },
  { japaneseName: '天白区', englishName: 'Tempaku-ku', fileName: 'tempaku-ku.geojson' },
];

/**
 * Delay helper for rate limiting
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Query Overpass API
 */
async function queryOverpass(query: string): Promise<any> {
  const response = await fetch(OVERPASS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Convert OSM relation geometry to GeoJSON Polygon/MultiPolygon
 */
function osmToGeoJSONPolygon(
  element: any,
  wardConfig: WardConfig
): Feature<Polygon | MultiPolygon> | null {
  if (element.type !== 'relation' || !element.members) {
    return null;
  }

  // Collect outer and inner ways
  const outerWays: Position[][] = [];
  const innerWays: Position[][] = [];

  for (const member of element.members) {
    if (member.type === 'way' && member.geometry) {
      const coords: Position[] = member.geometry.map((node: any) => [node.lon, node.lat]);

      if (member.role === 'outer') {
        outerWays.push(coords);
      } else if (member.role === 'inner') {
        innerWays.push(coords);
      }
    }
  }

  if (outerWays.length === 0) {
    console.warn(`  No outer ways found for ${wardConfig.englishName}`);
    return null;
  }

  // Merge outer ways into rings
  const outerRings = mergeWaysIntoRings(outerWays);

  if (outerRings.length === 0) {
    console.warn(`  Could not form closed rings for ${wardConfig.englishName}`);
    return null;
  }

  // For simplicity, create a MultiPolygon if multiple outer rings, or Polygon if one
  if (outerRings.length === 1) {
    const coordinates: Position[][] = [outerRings[0]];
    // Add inner rings (holes)
    const innerRings = mergeWaysIntoRings(innerWays);
    coordinates.push(...innerRings);

    return {
      type: 'Feature',
      properties: {
        name: wardConfig.englishName,
        nameJa: wardConfig.japaneseName,
        adminLevel: 7,
        type: 'ward',
      },
      geometry: {
        type: 'Polygon',
        coordinates,
      },
    };
  } else {
    // Multiple outer rings = MultiPolygon
    const polygons: Position[][][] = outerRings.map((ring) => [ring]);

    return {
      type: 'Feature',
      properties: {
        name: wardConfig.englishName,
        nameJa: wardConfig.japaneseName,
        adminLevel: 7,
        type: 'ward',
      },
      geometry: {
        type: 'MultiPolygon',
        coordinates: polygons,
      },
    };
  }
}

/**
 * Merge ways into closed rings
 */
function mergeWaysIntoRings(ways: Position[][]): Position[][] {
  if (ways.length === 0) return [];

  const rings: Position[][] = [];
  const remaining = [...ways];

  while (remaining.length > 0) {
    let ring = [...remaining.shift()!];

    // Try to close the ring by appending matching ways
    let changed = true;
    while (changed && !isRingClosed(ring)) {
      changed = false;
      for (let i = 0; i < remaining.length; i++) {
        const way = remaining[i];
        const ringEnd = ring[ring.length - 1];
        const ringStart = ring[0];

        // Check if way connects to end
        if (coordsEqual(ringEnd, way[0])) {
          ring = ring.concat(way.slice(1));
          remaining.splice(i, 1);
          changed = true;
          break;
        }
        // Check if reversed way connects to end
        if (coordsEqual(ringEnd, way[way.length - 1])) {
          ring = ring.concat([...way].reverse().slice(1));
          remaining.splice(i, 1);
          changed = true;
          break;
        }
        // Check if way connects to start
        if (coordsEqual(ringStart, way[way.length - 1])) {
          ring = way.concat(ring.slice(1));
          remaining.splice(i, 1);
          changed = true;
          break;
        }
        // Check if reversed way connects to start
        if (coordsEqual(ringStart, way[0])) {
          ring = [...way].reverse().concat(ring.slice(1));
          remaining.splice(i, 1);
          changed = true;
          break;
        }
      }
    }

    // Ensure ring is closed
    if (!isRingClosed(ring) && ring.length > 2) {
      ring.push(ring[0]);
    }

    if (ring.length >= 4) {
      rings.push(ring);
    }
  }

  return rings;
}

/**
 * Check if a ring is closed
 */
function isRingClosed(ring: Position[]): boolean {
  if (ring.length < 4) return false;
  return coordsEqual(ring[0], ring[ring.length - 1]);
}

/**
 * Check if two coordinates are equal (within tolerance)
 */
function coordsEqual(a: Position, b: Position, tolerance = 1e-7): boolean {
  return Math.abs(a[0] - b[0]) < tolerance && Math.abs(a[1] - b[1]) < tolerance;
}

// Nagoya city bounding box for sanity check
const NAGOYA_BBOX = {
  minLat: 35.0,
  maxLat: 35.3,
  minLng: 136.7,
  maxLng: 137.1,
};

/**
 * Calculate bounding box of a feature
 */
function getFeatureBbox(feature: Feature<Polygon | MultiPolygon>): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;

  const processCoords = (coords: Position[]) => {
    for (const [lng, lat] of coords) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
  };

  if (feature.geometry.type === 'Polygon') {
    feature.geometry.coordinates.forEach(processCoords);
  } else {
    feature.geometry.coordinates.forEach(polygon => polygon.forEach(processCoords));
  }

  return { minLat, maxLat, minLng, maxLng };
}

/**
 * Check if feature bbox is within Nagoya area
 */
function isWithinNagoya(feature: Feature<Polygon | MultiPolygon>): boolean {
  const bbox = getFeatureBbox(feature);
  // Check if centroid is roughly within Nagoya
  const centerLat = (bbox.minLat + bbox.maxLat) / 2;
  const centerLng = (bbox.minLng + bbox.maxLng) / 2;

  return (
    centerLat >= NAGOYA_BBOX.minLat &&
    centerLat <= NAGOYA_BBOX.maxLat &&
    centerLng >= NAGOYA_BBOX.minLng &&
    centerLng <= NAGOYA_BBOX.maxLng
  );
}

/**
 * Fetch a single ward boundary
 */
async function fetchWardBoundary(ward: WardConfig): Promise<Feature<Polygon | MultiPolygon> | null> {
  console.log(`Fetching boundary for ${ward.englishName} (${ward.japaneseName})...`);

  // Try multiple query approaches - prioritize Nagoya-specific queries
  const queries = [
    // Approach 1 (PREFERRED): Use area search with city name
    `[out:json][timeout:60];
area["name"="名古屋市"]->.nagoya;
relation(area.nagoya)["name"="${ward.japaneseName}"]["boundary"="administrative"]["admin_level"="7"];
out geom;`,
    // Approach 2: Search within Nagoya bounding box with admin_level
    `[out:json][timeout:60];
relation(35.0,136.7,35.3,137.1)["name"="${ward.japaneseName}"]["boundary"="administrative"]["admin_level"="7"];
out geom;`,
    // Approach 3: Search within Nagoya bounding box (without admin_level)
    `[out:json][timeout:60];
relation(35.0,136.7,35.3,137.1)["name"="${ward.japaneseName}"]["boundary"="administrative"];
out geom;`,
  ];

  for (let i = 0; i < queries.length; i++) {
    console.log(`  Trying query approach ${i + 1}...`);
    try {
      const result = await queryOverpass(queries[i]);

      if (result.elements && result.elements.length > 0) {
        console.log(`  Found ${result.elements.length} element(s)`);

        // Try each element and validate it's within Nagoya
        for (const element of result.elements) {
          const feature = osmToGeoJSONPolygon(element, ward);

          if (feature) {
            // Sanity check: verify bbox is within Nagoya area
            if (!isWithinNagoya(feature)) {
              const bbox = getFeatureBbox(feature);
              console.log(`  WARNING: Boundary for ${ward.englishName} is outside Nagoya area!`);
              console.log(`    Bbox: lat ${bbox.minLat.toFixed(2)}-${bbox.maxLat.toFixed(2)}, lng ${bbox.minLng.toFixed(2)}-${bbox.maxLng.toFixed(2)}`);
              console.log(`    Skipping this result...`);
              continue;
            }

            const bbox = getFeatureBbox(feature);
            console.log(`  Valid boundary found: lat ${bbox.minLat.toFixed(3)}-${bbox.maxLat.toFixed(3)}, lng ${bbox.minLng.toFixed(3)}-${bbox.maxLng.toFixed(3)}`);
            return feature;
          }
        }
      }
    } catch (error) {
      console.log(`  Query ${i + 1} failed: ${error}`);
    }

    // Rate limiting between attempts (increased to avoid 429)
    await delay(3000);
  }

  console.error(`  No valid boundary found for ${ward.englishName} within Nagoya area`);
  return null;
}

/**
 * Main function
 */
async function main() {
  console.log('=== Fetch Ward Boundaries ===\n');

  const outputDir = join(__dirname, '../sample-data/ward-boundaries');
  mkdirSync(outputDir, { recursive: true });

  const allFeatures: Feature<Polygon | MultiPolygon>[] = [];

  for (const ward of WARDS) {
    const feature = await fetchWardBoundary(ward);

    if (feature) {
      // Save individual ward file
      const wardPath = join(outputDir, ward.fileName);
      const wardCollection: FeatureCollection = {
        type: 'FeatureCollection',
        features: [feature],
      };
      writeFileSync(wardPath, JSON.stringify(wardCollection, null, 2));
      console.log(`  Saved to: ${wardPath}`);

      allFeatures.push(feature);
    }

    // Rate limiting between wards (increased to avoid 429)
    await delay(5000);
  }

  // Save combined file
  if (allFeatures.length > 0) {
    const combinedPath = join(outputDir, 'combined.geojson');
    const combined: FeatureCollection = {
      type: 'FeatureCollection',
      features: allFeatures,
    };
    writeFileSync(combinedPath, JSON.stringify(combined, null, 2));
    console.log(`\nSaved combined boundaries to: ${combinedPath}`);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Fetched: ${allFeatures.length}/${WARDS.length} ward boundaries`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

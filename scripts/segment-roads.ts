/**
 * Road Segmentation Script
 *
 * Splits road LineStrings at intersections to create usable road segments,
 * and assigns stable ward-prefixed IDs.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Feature, FeatureCollection, LineString, Point, Position } from 'geojson';
import * as turf from '@turf/turf';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ward prefix mapping for ID generation
const WARD_PREFIX: Record<string, string> = {
  // 現有
  'Naka-ku': 'NAKA',
  'Nakamura-ku': 'NKMR',
  // 新増 14 区
  'Higashi-ku': 'HIGA',
  'Kita-ku': 'KITA',
  'Nishi-ku': 'NISH',
  'Chikusa-ku': 'CHIK',
  'Showa-ku': 'SHOW',
  'Mizuho-ku': 'MIZH',
  'Atsuta-ku': 'ATSU',
  'Nakagawa-ku': 'NKGW',
  'Minato-ku': 'MINA',
  'Minami-ku': 'MNMI',
  'Moriyama-ku': 'MORY',
  'Midori-ku': 'MIDR',
  'Meito-ku': 'MEIT',
  'Tempaku-ku': 'TEMP',
};

interface WardConfig {
  englishName: string;
  inputFileName: string;
  outputFileName: string;
}

const WARDS: WardConfig[] = [
  // 現有
  { englishName: 'Naka-ku', inputFileName: 'naka-ku-roads.geojson', outputFileName: 'naka-ku-segments.geojson' },
  { englishName: 'Nakamura-ku', inputFileName: 'nakamura-ku-roads.geojson', outputFileName: 'nakamura-ku-segments.geojson' },
  // 新増 14 区
  { englishName: 'Higashi-ku', inputFileName: 'higashi-ku-roads.geojson', outputFileName: 'higashi-ku-segments.geojson' },
  { englishName: 'Kita-ku', inputFileName: 'kita-ku-roads.geojson', outputFileName: 'kita-ku-segments.geojson' },
  { englishName: 'Nishi-ku', inputFileName: 'nishi-ku-roads.geojson', outputFileName: 'nishi-ku-segments.geojson' },
  { englishName: 'Chikusa-ku', inputFileName: 'chikusa-ku-roads.geojson', outputFileName: 'chikusa-ku-segments.geojson' },
  { englishName: 'Showa-ku', inputFileName: 'showa-ku-roads.geojson', outputFileName: 'showa-ku-segments.geojson' },
  { englishName: 'Mizuho-ku', inputFileName: 'mizuho-ku-roads.geojson', outputFileName: 'mizuho-ku-segments.geojson' },
  { englishName: 'Atsuta-ku', inputFileName: 'atsuta-ku-roads.geojson', outputFileName: 'atsuta-ku-segments.geojson' },
  { englishName: 'Nakagawa-ku', inputFileName: 'nakagawa-ku-roads.geojson', outputFileName: 'nakagawa-ku-segments.geojson' },
  { englishName: 'Minato-ku', inputFileName: 'minato-ku-roads.geojson', outputFileName: 'minato-ku-segments.geojson' },
  { englishName: 'Minami-ku', inputFileName: 'minami-ku-roads.geojson', outputFileName: 'minami-ku-segments.geojson' },
  { englishName: 'Moriyama-ku', inputFileName: 'moriyama-ku-roads.geojson', outputFileName: 'moriyama-ku-segments.geojson' },
  { englishName: 'Midori-ku', inputFileName: 'midori-ku-roads.geojson', outputFileName: 'midori-ku-segments.geojson' },
  { englishName: 'Meito-ku', inputFileName: 'meito-ku-roads.geojson', outputFileName: 'meito-ku-segments.geojson' },
  { englishName: 'Tempaku-ku', inputFileName: 'tempaku-ku-roads.geojson', outputFileName: 'tempaku-ku-segments.geojson' },
];

// Minimum segment length in meters
const MIN_SEGMENT_LENGTH = 15;

// Tolerance for considering points as the same location (in degrees, ~1m at equator)
const POINT_TOLERANCE = 0.00001;

/**
 * Round coordinate to fixed precision for comparison
 */
function roundCoord(coord: Position, precision = 6): string {
  return `${coord[0].toFixed(precision)},${coord[1].toFixed(precision)}`;
}

/**
 * Find all intersection points between roads
 */
function findIntersections(roads: Feature<LineString>[]): Map<string, Position> {
  console.log(`  Finding intersections among ${roads.length} roads...`);

  // Count occurrences of each endpoint and node
  const pointCount = new Map<string, { count: number; coord: Position }>();

  for (const road of roads) {
    const coords = road.geometry.coordinates;

    // Add all vertices
    for (const coord of coords) {
      const key = roundCoord(coord);
      const existing = pointCount.get(key);
      if (existing) {
        existing.count++;
      } else {
        pointCount.set(key, { count: 1, coord });
      }
    }
  }

  // Find actual intersections between different roads
  const intersections = new Map<string, Position>();

  for (let i = 0; i < roads.length; i++) {
    for (let j = i + 1; j < roads.length; j++) {
      try {
        const intersects = turf.lineIntersect(roads[i], roads[j]);
        for (const point of intersects.features) {
          const key = roundCoord(point.geometry.coordinates);
          if (!intersections.has(key)) {
            intersections.set(key, point.geometry.coordinates);
          }
        }
      } catch (error) {
        // Skip if intersection fails
        continue;
      }
    }
  }

  // Also include endpoints that are shared by multiple roads
  for (const road of roads) {
    const coords = road.geometry.coordinates;
    const startKey = roundCoord(coords[0]);
    const endKey = roundCoord(coords[coords.length - 1]);

    const startData = pointCount.get(startKey);
    const endData = pointCount.get(endKey);

    if (startData && startData.count > 1) {
      intersections.set(startKey, startData.coord);
    }
    if (endData && endData.count > 1) {
      intersections.set(endKey, endData.coord);
    }
  }

  console.log(`  Found ${intersections.size} intersection points`);
  return intersections;
}

/**
 * Find the closest intersection point to a given coordinate
 */
function findClosestIntersection(
  coord: Position,
  intersections: Map<string, Position>,
  maxDistance = 0.00005 // ~5m
): Position | null {
  let closest: Position | null = null;
  let minDist = Infinity;

  for (const [, point] of intersections) {
    const dist = Math.sqrt(
      Math.pow(coord[0] - point[0], 2) + Math.pow(coord[1] - point[1], 2)
    );
    if (dist < minDist && dist < maxDistance) {
      minDist = dist;
      closest = point;
    }
  }

  return closest;
}

/**
 * Split a road at intersection points
 */
function splitRoadAtIntersections(
  road: Feature<LineString>,
  intersections: Map<string, Position>
): Feature<LineString>[] {
  const coords = road.geometry.coordinates;
  const segments: Position[][] = [];
  let currentSegment: Position[] = [coords[0]];

  for (let i = 1; i < coords.length; i++) {
    const coord = coords[i];
    currentSegment.push(coord);

    // Check if this point is near an intersection
    const key = roundCoord(coord);
    const isIntersection = intersections.has(key);

    // Also check for nearby intersection
    const nearIntersection =
      !isIntersection && findClosestIntersection(coord, intersections) !== null;

    // Split at intersections (but not at the last point)
    if ((isIntersection || nearIntersection) && i < coords.length - 1) {
      if (currentSegment.length >= 2) {
        segments.push([...currentSegment]);
      }
      currentSegment = [coord];
    }
  }

  // Add the last segment
  if (currentSegment.length >= 2) {
    segments.push(currentSegment);
  }

  // Convert segments to features
  return segments.map((segmentCoords) => ({
    type: 'Feature' as const,
    properties: { ...road.properties },
    geometry: {
      type: 'LineString' as const,
      coordinates: segmentCoords,
    },
  }));
}

/**
 * Assign sequential IDs to segments
 */
function assignSegmentIds(
  segments: Feature<LineString>[],
  wardPrefix: string
): Feature<LineString>[] {
  return segments.map((segment, index) => ({
    ...segment,
    properties: {
      ...segment.properties,
      id: `RA-${wardPrefix}-${String(index + 1).padStart(4, '0')}`,
    },
  }));
}

/**
 * Process roads for a single ward
 */
function processWard(wardConfig: WardConfig): Feature<LineString>[] {
  console.log(`\nProcessing ${wardConfig.englishName}...`);

  const inputPath = join(__dirname, '../sample-data/raw-roads', wardConfig.inputFileName);

  if (!existsSync(inputPath)) {
    console.error(`  Input file not found: ${inputPath}`);
    return [];
  }

  const content = readFileSync(inputPath, 'utf-8');
  const collection = JSON.parse(content) as FeatureCollection;

  const roads = collection.features.filter(
    (f): f is Feature<LineString> => f.geometry.type === 'LineString'
  );

  console.log(`  Loaded ${roads.length} roads`);

  // Find intersections
  const intersections = findIntersections(roads);

  // Split roads at intersections
  console.log(`  Splitting roads at intersections...`);
  const allSegments: Feature<LineString>[] = [];

  for (const road of roads) {
    const segments = splitRoadAtIntersections(road, intersections);
    allSegments.push(...segments);
  }

  console.log(`  Created ${allSegments.length} segments`);

  // Filter by minimum length
  const filteredSegments = allSegments.filter((segment) => {
    const length = turf.length(segment, { units: 'meters' });
    return length >= MIN_SEGMENT_LENGTH;
  });

  console.log(`  After filtering (>=${MIN_SEGMENT_LENGTH}m): ${filteredSegments.length} segments`);

  // Assign IDs
  const prefix = WARD_PREFIX[wardConfig.englishName] || 'UNK';
  const namedSegments = assignSegmentIds(filteredSegments, prefix);

  // Add additional required properties
  const enrichedSegments = namedSegments.map((segment) => ({
    ...segment,
    properties: {
      ...segment.properties,
      status: 'active',
      validFrom: new Date().toISOString().split('T')[0],
      ownerDepartment: 'Road Maintenance Division',
    },
  }));

  return enrichedSegments;
}

/**
 * Main function
 */
async function main() {
  console.log('=== Road Segmentation ===');

  const outputDir = join(__dirname, '../sample-data/segmented-roads');
  mkdirSync(outputDir, { recursive: true });

  let totalSegments = 0;

  for (const ward of WARDS) {
    const segments = processWard(ward);

    if (segments.length > 0) {
      const outputPath = join(outputDir, ward.outputFileName);
      const collection: FeatureCollection = {
        type: 'FeatureCollection',
        features: segments,
      };
      writeFileSync(outputPath, JSON.stringify(collection, null, 2));
      console.log(`  Saved to: ${outputPath}`);
      totalSegments += segments.length;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total segments created: ${totalSegments}`);

  // Print segment count per ward
  for (const ward of WARDS) {
    const outputPath = join(outputDir, ward.outputFileName);
    if (existsSync(outputPath)) {
      const content = readFileSync(outputPath, 'utf-8');
      const collection = JSON.parse(content) as FeatureCollection;
      console.log(`  ${ward.englishName}: ${collection.features.length} segments`);
    }
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

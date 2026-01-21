/**
 * Road Segmentation Utilities
 *
 * Extracted from scripts/segment-roads.ts for reuse in OSM sync service.
 * These functions handle splitting road LineStrings at intersections.
 */

import type { Feature, LineString, Position } from 'geojson';
import * as turf from '@turf/turf';

// Ward prefix mapping for ID generation
export const WARD_PREFIX: Record<string, string> = {
  'Naka-ku': 'NAKA',
  'Nakamura-ku': 'NKMR',
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

// Minimum segment length in meters
export const MIN_SEGMENT_LENGTH = 15;

// Tolerance for considering points as the same location (in degrees, ~1m at equator)
export const POINT_TOLERANCE = 0.00001;

/**
 * Round coordinate to fixed precision for comparison
 */
export function roundCoord(coord: Position, precision = 6): string {
  return `${coord[0].toFixed(precision)},${coord[1].toFixed(precision)}`;
}

/**
 * Find all intersection points between roads
 */
export function findIntersections(roads: Feature<LineString>[]): Map<string, Position> {
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
      } catch {
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

  return intersections;
}

/**
 * Find the closest intersection point to a given coordinate
 */
export function findClosestIntersection(
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
export function splitRoadAtIntersections(
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

  // Convert segments to features (preserve original properties)
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
 * Filter segments by minimum length
 */
export function filterByMinLength(
  segments: Feature<LineString>[],
  minLength = MIN_SEGMENT_LENGTH
): Feature<LineString>[] {
  return segments.filter((segment) => {
    const length = turf.length(segment, { units: 'meters' });
    return length >= minLength;
  });
}

/**
 * Get ward prefix for ID generation
 */
export function getWardPrefix(wardName: string): string {
  return WARD_PREFIX[wardName] || 'UNK';
}

/**
 * Process a set of roads: find intersections, split, and filter by length
 */
export function segmentRoads(
  roads: Feature<LineString>[],
  minLength = MIN_SEGMENT_LENGTH
): Feature<LineString>[] {
  if (roads.length === 0) {
    return [];
  }

  // Find intersections
  const intersections = findIntersections(roads);

  // Split roads at intersections
  const allSegments: Feature<LineString>[] = [];
  for (const road of roads) {
    const segments = splitRoadAtIntersections(road, intersections);
    allSegments.push(...segments);
  }

  // Filter by minimum length
  return filterByMinLength(allSegments, minLength);
}

/**
 * Split a single road against a set of other roads (for incremental sync)
 * This is useful when syncing a single OSM way against existing roads in the database
 */
export function segmentSingleRoad(
  road: Feature<LineString>,
  nearbyRoads: Feature<LineString>[],
  minLength = MIN_SEGMENT_LENGTH
): Feature<LineString>[] {
  // Combine the road with nearby roads to find all intersections
  const allRoads = [road, ...nearbyRoads];
  const intersections = findIntersections(allRoads);

  // Split only the target road
  const segments = splitRoadAtIntersections(road, intersections);

  // Filter by minimum length
  return filterByMinLength(segments, minLength);
}

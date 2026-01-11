/**
 * Geometry Utilities for OSM Data Processing
 *
 * Handles conversion of OSM elements (way, relation) to GeoJSON geometries.
 */

import type {
  Geometry,
  Position,
  LineString,
  Polygon,
  MultiLineString,
  MultiPolygon,
  GeometryCollection,
  Point,
} from 'geojson';

/**
 * OSM element from Overpass API
 */
export interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  timestamp?: string;
  tags?: Record<string, string>;
  lat?: number;  // For nodes
  lon?: number;  // For nodes
  geometry?: Array<{ lat: number; lon: number }>;  // For ways with out geom
  members?: Array<{
    type: 'node' | 'way' | 'relation';
    ref: number;
    role: string;
    geometry?: Array<{ lat: number; lon: number }>;
  }>;
}

/**
 * Convert OSM node to GeoJSON Point
 */
export function nodeToPoint(element: OsmElement): Point | null {
  if (element.type !== 'node' || element.lat === undefined || element.lon === undefined) {
    return null;
  }

  return {
    type: 'Point',
    coordinates: [element.lon, element.lat],
  };
}

/**
 * Convert OSM way geometry to coordinates array
 */
function wayGeometryToCoords(geometry: Array<{ lat: number; lon: number }>): Position[] {
  return geometry.map((node) => [node.lon, node.lat]);
}

/**
 * Check if coordinates form a closed ring
 */
function isClosed(coords: Position[]): boolean {
  if (coords.length < 4) return false;
  const first = coords[0];
  const last = coords[coords.length - 1];
  return first[0] === last[0] && first[1] === last[1];
}

/**
 * Convert OSM way to GeoJSON LineString or Polygon
 */
export function wayToGeometry(element: OsmElement): LineString | Polygon | null {
  if (element.type !== 'way' || !element.geometry || element.geometry.length < 2) {
    return null;
  }

  const coords = wayGeometryToCoords(element.geometry);

  // If closed and has enough points, treat as polygon
  if (isClosed(coords) && coords.length >= 4) {
    return {
      type: 'Polygon',
      coordinates: [coords],
    };
  }

  return {
    type: 'LineString',
    coordinates: coords,
  };
}

/**
 * Convert OSM relation to GeoJSON geometry
 *
 * Relations can be:
 * - multipolygon: outer/inner rings forming polygons
 * - waterway: collection of ways forming a river
 */
export function relationToGeometry(element: OsmElement): Geometry | null {
  if (element.type !== 'relation' || !element.members) {
    return null;
  }

  const tags = element.tags || {};
  const relationType = tags.type;

  // Handle multipolygon relations
  if (relationType === 'multipolygon') {
    return relationToMultiPolygon(element);
  }

  // Handle waterway relations (river with multiple ways)
  if (tags.waterway || tags.natural === 'water') {
    return relationToWaterGeometry(element);
  }

  // Default: try to build a geometry collection from members
  return relationToGeometryCollection(element);
}

/**
 * Convert multipolygon relation to MultiPolygon
 */
function relationToMultiPolygon(element: OsmElement): MultiPolygon | Polygon | null {
  if (!element.members) return null;

  const outerRings: Position[][] = [];
  const innerRings: Position[][] = [];

  for (const member of element.members) {
    if (member.type !== 'way' || !member.geometry) continue;

    const coords = wayGeometryToCoords(member.geometry);
    if (coords.length < 4) continue;

    // Ensure ring is closed
    if (!isClosed(coords)) {
      coords.push(coords[0]);
    }

    if (member.role === 'outer') {
      outerRings.push(coords);
    } else if (member.role === 'inner') {
      innerRings.push(coords);
    }
  }

  if (outerRings.length === 0) return null;

  // Simple case: single outer ring
  if (outerRings.length === 1) {
    const rings = [outerRings[0], ...innerRings];
    return {
      type: 'Polygon',
      coordinates: rings,
    };
  }

  // Multiple outer rings: create MultiPolygon
  // Note: This is simplified - proper implementation should match inner rings to outer rings
  const polygons: Position[][][] = outerRings.map((outer) => [outer]);

  return {
    type: 'MultiPolygon',
    coordinates: polygons,
  };
}

/**
 * Convert waterway relation to appropriate geometry
 */
function relationToWaterGeometry(element: OsmElement): Geometry | null {
  if (!element.members) return null;

  const lines: Position[][] = [];
  const polygonRings: Position[][] = [];

  for (const member of element.members) {
    if (member.type !== 'way' || !member.geometry) continue;

    const coords = wayGeometryToCoords(member.geometry);
    if (coords.length < 2) continue;

    if (isClosed(coords) && coords.length >= 4) {
      polygonRings.push(coords);
    } else {
      lines.push(coords);
    }
  }

  // If we have polygons, return MultiPolygon
  if (polygonRings.length > 0) {
    if (polygonRings.length === 1) {
      return {
        type: 'Polygon',
        coordinates: [polygonRings[0]],
      };
    }
    return {
      type: 'MultiPolygon',
      coordinates: polygonRings.map((ring) => [ring]),
    };
  }

  // Otherwise return MultiLineString
  if (lines.length > 0) {
    if (lines.length === 1) {
      return {
        type: 'LineString',
        coordinates: lines[0],
      };
    }
    return {
      type: 'MultiLineString',
      coordinates: lines,
    };
  }

  return null;
}

/**
 * Convert relation to GeometryCollection (fallback)
 */
function relationToGeometryCollection(element: OsmElement): GeometryCollection | null {
  if (!element.members) return null;

  const geometries: Geometry[] = [];

  for (const member of element.members) {
    if (member.type !== 'way' || !member.geometry) continue;

    const coords = wayGeometryToCoords(member.geometry);
    if (coords.length < 2) continue;

    if (isClosed(coords) && coords.length >= 4) {
      geometries.push({
        type: 'Polygon',
        coordinates: [coords],
      });
    } else {
      geometries.push({
        type: 'LineString',
        coordinates: coords,
      });
    }
  }

  if (geometries.length === 0) return null;

  return {
    type: 'GeometryCollection',
    geometries,
  };
}

/**
 * Convert any OSM element to GeoJSON geometry
 */
export function osmElementToGeometry(element: OsmElement): Geometry | null {
  switch (element.type) {
    case 'node':
      return nodeToPoint(element);
    case 'way':
      return wayToGeometry(element);
    case 'relation':
      return relationToGeometry(element);
    default:
      return null;
  }
}

/**
 * Determine geometry type category
 */
export type GeometryTypeCategory = 'point' | 'line' | 'polygon' | 'collection';

export function getGeometryCategory(geometry: Geometry): GeometryTypeCategory {
  switch (geometry.type) {
    case 'Point':
    case 'MultiPoint':
      return 'point';
    case 'LineString':
    case 'MultiLineString':
      return 'line';
    case 'Polygon':
    case 'MultiPolygon':
      return 'polygon';
    case 'GeometryCollection':
      return 'collection';
    default:
      return 'collection';
  }
}

/**
 * Generate unique ID with prefix
 */
export function generateId(prefix: string, length = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = prefix;
  for (let i = 0; i < length; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

import type { Feature, Geometry, Polygon, LineString, GeometryCollection } from 'geojson';

/**
 * Converts a GeoJSON geometry (including Multi* types) into an array of Features.
 * This is used to load geometry into MapboxDraw for editing.
 * Same logic as useMapDraw lines 288-329.
 */
export function geometryToFeatures(geometry: Geometry): Feature[] {
  const features: Feature[] = [];

  if (geometry.type === 'MultiPolygon') {
    for (const coords of geometry.coordinates) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: coords } as Polygon,
        properties: {},
      });
    }
  } else if (geometry.type === 'MultiLineString') {
    for (const coords of geometry.coordinates) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords } as LineString,
        properties: {},
      });
    }
  } else if (geometry.type === 'GeometryCollection') {
    for (const geom of (geometry as GeometryCollection).geometries) {
      features.push({
        type: 'Feature',
        geometry: geom,
        properties: {},
      });
    }
  } else {
    // Single geometry (Polygon, LineString, Point, etc.)
    features.push({
      type: 'Feature',
      geometry: geometry,
      properties: {},
    });
  }

  return features;
}

/**
 * Determines the draw type (polygon or line) based on geometry type.
 * Used to set currentDrawType when loading geometry for editing.
 */
export function getDrawTypeFromGeometry(geometry: Geometry): 'polygon' | 'line' {
  if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
    return 'polygon';
  }
  if (geometry.type === 'GeometryCollection') {
    const gc = geometry as GeometryCollection;
    if (gc.geometries.length > 0) {
      return gc.geometries[0].type === 'Polygon' ? 'polygon' : 'line';
    }
  }
  return 'line';
}

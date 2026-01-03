import * as turf from '@turf/turf';
import type { Feature, Polygon, MultiPolygon, Geometry } from 'geojson';

const BUFFER_METERS = 15;

// Simple interface for assets with geometry - works with both full RoadAsset and cache entries
interface AssetWithGeometry {
  id: string;
  geometry: Geometry;
}

/**
 * Generate corridor geometry from road assets by buffering and unioning.
 * This is for frontend preview only - backend PostGIS result is authoritative.
 */
export function generateCorridorGeometry(
  assets: AssetWithGeometry[]
): Polygon | MultiPolygon | null {
  if (assets.length === 0) return null;

  // Buffer each road geometry
  const buffered: Feature<Polygon>[] = [];
  for (const asset of assets) {
    try {
      // turf.buffer accepts Feature or Geometry
      const result = turf.buffer(turf.feature(asset.geometry), BUFFER_METERS, {
        units: 'meters',
      });
      if (result) {
        buffered.push(result as Feature<Polygon>);
      }
    } catch {
      // Skip invalid geometries
    }
  }

  if (buffered.length === 0) return null;
  if (buffered.length === 1) return buffered[0].geometry;

  // Union using reduce (turf.union takes exactly 2 Features)
  try {
    let unified: Feature<Polygon | MultiPolygon> = buffered[0];
    for (let i = 1; i < buffered.length; i++) {
      const result = turf.union(turf.featureCollection([unified, buffered[i]]));
      if (result) {
        unified = result as Feature<Polygon | MultiPolygon>;
      }
    }
    return unified.geometry;
  } catch {
    // Fall back to first buffer if union fails
    return buffered[0].geometry;
  }
}

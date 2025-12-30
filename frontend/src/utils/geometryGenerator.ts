import * as turf from '@turf/turf';
import type { Feature, Polygon, MultiPolygon, Geometry } from 'geojson';
import type { RoadAsset } from '@nagoya/shared';

const BUFFER_METERS = 15;

/**
 * Generate corridor geometry from road assets by buffering and unioning.
 * This is for frontend preview only - backend PostGIS result is authoritative.
 */
export function generateCorridorGeometry(
  roadAssets: RoadAsset[]
): Polygon | MultiPolygon | null {
  if (roadAssets.length === 0) return null;

  // Buffer each road geometry
  const buffered = roadAssets
    .map((asset) => {
      try {
        return turf.buffer(asset.geometry as Geometry, BUFFER_METERS, {
          units: 'meters',
        });
      } catch {
        return undefined;
      }
    })
    .filter((f): f is Feature<Polygon> => f !== undefined);

  if (buffered.length === 0) return null;
  if (buffered.length === 1) return buffered[0].geometry;

  // Union using reduce (turf.union takes exactly 2 Features)
  try {
    const unified = buffered.reduce((acc, curr) =>
      turf.union(acc, curr) || acc
    );

    return unified.geometry as Polygon | MultiPolygon;
  } catch {
    // Fall back to first buffer if union fails
    return buffered[0].geometry;
  }
}

/**
 * 12 MongoDB GIS spatial benchmark queries (G1-G12).
 *
 * Three categories:
 *   Proximity  (G1-G4) — $nearSphere, $geoNear
 *   BBox       (G5-G8) — $geoWithin ($box, $geometry)
 *   Intersect  (G9-G12) — $geoIntersects, Turf.js buffer
 *
 * Each returns { docs, count } for compatibility with the shared reporter.
 */

import type { Db, Document } from 'mongodb';
import * as turf from '@turf/turf';

export interface GisQueryResult {
  docs: Document[];
  count: number;
}

// ---------------------------------------------------------------------------
// Thresholds (p95 in ms)
// ---------------------------------------------------------------------------
export const GIS_THRESHOLDS: Record<string, number> = {
  G1: 50, G2: 100, G3: 200, G4: 30,
  G5: 100, G6: 100, G7: 200, G8: 100,
  G9: 100, G10: 50, G11: 200, G12: 500,
};

// ---------------------------------------------------------------------------
// Proximity queries (G1-G4)
// ---------------------------------------------------------------------------

/** G1: Assets within 500m of a point ($nearSphere) */
export async function g1_nearSphereAssets500m(
  db: Db, lng: number, lat: number,
): Promise<GisQueryResult> {
  const docs = await db.collection('gis_assets').find({
    geometry: {
      $nearSphere: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: 500,
      },
    },
  }).toArray();
  return { docs, count: docs.length };
}

/** G2: Events within 1km of a point ($nearSphere) */
export async function g2_nearSphereEvents1km(
  db: Db, lng: number, lat: number,
): Promise<GisQueryResult> {
  const docs = await db.collection('gis_events').find({
    geometry: {
      $nearSphere: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: 1000,
      },
    },
  }).toArray();
  return { docs, count: docs.length };
}

/** G3: Nearby assets + $lookup their related events ($geoNear + $lookup) */
export async function g3_nearSphereWithLookup(
  db: Db, lng: number, lat: number,
): Promise<GisQueryResult> {
  const docs = await db.collection('gis_assets').aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [lng, lat] },
        distanceField: 'distance',
        maxDistance: 500,
        spherical: true,
      },
    },
    { $limit: 50 },
    {
      $lookup: {
        from: 'gis_events',
        localField: 'id',
        foreignField: 'asset_id',
        as: 'events',
      },
    },
    {
      $project: {
        id: 1, geometry: 1, status: 1, distance: 1,
        eventCount: { $size: '$events' },
      },
    },
  ]).toArray();
  return { docs, count: docs.length };
}

/** G4: Nearest 10 assets (sorted by distance) */
export async function g4_nearest10(
  db: Db, lng: number, lat: number,
): Promise<GisQueryResult> {
  const docs = await db.collection('gis_assets').find({
    geometry: {
      $nearSphere: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
      },
    },
  }).limit(10).toArray();
  return { docs, count: docs.length };
}

// ---------------------------------------------------------------------------
// Bounding Box queries (G5-G8)
// ---------------------------------------------------------------------------

/** G5: Assets within a viewport bounding box ($geoWithin $box) */
export async function g5_bboxAssets(
  db: Db, minLng: number, minLat: number, maxLng: number, maxLat: number,
): Promise<GisQueryResult> {
  const docs = await db.collection('gis_assets').find({
    geometry: {
      $geoWithin: {
        $box: [[minLng, minLat], [maxLng, maxLat]],
      },
    },
  }).toArray();
  return { docs, count: docs.length };
}

/** G6: Events within a viewport bounding box ($geoWithin $box) */
export async function g6_bboxEvents(
  db: Db, minLng: number, minLat: number, maxLng: number, maxLat: number,
): Promise<GisQueryResult> {
  const docs = await db.collection('gis_events').find({
    geometry: {
      $geoWithin: {
        $box: [[minLng, minLat], [maxLng, maxLat]],
      },
    },
  }).toArray();
  return { docs, count: docs.length };
}

/** G7: Assets within a ward polygon ($geoWithin $geometry) */
export async function g7_withinWardPolygon(
  db: Db, wardPolygon: GeoJSON.Polygon,
): Promise<GisQueryResult> {
  const docs = await db.collection('gis_assets').find({
    geometry: {
      $geoWithin: {
        $geometry: wardPolygon,
      },
    },
  }).toArray();
  return { docs, count: docs.length };
}

/** G8: Assets within bbox + status filter (compound query).
 *  Uses $geometry with a GeoJSON Polygon (not $box) to leverage the 2dsphere index.
 *  $box uses flat 2D scan and bypasses 2dsphere — causes ~160ms at L-tier. */
export async function g8_bboxWithStatusFilter(
  db: Db, minLng: number, minLat: number, maxLng: number, maxLat: number,
): Promise<GisQueryResult> {
  // Convert bbox to GeoJSON Polygon so $geoWithin uses the 2dsphere index
  const bboxPolygon: GeoJSON.Polygon = {
    type: 'Polygon',
    coordinates: [[
      [minLng, minLat],
      [maxLng, minLat],
      [maxLng, maxLat],
      [minLng, maxLat],
      [minLng, minLat],
    ]],
  };
  const docs = await db.collection('gis_assets').find({
    geometry: {
      $geoWithin: {
        $geometry: bboxPolygon,
      },
    },
    status: 'active',
  }).toArray();
  return { docs, count: docs.length };
}

// ---------------------------------------------------------------------------
// Intersection queries (G9-G12)
// ---------------------------------------------------------------------------

/** G9: Assets intersecting an event polygon ($geoIntersects) */
export async function g9_intersectsEventAssets(
  db: Db, eventPolygon: GeoJSON.Polygon,
): Promise<GisQueryResult> {
  const docs = await db.collection('gis_assets').find({
    geometry: {
      $geoIntersects: {
        $geometry: eventPolygon,
      },
    },
  }).toArray();
  return { docs, count: docs.length };
}

/** G10: Events intersecting a zone polygon ($geoIntersects) */
export async function g10_intersectsPolygons(
  db: Db, zonePolygon: GeoJSON.Polygon,
): Promise<GisQueryResult> {
  const docs = await db.collection('gis_events').find({
    geometry: {
      $geoIntersects: {
        $geometry: zonePolygon,
      },
    },
  }).toArray();
  return { docs, count: docs.length };
}

/** G11: Buffer (Turf.js) + $geoIntersects (app-side buffer computation) */
export async function g11_bufferIntersects(
  db: Db, lng: number, lat: number, radiusMeters: number,
): Promise<GisQueryResult> {
  // Application-side buffer computation (MongoDB has no native ST_Buffer)
  const buffered = turf.buffer(turf.point([lng, lat]), radiusMeters, { units: 'meters' });
  const bufferPolygon = buffered!.geometry;

  const docs = await db.collection('gis_assets').find({
    geometry: {
      $geoIntersects: {
        $geometry: bufferPolygon,
      },
    },
  }).toArray();
  return { docs, count: docs.length };
}

/** G12: Batch 5x intersection queries (parallel) */
export async function g12_batchIntersects(
  db: Db, eventPolygons: GeoJSON.Polygon[],
): Promise<GisQueryResult> {
  const results = await Promise.all(
    eventPolygons.slice(0, 5).map(poly => g9_intersectsEventAssets(db, poly)),
  );
  const allDocs = results.flatMap(r => r.docs);
  return { docs: allDocs, count: allDocs.length };
}

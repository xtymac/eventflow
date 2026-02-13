/**
 * 3 PostGIS comparison queries for GIS benchmark (G1', G9', G11').
 *
 * These run against dedicated gis_benchmark_assets / gis_benchmark_events tables
 * created by gis-seed.ts, with GIST indexes.
 */

import type { Pool, QueryResult } from 'pg';

export interface PgGisResult {
  rows: Record<string, unknown>[];
  count: number;
}

function toResult(qr: QueryResult): PgGisResult {
  return { rows: qr.rows, count: qr.rowCount ?? qr.rows.length };
}

/**
 * G1': Proximity — assets within 500m of a point (ST_DWithin + geography cast).
 * Uses ::geography for accurate meter-based distance (not degree-based).
 */
export async function g1_pg_dwithin(
  pool: Pool, lng: number, lat: number,
): Promise<PgGisResult> {
  const qr = await pool.query(
    `SELECT id, status, ward, asset_type, ST_AsGeoJSON(geometry)::json as geometry
     FROM gis_benchmark_assets
     WHERE ST_DWithin(
       geometry::geography,
       ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
       500
     )`,
    [lng, lat],
  );
  return toResult(qr);
}

/**
 * G9': Intersection — assets intersecting an event polygon (ST_Intersects).
 * Finds all GIS assets whose geometry intersects the given event's geometry.
 */
export async function g9_pg_intersects(
  pool: Pool, eventId: string,
): Promise<PgGisResult> {
  const qr = await pool.query(
    `SELECT a.id, a.status, a.ward, ST_AsGeoJSON(a.geometry)::json as geometry
     FROM gis_benchmark_assets a, gis_benchmark_events e
     WHERE e.id = $1
       AND ST_Intersects(e.geometry, a.geometry)`,
    [eventId],
  );
  return toResult(qr);
}

/**
 * G11': Buffer + Intersection — assets within a buffer around a point (ST_Buffer + ST_Intersects).
 * PostGIS handles buffer natively (unlike MongoDB which needs Turf.js).
 */
export async function g11_pg_bufferIntersects(
  pool: Pool, lng: number, lat: number, radiusMeters: number,
): Promise<PgGisResult> {
  const qr = await pool.query(
    `SELECT id, status, ward, asset_type, ST_AsGeoJSON(geometry)::json as geometry
     FROM gis_benchmark_assets
     WHERE ST_Intersects(
       geometry,
       ST_Buffer(ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)::geometry
     )`,
    [lng, lat, radiusMeters],
  );
  return toResult(qr);
}

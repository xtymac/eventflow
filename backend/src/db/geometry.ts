import { sql } from 'drizzle-orm';
import type { Geometry, Point } from 'geojson';

/** Convert GeoJSON to PostGIS geometry for INSERT/UPDATE */
export function toGeomSql(geojson: Geometry | Point) {
  return sql`ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(geojson)}), 4326)`;
}

/** Convert GeoJSON to PostGIS geometry, or NULL if input is null */
export function toGeomSqlNullable(geojson: Geometry | Point | null | undefined) {
  if (geojson == null) return sql`NULL`;
  return toGeomSql(geojson);
}

/**
 * Convert PostGIS geometry to GeoJSON for SELECT
 * Uses CASE WHEN to handle NULL values safely (avoids JSON.parse(null) failures)
 */
export function fromGeomSql(column: unknown) {
  return sql<Geometry | null>`CASE WHEN ${column} IS NULL THEN NULL ELSE ST_AsGeoJSON(${column})::json END`.as('geometry');
}

/** Convert non-null PostGIS geometry to GeoJSON for SELECT */
export function fromGeomSqlRequired(column: unknown) {
  return sql<Geometry>`ST_AsGeoJSON(${column})::json`.as('geometry');
}

/** Convert non-null PostGIS point geometry to GeoJSON for SELECT */
export function fromPointSqlRequired(column: unknown) {
  return sql<Point>`ST_AsGeoJSON(${column})::json`.as('geometry');
}

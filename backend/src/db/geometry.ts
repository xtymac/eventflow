import { sql } from 'drizzle-orm';
import type { Geometry, Point } from 'geojson';

// Loose geometry type for accepting TypeBox schema output
type GeoJSONLike = { type: string; coordinates: unknown };

/** Convert GeoJSON to PostGIS geometry for INSERT/UPDATE */
export function toGeomSql(geojson: Geometry | Point | GeoJSONLike) {
  return sql`ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(geojson)}), 4326)`;
}

/** Convert GeoJSON to PostGIS geometry, or NULL if input is null */
export function toGeomSqlNullable(geojson: Geometry | Point | GeoJSONLike | null | undefined) {
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

import { sql, SQL } from 'drizzle-orm';
import { InvalidCrsError } from './ogc-error.js';

// OGC CRS URI definitions
export const CRS84 = 'http://www.opengis.net/def/crs/OGC/1.3/CRS84';
export const EPSG_4326 = 'http://www.opengis.net/def/crs/EPSG/0/4326';
export const EPSG_3857 = 'http://www.opengis.net/def/crs/EPSG/0/3857';
export const EPSG_6675 = 'http://www.opengis.net/def/crs/EPSG/0/6675';

// Internal storage SRID
export const STORAGE_SRID = 4326;

/**
 * OGC CRS URI to EPSG code mapping
 *
 * Axis order notes:
 * - CRS84: lon/lat (same as GeoJSON default) - no axis swap needed
 * - EPSG:4326: formally lat/lon but we treat as lon/lat for GeoJSON compatibility
 * - EPSG:3857: Web Mercator (meters, X/Y)
 * - EPSG:6675: JGD2011 Zone VII for Aichi/Nagoya (meters, X/Y)
 */
const CRS_MAP: Record<string, number> = {
  [CRS84]: 4326,
  [EPSG_4326]: 4326,
  [EPSG_3857]: 3857,
  [EPSG_6675]: 6675,
};

/**
 * EPSG codes that use projected coordinates (meters)
 * Important for S_DWITHIN distance calculations
 */
const PROJECTED_CRS = new Set([3857, 6675]);

/**
 * List of supported CRS URIs for API responses
 */
export const SUPPORTED_CRS_LIST = Object.keys(CRS_MAP);

/**
 * Convert OGC CRS URI to EPSG code
 * @throws InvalidCrsError if URI is not supported
 */
export function crsUriToEpsg(crsUri: string): number {
  const epsg = CRS_MAP[crsUri];
  if (epsg === undefined) {
    throw new InvalidCrsError(crsUri);
  }
  return epsg;
}

/**
 * Convert EPSG code to OGC CRS URI
 */
export function epsgToCrsUri(epsg: number): string {
  const entry = Object.entries(CRS_MAP).find(([_, code]) => code === epsg);
  return entry ? entry[0] : `http://www.opengis.net/def/crs/EPSG/0/${epsg}`;
}

/**
 * Check if CRS is valid and supported
 */
export function isValidCrs(crsUri: string): boolean {
  return crsUri in CRS_MAP;
}

/**
 * Check if CRS uses projected coordinates (meters)
 * Used for determining S_DWITHIN distance units
 */
export function isProjectedCrs(epsg: number): boolean {
  return PROJECTED_CRS.has(epsg);
}

/**
 * Generate SQL for selecting geometry with optional CRS transformation
 *
 * @param geometryColumn - Name of the geometry column
 * @param outputCrs - Optional output CRS URI (default: CRS84/no transform)
 * @returns SQL fragment for SELECT clause
 */
export function transformGeometrySelect(
  geometryColumn: string,
  outputCrs?: string
): SQL {
  // No CRS specified or CRS84 (same as storage) - no transform needed
  if (!outputCrs || outputCrs === CRS84) {
    return sql`ST_AsGeoJSON(${sql.raw(geometryColumn)})::json`;
  }

  const targetSrid = crsUriToEpsg(outputCrs);

  // Same as storage SRID - no transform needed
  if (targetSrid === STORAGE_SRID) {
    return sql`ST_AsGeoJSON(${sql.raw(geometryColumn)})::json`;
  }

  // Transform to target CRS
  // Use sql.raw for SRID to ensure it's passed as a literal number, not a parameter
  return sql`ST_AsGeoJSON(ST_Transform(${sql.raw(geometryColumn)}, ${sql.raw(String(targetSrid))}))::json`;
}

/**
 * Generate SQL for bbox filter with optional input CRS transformation
 *
 * @param bbox - Bounding box [minX, minY, maxX, maxY]
 * @param geometryColumn - Name of the geometry column
 * @param bboxCrs - Optional CRS of bbox coordinates (default: CRS84)
 * @returns SQL fragment for WHERE clause
 */
export function transformBboxFilter(
  bbox: [number, number, number, number],
  geometryColumn: string,
  bboxCrs?: string
): SQL {
  const [minX, minY, maxX, maxY] = bbox;

  // No CRS specified or CRS84 - bbox is in storage CRS (4326)
  if (!bboxCrs || bboxCrs === CRS84) {
    return sql`ST_Intersects(
      ${sql.raw(geometryColumn)},
      ST_MakeEnvelope(${minX}, ${minY}, ${maxX}, ${maxY}, 4326)
    )`;
  }

  const sourceSrid = crsUriToEpsg(bboxCrs);

  // Same as storage SRID - no transform needed
  if (sourceSrid === STORAGE_SRID) {
    return sql`ST_Intersects(
      ${sql.raw(geometryColumn)},
      ST_MakeEnvelope(${minX}, ${minY}, ${maxX}, ${maxY}, 4326)
    )`;
  }

  // Transform bbox from source CRS to storage CRS (4326)
  // Use sql.raw for SRID to ensure it's passed as a literal number
  return sql`ST_Intersects(
    ${sql.raw(geometryColumn)},
    ST_Transform(ST_MakeEnvelope(${minX}, ${minY}, ${maxX}, ${maxY}, ${sql.raw(String(sourceSrid))}), 4326)
  )`;
}

/**
 * Parse bbox string to array
 * Supports both 2D (4 values) and 3D (6 values) bboxes
 *
 * @param bboxString - Comma-separated bbox string "minX,minY,maxX,maxY"
 * @returns Parsed bbox array or null if invalid
 */
export function parseBbox(bboxString: string): [number, number, number, number] | null {
  const parts = bboxString.split(',').map(Number);

  // Only support 2D bbox for now
  if (parts.length !== 4 || parts.some(isNaN)) {
    return null;
  }

  const [minX, minY, maxX, maxY] = parts;

  // Basic validation
  if (minX > maxX || minY > maxY) {
    return null;
  }

  // Validate WGS84 coordinate ranges for default CRS
  // (More lenient validation - projected CRS can have different ranges)
  if (Math.abs(minX) > 180 || Math.abs(maxX) > 180 ||
      Math.abs(minY) > 90 || Math.abs(maxY) > 90) {
    // Could be in projected CRS, allow it but validate later
  }

  return [minX, minY, maxX, maxY];
}

/**
 * Generate Content-Crs header value
 */
export function formatContentCrsHeader(crsUri: string): string {
  return `<${crsUri}>`;
}

/**
 * Parse Content-Crs header value
 */
export function parseContentCrsHeader(header: string): string | null {
  const match = header.match(/^<(.+)>$/);
  return match ? match[1] : null;
}

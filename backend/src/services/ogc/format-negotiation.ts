import { FastifyRequest, FastifyReply } from 'fastify';
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { Feature, FeatureCollection } from '../../routes/ogc/schemas/ogc-common.js';

const execAsync = promisify(exec);

// Temp directory for exports
const EXPORTS_DIR = '/tmp/ogc-exports';

// Ensure exports directory exists
if (!existsSync(EXPORTS_DIR)) {
  mkdirSync(EXPORTS_DIR, { recursive: true });
}

/**
 * Supported output formats
 */
export type OutputFormat = 'geojson' | 'gpkg';

/**
 * MIME type mapping
 */
const MIME_TYPES: Record<OutputFormat, string> = {
  geojson: 'application/geo+json',
  gpkg: 'application/geopackage+sqlite3',
};

/**
 * Negotiate output format from request
 *
 * Priority:
 * 1. `f` query parameter (explicit format)
 * 2. Accept header content negotiation
 * 3. Default to GeoJSON
 */
export function negotiateFormat(request: FastifyRequest): OutputFormat {
  // Check f query parameter
  const fParam = (request.query as Record<string, string>).f?.toLowerCase();
  if (fParam === 'gpkg' || fParam === 'geopackage') {
    return 'gpkg';
  }
  if (fParam === 'geojson' || fParam === 'json') {
    return 'geojson';
  }

  // Check Accept header
  const accept = request.headers.accept || '';
  if (accept.includes('application/geopackage+sqlite3')) {
    return 'gpkg';
  }

  // Default to GeoJSON
  return 'geojson';
}

/**
 * Get content type for format
 */
export function getContentType(format: OutputFormat): string {
  return MIME_TYPES[format];
}

/**
 * Export FeatureCollection to GeoPackage format
 *
 * @param features - Array of GeoJSON features
 * @param collectionId - Collection name for layer naming
 * @param crsEpsg - EPSG code for output CRS (default: 4326)
 * @returns Buffer containing the GeoPackage file
 */
export async function exportToGeoPackage(
  features: Feature[],
  collectionId: string,
  crsEpsg: number = 4326
): Promise<Buffer> {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(7);
  const geojsonPath = join(EXPORTS_DIR, `export-${timestamp}-${randomSuffix}.geojson`);
  const gpkgPath = join(EXPORTS_DIR, `export-${timestamp}-${randomSuffix}.gpkg`);

  try {
    // Create FeatureCollection GeoJSON
    const featureCollection = {
      type: 'FeatureCollection',
      features: features.map(f => ({
        type: 'Feature',
        id: f.id,
        properties: f.properties,
        geometry: f.geometry,
      })),
    };

    // Write temporary GeoJSON file
    writeFileSync(geojsonPath, JSON.stringify(featureCollection));

    // Convert to GeoPackage using ogr2ogr
    // -f GPKG: output format
    // -a_srs: set CRS (required for GIS clients)
    // -nln: layer name
    // -dsco VERSION=1.2: GeoPackage 1.2 for ArcGIS compatibility
    const layerName = collectionId.replace(/-/g, '_');
    const cmd = `ogr2ogr -f GPKG -a_srs EPSG:${crsEpsg} -nln ${layerName} -dsco VERSION=1.2 "${gpkgPath}" "${geojsonPath}"`;

    await execAsync(cmd);

    // Read the GPKG file
    const gpkgBuffer = readFileSync(gpkgPath);

    return gpkgBuffer;
  } finally {
    // Cleanup temp files
    if (existsSync(geojsonPath)) {
      try { unlinkSync(geojsonPath); } catch {}
    }
    if (existsSync(gpkgPath)) {
      try { unlinkSync(gpkgPath); } catch {}
    }
  }
}

/**
 * Send GeoPackage response
 */
export async function sendGeoPackageResponse(
  reply: FastifyReply,
  features: Feature[],
  collectionId: string,
  crsEpsg: number = 4326
): Promise<void> {
  const gpkgBuffer = await exportToGeoPackage(features, collectionId, crsEpsg);

  // Generate filename with date
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `${collectionId}-${dateStr}.gpkg`;

  reply.header('Content-Type', 'application/geopackage+sqlite3');
  reply.header('Content-Disposition', `attachment; filename="${filename}"`);
  reply.send(gpkgBuffer);
}

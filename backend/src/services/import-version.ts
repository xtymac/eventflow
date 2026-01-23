/**
 * Import Version Service
 *
 * Handles GeoPackage/GeoJSON file import with versioning, validation,
 * diff generation, and publish/rollback capabilities.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, readdirSync, statSync } from 'fs';
import { join, dirname, extname, basename } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { Feature, FeatureCollection, Geometry, LineString, MultiLineString } from 'geojson';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import {
  importVersions,
  importJobs,
  roadAssets,
  exportRecords,
  type NewImportVersion,
  type NewImportJob,
  type ImportVersion,
  type ImportJob,
  type RoadAsset,
  type ExportRecord,
} from '../db/schema.js';
import { eq, sql, and, inArray, not, isNull, desc, gt } from 'drizzle-orm';
import { toGeomSql, fromGeomSql } from '../db/geometry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const execAsync = promisify(exec);

// Configuration - use local path for development, /app/uploads for Docker
const UPLOADS_DIR = process.env.UPLOADS_DIR || join(__dirname, '../../uploads');
const IMPORTS_DIR = join(UPLOADS_DIR, 'imports');
const SNAPSHOTS_DIR = join(UPLOADS_DIR, 'snapshots');
const DIFFS_DIR = join(UPLOADS_DIR, 'import-diffs');

// Ensure directories exist
[UPLOADS_DIR, IMPORTS_DIR, SNAPSHOTS_DIR, DIFFS_DIR].forEach(dir => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
});

// Japan bounding box for coordinate validation
const JAPAN_BOUNDS = {
  minLng: 122,
  maxLng: 154,
  minLat: 20,
  maxLat: 46,
};

// Valid geometry types for roads
const VALID_ROAD_GEOMETRY_TYPES = ['LineString', 'MultiLineString'];

// Valid road types
const VALID_ROAD_TYPES = ['arterial', 'collector', 'local'];

// Valid data sources
const VALID_DATA_SOURCES = ['osm_test', 'official_ledger', 'manual'];

export interface ValidationError {
  featureIndex: number;
  featureId?: string;
  field: string;
  error: string;
  hint: string;
}

export interface ValidationWarning {
  featureIndex: number;
  featureId?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  featureCount: number;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  geometryTypes: string[];
  missingIdCount: number;
  missingDataSourceCount: number;
}

export interface DiffResult {
  scope: string;
  regionalRefresh: boolean;
  comparisonMode: 'precise' | 'bbox' | 'geometry';  // 'geometry' when fallback matching by geometry is used
  sourceExportId?: string;  // Export record ID when using precise comparison
  added: Feature[];
  updated: Feature[];
  deactivated: Feature[];
  unchanged: number;
  stats: {
    scopeCurrentCount: number;
    importCount: number;
    addedCount: number;
    updatedCount: number;
    deactivatedCount: number;
    geometryMatchCount?: number;  // Number of features matched by geometry (not ID)
  };
}

export interface PublishResult {
  success: boolean;
  added: number;
  updated: number;
  deactivated: number;
  unchanged: number;
  snapshotPath: string;
  publishedAt: string;
  scope: string;
}

export interface RollbackResult {
  success: boolean;
  restored: number;
  snapshotPath: string;
  rolledBackAt: string;
}

export interface LayerInfo {
  name: string;
  featureCount: number;
  geometryType: string;
}

/**
 * Import Version Service
 */
export class ImportVersionService {
  /**
   * Get the next version number
   */
  async getNextVersionNumber(): Promise<number> {
    const result = await db
      .select({ maxVersion: sql<number>`COALESCE(MAX(version_number), 0)` })
      .from(importVersions);
    return (result[0]?.maxVersion ?? 0) + 1;
  }

  /**
   * Save uploaded file and create draft version record
   */
  async saveUploadedFile(
    fileBuffer: Buffer,
    fileName: string,
    uploadedBy?: string
  ): Promise<ImportVersion> {
    const versionId = `IV-${nanoid(8)}`;
    const versionNumber = await this.getNextVersionNumber();
    const ext = extname(fileName).toLowerCase();
    const fileType = ext === '.gpkg' ? 'geopackage' : 'geojson';

    // Create version directory
    const versionDir = join(IMPORTS_DIR, versionId);
    mkdirSync(versionDir, { recursive: true });

    // Save original file
    const originalPath = join(versionDir, `original${ext}`);
    writeFileSync(originalPath, fileBuffer);

    // Calculate file size in MB
    const fileSizeMB = fileBuffer.length / (1024 * 1024);

    // Create draft version record (featureCount will be updated after conversion)
    const newVersion: NewImportVersion = {
      id: versionId,
      versionNumber,
      status: 'draft',
      fileName,
      fileType,
      filePath: originalPath,
      importScope: 'full', // Default, will be updated in configure step
      defaultDataSource: 'official_ledger', // Default, will be updated in configure step
      fileSizeMB: fileSizeMB.toFixed(2),
      featureCount: 0, // Will be updated after conversion
      uploadedBy: uploadedBy || null,
      uploadedAt: new Date(),
    };

    await db.insert(importVersions).values(newVersion);

    // Return the created version
    const [version] = await db
      .select()
      .from(importVersions)
      .where(eq(importVersions.id, versionId));

    return version;
  }

  /**
   * List layers in a GeoPackage file
   */
  async listGeoPackageLayers(versionId: string): Promise<LayerInfo[]> {
    const [version] = await db
      .select()
      .from(importVersions)
      .where(eq(importVersions.id, versionId));

    if (!version || version.fileType !== 'geopackage') {
      return [];
    }

    try {
      const { stdout } = await execAsync(`ogrinfo -so "${version.filePath}"`);
      const layers: LayerInfo[] = [];

      // Parse ogrinfo output to extract layer info
      // Format: "1: layer_name (Geometry Type)" - geometry type can have spaces like "Multi Line String"
      // Use .+? to match any characters (including Japanese/Unicode) in layer names
      const layerMatches = stdout.matchAll(/(\d+): (.+?) \(([^)]+)\)/g);
      for (const match of layerMatches) {
        layers.push({
          name: match[2].trim(),  // Trim whitespace from layer name
          geometryType: match[3],
          featureCount: 0, // Could parse from detailed output if needed
        });
      }

      return layers;
    } catch (error) {
      console.error('Error listing GeoPackage layers:', error);
      return [];
    }
  }

  /**
   * Configure import version (layer, CRS, scope, dataSource)
   */
  async configureVersion(
    versionId: string,
    config: {
      layerName?: string;
      sourceCRS?: string;
      // importScope is now auto-calculated from the file's bounding box
      defaultDataSource: string;
      regionalRefresh?: boolean;
    }
  ): Promise<ImportVersion> {
    const [version] = await db
      .select()
      .from(importVersions)
      .where(eq(importVersions.id, versionId));

    if (!version) {
      throw new Error(`Version ${versionId} not found`);
    }

    // Convert GeoPackage to GeoJSON if needed
    let geojsonPath = version.filePath;
    if (version.fileType === 'geopackage') {
      // Always use the original GeoPackage file path (not converted.geojson from previous attempts)
      // The original file is saved as "original.gpkg" in the version directory
      const versionDir = dirname(version.filePath);
      const originalGpkgPath = join(versionDir, 'original.gpkg');
      const sourcePath = existsSync(originalGpkgPath) ? originalGpkgPath : version.filePath;

      geojsonPath = await this.convertGeoPackageToGeoJSON(
        sourcePath,
        config.layerName,
        config.sourceCRS
      );
    } else if (config.sourceCRS && config.sourceCRS !== 'EPSG:4326') {
      // Convert GeoJSON CRS if needed
      geojsonPath = await this.transformGeoJSONCRS(version.filePath, config.sourceCRS);
    }

    // Read GeoJSON and count features
    const geojson = JSON.parse(readFileSync(geojsonPath, 'utf-8')) as FeatureCollection;
    const features = geojson.features || [];
    const featureCount = features.length;

    // Detect _exportId from features (for precise comparison)
    // Check first feature for _exportId - all features from same export share this ID
    // Note: ogr2ogr may rename _exportId to F_exportId when converting GeoPackage, so check both
    let sourceExportId: string | null = null;
    if (features.length > 0) {
      const props = features[0].properties;
      const detectedExportId = props?._exportId || props?.F_exportId;

      if (detectedExportId) {
        // Verify the export record exists
        const [exportRecord] = await db
          .select()
          .from(exportRecords)
          .where(eq(exportRecords.id, detectedExportId));

        if (exportRecord) {
          sourceExportId = detectedExportId;
          console.log('[Import] Detected source export:', sourceExportId, '- will use precise comparison');
        } else {
          console.log('[Import] Export ID', detectedExportId, 'not found in export_records - using bbox comparison');
        }
      }
    }

    // Auto-calculate bounding box from import file
    const bbox = this.calculateBoundingBox(features);

    // Determine importScope: use calculated bbox or fail if empty
    let importScope: string;
    if (bbox) {
      const [minLng, minLat, maxLng, maxLat] = bbox;
      importScope = `bbox:${minLng},${minLat},${maxLng},${maxLat}`;
      console.log('[Import] Auto-calculated bbox:', importScope);
    } else if (featureCount === 0) {
      throw new Error('Import file contains no features');
    } else {
      throw new Error('Import file contains no valid geometries');
    }

    // Update version record with auto-detected scope and source export
    await db
      .update(importVersions)
      .set({
        layerName: config.layerName || null,
        sourceCRS: config.sourceCRS || null,
        importScope,  // Auto-calculated bbox
        defaultDataSource: config.defaultDataSource,
        regionalRefresh: config.regionalRefresh ?? false,
        featureCount,
        filePath: geojsonPath,
        sourceExportId,  // For precise comparison
      })
      .where(eq(importVersions.id, versionId));

    const [updated] = await db
      .select()
      .from(importVersions)
      .where(eq(importVersions.id, versionId));

    return updated;
  }

  /**
   * Check if CRS is WGS 84 (handles various naming conventions)
   */
  private isWGS84(crs: string | undefined | null): boolean {
    if (!crs) return false;
    const normalized = crs.toUpperCase().replace(/\s+/g, '');
    return (
      normalized === 'EPSG:4326' ||
      normalized === 'WGS84' ||
      normalized === 'WGS_84' ||
      normalized.includes('WGS84') ||
      normalized.includes('WGS_1984') ||
      normalized.includes('GEOGCS["WGS84"') ||
      normalized.includes('GEOGCS["WGS_84"')
    );
  }

  /**
   * Calculate bounding box from GeoJSON features
   * Returns [minLng, minLat, maxLng, maxLat] or null if no valid coordinates
   */
  private calculateBoundingBox(features: Feature[]): [number, number, number, number] | null {
    let minLng = Infinity, minLat = Infinity;
    let maxLng = -Infinity, maxLat = -Infinity;

    const processCoords = (coords: unknown): void => {
      if (Array.isArray(coords)) {
        if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
          // Single coordinate: [lng, lat]
          const [lng, lat] = coords as [number, number];
          // Skip non-finite values (NaN, Infinity)
          if (Number.isFinite(lng) && Number.isFinite(lat)) {
            minLng = Math.min(minLng, lng);
            maxLng = Math.max(maxLng, lng);
            minLat = Math.min(minLat, lat);
            maxLat = Math.max(maxLat, lat);
          }
        } else {
          // Array of coordinates - recurse
          for (const c of coords) {
            processCoords(c);
          }
        }
      }
    };

    for (const feature of features) {
      if (feature.geometry?.coordinates) {
        processCoords(feature.geometry.coordinates);
      }
    }

    // Return null if no valid coordinates found
    if (!Number.isFinite(minLng) || !Number.isFinite(maxLng) ||
        !Number.isFinite(minLat) || !Number.isFinite(maxLat)) {
      return null;
    }
    return [minLng, minLat, maxLng, maxLat];
  }

  /**
   * Convert GeoPackage to GeoJSON using ogr2ogr
   */
  private async convertGeoPackageToGeoJSON(
    gpkgPath: string,
    layerName?: string,
    sourceCRS?: string
  ): Promise<string> {
    const dir = dirname(gpkgPath);
    const outputPath = join(dir, 'converted.geojson');

    // Build ogr2ogr command with robust options
    let cmd = `ogr2ogr -f GeoJSON`;

    // Add -makevalid to fix geometry issues (common with ArcGIS exports)
    cmd += ` -makevalid`;

    // Handle CRS transformation carefully
    // ArcGIS sometimes defines WGS 84 in non-standard ways that GDAL doesn't recognize
    if (sourceCRS && !this.isWGS84(sourceCRS)) {
      // Source is not WGS 84, need to transform
      cmd += ` -t_srs EPSG:4326 -s_srs ${sourceCRS}`;
    } else {
      // Source is WGS 84 or undefined - just assign the output CRS without transforming
      // This avoids reprojection failures when the source CRS definition is non-standard
      cmd += ` -a_srs EPSG:4326`;
    }

    cmd += ` "${outputPath}" "${gpkgPath}"`;

    if (layerName) {
      cmd += ` "${layerName}"`;
    }

    try {
      await execAsync(cmd);
      return outputPath;
    } catch (error) {
      console.error('Error converting GeoPackage:', error);
      throw new Error(`Failed to convert GeoPackage: ${error}`);
    }
  }

  /**
   * Transform GeoJSON CRS using ogr2ogr
   */
  private async transformGeoJSONCRS(
    geojsonPath: string,
    sourceCRS: string
  ): Promise<string> {
    const dir = dirname(geojsonPath);
    const outputPath = join(dir, 'transformed.geojson');

    // Add -makevalid to fix any geometry issues
    const cmd = `ogr2ogr -f GeoJSON -makevalid -t_srs EPSG:4326 -s_srs ${sourceCRS} "${outputPath}" "${geojsonPath}"`;

    try {
      await execAsync(cmd);
      return outputPath;
    } catch (error) {
      console.error('Error transforming GeoJSON CRS:', error);
      throw new Error(`Failed to transform CRS: ${error}`);
    }
  }

  /**
   * Validate GeoJSON file
   */
  async validateGeoJSON(versionId: string): Promise<ValidationResult> {
    const [version] = await db
      .select()
      .from(importVersions)
      .where(eq(importVersions.id, versionId));

    if (!version) {
      throw new Error(`Version ${versionId} not found`);
    }

    // Read GeoJSON file (should be converted already)
    const geojsonPath = version.filePath.endsWith('.geojson')
      ? version.filePath
      : join(dirname(version.filePath), 'converted.geojson');

    if (!existsSync(geojsonPath)) {
      throw new Error('GeoJSON file not found. Please configure the import first.');
    }

    const geojson = JSON.parse(readFileSync(geojsonPath, 'utf-8')) as FeatureCollection;
    const features = geojson.features || [];

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const geometryTypes = new Set<string>();
    let missingIdCount = 0;
    let missingDataSourceCount = 0;
    const seenIds = new Set<string>();

    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      const props = feature.properties || {};
      const featureId = props.id;

      // Track geometry types
      if (feature.geometry) {
        geometryTypes.add(feature.geometry.type);
      }

      // Validate: Missing geometry
      if (!feature.geometry) {
        errors.push({
          featureIndex: i,
          featureId,
          field: 'geometry',
          error: 'Missing geometry',
          hint: 'Each feature must have a valid geometry',
        });
        continue;
      }

      // Validate: Geometry type must be LineString for roads
      if (!VALID_ROAD_GEOMETRY_TYPES.includes(feature.geometry.type)) {
        errors.push({
          featureIndex: i,
          featureId,
          field: 'geometry',
          error: `Invalid geometry type: ${feature.geometry.type}`,
          hint: 'Roads must be LineString or MultiLineString. Convert polygons to centerlines in ArcGIS/QGIS before import.',
        });
      }

      // Validate: Missing ID (ERROR for incremental updates)
      if (!featureId) {
        missingIdCount++;
        errors.push({
          featureIndex: i,
          field: 'id',
          error: 'Missing id property',
          hint: 'Each feature must have an "id" property for incremental update. Add IDs in ArcGIS/QGIS.',
        });
      } else {
        // Validate: Duplicate IDs
        if (seenIds.has(featureId)) {
          errors.push({
            featureIndex: i,
            featureId,
            field: 'id',
            error: 'Duplicate id',
            hint: 'Feature IDs must be unique within the file. Check for duplicates.',
          });
        }
        seenIds.add(featureId);
      }

      // Validate: Invalid roadType
      if (props.roadType && !VALID_ROAD_TYPES.includes(props.roadType)) {
        errors.push({
          featureIndex: i,
          featureId,
          field: 'roadType',
          error: `Invalid roadType: ${props.roadType}`,
          hint: 'roadType must be one of: arterial, collector, local',
        });
      }

      // Warning: Missing dataSource (will use default)
      if (!props.dataSource) {
        missingDataSourceCount++;
      }

      // Warning: Coordinates outside Japan
      if (feature.geometry && feature.geometry.type === 'LineString') {
        const coords = (feature.geometry as LineString).coordinates;
        for (const coord of coords) {
          const [lng, lat] = coord;
          if (
            lng < JAPAN_BOUNDS.minLng ||
            lng > JAPAN_BOUNDS.maxLng ||
            lat < JAPAN_BOUNDS.minLat ||
            lat > JAPAN_BOUNDS.maxLat
          ) {
            warnings.push({
              featureIndex: i,
              featureId,
              message: `Coordinates outside Japan bounds (${lng.toFixed(4)}, ${lat.toFixed(4)})`,
            });
            break; // Only warn once per feature
          }
        }
      }
    }

    // Add summary warning for missing dataSource
    if (missingDataSourceCount > 0) {
      warnings.push({
        featureIndex: -1,
        message: `${missingDataSourceCount} features missing dataSource - will use default: ${version.defaultDataSource}`,
      });
    }

    const result: ValidationResult = {
      valid: errors.length === 0,
      featureCount: features.length,
      errors,
      warnings,
      geometryTypes: Array.from(geometryTypes),
      missingIdCount,
      missingDataSourceCount,
    };

    // Cache validation result
    const validationPath = join(dirname(version.filePath), 'validation.json');
    writeFileSync(validationPath, JSON.stringify(result, null, 2));

    return result;
  }

  /**
   * Get roads within the specified import scope
   */
  async getRoadsInScope(scope: string): Promise<RoadAsset[]> {
    if (scope === 'full') {
      return db.select().from(roadAssets).where(eq(roadAssets.status, 'active'));
    }

    if (scope.startsWith('ward:')) {
      const ward = scope.substring(5);
      return db
        .select()
        .from(roadAssets)
        .where(and(eq(roadAssets.status, 'active'), eq(roadAssets.ward, ward)));
    }

    if (scope.startsWith('bbox:')) {
      const [minLng, minLat, maxLng, maxLat] = scope.substring(5).split(',').map(Number);
      return db
        .select()
        .from(roadAssets)
        .where(
          and(
            eq(roadAssets.status, 'active'),
            sql`ST_Intersects(
              geometry,
              ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326)
            )`
          )
        );
    }

    return [];
  }

  /**
   * Get roads in scope with geometry as GeoJSON (for diff comparison)
   */
  async getRoadsInScopeWithGeometry(scope: string): Promise<{ id: string; name: string | null; roadType: string | null; ward: string | null; lanes: number | null; direction: string | null; geometryJson: Geometry | null }[]> {
    const baseSelect = {
      id: roadAssets.id,
      name: roadAssets.name,
      roadType: roadAssets.roadType,
      ward: roadAssets.ward,
      lanes: roadAssets.lanes,
      direction: roadAssets.direction,
      geometryJson: sql<Geometry | null>`ST_AsGeoJSON(${roadAssets.geometry})::json`.as('geometryJson'),
    };

    if (scope === 'full') {
      return db.select(baseSelect).from(roadAssets).where(eq(roadAssets.status, 'active'));
    }

    if (scope.startsWith('ward:')) {
      const ward = scope.substring(5);
      return db
        .select(baseSelect)
        .from(roadAssets)
        .where(and(eq(roadAssets.status, 'active'), eq(roadAssets.ward, ward)));
    }

    if (scope.startsWith('bbox:')) {
      const [minLng, minLat, maxLng, maxLat] = scope.substring(5).split(',').map(Number);
      return db
        .select(baseSelect)
        .from(roadAssets)
        .where(
          and(
            eq(roadAssets.status, 'active'),
            sql`ST_Intersects(
              geometry,
              ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326)
            )`
          )
        );
    }

    return [];
  }

  /**
   * Get roads by IDs with geometry for precise comparison
   * Used when sourceExportId is available - compares against exact roads from export
   * Returns ALL roads matching IDs regardless of status (active/inactive)
   * This is important because exports include all roads, and we need to compare
   * against all exported roads to correctly detect adds/updates/deactivations
   */
  async getRoadsByIds(roadIds: string[]): Promise<{ id: string; name: string | null; roadType: string | null; ward: string | null; lanes: number | null; direction: string | null; status: string | null; geometryJson: Geometry | null }[]> {
    if (roadIds.length === 0) return [];

    const baseSelect = {
      id: roadAssets.id,
      name: roadAssets.name,
      roadType: roadAssets.roadType,
      ward: roadAssets.ward,
      lanes: roadAssets.lanes,
      direction: roadAssets.direction,
      status: roadAssets.status,
      geometryJson: sql<Geometry | null>`ST_AsGeoJSON(${roadAssets.geometry})::json`.as('geometryJson'),
    };

    // Query roads by IDs - include ALL statuses (active AND inactive)
    // Export includes all roads, so comparison must also include all roads
    return db
      .select(baseSelect)
      .from(roadAssets)
      .where(inArray(roadAssets.id, roadIds));
  }

  /**
   * Generate diff between import file and current database
   * If sourceExportId exists, uses precise comparison against exported road IDs
   * Otherwise, falls back to bbox-based comparison
   */
  async generateDiff(versionId: string): Promise<DiffResult> {
    console.log('[Import] generateDiff starting for version:', versionId);
    const [version] = await db
      .select()
      .from(importVersions)
      .where(eq(importVersions.id, versionId));

    if (!version) {
      throw new Error(`Version ${versionId} not found`);
    }

    // Read import GeoJSON
    const geojsonPath = version.filePath.endsWith('.geojson')
      ? version.filePath
      : join(dirname(version.filePath), 'converted.geojson');

    const geojson = JSON.parse(readFileSync(geojsonPath, 'utf-8')) as FeatureCollection;
    const importFeatures = geojson.features || [];
    // Ensure IDs are always strings for consistent comparison
    const importIds = new Set(
      importFeatures
        .map(f => f.properties?.id)
        .filter(Boolean)
        .map(id => String(id))
    );

    // Determine comparison scope: precise (export record) or bbox
    let currentRoads: { id: string; name: string | null; roadType: string | null; ward: string | null; lanes: number | null; direction: string | null; status?: string | null; geometryJson: Geometry | null }[];
    let comparisonMode: 'precise' | 'bbox' | 'geometry';

    if (version.sourceExportId) {
      // Precise comparison using export record
      const [exportRecord] = await db
        .select()
        .from(exportRecords)
        .where(eq(exportRecords.id, version.sourceExportId));

      if (exportRecord && Array.isArray(exportRecord.roadIds)) {
        const exportedRoadIds = exportRecord.roadIds as string[];
        console.log('[Import] Using precise comparison against export record:', version.sourceExportId);
        console.log('[Import] Export contained', exportedRoadIds.length, 'roads');

        // Get roads by IDs from export record
        const exportRoads = await this.getRoadsByIds(exportedRoadIds);

        // IMPORTANT: Also check if any import file roads already exist in DB
        // This handles the case where a road was added in a previous import but
        // wasn't in the original export. Without this, it would always show as "added".
        const importIdArray = Array.from(importIds);
        const newIdsInImport = importIdArray.filter(id => !exportedRoadIds.includes(id));

        if (newIdsInImport.length > 0) {
          console.log('[Import] Checking', newIdsInImport.length, 'roads from import file that were not in original export');
          const existingNewRoads = await this.getRoadsByIds(newIdsInImport);
          console.log('[Import] Found', existingNewRoads.length, 'of them already in database');
          // Merge: export roads + any import roads that already exist in DB
          currentRoads = [...exportRoads, ...existingNewRoads];
        } else {
          currentRoads = exportRoads;
        }

        comparisonMode = 'precise';
        console.log('[Import] Found', currentRoads.length, 'roads from export (some may have been deleted)');
      } else {
        // Export record not found or invalid, fall back to bbox
        console.log('[Import] Export record not found, falling back to bbox comparison');
        currentRoads = await this.getRoadsInScopeWithGeometry(version.importScope);
        comparisonMode = 'bbox';
      }
    } else {
      // No source export, use bbox comparison
      console.log('[Import] Getting roads in scope:', version.importScope);
      currentRoads = await this.getRoadsInScopeWithGeometry(version.importScope);
      comparisonMode = 'bbox';
    }

    console.log('[Import] Comparison mode:', comparisonMode, '- found', currentRoads.length, 'roads to compare');
    const currentRoadMap = new Map(currentRoads.map(r => [r.id, r]));

    const added: Feature[] = [];
    const updated: Feature[] = [];
    let unchanged = 0;

    // Debug: log first few IDs from both sets with types and status
    const importIdsList = importFeatures.slice(0, 5).map(f => ({ id: f.properties?.id, type: typeof f.properties?.id }));
    const dbIdsList = currentRoads.slice(0, 5).map(r => ({ id: r.id, type: typeof r.id, status: r.status }));
    console.log('[Import] Sample import IDs (with types):', importIdsList);
    console.log('[Import] Sample DB roads (with types & status):', dbIdsList);
    console.log('[Import] Import ID set size:', importIds.size, '- DB road map size:', currentRoadMap.size);

    // Log any inactive roads in the comparison set
    const inactiveRoads = currentRoads.filter(r => r.status === 'inactive');
    if (inactiveRoads.length > 0) {
      console.log('[Import] Found', inactiveRoads.length, 'inactive roads in comparison set:', inactiveRoads.map(r => r.id));
    }

    // Check each import feature
    for (const feature of importFeatures) {
      const rawId = feature.properties?.id;
      if (!rawId) continue;
      const id = String(rawId);  // Ensure string for consistent comparison

      const existing = currentRoadMap.get(id);
      if (!existing) {
        // New road - log it for debugging
        console.log('[Import] Road marked as ADDED (not in DB):', id);
        added.push(feature);
      } else {
        // Check if changed (properties or geometry)
        try {
          const hasChanges = this.hasFeatureChanges(feature, existing);
          if (hasChanges) {
            updated.push(feature);
          } else {
            unchanged++;
          }
        } catch (error) {
          console.error('[Import] Error comparing feature:', id, error);
          // Treat as unchanged if comparison fails
          unchanged++;
        }
      }
    }

    // ============================================================
    // SELF-COMPARISON MODE (Priority 1):
    // Check if a previous import version has the same feature IDs.
    // If found, compare the current import against the previous version's file.
    // This gives 100% accuracy for export→edit→reimport workflows.
    // ============================================================
    let geometryMatchCount = 0;
    const geometryMatchedDbIds = new Set<string>();
    let baselineFeatures: Feature[] | null = null;

    if (added.length > 0) {
      const baselineResult = await this.findBaselineVersion(versionId, importFeatures);

      if (baselineResult) {
        console.log('[Import] Self-comparison: found baseline version', baselineResult.versionId, 'with', baselineResult.features.length, 'features');
        comparisonMode = 'geometry';  // Using 'geometry' mode label for self-comparison
        baselineFeatures = baselineResult.features;

        // Build baseline feature map by ID
        const baselineMap = new Map<string, Feature>();
        for (const f of baselineResult.features) {
          const fId = f.properties?.id;
          if (fId) baselineMap.set(String(fId), f);
        }

        // Re-evaluate "added" features against baseline
        const remainingAdded: Feature[] = [];
        for (const feature of added) {
          const id = String(feature.properties?.id || '');
          const baseline = baselineMap.get(id);

          if (!baseline) {
            // Genuinely new feature (not in baseline)
            remainingAdded.push(feature);
          } else {
            // Feature exists in baseline - check if changed
            const hasGeomChange = feature.geometry && baseline.geometry
              ? !this.geometriesEqual(feature.geometry, baseline.geometry)
              : false;
            const hasPropChange = this.hasBaselinePropertyChanges(feature, baseline);

            if (hasGeomChange || hasPropChange) {
              updated.push(feature);
              geometryMatchCount++;
            } else {
              unchanged++;
              geometryMatchCount++;
            }
          }
        }

        // Features in baseline but not in current import = would be removed
        // (only relevant if features were deleted from the file)
        const currentIds = new Set(importFeatures.map(f => String(f.properties?.id || '')).filter(Boolean));
        let baselineOnlyCount = 0;
        for (const [baseId] of baselineMap) {
          if (!currentIds.has(baseId)) {
            baselineOnlyCount++;
          }
        }
        if (baselineOnlyCount > 0) {
          console.log('[Import] Self-comparison:', baselineOnlyCount, 'features in baseline but not in current import');
        }

        added.length = 0;
        added.push(...remainingAdded);
        console.log('[Import] Self-comparison result: added=', added.length, 'updated=', updated.length, 'unchanged=', unchanged);

      }

      if (added.length > 0 && currentRoads.length > 0) {
        // ============================================================
        // GEOMETRY MATCHING (Priority 2):
        // Always run for unmatched features (no threshold).
        // Two passes: exact geometry, then fuzzy (start/end + length + attributes).
        // ============================================================
        if (baselineResult) {
          console.log('[Import] Self-comparison left', added.length, 'unmatched features - running geometry matching against', currentRoads.length, 'DB roads');
        } else {
          console.log('[Import] No baseline found. Running geometry matching for', added.length, 'unmatched features against', currentRoads.length, 'DB roads');
        }

        // --- Pass 1: Exact geometry matching ---
        const GRID_RESOLUTION = 10000;
        const spatialIndex = new Map<string, typeof currentRoads>();
        for (const road of currentRoads) {
          if (!road.geometryJson) continue;
          const startCoord = this.getStartCoordinate(road.geometryJson);
          if (!startCoord) continue;
          const gx = Math.round(startCoord[0] * GRID_RESOLUTION);
          const gy = Math.round(startCoord[1] * GRID_RESOLUTION);
          const key = `${gx},${gy}`;
          if (!spatialIndex.has(key)) spatialIndex.set(key, []);
          spatialIndex.get(key)!.push(road);
        }

        const afterExact: Feature[] = [];
        let exactCount = 0;
        for (const feature of added) {
          if (!feature.geometry) { afterExact.push(feature); continue; }
          const startCoord = this.getStartCoordinate(feature.geometry);
          if (!startCoord) { afterExact.push(feature); continue; }

          const gx = Math.round(startCoord[0] * GRID_RESOLUTION);
          const gy = Math.round(startCoord[1] * GRID_RESOLUTION);
          let matched = false;
          for (let dx = -1; dx <= 1 && !matched; dx++) {
            for (let dy = -1; dy <= 1 && !matched; dy++) {
              const candidates = spatialIndex.get(`${gx + dx},${gy + dy}`);
              if (!candidates) continue;
              for (const candidate of candidates) {
                if (geometryMatchedDbIds.has(candidate.id) || !candidate.geometryJson) continue;
                if (this.geometriesEqual(feature.geometry, candidate.geometryJson)) {
                  geometryMatchedDbIds.add(candidate.id);
                  exactCount++;
                  geometryMatchCount++;
                  const hasChanges = this.hasFeatureChanges(feature, candidate);
                  if (hasChanges) {
                    updated.push({ ...feature, properties: { ...feature.properties, _matchedDbId: candidate.id } });
                  } else {
                    unchanged++;
                  }
                  matched = true;
                  break;
                }
              }
            }
          }
          if (!matched) afterExact.push(feature);
        }
        if (exactCount > 0) console.log('[Import] Exact geometry: matched', exactCount);

        // --- Pass 2: Fuzzy geometry + attribute matching ---
        const FUZZY_TOLERANCE = 0.0005; // ~50m
        const FUZZY_GRID = 1000;
        const fuzzyIndex = new Map<string, typeof currentRoads>();
        for (const road of currentRoads) {
          if (geometryMatchedDbIds.has(road.id) || !road.geometryJson) continue;
          const sc = this.getStartCoordinate(road.geometryJson);
          if (!sc) continue;
          const key = `${Math.round(sc[0] * FUZZY_GRID)},${Math.round(sc[1] * FUZZY_GRID)}`;
          if (!fuzzyIndex.has(key)) fuzzyIndex.set(key, []);
          fuzzyIndex.get(key)!.push(road);
        }

        const afterFuzzy: Feature[] = [];
        let fuzzyCount = 0;
        for (const feature of afterExact) {
          if (!feature.geometry) { afterFuzzy.push(feature); continue; }
          const startCoord = this.getStartCoordinate(feature.geometry);
          const endCoord = this.getEndCoordinate(feature.geometry);
          const lineLen = this.getGeometryLength(feature.geometry);
          if (!startCoord || !endCoord || lineLen === 0) { afterFuzzy.push(feature); continue; }

          const gx = Math.round(startCoord[0] * FUZZY_GRID);
          const gy = Math.round(startCoord[1] * FUZZY_GRID);
          const props = feature.properties || {};

          let bestCandidate: (typeof currentRoads)[number] | null = null;
          let bestScore = 0;

          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              const candidates = fuzzyIndex.get(`${gx + dx},${gy + dy}`);
              if (!candidates) continue;
              for (const candidate of candidates) {
                if (geometryMatchedDbIds.has(candidate.id) || !candidate.geometryJson) continue;
                const cStart = this.getStartCoordinate(candidate.geometryJson);
                const cEnd = this.getEndCoordinate(candidate.geometryJson);
                const cLen = this.getGeometryLength(candidate.geometryJson);
                if (!cStart || !cEnd || cLen === 0) continue;

                // Start/end proximity check
                const startDist = Math.max(Math.abs(startCoord[0] - cStart[0]), Math.abs(startCoord[1] - cStart[1]));
                const endDist = Math.max(Math.abs(endCoord[0] - cEnd[0]), Math.abs(endCoord[1] - cEnd[1]));
                if (startDist > FUZZY_TOLERANCE || endDist > FUZZY_TOLERANCE) continue;

                // Length similarity
                const ratio = lineLen / cLen;
                if (ratio < 0.5 || ratio > 2.0) continue;

                // Score: proximity + length similarity + attribute matches
                let score = 1.0;
                score += (1.0 - startDist / FUZZY_TOLERANCE) * 0.3;
                score += (1.0 - endDist / FUZZY_TOLERANCE) * 0.3;
                score += (1.0 - Math.abs(1.0 - ratio)) * 0.2;

                // Attribute bonuses
                if (props.roadType && props.roadType === candidate.roadType) score += 0.5;
                if (props.name && props.name === candidate.name) score += 0.5;
                if (props.ward && props.ward === candidate.ward) score += 0.2;

                if (score > bestScore) {
                  bestScore = score;
                  bestCandidate = candidate;
                }
              }
            }
          }

          if (bestCandidate && bestScore >= 1.0) {
            geometryMatchedDbIds.add(bestCandidate.id);
            fuzzyCount++;
            geometryMatchCount++;
            updated.push({ ...feature, properties: { ...feature.properties, _matchedDbId: bestCandidate.id } });
          } else {
            afterFuzzy.push(feature);
          }
        }
        if (fuzzyCount > 0) console.log('[Import] Fuzzy+attribute: matched', fuzzyCount, 'more');

        added.length = 0;
        added.push(...afterFuzzy);

        if (geometryMatchCount > 0) {
          console.log('[Import] Total geometry matched:', geometryMatchCount, ', remaining added:', added.length);
          comparisonMode = 'geometry';
        }
      }
    }

    // Roads in scope but not in import = will be deactivated
    // Always compute this for preview, but only actually deactivate if regionalRefresh is enabled
    // IMPORTANT: Only show roads that are STILL ACTIVE as "deactivated"
    // If a road was already deactivated in a previous import, don't show it again
    const deactivated: Feature[] = [];
    if (baselineFeatures) {
      const currentIds = new Set(
        importFeatures
          .map(f => f.properties?.id)
          .filter(Boolean)
          .map(id => String(id))
      );
      for (const feature of baselineFeatures) {
        const baseId = feature.properties?.id;
        if (!baseId || !feature.geometry) continue;
        const baseIdStr = String(baseId);
        if (currentIds.has(baseIdStr)) continue;
        deactivated.push({
          type: 'Feature',
          geometry: feature.geometry,
          properties: {
            id: baseId,
            name: feature.properties?.name ?? null,
            roadType: feature.properties?.roadType ?? null,
            ward: feature.properties?.ward ?? null,
          },
        });
      }
    } else {
      for (const road of currentRoads) {
        const roadIdStr = String(road.id);  // Ensure string for consistent comparison
        // Skip roads that were matched by geometry (they're accounted for in updated/unchanged)
        if (geometryMatchedDbIds.has(roadIdStr)) continue;
        if (!importIds.has(roadIdStr)) {
          // Only show as deactivated if the road is still active
          // This prevents showing already-inactive roads as "removed" on repeated imports
          if (road.status === 'inactive') {
            continue;
          }
          deactivated.push({
            type: 'Feature',
            geometry: road.geometryJson as Geometry,
            properties: {
              id: road.id,
              name: road.name,
              roadType: road.roadType,
              ward: road.ward,
            },
          });
        }
      }
    }

    return {
      scope: version.importScope,
      regionalRefresh: version.regionalRefresh,
      comparisonMode,
      ...(comparisonMode === 'precise' && version.sourceExportId ? { sourceExportId: version.sourceExportId } : {}),
      added,
      updated,
      deactivated,
      unchanged,
      stats: {
        scopeCurrentCount: currentRoads.length,
        importCount: importFeatures.length,
        addedCount: added.length,
        updatedCount: updated.length,
        deactivatedCount: deactivated.length,
        ...(geometryMatchCount > 0 ? { geometryMatchCount } : {}),
      },
    };
  }

  /**
   * Find a previous import version to use as a baseline for self-comparison.
   */
  private async findBaselineVersion(
    currentVersionId: string,
    importFeatures: Feature[]
  ): Promise<{ versionId: string; features: Feature[] } | null> {
    const importIds = new Set(
      importFeatures
        .map(f => f.properties?.id)
        .filter(Boolean)
        .map(id => String(id))
    );

    if (importIds.size === 0) {
      return null;
    }

    const candidates = await db
      .select({
        id: importVersions.id,
        filePath: importVersions.filePath,
        uploadedAt: importVersions.uploadedAt,
      })
      .from(importVersions)
      .where(and(
        not(eq(importVersions.id, currentVersionId)),
        not(eq(importVersions.status, 'rolled_back'))
      ))
      .orderBy(desc(importVersions.uploadedAt));

    let bestMatch: { versionId: string; features: Feature[]; matchRate: number; overlap: number } | null = null;

    for (const candidate of candidates) {
      const geojsonPath = candidate.filePath.endsWith('.geojson')
        ? candidate.filePath
        : join(dirname(candidate.filePath), 'converted.geojson');

      if (!existsSync(geojsonPath)) {
        continue;
      }

      let geojson: FeatureCollection;
      try {
        geojson = JSON.parse(readFileSync(geojsonPath, 'utf-8')) as FeatureCollection;
      } catch (error) {
        console.warn('[Import] Failed to read baseline GeoJSON for', candidate.id, error);
        continue;
      }

      const features = geojson.features || [];
      if (features.length === 0) continue;

      const baselineIds = new Set(
        features
          .map(f => f.properties?.id)
          .filter(Boolean)
          .map(id => String(id))
      );

      if (baselineIds.size === 0) continue;

      let overlap = 0;
      for (const id of importIds) {
        if (baselineIds.has(id)) overlap++;
      }

      const matchRate = overlap / importIds.size;
      if (matchRate > 0.5) {
        if (!bestMatch || matchRate > bestMatch.matchRate || (matchRate === bestMatch.matchRate && overlap > bestMatch.overlap)) {
          bestMatch = { versionId: candidate.id, features, matchRate, overlap };
        }
      }
    }

    if (!bestMatch) {
      return null;
    }

    return { versionId: bestMatch.versionId, features: bestMatch.features };
  }

  private hasBaselinePropertyChanges(current: Feature, baseline: Feature): boolean {
    const currentProps = current.properties || {};
    const baselineProps = baseline.properties || {};
    const fields = ['roadType', 'lanes', 'direction', 'name', 'ward', 'dataSource', 'status'];

    for (const field of fields) {
      if (currentProps[field] !== baselineProps[field]) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a feature has changes compared to existing road
   */
  private hasFeatureChanges(
    feature: Feature,
    existing: { name: string | null; roadType: string | null; ward: string | null; lanes: number | null; direction: string | null; geometryJson: Geometry | null }
  ): boolean {
    const props = feature.properties || {};

    // Compare key fields
    if (props.name !== undefined && props.name !== existing.name) return true;
    if (props.roadType !== undefined && props.roadType !== existing.roadType) return true;
    if (props.ward !== undefined && props.ward !== existing.ward) return true;
    if (props.lanes !== undefined && props.lanes !== existing.lanes) return true;
    if (props.direction !== undefined && props.direction !== existing.direction) return true;

    // Compare geometry
    if (feature.geometry && existing.geometryJson) {
      if (!this.geometriesEqual(feature.geometry, existing.geometryJson)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Compare two geometries for equality (with tolerance for floating point precision)
   */
  private geometriesEqual(geom1: Geometry, geom2: Geometry): boolean {
    // Tolerance for coordinate comparison (roughly 1 meter precision)
    // GIS exports often have precision differences in the 6th-7th decimal place
    const TOLERANCE = 0.00001;

    const coordsEqual = (c1: number[], c2: number[]): boolean => {
      if (c1.length !== c2.length) return false;
      for (let i = 0; i < c1.length; i++) {
        if (Math.abs(c1[i] - c2[i]) > TOLERANCE) return false;
      }
      return true;
    };

    const lineEqual = (line1: number[][], line2: number[][]): boolean => {
      if (line1.length !== line2.length) return false;
      for (let i = 0; i < line1.length; i++) {
        if (!coordsEqual(line1[i], line2[i])) return false;
      }
      return true;
    };

    // Normalize: extract LineString coordinates from both geometries
    // This handles the case where DB has LineString and import has MultiLineString
    const getLineCoords = (geom: Geometry): number[][] | null => {
      if (geom.type === 'LineString') {
        return (geom as LineString).coordinates;
      }
      if (geom.type === 'MultiLineString') {
        const coords = (geom as MultiLineString).coordinates;
        // If MultiLineString has only one line, treat it as LineString
        if (coords.length === 1) {
          return coords[0];
        }
        // If multiple lines, flatten them for comparison
        return coords.flat();
      }
      return null;
    };

    const line1 = getLineCoords(geom1);
    const line2 = getLineCoords(geom2);

    // If both can be represented as line coordinates, compare them
    if (line1 && line2) {
      return lineEqual(line1, line2);
    }

    // For MultiLineString with multiple lines, do full comparison
    if (geom1.type === 'MultiLineString' && geom2.type === 'MultiLineString') {
      const coords1 = (geom1 as MultiLineString).coordinates;
      const coords2 = (geom2 as MultiLineString).coordinates;
      if (coords1.length !== coords2.length) return false;
      for (let i = 0; i < coords1.length; i++) {
        if (!lineEqual(coords1[i], coords2[i])) return false;
      }
      return true;
    }

    // Fallback: JSON string comparison (less precise but works for other types)
    return JSON.stringify(geom1) === JSON.stringify(geom2);
  }

  /**
   * Get the start coordinate (first point) of a geometry for spatial indexing
   */
  private getStartCoordinate(geom: Geometry): [number, number] | null {
    if (geom.type === 'LineString') {
      const coords = (geom as LineString).coordinates;
      if (coords.length > 0) return [coords[0][0], coords[0][1]];
    }
    if (geom.type === 'MultiLineString') {
      const coords = (geom as MultiLineString).coordinates;
      if (coords.length > 0 && coords[0].length > 0) return [coords[0][0][0], coords[0][0][1]];
    }
    return null;
  }

  /**
   * Get the end coordinate (last point) of a geometry for fuzzy matching
   */
  private getEndCoordinate(geom: Geometry): [number, number] | null {
    if (geom.type === 'LineString') {
      const coords = (geom as LineString).coordinates;
      if (coords.length > 0) {
        const last = coords[coords.length - 1];
        return [last[0], last[1]];
      }
    }
    if (geom.type === 'MultiLineString') {
      const coords = (geom as MultiLineString).coordinates;
      if (coords.length > 0) {
        const lastLine = coords[coords.length - 1];
        if (lastLine.length > 0) {
          const last = lastLine[lastLine.length - 1];
          return [last[0], last[1]];
        }
      }
    }
    return null;
  }

  /**
   * Get approximate length of a geometry (sum of segment distances)
   */
  private getGeometryLength(geom: Geometry): number {
    const segmentLength = (coords: number[][]): number => {
      let len = 0;
      for (let i = 1; i < coords.length; i++) {
        const dx = coords[i][0] - coords[i - 1][0];
        const dy = coords[i][1] - coords[i - 1][1];
        len += Math.sqrt(dx * dx + dy * dy);
      }
      return len;
    };

    if (geom.type === 'LineString') {
      return segmentLength((geom as LineString).coordinates);
    }
    if (geom.type === 'MultiLineString') {
      let total = 0;
      for (const line of (geom as MultiLineString).coordinates) {
        total += segmentLength(line);
      }
      return total;
    }
    return 0;
  }

  /**
   * Build SQL condition for filtering roads by scope
   */
  private buildScopeCondition(scope: string) {
    if (scope === 'full') {
      return eq(roadAssets.status, 'active');
    }
    if (scope.startsWith('ward:')) {
      const ward = scope.substring(5);
      return and(eq(roadAssets.status, 'active'), eq(roadAssets.ward, ward));
    }
    if (scope.startsWith('bbox:')) {
      const [minLng, minLat, maxLng, maxLat] = scope.substring(5).split(',').map(Number);
      return and(
        eq(roadAssets.status, 'active'),
        sql`ST_Intersects(${roadAssets.geometry}, ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326))`
      );
    }
    // Default fallback
    return eq(roadAssets.status, 'active');
  }

  /**
   * Build SQL condition for snapshots - includes ALL roads regardless of status
   * This ensures rollback can restore inactive roads and properly deactivate added roads
   */
  private buildSnapshotScopeCondition(scope: string) {
    if (scope === 'full') {
      return sql`1=1`;  // All roads in database
    }
    if (scope.startsWith('ward:')) {
      const ward = scope.substring(5);
      return eq(roadAssets.ward, ward);
    }
    if (scope.startsWith('bbox:')) {
      const [minLng, minLat, maxLng, maxLat] = scope.substring(5).split(',').map(Number);
      return sql`ST_Intersects(${roadAssets.geometry}, ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326))`;
    }
    // Default fallback - all roads
    return sql`1=1`;
  }

  /**
   * Create pre-publish snapshot of roads in scope
   * IMPORTANT: Captures ALL roads (active + inactive) to enable proper rollback
   */
  async createSnapshot(versionId: string, scope: string): Promise<string> {
    // Export roads to GeoJSON with geometry - includes ALL roads in scope (not just active)
    // This ensures rollback can restore inactive roads and deactivate roads added later
    const roadsWithGeom = await db
      .select({
        id: roadAssets.id,
        name: roadAssets.name,
        nameJa: roadAssets.nameJa,
        displayName: roadAssets.displayName,
        geometry: fromGeomSql(roadAssets.geometry),
        roadType: roadAssets.roadType,
        lanes: roadAssets.lanes,
        width: roadAssets.width,
        direction: roadAssets.direction,
        status: roadAssets.status,
        ward: roadAssets.ward,
        dataSource: roadAssets.dataSource,
        validFrom: roadAssets.validFrom,
        validTo: roadAssets.validTo,
        updatedAt: roadAssets.updatedAt,
      })
      .from(roadAssets)
      .where(this.buildSnapshotScopeCondition(scope));

    const features: Feature[] = roadsWithGeom.map(road => ({
      type: 'Feature',
      geometry: road.geometry as Geometry,
      properties: {
        id: road.id,
        name: road.name,
        nameJa: road.nameJa,
        displayName: road.displayName,
        roadType: road.roadType,
        lanes: road.lanes,
        width: road.width,
        direction: road.direction,
        status: road.status,
        ward: road.ward,
        dataSource: road.dataSource,
        validFrom: road.validFrom?.toISOString(),
        validTo: road.validTo?.toISOString() || null,
        updatedAt: road.updatedAt.toISOString(),
      },
    }));

    const geojson: FeatureCollection = {
      type: 'FeatureCollection',
      features,
    };

    const snapshotId = `RAS-${nanoid(8)}`;
    const snapshotPath = join(SNAPSHOTS_DIR, `${snapshotId}.geojson`);
    writeFileSync(snapshotPath, JSON.stringify(geojson));

    return snapshotPath;
  }

  /**
   * Publish import version (incremental update)
   * - Requires validation to pass before publishing
   * - Wrapped in transaction for atomicity
   * - Uses diff results for accurate counts
   */
  async publishVersion(
    versionId: string,
    publishedBy?: string,
    onProgress?: (percent: number) => Promise<void>
  ): Promise<PublishResult> {
    const [version] = await db
      .select()
      .from(importVersions)
      .where(eq(importVersions.id, versionId));

    if (!version) {
      throw new Error(`Version ${versionId} not found`);
    }

    if (version.status !== 'draft') {
      throw new Error(`Version ${versionId} is not in draft status`);
    }

    // 1. Require validation to pass before publishing
    await onProgress?.(15);
    const validationResult = await this.validateGeoJSON(versionId);
    if (!validationResult.valid) {
      throw new Error(`Cannot publish: ${validationResult.errors.length} validation errors. Fix errors and re-validate.`);
    }

    // 2. Generate diff to get accurate counts of what will change
    await onProgress?.(25);
    const diff = await this.generateDiff(versionId);

    // 2.5. Save diff for historical viewing
    let diffPath: string | null = null;
    try {
      const diffFileName = `${versionId}.json`;
      const diffFullPath = join(DIFFS_DIR, diffFileName);
      writeFileSync(diffFullPath, JSON.stringify(diff, null, 2));
      // Store relative path for portability
      diffPath = `uploads/import-diffs/${diffFileName}`;
      console.log('[Import] Saved diff for historical viewing:', diffPath);
    } catch (err) {
      // Log warning but don't block publish - historical view is optional
      console.warn(`[Import] Failed to save diff for version ${versionId}:`, err);
    }

    // 3. Create snapshot before publishing (outside transaction for file I/O)
    await onProgress?.(45);
    const snapshotPath = await this.createSnapshot(versionId, version.importScope);

    // 4. Read import GeoJSON
    const geojsonPath = version.filePath.endsWith('.geojson')
      ? version.filePath
      : join(dirname(version.filePath), 'converted.geojson');
    const geojson = JSON.parse(readFileSync(geojsonPath, 'utf-8')) as FeatureCollection;

    // Build lookup for import features by ID
    const importFeatureMap = new Map<string, Feature>();
    for (const feature of geojson.features || []) {
      const id = feature.properties?.id;
      if (id) importFeatureMap.set(id, feature);
    }

    const now = new Date();

    // 5. Execute all DB operations in a transaction
    await onProgress?.(60);
    await db.transaction(async (tx) => {
      // Process added features - use UPSERT to handle case where road already exists
      // (e.g., added in a previous import but then re-imported with same file)
      for (const feature of diff.added) {
        const id = feature.properties?.id;
        if (!id) continue;
        const props = feature.properties || {};

        await tx.execute(sql`
          INSERT INTO road_assets (
            id, name, name_ja, display_name, geometry, road_type, lanes, direction,
            status, valid_from, ward, data_source, updated_at
          ) VALUES (
            ${id},
            ${props.name || null},
            ${props.nameJa || null},
            ${props.displayName || props.name || null},
            ${toGeomSql(feature.geometry)},
            ${props.roadType || 'local'},
            ${props.lanes || 2},
            ${props.direction || 'both'},
            'active',
            ${now},
            ${props.ward || null},
            ${props.dataSource || version.defaultDataSource},
            ${now}
          )
          ON CONFLICT (id) DO UPDATE SET
            geometry = EXCLUDED.geometry,
            name = COALESCE(EXCLUDED.name, road_assets.name),
            name_ja = COALESCE(EXCLUDED.name_ja, road_assets.name_ja),
            display_name = COALESCE(EXCLUDED.display_name, road_assets.display_name),
            road_type = COALESCE(EXCLUDED.road_type, road_assets.road_type),
            lanes = COALESCE(EXCLUDED.lanes, road_assets.lanes),
            direction = COALESCE(EXCLUDED.direction, road_assets.direction),
            status = 'active',
            ward = COALESCE(EXCLUDED.ward, road_assets.ward),
            data_source = COALESCE(EXCLUDED.data_source, road_assets.data_source),
            updated_at = EXCLUDED.updated_at
        `);
      }

      // Process updated features (only those that actually changed)
      // Also reactivate any inactive roads that are in the import file
      for (const feature of diff.updated) {
        const id = feature.properties?.id;
        if (!id) continue;
        const props = feature.properties || {};

        // Use _matchedDbId for geometry-matched features (cross-environment imports)
        // where the import feature ID differs from the existing DB road ID
        const dbId = props._matchedDbId || id;

        await tx.execute(sql`
          UPDATE road_assets
          SET geometry = ${toGeomSql(feature.geometry)},
              name = COALESCE(${props.name ?? null}, name),
              road_type = COALESCE(${props.roadType ?? null}, road_type),
              lanes = COALESCE(${props.lanes ?? null}, lanes),
              direction = COALESCE(${props.direction ?? null}, direction),
              ward = COALESCE(${props.ward ?? null}, ward),
              data_source = COALESCE(${props.dataSource ?? null}, data_source),
              status = 'active',
              updated_at = ${now}
          WHERE id = ${dbId}
        `);
      }

      // Process deactivated features
      // - In PRECISE mode: always deactivate (we know exactly what was in the original export,
      //   so missing roads were intentionally removed by the user)
      // - In BBOX mode: only deactivate if regionalRefresh is enabled (safety feature)
      const shouldDeactivate = diff.comparisonMode === 'precise' || version.regionalRefresh;
      if (shouldDeactivate && diff.deactivated.length > 0) {
        console.log(`[Import] Deactivating ${diff.deactivated.length} roads (mode: ${diff.comparisonMode}, regionalRefresh: ${version.regionalRefresh})`);
        for (const feature of diff.deactivated) {
          const id = feature.properties?.id;
          if (!id) continue;

          await tx
            .update(roadAssets)
            .set({ status: 'inactive', updatedAt: now })
            .where(eq(roadAssets.id, id));
        }
      }

      // Archive previous published version
      await tx
        .update(importVersions)
        .set({ status: 'archived', archivedAt: now })
        .where(and(eq(importVersions.status, 'published'), not(eq(importVersions.id, versionId))));

      // Update version to published with stats for timeline display
      await tx
        .update(importVersions)
        .set({
          status: 'published',
          publishedAt: now,
          publishedBy: publishedBy || null,
          snapshotPath,
          diffPath,
          // Save stats for timeline display
          addedCount: diff.stats.addedCount,
          updatedCount: diff.stats.updatedCount,
          deactivatedCount: diff.stats.deactivatedCount,
        })
        .where(eq(importVersions.id, versionId));
    });

    await onProgress?.(95);

    return {
      success: true,
      added: diff.stats.addedCount,
      updated: diff.stats.updatedCount,
      deactivated: version.regionalRefresh ? diff.stats.deactivatedCount : 0,
      unchanged: diff.unchanged,
      snapshotPath,
      publishedAt: now.toISOString(),
      scope: version.importScope,
    };
  }

  /**
   * Rollback to a version's snapshot
   * - Reads snapshot file BEFORE transaction (file I/O outside transaction)
   * - All DB operations wrapped in transaction for atomicity
   * - Restores all roads from snapshot (including status)
   * - Deactivates roads added after snapshot was taken (not in snapshot)
   */
  async rollbackToVersion(versionId: string): Promise<RollbackResult> {
    // 1. Fetch version info OUTSIDE transaction
    const [version] = await db
      .select()
      .from(importVersions)
      .where(eq(importVersions.id, versionId));

    if (!version || !version.snapshotPath) {
      throw new Error(`Version ${versionId} not found or has no snapshot`);
    }

    if (!existsSync(version.snapshotPath)) {
      throw new Error(`Snapshot file not found: ${version.snapshotPath}`);
    }

    // 2. Read snapshot file BEFORE transaction (file I/O)
    const snapshot = JSON.parse(readFileSync(version.snapshotPath, 'utf-8')) as FeatureCollection;
    const features = snapshot.features || [];

    // Get IDs of all roads in snapshot (for deactivation logic)
    const snapshotIds = features
      .map(f => f.properties?.id)
      .filter((id): id is string => !!id);

    const now = new Date();

    // 3. Execute all DB operations in a transaction
    const result = await db.transaction(async (tx) => {
      let restored = 0;

      // UPSERT each feature from snapshot (restore to exact state)
      for (const feature of features) {
        const props = feature.properties || {};
        const id = props.id;
        if (!id) continue;

        // Use raw SQL for UPSERT with geometry
        // Restore validTo as well for inactive roads
        await tx.execute(sql`
          INSERT INTO road_assets (
            id, name, name_ja, display_name, geometry, road_type, lanes, direction,
            status, valid_from, valid_to, ward, data_source, updated_at
          ) VALUES (
            ${id},
            ${props.name || null},
            ${props.nameJa || null},
            ${props.displayName || null},
            ${toGeomSql(feature.geometry)},
            ${props.roadType || 'local'},
            ${props.lanes || 2},
            ${props.direction || 'both'},
            ${props.status || 'active'},
            ${props.validFrom ? new Date(props.validFrom) : now},
            ${props.validTo ? new Date(props.validTo) : null},
            ${props.ward || null},
            ${props.dataSource || 'manual'},
            ${now}
          )
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            name_ja = EXCLUDED.name_ja,
            display_name = EXCLUDED.display_name,
            geometry = EXCLUDED.geometry,
            road_type = EXCLUDED.road_type,
            lanes = EXCLUDED.lanes,
            direction = EXCLUDED.direction,
            status = EXCLUDED.status,
            valid_to = EXCLUDED.valid_to,
            ward = EXCLUDED.ward,
            data_source = EXCLUDED.data_source,
            updated_at = ${now}
        `);
        restored++;
      }

      // 4. Deactivate roads in scope that are NOT in snapshot
      // These are roads added after this version was published
      const scopeCondition = this.buildSnapshotScopeCondition(version.importScope);

      if (snapshotIds.length > 0) {
        // Deactivate active roads in scope that are NOT in snapshot
        console.log('[Rollback] Deactivating roads not in snapshot (scope:', version.importScope, ')');
        const deactivatedResult = await tx
          .update(roadAssets)
          .set({
            status: 'inactive',
            validTo: now,
            updatedAt: now,
          })
          .where(
            and(
              scopeCondition,
              not(inArray(roadAssets.id, snapshotIds)),
              eq(roadAssets.status, 'active')
            )
          )
          .returning({ id: roadAssets.id });
        console.log('[Rollback] Deactivated', deactivatedResult.length, 'roads not in snapshot');
      } else {
        // Empty snapshot - deactivate ALL active roads in scope
        // This handles the case where we're rolling back to a state with no roads
        console.log('[Rollback] Empty snapshot - deactivating all active roads in scope');
        await tx
          .update(roadAssets)
          .set({
            status: 'inactive',
            validTo: now,
            updatedAt: now,
          })
          .where(
            and(
              scopeCondition,
              eq(roadAssets.status, 'active')
            )
          );
      }

      // 5. Soft delete: Mark versions with higher version numbers as 'rolled_back'
      // This keeps them visible in the timeline for historical reference
      console.log('[Rollback] Marking versions as rolled_back with versionNumber >', version.versionNumber);
      const rolledBackResult = await tx
        .update(importVersions)
        .set({
          status: 'rolled_back',
          rolledBackAt: now,
        })
        .where(
          and(
            gt(importVersions.versionNumber, version.versionNumber),
            not(eq(importVersions.status, 'rolled_back')) // Don't re-mark already rolled back versions
          )
        )
        .returning({ id: importVersions.id, versionNumber: importVersions.versionNumber });
      console.log('[Rollback] Marked as rolled_back:', rolledBackResult);

      // Archive other published versions (those not being rolled back)
      await tx
        .update(importVersions)
        .set({ status: 'archived', archivedAt: now })
        .where(
          and(
            eq(importVersions.status, 'published'),
            not(eq(importVersions.id, versionId))
          )
        );

      // Set target version as published (restore it)
      await tx
        .update(importVersions)
        .set({ status: 'published', publishedAt: now })
        .where(eq(importVersions.id, versionId));

      return { restored };
    });

    return {
      success: true,
      restored: result.restored,
      snapshotPath: version.snapshotPath,
      rolledBackAt: now.toISOString(),
    };
  }

  /**
   * Create a job record for async operations
   */
  async createJob(
    versionId: string,
    jobType: 'validation' | 'publish' | 'rollback'
  ): Promise<ImportJob> {
    const jobId = `IJ-${nanoid(8)}`;

    const newJob: NewImportJob = {
      id: jobId,
      versionId,
      jobType,
      status: 'pending',
      progress: 0,
    };

    await db.insert(importJobs).values(newJob);

    const [job] = await db.select().from(importJobs).where(eq(importJobs.id, jobId));
    return job;
  }

  /**
   * Update job progress
   */
  async updateJobProgress(
    jobId: string,
    progress: number,
    status?: 'running' | 'completed' | 'failed',
    errorMessage?: string,
    resultSummary?: Record<string, unknown>
  ): Promise<void> {
    const updates: Partial<ImportJob> = { progress };

    if (status) {
      updates.status = status;
      if (status === 'running' && !updates.startedAt) {
        updates.startedAt = new Date();
      }
      if (status === 'completed' || status === 'failed') {
        updates.completedAt = new Date();
      }
    }

    if (errorMessage) {
      updates.errorMessage = errorMessage;
    }

    if (resultSummary) {
      updates.resultSummary = resultSummary;
    }

    await db.update(importJobs).set(updates).where(eq(importJobs.id, jobId));
  }

  /**
   * Get job status
   */
  async getJob(jobId: string): Promise<ImportJob | null> {
    const [job] = await db.select().from(importJobs).where(eq(importJobs.id, jobId));
    return job || null;
  }

  /**
   * List versions with pagination
   */
  async listVersions(
    options: { status?: string; limit?: number; offset?: number } = {}
  ): Promise<{ versions: ImportVersion[]; total: number }> {
    const { status, limit = 20, offset = 0 } = options;

    let query = db.select().from(importVersions);

    if (status) {
      query = query.where(eq(importVersions.status, status)) as typeof query;
    }

    const versions = await query
      .orderBy(desc(importVersions.uploadedAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(importVersions);

    return {
      versions,
      total: countResult?.count || 0,
    };
  }

  /**
   * Get a single version
   */
  async getVersion(versionId: string): Promise<ImportVersion | null> {
    const [version] = await db
      .select()
      .from(importVersions)
      .where(eq(importVersions.id, versionId));
    return version || null;
  }

  /**
   * Get historical diff for a published version
   */
  async getHistoricalDiff(versionId: string): Promise<DiffResult | null> {
    const [version] = await db
      .select()
      .from(importVersions)
      .where(eq(importVersions.id, versionId));

    if (!version || !version.diffPath) {
      return null;
    }

    // Resolve relative path to absolute
    const fullPath = join(process.cwd(), version.diffPath);

    if (!existsSync(fullPath)) {
      console.warn(`[Import] Diff file not found: ${fullPath}`);
      return null;
    }

    try {
      const diffContent = readFileSync(fullPath, 'utf-8');
      const diff = JSON.parse(diffContent) as DiffResult;

      // Augment deactivated features with geometry if missing (for old diff files)
      // This ensures "Removed" items can be clicked and shown on the map
      const deactivatedWithoutGeometry = diff.deactivated.filter(f => !f.geometry);
      if (deactivatedWithoutGeometry.length > 0) {
        const ids = deactivatedWithoutGeometry
          .map(f => f.properties?.id)
          .filter((id): id is string => !!id);

        if (ids.length > 0) {
          // Fetch geometry from database for these IDs
          const roads = await db
            .select({
              id: roadAssets.id,
              geometry: fromGeomSql(roadAssets.geometry),
            })
            .from(roadAssets)
            .where(inArray(roadAssets.id, ids));

          const geometryMap = new Map(roads.map(r => [r.id, r.geometry]));

          // Update deactivated features with geometry
          diff.deactivated = diff.deactivated.map(f => {
            if (!f.geometry && f.properties?.id) {
              const geometry = geometryMap.get(f.properties.id as string);
              if (geometry) {
                return {
                  ...f,
                  geometry: geometry as Geometry,
                };
              }
            }
            return f;
          });
        }
      }

      return diff;
    } catch (err) {
      console.error(`[Import] Failed to read diff file ${fullPath}:`, err);
      return null;
    }
  }

  /**
   * Delete a draft version
   */
  async deleteVersion(versionId: string): Promise<boolean> {
    const [version] = await db
      .select()
      .from(importVersions)
      .where(eq(importVersions.id, versionId));

    if (!version) {
      return false;
    }

    if (version.status !== 'draft') {
      throw new Error('Can only delete draft versions');
    }

    // Delete files
    const versionDir = dirname(version.filePath);
    if (existsSync(versionDir)) {
      const files = readdirSync(versionDir);
      for (const file of files) {
        unlinkSync(join(versionDir, file));
      }
      // Note: rmdir would need the directory to be empty, which it now is
    }

    // Delete database record
    await db.delete(importVersions).where(eq(importVersions.id, versionId));

    return true;
  }
}

// Export singleton instance
export const importVersionService = new ImportVersionService();

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
  type NewImportVersion,
  type NewImportJob,
  type ImportVersion,
  type ImportJob,
  type RoadAsset,
} from '../db/schema.js';
import { eq, sql, and, inArray, not, isNull, desc } from 'drizzle-orm';
import { toGeomSql, fromGeomSql } from '../db/geometry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const execAsync = promisify(exec);

// Configuration - use local path for development, /app/uploads for Docker
const UPLOADS_DIR = process.env.UPLOADS_DIR || join(__dirname, '../../uploads');
const IMPORTS_DIR = join(UPLOADS_DIR, 'imports');
const SNAPSHOTS_DIR = join(UPLOADS_DIR, 'snapshots');

// Ensure directories exist
[UPLOADS_DIR, IMPORTS_DIR, SNAPSHOTS_DIR].forEach(dir => {
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
      const layerMatches = stdout.matchAll(/(\d+): ([\w_-]+) \(([^)]+)\)/g);
      for (const match of layerMatches) {
        layers.push({
          name: match[2],
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
      importScope: string;
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
      geojsonPath = await this.convertGeoPackageToGeoJSON(
        version.filePath,
        config.layerName,
        config.sourceCRS
      );
    } else if (config.sourceCRS && config.sourceCRS !== 'EPSG:4326') {
      // Convert GeoJSON CRS if needed
      geojsonPath = await this.transformGeoJSONCRS(version.filePath, config.sourceCRS);
    }

    // Count features
    const geojson = JSON.parse(readFileSync(geojsonPath, 'utf-8')) as FeatureCollection;
    const featureCount = geojson.features?.length || 0;

    // Update version record
    await db
      .update(importVersions)
      .set({
        layerName: config.layerName || null,
        sourceCRS: config.sourceCRS || null,
        importScope: config.importScope,
        defaultDataSource: config.defaultDataSource,
        regionalRefresh: config.regionalRefresh ?? false,
        featureCount,
        filePath: geojsonPath,
      })
      .where(eq(importVersions.id, versionId));

    const [updated] = await db
      .select()
      .from(importVersions)
      .where(eq(importVersions.id, versionId));

    return updated;
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

    let cmd = `ogr2ogr -f GeoJSON -t_srs EPSG:4326`;

    if (sourceCRS && sourceCRS !== 'EPSG:4326') {
      cmd += ` -s_srs ${sourceCRS}`;
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

    const cmd = `ogr2ogr -f GeoJSON -t_srs EPSG:4326 -s_srs ${sourceCRS} "${outputPath}" "${geojsonPath}"`;

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
   * Generate diff between import file and current database
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
    const importIds = new Set(importFeatures.map(f => f.properties?.id).filter(Boolean));

    // Get current roads in scope with geometry for comparison
    console.log('[Import] Getting roads in scope:', version.importScope);
    const currentRoads = await this.getRoadsInScopeWithGeometry(version.importScope);
    console.log('[Import] Found', currentRoads.length, 'roads in scope');
    const currentRoadMap = new Map(currentRoads.map(r => [r.id, r]));

    const added: Feature[] = [];
    const updated: Feature[] = [];
    let unchanged = 0;

    // Check each import feature
    for (const feature of importFeatures) {
      const id = feature.properties?.id;
      if (!id) continue;

      const existing = currentRoadMap.get(id);
      if (!existing) {
        // New road
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

    // Roads in scope but not in import = will be deactivated (only if regionalRefresh is enabled)
    const deactivated: Feature[] = [];
    if (version.regionalRefresh) {
      for (const road of currentRoads) {
        if (!importIds.has(road.id)) {
          deactivated.push({
            type: 'Feature',
            geometry: null as unknown as Geometry, // Geometry would need to be fetched
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
      },
    };
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
   * Create pre-publish snapshot of roads in scope
   */
  async createSnapshot(versionId: string, scope: string): Promise<string> {
    const roads = await this.getRoadsInScope(scope);

    // Export roads to GeoJSON with geometry
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
        updatedAt: roadAssets.updatedAt,
      })
      .from(roadAssets)
      .where(
        scope === 'full'
          ? eq(roadAssets.status, 'active')
          : scope.startsWith('ward:')
          ? and(eq(roadAssets.status, 'active'), eq(roadAssets.ward, scope.substring(5)))
          : eq(roadAssets.status, 'active')
      );

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
   */
  async publishVersion(versionId: string, publishedBy?: string): Promise<PublishResult> {
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

    // Create snapshot before publishing
    const snapshotPath = await this.createSnapshot(versionId, version.importScope);

    // Read import GeoJSON
    const geojsonPath = version.filePath.endsWith('.geojson')
      ? version.filePath
      : join(dirname(version.filePath), 'converted.geojson');

    const geojson = JSON.parse(readFileSync(geojsonPath, 'utf-8')) as FeatureCollection;
    const importFeatures = geojson.features || [];
    const importIds = new Set<string>();

    let added = 0;
    let updated = 0;
    let unchanged = 0;

    // Get current roads in scope
    const currentRoads = await this.getRoadsInScope(version.importScope);
    const currentRoadMap = new Map(currentRoads.map(r => [r.id, r]));

    const now = new Date();

    // Process each import feature
    for (const feature of importFeatures) {
      const id = feature.properties?.id;
      if (!id) continue;

      importIds.add(id);
      const existing = currentRoadMap.get(id);
      const props = feature.properties || {};

      if (!existing) {
        // INSERT new road
        await db.execute(sql`
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
        `);
        added++;
      } else {
        // UPDATE existing road (only provided fields)
        const updateFields: Record<string, unknown> = {
          updatedAt: now,
        };

        // Only update fields that are explicitly provided
        if (props.name !== undefined) updateFields.name = props.name;
        if (props.nameJa !== undefined) updateFields.nameJa = props.nameJa;
        if (props.displayName !== undefined) updateFields.displayName = props.displayName;
        if (props.roadType !== undefined) updateFields.roadType = props.roadType;
        if (props.lanes !== undefined) updateFields.lanes = props.lanes;
        if (props.direction !== undefined) updateFields.direction = props.direction;
        if (props.ward !== undefined) updateFields.ward = props.ward;
        if (props.dataSource !== undefined) updateFields.dataSource = props.dataSource;

        // Always update geometry if provided
        if (feature.geometry) {
          await db.execute(sql`
            UPDATE road_assets
            SET geometry = ${toGeomSql(feature.geometry)},
                name = COALESCE(${props.name ?? null}, name),
                road_type = COALESCE(${props.roadType ?? null}, road_type),
                lanes = COALESCE(${props.lanes ?? null}, lanes),
                direction = COALESCE(${props.direction ?? null}, direction),
                ward = COALESCE(${props.ward ?? null}, ward),
                data_source = COALESCE(${props.dataSource ?? null}, data_source),
                updated_at = ${now}
            WHERE id = ${id}
          `);
        }

        updated++;
      }
    }

    // Mark roads in scope but not in import as inactive
    // Only if regionalRefresh is enabled (default: false = incremental update only)
    let deactivated = 0;
    if (version.regionalRefresh) {
      for (const road of currentRoads) {
        if (!importIds.has(road.id)) {
          await db
            .update(roadAssets)
            .set({ status: 'inactive', updatedAt: now })
            .where(eq(roadAssets.id, road.id));
          deactivated++;
        }
      }
    }

    // Archive previous published version
    await db
      .update(importVersions)
      .set({ status: 'archived', archivedAt: now })
      .where(and(eq(importVersions.status, 'published'), not(eq(importVersions.id, versionId))));

    // Update version to published
    await db
      .update(importVersions)
      .set({
        status: 'published',
        publishedAt: now,
        publishedBy: publishedBy || null,
        snapshotPath,
      })
      .where(eq(importVersions.id, versionId));

    return {
      success: true,
      added,
      updated,
      deactivated,
      unchanged,
      snapshotPath,
      publishedAt: now.toISOString(),
      scope: version.importScope,
    };
  }

  /**
   * Rollback to a version's snapshot
   */
  async rollbackToVersion(versionId: string): Promise<RollbackResult> {
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

    const snapshot = JSON.parse(readFileSync(version.snapshotPath, 'utf-8')) as FeatureCollection;
    const features = snapshot.features || [];

    const now = new Date();
    let restored = 0;

    // UPSERT each feature from snapshot
    for (const feature of features) {
      const props = feature.properties || {};
      const id = props.id;
      if (!id) continue;

      // Use raw SQL for UPSERT with geometry
      await db.execute(sql`
        INSERT INTO road_assets (
          id, name, name_ja, display_name, geometry, road_type, lanes, direction,
          status, valid_from, ward, data_source, updated_at
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
          ward = EXCLUDED.ward,
          data_source = EXCLUDED.data_source,
          updated_at = ${now}
      `);
      restored++;
    }

    // Archive current published version
    await db
      .update(importVersions)
      .set({ status: 'archived', archivedAt: now })
      .where(and(eq(importVersions.status, 'published'), not(eq(importVersions.id, versionId))));

    // Set target version as published
    await db
      .update(importVersions)
      .set({ status: 'published', publishedAt: now })
      .where(eq(importVersions.id, versionId));

    return {
      success: true,
      restored,
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

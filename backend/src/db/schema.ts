import { pgTable, varchar, text, timestamp, integer, bigint, boolean, index, primaryKey, customType, unique, numeric } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { Geometry, Point, Polygon, LineString } from 'geojson';

// PostGIS geometry column types
// These are type placeholders only - actual read/write MUST use toGeomSql/fromGeomSql helpers
// GIST indexes are defined in migration SQL (Drizzle doesn't support GIST)
const geometryColumn = customType<{ data: Geometry; driverData: unknown }>({
  dataType() {
    return 'geometry(Geometry, 4326)';
  },
});

const pointColumn = customType<{ data: Point; driverData: unknown }>({
  dataType() {
    return 'geometry(Point, 4326)';
  },
});

const polygonColumn = customType<{ data: Polygon; driverData: unknown }>({
  dataType() {
    return 'geometry(Polygon, 4326)';
  },
});

const lineStringColumn = customType<{ data: LineString; driverData: unknown }>({
  dataType() {
    return 'geometry(LineString, 4326)';
  },
});

// JSONB column type for complex data
const jsonbColumn = customType<{ data: unknown; driverData: string }>({
  dataType() {
    return 'jsonb';
  },
  toDriver(value: unknown): string {
    return JSON.stringify(value);
  },
  fromDriver(value: unknown): unknown {
    if (typeof value === 'string') {
      return JSON.parse(value);
    }
    return value;
  },
});
export const constructionEvents = pgTable('construction_events', {
  id: varchar('id', { length: 50 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  // Status: 'planned' | 'active' | 'pending_review' | 'closed' | 'archived' | 'cancelled'
  status: varchar('status', { length: 20 }).notNull().default('planned'),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  restrictionType: varchar('restriction_type', { length: 50 }).notNull(),
  geometry: geometryColumn('geometry').notNull(),
  geometrySource: varchar('geometry_source', { length: 20 }).default('manual'), // 'manual' | 'auto'
  postEndDecision: varchar('post_end_decision', { length: 50 }).default('pending'),
  archivedAt: timestamp('archived_at', { withTimezone: true }), // null = not archived
  // Note: affectedRoadAssetIds moved to event_road_assets join table
  department: varchar('department', { length: 100 }).notNull(),
  ward: varchar('ward', { length: 100 }),
  createdBy: varchar('created_by', { length: 100 }),
  // Phase 1: Close tracking fields
  closedBy: varchar('closed_by', { length: 100 }),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  closeNotes: text('close_notes'),
  // Reference to a related asset (singular, any type) - per Event Creation spec
  refAssetId: varchar('ref_asset_id', { length: 50 }),
  refAssetType: varchar('ref_asset_type', { length: 50 }), // road | river | streetlight | greenspace | street_tree | park_facility | pavement_section | pump_station
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  statusIdx: index('idx_events_status').on(table.status),
  departmentIdx: index('idx_events_department').on(table.department),
  startDateIdx: index('idx_events_start_date').on(table.startDate),
  endDateIdx: index('idx_events_end_date').on(table.endDate),
  refAssetIdx: index('idx_events_ref_asset').on(table.refAssetType, table.refAssetId),
  refAssetIdIdx: index('idx_events_ref_asset_id').on(table.refAssetId),
}));

export const roadAssets = pgTable('road_assets', {
  id: varchar('id', { length: 50 }).primaryKey(),
  name: varchar('name', { length: 255 }),  // Nullable - no placeholder for unnamed roads
  nameJa: varchar('name_ja', { length: 255 }),  // Japanese name from OSM
  ref: varchar('ref', { length: 100 }),  // Route reference (e.g., 国道23号)
  localRef: varchar('local_ref', { length: 100 }),  // Local reference code
  displayName: varchar('display_name', { length: 255 }),  // Computed fallback for display
  nameSource: varchar('name_source', { length: 20 }),  // 'osm' | 'municipal' | 'manual'
  nameConfidence: varchar('name_confidence', { length: 10 }),  // 'high' | 'medium' | 'low'
  geometry: geometryColumn('geometry').notNull(),  // LineString centerline (internal storage)
  geometryPolygon: polygonColumn('geometry_polygon'),  // Auto-computed buffered polygon (for rendering)
  roadType: varchar('road_type', { length: 50 }).notNull(),
  lanes: integer('lanes').notNull().default(2),
  width: numeric('width', { precision: 5, scale: 2 }),  // OSM width tag (meters)
  widthSource: varchar('width_source', { length: 20 }).default('default'),  // 'osm_width' | 'osm_lanes' | 'default'
  direction: varchar('direction', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  condition: varchar('condition', { length: 20 }),
  riskLevel: varchar('risk_level', { length: 20 }),
  validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
  validTo: timestamp('valid_to', { withTimezone: true }),
  // Self-reference for replaced_by - no FK constraint to avoid circular type inference
  replacedBy: varchar('replaced_by', { length: 50 }),
  ownerDepartment: varchar('owner_department', { length: 100 }),
  ward: varchar('ward', { length: 100 }),
  landmark: varchar('landmark', { length: 255 }),
  sublocality: varchar('sublocality', { length: 255 }),  // 町名/丁目 from Google Maps

  // NEW: Road polygon-specific fields
  crossSection: varchar('cross_section', { length: 100 }),  // Cross-section type
  managingDept: varchar('managing_dept', { length: 100 }),  // Managing department
  intersection: varchar('intersection', { length: 255 }),  // Intersection info
  pavementState: varchar('pavement_state', { length: 50 }),  // Pavement condition

  // NEW: Data source tracking (common fields)
  dataSource: varchar('data_source', { length: 20 }).default('manual'),  // 'osm_test' | 'official_ledger' | 'manual'
  sourceVersion: varchar('source_version', { length: 100 }),
  sourceDate: timestamp('source_date', { withTimezone: true }),
  lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),

  // OSM sync tracking fields
  osmType: varchar('osm_type', { length: 10 }),  // 'node' | 'way' | 'relation'
  osmId: bigint('osm_id', { mode: 'number' }),  // OpenStreetMap ID
  segmentIndex: integer('segment_index').default(0),  // Segment index within same OSM way
  osmTimestamp: timestamp('osm_timestamp', { withTimezone: true }),  // OSM last modified
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),  // Last sync from Overpass

  // Sync source and manual edit protection
  syncSource: varchar('sync_source', { length: 20 }).default('initial'),  // 'initial' | 'osm-sync' | 'manual'
  isManuallyEdited: boolean('is_manually_edited').default(false),  // If true, skip OSM sync updates

  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  statusIdx: index('idx_assets_status').on(table.status),
  roadTypeIdx: index('idx_assets_road_type').on(table.roadType),
  ownerDepartmentIdx: index('idx_assets_owner_department').on(table.ownerDepartment),
  dataSourceIdx: index('idx_assets_data_source').on(table.dataSource),
  wardIdx: index('idx_assets_ward').on(table.ward),
}));

// Join table for Event-RoadAsset many-to-many relationship
export const eventRoadAssets = pgTable('event_road_assets', {
  eventId: varchar('event_id', { length: 50 }).notNull()
    .references(() => constructionEvents.id, { onDelete: 'cascade' }),
  roadAssetId: varchar('road_asset_id', { length: 50 }).notNull()
    .references(() => roadAssets.id, { onDelete: 'cascade' }),
  relationType: varchar('relation_type', { length: 20 }).default('affected'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.eventId, table.roadAssetId] }),
  assetIdx: index('idx_event_road_assets_asset').on(table.roadAssetId),
}));

export const roadAssetChanges = pgTable('road_asset_changes', {
  id: varchar('id', { length: 50 }).primaryKey(),
  eventId: varchar('event_id', { length: 50 }).notNull().references(() => constructionEvents.id),
  changeType: varchar('change_type', { length: 20 }).notNull(),
  oldRoadAssetId: varchar('old_road_asset_id', { length: 50 }).references(() => roadAssets.id),
  newRoadAssetId: varchar('new_road_asset_id', { length: 50 }).references(() => roadAssets.id),
  geometry: geometryColumn('geometry'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  eventIdIdx: index('idx_changes_event_id').on(table.eventId),
  changeTypeIdx: index('idx_changes_change_type').on(table.changeType),
}));

// Inspection records - expanded for cross-asset inspection support
// Legacy fields (eventId, roadAssetId) preserved; new assetType+assetId takes precedence when set
// CHECK constraints defined in migration SQL
export const inspectionRecords = pgTable('inspection_records', {
  id: varchar('id', { length: 50 }).primaryKey(),
  // Legacy references (preserved for backward compatibility)
  eventId: varchar('event_id', { length: 50 })
    .references(() => constructionEvents.id, { onDelete: 'set null' }),
  roadAssetId: varchar('road_asset_id', { length: 50 })
    .references(() => roadAssets.id, { onDelete: 'set null' }),
  // New generic asset reference (takes precedence when set)
  assetType: varchar('asset_type', { length: 50 }),  // 'road' | 'street-tree' | 'park-facility' | 'pavement-section' | 'pump-station'
  assetId: varchar('asset_id', { length: 50 }),  // Reference to any asset table's id
  // Core inspection fields
  inspectionDate: timestamp('inspection_date', { mode: 'date' }).notNull(),
  inspectionType: varchar('inspection_type', { length: 50 }),  // 'routine' | 'detailed' | 'emergency' | 'diagnostic'
  result: varchar('result', { length: 100 }).notNull(),
  conditionGrade: varchar('condition_grade', { length: 10 }),  // 'A' | 'B' | 'C' | 'D' | 'S'
  findings: text('findings'),
  notes: text('notes'),
  // Inspector info
  inspector: varchar('inspector', { length: 100 }),
  inspectorOrganization: varchar('inspector_organization', { length: 255 }),
  // Measurements and media
  measurements: jsonbColumn('measurements'),  // Flexible measurement data (MCI, crack rate, etc.)
  mediaUrls: jsonbColumn('media_urls'),  // string[] of photo/document URLs
  // Location
  geometry: pointColumn('geometry').notNull(),
  // Work order reference (no FK constraint - defined after workOrders table)
  refWorkOrderId: varchar('ref_work_order_id', { length: 50 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  eventIdIdx: index('idx_inspections_event_id').on(table.eventId),
  roadAssetIdIdx: index('idx_inspections_road_asset_id').on(table.roadAssetId),
  inspectionDateIdx: index('idx_inspections_inspection_date').on(table.inspectionDate),
  assetTypeAssetIdIdx: index('idx_inspections_asset_type_id').on(table.assetType, table.assetId),
  inspectionTypeIdx: index('idx_inspections_type').on(table.inspectionType),
  resultIdx: index('idx_inspections_result').on(table.result),
  conditionGradeIdx: index('idx_inspections_condition_grade').on(table.conditionGrade),
}));

// OSM sync logs table (uses jsonbColumn defined at top)
export const osmSyncLogs = pgTable('osm_sync_logs', {
  id: varchar('id', { length: 50 }).primaryKey(),
  syncType: varchar('sync_type', { length: 20 }).notNull(),  // 'bbox' | 'ward' | 'full'
  bboxParam: varchar('bbox_param', { length: 255 }),  // 'minLng,minLat,maxLng,maxLat'
  wardParam: varchar('ward_param', { length: 100 }),
  status: varchar('status', { length: 20 }).notNull(),  // 'running' | 'completed' | 'failed' | 'partial'
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),

  // Statistics
  osmRoadsFetched: integer('osm_roads_fetched').default(0),
  roadsCreated: integer('roads_created').default(0),
  roadsUpdated: integer('roads_updated').default(0),
  roadsMarkedInactive: integer('roads_marked_inactive').default(0),
  roadsSkipped: integer('roads_skipped').default(0),

  // Error tracking
  errorMessage: text('error_message'),
  errorDetails: jsonbColumn('error_details'),

  // Metadata
  triggeredBy: varchar('triggered_by', { length: 100 }),  // 'cron-hourly' | 'cron-daily' | 'frontend-user'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  startedAtIdx: index('idx_osm_sync_logs_started').on(table.startedAt),
  statusIdx: index('idx_osm_sync_logs_status').on(table.status),
}));

// Road asset edit logs table - tracks QGIS edits for notification feature
// NO FK to road_assets to preserve delete logs
export const roadAssetEditLogs = pgTable('road_asset_edit_logs', {
  id: varchar('id', { length: 50 }).primaryKey(),
  roadAssetId: varchar('road_asset_id', { length: 50 }).notNull(),
  editType: varchar('edit_type', { length: 20 }).notNull(),  // 'create' | 'update' | 'delete'
  roadName: varchar('road_name', { length: 255 }),
  roadDisplayName: varchar('road_display_name', { length: 255 }),
  roadWard: varchar('road_ward', { length: 100 }),
  roadType: varchar('road_type', { length: 50 }),
  centroid: pointColumn('centroid').notNull(),
  bbox: jsonbColumn('bbox'),  // [minLng, minLat, maxLng, maxLat]
  editSource: varchar('edit_source', { length: 20 }).default('manual'),
  editedAt: timestamp('edited_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  editedAtIdx: index('idx_edit_logs_edited_at').on(table.editedAt),
  editSourceIdx: index('idx_edit_logs_edit_source').on(table.editSource),
  roadAssetIdIdx: index('idx_edit_logs_road_asset_id').on(table.roadAssetId),
}));

// ============================================
// Import Versioning Tables
// ============================================

export const importVersions = pgTable('import_versions', {
  id: varchar('id', { length: 50 }).primaryKey(),
  versionNumber: integer('version_number').notNull(),
  status: varchar('status', { length: 20 }).notNull(),

  // File information
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileType: varchar('file_type', { length: 20 }).notNull(),
  filePath: varchar('file_path', { length: 500 }).notNull(),
  layerName: varchar('layer_name', { length: 100 }),
  sourceCRS: varchar('source_crs', { length: 20 }),

  // Import configuration
  importScope: varchar('import_scope', { length: 255 }).notNull(),
  regionalRefresh: boolean('regional_refresh').default(false).notNull(),
  defaultDataSource: varchar('default_data_source', { length: 20 }).notNull(),

  // Link to source export for precise comparison (if file contains _exportId)
  sourceExportId: varchar('source_export_id', { length: 50 }),

  // Statistics
  fileSizeMB: numeric('file_size_mb', { precision: 10, scale: 2 }),
  featureCount: integer('feature_count').notNull(),

  // Audit trail
  uploadedBy: varchar('uploaded_by', { length: 100 }),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  publishedBy: varchar('published_by', { length: 100 }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  rolledBackAt: timestamp('rolled_back_at', { withTimezone: true }),

  // Rollback support
  snapshotPath: varchar('snapshot_path', { length: 500 }),

  // Historical diff (saved at publish time for viewing changes later)
  diffPath: varchar('diff_path', { length: 500 }),

  // Publish stats (for timeline display)
  addedCount: integer('added_count'),
  updatedCount: integer('updated_count'),
  deactivatedCount: integer('deactivated_count'),

  // Notes
  notes: text('notes'),
}, (table) => ({
  statusIdx: index('idx_import_versions_status').on(table.status),
  uploadedAtIdx: index('idx_import_versions_uploaded').on(table.uploadedAt),
}));

export const importJobs = pgTable('import_jobs', {
  id: varchar('id', { length: 50 }).primaryKey(),
  versionId: varchar('version_id', { length: 50 }).notNull()
    .references(() => importVersions.id, { onDelete: 'cascade' }),
  jobType: varchar('job_type', { length: 20 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  progress: integer('progress').default(0),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  errorMessage: text('error_message'),
  resultSummary: jsonbColumn('result_summary'),
}, (table) => ({
  versionIdx: index('idx_import_jobs_version').on(table.versionId),
  statusIdx: index('idx_import_jobs_status').on(table.status),
}));

// Export Records - tracks exported road IDs for precise import comparison
export const exportRecords = pgTable('export_records', {
  id: varchar('id', { length: 50 }).primaryKey(),

  // Export configuration
  exportScope: varchar('export_scope', { length: 255 }).notNull(),  // 'full', 'ward:xxx', 'bbox:...'
  format: varchar('format', { length: 20 }).notNull(),  // 'geojson' | 'geopackage'

  // Exported road IDs (stored as JSONB array for efficient querying)
  roadIds: jsonbColumn('road_ids').notNull(),  // string[]
  featureCount: integer('feature_count').notNull(),

  // Audit trail
  exportedBy: varchar('exported_by', { length: 100 }),
  exportedAt: timestamp('exported_at', { withTimezone: true }).notNull(),
}, (table) => ({
  exportedAtIdx: index('idx_export_records_exported_at').on(table.exportedAt),
}));

// ============================================
// NEW ASSET TYPES
// ============================================

// River assets table - supports both LineString (centerline) and Polygon (water body)
export const riverAssets = pgTable('river_assets', {
  id: varchar('id', { length: 50 }).primaryKey(),

  // Name fields
  name: varchar('name', { length: 255 }),
  nameJa: varchar('name_ja', { length: 255 }),
  displayName: varchar('display_name', { length: 255 }),  // Computed: name_ja || name || id

  // Geometry - accepts both LineString and Polygon
  geometry: geometryColumn('geometry').notNull(),
  geometryType: varchar('geometry_type', { length: 20 }).notNull().default('line'),  // 'line' | 'polygon'

  // River-specific fields
  waterwayType: varchar('waterway_type', { length: 50 }),  // 'river' | 'stream' | 'canal' | 'drain'
  waterType: varchar('water_type', { length: 50 }),  // 'river' | 'pond' | 'lake' (for polygons)
  width: integer('width'),  // Average width in meters
  managementLevel: varchar('management_level', { length: 50 }),  // 'national' | 'prefectural' | 'municipal'
  maintainer: varchar('maintainer', { length: 100 }),

  // Status and location
  status: varchar('status', { length: 20 }).notNull().default('active'),
  condition: varchar('condition', { length: 20 }),
  riskLevel: varchar('risk_level', { length: 20 }),
  ward: varchar('ward', { length: 100 }),

  // Data source tracking
  dataSource: varchar('data_source', { length: 20 }).default('manual'),
  sourceVersion: varchar('source_version', { length: 100 }),
  sourceDate: timestamp('source_date', { withTimezone: true }),
  lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),

  // OSM tracking (osmType + osmId composite unique)
  osmType: varchar('osm_type', { length: 10 }),
  osmId: bigint('osm_id', { mode: 'number' }),  // OpenStreetMap ID
  osmTimestamp: timestamp('osm_timestamp', { withTimezone: true }),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  isManuallyEdited: boolean('is_manually_edited').default(false),

  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  statusIdx: index('idx_rivers_status').on(table.status),
  waterwayTypeIdx: index('idx_rivers_waterway_type').on(table.waterwayType),
  geometryTypeIdx: index('idx_rivers_geometry_type').on(table.geometryType),
  dataSourceIdx: index('idx_rivers_data_source').on(table.dataSource),
  wardIdx: index('idx_rivers_ward').on(table.ward),
  osmUniqueIdx: unique('idx_rivers_osm_unique').on(table.osmType, table.osmId),
}));

// Green space assets table - parks, plazas, green areas (Polygon only)
export const greenSpaceAssets = pgTable('greenspace_assets', {
  id: varchar('id', { length: 50 }).primaryKey(),

  // Name fields
  name: varchar('name', { length: 255 }),
  nameJa: varchar('name_ja', { length: 255 }),
  displayName: varchar('display_name', { length: 255 }),

  // Geometry - always Polygon
  geometry: polygonColumn('geometry').notNull(),

  // Green space-specific fields
  greenSpaceType: varchar('green_space_type', { length: 50 }).notNull(),  // 'park' | 'garden' | 'grass' | 'forest' | 'meadow' | 'playground'
  leisureType: varchar('leisure_type', { length: 50 }),  // OSM leisure tag
  landuseType: varchar('landuse_type', { length: 50 }),  // OSM landuse tag
  naturalType: varchar('natural_type', { length: 50 }),  // OSM natural tag
  areaM2: integer('area_m2'),  // Area in square meters (computed from geometry)
  vegetationType: varchar('vegetation_type', { length: 100 }),  // 'trees' | 'grass' | 'mixed' | 'flower_beds'
  operator: varchar('operator', { length: 255 }),  // Operating organization

  // Status and location
  status: varchar('status', { length: 20 }).notNull().default('active'),
  condition: varchar('condition', { length: 20 }),
  riskLevel: varchar('risk_level', { length: 20 }),
  ward: varchar('ward', { length: 100 }),

  // Data source tracking
  dataSource: varchar('data_source', { length: 20 }).default('manual'),
  sourceVersion: varchar('source_version', { length: 100 }),
  sourceDate: timestamp('source_date', { withTimezone: true }),
  lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),

  // OSM tracking
  osmType: varchar('osm_type', { length: 10 }),
  osmId: bigint('osm_id', { mode: 'number' }),  // OpenStreetMap ID
  osmTimestamp: timestamp('osm_timestamp', { withTimezone: true }),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  isManuallyEdited: boolean('is_manually_edited').default(false),

  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  statusIdx: index('idx_greenspaces_status').on(table.status),
  greenSpaceTypeIdx: index('idx_greenspaces_type').on(table.greenSpaceType),
  dataSourceIdx: index('idx_greenspaces_data_source').on(table.dataSource),
  wardIdx: index('idx_greenspaces_ward').on(table.ward),
  osmUniqueIdx: unique('idx_greenspaces_osm_unique').on(table.osmType, table.osmId),
}));

// Street light assets table - Point geometry
export const streetLightAssets = pgTable('streetlight_assets', {
  id: varchar('id', { length: 50 }).primaryKey(),

  // Identification
  lampId: varchar('lamp_id', { length: 50 }),  // Physical identification number
  displayName: varchar('display_name', { length: 255 }),

  // Geometry - always Point
  geometry: pointColumn('geometry').notNull(),

  // Street light-specific fields
  lampType: varchar('lamp_type', { length: 50 }).notNull(),  // 'led' | 'sodium' | 'mercury' | 'fluorescent'
  wattage: integer('wattage'),  // Power consumption in watts
  installDate: timestamp('install_date', { withTimezone: true }),
  lampStatus: varchar('lamp_status', { length: 20 }).notNull().default('operational'),  // 'operational' | 'maintenance' | 'damaged' | 'replaced'

  // Reference to road
  roadRef: varchar('road_ref', { length: 50 }),  // Reference to road_assets.id (not FK for flexibility)

  // Status and location
  status: varchar('status', { length: 20 }).notNull().default('active'),  // Data lifecycle status
  condition: varchar('condition', { length: 20 }),
  riskLevel: varchar('risk_level', { length: 20 }),
  ward: varchar('ward', { length: 100 }),

  // Data source tracking
  dataSource: varchar('data_source', { length: 20 }).default('manual'),
  sourceVersion: varchar('source_version', { length: 100 }),
  sourceDate: timestamp('source_date', { withTimezone: true }),
  lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),

  // OSM tracking
  osmType: varchar('osm_type', { length: 10 }),  // Always 'node' for streetlights
  osmId: bigint('osm_id', { mode: 'number' }),  // OpenStreetMap ID
  osmTimestamp: timestamp('osm_timestamp', { withTimezone: true }),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  isManuallyEdited: boolean('is_manually_edited').default(false),

  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  statusIdx: index('idx_streetlights_status').on(table.status),
  lampStatusIdx: index('idx_streetlights_lamp_status').on(table.lampStatus),
  lampTypeIdx: index('idx_streetlights_lamp_type').on(table.lampType),
  dataSourceIdx: index('idx_streetlights_data_source').on(table.dataSource),
  wardIdx: index('idx_streetlights_ward').on(table.ward),
  osmUniqueIdx: unique('idx_streetlights_osm_unique').on(table.osmType, table.osmId),
}));

// Nagoya designated roads table - LineString features from MVT sync
export const nagoyaDesignatedRoads = pgTable('nagoya_designated_roads', {
  id: varchar('id', { length: 50 }).primaryKey().default(sql`'NDR-' || nanoid()`),
  sourceLayer: varchar('source_layer', { length: 100 }).notNull(),
  dedupKey: varchar('dedup_key', { length: 255 }).notNull(),
  keycode: varchar('keycode', { length: 100 }),
  daicyoBan: varchar('daicyo_ban', { length: 100 }),
  gid: integer('gid'),
  encyo: varchar('encyo', { length: 100 }),
  fukuin: varchar('fukuin', { length: 100 }),
  kyokaBan: varchar('kyoka_ban', { length: 100 }),
  kyokaYmd: varchar('kyoka_ymd', { length: 50 }),
  shiteiBan: varchar('shitei_ban', { length: 100 }),
  shiteiYmd: varchar('shitei_ymd', { length: 50 }),
  filename: varchar('filename', { length: 500 }),
  rawProps: jsonbColumn('raw_props'),
  geometry: lineStringColumn('geometry').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sourceLayerDedupIdx: unique('idx_nagoya_roads_source_dedup').on(table.sourceLayer, table.dedupKey),
}));

// Nagoya designated areas table - Polygon features from MVT sync
export const nagoyaDesignatedAreas = pgTable('nagoya_designated_areas', {
  id: varchar('id', { length: 50 }).primaryKey().default(sql`'NDA-' || nanoid()`),
  sourceLayer: varchar('source_layer', { length: 100 }).notNull(),
  dedupKey: varchar('dedup_key', { length: 255 }).notNull(),
  keycode: varchar('keycode', { length: 100 }),
  daicyoBan: varchar('daicyo_ban', { length: 100 }),
  gid: integer('gid'),
  encyo: varchar('encyo', { length: 100 }),
  fukuin: varchar('fukuin', { length: 100 }),
  kyokaBan: varchar('kyoka_ban', { length: 100 }),
  kyokaYmd: varchar('kyoka_ymd', { length: 50 }),
  shiteiBan: varchar('shitei_ban', { length: 100 }),
  shiteiYmd: varchar('shitei_ymd', { length: 50 }),
  filename: varchar('filename', { length: 500 }),
  rawProps: jsonbColumn('raw_props'),
  geometry: polygonColumn('geometry').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sourceLayerDedupIdx: unique('idx_nagoya_areas_source_dedup').on(table.sourceLayer, table.dedupKey),
}));

// Nagoya sync logs table - tracks MVT sync progress
export const nagoyaSyncLogs = pgTable('nagoya_sync_logs', {
  id: varchar('id', { length: 50 }).primaryKey(),
  status: varchar('status', { length: 20 }).notNull(), // 'running' | 'completed' | 'failed' | 'stopped'
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  totalTiles: integer('total_tiles').notNull(),
  completedTiles: integer('completed_tiles').notNull().default(0),
  errorTiles: integer('error_tiles').notNull().default(0),
  roadsCreated: integer('roads_created').notNull().default(0),
  roadsUpdated: integer('roads_updated').notNull().default(0),
  areasCreated: integer('areas_created').notNull().default(0),
  areasUpdated: integer('areas_updated').notNull().default(0),
  resumeState: jsonbColumn('resume_state'),
  errorMessage: text('error_message'),
  errorDetails: jsonbColumn('error_details'),
}, (table) => ({
  statusIdx: index('idx_nagoya_sync_status').on(table.status),
  startedIdx: index('idx_nagoya_sync_started').on(table.startedAt),
}));

// Type exports for use in application
export type ConstructionEvent = typeof constructionEvents.$inferSelect;
export type NewConstructionEvent = typeof constructionEvents.$inferInsert;

export type RoadAsset = typeof roadAssets.$inferSelect;
export type NewRoadAsset = typeof roadAssets.$inferInsert;

export type EventRoadAsset = typeof eventRoadAssets.$inferSelect;
export type NewEventRoadAsset = typeof eventRoadAssets.$inferInsert;

export type RoadAssetChange = typeof roadAssetChanges.$inferSelect;
export type NewRoadAssetChange = typeof roadAssetChanges.$inferInsert;

export type InspectionRecord = typeof inspectionRecords.$inferSelect;
export type NewInspectionRecord = typeof inspectionRecords.$inferInsert;

export type OsmSyncLog = typeof osmSyncLogs.$inferSelect;
export type NewOsmSyncLog = typeof osmSyncLogs.$inferInsert;

export type RoadAssetEditLog = typeof roadAssetEditLogs.$inferSelect;
export type NewRoadAssetEditLog = typeof roadAssetEditLogs.$inferInsert;

export type ImportVersion = typeof importVersions.$inferSelect;
export type NewImportVersion = typeof importVersions.$inferInsert;

export type ImportJob = typeof importJobs.$inferSelect;
export type NewImportJob = typeof importJobs.$inferInsert;

export type ExportRecord = typeof exportRecords.$inferSelect;
export type NewExportRecord = typeof exportRecords.$inferInsert;

export type RiverAsset = typeof riverAssets.$inferSelect;
export type NewRiverAsset = typeof riverAssets.$inferInsert;

export type GreenSpaceAsset = typeof greenSpaceAssets.$inferSelect;
export type NewGreenSpaceAsset = typeof greenSpaceAssets.$inferInsert;

export type StreetLightAsset = typeof streetLightAssets.$inferSelect;
export type NewStreetLightAsset = typeof streetLightAssets.$inferInsert;

export type NagoyaDesignatedRoad = typeof nagoyaDesignatedRoads.$inferSelect;
export type NewNagoyaDesignatedRoad = typeof nagoyaDesignatedRoads.$inferInsert;

export type NagoyaDesignatedArea = typeof nagoyaDesignatedAreas.$inferSelect;
export type NewNagoyaDesignatedArea = typeof nagoyaDesignatedAreas.$inferInsert;

export type NagoyaSyncLog = typeof nagoyaSyncLogs.$inferSelect;
export type NewNagoyaSyncLog = typeof nagoyaSyncLogs.$inferInsert;

// Nagoya building zones table - Polygon features from kenchiku MVT sync
export const nagoyaBuildingZones = pgTable('nagoya_building_zones', {
  id: varchar('id', { length: 50 }).primaryKey().default(sql`'NBZ-' || nanoid()`),
  sourceLayer: varchar('source_layer', { length: 100 }).notNull(),
  dedupKey: varchar('dedup_key', { length: 255 }).notNull(),
  gid: integer('gid'),
  keycode: varchar('keycode', { length: 100 }),
  // Building zone-specific fields
  zoneType: varchar('zone_type', { length: 100 }),  // 区域種別
  name: varchar('name', { length: 255 }),
  kyoteiName: varchar('kyotei_name', { length: 255 }),  // 協定名称
  kubun: varchar('kubun', { length: 100 }),  // 区分
  ninteiYmd: varchar('nintei_ymd', { length: 50 }),  // 認定日
  ninteiNo: varchar('nintei_no', { length: 100 }),  // 認定番号
  shiteiYmd: varchar('shitei_ymd', { length: 50 }),  // 指定日
  kokokuYmd: varchar('kokoku_ymd', { length: 50 }),  // 告告日
  menseki: varchar('menseki', { length: 50 }),  // 面積
  rawProps: jsonbColumn('raw_props'),
  geometry: polygonColumn('geometry').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sourceLayerDedupIdx: unique('idx_nagoya_building_zones_source_dedup').on(table.sourceLayer, table.dedupKey),
}));

export type NagoyaBuildingZone = typeof nagoyaBuildingZones.$inferSelect;
export type NewNagoyaBuildingZone = typeof nagoyaBuildingZones.$inferInsert;

// ============================================
// Phase 1: WorkOrder / Evidence / Notifications
// ============================================

// Work orders table - tasks spawned from events
export const workOrders = pgTable('work_orders', {
  id: varchar('id', { length: 50 }).primaryKey(),
  eventId: varchar('event_id', { length: 50 }).notNull()
    .references(() => constructionEvents.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 20 }).notNull(),  // 'inspection' | 'repair' | 'update'
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).notNull().default('draft'),  // 'draft' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'
  assignedDept: varchar('assigned_dept', { length: 100 }),
  assignedBy: varchar('assigned_by', { length: 100 }),
  assignedAt: timestamp('assigned_at', { withTimezone: true }),
  dueDate: timestamp('due_date', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  reviewedBy: varchar('reviewed_by', { length: 100 }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewNotes: text('review_notes'),
  createdBy: varchar('created_by', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  eventIdIdx: index('idx_workorders_event_id').on(table.eventId),
  statusIdx: index('idx_workorders_status').on(table.status),
  typeIdx: index('idx_workorders_type').on(table.type),
  dueDateIdx: index('idx_workorders_due_date').on(table.dueDate),
}));

// Work order locations - points/geometries associated with a work order
export const workOrderLocations = pgTable('work_order_locations', {
  id: varchar('id', { length: 50 }).primaryKey(),
  workOrderId: varchar('work_order_id', { length: 50 }).notNull()
    .references(() => workOrders.id, { onDelete: 'cascade' }),
  geometry: geometryColumn('geometry').notNull(),
  assetType: varchar('asset_type', { length: 20 }),  // 'road' | 'greenspace' | 'streetlight' | null
  assetId: varchar('asset_id', { length: 50 }),  // Reference to the asset (no FK for flexibility)
  note: text('note'),
  sequenceOrder: integer('sequence_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  workOrderIdIdx: index('idx_wo_locations_workorder_id').on(table.workOrderId),
  assetTypeIdx: index('idx_wo_locations_asset_type').on(table.assetType),
}));

// Work order partners - contractors/partners assigned to work orders
export const workOrderPartners = pgTable('work_order_partners', {
  workOrderId: varchar('work_order_id', { length: 50 }).notNull()
    .references(() => workOrders.id, { onDelete: 'cascade' }),
  partnerId: varchar('partner_id', { length: 50 }).notNull(),
  partnerName: varchar('partner_name', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).default('contractor'),  // 'contractor' | 'inspector' | 'reviewer'
  assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.workOrderId, table.partnerId] }),
  partnerIdIdx: index('idx_wo_partners_partner_id').on(table.partnerId),
}));

// Evidence table - photos, documents, reports attached to work orders
export const evidence = pgTable('evidence', {
  id: varchar('id', { length: 50 }).primaryKey(),
  workOrderId: varchar('work_order_id', { length: 50 }).notNull()
    .references(() => workOrders.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 20 }).notNull(),  // 'photo' | 'document' | 'report' | 'cad' | 'other'
  fileName: varchar('file_name', { length: 255 }).notNull(),
  filePath: varchar('file_path', { length: 500 }).notNull(),
  fileSizeBytes: integer('file_size_bytes'),
  mimeType: varchar('mime_type', { length: 100 }),
  title: varchar('title', { length: 255 }),
  description: text('description'),
  captureDate: timestamp('capture_date', { withTimezone: true }),
  geometry: pointColumn('geometry'),  // Location where photo was taken (geotagged)
  submittedBy: varchar('submitted_by', { length: 100 }).notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  // Submitter identity tracking
  submitterPartnerId: varchar('submitter_partner_id', { length: 50 }),
  submitterRole: varchar('submitter_role', { length: 20 }),  // 'partner' | 'gov_inspector'
  // First-level review
  reviewedBy: varchar('reviewed_by', { length: 100 }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewStatus: varchar('review_status', { length: 30 }).notNull().default('pending'),  // 'pending' | 'approved' | 'rejected' | 'accepted_by_authority'
  reviewNotes: text('review_notes'),
  // Government decision tracking
  decisionBy: varchar('decision_by', { length: 100 }),
  decisionAt: timestamp('decision_at', { withTimezone: true }),
  decisionNotes: text('decision_notes'),
}, (table) => ({
  workOrderIdIdx: index('idx_evidence_workorder_id').on(table.workOrderId),
  typeIdx: index('idx_evidence_type').on(table.type),
  reviewStatusIdx: index('idx_evidence_review_status').on(table.reviewStatus),
}));

// Type exports for Phase 1 tables
export type WorkOrder = typeof workOrders.$inferSelect;
export type NewWorkOrder = typeof workOrders.$inferInsert;

export type WorkOrderLocation = typeof workOrderLocations.$inferSelect;
export type NewWorkOrderLocation = typeof workOrderLocations.$inferInsert;

export type WorkOrderPartner = typeof workOrderPartners.$inferSelect;
export type NewWorkOrderPartner = typeof workOrderPartners.$inferInsert;

export type Evidence = typeof evidence.$inferSelect;
export type NewEvidence = typeof evidence.$inferInsert;

// ============================================
// RFI追加: New Asset Types (Street Trees, Park Facilities, Pavement, Pump Stations, Lifecycle Plans)
// ============================================

// Street tree assets table - Point geometry
// Covers 街路樹維持管理台帳 subsystem requirements
export const streetTreeAssets = pgTable('street_tree_assets', {
  id: varchar('id', { length: 50 }).primaryKey(),

  // Identification
  ledgerId: varchar('ledger_id', { length: 100 }),  // 台帳番号
  displayName: varchar('display_name', { length: 255 }),
  speciesName: varchar('species_name', { length: 255 }),  // 和名
  scientificName: varchar('scientific_name', { length: 255 }),  // 学名
  category: varchar('category', { length: 50 }).notNull(),  // CHECK: deciduous|evergreen|conifer|palmLike|shrub

  // Physical attributes
  trunkDiameter: numeric('trunk_diameter', { precision: 6, scale: 1 }),  // cm (胸高直径)
  height: numeric('height', { precision: 5, scale: 1 }),  // meters (樹高)
  crownSpread: numeric('crown_spread', { precision: 5, scale: 1 }),  // meters (枝張り)
  datePlanted: timestamp('date_planted', { withTimezone: true }),
  estimatedAge: integer('estimated_age'),  // years

  // Health & diagnostics
  healthStatus: varchar('health_status', { length: 50 }).notNull(),  // CHECK: healthy|declining|hazardous|dead|removed
  conditionGrade: varchar('condition_grade', { length: 10 }),  // CHECK: A|B|C|D|S
  lastDiagnosticDate: timestamp('last_diagnostic_date', { withTimezone: true }),
  diagnosticNotes: text('diagnostic_notes'),

  // Geometry
  geometry: pointColumn('geometry').notNull(),

  // Administrative
  status: varchar('status', { length: 20 }).notNull().default('active'),
  condition: varchar('condition', { length: 20 }),
  riskLevel: varchar('risk_level', { length: 20 }),
  ward: varchar('ward', { length: 100 }),
  managingDept: varchar('managing_dept', { length: 100 }),

  // References (no FK constraints for flexibility, matching streetlight pattern)
  roadRef: varchar('road_ref', { length: 50 }),  // Reference to road_assets.id
  greenSpaceRef: varchar('green_space_ref', { length: 50 }),  // Reference to greenspace_assets.id

  // Data source tracking
  dataSource: varchar('data_source', { length: 20 }).default('manual'),
  sourceVersion: varchar('source_version', { length: 100 }),
  sourceDate: timestamp('source_date', { withTimezone: true }),
  lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  statusIdx: index('idx_street_trees_status').on(table.status),
  categoryIdx: index('idx_street_trees_category').on(table.category),
  healthStatusIdx: index('idx_street_trees_health_status').on(table.healthStatus),
  conditionGradeIdx: index('idx_street_trees_condition_grade').on(table.conditionGrade),
  wardIdx: index('idx_street_trees_ward').on(table.ward),
  roadRefIdx: index('idx_street_trees_road_ref').on(table.roadRef),
  greenSpaceRefIdx: index('idx_street_trees_green_space_ref').on(table.greenSpaceRef),
}));

// Park facilities table - Point or Polygon geometry
// Covers 公園管理システム 施設情報管理 requirements
export const parkFacilities = pgTable('park_facilities', {
  id: varchar('id', { length: 50 }).primaryKey(),

  // Identification
  facilityId: varchar('facility_id', { length: 100 }),  // 施設管理番号
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 50 }).notNull(),  // CHECK: toilet|playground|bench|shelter|fence|gate|drainage|lighting|waterFountain|signBoard|pavement|sportsFacility|building|other
  subCategory: varchar('sub_category', { length: 100 }),

  // Physical attributes
  dateInstalled: timestamp('date_installed', { withTimezone: true }),
  manufacturer: varchar('manufacturer', { length: 255 }),
  material: varchar('material', { length: 100 }),
  quantity: integer('quantity'),
  designLife: integer('design_life'),  // years (設計供用年数)

  // Condition assessment
  conditionGrade: varchar('condition_grade', { length: 10 }),  // CHECK: A|B|C|D|S
  lastInspectionDate: timestamp('last_inspection_date', { withTimezone: true }),
  nextInspectionDate: timestamp('next_inspection_date', { withTimezone: true }),
  safetyConcern: boolean('safety_concern').default(false),

  // Geometry (Point for equipment, Polygon for areas like pavement/playground)
  geometry: geometryColumn('geometry').notNull(),

  // Administrative
  status: varchar('status', { length: 20 }).notNull().default('active'),
  condition: varchar('condition', { length: 20 }),
  riskLevel: varchar('risk_level', { length: 20 }),
  ward: varchar('ward', { length: 100 }),
  managingDept: varchar('managing_dept', { length: 100 }),

  // References
  greenSpaceRef: varchar('green_space_ref', { length: 50 }).notNull(),  // Reference to greenspace_assets.id (required)

  // Data source tracking
  dataSource: varchar('data_source', { length: 20 }).default('manual'),
  sourceVersion: varchar('source_version', { length: 100 }),
  sourceDate: timestamp('source_date', { withTimezone: true }),
  lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  statusIdx: index('idx_park_facilities_status').on(table.status),
  categoryIdx: index('idx_park_facilities_category').on(table.category),
  conditionGradeIdx: index('idx_park_facilities_condition_grade').on(table.conditionGrade),
  wardIdx: index('idx_park_facilities_ward').on(table.ward),
  greenSpaceRefIdx: index('idx_park_facilities_green_space_ref').on(table.greenSpaceRef),
}));

// Pavement sections table - LineString or Polygon geometry
// Covers 舗装維持補修支援システム requirements
export const pavementSections = pgTable('pavement_sections', {
  id: varchar('id', { length: 50 }).primaryKey(),

  // Identification
  sectionId: varchar('section_id', { length: 100 }),  // 区間管理番号
  name: varchar('name', { length: 255 }),
  routeNumber: varchar('route_number', { length: 100 }),  // 路線番号

  // Pavement attributes
  pavementType: varchar('pavement_type', { length: 50 }).notNull(),  // CHECK: asphalt|concrete|interlocking|gravel|other
  length: numeric('length', { precision: 10, scale: 2 }),  // meters
  width: numeric('width', { precision: 6, scale: 2 }),  // meters
  thickness: numeric('thickness', { precision: 5, scale: 1 }),  // cm
  lastResurfacingDate: timestamp('last_resurfacing_date', { withTimezone: true }),

  // Condition indices (路面性状値)
  mci: numeric('mci', { precision: 4, scale: 1 }),  // Maintenance Control Index (0-10)
  crackRate: numeric('crack_rate', { precision: 5, scale: 2 }),  // % (ひび割れ率)
  rutDepth: numeric('rut_depth', { precision: 5, scale: 1 }),  // mm (わだち掘れ量)
  iri: numeric('iri', { precision: 5, scale: 2 }),  // m/km (International Roughness Index)
  lastMeasurementDate: timestamp('last_measurement_date', { withTimezone: true }),

  // Planning
  plannedInterventionYear: integer('planned_intervention_year'),
  estimatedCost: numeric('estimated_cost', { precision: 12, scale: 0 }),  // JPY
  priorityRank: integer('priority_rank'),

  // Geometry (LineString along centerline or Polygon for section area)
  geometry: geometryColumn('geometry').notNull(),

  // Administrative
  status: varchar('status', { length: 20 }).notNull().default('active'),
  condition: varchar('condition', { length: 20 }),
  riskLevel: varchar('risk_level', { length: 20 }),
  ward: varchar('ward', { length: 100 }),
  managingDept: varchar('managing_dept', { length: 100 }),

  // References
  roadRef: varchar('road_ref', { length: 50 }).notNull(),  // Reference to road_assets.id (required)

  // Data source tracking
  dataSource: varchar('data_source', { length: 20 }).default('manual'),
  sourceVersion: varchar('source_version', { length: 100 }),
  sourceDate: timestamp('source_date', { withTimezone: true }),
  lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  statusIdx: index('idx_pavement_sections_status').on(table.status),
  pavementTypeIdx: index('idx_pavement_sections_type').on(table.pavementType),
  wardIdx: index('idx_pavement_sections_ward').on(table.ward),
  priorityRankIdx: index('idx_pavement_sections_priority_rank').on(table.priorityRank),
  roadRefIdx: index('idx_pavement_sections_road_ref').on(table.roadRef),
}));

// Pump stations table - Point or Polygon geometry
// Covers ポンプ施設管理システム requirements
export const pumpStations = pgTable('pump_stations', {
  id: varchar('id', { length: 50 }).primaryKey(),

  // Identification
  stationId: varchar('station_id', { length: 100 }),  // 施設管理番号
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 50 }).notNull(),  // CHECK: stormwater|sewage|irrigation|combined

  // Physical attributes
  dateCommissioned: timestamp('date_commissioned', { withTimezone: true }),
  designCapacity: numeric('design_capacity', { precision: 8, scale: 2 }),  // m³/min
  pumpCount: integer('pump_count'),
  totalPower: numeric('total_power', { precision: 8, scale: 2 }),  // kW
  drainageArea: numeric('drainage_area', { precision: 8, scale: 2 }),  // ha

  // Equipment status
  equipmentStatus: varchar('equipment_status', { length: 50 }).notNull(),  // CHECK: operational|standby|underMaintenance|outOfService
  conditionGrade: varchar('condition_grade', { length: 10 }),  // CHECK: A|B|C|D|S
  lastMaintenanceDate: timestamp('last_maintenance_date', { withTimezone: true }),
  nextMaintenanceDate: timestamp('next_maintenance_date', { withTimezone: true }),

  // Geometry (Point for station location, or Polygon for compound)
  geometry: geometryColumn('geometry').notNull(),

  // Administrative
  status: varchar('status', { length: 20 }).notNull().default('active'),
  condition: varchar('condition', { length: 20 }),
  riskLevel: varchar('risk_level', { length: 20 }),
  ward: varchar('ward', { length: 100 }),
  managingDept: varchar('managing_dept', { length: 100 }),
  managingOffice: varchar('managing_office', { length: 255 }),

  // References
  riverRef: varchar('river_ref', { length: 50 }),  // Reference to river_assets.id

  // Data source tracking
  dataSource: varchar('data_source', { length: 20 }).default('manual'),
  sourceVersion: varchar('source_version', { length: 100 }),
  sourceDate: timestamp('source_date', { withTimezone: true }),
  lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  statusIdx: index('idx_pump_stations_status').on(table.status),
  categoryIdx: index('idx_pump_stations_category').on(table.category),
  equipmentStatusIdx: index('idx_pump_stations_equipment_status').on(table.equipmentStatus),
  conditionGradeIdx: index('idx_pump_stations_condition_grade').on(table.conditionGrade),
  wardIdx: index('idx_pump_stations_ward').on(table.ward),
  riverRefIdx: index('idx_pump_stations_river_ref').on(table.riverRef),
}));

// Lifecycle plans table - no geometry
// Covers 長寿命化計画 / LCC requirements
export const lifecyclePlans = pgTable('lifecycle_plans', {
  id: varchar('id', { length: 50 }).primaryKey(),

  // Core plan fields
  title: varchar('title', { length: 255 }).notNull(),
  version: varchar('version', { length: 50 }),
  planStartYear: integer('plan_start_year').notNull(),
  planEndYear: integer('plan_end_year').notNull(),
  planStatus: varchar('plan_status', { length: 20 }).notNull().default('draft'),  // CHECK: draft|approved|active|archived

  // Asset baseline
  assetType: varchar('asset_type', { length: 50 }).notNull(),  // 'ParkFacility' | 'PavementSection' | 'PumpStation' | 'StreetTree'
  baselineCondition: varchar('baseline_condition', { length: 10 }),  // CHECK: A|B|C|D|S
  designLife: integer('design_life'),  // years
  remainingLife: integer('remaining_life'),  // years

  // Cost projections
  interventions: jsonbColumn('interventions'),  // Array<{ year, type, description, estimatedCostJpy }>
  totalLifecycleCostJpy: numeric('total_lifecycle_cost_jpy', { precision: 15, scale: 0 }),
  annualAverageCostJpy: numeric('annual_average_cost_jpy', { precision: 12, scale: 0 }),

  // Asset reference
  assetRef: varchar('asset_ref', { length: 50 }),  // Reference to any asset's id

  // Administrative
  managingDept: varchar('managing_dept', { length: 100 }),
  createdBy: varchar('created_by', { length: 100 }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  assetTypeIdx: index('idx_lifecycle_plans_asset_type').on(table.assetType),
  planStatusIdx: index('idx_lifecycle_plans_status').on(table.planStatus),
  assetRefIdx: index('idx_lifecycle_plans_asset_ref').on(table.assetRef),
}));

// Type exports for RFI tables
export type StreetTreeAssetRow = typeof streetTreeAssets.$inferSelect;
export type NewStreetTreeAsset = typeof streetTreeAssets.$inferInsert;

export type ParkFacilityRow = typeof parkFacilities.$inferSelect;
export type NewParkFacility = typeof parkFacilities.$inferInsert;

export type PavementSectionRow = typeof pavementSections.$inferSelect;
export type NewPavementSection = typeof pavementSections.$inferInsert;

export type PumpStationRow = typeof pumpStations.$inferSelect;
export type NewPumpStation = typeof pumpStations.$inferInsert;

export type LifecyclePlanRow = typeof lifecyclePlans.$inferSelect;
export type NewLifecyclePlan = typeof lifecyclePlans.$inferInsert;

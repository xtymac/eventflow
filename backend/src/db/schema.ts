import { pgTable, varchar, text, timestamp, integer, bigint, boolean, index, primaryKey, customType, unique, numeric } from 'drizzle-orm/pg-core';
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
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  statusIdx: index('idx_events_status').on(table.status),
  departmentIdx: index('idx_events_department').on(table.department),
  startDateIdx: index('idx_events_start_date').on(table.startDate),
  endDateIdx: index('idx_events_end_date').on(table.endDate),
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

// Inspection records with FK references (exactly one of eventId or roadAssetId must be set)
// CHECK constraint is defined in migration SQL
export const inspectionRecords = pgTable('inspection_records', {
  id: varchar('id', { length: 50 }).primaryKey(),
  eventId: varchar('event_id', { length: 50 })
    .references(() => constructionEvents.id, { onDelete: 'set null' }),
  roadAssetId: varchar('road_asset_id', { length: 50 })
    .references(() => roadAssets.id, { onDelete: 'set null' }),
  inspectionDate: timestamp('inspection_date', { mode: 'date' }).notNull(),
  result: varchar('result', { length: 100 }).notNull(),
  notes: text('notes'),
  geometry: pointColumn('geometry').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  eventIdIdx: index('idx_inspections_event_id').on(table.eventId),
  roadAssetIdIdx: index('idx_inspections_road_asset_id').on(table.roadAssetId),
  inspectionDateIdx: index('idx_inspections_inspection_date').on(table.inspectionDate),
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

  // Rollback support
  snapshotPath: varchar('snapshot_path', { length: 500 }),

  // Historical diff (saved at publish time for viewing changes later)
  diffPath: varchar('diff_path', { length: 500 }),

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

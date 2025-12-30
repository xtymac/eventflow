import { pgTable, varchar, text, timestamp, integer, index, primaryKey, customType } from 'drizzle-orm/pg-core';
import type { Geometry, Point } from 'geojson';

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
  name: varchar('name', { length: 255 }).notNull(),
  geometry: geometryColumn('geometry').notNull(),
  roadType: varchar('road_type', { length: 50 }).notNull(),
  lanes: integer('lanes').notNull().default(2),
  direction: varchar('direction', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  validFrom: timestamp('valid_from', { withTimezone: true }).notNull(),
  validTo: timestamp('valid_to', { withTimezone: true }),
  replacedBy: varchar('replaced_by', { length: 50 }).references(() => roadAssets.id),
  ownerDepartment: varchar('owner_department', { length: 100 }),
  ward: varchar('ward', { length: 100 }),
  landmark: varchar('landmark', { length: 255 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  statusIdx: index('idx_assets_status').on(table.status),
  roadTypeIdx: index('idx_assets_road_type').on(table.roadType),
  ownerDepartmentIdx: index('idx_assets_owner_department').on(table.ownerDepartment),
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

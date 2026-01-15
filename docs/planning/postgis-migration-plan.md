# PostGIS Migration Plan (Phase 2 Alignment)

## Goal
Move geometry storage from JSON (GeoJSON) to PostGIS geometry columns while keeping API responses in GeoJSON.

## Scope
- Database schema and migrations
- Drizzle schema and query helpers
- API routes and seed/import/export
- Validation steps

## Step 1: Database Migration
- Create a new migration file after 0001 (e.g. `backend/drizzle/0002_postgis_geometry.sql`) and register it in `backend/drizzle/meta/_journal.json`.
- Enable PostGIS extension if missing.
- Convert geometry columns from JSON to geometry with explicit types:
  - construction_events.geometry -> Geometry(Geometry, 4326)
  - road_assets.geometry -> Geometry(Geometry, 4326)
  - road_asset_changes.geometry -> Geometry(Geometry, 4326)
  - inspection_records.geometry -> Geometry(Point, 4326)
- Backfill using ST_SetSRID(ST_GeomFromGeoJSON(...), 4326); use CASE to skip NULL geometries.
- Optional: apply ST_MakeValid for safety if any GeoJSON is invalid.
- Add GIST indexes on geometry columns.

## Step 2: Drizzle Schema Updates
- Replace json geometry fields with a PostGIS-aware custom type or SQL wrappers.
- Keep TS types in shared package as GeoJSON to avoid frontend changes.

## Step 3: Geometry Helpers
Create helpers to centralize conversions:
- toGeomSql(geojson) -> ST_SetSRID(ST_GeomFromGeoJSON(...), 4326)
- fromGeomSql(geom) -> ST_AsGeoJSON(...)::json and JSON.parse

Use these helpers consistently in all inserts/selects.

## Step 4: API Routes
Update routes to read/write geometry using helpers:
- backend/src/routes/events.ts
- backend/src/routes/assets.ts
- backend/src/routes/inspections.ts
- backend/src/routes/import-export.ts

Ensure responses still return GeoJSON geometries.

## Step 5: Seed and Import/Export
- Seed inserts use ST_GeomFromGeoJSON.
- Export uses ST_AsGeoJSON for geometry fields.
- Keep GeoJSON sample files unchanged.

## Step 6: Background Jobs and Sync
- Scheduler and NGSI-LD sync should use geometry in GeoJSON form before sending.
- Verify any direct DB reads are converted with ST_AsGeoJSON.

## Step 7: Validation
- Run migrations: npm run db:migrate
- Re-seed: npm run db:seed
- Smoke test endpoints:
  - GET /events
  - GET /assets
  - GET /inspections
- Confirm map renders geometry correctly.
- SQL sanity checks:
  - Verify SRID: SELECT ST_SRID(geometry) FROM road_assets LIMIT 1;
  - Check invalid geometries: SELECT COUNT(*) FROM road_assets WHERE NOT ST_IsValid(geometry);
  - Check NULL geometries: SELECT COUNT(*) FROM road_assets WHERE geometry IS NULL;

## Notes
- Drizzle does not natively model PostGIS types; use customType or raw SQL helpers.
- Keep PostGIS as source of truth; Orion-LD remains read-only sync target.

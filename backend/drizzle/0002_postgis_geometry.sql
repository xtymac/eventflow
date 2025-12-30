-- Migration: Convert JSON geometry columns to PostGIS
-- Enable PostGIS extension (requires superuser/rds_superuser on RDS/Aurora)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Step 1: Add new PostGIS geometry columns
ALTER TABLE construction_events ADD COLUMN geometry_new geometry(Geometry, 4326);
ALTER TABLE road_assets ADD COLUMN geometry_new geometry(Geometry, 4326);
ALTER TABLE road_asset_changes ADD COLUMN geometry_new geometry(Geometry, 4326);
ALTER TABLE inspection_records ADD COLUMN geometry_new geometry(Point, 4326);

-- Step 2: Backfill with ST_MakeValid for safety
UPDATE construction_events
SET geometry_new = ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(geometry::text), 4326))
WHERE geometry IS NOT NULL;

UPDATE road_assets
SET geometry_new = ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(geometry::text), 4326))
WHERE geometry IS NOT NULL;

UPDATE road_asset_changes
SET geometry_new = ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(geometry::text), 4326))
WHERE geometry IS NOT NULL;

UPDATE inspection_records
SET geometry_new = ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(geometry::text), 4326))
WHERE geometry IS NOT NULL;

-- Step 3: Verify no NULL values and correct types BEFORE setting NOT NULL
DO $$
BEGIN
  -- Check NULLs in required columns
  IF EXISTS (SELECT 1 FROM construction_events WHERE geometry_new IS NULL LIMIT 1) THEN
    RAISE EXCEPTION 'construction_events has NULL geometry_new values - fix before continuing';
  END IF;
  IF EXISTS (SELECT 1 FROM road_assets WHERE geometry_new IS NULL LIMIT 1) THEN
    RAISE EXCEPTION 'road_assets has NULL geometry_new values - fix before continuing';
  END IF;
  IF EXISTS (SELECT 1 FROM inspection_records WHERE geometry_new IS NULL LIMIT 1) THEN
    RAISE EXCEPTION 'inspection_records has NULL geometry_new values - fix before continuing';
  END IF;

  -- Check inspection_records geometry is Point type (avoid unexpected types)
  IF EXISTS (
    SELECT 1 FROM inspection_records
    WHERE geometry_new IS NOT NULL AND GeometryType(geometry_new) != 'POINT'
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'inspection_records has non-Point geometry - must be Point type';
  END IF;
END $$;

-- Step 4: Rename old JSON columns (keep for rollback verification)
ALTER TABLE construction_events RENAME COLUMN geometry TO geometry_json;
ALTER TABLE road_assets RENAME COLUMN geometry TO geometry_json;
ALTER TABLE road_asset_changes RENAME COLUMN geometry TO geometry_json;
ALTER TABLE inspection_records RENAME COLUMN geometry TO geometry_json;

-- Step 5: Rename new columns to geometry
ALTER TABLE construction_events RENAME COLUMN geometry_new TO geometry;
ALTER TABLE road_assets RENAME COLUMN geometry_new TO geometry;
ALTER TABLE road_asset_changes RENAME COLUMN geometry_new TO geometry;
ALTER TABLE inspection_records RENAME COLUMN geometry_new TO geometry;

-- Step 6: Set NOT NULL constraints
ALTER TABLE construction_events ALTER COLUMN geometry SET NOT NULL;
ALTER TABLE road_assets ALTER COLUMN geometry SET NOT NULL;
ALTER TABLE inspection_records ALTER COLUMN geometry SET NOT NULL;
-- Note: road_asset_changes.geometry remains nullable

-- Step 7: Create GIST indexes (IF NOT EXISTS for safe re-runs)
CREATE INDEX IF NOT EXISTS idx_events_geometry_gist ON construction_events USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_assets_geometry_gist ON road_assets USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_changes_geometry_gist ON road_asset_changes USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_inspections_geometry_gist ON inspection_records USING GIST (geometry);

-- Step 8: Update statistics for query planner
ANALYZE construction_events;
ANALYZE road_assets;
ANALYZE road_asset_changes;
ANALYZE inspection_records;

-- Step 9: After validation passes, drop old JSON columns (run as separate migration 0003)
-- ALTER TABLE construction_events DROP COLUMN geometry_json;
-- ALTER TABLE road_assets DROP COLUMN geometry_json;
-- ALTER TABLE road_asset_changes DROP COLUMN geometry_json;
-- ALTER TABLE inspection_records DROP COLUMN geometry_json;

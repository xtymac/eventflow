-- ===========================================
-- Road Asset Edit Logs Migration
-- Log QGIS road edits for notification feature
-- ===========================================

CREATE TABLE IF NOT EXISTS "road_asset_edit_logs" (
  "id" varchar(50) PRIMARY KEY NOT NULL,
  "road_asset_id" varchar(50) NOT NULL,  -- NO FK to preserve delete logs
  "edit_type" varchar(20) NOT NULL,      -- 'create' | 'update' | 'delete'
  "road_name" varchar(255),
  "road_display_name" varchar(255),
  "road_ward" varchar(100),
  "road_type" varchar(50),
  "centroid" geometry(Point, 4326) NOT NULL,
  "bbox" jsonb,                          -- [minLng, minLat, maxLng, maxLat]
  "edit_source" varchar(20) DEFAULT 'manual',
  "edited_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS "idx_edit_logs_edited_at" ON "road_asset_edit_logs" ("edited_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_edit_logs_edit_source" ON "road_asset_edit_logs" ("edit_source");
CREATE INDEX IF NOT EXISTS "idx_edit_logs_road_asset_id" ON "road_asset_edit_logs" ("road_asset_id");

-- Trigger function to auto-log road_assets changes
CREATE OR REPLACE FUNCTION trg_road_assets_log_edit()
RETURNS TRIGGER AS $$
DECLARE
  log_id TEXT;
  target_geom geometry;
  target_id TEXT;
  target_name TEXT;
  target_display_name TEXT;
  target_ward TEXT;
  target_road_type TEXT;
  target_edit_source TEXT;
BEGIN
  -- Only log QGIS edits (sync_source = 'manual' or NULL)
  -- Skip OSM sync and API updates
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.sync_source IS NOT NULL AND NEW.sync_source NOT IN ('manual', 'initial', '') THEN
      RETURN NEW;
    END IF;
  END IF;

  -- For UPDATE: skip if no meaningful change (only updated_at changed)
  IF TG_OP = 'UPDATE' THEN
    IF OLD.geometry IS NOT DISTINCT FROM NEW.geometry
       AND OLD.name IS NOT DISTINCT FROM NEW.name
       AND OLD.display_name IS NOT DISTINCT FROM NEW.display_name
       AND OLD.road_type IS NOT DISTINCT FROM NEW.road_type
       AND OLD.ward IS NOT DISTINCT FROM NEW.ward
       AND OLD.status IS NOT DISTINCT FROM NEW.status
    THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Generate unique ID
  log_id := generate_random_id('REL-', 8);

  -- Set values based on operation
  IF TG_OP = 'DELETE' THEN
    target_geom := OLD.geometry;
    target_id := OLD.id;
    target_name := OLD.name;
    target_display_name := OLD.display_name;
    target_ward := OLD.ward;
    target_road_type := OLD.road_type;
    target_edit_source := COALESCE(OLD.sync_source, 'manual');
  ELSE
    target_geom := NEW.geometry;
    target_id := NEW.id;
    target_name := NEW.name;
    target_display_name := NEW.display_name;
    target_ward := NEW.ward;
    target_road_type := NEW.road_type;
    target_edit_source := COALESCE(NEW.sync_source, 'manual');
  END IF;

  -- Insert log entry
  INSERT INTO road_asset_edit_logs (
    id, road_asset_id, edit_type,
    road_name, road_display_name, road_ward, road_type,
    centroid, bbox, edit_source, edited_at
  ) VALUES (
    log_id,
    target_id,
    CASE TG_OP
      WHEN 'INSERT' THEN 'create'
      WHEN 'UPDATE' THEN 'update'
      WHEN 'DELETE' THEN 'delete'
    END,
    target_name,
    target_display_name,
    target_ward,
    target_road_type,
    ST_PointOnSurface(target_geom),  -- Works for both LineString and Polygon
    jsonb_build_array(
      ST_XMin(target_geom), ST_YMin(target_geom),
      ST_XMax(target_geom), ST_YMax(target_geom)
    ),
    target_edit_source,
    NOW()
  );

  -- Notify listeners for real-time push updates
  PERFORM pg_notify('road_edit', json_build_object(
    'id', log_id,
    'roadAssetId', target_id,
    'editType', CASE TG_OP
      WHEN 'INSERT' THEN 'create'
      WHEN 'UPDATE' THEN 'update'
      WHEN 'DELETE' THEN 'delete'
    END,
    'roadName', target_name,
    'roadDisplayName', target_display_name
  )::text);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create AFTER trigger
DROP TRIGGER IF EXISTS trg_road_assets_log_edit ON road_assets;
CREATE TRIGGER trg_road_assets_log_edit
  AFTER INSERT OR UPDATE OR DELETE ON road_assets
  FOR EACH ROW EXECUTE FUNCTION trg_road_assets_log_edit();

-- Grant permissions for QGIS users (trigger runs as table owner, but needs INSERT on log table)
GRANT ALL PRIVILEGES ON TABLE road_asset_edit_logs TO postgres;
GRANT INSERT, SELECT ON TABLE road_asset_edit_logs TO PUBLIC;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Road edit logs table and trigger created successfully';
END $$;

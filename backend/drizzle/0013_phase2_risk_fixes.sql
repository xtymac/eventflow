-- ===========================================
-- Migration 0013: Phase 2 Risk Fixes
-- R1: geometry_polygon for road_assets
-- R3: display_name_override + auto-compute trigger
-- R8: ward_boundaries index + lookup function
-- ===========================================

-- ==================
-- R1: Road Polygon Derived Field
-- Keep geometry as LineString, add geometry_polygon as derived Polygon
-- ==================

ALTER TABLE road_assets ADD COLUMN IF NOT EXISTS geometry_polygon geometry(Polygon, 4326);

-- Create GIST index on polygon column
CREATE INDEX IF NOT EXISTS idx_road_assets_geometry_polygon ON road_assets USING GIST (geometry_polygon);

-- Trigger function to auto-maintain geometry_polygon using ST_Buffer with geography cast
CREATE OR REPLACE FUNCTION trg_road_assets_update_polygon()
RETURNS TRIGGER AS $$
BEGIN
  -- Only compute if geometry is a LineString (not already a Polygon)
  IF ST_GeometryType(NEW.geometry) IN ('ST_LineString', 'ST_MultiLineString') THEN
    NEW.geometry_polygon := ST_Buffer(
      NEW.geometry::geography,
      CASE NEW.road_type
        WHEN 'arterial' THEN 10  -- 10m buffer for arterial roads
        WHEN 'collector' THEN 7  -- 7m buffer for collector roads
        ELSE 4                    -- 4m buffer for local roads
      END
    )::geometry;
  ELSE
    -- If geometry is already a Polygon, use it directly
    NEW.geometry_polygon := NEW.geometry;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_road_assets_polygon ON road_assets;
CREATE TRIGGER trg_road_assets_polygon
  BEFORE INSERT OR UPDATE OF geometry, road_type ON road_assets
  FOR EACH ROW EXECUTE FUNCTION trg_road_assets_update_polygon();

-- Backfill existing roads
UPDATE road_assets
SET geometry_polygon = ST_Buffer(
  geometry::geography,
  CASE road_type
    WHEN 'arterial' THEN 10
    WHEN 'collector' THEN 7
    ELSE 4
  END
)::geometry
WHERE geometry_polygon IS NULL
  AND ST_GeometryType(geometry) IN ('ST_LineString', 'ST_MultiLineString');

-- Comment
COMMENT ON COLUMN road_assets.geometry_polygon IS 'Auto-computed Polygon buffer from LineString geometry for visualization';

-- ==================
-- R3: Display Name Override
-- Add override flag so manual names are preserved
-- ==================

-- Add override flag to all asset tables that have display_name
ALTER TABLE road_assets ADD COLUMN IF NOT EXISTS display_name_override BOOLEAN DEFAULT FALSE;
ALTER TABLE river_assets ADD COLUMN IF NOT EXISTS display_name_override BOOLEAN DEFAULT FALSE;
ALTER TABLE greenspace_assets ADD COLUMN IF NOT EXISTS display_name_override BOOLEAN DEFAULT FALSE;

-- Trigger function to auto-compute display_name (only if not overridden and NULL)
CREATE OR REPLACE FUNCTION trg_compute_display_name()
RETURNS TRIGGER AS $$
BEGIN
  -- Only compute if display_name is NULL and not overridden
  IF NEW.display_name IS NULL AND NOT COALESCE(NEW.display_name_override, FALSE) THEN
    NEW.display_name := COALESCE(
      NEW.name_ja,
      NEW.name,
      CASE WHEN TG_TABLE_NAME = 'road_assets' THEN NEW.ref END,
      CASE WHEN TG_TABLE_NAME = 'road_assets' THEN NEW.local_ref END,
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to road_assets
DROP TRIGGER IF EXISTS trg_road_assets_display_name ON road_assets;
CREATE TRIGGER trg_road_assets_display_name
  BEFORE INSERT OR UPDATE ON road_assets
  FOR EACH ROW EXECUTE FUNCTION trg_compute_display_name();

-- Apply trigger to river_assets
DROP TRIGGER IF EXISTS trg_river_assets_display_name ON river_assets;
CREATE TRIGGER trg_river_assets_display_name
  BEFORE INSERT OR UPDATE ON river_assets
  FOR EACH ROW EXECUTE FUNCTION trg_compute_display_name();

-- Apply trigger to greenspace_assets
DROP TRIGGER IF EXISTS trg_greenspace_assets_display_name ON greenspace_assets;
CREATE TRIGGER trg_greenspace_assets_display_name
  BEFORE INSERT OR UPDATE ON greenspace_assets
  FOR EACH ROW EXECUTE FUNCTION trg_compute_display_name();

-- Comments
COMMENT ON COLUMN road_assets.display_name_override IS 'If TRUE, display_name is manually set and will not be auto-computed';
COMMENT ON COLUMN river_assets.display_name_override IS 'If TRUE, display_name is manually set and will not be auto-computed';
COMMENT ON COLUMN greenspace_assets.display_name_override IS 'If TRUE, display_name is manually set and will not be auto-computed';

-- ==================
-- R8: Ward Boundaries Index and Lookup Function
-- Ensure efficient ward lookup for new assets
-- ==================

-- Create ward_boundaries table if it doesn't exist (for storing GeoJSON boundaries)
CREATE TABLE IF NOT EXISTS ward_boundaries (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  name_ja VARCHAR(100),
  geometry geometry(Geometry, 4326) NOT NULL
);

-- Ensure GIST index exists
CREATE INDEX IF NOT EXISTS idx_ward_boundaries_geom ON ward_boundaries USING GIST (geometry);

-- Create efficient ward lookup function
CREATE OR REPLACE FUNCTION get_ward_for_geometry(geom geometry)
RETURNS VARCHAR(100) AS $$
DECLARE
  ward_name VARCHAR(100);
BEGIN
  SELECT name INTO ward_name
  FROM ward_boundaries
  WHERE ST_Intersects(geometry, geom)
  ORDER BY ST_Area(ST_Intersection(geometry, geom)) DESC
  LIMIT 1;
  RETURN ward_name;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function comment
COMMENT ON FUNCTION get_ward_for_geometry(geometry) IS 'Returns the ward name for a given geometry using spatial intersection';

-- ==================
-- ID Auto-generation for New Asset Types (for QGIS compatibility)
-- ==================

-- River assets ID auto-generation
CREATE OR REPLACE FUNCTION trg_river_assets_auto_id()
RETURNS TRIGGER AS $$
DECLARE
  new_id TEXT;
  attempts INT := 0;
BEGIN
  IF NEW.id IS NULL OR NEW.id = '' THEN
    LOOP
      new_id := generate_random_id('RV-', 8);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM river_assets WHERE id = new_id);
      attempts := attempts + 1;
      IF attempts > 10 THEN
        RAISE EXCEPTION 'Failed to generate unique river ID after 10 attempts';
      END IF;
    END LOOP;
    NEW.id := new_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_river_assets_id ON river_assets;
CREATE TRIGGER trg_river_assets_id
  BEFORE INSERT ON river_assets
  FOR EACH ROW EXECUTE FUNCTION trg_river_assets_auto_id();

-- Greenspace assets ID auto-generation
CREATE OR REPLACE FUNCTION trg_greenspace_assets_auto_id()
RETURNS TRIGGER AS $$
DECLARE
  new_id TEXT;
  attempts INT := 0;
BEGIN
  IF NEW.id IS NULL OR NEW.id = '' THEN
    LOOP
      new_id := generate_random_id('GS-', 8);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM greenspace_assets WHERE id = new_id);
      attempts := attempts + 1;
      IF attempts > 10 THEN
        RAISE EXCEPTION 'Failed to generate unique greenspace ID after 10 attempts';
      END IF;
    END LOOP;
    NEW.id := new_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_greenspace_assets_id ON greenspace_assets;
CREATE TRIGGER trg_greenspace_assets_id
  BEFORE INSERT ON greenspace_assets
  FOR EACH ROW EXECUTE FUNCTION trg_greenspace_assets_auto_id();

-- Streetlight assets ID auto-generation
CREATE OR REPLACE FUNCTION trg_streetlight_assets_auto_id()
RETURNS TRIGGER AS $$
DECLARE
  new_id TEXT;
  attempts INT := 0;
BEGIN
  IF NEW.id IS NULL OR NEW.id = '' THEN
    LOOP
      new_id := generate_random_id('SL-', 8);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM streetlight_assets WHERE id = new_id);
      attempts := attempts + 1;
      IF attempts > 10 THEN
        RAISE EXCEPTION 'Failed to generate unique streetlight ID after 10 attempts';
      END IF;
    END LOOP;
    NEW.id := new_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_streetlight_assets_id ON streetlight_assets;
CREATE TRIGGER trg_streetlight_assets_id
  BEFORE INSERT ON streetlight_assets
  FOR EACH ROW EXECUTE FUNCTION trg_streetlight_assets_auto_id();

-- ==================
-- Update Statistics
-- ==================
ANALYZE road_assets;
ANALYZE river_assets;
ANALYZE greenspace_assets;
ANALYZE streetlight_assets;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Migration 0013 completed:';
  RAISE NOTICE '- R1: geometry_polygon column and trigger added to road_assets';
  RAISE NOTICE '- R3: display_name_override and auto-compute trigger added';
  RAISE NOTICE '- R8: ward_boundaries table, index, and lookup function created';
  RAISE NOTICE '- ID auto-generation triggers for new asset types';
END $$;

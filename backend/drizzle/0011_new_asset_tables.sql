-- Migration: Create new asset type tables (rivers, green spaces, street lights)

-- ============================================
-- River Assets Table
-- Supports both LineString (centerline) and Polygon (water body)
-- ============================================
CREATE TABLE IF NOT EXISTS river_assets (
  id VARCHAR(50) PRIMARY KEY,

  -- Name fields
  name VARCHAR(255),
  name_ja VARCHAR(255),
  display_name VARCHAR(255),

  -- Geometry (LineString or Polygon)
  geometry geometry(Geometry, 4326) NOT NULL,
  geometry_type VARCHAR(20) NOT NULL DEFAULT 'line',

  -- River-specific fields
  waterway_type VARCHAR(50),
  water_type VARCHAR(50),
  width INT,
  management_level VARCHAR(50),
  maintainer VARCHAR(100),

  -- Status and location
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  ward VARCHAR(100),

  -- Data source tracking
  data_source VARCHAR(20) DEFAULT 'manual',
  source_version VARCHAR(100),
  source_date TIMESTAMP WITH TIME ZONE,
  last_verified_at TIMESTAMP WITH TIME ZONE,

  -- OSM tracking
  osm_type VARCHAR(10),
  osm_id BIGINT,
  osm_timestamp TIMESTAMP WITH TIME ZONE,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  is_manually_edited BOOLEAN DEFAULT FALSE,

  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- River indexes
CREATE INDEX IF NOT EXISTS idx_rivers_status ON river_assets(status);
CREATE INDEX IF NOT EXISTS idx_rivers_waterway_type ON river_assets(waterway_type);
CREATE INDEX IF NOT EXISTS idx_rivers_geometry_type ON river_assets(geometry_type);
CREATE INDEX IF NOT EXISTS idx_rivers_data_source ON river_assets(data_source);
CREATE INDEX IF NOT EXISTS idx_rivers_ward ON river_assets(ward);
CREATE INDEX IF NOT EXISTS idx_rivers_geometry_gist ON river_assets USING GIST (geometry);

-- Unique constraint for OSM upsert (required for ON CONFLICT)
ALTER TABLE river_assets ADD CONSTRAINT river_assets_osm_unique UNIQUE (osm_type, osm_id);

-- CHECK constraint for geometry_type consistency (supports Multi* for OSM relations)
ALTER TABLE river_assets ADD CONSTRAINT chk_river_geometry_type CHECK (
  (geometry_type = 'line' AND ST_GeometryType(geometry) IN ('ST_LineString', 'ST_MultiLineString')) OR
  (geometry_type = 'polygon' AND ST_GeometryType(geometry) IN ('ST_Polygon', 'ST_MultiPolygon')) OR
  (geometry_type = 'collection' AND ST_GeometryType(geometry) = 'ST_GeometryCollection')
);

-- Comments
COMMENT ON TABLE river_assets IS 'River and waterway assets for infrastructure management';
COMMENT ON COLUMN river_assets.geometry_type IS 'line for centerline representation, polygon for area representation';
COMMENT ON COLUMN river_assets.waterway_type IS 'OSM waterway tag: river, stream, canal, drain';
COMMENT ON COLUMN river_assets.water_type IS 'OSM water tag for polygon features: river, pond, lake';

-- ============================================
-- Green Space Assets Table
-- Parks, plazas, green areas (Polygon only)
-- ============================================
CREATE TABLE IF NOT EXISTS greenspace_assets (
  id VARCHAR(50) PRIMARY KEY,

  -- Name fields
  name VARCHAR(255),
  name_ja VARCHAR(255),
  display_name VARCHAR(255),

  -- Geometry (always Polygon)
  geometry geometry(Polygon, 4326) NOT NULL,

  -- Green space-specific fields
  green_space_type VARCHAR(50) NOT NULL,
  leisure_type VARCHAR(50),
  landuse_type VARCHAR(50),
  natural_type VARCHAR(50),
  area_m2 INT,
  vegetation_type VARCHAR(100),
  operator VARCHAR(255),

  -- Status and location
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  ward VARCHAR(100),

  -- Data source tracking
  data_source VARCHAR(20) DEFAULT 'manual',
  source_version VARCHAR(100),
  source_date TIMESTAMP WITH TIME ZONE,
  last_verified_at TIMESTAMP WITH TIME ZONE,

  -- OSM tracking
  osm_type VARCHAR(10),
  osm_id BIGINT,
  osm_timestamp TIMESTAMP WITH TIME ZONE,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  is_manually_edited BOOLEAN DEFAULT FALSE,

  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Green space indexes
CREATE INDEX IF NOT EXISTS idx_greenspaces_status ON greenspace_assets(status);
CREATE INDEX IF NOT EXISTS idx_greenspaces_type ON greenspace_assets(green_space_type);
CREATE INDEX IF NOT EXISTS idx_greenspaces_data_source ON greenspace_assets(data_source);
CREATE INDEX IF NOT EXISTS idx_greenspaces_ward ON greenspace_assets(ward);
CREATE INDEX IF NOT EXISTS idx_greenspaces_geometry_gist ON greenspace_assets USING GIST (geometry);

-- Unique constraint for OSM upsert (required for ON CONFLICT)
ALTER TABLE greenspace_assets ADD CONSTRAINT greenspace_assets_osm_unique UNIQUE (osm_type, osm_id);

-- Comments
COMMENT ON TABLE greenspace_assets IS 'Parks, plazas, and green space assets';
COMMENT ON COLUMN greenspace_assets.green_space_type IS 'Type: park, garden, grass, forest, meadow, playground';
COMMENT ON COLUMN greenspace_assets.area_m2 IS 'Area in square meters, computed from geometry';

-- ============================================
-- Street Light Assets Table
-- Point geometry
-- ============================================
CREATE TABLE IF NOT EXISTS streetlight_assets (
  id VARCHAR(50) PRIMARY KEY,

  -- Identification
  lamp_id VARCHAR(50),
  display_name VARCHAR(255),

  -- Geometry (always Point)
  geometry geometry(Point, 4326) NOT NULL,

  -- Street light-specific fields
  lamp_type VARCHAR(50) NOT NULL,
  wattage INT,
  install_date TIMESTAMP WITH TIME ZONE,
  lamp_status VARCHAR(20) NOT NULL DEFAULT 'operational',

  -- Reference to road
  road_ref VARCHAR(50),

  -- Status and location
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  ward VARCHAR(100),

  -- Data source tracking
  data_source VARCHAR(20) DEFAULT 'manual',
  source_version VARCHAR(100),
  source_date TIMESTAMP WITH TIME ZONE,
  last_verified_at TIMESTAMP WITH TIME ZONE,

  -- OSM tracking
  osm_type VARCHAR(10),
  osm_id BIGINT,
  osm_timestamp TIMESTAMP WITH TIME ZONE,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  is_manually_edited BOOLEAN DEFAULT FALSE,

  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Street light indexes
CREATE INDEX IF NOT EXISTS idx_streetlights_status ON streetlight_assets(status);
CREATE INDEX IF NOT EXISTS idx_streetlights_lamp_status ON streetlight_assets(lamp_status);
CREATE INDEX IF NOT EXISTS idx_streetlights_lamp_type ON streetlight_assets(lamp_type);
CREATE INDEX IF NOT EXISTS idx_streetlights_data_source ON streetlight_assets(data_source);
CREATE INDEX IF NOT EXISTS idx_streetlights_ward ON streetlight_assets(ward);
CREATE INDEX IF NOT EXISTS idx_streetlights_geometry_gist ON streetlight_assets USING GIST (geometry);

-- Unique constraint for OSM upsert (required for ON CONFLICT)
ALTER TABLE streetlight_assets ADD CONSTRAINT streetlight_assets_osm_unique UNIQUE (osm_type, osm_id);

-- Comments
COMMENT ON TABLE streetlight_assets IS 'Street lighting infrastructure assets';
COMMENT ON COLUMN streetlight_assets.lamp_type IS 'Light type: led, sodium, mercury, fluorescent';
COMMENT ON COLUMN streetlight_assets.lamp_status IS 'Equipment status: operational, maintenance, damaged, replaced';
COMMENT ON COLUMN streetlight_assets.status IS 'Data lifecycle status: active, inactive';

-- ============================================
-- Views for convenience
-- ============================================

-- River lines view (for LineString rivers)
CREATE OR REPLACE VIEW river_lines AS
SELECT * FROM river_assets WHERE geometry_type = 'line';

-- River polygons view (for water body polygons)
CREATE OR REPLACE VIEW river_polygons AS
SELECT * FROM river_assets WHERE geometry_type = 'polygon';

-- Comments on views
COMMENT ON VIEW river_lines IS 'View of river centerlines (LineString geometry)';
COMMENT ON VIEW river_polygons IS 'View of river water bodies (Polygon geometry)';

-- Update statistics
ANALYZE river_assets;
ANALYZE greenspace_assets;
ANALYZE streetlight_assets;

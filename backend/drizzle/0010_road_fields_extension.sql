-- Migration: Extend road_assets with new fields for polygon support and data source tracking
-- This migration adds new columns without changing existing geometry

-- Phase 1: Add road polygon-specific fields
ALTER TABLE road_assets ADD COLUMN IF NOT EXISTS cross_section VARCHAR(100);
ALTER TABLE road_assets ADD COLUMN IF NOT EXISTS managing_dept VARCHAR(100);
ALTER TABLE road_assets ADD COLUMN IF NOT EXISTS intersection VARCHAR(255);
ALTER TABLE road_assets ADD COLUMN IF NOT EXISTS pavement_state VARCHAR(50);

-- Phase 2: Add data source tracking fields
ALTER TABLE road_assets ADD COLUMN IF NOT EXISTS data_source VARCHAR(20) DEFAULT 'manual';
ALTER TABLE road_assets ADD COLUMN IF NOT EXISTS source_version VARCHAR(100);
ALTER TABLE road_assets ADD COLUMN IF NOT EXISTS source_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE road_assets ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMP WITH TIME ZONE;

-- Phase 3: Add OSM type field for node/way/relation distinction
ALTER TABLE road_assets ADD COLUMN IF NOT EXISTS osm_type VARCHAR(10);

-- Phase 4: Create new indexes
CREATE INDEX IF NOT EXISTS idx_assets_data_source ON road_assets(data_source);
CREATE INDEX IF NOT EXISTS idx_assets_ward ON road_assets(ward);

-- Phase 5: Update existing records to set default data_source
UPDATE road_assets SET data_source = 'osm_test' WHERE osm_id IS NOT NULL AND data_source IS NULL;
UPDATE road_assets SET data_source = 'manual' WHERE data_source IS NULL;

-- Set osm_type for existing records
UPDATE road_assets SET osm_type = 'way' WHERE osm_id IS NOT NULL AND osm_type IS NULL;

-- Comments
COMMENT ON COLUMN road_assets.cross_section IS 'Road cross-section type/profile';
COMMENT ON COLUMN road_assets.managing_dept IS 'Department responsible for road management';
COMMENT ON COLUMN road_assets.intersection IS 'Intersection description or reference';
COMMENT ON COLUMN road_assets.pavement_state IS 'Current pavement condition';
COMMENT ON COLUMN road_assets.data_source IS 'Data source: osm_test, official_ledger, or manual';
COMMENT ON COLUMN road_assets.source_version IS 'Version identifier of the data source';
COMMENT ON COLUMN road_assets.source_date IS 'Date when the source data was published';
COMMENT ON COLUMN road_assets.last_verified_at IS 'Last verification date';
COMMENT ON COLUMN road_assets.osm_type IS 'OSM element type: node, way, or relation';

-- Update statistics
ANALYZE road_assets;

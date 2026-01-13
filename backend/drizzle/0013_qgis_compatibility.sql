-- Migration: QGIS Compatibility Fixes
-- Adds gid column for QGIS editing support
-- Adds default values for required fields
-- Grants proper permissions to nagoya_editor

-- Add gid serial column for QGIS compatibility
ALTER TABLE road_assets ADD COLUMN IF NOT EXISTS gid SERIAL;

-- Add default values for QGIS editing (fields that were NOT NULL without defaults)
ALTER TABLE road_assets ALTER COLUMN road_type SET DEFAULT 'unclassified';
ALTER TABLE road_assets ALTER COLUMN direction SET DEFAULT 'both';
ALTER TABLE road_assets ALTER COLUMN valid_from SET DEFAULT NOW();

-- Grant full permissions to nagoya_editor for QGIS editing
GRANT ALL PRIVILEGES ON road_assets TO nagoya_editor;
GRANT ALL PRIVILEGES ON SEQUENCE road_assets_gid_seq TO nagoya_editor;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO nagoya_editor;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO nagoya_editor;

-- Grant permissions for edit logs table
GRANT ALL PRIVILEGES ON road_asset_edit_logs TO nagoya_editor;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'QGIS compatibility migration completed successfully';
END $$;

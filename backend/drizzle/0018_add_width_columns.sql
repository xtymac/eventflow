-- Add width columns to road_assets table
-- These columns track OSM width information

ALTER TABLE road_assets
  ADD COLUMN IF NOT EXISTS width NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS width_source VARCHAR(20) DEFAULT 'default';

COMMENT ON COLUMN road_assets.width IS 'OSM width tag in meters';
COMMENT ON COLUMN road_assets.width_source IS 'Source of width data: osm_width, osm_lanes, or default';

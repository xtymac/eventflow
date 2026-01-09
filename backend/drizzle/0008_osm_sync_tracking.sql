-- Migration: 0008_osm_sync_tracking
-- Description: Add OSM sync tracking fields and sync logs table
-- Date: 2026-01-07

-- ============================================
-- Part 1: Add OSM tracking fields to road_assets
-- ============================================

-- Sublocality field (from Google Maps reverse geocoding)
ALTER TABLE road_assets ADD COLUMN IF NOT EXISTS sublocality VARCHAR(255);
COMMENT ON COLUMN road_assets.sublocality IS 'Town/district name from Google Maps reverse geocoding';

-- OSM way tracking fields
ALTER TABLE road_assets ADD COLUMN IF NOT EXISTS osm_id BIGINT;
ALTER TABLE road_assets ADD COLUMN IF NOT EXISTS segment_index INT DEFAULT 0;
ALTER TABLE road_assets ADD COLUMN IF NOT EXISTS osm_timestamp TIMESTAMP WITH TIME ZONE;
ALTER TABLE road_assets ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP WITH TIME ZONE;

-- Sync source and manual edit protection
ALTER TABLE road_assets ADD COLUMN IF NOT EXISTS sync_source VARCHAR(20) DEFAULT 'initial';
ALTER TABLE road_assets ADD COLUMN IF NOT EXISTS is_manually_edited BOOLEAN DEFAULT FALSE;

-- Add comments for documentation
COMMENT ON COLUMN road_assets.osm_id IS 'OpenStreetMap way ID for tracking';
COMMENT ON COLUMN road_assets.segment_index IS 'Segment index within the same OSM way (after intersection splitting)';
COMMENT ON COLUMN road_assets.osm_timestamp IS 'OSM way last modified timestamp';
COMMENT ON COLUMN road_assets.last_synced_at IS 'Last sync timestamp from Overpass API';
COMMENT ON COLUMN road_assets.sync_source IS 'Sync source: initial, osm-sync, manual';
COMMENT ON COLUMN road_assets.is_manually_edited IS 'If true, this road will not be updated by OSM sync';

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_road_assets_osm_segment
  ON road_assets(osm_id, segment_index)
  WHERE osm_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_road_assets_last_synced
  ON road_assets(last_synced_at);

CREATE INDEX IF NOT EXISTS idx_road_assets_manually_edited
  ON road_assets(is_manually_edited)
  WHERE is_manually_edited = TRUE;

-- ============================================
-- Part 2: Create OSM sync logs table
-- ============================================

CREATE TABLE IF NOT EXISTS osm_sync_logs (
  id VARCHAR(50) PRIMARY KEY,
  sync_type VARCHAR(20) NOT NULL,  -- 'bbox', 'ward', 'full'
  bbox_param VARCHAR(255),          -- 'minLng,minLat,maxLng,maxLat'
  ward_param VARCHAR(100),
  status VARCHAR(20) NOT NULL,      -- 'running', 'completed', 'failed', 'partial'
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,

  -- Statistics
  osm_roads_fetched INT DEFAULT 0,
  roads_created INT DEFAULT 0,
  roads_updated INT DEFAULT 0,
  roads_marked_inactive INT DEFAULT 0,
  roads_skipped INT DEFAULT 0,

  -- Error tracking
  error_message TEXT,
  error_details JSONB,

  -- Metadata
  triggered_by VARCHAR(100),  -- 'cron-hourly', 'cron-daily', 'frontend-user', etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments for documentation
COMMENT ON TABLE osm_sync_logs IS 'Log table for OSM synchronization operations';
COMMENT ON COLUMN osm_sync_logs.sync_type IS 'Type of sync: bbox (viewport), ward (administrative), full';
COMMENT ON COLUMN osm_sync_logs.status IS 'Sync status: running, completed, failed, partial';
COMMENT ON COLUMN osm_sync_logs.roads_skipped IS 'Roads skipped due to manual edit protection';
COMMENT ON COLUMN osm_sync_logs.triggered_by IS 'Source that triggered the sync';

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_osm_sync_logs_started
  ON osm_sync_logs(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_osm_sync_logs_status
  ON osm_sync_logs(status);

CREATE INDEX IF NOT EXISTS idx_osm_sync_logs_sync_type
  ON osm_sync_logs(sync_type);

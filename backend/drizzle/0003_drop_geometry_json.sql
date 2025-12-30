-- Migration: Drop backup geometry_json columns
-- IMPORTANT: Only run this AFTER confirming production stability (1-2 weeks recommended)
-- These columns were kept for rollback safety during the PostGIS migration

ALTER TABLE construction_events DROP COLUMN geometry_json;
ALTER TABLE road_assets DROP COLUMN geometry_json;
ALTER TABLE road_asset_changes DROP COLUMN geometry_json;
ALTER TABLE inspection_records DROP COLUMN geometry_json;

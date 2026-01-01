-- Migration: Add name_source and name_confidence columns for traceability
-- This is an ALTER TABLE migration - no data loss

-- Add traceability columns
ALTER TABLE road_assets ADD COLUMN IF NOT EXISTS name_source VARCHAR(20);
ALTER TABLE road_assets ADD COLUMN IF NOT EXISTS name_confidence VARCHAR(10);

-- Add comments for documentation
COMMENT ON COLUMN road_assets.name_source IS 'Source of name: osm, municipal, manual';
COMMENT ON COLUMN road_assets.name_confidence IS 'Match confidence: high, medium, low';

-- Backfill: Set name_source='osm' for existing named roads
-- This preserves the source information for roads that already have displayName from OSM
UPDATE road_assets
SET name_source = 'osm'
WHERE display_name IS NOT NULL
  AND name_source IS NULL;

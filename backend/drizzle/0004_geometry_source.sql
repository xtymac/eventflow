-- Migration: Add geometry_source column to construction_events
-- Tracks whether geometry was manually drawn ('manual') or auto-generated from road assets ('auto')

-- Add geometry_source column with default 'manual'
ALTER TABLE construction_events
ADD COLUMN geometry_source VARCHAR(20) DEFAULT 'manual';

-- Backfill existing records (all historical data = 'manual')
UPDATE construction_events SET geometry_source = 'manual' WHERE geometry_source IS NULL;

-- Migration: Add refAsset columns to construction_events
-- Purpose: Enable singular asset reference from Event (per Event Creation spec)

-- Add refAsset columns
ALTER TABLE construction_events ADD COLUMN ref_asset_id varchar(50);
ALTER TABLE construction_events ADD COLUMN ref_asset_type varchar(50);

-- CHECK: Both must be NULL or both must be NOT NULL (paired constraint)
ALTER TABLE construction_events ADD CONSTRAINT chk_ref_asset_paired
  CHECK ((ref_asset_id IS NULL AND ref_asset_type IS NULL)
      OR (ref_asset_id IS NOT NULL AND ref_asset_type IS NOT NULL));

-- Composite index for "find events by asset type + id" queries
CREATE INDEX idx_events_ref_asset ON construction_events (ref_asset_type, ref_asset_id);

-- Single-column index for ref_asset_id lookups
CREATE INDEX idx_events_ref_asset_id ON construction_events (ref_asset_id);

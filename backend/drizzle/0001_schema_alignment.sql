-- Migration: Schema alignment for Phase 2
-- Creates event_road_assets join table and updates inspection_records to use FKs

-- 1. Create join table with CHECK constraint
CREATE TABLE event_road_assets (
  event_id VARCHAR(50) NOT NULL REFERENCES construction_events(id) ON DELETE CASCADE,
  road_asset_id VARCHAR(50) NOT NULL REFERENCES road_assets(id) ON DELETE CASCADE,
  relation_type VARCHAR(20) DEFAULT 'affected'
    CHECK (relation_type IN ('affected', 'updated')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (event_id, road_asset_id)
);

-- Index for efficient lookups by road_asset_id
CREATE INDEX idx_event_road_assets_asset ON event_road_assets (road_asset_id);

-- 2. Migrate existing data from array to join table
INSERT INTO event_road_assets (event_id, road_asset_id, relation_type)
SELECT id, unnest(affected_road_asset_ids), 'affected'
FROM construction_events
WHERE affected_road_asset_ids IS NOT NULL
  AND array_length(affected_road_asset_ids, 1) > 0;

-- 3. Drop old array column
ALTER TABLE construction_events DROP COLUMN affected_road_asset_ids;

-- 4. Modify inspection_records: add FK columns
ALTER TABLE inspection_records
  ADD COLUMN event_id VARCHAR(50) REFERENCES construction_events(id) ON DELETE SET NULL,
  ADD COLUMN road_asset_id_fk VARCHAR(50) REFERENCES road_assets(id) ON DELETE SET NULL;

-- 5. Migrate data from polymorphic to FK pattern
UPDATE inspection_records SET event_id = related_id WHERE related_type = 'event';
UPDATE inspection_records SET road_asset_id_fk = related_id WHERE related_type = 'asset';

-- 6. Drop old polymorphic columns
ALTER TABLE inspection_records
  DROP COLUMN related_type,
  DROP COLUMN related_id;

-- 7. Rename temporary column
ALTER TABLE inspection_records RENAME COLUMN road_asset_id_fk TO road_asset_id;

-- 8. Add CHECK constraint (exactly one FK must be set)
ALTER TABLE inspection_records
  ADD CONSTRAINT chk_inspection_one_parent
  CHECK ((event_id IS NOT NULL) <> (road_asset_id IS NOT NULL));

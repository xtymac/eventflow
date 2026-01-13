-- =====================================================
-- Migration 0015: Road Asset New Fields
-- =====================================================
-- Adds 8 new fields to road_assets table:
-- Road Details: cross_section, managing_dept, intersection, pavement_state
-- Data Source Tracking: data_source, source_version, source_date, last_verified_at
-- =====================================================

-- Step 1: Add Road Details fields
ALTER TABLE road_assets ADD COLUMN IF NOT EXISTS cross_section VARCHAR(255);
ALTER TABLE road_assets ADD COLUMN IF NOT EXISTS managing_dept VARCHAR(255);
ALTER TABLE road_assets ADD COLUMN IF NOT EXISTS intersection VARCHAR(255);
ALTER TABLE road_assets ADD COLUMN IF NOT EXISTS pavement_state VARCHAR(255);

-- Step 2: Add Data Source Tracking fields
ALTER TABLE road_assets ADD COLUMN IF NOT EXISTS data_source VARCHAR(50) DEFAULT 'manual';
ALTER TABLE road_assets ADD COLUMN IF NOT EXISTS source_version VARCHAR(100);
ALTER TABLE road_assets ADD COLUMN IF NOT EXISTS source_date TIMESTAMPTZ;
ALTER TABLE road_assets ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

-- Step 3: Set existing rows to 'manual' data_source (in case any are NULL)
UPDATE road_assets SET data_source = 'manual' WHERE data_source IS NULL;

-- Step 4: Make data_source NOT NULL
ALTER TABLE road_assets ALTER COLUMN data_source SET NOT NULL;

-- Step 5: Add CHECK constraint for data_source enum
ALTER TABLE road_assets DROP CONSTRAINT IF EXISTS chk_road_assets_data_source;
ALTER TABLE road_assets ADD CONSTRAINT chk_road_assets_data_source
  CHECK (data_source IN ('osm_test', 'official_ledger', 'manual'));

-- Step 6: Add comments
COMMENT ON COLUMN road_assets.cross_section IS 'Road cross-section description';
COMMENT ON COLUMN road_assets.managing_dept IS 'Department managing this road segment';
COMMENT ON COLUMN road_assets.intersection IS 'Nearby intersection or landmark';
COMMENT ON COLUMN road_assets.pavement_state IS 'Current pavement condition';
COMMENT ON COLUMN road_assets.data_source IS 'Data source: osm_test, official_ledger, or manual';
COMMENT ON COLUMN road_assets.source_version IS 'Version of the data source';
COMMENT ON COLUMN road_assets.source_date IS 'Date when source data was captured';
COMMENT ON COLUMN road_assets.last_verified_at IS 'Date when this record was last verified';

-- Step 7: Update statistics
ANALYZE road_assets;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Migration 0015 completed successfully:';
  RAISE NOTICE '- Road details fields added: cross_section, managing_dept, intersection, pavement_state';
  RAISE NOTICE '- Data source tracking fields added: data_source, source_version, source_date, last_verified_at';
  RAISE NOTICE '- data_source set to NOT NULL with CHECK constraint';
END $$;

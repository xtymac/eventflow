-- =====================================================
-- Migration 0014: Data Source Constraints
-- =====================================================
-- Note: Migration 0013 already created geometry_polygon column
-- and set up triggers. This migration focuses on data_source
-- constraints only.
-- =====================================================

-- Step 1: Ensure all NULL data_source values are set to 'manual'
UPDATE road_assets SET data_source = 'manual' WHERE data_source IS NULL;

-- Step 2: Make data_source NOT NULL
ALTER TABLE road_assets ALTER COLUMN data_source SET NOT NULL;

-- Step 3: Add CHECK constraint for enum validation
ALTER TABLE road_assets DROP CONSTRAINT IF EXISTS chk_road_assets_data_source;
ALTER TABLE road_assets ADD CONSTRAINT chk_road_assets_data_source
  CHECK (data_source IN ('osm_test', 'official_ledger', 'manual'));

-- Step 4: Update statistics
ANALYZE road_assets;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Migration 0014 completed successfully:';
  RAISE NOTICE '- data_source set to NOT NULL with default "manual"';
  RAISE NOTICE '- CHECK constraint added for data_source enum validation';
END $$;

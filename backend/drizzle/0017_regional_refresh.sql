-- Migration: Add regional_refresh column to import_versions
-- Implements incremental-by-default import strategy with optional regional refresh mode
--
-- Default behavior: Only add/update roads, never deactivate (safe incremental update)
-- Regional Refresh mode: When enabled, roads in scope but not in import are deactivated

ALTER TABLE import_versions
ADD COLUMN IF NOT EXISTS regional_refresh BOOLEAN NOT NULL DEFAULT FALSE;

-- Comment
COMMENT ON COLUMN import_versions.regional_refresh IS
  'When true, roads in scope but not in import file will be deactivated. When false (default), only add/update operations occur.';

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 0017 completed: Added regional_refresh column to import_versions';
  RAISE NOTICE '- Default: false (incremental update only, no deactivation)';
  RAISE NOTICE '- When true: enables regional refresh mode (deactivate missing roads within scope)';
END $$;

-- Migration: Create import versioning tables for GeoPackage/GeoJSON import system
-- Supports: Upload → Validate → Preview → Publish workflow with rollback capability

-- ============================================
-- Import Versions Table
-- Tracks each import with version metadata and status
-- ============================================
CREATE TABLE IF NOT EXISTS import_versions (
  id VARCHAR(50) PRIMARY KEY,  -- 'IV-<nanoid>'
  version_number INT NOT NULL,  -- Sequential (1, 2, 3...)
  status VARCHAR(20) NOT NULL,  -- 'draft' | 'published' | 'archived'

  -- File information
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(20) NOT NULL,  -- 'geojson' | 'geopackage'
  file_path VARCHAR(500) NOT NULL,
  layer_name VARCHAR(100),  -- Selected GPKG layer (null for GeoJSON)
  source_crs VARCHAR(20),  -- User-specified source CRS (e.g., 'EPSG:4326')

  -- Import configuration
  import_scope VARCHAR(255) NOT NULL,  -- 'full' | 'ward:中区' | 'bbox:...'
  default_data_source VARCHAR(20) NOT NULL,  -- Batch default for missing dataSource

  -- Statistics
  file_size_mb NUMERIC(10, 2),
  feature_count INT NOT NULL,

  -- Audit trail
  uploaded_by VARCHAR(100),
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  published_by VARCHAR(100),
  archived_at TIMESTAMP WITH TIME ZONE,

  -- Rollback support
  snapshot_path VARCHAR(500),  -- Path to pre-publish snapshot file

  -- User notes
  notes TEXT
);

-- Import versions indexes
CREATE INDEX IF NOT EXISTS idx_import_versions_status ON import_versions(status);
CREATE INDEX IF NOT EXISTS idx_import_versions_uploaded ON import_versions(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_versions_version ON import_versions(version_number DESC);

-- CHECK constraints
ALTER TABLE import_versions ADD CONSTRAINT chk_import_versions_status
  CHECK (status IN ('draft', 'published', 'archived'));
ALTER TABLE import_versions ADD CONSTRAINT chk_import_versions_file_type
  CHECK (file_type IN ('geojson', 'geopackage'));
ALTER TABLE import_versions ADD CONSTRAINT chk_import_versions_data_source
  CHECK (default_data_source IN ('osm_test', 'official_ledger', 'manual'));

-- Comments
COMMENT ON TABLE import_versions IS 'Tracks GeoPackage/GeoJSON import versions with audit trail';
COMMENT ON COLUMN import_versions.version_number IS 'Sequential version number, auto-incremented';
COMMENT ON COLUMN import_versions.status IS 'Lifecycle status: draft (unpublished), published (active), archived (superseded)';
COMMENT ON COLUMN import_versions.import_scope IS 'Scope for deactivation: full (city-wide), ward:<name>, bbox:<coords>';
COMMENT ON COLUMN import_versions.snapshot_path IS 'Path to GeoJSON snapshot file for rollback support';

-- ============================================
-- Import Jobs Table
-- Tracks async job progress for validation, publish, rollback
-- ============================================
CREATE TABLE IF NOT EXISTS import_jobs (
  id VARCHAR(50) PRIMARY KEY,  -- 'IJ-<nanoid>'
  version_id VARCHAR(50) NOT NULL REFERENCES import_versions(id) ON DELETE CASCADE,
  job_type VARCHAR(20) NOT NULL,  -- 'validation' | 'publish' | 'rollback'
  status VARCHAR(20) NOT NULL,  -- 'pending' | 'running' | 'completed' | 'failed'
  progress INT DEFAULT 0,  -- 0-100 percent
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  result_summary JSONB  -- { added, updated, deactivated, unchanged, errors }
);

-- Import jobs indexes
CREATE INDEX IF NOT EXISTS idx_import_jobs_version ON import_jobs(version_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_started ON import_jobs(started_at DESC);

-- CHECK constraints
ALTER TABLE import_jobs ADD CONSTRAINT chk_import_jobs_type
  CHECK (job_type IN ('validation', 'publish', 'rollback'));
ALTER TABLE import_jobs ADD CONSTRAINT chk_import_jobs_status
  CHECK (status IN ('pending', 'running', 'completed', 'failed'));
ALTER TABLE import_jobs ADD CONSTRAINT chk_import_jobs_progress
  CHECK (progress >= 0 AND progress <= 100);

-- Comments
COMMENT ON TABLE import_jobs IS 'Tracks async job progress for import operations';
COMMENT ON COLUMN import_jobs.job_type IS 'Type of job: validation, publish, or rollback';
COMMENT ON COLUMN import_jobs.progress IS 'Job progress percentage (0-100)';
COMMENT ON COLUMN import_jobs.result_summary IS 'JSON summary of job results: added, updated, deactivated counts';

-- ============================================
-- Helper function for version numbering
-- ============================================
CREATE OR REPLACE FUNCTION get_next_import_version_number()
RETURNS INT AS $$
DECLARE
  next_version INT;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_version FROM import_versions;
  RETURN next_version;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_next_import_version_number IS 'Returns the next sequential version number for imports';

-- Update statistics
ANALYZE import_versions;
ANALYZE import_jobs;

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 0016 completed successfully:';
  RAISE NOTICE '- import_versions table created with status/scope tracking';
  RAISE NOTICE '- import_jobs table created for async job progress';
  RAISE NOTICE '- CHECK constraints added for status, file_type, data_source, job_type';
  RAISE NOTICE '- get_next_import_version_number() helper function created';
END $$;

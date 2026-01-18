-- Export Records table for precise import comparison
-- Tracks exported road IDs so imports can accurately detect added/updated/removed roads

CREATE TABLE IF NOT EXISTS export_records (
  id VARCHAR(50) PRIMARY KEY,
  export_scope VARCHAR(255) NOT NULL,
  format VARCHAR(20) NOT NULL,
  road_ids JSONB NOT NULL,
  feature_count INTEGER NOT NULL,
  exported_by VARCHAR(100),
  exported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient lookup by export time
CREATE INDEX IF NOT EXISTS idx_export_records_exported_at ON export_records(exported_at);

-- Add source_export_id to import_versions for linking imports to exports
ALTER TABLE import_versions ADD COLUMN IF NOT EXISTS source_export_id VARCHAR(50);

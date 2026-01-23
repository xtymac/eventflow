-- Migration: Fix geometry_source defaults and backfill legacy data

ALTER TABLE construction_events
  ALTER COLUMN geometry_source SET DEFAULT 'manual';

UPDATE construction_events
SET geometry_source = 'manual'
WHERE geometry_source IS NULL
  AND geometry IS NOT NULL;

UPDATE construction_events
SET geometry_source = 'auto'
WHERE geometry_source IS NULL
  AND geometry IS NULL;

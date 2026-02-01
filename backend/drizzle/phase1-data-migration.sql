-- ================================================
-- Phase 1: Data Migration - ended → pending_review
-- Run AFTER phase1-workorders.sql
-- ================================================

-- Migrate existing 'ended' events to 'pending_review'
-- These events will need Gov close action to move to 'closed'
UPDATE construction_events
SET status = 'pending_review',
    updated_at = NOW()
WHERE status = 'ended';

-- Report migration count
DO $$
DECLARE
  migrated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO migrated_count
  FROM construction_events
  WHERE status = 'pending_review';

  RAISE NOTICE 'Phase 1 Migration: % events now in pending_review status', migrated_count;
END $$;

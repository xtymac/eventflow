-- Migration: Add archived_at column to construction_events
-- Enables archiving ended events to hide them from default views

-- Add archived_at column (nullable timestamp)
ALTER TABLE construction_events
ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE;

-- Add index for efficient filtering
CREATE INDEX idx_events_archived ON construction_events (archived_at);

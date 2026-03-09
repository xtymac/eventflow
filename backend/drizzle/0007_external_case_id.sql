-- Add external_case_id column for contractor case ID resolution
ALTER TABLE construction_events ADD COLUMN external_case_id varchar(50);

-- Unique partial index: only enforced when external_case_id is not null
CREATE UNIQUE INDEX idx_events_external_case_id ON construction_events (external_case_id) WHERE external_case_id IS NOT NULL;

-- Fix review_status column length to accommodate 'accepted_by_authority' (21 chars)
ALTER TABLE evidence
ALTER COLUMN review_status TYPE VARCHAR(30);

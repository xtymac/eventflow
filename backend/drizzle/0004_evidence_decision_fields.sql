-- Evidence Attachment: Add submitter identity and government decision tracking fields

-- Add submitter identity fields
ALTER TABLE evidence
ADD COLUMN submitter_partner_id VARCHAR(50),
ADD COLUMN submitter_role VARCHAR(20);

-- Add government decision tracking fields
ALTER TABLE evidence
ADD COLUMN decision_by VARCHAR(100),
ADD COLUMN decision_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN decision_notes TEXT;

-- Note: review_status values are enforced at application level, not DB constraint
-- Valid values: 'pending' | 'approved' | 'rejected' | 'accepted_by_authority'

COMMENT ON COLUMN evidence.submitter_partner_id IS 'Partner ID who submitted (from X-Partner-Id header)';
COMMENT ON COLUMN evidence.submitter_role IS 'Role of submitter: partner or gov_inspector';
COMMENT ON COLUMN evidence.decision_by IS 'Government role who made final decision (from X-User-Role header)';
COMMENT ON COLUMN evidence.decision_at IS 'Timestamp of government decision';
COMMENT ON COLUMN evidence.decision_notes IS 'Notes/reason for government decision';
COMMENT ON COLUMN evidence.review_status IS 'Review workflow status: pending -> approved/rejected -> accepted_by_authority';

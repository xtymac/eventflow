-- PoC: Same-DB Multi-Table — decisions + audit_logs tables
-- Migration 0006: Add standalone Decision and unified Audit Log tables

-- ============================================================
-- Decisions table — standalone decision records
-- Replaces embedded decision state in evidence.review_status
-- and construction_events.closedBy/closedAt
-- ============================================================
CREATE TABLE IF NOT EXISTS "decisions" (
  "id"                varchar(50)  PRIMARY KEY NOT NULL,

  -- Polymorphic entity reference (same pattern as inspection_records.asset_type/asset_id)
  "entity_type"       varchar(30)  NOT NULL,   -- 'event' | 'evidence' | 'work_order' | 'asset_condition' | 'inspection'
  "entity_id"         varchar(50)  NOT NULL,

  -- Decision content
  "decision_type"     varchar(50)  NOT NULL,   -- 'event_close' | 'evidence_accept' | 'evidence_reject' | 'condition_change' | 'work_order_approve'
  "outcome"           varchar(30)  NOT NULL,   -- 'approved' | 'rejected' | 'deferred' | 'escalated'
  "rationale"         text,
  "conditions"        text,

  -- State transition snapshot
  "previous_status"   varchar(30),
  "new_status"        varchar(30),

  -- Decision maker
  "decided_by"        varchar(100) NOT NULL,
  "decided_by_role"   varchar(30)  NOT NULL,
  "decided_at"        timestamp with time zone NOT NULL DEFAULT now(),

  -- Metadata
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"        timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for decisions
CREATE INDEX IF NOT EXISTS idx_decisions_entity       ON decisions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_decisions_entity_id    ON decisions(entity_id);
CREATE INDEX IF NOT EXISTS idx_decisions_type         ON decisions(decision_type);
CREATE INDEX IF NOT EXISTS idx_decisions_outcome      ON decisions(outcome);
CREATE INDEX IF NOT EXISTS idx_decisions_decided_by   ON decisions(decided_by);
CREATE INDEX IF NOT EXISTS idx_decisions_decided_at   ON decisions(decided_at);

COMMENT ON TABLE decisions IS 'PoC: Standalone decision records for event closure, evidence finalization, asset condition changes';
COMMENT ON COLUMN decisions.entity_type IS 'Polymorphic FK: event | evidence | work_order | asset_condition | inspection';
COMMENT ON COLUMN decisions.entity_id IS 'ID of the entity this decision applies to (no hard FK for flexibility)';


-- ============================================================
-- Audit Logs table — unified audit trail (append-only)
-- Replaces fragmented road_asset_edit_logs, osm_sync_logs, etc.
-- ============================================================
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id"                varchar(50)  PRIMARY KEY NOT NULL,

  -- Polymorphic entity reference
  "entity_type"       varchar(30)  NOT NULL,   -- 'event' | 'work_order' | 'evidence' | 'decision' | 'road_asset' | 'park_facility' | ...
  "entity_id"         varchar(50)  NOT NULL,

  -- Action details
  "action"            varchar(30)  NOT NULL,   -- 'create' | 'update' | 'delete' | 'status_change' | 'close' | 'archive' | 'assign' | 'decision'
  "description"       text,

  -- Before/after snapshots (JSONB for flexibility across all entity types)
  "before_snapshot"   jsonb,
  "after_snapshot"    jsonb,
  "changed_fields"    jsonb,                   -- e.g. ["status", "closedBy"] for efficient filtering

  -- Actor identity
  "actor"             varchar(100) NOT NULL,
  "actor_role"        varchar(30),
  "actor_partner_id"  varchar(50),

  -- Request context
  "ip_address"        varchar(45),
  "request_id"        varchar(50),

  -- Decision link
  "decision_id"       varchar(50),             -- FK to decisions.id (nullable)

  -- Append-only: no updated_at
  "created_at"        timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_entity              ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity_id           ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_action              ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_actor               ON audit_logs(actor);
CREATE INDEX IF NOT EXISTS idx_audit_created_at          ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_decision_id         ON audit_logs(decision_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity_type_created ON audit_logs(entity_type, created_at DESC);

COMMENT ON TABLE audit_logs IS 'PoC: Unified audit trail — who did what to which object, when';
COMMENT ON COLUMN audit_logs.before_snapshot IS 'JSONB snapshot of relevant fields before the action (null for create)';
COMMENT ON COLUMN audit_logs.after_snapshot IS 'JSONB snapshot of relevant fields after the action (null for delete)';
COMMENT ON COLUMN audit_logs.changed_fields IS 'Array of field names that changed, for efficient filtering';

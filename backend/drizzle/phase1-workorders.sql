-- ================================================
-- Phase 1: WorkOrder / Evidence / Notifications
-- Migration script for nagoya-construction-lifecycle
-- ================================================

-- Add close tracking fields to construction_events
ALTER TABLE construction_events
ADD COLUMN IF NOT EXISTS closed_by VARCHAR(100),
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS notify_master_data BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notification_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS close_notes TEXT;

-- Work orders table - tasks spawned from events
CREATE TABLE IF NOT EXISTS work_orders (
  id VARCHAR(50) PRIMARY KEY,
  event_id VARCHAR(50) NOT NULL REFERENCES construction_events(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  assigned_dept VARCHAR(100),
  assigned_by VARCHAR(100),
  assigned_at TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  reviewed_by VARCHAR(100),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_by VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Work order locations - points/geometries associated with a work order
CREATE TABLE IF NOT EXISTS work_order_locations (
  id VARCHAR(50) PRIMARY KEY,
  work_order_id VARCHAR(50) NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  geometry GEOMETRY(Geometry, 4326) NOT NULL,
  asset_type VARCHAR(20),
  asset_id VARCHAR(50),
  note TEXT,
  sequence_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Work order partners - contractors/partners assigned to work orders
CREATE TABLE IF NOT EXISTS work_order_partners (
  work_order_id VARCHAR(50) NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  partner_id VARCHAR(50) NOT NULL,
  partner_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'contractor',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (work_order_id, partner_id)
);

-- Evidence table - photos, documents, reports attached to work orders
CREATE TABLE IF NOT EXISTS evidence (
  id VARCHAR(50) PRIMARY KEY,
  work_order_id VARCHAR(50) NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size_bytes INTEGER,
  mime_type VARCHAR(100),
  title VARCHAR(255),
  description TEXT,
  capture_date TIMESTAMPTZ,
  geometry GEOMETRY(Point, 4326),
  submitted_by VARCHAR(100) NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by VARCHAR(100),
  reviewed_at TIMESTAMPTZ,
  review_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  review_notes TEXT
);

-- Outbox notifications - Event DB → Master Data DB notification boundary
CREATE TABLE IF NOT EXISTS outbox_notifications (
  id VARCHAR(50) PRIMARY KEY,
  event_id VARCHAR(50) NOT NULL REFERENCES construction_events(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  error_message TEXT
);

-- Indexes for work_orders
CREATE INDEX IF NOT EXISTS idx_workorders_event_id ON work_orders(event_id);
CREATE INDEX IF NOT EXISTS idx_workorders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_workorders_type ON work_orders(type);
CREATE INDEX IF NOT EXISTS idx_workorders_due_date ON work_orders(due_date);

-- Indexes for work_order_locations
CREATE INDEX IF NOT EXISTS idx_wo_locations_workorder_id ON work_order_locations(work_order_id);
CREATE INDEX IF NOT EXISTS idx_wo_locations_asset_type ON work_order_locations(asset_type);

-- Indexes for work_order_partners
CREATE INDEX IF NOT EXISTS idx_wo_partners_partner_id ON work_order_partners(partner_id);

-- Indexes for evidence
CREATE INDEX IF NOT EXISTS idx_evidence_workorder_id ON evidence(work_order_id);
CREATE INDEX IF NOT EXISTS idx_evidence_type ON evidence(type);
CREATE INDEX IF NOT EXISTS idx_evidence_review_status ON evidence(review_status);

-- Indexes for outbox_notifications
CREATE INDEX IF NOT EXISTS idx_outbox_event_id ON outbox_notifications(event_id);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox_notifications(status);
CREATE INDEX IF NOT EXISTS idx_outbox_type ON outbox_notifications(notification_type);

-- GIST indexes for geometry columns (spatial queries)
CREATE INDEX IF NOT EXISTS idx_wo_locations_geometry ON work_order_locations USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_evidence_geometry ON evidence USING GIST(geometry);

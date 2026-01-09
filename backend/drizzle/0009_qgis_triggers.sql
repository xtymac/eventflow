-- ===========================================
-- QGIS Triggers Migration
-- Auto-generates IDs and maintains critical fields
-- ===========================================

-- ==================
-- PART 1: ID Generation Triggers
-- ==================

-- Helper function to generate nanoid-like random string
CREATE OR REPLACE FUNCTION generate_random_id(prefix TEXT, length INT DEFAULT 8)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN prefix || result;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for construction_events
CREATE OR REPLACE FUNCTION trg_construction_events_auto_id()
RETURNS TRIGGER AS $$
DECLARE
  new_id TEXT;
  attempts INT := 0;
BEGIN
  IF NEW.id IS NULL OR NEW.id = '' THEN
    LOOP
      new_id := generate_random_id('CE-', 8);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM construction_events WHERE id = new_id);
      attempts := attempts + 1;
      IF attempts > 10 THEN
        RAISE EXCEPTION 'Failed to generate unique ID after 10 attempts';
      END IF;
    END LOOP;
    NEW.id := new_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_construction_events_id ON construction_events;
CREATE TRIGGER trg_construction_events_id
  BEFORE INSERT ON construction_events
  FOR EACH ROW EXECUTE FUNCTION trg_construction_events_auto_id();

-- Trigger function for road_assets
CREATE OR REPLACE FUNCTION trg_road_assets_auto_id()
RETURNS TRIGGER AS $$
DECLARE
  new_id TEXT;
  attempts INT := 0;
BEGIN
  IF NEW.id IS NULL OR NEW.id = '' THEN
    LOOP
      new_id := generate_random_id('RA-', 8);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM road_assets WHERE id = new_id);
      attempts := attempts + 1;
      IF attempts > 10 THEN
        RAISE EXCEPTION 'Failed to generate unique ID after 10 attempts';
      END IF;
    END LOOP;
    NEW.id := new_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_road_assets_id ON road_assets;
CREATE TRIGGER trg_road_assets_id
  BEFORE INSERT ON road_assets
  FOR EACH ROW EXECUTE FUNCTION trg_road_assets_auto_id();

-- Trigger function for inspection_records
CREATE OR REPLACE FUNCTION trg_inspection_records_auto_id()
RETURNS TRIGGER AS $$
DECLARE
  new_id TEXT;
  attempts INT := 0;
BEGIN
  IF NEW.id IS NULL OR NEW.id = '' THEN
    LOOP
      new_id := generate_random_id('INS-', 8);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM inspection_records WHERE id = new_id);
      attempts := attempts + 1;
      IF attempts > 10 THEN
        RAISE EXCEPTION 'Failed to generate unique ID after 10 attempts';
      END IF;
    END LOOP;
    NEW.id := new_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inspection_records_id ON inspection_records;
CREATE TRIGGER trg_inspection_records_id
  BEFORE INSERT ON inspection_records
  FOR EACH ROW EXECUTE FUNCTION trg_inspection_records_auto_id();

-- ==================
-- PART 2: Auto-set is_manually_edited for road_assets
-- ==================

CREATE OR REPLACE FUNCTION trg_road_assets_mark_manual()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-set sync_source='manual' for QGIS edits (when not explicitly set by API)
  -- Check for NULL, empty string, or 'initial' (default value)
  IF NEW.sync_source IS NULL OR NEW.sync_source = '' OR NEW.sync_source = 'initial' THEN
    NEW.sync_source := 'manual';
  END IF;

  -- Auto-set is_manually_edited=true for QGIS edits (when sync_source is 'manual')
  -- This ensures OSM sync won't overwrite manually edited roads
  IF NEW.sync_source = 'manual' AND (NEW.is_manually_edited IS NULL OR NEW.is_manually_edited = FALSE) THEN
    NEW.is_manually_edited := TRUE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_road_assets_manual_mark ON road_assets;
CREATE TRIGGER trg_road_assets_manual_mark
  BEFORE INSERT OR UPDATE ON road_assets
  FOR EACH ROW EXECUTE FUNCTION trg_road_assets_mark_manual();

-- ==================
-- PART 3: (Optional) Auto-audit road_asset changes
-- Uncomment if you want automated audit trail
-- ==================

-- CREATE OR REPLACE FUNCTION trg_road_assets_audit()
-- RETURNS TRIGGER AS $$
-- DECLARE
--   audit_id TEXT;
-- BEGIN
--   IF TG_OP = 'UPDATE' THEN
--     audit_id := generate_random_id('RAC-', 8);
--     INSERT INTO road_asset_changes (
--       id, event_id, change_type, old_road_asset_id, new_road_asset_id, geometry, created_at
--     ) VALUES (
--       audit_id, NULL, 'update', NEW.id, NEW.id, NEW.geometry, NOW()
--     );
--   END IF;
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
--
-- DROP TRIGGER IF EXISTS trg_road_assets_audit ON road_assets;
-- CREATE TRIGGER trg_road_assets_audit
--   AFTER UPDATE ON road_assets
--   FOR EACH ROW EXECUTE FUNCTION trg_road_assets_audit();

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'QGIS triggers created successfully:';
  RAISE NOTICE '- ID auto-generation for construction_events (CE-)';
  RAISE NOTICE '- ID auto-generation for road_assets (RA-)';
  RAISE NOTICE '- ID auto-generation for inspection_records (INS-)';
  RAISE NOTICE '- Auto-set is_manually_edited=true for road_assets';
END $$;

-- ===========================================
-- QGIS Editor User Creation Script
-- Run as superuser: docker exec -i nagoya-db psql -U postgres -d nagoya_construction < backend/scripts/create_qgis_user.sql
-- ===========================================

-- 1. Create role
CREATE ROLE nagoya_editor LOGIN PASSWORD 'CHANGE_ME_TO_STRONG_PASSWORD';
COMMENT ON ROLE nagoya_editor IS 'QGIS editor role with limited permissions';

-- 2. Grant connection privileges
GRANT CONNECT ON DATABASE nagoya_construction TO nagoya_editor;
GRANT USAGE ON SCHEMA public TO nagoya_editor;

-- 3. Grant table-specific permissions

-- construction_events: SELECT + UPDATE only (no INSERT - complex associations)
GRANT SELECT, UPDATE ON construction_events TO nagoya_editor;

-- road_assets: Full edit (SELECT, INSERT, UPDATE)
GRANT SELECT, INSERT, UPDATE ON road_assets TO nagoya_editor;

-- event_road_assets: READ ONLY (composite PK, managed by API)
GRANT SELECT ON event_road_assets TO nagoya_editor;

-- inspection_records: SELECT + INSERT only (append-only audit trail)
GRANT SELECT, INSERT ON inspection_records TO nagoya_editor;

-- road_asset_changes: READ ONLY (audit table, managed by triggers/API)
GRANT SELECT ON road_asset_changes TO nagoya_editor;

-- osm_sync_logs: READ ONLY (operational logs)
GRANT SELECT ON osm_sync_logs TO nagoya_editor;

-- 4. Grant sequence privileges (if any exist)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nagoya_editor;

-- 5. Revoke dangerous permissions explicitly
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM nagoya_editor;

-- 6. Success message
DO $$
BEGIN
  RAISE NOTICE 'User nagoya_editor created successfully';
  RAISE NOTICE 'IMPORTANT: Change the password immediately using:';
  RAISE NOTICE 'ALTER USER nagoya_editor WITH PASSWORD ''your_strong_password'';';
END $$;

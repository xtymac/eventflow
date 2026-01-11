-- PostgreSQL Logical Replication Publisher Initialization
-- Run this script on EC2 PostgreSQL to set up replication
--
-- Usage:
--   PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d nagoya_construction \
--     -v REPLICATION_PASSWORD="'your_secure_password'" -f scripts/init-publisher.sql
--
-- Or interactively:
--   docker exec -it nagoya-db psql -U postgres -d nagoya_construction
--   \i /path/to/init-publisher.sql

-- ============================================
-- 1. Create replication user
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'replication_user') THEN
        -- Use the password from variable or default
        EXECUTE 'CREATE USER replication_user WITH REPLICATION LOGIN PASSWORD ''XPVHA7vSN6V7FbNRYNY7PO3W''';
        RAISE NOTICE 'Created replication_user';
    ELSE
        RAISE NOTICE 'replication_user already exists';
    END IF;
END $$;

-- ============================================
-- 2. Grant permissions (including future tables)
-- ============================================

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO replication_user;

-- Grant SELECT on all existing tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO replication_user;

-- Grant SELECT on future tables (important!)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO replication_user;

-- ============================================
-- 3. Create publication for all tables
-- ============================================

-- Drop existing publication if exists (for clean setup)
DROP PUBLICATION IF EXISTS eventflow_publication;

-- Create publication for ALL tables (auto-includes new tables)
CREATE PUBLICATION eventflow_publication FOR ALL TABLES;

-- ============================================
-- 4. Verify setup
-- ============================================

-- Show publication info
SELECT
    pubname AS publication_name,
    puballtables AS includes_all_tables,
    pubinsert AS replicates_insert,
    pubupdate AS replicates_update,
    pubdelete AS replicates_delete,
    pubtruncate AS replicates_truncate
FROM pg_publication
WHERE pubname = 'eventflow_publication';

-- Show tables in publication
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'eventflow_publication'
ORDER BY tablename;

-- Show replication user permissions
SELECT
    r.rolname AS role_name,
    r.rolreplication AS has_replication,
    r.rolcanlogin AS can_login
FROM pg_roles r
WHERE r.rolname = 'replication_user';

-- ============================================
-- Notes for pg_hba.conf
-- ============================================
-- Add these lines to pg_hba.conf (or use Docker command args):
--
-- # Allow replication connections from any host (for SSH tunnel)
-- host replication replication_user 0.0.0.0/0 scram-sha-256
-- host all replication_user 0.0.0.0/0 scram-sha-256
--
-- Then restart PostgreSQL

\echo ''
\echo '============================================'
\echo '  PostgreSQL Publisher Setup Complete!'
\echo '============================================'
\echo ''
\echo 'Next steps:'
\echo '1. Update replication_user password in .env.sync'
\echo '2. Ensure pg_hba.conf allows replication connections'
\echo '3. Restart PostgreSQL if pg_hba.conf was modified'
\echo '4. Update EC2 docker-compose.yml with wal_level=logical'
\echo ''

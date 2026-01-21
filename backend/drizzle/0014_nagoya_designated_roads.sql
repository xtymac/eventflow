-- Migration: Nagoya Designated Roads Tables
-- Stores designated road data from 名古屋市指定道路図 MVT tiles

-- Create nanoid function if not exists
CREATE OR REPLACE FUNCTION nanoid(size int DEFAULT 21)
RETURNS text AS $$
DECLARE
  id text := '';
  i int := 0;
  urlAlphabet char(64) := 'ModuleSymbhasOwnPr-0123456789ABCDEFGHNRVfgctiUvz_KqYTJkLxpZXIjQW';
  bytes bytea := gen_random_bytes(size);
  byte int;
  pos int;
BEGIN
  WHILE i < size LOOP
    byte := get_byte(bytes, i);
    pos := (byte & 63) + 1;
    id := id || substr(urlAlphabet, pos, 1);
    i := i + 1;
  END LOOP;
  RETURN id;
END
$$ LANGUAGE PLPGSQL STABLE;

-- LineString features from MVT sync
CREATE TABLE IF NOT EXISTS nagoya_designated_roads (
  id VARCHAR(50) PRIMARY KEY DEFAULT 'NDR-' || nanoid(),
  source_layer VARCHAR(100) NOT NULL,
  dedup_key VARCHAR(255) NOT NULL,
  keycode VARCHAR(100),
  daicyo_ban VARCHAR(100),
  gid INTEGER,
  encyo VARCHAR(100),
  fukuin VARCHAR(100),
  kyoka_ban VARCHAR(100),
  kyoka_ymd VARCHAR(50),
  shitei_ban VARCHAR(100),
  shitei_ymd VARCHAR(50),
  filename VARCHAR(500),
  raw_props JSONB,
  geometry GEOMETRY(LineString, 4326) NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(source_layer, dedup_key)
);

-- Polygon features from MVT sync
CREATE TABLE IF NOT EXISTS nagoya_designated_areas (
  id VARCHAR(50) PRIMARY KEY DEFAULT 'NDA-' || nanoid(),
  source_layer VARCHAR(100) NOT NULL,
  dedup_key VARCHAR(255) NOT NULL,
  keycode VARCHAR(100),
  daicyo_ban VARCHAR(100),
  gid INTEGER,
  encyo VARCHAR(100),
  fukuin VARCHAR(100),
  kyoka_ban VARCHAR(100),
  kyoka_ymd VARCHAR(50),
  shitei_ban VARCHAR(100),
  shitei_ymd VARCHAR(50),
  filename VARCHAR(500),
  raw_props JSONB,
  geometry GEOMETRY(Polygon, 4326) NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(source_layer, dedup_key)
);

-- Sync logs table
CREATE TABLE IF NOT EXISTS nagoya_sync_logs (
  id VARCHAR(50) PRIMARY KEY,
  status VARCHAR(20) NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  total_tiles INTEGER NOT NULL,
  completed_tiles INTEGER NOT NULL DEFAULT 0,
  error_tiles INTEGER NOT NULL DEFAULT 0,
  roads_created INTEGER NOT NULL DEFAULT 0,
  roads_updated INTEGER NOT NULL DEFAULT 0,
  areas_created INTEGER NOT NULL DEFAULT 0,
  areas_updated INTEGER NOT NULL DEFAULT 0,
  resume_state JSONB,
  error_message TEXT,
  error_details JSONB
);

-- Road asset links for spatial matching
CREATE TABLE IF NOT EXISTS road_asset_nagoya_links (
  id SERIAL PRIMARY KEY,
  road_asset_id VARCHAR(50) NOT NULL REFERENCES road_assets(id) ON DELETE CASCADE,
  nagoya_road_id VARCHAR(50) NOT NULL REFERENCES nagoya_designated_roads(id) ON DELETE CASCADE,
  match_type VARCHAR(20),
  match_confidence FLOAT,
  overlap_meters FLOAT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(road_asset_id, nagoya_road_id)
);

-- Create GIST indexes for spatial queries
CREATE INDEX IF NOT EXISTS idx_nagoya_roads_geom ON nagoya_designated_roads USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_nagoya_areas_geom ON nagoya_designated_areas USING GIST(geometry);

-- Create indexes for filtering
CREATE INDEX IF NOT EXISTS idx_nagoya_roads_layer ON nagoya_designated_roads(source_layer);
CREATE INDEX IF NOT EXISTS idx_nagoya_roads_daicyo ON nagoya_designated_roads(daicyo_ban);
CREATE INDEX IF NOT EXISTS idx_nagoya_areas_layer ON nagoya_designated_areas(source_layer);
CREATE INDEX IF NOT EXISTS idx_nagoya_sync_status ON nagoya_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_nagoya_sync_started ON nagoya_sync_logs(started_at);

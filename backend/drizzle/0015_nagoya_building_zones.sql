-- Migration: Nagoya Building Zones Table
-- Stores building-related regulation zones from 名古屋市指定道路図 kenchiku data source

CREATE TABLE IF NOT EXISTS nagoya_building_zones (
  id VARCHAR(50) PRIMARY KEY DEFAULT 'NBZ-' || nanoid(),
  source_layer VARCHAR(100) NOT NULL,
  dedup_key VARCHAR(255) NOT NULL,
  gid INTEGER,
  keycode VARCHAR(100),
  -- Building zone-specific fields
  zone_type VARCHAR(100),      -- 区域種別
  name VARCHAR(255),
  kyotei_name VARCHAR(255),    -- 協定名称
  kubun VARCHAR(100),          -- 区分
  nintei_ymd VARCHAR(50),      -- 認定日
  nintei_no VARCHAR(100),      -- 認定番号
  shitei_ymd VARCHAR(50),      -- 指定日
  kokoku_ymd VARCHAR(50),      -- 告告日
  menseki VARCHAR(50),         -- 面積
  raw_props JSONB,
  geometry GEOMETRY(Polygon, 4326) NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(source_layer, dedup_key)
);

-- Create GIST index for spatial queries
CREATE INDEX IF NOT EXISTS idx_nagoya_building_zones_geom ON nagoya_building_zones USING GIST(geometry);

-- Create index for source layer filtering
CREATE INDEX IF NOT EXISTS idx_nagoya_building_zones_layer ON nagoya_building_zones(source_layer);

-- Create index for zone type filtering
CREATE INDEX IF NOT EXISTS idx_nagoya_building_zones_type ON nagoya_building_zones(zone_type);

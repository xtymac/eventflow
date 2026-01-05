-- Sample data for Nagoya Construction Lifecycle
-- This script creates sample construction events and road assets for testing

-- Sample Event 1: Road widening project in Nakamura Ward
INSERT INTO construction_events (
  id, name, status, start_date, end_date, restriction_type,
  post_end_decision, department, ward, created_by, updated_at,
  geometry, geometry_source
) VALUES (
  'CE-SAMPLE-001',
  '中村区道路拡幅工事',
  'in_progress',
  '2026-01-01 00:00:00+09',
  '2026-06-30 23:59:59+09',
  'partial_closure',
  'maintain',
  '名古屋市中村区土木事務所',
  '中村区',
  'system',
  NOW(),
  ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[136.88,35.17],[136.89,35.17],[136.89,35.18],[136.88,35.18],[136.88,35.17]]]}'),
  'manual'
);

-- Sample Event 2: Bridge repair in Naka Ward
INSERT INTO construction_events (
  id, name, status, start_date, end_date, restriction_type,
  post_end_decision, department, ward, created_by, updated_at,
  geometry, geometry_source
) VALUES (
  'CE-SAMPLE-002',
  '中区橋梁補修工事',
  'planned',
  '2026-02-01 00:00:00+09',
  '2026-08-31 23:59:59+09',
  'full_closure',
  'remove',
  '名古屋市中区土木事務所',
  '中区',
  'system',
  NOW(),
  ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[136.91,35.16],[136.92,35.16],[136.92,35.17],[136.91,35.17],[136.91,35.16]]]}'),
  'manual'
);

-- Sample Event 3: Water pipe replacement in Higashi Ward
INSERT INTO construction_events (
  id, name, status, start_date, end_date, restriction_type,
  post_end_decision, department, ward, created_by, updated_at,
  geometry, geometry_source
) VALUES (
  'CE-SAMPLE-003',
  '東区上水道管更新工事',
  'in_progress',
  '2025-12-15 00:00:00+09',
  '2026-03-31 23:59:59+09',
  'lane_reduction',
  'pending',
  '名古屋市上下水道局',
  '東区',
  'system',
  NOW(),
  ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[136.93,35.18],[136.94,35.18],[136.94,35.19],[136.93,35.19],[136.93,35.18]]]}'),
  'manual'
);

-- Sample Event 4: Completed project in Chikusa Ward
INSERT INTO construction_events (
  id, name, status, start_date, end_date, restriction_type,
  post_end_decision, department, ward, created_by, updated_at,
  geometry, geometry_source
) VALUES (
  'CE-SAMPLE-004',
  '千種区道路舗装工事',
  'completed',
  '2025-10-01 00:00:00+09',
  '2025-12-31 23:59:59+09',
  'night_only',
  'remove',
  '名古屋市千種区土木事務所',
  '千種区',
  'system',
  NOW(),
  ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[136.95,35.16],[136.96,35.16],[136.96,35.17],[136.95,35.17],[136.95,35.16]]]}'),
  'manual'
);

-- Sample Road Assets for Event 1
INSERT INTO road_assets (
  id, name, name_ja, ref, local_ref, display_name,
  road_type, lanes, direction, status,
  owner_department, ward, landmark,
  geometry, valid_from, valid_to, updated_at
) VALUES
(
  'RA-SAMPLE-001',
  'Meieki-dori Avenue',
  '名駅通',
  NULL,
  '市道中村1号',
  '名駅通（拡幅前）',
  'primary',
  2,
  'both',
  'active',
  '中村区土木事務所',
  '中村区',
  '名古屋駅付近',
  ST_GeomFromGeoJSON('{"type":"LineString","coordinates":[[136.88,35.17],[136.89,35.175]]}'),
  '2020-01-01 00:00:00+09',
  '2026-06-30 23:59:59+09',
  NOW()
),
(
  'RA-SAMPLE-002',
  'Meieki-dori Avenue',
  '名駅通',
  NULL,
  '市道中村1号',
  '名駅通（拡幅後）',
  'primary',
  4,
  'both',
  'planned',
  '中村区土木事務所',
  '中村区',
  '名古屋駅付近',
  ST_GeomFromGeoJSON('{"type":"LineString","coordinates":[[136.88,35.17],[136.89,35.175]]}'),
  '2026-07-01 00:00:00+09',
  NULL,
  NOW()
);

-- Link road assets to event
INSERT INTO event_road_assets (event_id, road_asset_id, relation_type, created_at)
VALUES
  ('CE-SAMPLE-001', 'RA-SAMPLE-001', 'affected', NOW()),
  ('CE-SAMPLE-001', 'RA-SAMPLE-002', 'updated', NOW());

-- Sample Road Asset for Event 2
INSERT INTO road_assets (
  id, name, name_ja, ref, local_ref, display_name,
  road_type, lanes, direction, status,
  owner_department, ward, landmark,
  geometry, valid_from, valid_to, updated_at
) VALUES (
  'RA-SAMPLE-003',
  'Shirakawa Bridge',
  '白川橋',
  NULL,
  NULL,
  '白川橋',
  'secondary',
  2,
  'both',
  'maintenance',
  '中区土木事務所',
  '中区',
  '白川公園前',
  ST_GeomFromGeoJSON('{"type":"LineString","coordinates":[[136.91,35.165],[136.915,35.165]]}'),
  '1990-01-01 00:00:00+09',
  NULL,
  NOW()
);

INSERT INTO event_road_assets (event_id, road_asset_id, relation_type, created_at)
VALUES ('CE-SAMPLE-002', 'RA-SAMPLE-003', 'affected', NOW());

-- Sample Inspection Record
INSERT INTO inspection_records (
  id, event_id, inspection_date, result, notes, geometry, created_at
) VALUES (
  'INS-SAMPLE-001',
  'CE-SAMPLE-003',
  '2026-01-02 10:00:00',
  '工事進捗良好',
  '安全対策適切。次回点検：2026-02-01',
  ST_GeomFromGeoJSON('{"type":"Point","coordinates":[136.93,35.185]}'),
  NOW()
);

-- Summary output
SELECT
  (SELECT COUNT(*) FROM construction_events) as total_events,
  (SELECT COUNT(*) FROM road_assets) as total_assets,
  (SELECT COUNT(*) FROM event_road_assets) as event_asset_links,
  (SELECT COUNT(*) FROM inspection_records) as total_inspections;

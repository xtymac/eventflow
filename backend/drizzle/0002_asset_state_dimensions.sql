-- Governance-level state dimensions for all asset types
-- condition: 'good' | 'attention' | 'bad' | 'unknown'
-- risk_level: 'low' | 'medium' | 'high'
-- NULL means "not yet assessed" (set by Decision in future)

ALTER TABLE road_assets ADD COLUMN condition varchar(20);
ALTER TABLE road_assets ADD COLUMN risk_level varchar(20);

ALTER TABLE river_assets ADD COLUMN condition varchar(20);
ALTER TABLE river_assets ADD COLUMN risk_level varchar(20);

ALTER TABLE greenspace_assets ADD COLUMN condition varchar(20);
ALTER TABLE greenspace_assets ADD COLUMN risk_level varchar(20);

ALTER TABLE streetlight_assets ADD COLUMN condition varchar(20);
ALTER TABLE streetlight_assets ADD COLUMN risk_level varchar(20);

ALTER TABLE street_tree_assets ADD COLUMN condition varchar(20);
ALTER TABLE street_tree_assets ADD COLUMN risk_level varchar(20);

ALTER TABLE park_facilities ADD COLUMN condition varchar(20);
ALTER TABLE park_facilities ADD COLUMN risk_level varchar(20);

ALTER TABLE pavement_sections ADD COLUMN condition varchar(20);
ALTER TABLE pavement_sections ADD COLUMN risk_level varchar(20);

ALTER TABLE pump_stations ADD COLUMN condition varchar(20);
ALTER TABLE pump_stations ADD COLUMN risk_level varchar(20);

-- Migration: RFI Entity Types
-- Adds: street_tree_assets, park_facilities, pavement_sections, pump_stations, lifecycle_plans
-- Expands: inspection_records with cross-asset support
-- Includes: CHECK constraints, GIST spatial indexes, backfill

-- ============================================
-- 1. New Tables
-- ============================================

CREATE TABLE "street_tree_assets" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"ledger_id" varchar(100),
	"display_name" varchar(255),
	"species_name" varchar(255),
	"scientific_name" varchar(255),
	"category" varchar(50) NOT NULL,
	"trunk_diameter" numeric(6, 1),
	"height" numeric(5, 1),
	"crown_spread" numeric(5, 1),
	"date_planted" timestamp with time zone,
	"estimated_age" integer,
	"health_status" varchar(50) NOT NULL,
	"condition_grade" varchar(10),
	"last_diagnostic_date" timestamp with time zone,
	"diagnostic_notes" text,
	"geometry" geometry(Point, 4326) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"ward" varchar(100),
	"managing_dept" varchar(100),
	"road_ref" varchar(50),
	"green_space_ref" varchar(50),
	"data_source" varchar(20) DEFAULT 'manual',
	"source_version" varchar(100),
	"source_date" timestamp with time zone,
	"last_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "park_facilities" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"facility_id" varchar(100),
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(50) NOT NULL,
	"sub_category" varchar(100),
	"date_installed" timestamp with time zone,
	"manufacturer" varchar(255),
	"material" varchar(100),
	"quantity" integer,
	"design_life" integer,
	"condition_grade" varchar(10),
	"last_inspection_date" timestamp with time zone,
	"next_inspection_date" timestamp with time zone,
	"safety_concern" boolean DEFAULT false,
	"geometry" geometry(Geometry, 4326) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"ward" varchar(100),
	"managing_dept" varchar(100),
	"green_space_ref" varchar(50) NOT NULL,
	"data_source" varchar(20) DEFAULT 'manual',
	"source_version" varchar(100),
	"source_date" timestamp with time zone,
	"last_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pavement_sections" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"section_id" varchar(100),
	"name" varchar(255),
	"route_number" varchar(100),
	"pavement_type" varchar(50) NOT NULL,
	"length" numeric(10, 2),
	"width" numeric(6, 2),
	"thickness" numeric(5, 1),
	"last_resurfacing_date" timestamp with time zone,
	"mci" numeric(4, 1),
	"crack_rate" numeric(5, 2),
	"rut_depth" numeric(5, 1),
	"iri" numeric(5, 2),
	"last_measurement_date" timestamp with time zone,
	"planned_intervention_year" integer,
	"estimated_cost" numeric(12, 0),
	"priority_rank" integer,
	"geometry" geometry(Geometry, 4326) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"ward" varchar(100),
	"managing_dept" varchar(100),
	"road_ref" varchar(50) NOT NULL,
	"data_source" varchar(20) DEFAULT 'manual',
	"source_version" varchar(100),
	"source_date" timestamp with time zone,
	"last_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pump_stations" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"station_id" varchar(100),
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(50) NOT NULL,
	"date_commissioned" timestamp with time zone,
	"design_capacity" numeric(8, 2),
	"pump_count" integer,
	"total_power" numeric(8, 2),
	"drainage_area" numeric(8, 2),
	"equipment_status" varchar(50) NOT NULL,
	"condition_grade" varchar(10),
	"last_maintenance_date" timestamp with time zone,
	"next_maintenance_date" timestamp with time zone,
	"geometry" geometry(Geometry, 4326) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"ward" varchar(100),
	"managing_dept" varchar(100),
	"managing_office" varchar(255),
	"river_ref" varchar(50),
	"data_source" varchar(20) DEFAULT 'manual',
	"source_version" varchar(100),
	"source_date" timestamp with time zone,
	"last_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lifecycle_plans" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"version" varchar(50),
	"plan_start_year" integer NOT NULL,
	"plan_end_year" integer NOT NULL,
	"plan_status" varchar(20) DEFAULT 'draft' NOT NULL,
	"asset_type" varchar(50) NOT NULL,
	"baseline_condition" varchar(10),
	"design_life" integer,
	"remaining_life" integer,
	"interventions" jsonb,
	"total_lifecycle_cost_jpy" numeric(15, 0),
	"annual_average_cost_jpy" numeric(12, 0),
	"asset_ref" varchar(50),
	"managing_dept" varchar(100),
	"created_by" varchar(100),
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ============================================
-- 2. Expand inspection_records
-- ============================================
--> statement-breakpoint
ALTER TABLE "inspection_records" ADD COLUMN "asset_type" varchar(50);
--> statement-breakpoint
ALTER TABLE "inspection_records" ADD COLUMN "asset_id" varchar(50);
--> statement-breakpoint
ALTER TABLE "inspection_records" ADD COLUMN "inspection_type" varchar(50);
--> statement-breakpoint
ALTER TABLE "inspection_records" ADD COLUMN "condition_grade" varchar(10);
--> statement-breakpoint
ALTER TABLE "inspection_records" ADD COLUMN "findings" text;
--> statement-breakpoint
ALTER TABLE "inspection_records" ADD COLUMN "inspector" varchar(100);
--> statement-breakpoint
ALTER TABLE "inspection_records" ADD COLUMN "inspector_organization" varchar(255);
--> statement-breakpoint
ALTER TABLE "inspection_records" ADD COLUMN "measurements" jsonb;
--> statement-breakpoint
ALTER TABLE "inspection_records" ADD COLUMN "media_urls" jsonb;
--> statement-breakpoint
ALTER TABLE "inspection_records" ADD COLUMN "ref_work_order_id" varchar(50);
--> statement-breakpoint
ALTER TABLE "inspection_records" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;

-- ============================================
-- 3. Backfill inspection_records: set asset_type='road' where road_asset_id is set
-- ============================================
--> statement-breakpoint
UPDATE "inspection_records"
SET "asset_type" = 'road', "asset_id" = "road_asset_id"
WHERE "road_asset_id" IS NOT NULL AND "asset_type" IS NULL;

-- ============================================
-- 4. Drop old CHECK constraint (if exists) and add new one
-- ============================================
--> statement-breakpoint
ALTER TABLE "inspection_records" DROP CONSTRAINT IF EXISTS "inspection_records_check";

-- ============================================
-- 5. CHECK constraints on enum-like varchar columns
-- ============================================
--> statement-breakpoint
ALTER TABLE "street_tree_assets" ADD CONSTRAINT "chk_street_trees_category"
	CHECK ("category" IN ('deciduous', 'evergreen', 'conifer', 'palmLike', 'shrub'));
--> statement-breakpoint
ALTER TABLE "street_tree_assets" ADD CONSTRAINT "chk_street_trees_health_status"
	CHECK ("health_status" IN ('healthy', 'declining', 'hazardous', 'dead', 'removed'));
--> statement-breakpoint
ALTER TABLE "street_tree_assets" ADD CONSTRAINT "chk_street_trees_condition_grade"
	CHECK ("condition_grade" IS NULL OR "condition_grade" IN ('A', 'B', 'C', 'D', 'S'));
--> statement-breakpoint
ALTER TABLE "park_facilities" ADD CONSTRAINT "chk_park_facilities_category"
	CHECK ("category" IN ('toilet', 'playground', 'bench', 'shelter', 'fence', 'gate', 'drainage', 'lighting', 'waterFountain', 'signBoard', 'pavement', 'sportsFacility', 'building', 'other'));
--> statement-breakpoint
ALTER TABLE "park_facilities" ADD CONSTRAINT "chk_park_facilities_condition_grade"
	CHECK ("condition_grade" IS NULL OR "condition_grade" IN ('A', 'B', 'C', 'D', 'S'));
--> statement-breakpoint
ALTER TABLE "pavement_sections" ADD CONSTRAINT "chk_pavement_sections_type"
	CHECK ("pavement_type" IN ('asphalt', 'concrete', 'interlocking', 'gravel', 'other'));
--> statement-breakpoint
ALTER TABLE "pump_stations" ADD CONSTRAINT "chk_pump_stations_category"
	CHECK ("category" IN ('stormwater', 'sewage', 'irrigation', 'combined'));
--> statement-breakpoint
ALTER TABLE "pump_stations" ADD CONSTRAINT "chk_pump_stations_equipment_status"
	CHECK ("equipment_status" IN ('operational', 'standby', 'underMaintenance', 'outOfService'));
--> statement-breakpoint
ALTER TABLE "pump_stations" ADD CONSTRAINT "chk_pump_stations_condition_grade"
	CHECK ("condition_grade" IS NULL OR "condition_grade" IN ('A', 'B', 'C', 'D', 'S'));
--> statement-breakpoint
ALTER TABLE "lifecycle_plans" ADD CONSTRAINT "chk_lifecycle_plans_status"
	CHECK ("plan_status" IN ('draft', 'approved', 'active', 'archived'));
--> statement-breakpoint
ALTER TABLE "lifecycle_plans" ADD CONSTRAINT "chk_lifecycle_plans_baseline_condition"
	CHECK ("baseline_condition" IS NULL OR "baseline_condition" IN ('A', 'B', 'C', 'D', 'S'));
--> statement-breakpoint
ALTER TABLE "inspection_records" ADD CONSTRAINT "chk_inspections_type"
	CHECK ("inspection_type" IS NULL OR "inspection_type" IN ('routine', 'detailed', 'emergency', 'diagnostic'));
--> statement-breakpoint
ALTER TABLE "inspection_records" ADD CONSTRAINT "chk_inspections_condition_grade"
	CHECK ("condition_grade" IS NULL OR "condition_grade" IN ('A', 'B', 'C', 'D', 'S'));

-- ============================================
-- 6. GIST spatial indexes (PostGIS)
-- ============================================
--> statement-breakpoint
CREATE INDEX "idx_street_trees_geom" ON "street_tree_assets" USING GIST ("geometry");
--> statement-breakpoint
CREATE INDEX "idx_park_facilities_geom" ON "park_facilities" USING GIST ("geometry");
--> statement-breakpoint
CREATE INDEX "idx_pavement_sections_geom" ON "pavement_sections" USING GIST ("geometry");
--> statement-breakpoint
CREATE INDEX "idx_pump_stations_geom" ON "pump_stations" USING GIST ("geometry");

-- ============================================
-- 7. BTREE indexes
-- ============================================
--> statement-breakpoint
CREATE INDEX "idx_street_trees_status" ON "street_tree_assets" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "idx_street_trees_category" ON "street_tree_assets" USING btree ("category");
--> statement-breakpoint
CREATE INDEX "idx_street_trees_health_status" ON "street_tree_assets" USING btree ("health_status");
--> statement-breakpoint
CREATE INDEX "idx_street_trees_condition_grade" ON "street_tree_assets" USING btree ("condition_grade");
--> statement-breakpoint
CREATE INDEX "idx_street_trees_ward" ON "street_tree_assets" USING btree ("ward");
--> statement-breakpoint
CREATE INDEX "idx_street_trees_road_ref" ON "street_tree_assets" USING btree ("road_ref");
--> statement-breakpoint
CREATE INDEX "idx_street_trees_green_space_ref" ON "street_tree_assets" USING btree ("green_space_ref");
--> statement-breakpoint
CREATE INDEX "idx_park_facilities_status" ON "park_facilities" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "idx_park_facilities_category" ON "park_facilities" USING btree ("category");
--> statement-breakpoint
CREATE INDEX "idx_park_facilities_condition_grade" ON "park_facilities" USING btree ("condition_grade");
--> statement-breakpoint
CREATE INDEX "idx_park_facilities_ward" ON "park_facilities" USING btree ("ward");
--> statement-breakpoint
CREATE INDEX "idx_park_facilities_green_space_ref" ON "park_facilities" USING btree ("green_space_ref");
--> statement-breakpoint
CREATE INDEX "idx_pavement_sections_status" ON "pavement_sections" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "idx_pavement_sections_type" ON "pavement_sections" USING btree ("pavement_type");
--> statement-breakpoint
CREATE INDEX "idx_pavement_sections_ward" ON "pavement_sections" USING btree ("ward");
--> statement-breakpoint
CREATE INDEX "idx_pavement_sections_priority_rank" ON "pavement_sections" USING btree ("priority_rank");
--> statement-breakpoint
CREATE INDEX "idx_pavement_sections_road_ref" ON "pavement_sections" USING btree ("road_ref");
--> statement-breakpoint
CREATE INDEX "idx_pump_stations_status" ON "pump_stations" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "idx_pump_stations_category" ON "pump_stations" USING btree ("category");
--> statement-breakpoint
CREATE INDEX "idx_pump_stations_equipment_status" ON "pump_stations" USING btree ("equipment_status");
--> statement-breakpoint
CREATE INDEX "idx_pump_stations_condition_grade" ON "pump_stations" USING btree ("condition_grade");
--> statement-breakpoint
CREATE INDEX "idx_pump_stations_ward" ON "pump_stations" USING btree ("ward");
--> statement-breakpoint
CREATE INDEX "idx_pump_stations_river_ref" ON "pump_stations" USING btree ("river_ref");
--> statement-breakpoint
CREATE INDEX "idx_lifecycle_plans_asset_type" ON "lifecycle_plans" USING btree ("asset_type");
--> statement-breakpoint
CREATE INDEX "idx_lifecycle_plans_status" ON "lifecycle_plans" USING btree ("plan_status");
--> statement-breakpoint
CREATE INDEX "idx_lifecycle_plans_asset_ref" ON "lifecycle_plans" USING btree ("asset_ref");
--> statement-breakpoint
CREATE INDEX "idx_inspections_asset_type_id" ON "inspection_records" USING btree ("asset_type", "asset_id");
--> statement-breakpoint
CREATE INDEX "idx_inspections_type" ON "inspection_records" USING btree ("inspection_type");
--> statement-breakpoint
CREATE INDEX "idx_inspections_result" ON "inspection_records" USING btree ("result");
--> statement-breakpoint
CREATE INDEX "idx_inspections_condition_grade" ON "inspection_records" USING btree ("condition_grade");

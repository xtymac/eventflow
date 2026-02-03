CREATE TABLE "construction_events" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'planned' NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"restriction_type" varchar(50) NOT NULL,
	"geometry" geometry(Geometry, 4326) NOT NULL,
	"geometry_source" varchar(20) DEFAULT 'manual',
	"post_end_decision" varchar(50) DEFAULT 'pending',
	"archived_at" timestamp with time zone,
	"department" varchar(100) NOT NULL,
	"ward" varchar(100),
	"created_by" varchar(100),
	"closed_by" varchar(100),
	"closed_at" timestamp with time zone,
	"close_notes" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_road_assets" (
	"event_id" varchar(50) NOT NULL,
	"road_asset_id" varchar(50) NOT NULL,
	"relation_type" varchar(20) DEFAULT 'affected',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_road_assets_event_id_road_asset_id_pk" PRIMARY KEY("event_id","road_asset_id")
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"work_order_id" varchar(50) NOT NULL,
	"type" varchar(20) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"file_size_bytes" integer,
	"mime_type" varchar(100),
	"title" varchar(255),
	"description" text,
	"capture_date" timestamp with time zone,
	"geometry" geometry(Point, 4326),
	"submitted_by" varchar(100) NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by" varchar(100),
	"reviewed_at" timestamp with time zone,
	"review_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"review_notes" text
);
--> statement-breakpoint
CREATE TABLE "export_records" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"export_scope" varchar(255) NOT NULL,
	"format" varchar(20) NOT NULL,
	"road_ids" jsonb NOT NULL,
	"feature_count" integer NOT NULL,
	"exported_by" varchar(100),
	"exported_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "greenspace_assets" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"name_ja" varchar(255),
	"display_name" varchar(255),
	"geometry" geometry(Polygon, 4326) NOT NULL,
	"green_space_type" varchar(50) NOT NULL,
	"leisure_type" varchar(50),
	"landuse_type" varchar(50),
	"natural_type" varchar(50),
	"area_m2" integer,
	"vegetation_type" varchar(100),
	"operator" varchar(255),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"ward" varchar(100),
	"data_source" varchar(20) DEFAULT 'manual',
	"source_version" varchar(100),
	"source_date" timestamp with time zone,
	"last_verified_at" timestamp with time zone,
	"osm_type" varchar(10),
	"osm_id" bigint,
	"osm_timestamp" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"is_manually_edited" boolean DEFAULT false,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idx_greenspaces_osm_unique" UNIQUE("osm_type","osm_id")
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"version_id" varchar(50) NOT NULL,
	"job_type" varchar(20) NOT NULL,
	"status" varchar(20) NOT NULL,
	"progress" integer DEFAULT 0,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_message" text,
	"result_summary" jsonb
);
--> statement-breakpoint
CREATE TABLE "import_versions" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"version_number" integer NOT NULL,
	"status" varchar(20) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_type" varchar(20) NOT NULL,
	"file_path" varchar(500) NOT NULL,
	"layer_name" varchar(100),
	"source_crs" varchar(20),
	"import_scope" varchar(255) NOT NULL,
	"regional_refresh" boolean DEFAULT false NOT NULL,
	"default_data_source" varchar(20) NOT NULL,
	"source_export_id" varchar(50),
	"file_size_mb" numeric(10, 2),
	"feature_count" integer NOT NULL,
	"uploaded_by" varchar(100),
	"uploaded_at" timestamp with time zone NOT NULL,
	"published_at" timestamp with time zone,
	"published_by" varchar(100),
	"archived_at" timestamp with time zone,
	"rolled_back_at" timestamp with time zone,
	"snapshot_path" varchar(500),
	"diff_path" varchar(500),
	"added_count" integer,
	"updated_count" integer,
	"deactivated_count" integer,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "inspection_records" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"event_id" varchar(50),
	"road_asset_id" varchar(50),
	"inspection_date" timestamp NOT NULL,
	"result" varchar(100) NOT NULL,
	"notes" text,
	"geometry" geometry(Point, 4326) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nagoya_building_zones" (
	"id" varchar(50) PRIMARY KEY DEFAULT 'NBZ-' || nanoid() NOT NULL,
	"source_layer" varchar(100) NOT NULL,
	"dedup_key" varchar(255) NOT NULL,
	"gid" integer,
	"keycode" varchar(100),
	"zone_type" varchar(100),
	"name" varchar(255),
	"kyotei_name" varchar(255),
	"kubun" varchar(100),
	"nintei_ymd" varchar(50),
	"nintei_no" varchar(100),
	"shitei_ymd" varchar(50),
	"kokoku_ymd" varchar(50),
	"menseki" varchar(50),
	"raw_props" jsonb,
	"geometry" geometry(Polygon, 4326) NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idx_nagoya_building_zones_source_dedup" UNIQUE("source_layer","dedup_key")
);
--> statement-breakpoint
CREATE TABLE "nagoya_designated_areas" (
	"id" varchar(50) PRIMARY KEY DEFAULT 'NDA-' || nanoid() NOT NULL,
	"source_layer" varchar(100) NOT NULL,
	"dedup_key" varchar(255) NOT NULL,
	"keycode" varchar(100),
	"daicyo_ban" varchar(100),
	"gid" integer,
	"encyo" varchar(100),
	"fukuin" varchar(100),
	"kyoka_ban" varchar(100),
	"kyoka_ymd" varchar(50),
	"shitei_ban" varchar(100),
	"shitei_ymd" varchar(50),
	"filename" varchar(500),
	"raw_props" jsonb,
	"geometry" geometry(Polygon, 4326) NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idx_nagoya_areas_source_dedup" UNIQUE("source_layer","dedup_key")
);
--> statement-breakpoint
CREATE TABLE "nagoya_designated_roads" (
	"id" varchar(50) PRIMARY KEY DEFAULT 'NDR-' || nanoid() NOT NULL,
	"source_layer" varchar(100) NOT NULL,
	"dedup_key" varchar(255) NOT NULL,
	"keycode" varchar(100),
	"daicyo_ban" varchar(100),
	"gid" integer,
	"encyo" varchar(100),
	"fukuin" varchar(100),
	"kyoka_ban" varchar(100),
	"kyoka_ymd" varchar(50),
	"shitei_ban" varchar(100),
	"shitei_ymd" varchar(50),
	"filename" varchar(500),
	"raw_props" jsonb,
	"geometry" geometry(LineString, 4326) NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idx_nagoya_roads_source_dedup" UNIQUE("source_layer","dedup_key")
);
--> statement-breakpoint
CREATE TABLE "nagoya_sync_logs" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"status" varchar(20) NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"total_tiles" integer NOT NULL,
	"completed_tiles" integer DEFAULT 0 NOT NULL,
	"error_tiles" integer DEFAULT 0 NOT NULL,
	"roads_created" integer DEFAULT 0 NOT NULL,
	"roads_updated" integer DEFAULT 0 NOT NULL,
	"areas_created" integer DEFAULT 0 NOT NULL,
	"areas_updated" integer DEFAULT 0 NOT NULL,
	"resume_state" jsonb,
	"error_message" text,
	"error_details" jsonb
);
--> statement-breakpoint
CREATE TABLE "osm_sync_logs" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"sync_type" varchar(20) NOT NULL,
	"bbox_param" varchar(255),
	"ward_param" varchar(100),
	"status" varchar(20) NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"osm_roads_fetched" integer DEFAULT 0,
	"roads_created" integer DEFAULT 0,
	"roads_updated" integer DEFAULT 0,
	"roads_marked_inactive" integer DEFAULT 0,
	"roads_skipped" integer DEFAULT 0,
	"error_message" text,
	"error_details" jsonb,
	"triggered_by" varchar(100),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "river_assets" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"name_ja" varchar(255),
	"display_name" varchar(255),
	"geometry" geometry(Geometry, 4326) NOT NULL,
	"geometry_type" varchar(20) DEFAULT 'line' NOT NULL,
	"waterway_type" varchar(50),
	"water_type" varchar(50),
	"width" integer,
	"management_level" varchar(50),
	"maintainer" varchar(100),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"ward" varchar(100),
	"data_source" varchar(20) DEFAULT 'manual',
	"source_version" varchar(100),
	"source_date" timestamp with time zone,
	"last_verified_at" timestamp with time zone,
	"osm_type" varchar(10),
	"osm_id" bigint,
	"osm_timestamp" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"is_manually_edited" boolean DEFAULT false,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idx_rivers_osm_unique" UNIQUE("osm_type","osm_id")
);
--> statement-breakpoint
CREATE TABLE "road_asset_changes" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"event_id" varchar(50) NOT NULL,
	"change_type" varchar(20) NOT NULL,
	"old_road_asset_id" varchar(50),
	"new_road_asset_id" varchar(50),
	"geometry" geometry(Geometry, 4326),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "road_asset_edit_logs" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"road_asset_id" varchar(50) NOT NULL,
	"edit_type" varchar(20) NOT NULL,
	"road_name" varchar(255),
	"road_display_name" varchar(255),
	"road_ward" varchar(100),
	"road_type" varchar(50),
	"centroid" geometry(Point, 4326) NOT NULL,
	"bbox" jsonb,
	"edit_source" varchar(20) DEFAULT 'manual',
	"edited_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "road_assets" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"name_ja" varchar(255),
	"ref" varchar(100),
	"local_ref" varchar(100),
	"display_name" varchar(255),
	"name_source" varchar(20),
	"name_confidence" varchar(10),
	"geometry" geometry(Geometry, 4326) NOT NULL,
	"geometry_polygon" geometry(Polygon, 4326),
	"road_type" varchar(50) NOT NULL,
	"lanes" integer DEFAULT 2 NOT NULL,
	"width" numeric(5, 2),
	"width_source" varchar(20) DEFAULT 'default',
	"direction" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone,
	"replaced_by" varchar(50),
	"owner_department" varchar(100),
	"ward" varchar(100),
	"landmark" varchar(255),
	"sublocality" varchar(255),
	"cross_section" varchar(100),
	"managing_dept" varchar(100),
	"intersection" varchar(255),
	"pavement_state" varchar(50),
	"data_source" varchar(20) DEFAULT 'manual',
	"source_version" varchar(100),
	"source_date" timestamp with time zone,
	"last_verified_at" timestamp with time zone,
	"osm_type" varchar(10),
	"osm_id" bigint,
	"segment_index" integer DEFAULT 0,
	"osm_timestamp" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"sync_source" varchar(20) DEFAULT 'initial',
	"is_manually_edited" boolean DEFAULT false,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "streetlight_assets" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"lamp_id" varchar(50),
	"display_name" varchar(255),
	"geometry" geometry(Point, 4326) NOT NULL,
	"lamp_type" varchar(50) NOT NULL,
	"wattage" integer,
	"install_date" timestamp with time zone,
	"lamp_status" varchar(20) DEFAULT 'operational' NOT NULL,
	"road_ref" varchar(50),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"ward" varchar(100),
	"data_source" varchar(20) DEFAULT 'manual',
	"source_version" varchar(100),
	"source_date" timestamp with time zone,
	"last_verified_at" timestamp with time zone,
	"osm_type" varchar(10),
	"osm_id" bigint,
	"osm_timestamp" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"is_manually_edited" boolean DEFAULT false,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idx_streetlights_osm_unique" UNIQUE("osm_type","osm_id")
);
--> statement-breakpoint
CREATE TABLE "work_order_locations" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"work_order_id" varchar(50) NOT NULL,
	"geometry" geometry(Geometry, 4326) NOT NULL,
	"asset_type" varchar(20),
	"asset_id" varchar(50),
	"note" text,
	"sequence_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_order_partners" (
	"work_order_id" varchar(50) NOT NULL,
	"partner_id" varchar(50) NOT NULL,
	"partner_name" varchar(255) NOT NULL,
	"role" varchar(50) DEFAULT 'contractor',
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_order_partners_work_order_id_partner_id_pk" PRIMARY KEY("work_order_id","partner_id")
);
--> statement-breakpoint
CREATE TABLE "work_orders" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"event_id" varchar(50) NOT NULL,
	"type" varchar(20) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"assigned_dept" varchar(100),
	"assigned_by" varchar(100),
	"assigned_at" timestamp with time zone,
	"due_date" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"reviewed_by" varchar(100),
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"created_by" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_road_assets" ADD CONSTRAINT "event_road_assets_event_id_construction_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."construction_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_road_assets" ADD CONSTRAINT "event_road_assets_road_asset_id_road_assets_id_fk" FOREIGN KEY ("road_asset_id") REFERENCES "public"."road_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_version_id_import_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."import_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_records" ADD CONSTRAINT "inspection_records_event_id_construction_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."construction_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_records" ADD CONSTRAINT "inspection_records_road_asset_id_road_assets_id_fk" FOREIGN KEY ("road_asset_id") REFERENCES "public"."road_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "road_asset_changes" ADD CONSTRAINT "road_asset_changes_event_id_construction_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."construction_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "road_asset_changes" ADD CONSTRAINT "road_asset_changes_old_road_asset_id_road_assets_id_fk" FOREIGN KEY ("old_road_asset_id") REFERENCES "public"."road_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "road_asset_changes" ADD CONSTRAINT "road_asset_changes_new_road_asset_id_road_assets_id_fk" FOREIGN KEY ("new_road_asset_id") REFERENCES "public"."road_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_locations" ADD CONSTRAINT "work_order_locations_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_partners" ADD CONSTRAINT "work_order_partners_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_event_id_construction_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."construction_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_events_status" ON "construction_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_events_department" ON "construction_events" USING btree ("department");--> statement-breakpoint
CREATE INDEX "idx_events_start_date" ON "construction_events" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "idx_events_end_date" ON "construction_events" USING btree ("end_date");--> statement-breakpoint
CREATE INDEX "idx_event_road_assets_asset" ON "event_road_assets" USING btree ("road_asset_id");--> statement-breakpoint
CREATE INDEX "idx_evidence_workorder_id" ON "evidence" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "idx_evidence_type" ON "evidence" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_evidence_review_status" ON "evidence" USING btree ("review_status");--> statement-breakpoint
CREATE INDEX "idx_export_records_exported_at" ON "export_records" USING btree ("exported_at");--> statement-breakpoint
CREATE INDEX "idx_greenspaces_status" ON "greenspace_assets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_greenspaces_type" ON "greenspace_assets" USING btree ("green_space_type");--> statement-breakpoint
CREATE INDEX "idx_greenspaces_data_source" ON "greenspace_assets" USING btree ("data_source");--> statement-breakpoint
CREATE INDEX "idx_greenspaces_ward" ON "greenspace_assets" USING btree ("ward");--> statement-breakpoint
CREATE INDEX "idx_import_jobs_version" ON "import_jobs" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "idx_import_jobs_status" ON "import_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_import_versions_status" ON "import_versions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_import_versions_uploaded" ON "import_versions" USING btree ("uploaded_at");--> statement-breakpoint
CREATE INDEX "idx_inspections_event_id" ON "inspection_records" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_inspections_road_asset_id" ON "inspection_records" USING btree ("road_asset_id");--> statement-breakpoint
CREATE INDEX "idx_inspections_inspection_date" ON "inspection_records" USING btree ("inspection_date");--> statement-breakpoint
CREATE INDEX "idx_nagoya_sync_status" ON "nagoya_sync_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_nagoya_sync_started" ON "nagoya_sync_logs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_osm_sync_logs_started" ON "osm_sync_logs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_osm_sync_logs_status" ON "osm_sync_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_rivers_status" ON "river_assets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_rivers_waterway_type" ON "river_assets" USING btree ("waterway_type");--> statement-breakpoint
CREATE INDEX "idx_rivers_geometry_type" ON "river_assets" USING btree ("geometry_type");--> statement-breakpoint
CREATE INDEX "idx_rivers_data_source" ON "river_assets" USING btree ("data_source");--> statement-breakpoint
CREATE INDEX "idx_rivers_ward" ON "river_assets" USING btree ("ward");--> statement-breakpoint
CREATE INDEX "idx_changes_event_id" ON "road_asset_changes" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_changes_change_type" ON "road_asset_changes" USING btree ("change_type");--> statement-breakpoint
CREATE INDEX "idx_edit_logs_edited_at" ON "road_asset_edit_logs" USING btree ("edited_at");--> statement-breakpoint
CREATE INDEX "idx_edit_logs_edit_source" ON "road_asset_edit_logs" USING btree ("edit_source");--> statement-breakpoint
CREATE INDEX "idx_edit_logs_road_asset_id" ON "road_asset_edit_logs" USING btree ("road_asset_id");--> statement-breakpoint
CREATE INDEX "idx_assets_status" ON "road_assets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_assets_road_type" ON "road_assets" USING btree ("road_type");--> statement-breakpoint
CREATE INDEX "idx_assets_owner_department" ON "road_assets" USING btree ("owner_department");--> statement-breakpoint
CREATE INDEX "idx_assets_data_source" ON "road_assets" USING btree ("data_source");--> statement-breakpoint
CREATE INDEX "idx_assets_ward" ON "road_assets" USING btree ("ward");--> statement-breakpoint
CREATE INDEX "idx_streetlights_status" ON "streetlight_assets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_streetlights_lamp_status" ON "streetlight_assets" USING btree ("lamp_status");--> statement-breakpoint
CREATE INDEX "idx_streetlights_lamp_type" ON "streetlight_assets" USING btree ("lamp_type");--> statement-breakpoint
CREATE INDEX "idx_streetlights_data_source" ON "streetlight_assets" USING btree ("data_source");--> statement-breakpoint
CREATE INDEX "idx_streetlights_ward" ON "streetlight_assets" USING btree ("ward");--> statement-breakpoint
CREATE INDEX "idx_wo_locations_workorder_id" ON "work_order_locations" USING btree ("work_order_id");--> statement-breakpoint
CREATE INDEX "idx_wo_locations_asset_type" ON "work_order_locations" USING btree ("asset_type");--> statement-breakpoint
CREATE INDEX "idx_wo_partners_partner_id" ON "work_order_partners" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "idx_workorders_event_id" ON "work_orders" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_workorders_status" ON "work_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_workorders_type" ON "work_orders" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_workorders_due_date" ON "work_orders" USING btree ("due_date");
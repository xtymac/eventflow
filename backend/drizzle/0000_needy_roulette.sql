CREATE TABLE "construction_events" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'planned' NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"restriction_type" varchar(50) NOT NULL,
	"geometry" json NOT NULL,
	"post_end_decision" varchar(50) DEFAULT 'pending',
	"affected_road_asset_ids" text[],
	"department" varchar(100) NOT NULL,
	"ward" varchar(100),
	"created_by" varchar(100),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inspection_records" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"related_type" varchar(20) NOT NULL,
	"related_id" varchar(50) NOT NULL,
	"inspection_date" timestamp NOT NULL,
	"result" varchar(100) NOT NULL,
	"notes" text,
	"geometry" json NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "road_asset_changes" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"event_id" varchar(50) NOT NULL,
	"change_type" varchar(20) NOT NULL,
	"old_road_asset_id" varchar(50),
	"new_road_asset_id" varchar(50),
	"geometry" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "road_assets" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"geometry" json NOT NULL,
	"road_type" varchar(50) NOT NULL,
	"lanes" integer DEFAULT 2 NOT NULL,
	"direction" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone,
	"replaced_by" varchar(50),
	"owner_department" varchar(100),
	"ward" varchar(100),
	"landmark" varchar(255),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "road_asset_changes" ADD CONSTRAINT "road_asset_changes_event_id_construction_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."construction_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "road_asset_changes" ADD CONSTRAINT "road_asset_changes_old_road_asset_id_road_assets_id_fk" FOREIGN KEY ("old_road_asset_id") REFERENCES "public"."road_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "road_asset_changes" ADD CONSTRAINT "road_asset_changes_new_road_asset_id_road_assets_id_fk" FOREIGN KEY ("new_road_asset_id") REFERENCES "public"."road_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "road_assets" ADD CONSTRAINT "road_assets_replaced_by_road_assets_id_fk" FOREIGN KEY ("replaced_by") REFERENCES "public"."road_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_events_status" ON "construction_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_events_department" ON "construction_events" USING btree ("department");--> statement-breakpoint
CREATE INDEX "idx_events_start_date" ON "construction_events" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "idx_events_end_date" ON "construction_events" USING btree ("end_date");--> statement-breakpoint
CREATE INDEX "idx_inspections_related_type" ON "inspection_records" USING btree ("related_type");--> statement-breakpoint
CREATE INDEX "idx_inspections_related_id" ON "inspection_records" USING btree ("related_id");--> statement-breakpoint
CREATE INDEX "idx_inspections_inspection_date" ON "inspection_records" USING btree ("inspection_date");--> statement-breakpoint
CREATE INDEX "idx_changes_event_id" ON "road_asset_changes" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_changes_change_type" ON "road_asset_changes" USING btree ("change_type");--> statement-breakpoint
CREATE INDEX "idx_assets_status" ON "road_assets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_assets_road_type" ON "road_assets" USING btree ("road_type");--> statement-breakpoint
CREATE INDEX "idx_assets_owner_department" ON "road_assets" USING btree ("owner_department");
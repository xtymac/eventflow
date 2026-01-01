-- Add new columns for road naming
ALTER TABLE "road_assets" ALTER COLUMN "name" DROP NOT NULL;
ALTER TABLE "road_assets" ADD COLUMN IF NOT EXISTS "name_ja" varchar(255);
ALTER TABLE "road_assets" ADD COLUMN IF NOT EXISTS "ref" varchar(100);
ALTER TABLE "road_assets" ADD COLUMN IF NOT EXISTS "local_ref" varchar(100);
ALTER TABLE "road_assets" ADD COLUMN IF NOT EXISTS "display_name" varchar(255);

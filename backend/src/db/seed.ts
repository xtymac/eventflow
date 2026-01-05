import { db } from './index.js';
import { constructionEvents, roadAssets, eventRoadAssets, roadAssetChanges, inspectionRecords } from './schema.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { FeatureCollection } from 'geojson';
import { syncEventToOrion } from '../services/ngsi-sync.js';
import { sql } from 'drizzle-orm';
import { toGeomSql, fromGeomSqlRequired } from './geometry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SAMPLE_DATA_DIR = join(__dirname, '../../../sample-data');

async function seed() {
  console.log('Seeding database...');

  try {
    // Clear all data first
    console.log('Clearing existing data...');
    await db.execute(sql`TRUNCATE construction_events, road_assets, event_road_assets, road_asset_changes, inspection_records CASCADE`);

    // Load and seed road assets
    const assetsPath = join(SAMPLE_DATA_DIR, 'road_assets.geojson');
    const assetsGeojson = JSON.parse(readFileSync(assetsPath, 'utf-8')) as FeatureCollection;

    console.log(`Loading ${assetsGeojson.features.length} road assets...`);

    for (const feature of assetsGeojson.features) {
      const props = feature.properties || {};
      const now = new Date();
      const validFrom = new Date(props.validFrom);
      const validTo = props.validTo ? new Date(props.validTo) : null;

      // Set name_source to 'osm' if road has a displayName (from OSM data)
      const nameSource = props.displayName ? 'osm' : null;

      // Use raw SQL for geometry insert
      await db.execute(sql`
        INSERT INTO road_assets (
          id, name, name_ja, ref, local_ref, display_name, name_source,
          geometry, road_type, lanes, direction,
          status, valid_from, valid_to, owner_department, ward, landmark, updated_at
        ) VALUES (
          ${props.id}, ${props.name ?? null}, ${props.name_ja ?? null}, ${props.ref ?? null},
          ${props.local_ref ?? null}, ${props.displayName ?? null}, ${nameSource},
          ${toGeomSql(feature.geometry)}, ${props.roadType},
          ${props.lanes}, ${props.direction}, ${props.status || 'active'}, ${validFrom},
          ${validTo}, ${props.ownerDepartment ?? null}, ${props.ward ?? null},
          ${props.landmark ?? null}, ${now}
        )
        ON CONFLICT DO NOTHING
      `);
    }

    console.log('Road assets seeded successfully.');

    // Load and seed construction events
    const eventsPath = join(SAMPLE_DATA_DIR, 'construction_events.geojson');
    const eventsGeojson = JSON.parse(readFileSync(eventsPath, 'utf-8')) as FeatureCollection;

    console.log(`Loading ${eventsGeojson.features.length} construction events...`);

    for (const feature of eventsGeojson.features) {
      const props = feature.properties || {};
      const eventId = props.id;
      const now = new Date();
      const startDate = new Date(props.startDate);
      const endDate = new Date(props.endDate);

      // Use raw SQL for geometry insert
      await db.execute(sql`
        INSERT INTO construction_events (
          id, name, status, start_date, end_date, restriction_type,
          geometry, post_end_decision, department, ward, created_by, updated_at
        ) VALUES (
          ${eventId}, ${props.name}, ${props.status}, ${startDate}, ${endDate},
          ${props.restrictionType}, ${toGeomSql(feature.geometry)},
          ${props.postEndDecision || 'pending'}, ${props.department || 'Midori Seibi Kyoku'},
          ${props.ward ?? null}, 'seed', ${now}
        )
        ON CONFLICT DO NOTHING
      `);

      // Insert road asset relations into join table (only if asset exists)
      const affectedRoadAssetIds = props.affectedRoadAssetIds || [];
      for (const assetId of affectedRoadAssetIds) {
        // Check if asset exists before inserting relation
        const assetExists = await db.select({ id: roadAssets.id })
          .from(roadAssets)
          .where(sql`${roadAssets.id} = ${assetId}`)
          .limit(1);

        if (assetExists.length > 0) {
          await db.insert(eventRoadAssets).values({
            eventId,
            roadAssetId: assetId,
            relationType: 'affected',
          }).onConflictDoNothing();
        } else {
          console.log(`  Skipping asset relation: ${assetId} (asset not found)`);
        }
      }
    }

    console.log('Construction events seeded successfully.');

    // Sync events to Orion-LD
    console.log('Syncing events to Orion-LD...');
    // Explicit select with geometry conversion for Orion-LD sync
    const eventSelect = {
      id: constructionEvents.id,
      name: constructionEvents.name,
      status: constructionEvents.status,
      startDate: constructionEvents.startDate,
      endDate: constructionEvents.endDate,
      restrictionType: constructionEvents.restrictionType,
      geometry: fromGeomSqlRequired(constructionEvents.geometry),
      postEndDecision: constructionEvents.postEndDecision,
      archivedAt: constructionEvents.archivedAt,
      department: constructionEvents.department,
      ward: constructionEvents.ward,
      createdBy: constructionEvents.createdBy,
      updatedAt: constructionEvents.updatedAt,
      geometrySource: constructionEvents.geometrySource,
    };
    const allEvents = await db.select(eventSelect).from(constructionEvents);
    for (const event of allEvents) {
      try {
        await syncEventToOrion(event);
      } catch (error) {
        console.error(`Failed to sync event ${event.id} to Orion-LD:`, error);
      }
    }
    console.log(`Synced ${allEvents.length} events to Orion-LD.`);

    console.log('Database seeding completed!');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

seed();

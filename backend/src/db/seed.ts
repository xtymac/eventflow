import { db } from './index.js';
import { constructionEvents, roadAssets, eventRoadAssets, roadAssetChanges, inspectionRecords, workOrders, workOrderLocations } from './schema.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { FeatureCollection } from 'geojson';
import { syncEventToOrion } from '../services/ngsi-sync.js';
import { sql } from 'drizzle-orm';
import { toGeomSql, fromGeomSql } from './geometry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SAMPLE_DATA_DIR = join(__dirname, '../../../sample-data');

async function seed() {
  console.log('Seeding database...');

  try {
    // Clear all data first
    console.log('Clearing existing data...');
    await db.execute(sql`TRUNCATE construction_events, road_assets, event_road_assets, road_asset_changes, inspection_records, work_orders, work_order_locations, work_order_partners, evidence CASCADE`);

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

      // Parse archivedAt if provided
      const archivedAt = props.archivedAt ? new Date(props.archivedAt) : null;

      // Use raw SQL for geometry insert
      await db.execute(sql`
        INSERT INTO construction_events (
          id, name, status, start_date, end_date, restriction_type,
          geometry, geometry_source, post_end_decision, department, ward, created_by, updated_at, archived_at
        ) VALUES (
          ${eventId}, ${props.name}, ${props.status}, ${startDate}, ${endDate},
          ${props.restrictionType}, ${toGeomSql(feature.geometry)}, 'manual',
          ${props.postEndDecision || 'pending'}, ${props.department || 'Midori Seibi Kyoku'},
          ${props.ward ?? null}, 'seed', ${now}, ${archivedAt}
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

    // Seed Phase 1 work orders
    console.log('Seeding work orders...');
    const sampleWorkOrders = [
      // Active event CE-001: inspection work order (in_progress)
      { id: 'WO-001', eventId: 'CE-001', type: 'inspection', title: 'Road Surface Inspection - Sakura-dori',
        description: 'Inspect road surface condition after pipe installation work', status: 'in_progress',
        assignedDept: 'Infrastructure Inspection', assignedBy: 'seed', dueDate: new Date('2025-03-15') },
      // Active event CE-001: repair work order (assigned)
      { id: 'WO-002', eventId: 'CE-001', type: 'repair', title: 'Temporary Patch Repair',
        description: 'Apply temporary patch to road surface cuts', status: 'assigned',
        assignedDept: 'Road Maintenance', assignedBy: 'seed', dueDate: new Date('2025-03-20') },
      // Active event CE-002: update work order (draft)
      { id: 'WO-003', eventId: 'CE-002', type: 'update', title: 'Utility Line Map Update',
        description: 'Update utility line mapping after gas main relocation', status: 'draft',
        assignedDept: 'GIS Department' },
      // Active event CE-006: inspection (completed)
      { id: 'WO-004', eventId: 'CE-006', type: 'inspection', title: 'Bridge Joint Inspection',
        description: 'Inspect expansion joints after seismic reinforcement', status: 'completed',
        assignedDept: 'Bridge Engineering', assignedBy: 'seed', dueDate: new Date('2025-02-28') },
      // Pending review event CE-021: all completed
      { id: 'WO-005', eventId: 'CE-021', type: 'inspection', title: 'Final Site Inspection',
        description: 'Final inspection before event closure', status: 'completed',
        assignedDept: 'Quality Assurance', assignedBy: 'seed', dueDate: new Date('2025-01-30') },
      { id: 'WO-006', eventId: 'CE-021', type: 'repair', title: 'Sidewalk Restoration',
        description: 'Restore sidewalk surface after waterline work', status: 'completed',
        assignedDept: 'Road Maintenance', assignedBy: 'seed', dueDate: new Date('2025-01-25') },
      // Active event CE-009: multiple work orders
      { id: 'WO-007', eventId: 'CE-009', type: 'inspection', title: 'Storm Drain Capacity Check',
        description: 'Verify storm drain capacity after drainage work', status: 'assigned',
        assignedDept: 'Drainage Division', assignedBy: 'seed', dueDate: new Date('2025-04-10') },
      { id: 'WO-008', eventId: 'CE-009', type: 'update', title: 'Drainage System Map Update',
        description: 'Update drainage system GIS records', status: 'draft',
        assignedDept: 'GIS Department' },
    ];

    for (const wo of sampleWorkOrders) {
      const now = new Date();
      const assignedAt = wo.assignedBy ? now : null;
      const startedAt = wo.status === 'in_progress' || wo.status === 'completed' ? now : null;
      const completedAt = wo.status === 'completed' ? now : null;

      await db.insert(workOrders).values({
        id: wo.id,
        eventId: wo.eventId,
        type: wo.type,
        title: wo.title,
        description: wo.description || null,
        status: wo.status,
        assignedDept: wo.assignedDept || null,
        assignedBy: wo.assignedBy || null,
        assignedAt,
        dueDate: wo.dueDate || null,
        startedAt,
        completedAt,
        createdBy: 'seed',
        createdAt: now,
        updatedAt: now,
      }).onConflictDoNothing();
    }
    console.log(`Seeded ${sampleWorkOrders.length} work orders.`);

    // Seed work order locations (points on the map)
    console.log('Seeding work order locations...');
    const sampleLocations = [
      // WO-001 (inspection on CE-001, Sakura-dori road repair) — 2 inspection points along the line
      { id: 'WOL-001', workOrderId: 'WO-001', lng: 136.9282, lat: 35.2380, note: 'Inspection point A — road surface cut' },
      { id: 'WOL-002', workOrderId: 'WO-001', lng: 136.9290, lat: 35.2375, note: 'Inspection point B — pipe trench area' },
      // WO-002 (repair on CE-001) — 1 repair location
      { id: 'WOL-003', workOrderId: 'WO-002', lng: 136.9285, lat: 35.2378, note: 'Patch repair — surface cut intersection' },
      // WO-003 (update on CE-002, water main relocation) — 1 location
      { id: 'WOL-004', workOrderId: 'WO-003', lng: 136.9247, lat: 35.2371, note: 'Utility line mapping start point' },
      // WO-004 (inspection on CE-006, street light line) — 1 location
      { id: 'WOL-005', workOrderId: 'WO-004', lng: 136.9163, lat: 35.2207, note: 'Bridge expansion joint — north side' },
      // WO-005 (final inspection on CE-021, sidewalk repair) — 1 location
      { id: 'WOL-006', workOrderId: 'WO-005', lng: 136.9300, lat: 35.2280, note: 'Final inspection — sidewalk section' },
      // WO-006 (repair on CE-021) — 1 location
      { id: 'WOL-007', workOrderId: 'WO-006', lng: 136.9305, lat: 35.2278, note: 'Sidewalk surface restoration area' },
      // WO-007 (inspection on CE-009, drainage work polygon) — 2 inspection points inside polygon
      { id: 'WOL-008', workOrderId: 'WO-007', lng: 136.9198, lat: 35.2210, note: 'Storm drain inlet check — west' },
      { id: 'WOL-009', workOrderId: 'WO-007', lng: 136.9203, lat: 35.2212, note: 'Storm drain outlet check — east' },
      // WO-008 (update on CE-009) — 1 location
      { id: 'WOL-010', workOrderId: 'WO-008', lng: 136.9200, lat: 35.2210, note: 'Drainage system record update — center' },
    ];

    for (let i = 0; i < sampleLocations.length; i++) {
      const loc = sampleLocations[i];
      const now = new Date();
      const geojsonPoint = { type: 'Point', coordinates: [loc.lng, loc.lat] };

      await db.execute(sql`
        INSERT INTO work_order_locations (id, work_order_id, geometry, note, sequence_order, created_at)
        VALUES (${loc.id}, ${loc.workOrderId}, ${toGeomSql(geojsonPoint)}, ${loc.note}, ${i}, ${now})
        ON CONFLICT DO NOTHING
      `);
    }
    console.log(`Seeded ${sampleLocations.length} work order locations.`);

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
      geometry: fromGeomSql(constructionEvents.geometry),
      postEndDecision: constructionEvents.postEndDecision,
      archivedAt: constructionEvents.archivedAt,
      department: constructionEvents.department,
      ward: constructionEvents.ward,
      createdBy: constructionEvents.createdBy,
      updatedAt: constructionEvents.updatedAt,
      geometrySource: constructionEvents.geometrySource,
      // Phase 1: Close tracking fields
      closedBy: constructionEvents.closedBy,
      closedAt: constructionEvents.closedAt,
      closeNotes: constructionEvents.closeNotes,
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

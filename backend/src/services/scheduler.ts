import cron from 'node-cron';
import { exec } from 'child_process';
import { promisify } from 'util';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { db } from '../db/index.js';
import { constructionEvents, roadAssets } from '../db/schema.js';
import { eq, lte, and, sql, isNull } from 'drizzle-orm';
import { syncEventToOrion } from './ngsi-sync.js';
import { fromGeomSql } from '../db/geometry.js';
import { osmSyncService } from './osm-sync.js';

const execAsync = promisify(exec);

// Configure dayjs for Asia/Tokyo timezone
dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = 'Asia/Tokyo';

// Phase 0: Road assets are frozen (read-only) by default
// Set ROAD_ASSETS_FROZEN=false to re-enable OSM sync
const ROAD_ASSETS_FROZEN = process.env.ROAD_ASSETS_FROZEN !== 'false';

// Explicit select for constructionEvents with geometry conversion
const eventSelect = {
  id: constructionEvents.id,
  name: constructionEvents.name,
  status: constructionEvents.status,
  startDate: constructionEvents.startDate,
  endDate: constructionEvents.endDate,
  restrictionType: constructionEvents.restrictionType,
  geometry: fromGeomSql(constructionEvents.geometry),
  postEndDecision: constructionEvents.postEndDecision,
  department: constructionEvents.department,
  ward: constructionEvents.ward,
  createdBy: constructionEvents.createdBy,
  updatedAt: constructionEvents.updatedAt,
};

export function initScheduler() {
  // Run every minute to check for status transitions
  cron.schedule('* * * * *', async () => {
    const now = dayjs().tz(TIMEZONE).toDate();

    try {
      // Transition planned -> active events
      const plannedEvents = await db.select(eventSelect)
        .from(constructionEvents)
        .where(
          and(
            eq(constructionEvents.status, 'planned'),
            lte(constructionEvents.startDate, now)
          )
        );

      for (const event of plannedEvents) {
        await db.update(constructionEvents)
          .set({
            status: 'active',
            updatedAt: now,
          })
          .where(eq(constructionEvents.id, event.id));

        console.log(`[Scheduler] Event ${event.id} transitioned to active`);

        // Sync to Orion-LD
        const updatedEvent = await db.select(eventSelect)
          .from(constructionEvents)
          .where(eq(constructionEvents.id, event.id));

        if (updatedEvent.length > 0) {
          await syncEventToOrion(updatedEvent[0]);
        }
      }

      // Transition active events past endDate to pending_review
      const activeEvents = await db.select(eventSelect)
        .from(constructionEvents)
        .where(
          and(
            eq(constructionEvents.status, 'active'),
            lte(constructionEvents.endDate, now)
          )
        );

      for (const event of activeEvents) {
        // Active events transition to pending_review; closure requires Gov approval via /events/:id/close
        await db.update(constructionEvents)
          .set({
            status: 'pending_review',
            updatedAt: now,
          })
          .where(eq(constructionEvents.id, event.id));

        console.log(`[Scheduler] Event ${event.id} transitioned to pending_review (requires Gov close)`);

        // Sync to Orion-LD
        const updatedEvent = await db.select(eventSelect)
          .from(constructionEvents)
          .where(eq(constructionEvents.id, event.id));

        if (updatedEvent.length > 0) {
          await syncEventToOrion(updatedEvent[0]);
        }
      }
    } catch (error) {
      console.error('[Scheduler] Error during status transition:', error);
    }
  }, {
    timezone: TIMEZONE,
  });

  // ============================================
  // OSM Sync Scheduled Tasks
  // ============================================

  // Phase 0: Disable OSM sync when road assets are frozen
  if (ROAD_ASSETS_FROZEN) {
    console.log('[Scheduler] OSM sync disabled: ROAD_ASSETS_FROZEN=true (Phase 0)');
  }

  const OSM_SYNC_HOURLY_ENABLED = !ROAD_ASSETS_FROZEN && process.env.OSM_SYNC_HOURLY_ENABLED === 'true';
  const OSM_SYNC_DAILY_ENABLED = !ROAD_ASSETS_FROZEN && process.env.OSM_SYNC_DAILY_ENABLED === 'true';
  const TILES_REBUILD_ENABLED = process.env.TILES_REBUILD_ENABLED === 'true';

  // Helper to delay between ward syncs
  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // Hourly sync - sync wards that haven't been synced in 24 hours
  if (OSM_SYNC_HOURLY_ENABLED) {
    cron.schedule('0 * * * *', async () => {
      console.log('[Scheduler] Starting hourly OSM sync...');

      try {
        // Get wards that need syncing (null or > 24 hours since last sync)
        const result = await db.execute<{ ward: string }>(sql`
          SELECT DISTINCT ward
          FROM road_assets
          WHERE ward IS NOT NULL
            AND (last_synced_at IS NULL OR last_synced_at < NOW() - INTERVAL '24 hours')
          ORDER BY
            CASE WHEN last_synced_at IS NULL THEN 0 ELSE 1 END,
            last_synced_at ASC
          LIMIT 3
        `);

        const wardsToSync = result.rows.map((r) => r.ward);

        if (wardsToSync.length === 0) {
          console.log('[Scheduler] No wards need syncing');
          return;
        }

        console.log(`[Scheduler] Syncing ${wardsToSync.length} ward(s): ${wardsToSync.join(', ')}`);

        for (const ward of wardsToSync) {
          try {
            const syncResult = await osmSyncService.syncWard(ward, 'cron-hourly');
            console.log(`[Scheduler] Ward ${ward} sync completed: ${syncResult.roadsCreated} created, ${syncResult.roadsUpdated} updated`);
          } catch (error) {
            console.error(`[Scheduler] Ward ${ward} sync failed:`, error);
          }
          await delay(5000); // 5s delay between wards
        }
      } catch (error) {
        console.error('[Scheduler] Hourly OSM sync error:', error);
      }
    }, { timezone: TIMEZONE });

    console.log('[Scheduler] Hourly OSM sync enabled');
  }

  // Daily full sync - sync all wards at 3am JST
  if (OSM_SYNC_DAILY_ENABLED) {
    cron.schedule('0 3 * * *', async () => {
      console.log('[Scheduler] Starting daily full OSM sync...');

      try {
        // Get all distinct wards
        const result = await db.selectDistinct({ ward: roadAssets.ward })
          .from(roadAssets)
          .where(sql`${roadAssets.ward} IS NOT NULL`);

        const allWards = result.map((r) => r.ward).filter((w): w is string => w !== null);

        console.log(`[Scheduler] Syncing ${allWards.length} ward(s) for daily sync`);

        for (const ward of allWards) {
          try {
            const syncResult = await osmSyncService.syncWard(ward, 'cron-daily');
            console.log(`[Scheduler] Ward ${ward} daily sync completed: ${syncResult.roadsCreated} created, ${syncResult.roadsUpdated} updated`);
          } catch (error) {
            console.error(`[Scheduler] Ward ${ward} daily sync failed:`, error);
          }
          await delay(5000); // 5s delay between wards
        }

        console.log('[Scheduler] Daily full OSM sync completed');
      } catch (error) {
        console.error('[Scheduler] Daily OSM sync error:', error);
      }
    }, { timezone: TIMEZONE });

    console.log('[Scheduler] Daily OSM sync enabled (3am JST)');
  }

  // PMTiles rebuild - rebuild at 4am JST (after OSM sync completes)
  if (TILES_REBUILD_ENABLED) {
    cron.schedule('0 4 * * *', async () => {
      console.log('[Scheduler] Starting daily PMTiles rebuild...');

      try {
        // Export road assets to GeoJSON
        console.log('[Scheduler] Exporting road assets to GeoJSON...');
        await execAsync('npm run export:road-assets', { cwd: process.cwd() });

        // Generate PMTiles
        console.log('[Scheduler] Generating PMTiles...');
        await execAsync('npm run tiles:generate', { cwd: process.cwd() });

        console.log('[Scheduler] PMTiles rebuild completed');
      } catch (error) {
        console.error('[Scheduler] PMTiles rebuild failed:', error);
      }
    }, { timezone: TIMEZONE });

    console.log('[Scheduler] Daily PMTiles rebuild enabled (4am JST)');
  }

  console.log(`[Scheduler] Initialized with timezone ${TIMEZONE}`);
}

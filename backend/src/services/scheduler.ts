import cron from 'node-cron';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { db } from '../db/index.js';
import { constructionEvents } from '../db/schema.js';
import { eq, lte, and } from 'drizzle-orm';
import { syncEventToOrion } from './ngsi-sync.js';
import { fromGeomSqlRequired } from '../db/geometry.js';

// Configure dayjs for Asia/Tokyo timezone
dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = 'Asia/Tokyo';

// Explicit select for constructionEvents with geometry conversion
const eventSelect = {
  id: constructionEvents.id,
  name: constructionEvents.name,
  status: constructionEvents.status,
  startDate: constructionEvents.startDate,
  endDate: constructionEvents.endDate,
  restrictionType: constructionEvents.restrictionType,
  geometry: fromGeomSqlRequired(constructionEvents.geometry),
  postEndDecision: constructionEvents.postEndDecision,
  geometrySource: constructionEvents.geometrySource,
  archivedAt: constructionEvents.archivedAt,
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

      // Transition active -> ended events
      const activeEvents = await db.select(eventSelect)
        .from(constructionEvents)
        .where(
          and(
            eq(constructionEvents.status, 'active'),
            lte(constructionEvents.endDate, now)
          )
        );

      for (const event of activeEvents) {
        await db.update(constructionEvents)
          .set({
            status: 'ended',
            updatedAt: now,
          })
          .where(eq(constructionEvents.id, event.id));

        console.log(`[Scheduler] Event ${event.id} transitioned to ended`);

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

  console.log(`[Scheduler] Initialized with timezone ${TIMEZONE}`);
}

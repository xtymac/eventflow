/**
 * Road Name Enrichment Service
 * Automatically fetches road names from Google Maps for event-associated roads
 */

import { db } from '../db/index.js';
import { roadAssets, eventRoadAssets } from '../db/schema.js';
import { eq, and, or, isNull, sql } from 'drizzle-orm';
import { getRoadNameForLineString, isGoogleMapsConfigured } from './google-maps.js';

const MAX_ROADS_PER_EVENT = 50;

export interface EnrichmentResult {
  processed: number;
  enriched: number;
  skipped: number;
  errors: string[];
}

/**
 * Enrich road names for all unnamed roads associated with an event
 * @param eventId The event ID to process
 * @returns Statistics about the enrichment process
 */
export async function enrichRoadNamesForEvent(eventId: string): Promise<EnrichmentResult> {
  const result: EnrichmentResult = {
    processed: 0,
    enriched: 0,
    skipped: 0,
    errors: [],
  };

  // Check if Google Maps is configured
  if (!isGoogleMapsConfigured()) {
    result.errors.push('Google Maps API is not configured');
    return result;
  }

  try {
    // Query unnamed roads associated with this event
    // Unnamed = displayName is null/empty AND name is null/empty
    const unnamedRoads = await db.execute(sql`
      SELECT
        ra.id,
        ST_AsGeoJSON(ra.geometry)::json as geometry
      FROM road_assets ra
      INNER JOIN event_road_assets era ON ra.id = era.road_asset_id
      WHERE era.event_id = ${eventId}
        AND (
          COALESCE(TRIM(ra.display_name), '') = ''
          AND COALESCE(TRIM(ra.name), '') = ''
        )
        AND ra.geometry IS NOT NULL
      LIMIT ${MAX_ROADS_PER_EVENT}
    `);

    const roads = unnamedRoads.rows as Array<{
      id: string;
      geometry: { type: string; coordinates: [number, number][] };
    }>;

    console.log(`[RoadNameEnrich] Event ${eventId}: Found ${roads.length} unnamed roads to process`);

    for (const road of roads) {
      result.processed++;

      // Skip non-LineString geometries
      if (!road.geometry || road.geometry.type !== 'LineString') {
        result.skipped++;
        continue;
      }

      try {
        // Call Google Maps API
        const lookupResult = await getRoadNameForLineString(road.geometry.coordinates);

        if (lookupResult.roadName) {
          // Update the road asset with the fetched name
          await db
            .update(roadAssets)
            .set({
              displayName: lookupResult.roadName,
              nameSource: 'google',
              nameConfidence: 'medium',
              updatedAt: new Date(),
            })
            .where(eq(roadAssets.id, road.id));

          result.enriched++;
          console.log(`[RoadNameEnrich] Road ${road.id}: "${lookupResult.roadName}"`);
        } else {
          result.skipped++;
        }

        // Add small delay to avoid rate limiting (100ms between requests)
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Road ${road.id}: ${message}`);
      }
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Query failed: ${message}`);
  }

  return result;
}

/**
 * Check if there are unnamed roads for an event
 * @param eventId The event ID to check
 * @returns Number of unnamed roads
 */
export async function countUnnamedRoadsForEvent(eventId: string): Promise<number> {
  const result = await db.execute(sql`
    SELECT COUNT(*)::int as count
    FROM road_assets ra
    INNER JOIN event_road_assets era ON ra.id = era.road_asset_id
    WHERE era.event_id = ${eventId}
      AND (
        COALESCE(TRIM(ra.display_name), '') = ''
        AND COALESCE(TRIM(ra.name), '') = ''
      )
  `);

  return (result.rows[0] as { count: number })?.count ?? 0;
}

/**
 * Count all unnamed roads that are associated with any event
 * @returns Number of unnamed roads covered by events
 */
export async function countAllEventUnnamedRoads(): Promise<number> {
  const result = await db.execute(sql`
    SELECT COUNT(DISTINCT ra.id)::int as count
    FROM road_assets ra
    INNER JOIN event_road_assets era ON ra.id = era.road_asset_id
    WHERE (
      COALESCE(TRIM(ra.display_name), '') = ''
      AND COALESCE(TRIM(ra.name), '') = ''
    )
  `);

  return (result.rows[0] as { count: number })?.count ?? 0;
}

/**
 * Enrich road names for ALL unnamed roads that are covered by any event
 * @param limit Maximum number of roads to process (for cost control)
 * @returns Statistics about the enrichment process
 */
export async function enrichAllEventRoadNames(limit: number = 100): Promise<EnrichmentResult> {
  const result: EnrichmentResult = {
    processed: 0,
    enriched: 0,
    skipped: 0,
    errors: [],
  };

  // Check if Google Maps is configured
  if (!isGoogleMapsConfigured()) {
    result.errors.push('Google Maps API is not configured');
    return result;
  }

  try {
    // Query all unnamed roads that are associated with any event
    // Use subquery to avoid DISTINCT with JSON
    const unnamedRoads = await db.execute(sql`
      SELECT
        ra.id,
        ST_AsGeoJSON(ra.geometry)::json as geometry
      FROM road_assets ra
      WHERE ra.id IN (
        SELECT DISTINCT era.road_asset_id
        FROM event_road_assets era
      )
      AND (
        COALESCE(TRIM(ra.display_name), '') = ''
        AND COALESCE(TRIM(ra.name), '') = ''
      )
      AND ra.geometry IS NOT NULL
      LIMIT ${limit}
    `);

    const roads = unnamedRoads.rows as Array<{
      id: string;
      geometry: { type: string; coordinates: [number, number][] };
    }>;

    console.log(`[RoadNameEnrich] Batch: Found ${roads.length} unnamed event-covered roads to process`);

    for (const road of roads) {
      result.processed++;

      // Skip non-LineString geometries
      if (!road.geometry || road.geometry.type !== 'LineString') {
        result.skipped++;
        continue;
      }

      try {
        // Call Google Maps API
        const lookupResult = await getRoadNameForLineString(road.geometry.coordinates);

        if (lookupResult.roadName) {
          // Update the road asset with the fetched name
          await db
            .update(roadAssets)
            .set({
              displayName: lookupResult.roadName,
              nameSource: 'google',
              nameConfidence: 'medium',
              updatedAt: new Date(),
            })
            .where(eq(roadAssets.id, road.id));

          result.enriched++;
          console.log(`[RoadNameEnrich] Road ${road.id}: "${lookupResult.roadName}"`);
        } else {
          result.skipped++;
        }

        // Add small delay to avoid rate limiting (100ms between requests)
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Road ${road.id}: ${message}`);
      }
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Query failed: ${message}`);
  }

  return result;
}

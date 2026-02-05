import type { ConstructionEvent } from '../db/schema.js';
import { db } from '../db/index.js';
import { eventRoadAssets } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const ORION_LD_URL = process.env.ORION_LD_URL || 'http://localhost:1026';
const NGSI_SYNC_ENABLED = process.env.NGSI_SYNC_ENABLED === 'true';

// Retry utility functions
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableError(status: number | undefined): boolean {
  // Only retry on 5xx errors or undefined (network error)
  return status === undefined || (status >= 500 && status < 600);
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxAttempts: number = 3
): Promise<Response | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, options);
      // 4xx errors are not retryable - return immediately
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }
      // 5xx errors - retry
      if (isRetryableError(response.status)) {
        console.error(`[NGSI-LD] Attempt ${attempt}/${maxAttempts} got ${response.status}`);
        if (attempt < maxAttempts) {
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          console.log(`[NGSI-LD] Retrying in ${delay}ms...`);
          await sleep(delay);
          continue;
        }
      }
      return response;
    } catch (error) {
      // Network error - retry
      console.error(`[NGSI-LD] Attempt ${attempt}/${maxAttempts} failed:`, error);
      if (attempt < maxAttempts) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[NGSI-LD] Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }
  console.error(`[NGSI-LD] All ${maxAttempts} attempts exhausted`);
  return null;
}

// Inline @context to avoid external URL dependency
const INLINE_CONTEXT = {
  'ngsi-ld': 'https://uri.etsi.org/ngsi-ld/',
  'fiware': 'https://uri.fiware.org/ns/data-models#',
  'schema': 'https://schema.org/',
  'ConstructionEvent': 'fiware:ConstructionEvent',
  'name': 'schema:name',
  'status': 'fiware:status',
  'startDate': 'schema:startDate',
  'endDate': 'schema:endDate',
  'restrictionType': 'fiware:restrictionType',
  'location': 'ngsi-ld:location',
  'postEndDecision': 'fiware:postEndDecision',
  'department': 'fiware:department',
  'ward': 'fiware:ward',
  'affectedRoadAssets': 'fiware:affectedRoadAssets',
  'modifiedAt': 'ngsi-ld:modifiedAt',
};

interface NgsiLdEntity {
  id: string;
  type: string;
  '@context': string | string[] | object | (string | object)[];
  [key: string]: any;
}

function eventToNgsiLd(event: ConstructionEvent, affectedRoadAssetIds: string[]): NgsiLdEntity {
  return {
    id: `urn:ngsi-ld:ConstructionEvent:${event.id}`,
    type: 'ConstructionEvent',
    '@context': INLINE_CONTEXT,
    name: {
      type: 'Property',
      value: event.name,
    },
    status: {
      type: 'Property',
      value: event.status,
    },
    startDate: {
      type: 'Property',
      value: {
        '@type': 'DateTime',
        '@value': event.startDate instanceof Date ? event.startDate.toISOString() : event.startDate,
      },
    },
    endDate: {
      type: 'Property',
      value: {
        '@type': 'DateTime',
        '@value': event.endDate instanceof Date ? event.endDate.toISOString() : event.endDate,
      },
    },
    restrictionType: {
      type: 'Property',
      value: event.restrictionType,
    },
    location: {
      type: 'GeoProperty',
      value: event.geometry,
    },
    postEndDecision: {
      type: 'Property',
      value: event.postEndDecision,
    },
    department: {
      type: 'Property',
      value: event.department,
    },
    ...(event.ward && {
      ward: {
        type: 'Property',
        value: event.ward,
      },
    }),
    ...(affectedRoadAssetIds.length > 0 && {
      affectedRoadAssets: {
        type: 'Relationship',
        object: affectedRoadAssetIds.map(id => `urn:ngsi-ld:RoadAsset:${id}`),
      },
    }),
    modifiedAt: {
      type: 'Property',
      value: {
        '@type': 'DateTime',
        '@value': event.updatedAt instanceof Date ? event.updatedAt.toISOString() : event.updatedAt,
      },
    },
  };
}

export async function syncEventToOrion(event: ConstructionEvent): Promise<void> {
  if (!NGSI_SYNC_ENABLED) return;

  // Query join table for related road assets
  const relations = await db.select({ roadAssetId: eventRoadAssets.roadAssetId })
    .from(eventRoadAssets)
    .where(eq(eventRoadAssets.eventId, event.id));
  const affectedRoadAssetIds = relations.map(r => r.roadAssetId);

  const entity = eventToNgsiLd(event, affectedRoadAssetIds);
  const entityId = entity.id;

  try {
    // Try to get existing entity (with retry)
    const getResponse = await fetchWithRetry(
      `${ORION_LD_URL}/ngsi-ld/v1/entities/${encodeURIComponent(entityId)}`,
      {
        headers: {
          'Accept': 'application/ld+json',
        },
      }
    );

    if (!getResponse) {
      console.error(`[NGSI-LD] Failed to check entity ${entityId} after retries`);
      return;
    }

    if (getResponse.ok) {
      // Entity exists, update it
      // Remove id, type, and @context for PATCH
      const { id, type, '@context': context, ...attributes } = entity;

      const patchResponse = await fetchWithRetry(
        `${ORION_LD_URL}/ngsi-ld/v1/entities/${encodeURIComponent(entityId)}/attrs`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/ld+json',
          },
          body: JSON.stringify({
            '@context': context,
            ...attributes,
          }),
        }
      );

      if (!patchResponse || !patchResponse.ok) {
        const errorText = patchResponse ? await patchResponse.text() : 'No response';
        console.error(`[NGSI-LD] Failed to update entity ${entityId}:`, errorText);
      } else {
        console.log(`[NGSI-LD] Updated entity ${entityId}`);
      }
    } else if (getResponse.status === 404) {
      // Entity doesn't exist, create it
      const createResponse = await fetchWithRetry(
        `${ORION_LD_URL}/ngsi-ld/v1/entities`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/ld+json',
          },
          body: JSON.stringify(entity),
        }
      );

      if (!createResponse || !createResponse.ok) {
        const errorText = createResponse ? await createResponse.text() : 'No response';
        console.error(`[NGSI-LD] Failed to create entity ${entityId}:`, errorText);
      } else {
        console.log(`[NGSI-LD] Created entity ${entityId}`);
      }
    } else {
      console.error(`[NGSI-LD] Unexpected response when checking entity ${entityId}:`, getResponse.status);
    }
  } catch (error) {
    console.error(`[NGSI-LD] Error syncing entity ${entityId}:`, error);
  }
}

export async function deleteEventFromOrion(eventId: string): Promise<void> {
  if (!NGSI_SYNC_ENABLED) return;

  const entityId = `urn:ngsi-ld:ConstructionEvent:${eventId}`;

  try {
    const response = await fetch(`${ORION_LD_URL}/ngsi-ld/v1/entities/${encodeURIComponent(entityId)}`, {
      method: 'DELETE',
    });

    if (!response.ok && response.status !== 404) {
      const errorText = await response.text();
      console.error(`[NGSI-LD] Failed to delete entity ${entityId}:`, errorText);
    } else {
      console.log(`[NGSI-LD] Deleted entity ${entityId}`);
    }
  } catch (error) {
    console.error(`[NGSI-LD] Error deleting entity ${entityId}:`, error);
  }
}

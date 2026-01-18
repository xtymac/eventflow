import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { db } from '../db/index.js';
import { constructionEvents } from '../db/schema.js';
import { fromGeomSql } from '../db/geometry.js';
import { and, desc, eq, gte, ilike, isNull, lte, or, sql } from 'drizzle-orm';
import {
  searchPlaces,
  isWithinNagoyaBounds,
  isGoogleMapsConfigured,
} from '../services/google-maps.js';

// Coordinate detection regex - matches "lng,lat" or "lat,lng" formats
const COORD_REGEX = /^(-?\d{1,3}\.?\d*)\s*,\s*(-?\d{1,3}\.?\d*)$/;

/**
 * Parse coordinate input and determine if it's lng,lat or lat,lng format
 * Based on Nagoya's coordinates: lat ~35, lng ~137
 */
function parseCoordinates(input: string): { lng: number; lat: number } | null {
  const trimmed = input.trim();
  const match = trimmed.match(COORD_REGEX);
  if (!match) return null;

  const a = parseFloat(match[1]);
  const b = parseFloat(match[2]);

  // Validate both numbers are valid
  if (isNaN(a) || isNaN(b)) return null;

  // Heuristic: Nagoya latitude ~35, longitude ~137
  // If first number is in lng range (136-138) and second in lat range (34-36)
  if (a >= 136 && a <= 138 && b >= 34 && b <= 36) {
    return { lng: a, lat: b }; // lng,lat format
  }
  // If first number is in lat range and second in lng range
  if (b >= 136 && b <= 138 && a >= 34 && a <= 36) {
    return { lng: b, lat: a }; // lat,lng format
  }

  // If neither matches Nagoya ranges, still try to parse but may be out of bounds
  // Assume lng,lat if first number > 100 (typical for Japan longitude)
  if (a > 100) {
    return { lng: a, lat: b };
  }
  return { lng: b, lat: a };
}

function parseBbox(bbox: string): { minLng: number; minLat: number; maxLng: number; maxLat: number } | null {
  const parts = bbox.split(',').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return null;
  const [minLng, minLat, maxLng, maxLat] = parts;
  if (minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90) return null;
  if (minLng > maxLng || minLat > maxLat) return null;
  return { minLng, minLat, maxLng, maxLat };
}

function bboxFromCenter(center: [number, number], radiusMeters: number) {
  const [lng, lat] = center;
  const latDelta = radiusMeters / 111_320;
  const lngDelta = radiusMeters / (111_320 * Math.cos((lat * Math.PI) / 180));
  return {
    minLng: lng - lngDelta,
    minLat: lat - latDelta,
    maxLng: lng + lngDelta,
    maxLat: lat + latDelta,
  };
}

type SearchTarget = 'events' | 'roads' | 'greenspaces' | 'streetlights' | 'rivers' | 'places';

type SearchFilters = {
  eventStatus?: 'planned' | 'active' | 'ended' | 'cancelled' | null;
  eventDepartment?: string | null;
  eventWard?: string | null;
  eventDateFrom?: string | null;
  eventDateTo?: string | null;
  assetStatus?: 'active' | 'inactive' | null;
  assetRoadType?: 'arterial' | 'collector' | 'local' | null;
  assetWard?: string | null;
  assetUnnamed?: boolean | null;
  greenspaceType?: 'park' | 'garden' | 'grass' | 'forest' | 'meadow' | 'playground' | null;
  streetlightLampType?: 'led' | 'sodium' | 'mercury' | 'fluorescent' | 'halogen' | null;
  streetlightLampStatus?: 'operational' | 'maintenance' | 'damaged' | 'replaced' | null;
  riverWaterwayType?: 'river' | 'stream' | 'canal' | 'drain' | null;
};

interface SearchIntent {
  targets: SearchTarget[];
  query?: string | null;
  filters?: SearchFilters;
  location?: {
    type?: 'place' | 'coordinate' | null;
    placeQuery?: string | null;
    coordinates?: [number, number] | null;
    radiusMeters?: number | null;
  };
}

const GeometrySchema = Type.Object({
  type: Type.String(),
  coordinates: Type.Any(),
});

// Search result type (places only)
const PlaceSearchResultSchema = Type.Object({
  id: Type.String(),
  type: Type.Literal('place'),
  name: Type.String(),
  address: Type.Optional(Type.String()),
  coordinates: Type.Tuple([Type.Number(), Type.Number()]), // [lng, lat]
  metadata: Type.Optional(Type.Object({
    placeId: Type.Optional(Type.String()),
  })),
});

const GeocodeResponseSchema = Type.Object({
  data: Type.Object({
    places: Type.Array(PlaceSearchResultSchema),
    searchCenter: Type.Optional(Type.Tuple([Type.Number(), Type.Number()])),
    isCoordinateSearch: Type.Boolean(),
  }),
  meta: Type.Object({
    query: Type.String(),
    processingTime: Type.Number(),
    error: Type.Optional(Type.String()),
    errorMessage: Type.Optional(Type.String()),
  }),
});

const UnifiedSearchResultSchema = Type.Object({
  id: Type.String(),
  type: Type.Union([
    Type.Literal('place'),
    Type.Literal('coordinate'),
    Type.Literal('event'),
    Type.Literal('road'),
    Type.Literal('greenspace'),
    Type.Literal('streetlight'),
    Type.Literal('river'),
  ]),
  name: Type.String(),
  subtitle: Type.Optional(Type.String()),
  coordinates: Type.Optional(Type.Tuple([Type.Number(), Type.Number()])),
  geometry: Type.Optional(GeometrySchema),
  sourceId: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Any())),
});

const UnifiedSearchResponseSchema = Type.Object({
  data: Type.Object({
    results: Type.Array(UnifiedSearchResultSchema),
    searchCenter: Type.Optional(Type.Tuple([Type.Number(), Type.Number()])),
    isCoordinateSearch: Type.Boolean(),
  }),
  meta: Type.Object({
    query: Type.String(),
    processingTime: Type.Number(),
    error: Type.Optional(Type.String()),
    errorMessage: Type.Optional(Type.String()),
  }),
});

const DEFAULT_TARGETS: SearchTarget[] = ['places', 'events', 'roads'];
const MAX_STREETLIGHT_BBOX_M2 = 2_000_000;

function normalizeIntent(raw: unknown, fallbackQuery: string): SearchIntent {
  const safe = typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : {};
  const rawTargets = Array.isArray(safe.targets) ? safe.targets : [];
  const allowedTargets = new Set<SearchTarget>(['events', 'roads', 'greenspaces', 'streetlights', 'rivers', 'places']);
  const targets = rawTargets
    .filter((t): t is SearchTarget => typeof t === 'string' && allowedTargets.has(t as SearchTarget));
  const query = typeof safe.query === 'string' && safe.query.trim() ? safe.query.trim() : fallbackQuery.trim();

  const filters = typeof safe.filters === 'object' && safe.filters !== null
    ? safe.filters as Record<string, unknown>
    : {};

  const location = typeof safe.location === 'object' && safe.location !== null
    ? safe.location as Record<string, unknown>
    : {};

  const coordinates = Array.isArray(location.coordinates)
    && location.coordinates.length === 2
    && location.coordinates.every((v) => typeof v === 'number' && !Number.isNaN(v))
    ? [location.coordinates[0] as number, location.coordinates[1] as number] as [number, number]
    : null;

  const normalizedFilters: SearchFilters = {
    eventStatus: typeof filters.eventStatus === 'string' ? filters.eventStatus as SearchFilters['eventStatus'] : null,
    eventDepartment: typeof filters.eventDepartment === 'string' ? filters.eventDepartment : null,
    eventWard: typeof filters.eventWard === 'string' ? filters.eventWard : null,
    eventDateFrom: typeof filters.eventDateFrom === 'string' ? filters.eventDateFrom : null,
    eventDateTo: typeof filters.eventDateTo === 'string' ? filters.eventDateTo : null,
    assetStatus: typeof filters.assetStatus === 'string' ? filters.assetStatus as SearchFilters['assetStatus'] : null,
    assetRoadType: typeof filters.assetRoadType === 'string' ? filters.assetRoadType as SearchFilters['assetRoadType'] : null,
    assetWard: typeof filters.assetWard === 'string' ? filters.assetWard : null,
    assetUnnamed: typeof filters.assetUnnamed === 'boolean' ? filters.assetUnnamed : null,
    greenspaceType: typeof filters.greenspaceType === 'string' ? filters.greenspaceType as SearchFilters['greenspaceType'] : null,
    streetlightLampType: typeof filters.streetlightLampType === 'string' ? filters.streetlightLampType as SearchFilters['streetlightLampType'] : null,
    streetlightLampStatus: typeof filters.streetlightLampStatus === 'string' ? filters.streetlightLampStatus as SearchFilters['streetlightLampStatus'] : null,
    riverWaterwayType: typeof filters.riverWaterwayType === 'string' ? filters.riverWaterwayType as SearchFilters['riverWaterwayType'] : null,
  };

  if (!normalizedFilters.assetWard && normalizedFilters.eventWard) {
    normalizedFilters.assetWard = normalizedFilters.eventWard;
  }

  return {
    targets: targets.length > 0 ? targets : DEFAULT_TARGETS,
    query,
    filters: normalizedFilters,
    location: {
      type: location.type === 'place' || location.type === 'coordinate' ? location.type : null,
      placeQuery: typeof location.placeQuery === 'string' ? location.placeQuery : null,
      coordinates,
      radiusMeters: typeof location.radiusMeters === 'number' && !Number.isNaN(location.radiusMeters)
        ? location.radiusMeters
        : null,
    },
  };
}

function buildIntentPrompt(query: string, locale?: string) {
  const languageHint = locale ? `Locale: ${locale}` : 'Locale: unknown';
  return [
    'You are a parser for a map search bar. Return ONLY a JSON object.',
    languageHint,
    'Schema:',
    '{',
    '  "targets": ["events","roads","greenspaces","streetlights","rivers","places"],',
    '  "query": string|null,',
    '  "filters": {',
    '    "eventStatus": "planned"|"active"|"ended"|"cancelled"|null,',
    '    "eventDepartment": string|null,',
    '    "eventWard": string|null,',
    '    "eventDateFrom": string|null,',
    '    "eventDateTo": string|null,',
    '    "assetStatus": "active"|"inactive"|null,',
    '    "assetRoadType": "arterial"|"collector"|"local"|null,',
    '    "assetWard": string|null,',
    '    "assetUnnamed": boolean|null,',
    '    "greenspaceType": "park"|"garden"|"grass"|"forest"|"meadow"|"playground"|null,',
    '    "streetlightLampType": "led"|"sodium"|"mercury"|"fluorescent"|"halogen"|null,',
    '    "streetlightLampStatus": "operational"|"maintenance"|"damaged"|"replaced"|null,',
    '    "riverWaterwayType": "river"|"stream"|"canal"|"drain"|null',
    '  },',
    '  "location": {',
    '    "type": "place"|"coordinate"|null,',
    '    "placeQuery": string|null,',
    '    "coordinates": [lng, lat]|null,',
    '    "radiusMeters": number|null',
    '  }',
    '}',
    'Rules:',
    '- If the input contains explicit coordinates, set location.type="coordinate" and coordinates.',
    '- If the user mentions a place/landmark (地标/地点/場所), set targets to include "places" and fill placeQuery.',
    '- If the user mentions events (イベント/工事/施工), include "events".',
    '- If the user mentions roads (道路/road/street), include "roads".',
    '- If the user mentions greenspace (公園/緑地/park), include "greenspaces".',
    '- If the user mentions streetlights (街灯/路灯/streetlight), include "streetlights".',
    '- If the user mentions rivers (川/河川/river), include "rivers".',
    '- If no explicit target, default to ["places","events","roads"].',
    '- Put the remaining keywords into "query". If unsure, use the original input.',
    'Input:',
    query,
  ].join('\n');
}

function extractGeminiText(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const parts = data.candidates?.[0]?.content?.parts;
  if (!parts || parts.length === 0) return null;
  return parts.map((part) => part.text ?? '').join('').trim() || null;
}

async function parseSearchIntent(query: string, locale?: string): Promise<SearchIntent | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const prompt = buildIntentPrompt(query, locale);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 256,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.warn('[Search] Gemini error:', response.status, errorText);
      return null;
    }

    const payload = await response.json();
    const text = extractGeminiText(payload);
    if (!text) return null;

    const parsed = JSON.parse(text);
    return normalizeIntent(parsed, query);
  } catch (error) {
    console.warn('[Search] Gemini parse failed:', error);
    return null;
  }
}

function fallbackIntentFromQuery(query: string): SearchIntent {
  const targets = new Set<SearchTarget>(DEFAULT_TARGETS);

  if (/(イベント|event|工事|施工)/i.test(query)) targets.add('events');
  if (/(道路|road|street)/i.test(query)) targets.add('roads');
  if (/(公園|緑地|park|green)/i.test(query)) targets.add('greenspaces');
  if (/(街灯|路灯|streetlight|light)/i.test(query)) targets.add('streetlights');
  if (/(川|河川|river|stream|canal|drain)/i.test(query)) targets.add('rivers');
  if (/(地標|地标|地点|場所|place|landmark)/i.test(query)) targets.add('places');

  return normalizeIntent({ targets: Array.from(targets), query }, query);
}

function resolveSearchBbox(
  bbox: string | undefined,
  center: [number, number] | undefined,
  location: SearchIntent['location'] | undefined,
) {
  if (bbox) {
    const parsed = parseBbox(bbox);
    if (parsed) return parsed;
  }
  if (location?.coordinates) {
    const radius = location.radiusMeters && location.radiusMeters > 0 ? location.radiusMeters : 1000;
    return bboxFromCenter(location.coordinates, radius);
  }
  if (center) {
    return bboxFromCenter(center, 1000);
  }
  return null;
}

async function resolveStreetlightBbox(
  baseBbox: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null,
  center: [number, number] | undefined,
) {
  if (!baseBbox && center) {
    return bboxFromCenter(center, 600);
  }
  if (!baseBbox) return null;

  const areaResult = await db.execute<{ area: string }>(sql`
    SELECT ST_Area(
      ST_MakeEnvelope(${baseBbox.minLng}, ${baseBbox.minLat}, ${baseBbox.maxLng}, ${baseBbox.maxLat}, 4326)::geography
    )::numeric as area
  `);
  const area = Number(areaResult.rows[0]?.area || 0);
  if (area <= MAX_STREETLIGHT_BBOX_M2) return baseBbox;

  if (center) {
    return bboxFromCenter(center, 600);
  }
  return null;
}

function formatSubtitle(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(' · ');
}

type UnifiedSearchResult = {
  id: string;
  type: 'place' | 'coordinate' | 'event' | 'road' | 'greenspace' | 'streetlight' | 'river';
  name: string;
  subtitle?: string;
  coordinates?: [number, number];
  geometry?: { type: string; coordinates: unknown };
  sourceId?: string;
  metadata?: Record<string, unknown>;
};

async function searchEvents(query: string, filters: SearchFilters | undefined, limit: number): Promise<UnifiedSearchResult[]> {
  const conditions = [];
  const trimmedQuery = query.trim();

  if (filters?.eventStatus) conditions.push(eq(constructionEvents.status, filters.eventStatus));
  if (filters?.eventDepartment) conditions.push(ilike(constructionEvents.department, `%${filters.eventDepartment}%`));
  if (filters?.eventWard) conditions.push(ilike(constructionEvents.ward, `%${filters.eventWard}%`));
  if (filters?.eventDateFrom) {
    const parsed = new Date(filters.eventDateFrom);
    if (!Number.isNaN(parsed.getTime())) {
      conditions.push(gte(constructionEvents.startDate, parsed));
    }
  }
  if (filters?.eventDateTo) {
    const parsed = new Date(filters.eventDateTo);
    if (!Number.isNaN(parsed.getTime())) {
      conditions.push(lte(constructionEvents.endDate, parsed));
    }
  }
  if (trimmedQuery) {
    const pattern = `%${trimmedQuery}%`;
    conditions.push(or(
      ilike(constructionEvents.name, pattern),
      ilike(constructionEvents.department, pattern),
      ilike(constructionEvents.ward, pattern),
    ));
  }
  conditions.push(isNull(constructionEvents.archivedAt));

  const eventSelect = {
    id: constructionEvents.id,
    name: constructionEvents.name,
    status: constructionEvents.status,
    department: constructionEvents.department,
    ward: constructionEvents.ward,
    geometry: fromGeomSql(constructionEvents.geometry),
    updatedAt: constructionEvents.updatedAt,
  };

  let queryBuilder = db.select(eventSelect).from(constructionEvents);
  if (conditions.length > 0) {
    queryBuilder = queryBuilder.where(and(...conditions));
  }
  const rows = await queryBuilder.orderBy(desc(constructionEvents.updatedAt)).limit(limit);

  return rows.map((event) => ({
    id: `event:${event.id}`,
    type: 'event',
    name: event.name,
    subtitle: formatSubtitle([event.status, event.ward, event.department]),
    geometry: event.geometry ?? undefined,
    sourceId: event.id,
    metadata: {
      status: event.status,
      ward: event.ward,
      department: event.department,
    },
  }));
}

async function searchRoads(
  query: string,
  filters: SearchFilters | undefined,
  bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null,
  limit: number,
): Promise<UnifiedSearchResult[]> {
  const conditions: ReturnType<typeof sql>[] = [];
  const trimmedQuery = query.trim();

  if (filters?.assetStatus) conditions.push(sql`status = ${filters.assetStatus}`);
  if (filters?.assetRoadType) conditions.push(sql`road_type = ${filters.assetRoadType}`);
  if (filters?.assetWard) conditions.push(sql`ward = ${filters.assetWard}`);
  if (filters?.assetUnnamed) {
    conditions.push(sql`(
      COALESCE(TRIM(name), '') = ''
      OR LOWER(COALESCE(TRIM(name), '')) = 'unnamed road'
    )`);
  }
  if (trimmedQuery) {
    const pattern = `%${trimmedQuery}%`;
    conditions.push(sql`(
      COALESCE(name, '') ILIKE ${pattern}
      OR COALESCE(name_ja, '') ILIKE ${pattern}
      OR COALESCE(display_name, '') ILIKE ${pattern}
      OR COALESCE(ref, '') ILIKE ${pattern}
      OR COALESCE(local_ref, '') ILIKE ${pattern}
      OR COALESCE(landmark, '') ILIKE ${pattern}
      OR COALESCE(sublocality, '') ILIKE ${pattern}
      OR id ILIKE ${pattern}
    )`);
  }
  if (bbox) {
    conditions.push(sql`ST_Intersects(geometry, ST_MakeEnvelope(${bbox.minLng}, ${bbox.minLat}, ${bbox.maxLng}, ${bbox.maxLat}, 4326))`);
  }

  const whereClause = conditions.length > 0
    ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
    : sql``;

  type RoadRow = {
    id: string;
    name: string | null;
    nameJa: string | null;
    displayName: string | null;
    roadType: string | null;
    ward: string | null;
    status: string | null;
    geometry: { type: string; coordinates: unknown } | null;
  };

  const rows = await db.execute<RoadRow>(sql`
    SELECT
      id,
      name,
      name_ja as "nameJa",
      display_name as "displayName",
      road_type as "roadType",
      ward,
      status,
      ST_AsGeoJSON(geometry)::json as geometry
    FROM road_assets
    ${whereClause}
    ORDER BY updated_at DESC
    LIMIT ${limit}
  `);

  return rows.rows.map((asset) => {
    const displayName = asset.displayName || asset.name || asset.nameJa || asset.id;
    return {
      id: `road:${asset.id}`,
      type: 'road',
      name: displayName,
      subtitle: formatSubtitle([asset.roadType, asset.ward, asset.status]),
      geometry: asset.geometry ?? undefined,
      sourceId: asset.id,
      metadata: {
        roadType: asset.roadType,
        ward: asset.ward,
        status: asset.status,
      },
    };
  });
}

async function searchGreenSpaces(
  query: string,
  filters: SearchFilters | undefined,
  bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null,
  limit: number,
): Promise<UnifiedSearchResult[]> {
  if (!bbox) return [];
  const conditions: ReturnType<typeof sql>[] = [
    sql`ST_Intersects(geometry, ST_MakeEnvelope(${bbox.minLng}, ${bbox.minLat}, ${bbox.maxLng}, ${bbox.maxLat}, 4326))`,
  ];
  const trimmedQuery = query.trim();

  if (filters?.greenspaceType) conditions.push(sql`green_space_type = ${filters.greenspaceType}`);
  if (filters?.assetWard) conditions.push(sql`ward = ${filters.assetWard}`);
  if (trimmedQuery) {
    const pattern = `%${trimmedQuery}%`;
    conditions.push(sql`(
      COALESCE(name, '') ILIKE ${pattern}
      OR COALESCE(name_ja, '') ILIKE ${pattern}
      OR COALESCE(display_name, '') ILIKE ${pattern}
      OR id ILIKE ${pattern}
    )`);
  }

  const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

  type GreenSpaceRow = {
    id: string;
    name: string | null;
    nameJa: string | null;
    displayName: string | null;
    greenSpaceType: string | null;
    areaM2: number | null;
    ward: string | null;
    geometry: { type: string; coordinates: unknown } | null;
  };

  const rows = await db.execute<GreenSpaceRow>(sql`
    SELECT
      id,
      name,
      name_ja as "nameJa",
      display_name as "displayName",
      green_space_type as "greenSpaceType",
      area_m2 as "areaM2",
      ward,
      ST_AsGeoJSON(geometry)::json as geometry
    FROM greenspace_assets
    ${whereClause}
    ORDER BY area_m2 DESC NULLS LAST
    LIMIT ${limit}
  `);

  return rows.rows.map((asset) => {
    const displayName = asset.displayName || asset.nameJa || asset.name || asset.id;
    return {
      id: `greenspace:${asset.id}`,
      type: 'greenspace',
      name: displayName,
      subtitle: formatSubtitle([asset.greenSpaceType, asset.ward]),
      geometry: asset.geometry ?? undefined,
      sourceId: asset.id,
      metadata: {
        greenSpaceType: asset.greenSpaceType,
        ward: asset.ward,
        areaM2: asset.areaM2,
      },
    };
  });
}

async function searchStreetLights(
  query: string,
  filters: SearchFilters | undefined,
  bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null,
  limit: number,
): Promise<UnifiedSearchResult[]> {
  if (!bbox) return [];
  const conditions: ReturnType<typeof sql>[] = [
    sql`ST_Intersects(geometry, ST_MakeEnvelope(${bbox.minLng}, ${bbox.minLat}, ${bbox.maxLng}, ${bbox.maxLat}, 4326))`,
  ];
  const trimmedQuery = query.trim();

  if (filters?.streetlightLampType) conditions.push(sql`lamp_type = ${filters.streetlightLampType}`);
  if (filters?.streetlightLampStatus) conditions.push(sql`lamp_status = ${filters.streetlightLampStatus}`);
  if (filters?.assetWard) conditions.push(sql`ward = ${filters.assetWard}`);
  if (trimmedQuery) {
    const pattern = `%${trimmedQuery}%`;
    conditions.push(sql`(
      COALESCE(display_name, '') ILIKE ${pattern}
      OR COALESCE(lamp_id, '') ILIKE ${pattern}
      OR id ILIKE ${pattern}
    )`);
  }

  const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

  type StreetlightRow = {
    id: string;
    lampId: string | null;
    displayName: string | null;
    lampType: string | null;
    lampStatus: string | null;
    ward: string | null;
    geometry: { type: string; coordinates: unknown } | null;
  };

  const rows = await db.execute<StreetlightRow>(sql`
    SELECT
      id,
      lamp_id as "lampId",
      display_name as "displayName",
      lamp_type as "lampType",
      lamp_status as "lampStatus",
      ward,
      ST_AsGeoJSON(geometry)::json as geometry
    FROM streetlight_assets
    ${whereClause}
    ORDER BY updated_at DESC
    LIMIT ${limit}
  `);

  return rows.rows.map((asset) => {
    const displayName = asset.displayName || asset.lampId || asset.id;
    return {
      id: `streetlight:${asset.id}`,
      type: 'streetlight',
      name: displayName,
      subtitle: formatSubtitle([asset.lampType, asset.ward, asset.lampStatus]),
      geometry: asset.geometry ?? undefined,
      sourceId: asset.id,
      metadata: {
        lampType: asset.lampType,
        lampStatus: asset.lampStatus,
        ward: asset.ward,
      },
    };
  });
}

async function searchRivers(
  query: string,
  filters: SearchFilters | undefined,
  bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null,
  limit: number,
): Promise<UnifiedSearchResult[]> {
  if (!bbox) return [];
  const conditions: ReturnType<typeof sql>[] = [
    sql`ST_Intersects(geometry, ST_MakeEnvelope(${bbox.minLng}, ${bbox.minLat}, ${bbox.maxLng}, ${bbox.maxLat}, 4326))`,
  ];
  const trimmedQuery = query.trim();

  if (filters?.riverWaterwayType) conditions.push(sql`waterway_type = ${filters.riverWaterwayType}`);
  if (filters?.assetWard) conditions.push(sql`ward = ${filters.assetWard}`);
  if (trimmedQuery) {
    const pattern = `%${trimmedQuery}%`;
    conditions.push(sql`(
      COALESCE(name, '') ILIKE ${pattern}
      OR COALESCE(name_ja, '') ILIKE ${pattern}
      OR COALESCE(display_name, '') ILIKE ${pattern}
      OR id ILIKE ${pattern}
    )`);
  }

  const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

  type RiverRow = {
    id: string;
    name: string | null;
    nameJa: string | null;
    displayName: string | null;
    geometryType: string | null;
    waterwayType: string | null;
    ward: string | null;
    geometry: { type: string; coordinates: unknown } | null;
  };

  const rows = await db.execute<RiverRow>(sql`
    SELECT
      id,
      name,
      name_ja as "nameJa",
      display_name as "displayName",
      geometry_type as "geometryType",
      waterway_type as "waterwayType",
      ward,
      ST_AsGeoJSON(geometry)::json as geometry
    FROM river_assets
    ${whereClause}
    ORDER BY updated_at DESC
    LIMIT ${limit}
  `);

  return rows.rows.map((asset) => {
    const displayName = asset.displayName || asset.nameJa || asset.name || asset.id;
    return {
      id: `river:${asset.id}`,
      type: 'river',
      name: displayName,
      subtitle: formatSubtitle([asset.waterwayType, asset.ward]),
      geometry: asset.geometry ?? undefined,
      sourceId: asset.id,
      metadata: {
        waterwayType: asset.waterwayType,
        ward: asset.ward,
        geometryType: asset.geometryType,
      },
    };
  });
}

export async function searchRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // POST /search/nl - Natural language search across map data
  app.post('/nl', {
    schema: {
      body: Type.Object({
        query: Type.String({ minLength: 1 }),
        bbox: Type.Optional(Type.String()), // "minLng,minLat,maxLng,maxLat"
        mapCenter: Type.Optional(Type.Tuple([Type.Number(), Type.Number()])),
        mapZoom: Type.Optional(Type.Number()),
        view: Type.Optional(Type.Union([Type.Literal('events'), Type.Literal('assets'), Type.Literal('inspections')])),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 10 })),
        locale: Type.Optional(Type.String()),
      }),
      response: {
        200: UnifiedSearchResponseSchema,
      },
    },
  }, async (request) => {
    const startTime = Date.now();
    const {
      query,
      bbox,
      mapCenter,
      limit = 10,
      locale,
    } = request.body;

    // Coordinate-only search
    const coords = parseCoordinates(query);
    if (coords) {
      if (!isWithinNagoyaBounds(coords.lng, coords.lat)) {
        return {
          data: {
            results: [],
            searchCenter: [coords.lng, coords.lat] as [number, number],
            isCoordinateSearch: true,
          },
          meta: {
            query,
            processingTime: Date.now() - startTime,
            error: 'OUTSIDE_BOUNDS',
            errorMessage: '指定された座標は名古屋市の範囲外です (Coordinates are outside Nagoya city limits)',
          },
        };
      }

      return {
        data: {
          results: [],
          searchCenter: [coords.lng, coords.lat] as [number, number],
          isCoordinateSearch: true,
        },
        meta: {
          query,
          processingTime: Date.now() - startTime,
        },
      };
    }

    const intent = (await parseSearchIntent(query, locale)) ?? fallbackIntentFromQuery(query);
    const queryText = intent.query ?? query;
    const center = mapCenter ?? intent.location?.coordinates ?? undefined;
    const searchBbox = resolveSearchBbox(bbox, center, intent.location);
    const streetlightBbox = await resolveStreetlightBbox(searchBbox, center);

    const perTargetLimit = Math.max(1, Math.floor(limit / intent.targets.length));
    const results: UnifiedSearchResult[] = [];

    const addResults = async (fn: () => Promise<UnifiedSearchResult[]>) => {
      try {
        const items = await fn();
        results.push(...items);
      } catch (error) {
        console.warn('[Search] NL search failed:', error);
      }
    };

    if (intent.targets.includes('places')) {
      const placeQuery = intent.location?.placeQuery || queryText;
      if (placeQuery.trim()) {
        await addResults(async () => {
          const places = await searchPlacesWithTransform(placeQuery, perTargetLimit);
          return places.map((place) => ({
            id: `place:${place.id}`,
            type: 'place',
            name: place.name,
            subtitle: place.address,
            coordinates: place.coordinates,
            geometry: { type: 'Point', coordinates: place.coordinates },
            sourceId: place.id,
            metadata: place.metadata,
          }));
        });
      }
    }

    if (intent.targets.includes('events')) {
      await addResults(() => searchEvents(queryText, intent.filters, perTargetLimit));
    }
    if (intent.targets.includes('roads')) {
      await addResults(() => searchRoads(queryText, intent.filters, searchBbox, perTargetLimit));
    }
    if (intent.targets.includes('greenspaces')) {
      await addResults(() => searchGreenSpaces(queryText, intent.filters, searchBbox, perTargetLimit));
    }
    if (intent.targets.includes('streetlights')) {
      await addResults(() => searchStreetLights(queryText, intent.filters, streetlightBbox, perTargetLimit));
    }
    if (intent.targets.includes('rivers')) {
      await addResults(() => searchRivers(queryText, intent.filters, searchBbox, perTargetLimit));
    }

    return {
      data: {
        results,
        isCoordinateSearch: false,
      },
      meta: {
        query,
        processingTime: Date.now() - startTime,
      },
    };
  });

  // GET /search/geocode - Map navigation search (Google Places + coordinates)
  app.get('/geocode', {
    schema: {
      querystring: Type.Object({
        q: Type.String({ minLength: 1 }),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 10 })),
      }),
      response: {
        200: GeocodeResponseSchema,
      },
    },
  }, async (request) => {
    const startTime = Date.now();
    const { q: query, limit = 10 } = request.query;

    // Check for coordinate input
    const coords = parseCoordinates(query);

    if (coords) {
      // Coordinate search mode - just validate and return center
      if (!isWithinNagoyaBounds(coords.lng, coords.lat)) {
        return {
          data: {
            places: [],
            searchCenter: [coords.lng, coords.lat] as [number, number],
            isCoordinateSearch: true,
          },
          meta: {
            query,
            processingTime: Date.now() - startTime,
            error: 'OUTSIDE_BOUNDS',
            errorMessage: '指定された座標は名古屋市の範囲外です (Coordinates are outside Nagoya city limits)',
          },
        };
      }

      // Valid coordinates - return as search center for flyTo
      return {
        data: {
          places: [],
          searchCenter: [coords.lng, coords.lat] as [number, number],
          isCoordinateSearch: true,
        },
        meta: {
          query,
          processingTime: Date.now() - startTime,
        },
      };
    }

    // Text search mode - use Google Places API
    const places = await searchPlacesWithTransform(query, limit);

    return {
      data: {
        places,
        isCoordinateSearch: false,
      },
      meta: {
        query,
        processingTime: Date.now() - startTime,
      },
    };
  });
}

// Helper: Search places using Google Places API and transform to SearchResult
async function searchPlacesWithTransform(query: string, limit: number) {
  if (!isGoogleMapsConfigured()) {
    console.warn('[Search] Google Maps API key not configured');
    return [];
  }

  try {
    const places = await searchPlaces(query, limit);
    return places.map((place) => ({
      id: place.placeId,
      type: 'place' as const,
      name: place.name,
      address: place.address,
      coordinates: place.coordinates,
      metadata: {
        placeId: place.placeId,
      },
    }));
  } catch (error) {
    console.error('[Search] Google Places API error:', error);
    return [];
  }
}

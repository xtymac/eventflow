import { db } from '../../db/index.js';
import { sql } from 'drizzle-orm';
import type { Extent, Link } from '../../routes/ogc/schemas/ogc-common.js';

// Supported CRS URIs
export const CRS84 = 'http://www.opengis.net/def/crs/OGC/1.3/CRS84';
export const EPSG_4326 = 'http://www.opengis.net/def/crs/EPSG/0/4326';
export const EPSG_3857 = 'http://www.opengis.net/def/crs/EPSG/0/3857';
export const EPSG_6675 = 'http://www.opengis.net/def/crs/EPSG/0/6675';

export const SUPPORTED_CRS = [
  CRS84, EPSG_4326, EPSG_3857,
  'http://www.opengis.net/def/crs/EPSG/0/6669',
  'http://www.opengis.net/def/crs/EPSG/0/6670',
  'http://www.opengis.net/def/crs/EPSG/0/6671',
  'http://www.opengis.net/def/crs/EPSG/0/6672',
  'http://www.opengis.net/def/crs/EPSG/0/6673',
  'http://www.opengis.net/def/crs/EPSG/0/6674',
  EPSG_6675,
  'http://www.opengis.net/def/crs/EPSG/0/6676',
];

// Geometry types
type GeometryType = 'Point' | 'LineString' | 'Polygon' | 'MultiPoint' | 'MultiLineString' | 'MultiPolygon';

/**
 * Collection configuration
 */
export interface CollectionConfig {
  id: string;
  table: string;
  title: string;
  description: string;
  geometryTypes: GeometryType[];
  geometryColumn: string;
  idColumn: string;
  writeable: boolean;
  /** Queryable properties (column names allowed in CQL2 filters) */
  queryables: string[];
  /** Property mapping: OGC property name -> DB column name */
  propertyMap: Record<string, string>;
  /** Primary temporal property for datetime filtering (DB column name) */
  temporalProperty?: string;
  /** End temporal property for interval-based temporal filtering (DB column name) */
  temporalEndProperty?: string;
  /** Whether this collection has vector tiles available */
  hasTiles?: boolean;
  /** Property type metadata for queryables endpoint */
  propertyTypes?: Record<string, {
    type: 'string' | 'number' | 'integer' | 'boolean';
    format?: 'date-time' | 'date';
    title?: string;
    enum?: string[];
  }>;
}

/**
 * Collection registry - maps OGC collection IDs to database tables
 */
export const COLLECTIONS: Record<string, CollectionConfig> = {
  'road-assets': {
    id: 'road-assets',
    table: 'road_assets',
    title: 'Road Assets',
    description: 'Road centerline assets managed by Nagoya city infrastructure department',
    geometryTypes: ['LineString', 'MultiLineString'],
    geometryColumn: 'geometry',
    idColumn: 'id',
    writeable: false,
    queryables: ['id', 'name', 'roadType', 'lanes', 'direction', 'status', 'ward', 'ownerDepartment', 'dataSource'],
    propertyMap: {
      id: 'id',
      name: 'name',
      roadType: 'road_type',
      lanes: 'lanes',
      direction: 'direction',
      status: 'status',
      ward: 'ward',
      ownerDepartment: 'owner_department',
      dataSource: 'data_source',
      validFrom: 'valid_from',
      validTo: 'valid_to',
      updatedAt: 'updated_at',
    },
    temporalProperty: 'valid_from',
    temporalEndProperty: 'valid_to',
    hasTiles: true,
    propertyTypes: {
      id: { type: 'string', title: 'Feature ID' },
      name: { type: 'string', title: 'Road Name' },
      roadType: { type: 'string', title: 'Road Type' },
      lanes: { type: 'integer', title: 'Number of Lanes' },
      direction: { type: 'string', title: 'Direction' },
      status: { type: 'string', title: 'Status', enum: ['active', 'retired', 'planned'] },
      ward: { type: 'string', title: 'Ward' },
      ownerDepartment: { type: 'string', title: 'Owner Department' },
      dataSource: { type: 'string', title: 'Data Source' },
      validFrom: { type: 'string', format: 'date-time', title: 'Valid From' },
      validTo: { type: 'string', format: 'date-time', title: 'Valid To' },
    },
  },
  'construction-events': {
    id: 'construction-events',
    table: 'construction_events',
    title: 'Construction Events',
    description: 'Road construction and repair events including work zones and restrictions',
    geometryTypes: ['Polygon', 'LineString', 'MultiPolygon'],
    geometryColumn: 'geometry',
    idColumn: 'id',
    writeable: true,
    queryables: ['id', 'name', 'status', 'restrictionType', 'department', 'ward', 'startDate', 'endDate'],
    propertyMap: {
      id: 'id',
      name: 'name',
      status: 'status',
      restrictionType: 'restriction_type',
      department: 'department',
      ward: 'ward',
      startDate: 'start_date',
      endDate: 'end_date',
      createdBy: 'created_by',
      updatedAt: 'updated_at',
    },
    temporalProperty: 'start_date',
    temporalEndProperty: 'end_date',
    hasTiles: true,
    propertyTypes: {
      id: { type: 'string', title: 'Feature ID' },
      name: { type: 'string', title: 'Event Name' },
      status: { type: 'string', title: 'Status', enum: ['planned', 'active', 'completed', 'cancelled'] },
      restrictionType: { type: 'string', title: 'Restriction Type', enum: ['full', 'partial', 'none'] },
      department: { type: 'string', title: 'Department' },
      ward: { type: 'string', title: 'Ward' },
      startDate: { type: 'string', format: 'date-time', title: 'Start Date' },
      endDate: { type: 'string', format: 'date-time', title: 'End Date' },
    },
  },
  'inspections': {
    id: 'inspections',
    table: 'inspection_records',
    title: 'Inspections',
    description: 'Field inspection records for road assets and construction events',
    geometryTypes: ['Point'],
    geometryColumn: 'geometry',
    idColumn: 'id',
    writeable: true,
    queryables: ['id', 'eventId', 'roadAssetId', 'inspectionDate', 'result'],
    propertyMap: {
      id: 'id',
      eventId: 'event_id',
      roadAssetId: 'road_asset_id',
      inspectionDate: 'inspection_date',
      result: 'result',
      notes: 'notes',
      createdAt: 'created_at',
    },
    temporalProperty: 'inspection_date',
    propertyTypes: {
      id: { type: 'string', title: 'Feature ID' },
      eventId: { type: 'string', title: 'Event ID' },
      roadAssetId: { type: 'string', title: 'Road Asset ID' },
      inspectionDate: { type: 'string', format: 'date-time', title: 'Inspection Date' },
      result: { type: 'string', title: 'Result', enum: ['passed', 'failed', 'pending', 'deferred'] },
    },
  },
};

/**
 * Get collection by ID
 */
export function getCollection(collectionId: string): CollectionConfig | undefined {
  return COLLECTIONS[collectionId];
}

/**
 * Get all collection IDs
 */
export function getCollectionIds(): string[] {
  return Object.keys(COLLECTIONS);
}

/**
 * Compute spatial and temporal extent for a collection from PostGIS
 */
export async function computeExtent(collectionId: string): Promise<Extent | undefined> {
  const config = COLLECTIONS[collectionId];
  if (!config) return undefined;

  try {
    const extent: Extent = {};

    // Spatial extent
    const spatialResult = await db.execute<{ bbox: number[] | null }>(sql`
      SELECT ARRAY[
        ST_XMin(ext), ST_YMin(ext), ST_XMax(ext), ST_YMax(ext)
      ] as bbox
      FROM (
        SELECT ST_Extent(${sql.raw(config.geometryColumn)}) as ext
        FROM ${sql.raw(config.table)}
      ) sub
    `);

    const bbox = spatialResult.rows[0]?.bbox;
    if (bbox && !bbox.some(v => v === null)) {
      extent.spatial = { bbox: [bbox], crs: CRS84 };
    }

    // Temporal extent
    if (config.temporalProperty) {
      const endCol = config.temporalEndProperty || config.temporalProperty;
      const temporalResult = await db.execute<{ min_time: string | null; max_time: string | null }>(sql`
        SELECT
          MIN(${sql.raw(config.temporalProperty)})::text as min_time,
          MAX(${sql.raw(endCol)})::text as max_time
        FROM ${sql.raw(config.table)}
      `);

      const minTimeRaw = temporalResult.rows[0]?.min_time;
      const maxTimeRaw = temporalResult.rows[0]?.max_time;

      // Convert PostgreSQL text format to ISO 8601 (ArcGIS requires this)
      const toIso = (s: string | null): string | null => {
        if (!s) return null;
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d.toISOString();
      };

      const minTime = toIso(minTimeRaw);
      const maxTime = toIso(maxTimeRaw);

      if (minTime || maxTime) {
        extent.temporal = {
          interval: [[minTime, maxTime]],
          trs: 'http://www.opengis.net/def/uom/ISO-8601/0/Gregorian',
        };
      }
    }

    return Object.keys(extent).length > 0 ? extent : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Build links for a collection
 */
export function buildCollectionLinks(baseUrl: string, collectionId: string): Link[] {
  const config = COLLECTIONS[collectionId];
  const links: Link[] = [
    {
      href: `${baseUrl}/ogc/collections/${collectionId}`,
      rel: 'self',
      type: 'application/json',
      title: 'This collection',
    },
    {
      href: `${baseUrl}/ogc/collections/${collectionId}/items`,
      rel: 'items',
      type: 'application/geo+json',
      title: 'Items as GeoJSON',
    },
    {
      href: `${baseUrl}/ogc/collections/${collectionId}/items?f=gpkg`,
      rel: 'items',
      type: 'application/geopackage+sqlite3',
      title: 'Items as GeoPackage',
    },
    {
      href: `${baseUrl}/ogc/collections/${collectionId}/queryables`,
      rel: 'http://www.opengis.net/def/rel/ogc/1.0/queryables',
      type: 'application/schema+json',
      title: 'Queryable properties',
    },
  ];

  // Add tiles link if collection supports tiles
  if (config?.hasTiles) {
    links.push({
      href: `${baseUrl}/ogc/collections/${collectionId}/tiles`,
      rel: 'http://www.opengis.net/def/rel/ogc/1.0/tilesets-vector',
      type: 'application/json',
      title: 'Vector tilesets',
    });
  }

  return links;
}

/**
 * Build links for feature collection response
 */
export function buildItemsLinks(
  baseUrl: string,
  collectionId: string,
  params: {
    limit?: number;
    offset?: number;
    total?: number;
    returnedCount?: number; // Number of features actually returned
    bbox?: string;
    filter?: string;
    crs?: string;
  }
): Link[] {
  const links: Link[] = [];
  const { limit = 100, offset = 0, total, returnedCount, bbox, filter, crs } = params;

  // Build query string for links
  const buildQuery = (newOffset: number) => {
    const parts: string[] = [`limit=${limit}`, `offset=${newOffset}`];
    if (bbox) parts.push(`bbox=${encodeURIComponent(bbox)}`);
    if (filter) parts.push(`filter=${encodeURIComponent(filter)}`);
    if (crs) parts.push(`crs=${encodeURIComponent(crs)}`);
    return parts.join('&');
  };

  // Self link
  links.push({
    href: `${baseUrl}/ogc/collections/${collectionId}/items?${buildQuery(offset)}`,
    rel: 'self',
    type: 'application/geo+json',
    title: 'This page',
  });

  // Collection link
  links.push({
    href: `${baseUrl}/ogc/collections/${collectionId}`,
    rel: 'collection',
    type: 'application/json',
    title: 'The collection',
  });

  // Next link - add if:
  // 1. We know the total and there's more data, OR
  // 2. We don't know the total but returned count equals limit (suggesting more data)
  const hasMoreData = total !== undefined
    ? offset + limit < total
    : returnedCount !== undefined && returnedCount >= limit;

  if (hasMoreData) {
    links.push({
      href: `${baseUrl}/ogc/collections/${collectionId}/items?${buildQuery(offset + limit)}`,
      rel: 'next',
      type: 'application/geo+json',
      title: 'Next page',
    });
  }

  // Prev link
  if (offset > 0) {
    links.push({
      href: `${baseUrl}/ogc/collections/${collectionId}/items?${buildQuery(Math.max(0, offset - limit))}`,
      rel: 'prev',
      type: 'application/geo+json',
      title: 'Previous page',
    });
  }

  return links;
}

import { db } from '../../db/index.js';
import { sql } from 'drizzle-orm';
import type { Extent, Link } from '../../routes/ogc/schemas/ogc-common.js';

// Supported CRS URIs
export const CRS84 = 'http://www.opengis.net/def/crs/OGC/1.3/CRS84';
export const EPSG_4326 = 'http://www.opengis.net/def/crs/EPSG/0/4326';
export const EPSG_3857 = 'http://www.opengis.net/def/crs/EPSG/0/3857';
export const EPSG_6675 = 'http://www.opengis.net/def/crs/EPSG/0/6675';

export const SUPPORTED_CRS = [CRS84, EPSG_4326, EPSG_3857, EPSG_6675];

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
    writeable: false, // Internal only - use /api/assets
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
 * Compute spatial extent for a collection from PostGIS
 */
export async function computeExtent(collectionId: string): Promise<Extent | undefined> {
  const config = COLLECTIONS[collectionId];
  if (!config) return undefined;

  try {
    const result = await db.execute<{ bbox: number[] | null }>(sql`
      SELECT ARRAY[
        ST_XMin(ext), ST_YMin(ext), ST_XMax(ext), ST_YMax(ext)
      ] as bbox
      FROM (
        SELECT ST_Extent(${sql.raw(config.geometryColumn)}) as ext
        FROM ${sql.raw(config.table)}
      ) sub
    `);

    const bbox = result.rows[0]?.bbox;
    if (!bbox || bbox.some(v => v === null)) {
      return undefined;
    }

    return {
      spatial: {
        bbox: [bbox],
        crs: CRS84,
      },
    };
  } catch {
    return undefined;
  }
}

/**
 * Build links for a collection
 */
export function buildCollectionLinks(baseUrl: string, collectionId: string): Link[] {
  return [
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
  ];
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

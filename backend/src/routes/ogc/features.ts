import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { db } from '../../db/index.js';
import { sql, SQL } from 'drizzle-orm';
import {
  FeatureCollectionSchema,
  FeatureSchema,
  ProblemDetailSchema,
  type Feature,
} from './schemas/ogc-common.js';
import {
  getCollection,
  buildItemsLinks,
  CRS84,
  SUPPORTED_CRS,
} from '../../services/ogc/collection-registry.js';
import {
  transformGeometrySelect,
  transformBboxFilter,
  parseBbox,
  formatContentCrsHeader,
  crsUriToEpsg,
  isValidCrs,
} from '../../services/ogc/crs-transformer.js';
import {
  CollectionNotFoundError,
  FeatureNotFoundError,
  InvalidBboxError,
  InvalidCrsError,
  InvalidFilterError,
  WriteNotAllowedError,
  IdMismatchError,
  OgcError,
  sendOgcError,
} from '../../services/ogc/ogc-error.js';
import { parseCql2ToSql } from '../../services/ogc/cql2-parser.js';
import { validateApiKey } from '../../services/ogc/api-key-auth.js';
import {
  negotiateFormat,
  sendGeoPackageResponse,
  type OutputFormat,
} from '../../services/ogc/format-negotiation.js';
import { toGeomSql } from '../../db/geometry.js';
import { nanoid } from 'nanoid';

// Default and max limits
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 10000;

export async function featuresRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // GET /ogc/collections/:collectionId/items - List features
  app.get('/collections/:collectionId/items', {
    schema: {
      description: 'Get features from a collection',
      tags: ['OGC API Features'],
      params: Type.Object({
        collectionId: Type.String(),
      }),
      querystring: Type.Object({
        // Pagination
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: MAX_LIMIT })),
        offset: Type.Optional(Type.Integer({ minimum: 0 })),
        // Spatial filter
        bbox: Type.Optional(Type.String()),
        'bbox-crs': Type.Optional(Type.String()),
        // CRS
        crs: Type.Optional(Type.String()),
        // CQL2 filter (will be implemented in Step 4)
        filter: Type.Optional(Type.String()),
        'filter-lang': Type.Optional(Type.String()),
        // Count
        count: Type.Optional(Type.Union([Type.Boolean(), Type.Literal('true'), Type.Literal('false')])),
        // Format
        f: Type.Optional(Type.String()),
      }),
      response: {
        200: FeatureCollectionSchema,
        400: ProblemDetailSchema,
        404: ProblemDetailSchema,
      },
    },
  }, async (request, reply) => {
    const { collectionId } = request.params;
    const {
      limit: limitParam,
      offset: offsetParam,
      bbox: bboxParam,
      'bbox-crs': bboxCrs,
      crs: outputCrs,
      filter,
      'filter-lang': filterLang,
      count: countParam,
      f: format,
    } = request.query;

    // Validate collection exists
    const config = getCollection(collectionId);
    if (!config) {
      sendOgcError(reply, new CollectionNotFoundError(collectionId));
      return;
    }

    // Validate CRS parameters
    if (outputCrs && !isValidCrs(outputCrs)) {
      sendOgcError(reply, new InvalidCrsError(outputCrs));
      return;
    }
    if (bboxCrs && !isValidCrs(bboxCrs)) {
      sendOgcError(reply, new InvalidCrsError(bboxCrs));
      return;
    }

    // Parse pagination
    const limit = Math.min(limitParam ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = offsetParam ?? 0;

    // Parse count flag
    const includeCount = countParam === true || countParam === 'true';

    // Build WHERE conditions
    const conditions: SQL[] = [];

    // Parse and validate bbox
    if (bboxParam) {
      const bbox = parseBbox(bboxParam);
      if (!bbox) {
        sendOgcError(reply, new InvalidBboxError(
          'Invalid bbox format. Expected: minX,minY,maxX,maxY'
        ));
        return;
      }
      conditions.push(transformBboxFilter(bbox, config.geometryColumn, bboxCrs));
    }

    // CQL2 filter parsing
    if (filter) {
      // Validate filter-lang if provided
      if (filterLang && filterLang !== 'cql2-text') {
        sendOgcError(reply, new InvalidFilterError(
          `Unsupported filter-lang: ${filterLang}. Only 'cql2-text' is supported.`
        ));
        return;
      }

      try {
        const filterSql = parseCql2ToSql(filter, config);
        conditions.push(filterSql);
      } catch (error) {
        if (error instanceof InvalidFilterError) {
          sendOgcError(reply, error);
          return;
        }
        sendOgcError(reply, new InvalidFilterError(
          `Failed to parse filter: ${error instanceof Error ? error.message : String(error)}`
        ));
        return;
      }
    }

    // Build WHERE clause
    const whereClause = conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;

    // Get total count if requested
    let totalCount: number | undefined;
    if (includeCount) {
      const countResult = await db.execute<{ count: number }>(sql`
        SELECT COUNT(*)::int as count
        FROM ${sql.raw(config.table)}
        ${whereClause}
      `);
      totalCount = countResult.rows[0]?.count ?? 0;
    }

    // Build property columns for SELECT
    const propertyColumnsList = Object.entries(config.propertyMap)
      .filter(([key]) => key !== 'id') // id is handled separately
      .map(([key, column]) => sql`${sql.raw(column)} as "${sql.raw(key)}"`);
    const propertyColumns = propertyColumnsList.length > 0
      ? sql.join(propertyColumnsList, sql`, `)
      : sql`NULL as _empty`;

    // Query features
    const geometrySelect = transformGeometrySelect(config.geometryColumn, outputCrs);

    const featuresResult = await db.execute(sql`
      SELECT
        ${sql.raw(config.idColumn)} as id,
        ${geometrySelect} as geometry,
        ${propertyColumns}
      FROM ${sql.raw(config.table)}
      ${whereClause}
      ORDER BY ${sql.raw(config.idColumn)}
      LIMIT ${limit} OFFSET ${offset}
    `);

    // Transform to GeoJSON Features
    const features: Feature[] = featuresResult.rows.map((row: Record<string, unknown>) => {
      const { id, geometry, ...properties } = row;

      // Format date fields to ISO strings
      const formattedProperties: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(properties)) {
        if (value instanceof Date) {
          formattedProperties[key] = value.toISOString();
        } else {
          formattedProperties[key] = value;
        }
      }

      return {
        type: 'Feature' as const,
        id: id as string,
        geometry: geometry as Feature['geometry'],
        properties: formattedProperties,
      };
    });

    // Negotiate output format
    const outputFormat = negotiateFormat(request);

    // Handle GeoPackage export
    if (outputFormat === 'gpkg') {
      try {
        // Get EPSG code for output CRS
        const crsEpsg = outputCrs ? crsUriToEpsg(outputCrs) : 4326;
        await sendGeoPackageResponse(reply, features, collectionId, crsEpsg);
        return;
      } catch (error) {
        sendOgcError(reply, new OgcError(
          500,
          'Export Failed',
          `Failed to export GeoPackage: ${error instanceof Error ? error.message : String(error)}`
        ));
        return;
      }
    }

    // Build GeoJSON response
    const baseUrl = `${request.protocol}://${request.hostname}`;
    const links = buildItemsLinks(baseUrl, collectionId, {
      limit,
      offset,
      total: totalCount,
      returnedCount: features.length,
      bbox: bboxParam,
      filter,
      crs: outputCrs,
    });

    const response = {
      type: 'FeatureCollection' as const,
      features,
      links,
      numberReturned: features.length,
      timeStamp: new Date().toISOString(),
      ...(includeCount && totalCount !== undefined && { numberMatched: totalCount }),
    };

    // Set Content-Crs header
    const responseCrs = outputCrs || CRS84;
    reply.header('Content-Crs', formatContentCrsHeader(responseCrs));

    return response;
  });

  // GET /ogc/collections/:collectionId/items/:featureId - Get single feature
  app.get('/collections/:collectionId/items/:featureId', {
    schema: {
      description: 'Get a single feature by ID',
      tags: ['OGC API Features'],
      params: Type.Object({
        collectionId: Type.String(),
        featureId: Type.String(),
      }),
      querystring: Type.Object({
        crs: Type.Optional(Type.String()),
        f: Type.Optional(Type.String()),
      }),
      response: {
        200: FeatureSchema,
        404: ProblemDetailSchema,
      },
    },
  }, async (request, reply) => {
    const { collectionId, featureId } = request.params;
    const { crs: outputCrs } = request.query;

    // Validate collection exists
    const config = getCollection(collectionId);
    if (!config) {
      sendOgcError(reply, new CollectionNotFoundError(collectionId));
      return;
    }

    // Validate CRS
    if (outputCrs && !isValidCrs(outputCrs)) {
      sendOgcError(reply, new InvalidCrsError(outputCrs));
      return;
    }

    // Build property columns for SELECT
    const propertyColumnsList = Object.entries(config.propertyMap)
      .filter(([key]) => key !== 'id')
      .map(([key, column]) => sql`${sql.raw(column)} as "${sql.raw(key)}"`);
    const propertyColumns = propertyColumnsList.length > 0
      ? sql.join(propertyColumnsList, sql`, `)
      : sql`NULL as _empty`;

    // Query feature
    const geometrySelect = transformGeometrySelect(config.geometryColumn, outputCrs);

    const result = await db.execute(sql`
      SELECT
        ${sql.raw(config.idColumn)} as id,
        ${geometrySelect} as geometry,
        ${propertyColumns}
      FROM ${sql.raw(config.table)}
      WHERE ${sql.raw(config.idColumn)} = ${featureId}
    `);

    if (result.rows.length === 0) {
      sendOgcError(reply, new FeatureNotFoundError(collectionId, featureId));
      return;
    }

    const row = result.rows[0] as Record<string, unknown>;
    const { id, geometry, ...properties } = row;

    // Format date fields
    const formattedProperties: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(properties)) {
      if (value instanceof Date) {
        formattedProperties[key] = value.toISOString();
      } else {
        formattedProperties[key] = value;
      }
    }

    const baseUrl = `${request.protocol}://${request.hostname}`;

    const feature: Feature = {
      type: 'Feature' as const,
      id: id as string,
      geometry: geometry as Feature['geometry'],
      properties: formattedProperties,
      links: [
        {
          href: `${baseUrl}/ogc/collections/${collectionId}/items/${featureId}`,
          rel: 'self',
          type: 'application/geo+json',
          title: 'This feature',
        },
        {
          href: `${baseUrl}/ogc/collections/${collectionId}`,
          rel: 'collection',
          type: 'application/json',
          title: 'The collection',
        },
      ],
    };

    // Set Content-Crs header
    const responseCrs = outputCrs || CRS84;
    reply.header('Content-Crs', formatContentCrsHeader(responseCrs));

    return feature;
  });

  // ============================================
  // Write Endpoints (OGC Features Part 4)
  // ============================================

  // Feature input schema for POST/PUT/PATCH
  const FeatureInputSchema = Type.Object({
    type: Type.Literal('Feature'),
    id: Type.Optional(Type.Union([Type.String(), Type.Number()])),
    properties: Type.Record(Type.String(), Type.Unknown()),
    geometry: Type.Union([
      Type.Object({
        type: Type.String(),
        coordinates: Type.Any(),
      }),
      Type.Null(),
    ]),
  });

  // POST /ogc/collections/:collectionId/items - Create feature
  app.post('/collections/:collectionId/items', {
    schema: {
      description: 'Create a new feature (OGC Features Part 4)',
      tags: ['OGC API Features'],
      params: Type.Object({
        collectionId: Type.String(),
      }),
      body: FeatureInputSchema,
      response: {
        201: FeatureSchema,
        400: ProblemDetailSchema,
        401: ProblemDetailSchema,
        404: ProblemDetailSchema,
        501: ProblemDetailSchema,
      },
    },
  }, async (request, reply) => {
    const { collectionId } = request.params;
    const feature = request.body;

    // Validate collection exists
    const config = getCollection(collectionId);
    if (!config) {
      sendOgcError(reply, new CollectionNotFoundError(collectionId));
      return;
    }

    // Check if collection is writeable
    if (!config.writeable) {
      sendOgcError(reply, new WriteNotAllowedError(collectionId));
      return;
    }

    // Validate API key
    try {
      validateApiKey(request);
    } catch (error) {
      sendOgcError(reply, error as OgcError);
      return;
    }

    // Generate ID based on collection
    const idPrefix = collectionId === 'construction-events' ? 'CE' :
                     collectionId === 'inspections' ? 'INS' : 'F';
    const newId = `${idPrefix}-${nanoid(8)}`;

    // Build INSERT statement
    const now = new Date();
    const properties = feature.properties;

    try {
      if (collectionId === 'construction-events') {
        // Insert into construction_events
        await db.execute(sql`
          INSERT INTO construction_events (
            id, name, status, start_date, end_date, restriction_type,
            geometry, department, ward, updated_at
          ) VALUES (
            ${newId},
            ${properties.name as string || 'Unnamed Event'},
            ${properties.status as string || 'planned'},
            ${properties.startDate ? new Date(properties.startDate as string) : now},
            ${properties.endDate ? new Date(properties.endDate as string) : now},
            ${properties.restrictionType as string || 'partial'},
            ${feature.geometry ? toGeomSql(feature.geometry) : sql`NULL`},
            ${properties.department as string || 'Unknown'},
            ${properties.ward as string || null},
            ${now}
          )
        `);
      } else if (collectionId === 'inspections') {
        // Insert into inspection_records
        await db.execute(sql`
          INSERT INTO inspection_records (
            id, event_id, road_asset_id, inspection_date, result, notes,
            geometry, created_at
          ) VALUES (
            ${newId},
            ${properties.eventId as string || null},
            ${properties.roadAssetId as string || null},
            ${properties.inspectionDate ? new Date(properties.inspectionDate as string) : now},
            ${properties.result as string || 'pending'},
            ${properties.notes as string || null},
            ${feature.geometry ? toGeomSql(feature.geometry) : sql`NULL`},
            ${now}
          )
        `);
      }
    } catch (error) {
      sendOgcError(reply, new OgcError(
        400,
        'Insert Failed',
        `Failed to create feature: ${error instanceof Error ? error.message : String(error)}`
      ));
      return;
    }

    // Return created feature
    const baseUrl = `${request.protocol}://${request.hostname}`;

    const createdFeature: Feature = {
      type: 'Feature' as const,
      id: newId,
      geometry: feature.geometry as Feature['geometry'],
      properties: {
        ...properties,
        id: newId,
      },
      links: [
        {
          href: `${baseUrl}/ogc/collections/${collectionId}/items/${newId}`,
          rel: 'self',
          type: 'application/geo+json',
          title: 'This feature',
        },
        {
          href: `${baseUrl}/ogc/collections/${collectionId}`,
          rel: 'collection',
          type: 'application/json',
          title: 'The collection',
        },
      ],
    };

    // Set Location header per OGC Part 4 spec
    reply.header('Location', `${baseUrl}/ogc/collections/${collectionId}/items/${newId}`);
    reply.status(201);

    return createdFeature;
  });

  // PUT /ogc/collections/:collectionId/items/:featureId - Replace feature
  app.put('/collections/:collectionId/items/:featureId', {
    schema: {
      description: 'Replace an existing feature (OGC Features Part 4)',
      tags: ['OGC API Features'],
      params: Type.Object({
        collectionId: Type.String(),
        featureId: Type.String(),
      }),
      body: FeatureInputSchema,
      response: {
        200: FeatureSchema,
        400: ProblemDetailSchema,
        401: ProblemDetailSchema,
        404: ProblemDetailSchema,
        501: ProblemDetailSchema,
      },
    },
  }, async (request, reply) => {
    const { collectionId, featureId } = request.params;
    const feature = request.body;

    // Validate collection exists
    const config = getCollection(collectionId);
    if (!config) {
      sendOgcError(reply, new CollectionNotFoundError(collectionId));
      return;
    }

    // Check if collection is writeable
    if (!config.writeable) {
      sendOgcError(reply, new WriteNotAllowedError(collectionId));
      return;
    }

    // Validate API key
    try {
      validateApiKey(request);
    } catch (error) {
      sendOgcError(reply, error as OgcError);
      return;
    }

    // ID consistency check (Part 4 requirement)
    if (feature.id !== undefined && String(feature.id) !== featureId) {
      sendOgcError(reply, new IdMismatchError(featureId, String(feature.id)));
      return;
    }

    // Check if feature exists
    const existsResult = await db.execute(sql`
      SELECT 1 FROM ${sql.raw(config.table)}
      WHERE ${sql.raw(config.idColumn)} = ${featureId}
    `);

    if (existsResult.rows.length === 0) {
      sendOgcError(reply, new FeatureNotFoundError(collectionId, featureId));
      return;
    }

    // Update feature
    const now = new Date();
    const properties = feature.properties;

    try {
      if (collectionId === 'construction-events') {
        await db.execute(sql`
          UPDATE construction_events SET
            name = ${properties.name as string || 'Unnamed Event'},
            status = ${properties.status as string || 'planned'},
            start_date = ${properties.startDate ? new Date(properties.startDate as string) : now},
            end_date = ${properties.endDate ? new Date(properties.endDate as string) : now},
            restriction_type = ${properties.restrictionType as string || 'partial'},
            geometry = ${feature.geometry ? toGeomSql(feature.geometry) : sql`NULL`},
            department = ${properties.department as string || 'Unknown'},
            ward = ${properties.ward as string || null},
            updated_at = ${now}
          WHERE id = ${featureId}
        `);
      } else if (collectionId === 'inspections') {
        await db.execute(sql`
          UPDATE inspection_records SET
            event_id = ${properties.eventId as string || null},
            road_asset_id = ${properties.roadAssetId as string || null},
            inspection_date = ${properties.inspectionDate ? new Date(properties.inspectionDate as string) : now},
            result = ${properties.result as string || 'pending'},
            notes = ${properties.notes as string || null},
            geometry = ${feature.geometry ? toGeomSql(feature.geometry) : sql`NULL`}
          WHERE id = ${featureId}
        `);
      }
    } catch (error) {
      sendOgcError(reply, new OgcError(
        400,
        'Update Failed',
        `Failed to update feature: ${error instanceof Error ? error.message : String(error)}`
      ));
      return;
    }

    // Return updated feature
    const baseUrl = `${request.protocol}://${request.hostname}`;

    const updatedFeature: Feature = {
      type: 'Feature' as const,
      id: featureId,
      geometry: feature.geometry as Feature['geometry'],
      properties: {
        ...properties,
        id: featureId,
      },
      links: [
        {
          href: `${baseUrl}/ogc/collections/${collectionId}/items/${featureId}`,
          rel: 'self',
          type: 'application/geo+json',
          title: 'This feature',
        },
        {
          href: `${baseUrl}/ogc/collections/${collectionId}`,
          rel: 'collection',
          type: 'application/json',
          title: 'The collection',
        },
      ],
    };

    return updatedFeature;
  });

  // PATCH /ogc/collections/:collectionId/items/:featureId - Partial update
  app.patch('/collections/:collectionId/items/:featureId', {
    schema: {
      description: 'Partially update a feature (OGC Features Part 4)',
      tags: ['OGC API Features'],
      params: Type.Object({
        collectionId: Type.String(),
        featureId: Type.String(),
      }),
      body: Type.Object({
        type: Type.Optional(Type.Literal('Feature')),
        id: Type.Optional(Type.Union([Type.String(), Type.Number()])),
        properties: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
        geometry: Type.Optional(Type.Union([
          Type.Object({
            type: Type.String(),
            coordinates: Type.Any(),
          }),
          Type.Null(),
        ])),
      }),
      response: {
        200: FeatureSchema,
        400: ProblemDetailSchema,
        401: ProblemDetailSchema,
        404: ProblemDetailSchema,
        501: ProblemDetailSchema,
      },
    },
  }, async (request, reply) => {
    const { collectionId, featureId } = request.params;
    const patch = request.body;

    // Validate collection exists
    const config = getCollection(collectionId);
    if (!config) {
      sendOgcError(reply, new CollectionNotFoundError(collectionId));
      return;
    }

    // Check if collection is writeable
    if (!config.writeable) {
      sendOgcError(reply, new WriteNotAllowedError(collectionId));
      return;
    }

    // Validate API key
    try {
      validateApiKey(request);
    } catch (error) {
      sendOgcError(reply, error as OgcError);
      return;
    }

    // ID consistency check (Part 4 requirement)
    if (patch.id !== undefined && String(patch.id) !== featureId) {
      sendOgcError(reply, new IdMismatchError(featureId, String(patch.id)));
      return;
    }

    // Check if feature exists
    const existsResult = await db.execute(sql`
      SELECT 1 FROM ${sql.raw(config.table)}
      WHERE ${sql.raw(config.idColumn)} = ${featureId}
    `);

    if (existsResult.rows.length === 0) {
      sendOgcError(reply, new FeatureNotFoundError(collectionId, featureId));
      return;
    }

    // Build SET clauses for provided fields only
    const setClauses: SQL[] = [];
    const now = new Date();

    if (patch.geometry !== undefined) {
      setClauses.push(sql`geometry = ${patch.geometry ? toGeomSql(patch.geometry) : sql`NULL`}`);
    }

    if (patch.properties) {
      const props = patch.properties;

      if (collectionId === 'construction-events') {
        if (props.name !== undefined) setClauses.push(sql`name = ${props.name as string}`);
        if (props.status !== undefined) setClauses.push(sql`status = ${props.status as string}`);
        if (props.startDate !== undefined) setClauses.push(sql`start_date = ${new Date(props.startDate as string)}`);
        if (props.endDate !== undefined) setClauses.push(sql`end_date = ${new Date(props.endDate as string)}`);
        if (props.restrictionType !== undefined) setClauses.push(sql`restriction_type = ${props.restrictionType as string}`);
        if (props.department !== undefined) setClauses.push(sql`department = ${props.department as string}`);
        if (props.ward !== undefined) setClauses.push(sql`ward = ${props.ward as string}`);
        setClauses.push(sql`updated_at = ${now}`);
      } else if (collectionId === 'inspections') {
        if (props.eventId !== undefined) setClauses.push(sql`event_id = ${props.eventId as string}`);
        if (props.roadAssetId !== undefined) setClauses.push(sql`road_asset_id = ${props.roadAssetId as string}`);
        if (props.inspectionDate !== undefined) setClauses.push(sql`inspection_date = ${new Date(props.inspectionDate as string)}`);
        if (props.result !== undefined) setClauses.push(sql`result = ${props.result as string}`);
        if (props.notes !== undefined) setClauses.push(sql`notes = ${props.notes as string}`);
      }
    }

    if (setClauses.length > 0) {
      try {
        await db.execute(sql`
          UPDATE ${sql.raw(config.table)}
          SET ${sql.join(setClauses, sql`, `)}
          WHERE ${sql.raw(config.idColumn)} = ${featureId}
        `);
      } catch (error) {
        sendOgcError(reply, new OgcError(
          400,
          'Patch Failed',
          `Failed to patch feature: ${error instanceof Error ? error.message : String(error)}`
        ));
        return;
      }
    }

    // Fetch and return updated feature
    const propertyColumnsList = Object.entries(config.propertyMap)
      .filter(([key]) => key !== 'id')
      .map(([key, column]) => sql`${sql.raw(column)} as "${sql.raw(key)}"`);
    const propertyColumns = propertyColumnsList.length > 0
      ? sql.join(propertyColumnsList, sql`, `)
      : sql`NULL as _empty`;

    const geometrySelect = transformGeometrySelect(config.geometryColumn);

    const result = await db.execute(sql`
      SELECT
        ${sql.raw(config.idColumn)} as id,
        ${geometrySelect} as geometry,
        ${propertyColumns}
      FROM ${sql.raw(config.table)}
      WHERE ${sql.raw(config.idColumn)} = ${featureId}
    `);

    const row = result.rows[0] as Record<string, unknown>;
    const { id, geometry, ...properties } = row;

    const formattedProperties: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(properties)) {
      if (value instanceof Date) {
        formattedProperties[key] = value.toISOString();
      } else {
        formattedProperties[key] = value;
      }
    }

    const baseUrl = `${request.protocol}://${request.hostname}`;

    const updatedFeature: Feature = {
      type: 'Feature' as const,
      id: id as string,
      geometry: geometry as Feature['geometry'],
      properties: formattedProperties,
      links: [
        {
          href: `${baseUrl}/ogc/collections/${collectionId}/items/${featureId}`,
          rel: 'self',
          type: 'application/geo+json',
          title: 'This feature',
        },
        {
          href: `${baseUrl}/ogc/collections/${collectionId}`,
          rel: 'collection',
          type: 'application/json',
          title: 'The collection',
        },
      ],
    };

    return updatedFeature;
  });

  // DELETE /ogc/collections/:collectionId/items/:featureId - Delete feature
  app.delete('/collections/:collectionId/items/:featureId', {
    schema: {
      description: 'Delete a feature (OGC Features Part 4)',
      tags: ['OGC API Features'],
      params: Type.Object({
        collectionId: Type.String(),
        featureId: Type.String(),
      }),
      response: {
        204: Type.Null(),
        401: ProblemDetailSchema,
        404: ProblemDetailSchema,
        501: ProblemDetailSchema,
      },
    },
  }, async (request, reply) => {
    const { collectionId, featureId } = request.params;

    // Validate collection exists
    const config = getCollection(collectionId);
    if (!config) {
      sendOgcError(reply, new CollectionNotFoundError(collectionId));
      return;
    }

    // Check if collection is writeable
    if (!config.writeable) {
      sendOgcError(reply, new WriteNotAllowedError(collectionId));
      return;
    }

    // Validate API key
    try {
      validateApiKey(request);
    } catch (error) {
      sendOgcError(reply, error as OgcError);
      return;
    }

    // Check if feature exists
    const existsResult = await db.execute(sql`
      SELECT 1 FROM ${sql.raw(config.table)}
      WHERE ${sql.raw(config.idColumn)} = ${featureId}
    `);

    if (existsResult.rows.length === 0) {
      sendOgcError(reply, new FeatureNotFoundError(collectionId, featureId));
      return;
    }

    // Delete feature
    await db.execute(sql`
      DELETE FROM ${sql.raw(config.table)}
      WHERE ${sql.raw(config.idColumn)} = ${featureId}
    `);

    // Return 204 No Content per OGC Part 4 spec
    reply.status(204);
    return null;
  });
}

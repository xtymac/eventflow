import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { db } from '../db/index.js';
import { constructionEvents, roadAssets, eventRoadAssets } from '../db/schema.js';
import { sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { FeatureCollection, Feature, Geometry } from 'geojson';
import { toGeomSql, fromGeomSql } from '../db/geometry.js';
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const execAsync = promisify(exec);

// Configuration for temp files
const UPLOADS_DIR = process.env.UPLOADS_DIR || join(__dirname, '../../uploads');
const EXPORTS_DIR = join(UPLOADS_DIR, 'exports');

// Ensure exports directory exists
if (!existsSync(EXPORTS_DIR)) {
  mkdirSync(EXPORTS_DIR, { recursive: true });
}

export async function importExportRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // POST /import/geojson - Import GeoJSON data
  app.post('/geojson', {
    schema: {
      querystring: Type.Object({
        type: Type.Union([Type.Literal('events'), Type.Literal('assets')]),
      }),
      body: Type.Object({
        type: Type.Literal('FeatureCollection'),
        features: Type.Array(Type.Object({
          type: Type.Literal('Feature'),
          geometry: Type.Object({
            type: Type.String(),
            coordinates: Type.Any(),
          }),
          properties: Type.Any(),
        })),
      }),
      response: {
        200: Type.Object({
          imported: Type.Number(),
          failed: Type.Number(),
          errors: Type.Array(Type.String()),
        }),
      },
    },
  }, async (request) => {
    const { type } = request.query;
    const geojson = request.body as FeatureCollection;

    let imported = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const feature of geojson.features) {
      try {
        const props = feature.properties || {};

        if (type === 'events') {
          const id = props.id || `CE-${nanoid(8)}`;
          const now = new Date();
          const startDate = props.startDate ? new Date(props.startDate) : now;
          const endDate = props.endDate ? new Date(props.endDate) : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

          // Use raw SQL for geometry insert
          await db.execute(sql`
            INSERT INTO construction_events (
              id, name, status, start_date, end_date, restriction_type,
              geometry, post_end_decision, department, ward, created_by, updated_at
            ) VALUES (
              ${id}, ${props.name || 'Imported Event'}, ${props.status || 'planned'},
              ${startDate}, ${endDate}, ${props.restrictionType || 'partial'},
              ${toGeomSql(feature.geometry)}, ${props.postEndDecision || 'pending'},
              ${props.department || 'Unknown'}, ${props.ward ?? null}, 'import', ${now}
            )
            ON CONFLICT DO NOTHING
          `);

          // Insert road asset relations into join table
          const roadAssetIds = props.affectedRoadAssetIds || [];
          for (const assetId of roadAssetIds) {
            await db.insert(eventRoadAssets).values({
              eventId: id,
              roadAssetId: assetId,
              relationType: 'affected',
            }).onConflictDoNothing();
          }

          imported++;
        } else if (type === 'assets') {
          const id = props.id || `RA-${nanoid(8)}`;
          const now = new Date();
          const validFrom = props.validFrom ? new Date(props.validFrom) : now;
          const validTo = props.validTo ? new Date(props.validTo) : null;

          // Use raw SQL for geometry insert
          await db.execute(sql`
            INSERT INTO road_assets (
              id, name, geometry, road_type, lanes, direction,
              status, valid_from, valid_to, owner_department, ward, landmark,
              cross_section, managing_dept, intersection, pavement_state,
              data_source, source_version, source_date, last_verified_at,
              updated_at
            ) VALUES (
              ${id}, ${props.name || 'Imported Asset'}, ${toGeomSql(feature.geometry)},
              ${props.roadType || 'local'}, ${props.lanes || 2}, ${props.direction || 'both'},
              ${props.status || 'active'}, ${validFrom}, ${validTo},
              ${props.ownerDepartment ?? null}, ${props.ward ?? null}, ${props.landmark ?? null},
              ${props.crossSection ?? null}, ${props.managingDept ?? null},
              ${props.intersection ?? null}, ${props.pavementState ?? null},
              ${props.dataSource || 'manual'}, ${props.sourceVersion ?? null},
              ${props.sourceDate ? new Date(props.sourceDate) : null},
              ${props.lastVerifiedAt ? new Date(props.lastVerifiedAt) : null},
              ${now}
            )
            ON CONFLICT DO NOTHING
          `);

          imported++;
        }
      } catch (err) {
        failed++;
        errors.push(`Feature import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    return { imported, failed, errors };
  });

  // GET /export/geojson - Export as GeoJSON
  app.get('/geojson', {
    schema: {
      querystring: Type.Object({
        type: Type.Union([Type.Literal('events'), Type.Literal('assets')]),
        ward: Type.Optional(Type.String()),
        bbox: Type.Optional(Type.String()), // minLon,minLat,maxLon,maxLat (assets only)
      }),
    },
  }, async (request, reply) => {
    const { type, ward, bbox } = request.query;

    let features: Feature<Geometry>[];

    if (type === 'events') {
      // Select with explicit geometry conversion
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

      const events = await db.select(eventSelect).from(constructionEvents);

      // Fetch all relations for export
      const allRelations = await db.select().from(eventRoadAssets);
      const relationsByEvent = new Map<string, string[]>();
      for (const rel of allRelations) {
        const existing = relationsByEvent.get(rel.eventId) || [];
        existing.push(rel.roadAssetId);
        relationsByEvent.set(rel.eventId, existing);
      }

      features = events.map(event => ({
        type: 'Feature' as const,
        geometry: event.geometry as Geometry,
        properties: {
          id: event.id,
          name: event.name,
          status: event.status,
          startDate: event.startDate.toISOString(),
          endDate: event.endDate.toISOString(),
          restrictionType: event.restrictionType,
          postEndDecision: event.postEndDecision,
          affectedRoadAssetIds: relationsByEvent.get(event.id) || [],
          department: event.department,
          ward: event.ward,
          createdBy: event.createdBy,
          updatedAt: event.updatedAt.toISOString(),
        },
      }));
    } else {
      // Build WHERE conditions for optional filters
      const conditions: ReturnType<typeof sql>[] = [];

      if (ward) {
        conditions.push(sql`ward = ${ward}`);
      }

      if (bbox) {
        const [minLon, minLat, maxLon, maxLat] = bbox.split(',').map(Number);
        if (!isNaN(minLon) && !isNaN(minLat) && !isNaN(maxLon) && !isNaN(maxLat)) {
          conditions.push(sql`ST_Intersects(
            geometry,
            ST_MakeEnvelope(${minLon}, ${minLat}, ${maxLon}, ${maxLat}, 4326)
          )`);
        }
      }

      const whereClause = conditions.length > 0
        ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
        : sql``;

      // Use raw SQL to support optional filters and apply defaults
      const result = await db.execute(sql`
        SELECT
          id,
          name,
          ST_AsGeoJSON(geometry)::json as geometry,
          COALESCE(road_type, 'local') as "roadType",
          COALESCE(lanes, 2) as lanes,
          COALESCE(direction, 'two-way') as direction,
          COALESCE(status, 'active') as status,
          valid_from as "validFrom",
          valid_to as "validTo",
          replaced_by as "replacedBy",
          owner_department as "ownerDepartment",
          ward,
          landmark,
          cross_section as "crossSection",
          managing_dept as "managingDept",
          intersection,
          pavement_state as "pavementState",
          COALESCE(data_source, 'manual') as "dataSource",
          source_version as "sourceVersion",
          source_date as "sourceDate",
          last_verified_at as "lastVerifiedAt",
          osm_id as "osmId",
          osm_type as "osmType",
          updated_at as "updatedAt"
        FROM road_assets
        ${whereClause}
      `);

      const assets = result.rows as Array<{
        id: string;
        name: string | null;
        geometry: Geometry;
        roadType: string;
        lanes: number;
        direction: string;
        status: string;
        validFrom: Date;
        validTo: Date | null;
        replacedBy: string | null;
        ownerDepartment: string | null;
        ward: string | null;
        landmark: string | null;
        crossSection: string | null;
        managingDept: string | null;
        intersection: string | null;
        pavementState: string | null;
        dataSource: string;
        sourceVersion: string | null;
        sourceDate: Date | null;
        lastVerifiedAt: Date | null;
        osmId: number | null;
        osmType: string | null;
        updatedAt: Date;
      }>;

      features = assets.map(asset => ({
        type: 'Feature' as const,
        geometry: asset.geometry as Geometry,
        properties: {
          id: asset.id,
          name: asset.name,
          roadType: asset.roadType,
          lanes: asset.lanes,
          direction: asset.direction,
          status: asset.status,
          validFrom: asset.validFrom instanceof Date ? asset.validFrom.toISOString() : asset.validFrom,
          validTo: asset.validTo instanceof Date ? asset.validTo.toISOString() : asset.validTo,
          replacedBy: asset.replacedBy,
          ownerDepartment: asset.ownerDepartment,
          ward: asset.ward,
          landmark: asset.landmark,
          crossSection: asset.crossSection,
          managingDept: asset.managingDept,
          intersection: asset.intersection,
          pavementState: asset.pavementState,
          dataSource: asset.dataSource,
          sourceVersion: asset.sourceVersion,
          sourceDate: asset.sourceDate instanceof Date ? asset.sourceDate.toISOString() : asset.sourceDate,
          lastVerifiedAt: asset.lastVerifiedAt instanceof Date ? asset.lastVerifiedAt.toISOString() : asset.lastVerifiedAt,
          osmId: asset.osmId,
          osmType: asset.osmType,
          updatedAt: asset.updatedAt instanceof Date ? asset.updatedAt.toISOString() : asset.updatedAt,
        },
      }));
    }

    const geojson: FeatureCollection = {
      type: 'FeatureCollection',
      features,
    };

    reply.header('Content-Type', 'application/geo+json');
    reply.header('Content-Disposition', `attachment; filename="${type}.geojson"`);

    return geojson;
  });

  // GET /export/geopackage - Export road assets as GeoPackage
  app.get('/geopackage', {
    schema: {
      querystring: Type.Object({
        type: Type.Union([Type.Literal('assets')]),
        ward: Type.Optional(Type.String()),
        bbox: Type.Optional(Type.String()), // minLon,minLat,maxLon,maxLat
      }),
    },
  }, async (request, reply) => {
    const { type, ward, bbox } = request.query;

    // Only assets supported for GeoPackage export
    if (type !== 'assets') {
      return reply.status(400).send({ error: 'GeoPackage export only supports assets type' });
    }

    // Build WHERE conditions
    const conditions: ReturnType<typeof sql>[] = [];

    if (ward) {
      conditions.push(sql`ward = ${ward}`);
    }

    if (bbox) {
      const [minLon, minLat, maxLon, maxLat] = bbox.split(',').map(Number);
      if (!isNaN(minLon) && !isNaN(minLat) && !isNaN(maxLon) && !isNaN(maxLat)) {
        conditions.push(sql`ST_Intersects(
          geometry,
          ST_MakeEnvelope(${minLon}, ${minLat}, ${maxLon}, ${maxLat}, 4326)
        )`);
      }
    }

    const whereClause = conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;

    // Query all road assets (active + inactive) with required fields for ArcGIS export
    const result = await db.execute(sql`
      SELECT
        id,
        ST_AsGeoJSON(geometry)::json as geometry,
        COALESCE(status, 'active') as status,
        COALESCE(data_source, 'manual') as "dataSource",
        COALESCE(road_type, 'local') as "roadType",
        COALESCE(lanes, 2) as lanes,
        COALESCE(direction, 'two-way') as direction,
        osm_id as "osmId",
        osm_type as "osmType"
      FROM road_assets
      ${whereClause}
    `);

    // Validate geometry types and build features
    const features: Feature<Geometry>[] = [];
    let nonLineStringCount = 0;

    for (const row of result.rows as Array<{
      id: string;
      geometry: Geometry;
      status: string;
      dataSource: string;
      roadType: string;
      lanes: number;
      direction: string;
      osmId: number | null;
      osmType: string | null;
    }>) {
      // Check geometry type
      if (row.geometry && row.geometry.type !== 'LineString' && row.geometry.type !== 'MultiLineString') {
        nonLineStringCount++;
        console.warn(`Export warning: Feature ${row.id} has non-LineString geometry: ${row.geometry.type}`);
      }

      features.push({
        type: 'Feature',
        geometry: row.geometry,
        properties: {
          id: row.id,
          status: row.status,
          dataSource: row.dataSource,
          roadType: row.roadType,
          lanes: row.lanes,
          direction: row.direction,
          osmId: row.osmId,
          osmType: row.osmType,
        },
      });
    }

    if (nonLineStringCount > 0) {
      console.warn(`Export: ${nonLineStringCount} features have non-LineString geometry`);
    }

    const geojson: FeatureCollection = {
      type: 'FeatureCollection',
      features,
    };

    // Write temporary GeoJSON file
    const timestamp = Date.now();
    const geojsonPath = join(EXPORTS_DIR, `export-${timestamp}.geojson`);
    const gpkgPath = join(EXPORTS_DIR, `export-${timestamp}.gpkg`);

    try {
      writeFileSync(geojsonPath, JSON.stringify(geojson));

      // Convert to GeoPackage using ogr2ogr
      // -f GPKG: output format
      // -a_srs EPSG:4326: set CRS (required for ArcGIS)
      // -nln road_assets: set layer name
      // -dsco VERSION=1.2: use GeoPackage 1.2 for ArcGIS compatibility
      const cmd = `ogr2ogr -f GPKG -a_srs EPSG:4326 -nln road_assets -dsco VERSION=1.2 "${gpkgPath}" "${geojsonPath}"`;
      await execAsync(cmd);

      // Read the GPKG file
      const gpkgBuffer = readFileSync(gpkgPath);

      // Generate filename with date
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = ward
        ? `road-assets-${ward}-${dateStr}.gpkg`
        : `road-assets-${dateStr}.gpkg`;

      // Set response headers
      reply.header('Content-Type', 'application/geopackage+sqlite3');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);

      // Cleanup temp files
      unlinkSync(geojsonPath);
      unlinkSync(gpkgPath);

      return reply.send(gpkgBuffer);
    } catch (error) {
      // Cleanup on error
      if (existsSync(geojsonPath)) unlinkSync(geojsonPath);
      if (existsSync(gpkgPath)) unlinkSync(gpkgPath);

      console.error('GeoPackage export failed:', error);
      return reply.status(500).send({
        error: 'Failed to generate GeoPackage export',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}

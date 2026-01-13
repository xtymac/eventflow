import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { db } from '../db/index.js';
import { constructionEvents, roadAssets, eventRoadAssets } from '../db/schema.js';
import { sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { FeatureCollection, Feature, Geometry } from 'geojson';
import { toGeomSql, fromGeomSql } from '../db/geometry.js';

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
      }),
    },
  }, async (request, reply) => {
    const { type } = request.query;

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
      // Select with explicit geometry conversion
      const assetSelect = {
        id: roadAssets.id,
        name: roadAssets.name,
        geometry: fromGeomSql(roadAssets.geometryPolygon),
        roadType: roadAssets.roadType,
        lanes: roadAssets.lanes,
        direction: roadAssets.direction,
        status: roadAssets.status,
        validFrom: roadAssets.validFrom,
        validTo: roadAssets.validTo,
        replacedBy: roadAssets.replacedBy,
        ownerDepartment: roadAssets.ownerDepartment,
        ward: roadAssets.ward,
        landmark: roadAssets.landmark,
        crossSection: roadAssets.crossSection,
        managingDept: roadAssets.managingDept,
        intersection: roadAssets.intersection,
        pavementState: roadAssets.pavementState,
        dataSource: roadAssets.dataSource,
        sourceVersion: roadAssets.sourceVersion,
        sourceDate: roadAssets.sourceDate,
        lastVerifiedAt: roadAssets.lastVerifiedAt,
        updatedAt: roadAssets.updatedAt,
      };

      const assets = await db.select(assetSelect).from(roadAssets);

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
          validFrom: asset.validFrom.toISOString(),
          validTo: asset.validTo?.toISOString(),
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
          sourceDate: asset.sourceDate?.toISOString(),
          lastVerifiedAt: asset.lastVerifiedAt?.toISOString(),
          updatedAt: asset.updatedAt.toISOString(),
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
}

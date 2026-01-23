import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
  getCollection,
} from '../../services/ogc/collection-registry.js';
import { CollectionNotFoundError, sendOgcError } from '../../services/ogc/ogc-error.js';

export async function queryablesRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // GET /ogc/collections/:collectionId/queryables - Queryable properties (OGC Features Part 3)
  app.get('/collections/:collectionId/queryables', {
    schema: {
      description: 'Get queryable properties for a collection (OGC API Features Part 3)',
      tags: ['OGC API Features'],
      params: Type.Object({
        collectionId: Type.String(),
      }),
      querystring: Type.Object({
        f: Type.Optional(Type.String()),
      }),
    },
  }, async (request, reply) => {
    const { collectionId } = request.params;

    const config = getCollection(collectionId);
    if (!config) {
      sendOgcError(reply, new CollectionNotFoundError(collectionId));
      return;
    }

    // Build JSON Schema properties from collection config
    const properties: Record<string, object> = {};

    for (const propName of config.queryables) {
      const typeInfo = config.propertyTypes?.[propName];
      if (typeInfo) {
        const prop: Record<string, unknown> = {
          title: typeInfo.title || propName,
          type: typeInfo.type,
        };
        if (typeInfo.format) prop.format = typeInfo.format;
        if (typeInfo.enum) prop.enum = typeInfo.enum;
        properties[propName] = prop;
      } else {
        properties[propName] = { title: propName, type: 'string' };
      }
    }

    // Always include geometry as a spatial queryable (ArcGIS uses this)
    properties['geometry'] = {
      '$ref': 'https://geojson.org/schema/Geometry.json',
    };

    const baseUrl = `${request.protocol}://${request.hostname}`;

    reply.header('Content-Type', 'application/schema+json');

    return {
      '$schema': 'https://json-schema.org/draft/2020-12/schema',
      '$id': `${baseUrl}/ogc/collections/${collectionId}/queryables`,
      type: 'object',
      title: `${config.title} - Queryable Properties`,
      description: `Queryable properties for ${config.description}`,
      properties,
    };
  });
}

import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { CollectionsSchema, CollectionSchema } from './schemas/ogc-common.js';
import {
  COLLECTIONS,
  getCollection,
  getCollectionIds,
  computeExtent,
  buildCollectionLinks,
  SUPPORTED_CRS,
  CRS84,
} from '../../services/ogc/collection-registry.js';
import { CollectionNotFoundError, sendOgcError } from '../../services/ogc/ogc-error.js';

export async function collectionsRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // GET /ogc/collections - List all collections
  app.get('/collections', {
    schema: {
      description: 'List all feature collections',
      tags: ['OGC API'],
      querystring: Type.Object({
        f: Type.Optional(Type.String()),
      }),
      response: {
        200: CollectionsSchema,
      },
    },
  }, async (request) => {
    const baseUrl = `${request.protocol}://${request.hostname}`;
    const collectionIds = getCollectionIds();

    const collections = await Promise.all(
      collectionIds.map(async (id) => {
        const config = COLLECTIONS[id];
        const extent = await computeExtent(id);

        return {
          id: config.id,
          title: config.title,
          description: config.description,
          extent,
          itemType: 'feature' as const,
          crs: SUPPORTED_CRS,
          storageCrs: CRS84,
          links: buildCollectionLinks(baseUrl, id),
        };
      })
    );

    return {
      collections,
      links: [
        {
          href: `${baseUrl}/ogc/collections`,
          rel: 'self',
          type: 'application/json',
          title: 'This document',
        },
      ],
    };
  });

  // GET /ogc/collections/:collectionId - Single collection metadata
  app.get('/collections/:collectionId', {
    schema: {
      description: 'Get metadata for a specific collection',
      tags: ['OGC API'],
      params: Type.Object({
        collectionId: Type.String(),
      }),
      querystring: Type.Object({
        f: Type.Optional(Type.String()),
      }),
      response: {
        200: CollectionSchema,
        404: Type.Object({
          type: Type.Optional(Type.String()),
          title: Type.String(),
          status: Type.Integer(),
          detail: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const { collectionId } = request.params;
    const baseUrl = `${request.protocol}://${request.hostname}`;

    const config = getCollection(collectionId);
    if (!config) {
      sendOgcError(reply, new CollectionNotFoundError(collectionId));
      return;
    }

    const extent = await computeExtent(collectionId);

    return {
      id: config.id,
      title: config.title,
      description: config.description,
      extent,
      itemType: 'feature' as const,
      crs: SUPPORTED_CRS,
      storageCrs: CRS84,
      links: buildCollectionLinks(baseUrl, collectionId),
    };
  });
}

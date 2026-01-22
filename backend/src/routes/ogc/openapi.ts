import { FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { getCollectionIds, getCollection, SUPPORTED_CRS } from '../../services/ogc/collection-registry.js';
import { CONFORMANCE_CLASSES } from './conformance.js';

/**
 * Generate OpenAPI 3.0 specification for OGC API Features
 */
function generateOpenApiSpec(baseUrl: string) {
  const collections = getCollectionIds().map(id => getCollection(id)!);

  return {
    openapi: '3.0.3',
    info: {
      title: 'Nagoya Infrastructure DX - OGC API',
      description: 'OGC API Features and Tiles for Nagoya road infrastructure assets, construction events, and inspections',
      version: '1.0.0',
      contact: {
        name: 'EventFlow API Support',
      },
    },
    servers: [
      {
        url: `${baseUrl}/ogc`,
        description: 'OGC API server',
      },
    ],
    tags: [
      { name: 'Capabilities', description: 'API metadata and capabilities' },
      { name: 'Collections', description: 'Feature collections' },
      { name: 'Features', description: 'Feature items' },
    ],
    paths: {
      '/': {
        get: {
          tags: ['Capabilities'],
          summary: 'Landing page',
          operationId: 'getLandingPage',
          responses: {
            '200': {
              description: 'Landing page',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/LandingPage' },
                },
              },
            },
          },
        },
      },
      '/conformance': {
        get: {
          tags: ['Capabilities'],
          summary: 'Conformance declaration',
          operationId: 'getConformance',
          responses: {
            '200': {
              description: 'Conformance classes',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Conformance' },
                },
              },
            },
          },
        },
      },
      '/collections': {
        get: {
          tags: ['Collections'],
          summary: 'List collections',
          operationId: 'getCollections',
          responses: {
            '200': {
              description: 'List of collections',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Collections' },
                },
              },
            },
          },
        },
      },
      '/collections/{collectionId}': {
        get: {
          tags: ['Collections'],
          summary: 'Get collection metadata',
          operationId: 'getCollection',
          parameters: [
            {
              name: 'collectionId',
              in: 'path',
              required: true,
              schema: { type: 'string', enum: collections.map(c => c.id) },
            },
          ],
          responses: {
            '200': {
              description: 'Collection metadata',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Collection' },
                },
              },
            },
            '404': {
              description: 'Collection not found',
            },
          },
        },
      },
      '/collections/{collectionId}/items': {
        get: {
          tags: ['Features'],
          summary: 'Get features',
          operationId: 'getFeatures',
          parameters: [
            {
              name: 'collectionId',
              in: 'path',
              required: true,
              schema: { type: 'string', enum: collections.map(c => c.id) },
            },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', minimum: 1, maximum: 10000, default: 100 },
            },
            {
              name: 'offset',
              in: 'query',
              schema: { type: 'integer', minimum: 0, default: 0 },
            },
            {
              name: 'bbox',
              in: 'query',
              schema: { type: 'string' },
              description: 'Bounding box: minX,minY,maxX,maxY',
            },
            {
              name: 'bbox-crs',
              in: 'query',
              schema: { type: 'string', enum: SUPPORTED_CRS },
            },
            {
              name: 'crs',
              in: 'query',
              schema: { type: 'string', enum: SUPPORTED_CRS },
              description: 'Output CRS',
            },
            {
              name: 'filter',
              in: 'query',
              schema: { type: 'string' },
              description: 'CQL2 filter expression',
            },
            {
              name: 'filter-lang',
              in: 'query',
              schema: { type: 'string', enum: ['cql2-text'] },
            },
          ],
          responses: {
            '200': {
              description: 'Feature collection',
              content: {
                'application/geo+json': {
                  schema: { $ref: '#/components/schemas/FeatureCollection' },
                },
              },
            },
            '400': {
              description: 'Bad request',
            },
            '404': {
              description: 'Collection not found',
            },
          },
        },
      },
      '/collections/{collectionId}/items/{featureId}': {
        get: {
          tags: ['Features'],
          summary: 'Get feature by ID',
          operationId: 'getFeature',
          parameters: [
            {
              name: 'collectionId',
              in: 'path',
              required: true,
              schema: { type: 'string', enum: collections.map(c => c.id) },
            },
            {
              name: 'featureId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
            {
              name: 'crs',
              in: 'query',
              schema: { type: 'string', enum: SUPPORTED_CRS },
            },
          ],
          responses: {
            '200': {
              description: 'Feature',
              content: {
                'application/geo+json': {
                  schema: { $ref: '#/components/schemas/Feature' },
                },
              },
            },
            '404': {
              description: 'Feature not found',
            },
          },
        },
      },
    },
    components: {
      schemas: {
        LandingPage: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            links: {
              type: 'array',
              items: { $ref: '#/components/schemas/Link' },
            },
          },
        },
        Conformance: {
          type: 'object',
          properties: {
            conformsTo: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
        Collections: {
          type: 'object',
          properties: {
            collections: {
              type: 'array',
              items: { $ref: '#/components/schemas/Collection' },
            },
            links: {
              type: 'array',
              items: { $ref: '#/components/schemas/Link' },
            },
          },
        },
        Collection: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            extent: { $ref: '#/components/schemas/Extent' },
            itemType: { type: 'string', default: 'feature' },
            crs: {
              type: 'array',
              items: { type: 'string' },
            },
            links: {
              type: 'array',
              items: { $ref: '#/components/schemas/Link' },
            },
          },
        },
        Extent: {
          type: 'object',
          properties: {
            spatial: {
              type: 'object',
              properties: {
                bbox: {
                  type: 'array',
                  items: {
                    type: 'array',
                    items: { type: 'number' },
                  },
                },
                crs: { type: 'string' },
              },
            },
          },
        },
        FeatureCollection: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['FeatureCollection'] },
            features: {
              type: 'array',
              items: { $ref: '#/components/schemas/Feature' },
            },
            links: {
              type: 'array',
              items: { $ref: '#/components/schemas/Link' },
            },
            numberReturned: { type: 'integer' },
            numberMatched: { type: 'integer' },
            timeStamp: { type: 'string', format: 'date-time' },
          },
        },
        Feature: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['Feature'] },
            id: { type: 'string' },
            geometry: { $ref: '#/components/schemas/Geometry' },
            properties: { type: 'object' },
            links: {
              type: 'array',
              items: { $ref: '#/components/schemas/Link' },
            },
          },
        },
        Geometry: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            coordinates: {},
          },
        },
        Link: {
          type: 'object',
          properties: {
            href: { type: 'string', format: 'uri' },
            rel: { type: 'string' },
            type: { type: 'string' },
            title: { type: 'string' },
          },
          required: ['href', 'rel'],
        },
      },
    },
  };
}

export async function openapiRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // GET /ogc/api - OpenAPI specification (JSON)
  app.get('/api', {
    schema: {
      description: 'OpenAPI 3.0 specification',
      tags: ['OGC API'],
    },
  }, async (request, reply) => {
    const baseUrl = `${request.protocol}://${request.hostname}`;
    const spec = generateOpenApiSpec(baseUrl);

    reply.header('Content-Type', 'application/vnd.oai.openapi+json;version=3.0');
    return spec;
  });

  // GET /ogc/api.html - OpenAPI documentation (redirect to Swagger UI or similar)
  app.get('/api.html', {
    schema: {
      description: 'API documentation (HTML)',
      tags: ['OGC API'],
    },
  }, async (request, reply) => {
    // Simple HTML page that loads Swagger UI
    const baseUrl = `${request.protocol}://${request.hostname}`;
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>OGC API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '${baseUrl}/ogc/api',
      dom_id: '#swagger-ui',
    });
  </script>
</body>
</html>`;
    reply.header('Content-Type', 'text/html');
    return html;
  });
}

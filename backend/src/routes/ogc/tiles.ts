import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { getCollection } from '../../services/ogc/collection-registry.js';
import { CollectionNotFoundError, OgcError, sendOgcError } from '../../services/ogc/ogc-error.js';

// Martin tile server URL (configurable via environment variable)
const MARTIN_URL = process.env.MARTIN_URL || 'http://localhost:3001';

/**
 * Martin source mapping for each collection
 * Maps OGC collection IDs to Martin source names
 */
const MARTIN_SOURCES: Record<string, string> = {
  'road-assets': 'road_assets',
  'construction-events': 'construction_events',
  // Add more mappings as needed
};

/**
 * Supported TileMatrixSets
 */
const TILE_MATRIX_SETS = {
  WebMercatorQuad: {
    id: 'WebMercatorQuad',
    title: 'Google Maps Compatible Quad Tree',
    crs: 'http://www.opengis.net/def/crs/EPSG/0/3857',
    wellKnownScaleSet: 'http://www.opengis.net/def/wkss/OGC/1.0/GoogleMapsCompatible',
    tileMatrices: generateWebMercatorQuadMatrices(),
  },
};

/**
 * Generate WebMercatorQuad tile matrices for levels 0-22
 */
function generateWebMercatorQuadMatrices() {
  const matrices = [];
  const initialScale = 559082264.0287178; // Scale denominator at level 0
  const initialWidth = 1;

  for (let z = 0; z <= 22; z++) {
    const matrixWidth = Math.pow(2, z);
    const matrixHeight = Math.pow(2, z);
    const scaleDenominator = initialScale / Math.pow(2, z);

    matrices.push({
      id: String(z),
      scaleDenominator,
      cellSize: scaleDenominator * 0.00028, // Standard pixel size in meters
      pointOfOrigin: [-20037508.3427892, 20037508.3427892],
      tileWidth: 256,
      tileHeight: 256,
      matrixWidth,
      matrixHeight,
    });
  }

  return matrices;
}

export async function tilesRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // GET /ogc/collections/:collectionId/tiles - List available tilesets
  app.get('/collections/:collectionId/tiles', {
    schema: {
      description: 'List available tilesets for a collection',
      tags: ['OGC API Tiles'],
      params: Type.Object({
        collectionId: Type.String(),
      }),
      response: {
        200: Type.Object({
          tilesets: Type.Array(Type.Object({
            title: Type.Optional(Type.String()),
            tileMatrixSetId: Type.String(),
            dataType: Type.String(),
            crs: Type.String(),
            links: Type.Array(Type.Object({
              href: Type.String(),
              rel: Type.String(),
              type: Type.Optional(Type.String()),
            })),
          })),
          links: Type.Array(Type.Object({
            href: Type.String(),
            rel: Type.String(),
            type: Type.Optional(Type.String()),
          })),
        }),
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

    // Validate collection exists
    const config = getCollection(collectionId);
    if (!config) {
      sendOgcError(reply, new CollectionNotFoundError(collectionId));
      return;
    }

    // Check if collection has tiles (mapped to Martin)
    const martinSource = MARTIN_SOURCES[collectionId];
    if (!martinSource) {
      sendOgcError(reply, new OgcError(
        404,
        'Tiles Not Available',
        `No tiles available for collection '${collectionId}'`
      ));
      return;
    }

    const baseUrl = `${request.protocol}://${request.hostname}`;

    return {
      tilesets: [
        {
          title: `${config.title} - WebMercatorQuad`,
          tileMatrixSetId: 'WebMercatorQuad',
          dataType: 'vector',
          crs: 'http://www.opengis.net/def/crs/EPSG/0/3857',
          links: [
            {
              href: `${baseUrl}/ogc/collections/${collectionId}/tiles/WebMercatorQuad`,
              rel: 'self',
              type: 'application/json',
            },
            {
              href: `${baseUrl}/ogc/collections/${collectionId}/tiles/WebMercatorQuad/{tileMatrix}/{tileRow}/{tileCol}`,
              rel: 'item',
              type: 'application/vnd.mapbox-vector-tile',
            },
          ],
        },
      ],
      links: [
        {
          href: `${baseUrl}/ogc/collections/${collectionId}/tiles`,
          rel: 'self',
          type: 'application/json',
        },
        {
          href: `${baseUrl}/ogc/collections/${collectionId}`,
          rel: 'collection',
          type: 'application/json',
        },
      ],
    };
  });

  // GET /ogc/collections/:collectionId/tiles/:tileMatrixSetId - TileMatrixSet metadata
  app.get('/collections/:collectionId/tiles/:tileMatrixSetId', {
    schema: {
      description: 'Get TileMatrixSet metadata',
      tags: ['OGC API Tiles'],
      params: Type.Object({
        collectionId: Type.String(),
        tileMatrixSetId: Type.String(),
      }),
      response: {
        200: Type.Object({
          id: Type.String(),
          title: Type.Optional(Type.String()),
          crs: Type.String(),
          wellKnownScaleSet: Type.Optional(Type.String()),
          tileMatrices: Type.Array(Type.Object({
            id: Type.String(),
            scaleDenominator: Type.Number(),
            cellSize: Type.Number(),
            pointOfOrigin: Type.Array(Type.Number()),
            tileWidth: Type.Integer(),
            tileHeight: Type.Integer(),
            matrixWidth: Type.Integer(),
            matrixHeight: Type.Integer(),
          })),
          links: Type.Array(Type.Object({
            href: Type.String(),
            rel: Type.String(),
            type: Type.Optional(Type.String()),
          })),
        }),
        404: Type.Object({
          type: Type.Optional(Type.String()),
          title: Type.String(),
          status: Type.Integer(),
          detail: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const { collectionId, tileMatrixSetId } = request.params;

    // Validate collection exists
    const config = getCollection(collectionId);
    if (!config) {
      sendOgcError(reply, new CollectionNotFoundError(collectionId));
      return;
    }

    // Validate TileMatrixSet exists
    const tileMatrixSet = TILE_MATRIX_SETS[tileMatrixSetId as keyof typeof TILE_MATRIX_SETS];
    if (!tileMatrixSet) {
      sendOgcError(reply, new OgcError(
        404,
        'TileMatrixSet Not Found',
        `TileMatrixSet '${tileMatrixSetId}' does not exist. Supported: ${Object.keys(TILE_MATRIX_SETS).join(', ')}`
      ));
      return;
    }

    const baseUrl = `${request.protocol}://${request.hostname}`;

    return {
      ...tileMatrixSet,
      links: [
        {
          href: `${baseUrl}/ogc/collections/${collectionId}/tiles/${tileMatrixSetId}`,
          rel: 'self',
          type: 'application/json',
        },
        {
          href: `${baseUrl}/ogc/collections/${collectionId}/tiles/${tileMatrixSetId}/{tileMatrix}/{tileRow}/{tileCol}`,
          rel: 'item',
          type: 'application/vnd.mapbox-vector-tile',
        },
        {
          href: `${baseUrl}/ogc/collections/${collectionId}`,
          rel: 'collection',
          type: 'application/json',
        },
      ],
    };
  });

  // GET /ogc/collections/:collectionId/tiles/:tileMatrixSetId/:tileMatrix/:tileRow/:tileCol - Get tile
  app.get('/collections/:collectionId/tiles/:tileMatrixSetId/:tileMatrix/:tileRow/:tileCol', {
    schema: {
      description: 'Get a single tile (MVT)',
      tags: ['OGC API Tiles'],
      params: Type.Object({
        collectionId: Type.String(),
        tileMatrixSetId: Type.String(),
        tileMatrix: Type.String(), // zoom level (z)
        tileRow: Type.String(),    // y
        tileCol: Type.String(),    // x
      }),
      response: {
        200: Type.Any(), // Binary MVT data
        204: Type.Null(), // Empty tile
        400: Type.Object({
          type: Type.Optional(Type.String()),
          title: Type.String(),
          status: Type.Integer(),
          detail: Type.String(),
        }),
        404: Type.Object({
          type: Type.Optional(Type.String()),
          title: Type.String(),
          status: Type.Integer(),
          detail: Type.String(),
        }),
        503: Type.Object({
          type: Type.Optional(Type.String()),
          title: Type.String(),
          status: Type.Integer(),
          detail: Type.String(),
        }),
      },
    },
  }, async (request, reply) => {
    const { collectionId, tileMatrixSetId, tileMatrix, tileRow, tileCol } = request.params;

    // Validate collection exists
    const config = getCollection(collectionId);
    if (!config) {
      sendOgcError(reply, new CollectionNotFoundError(collectionId));
      return;
    }

    // Validate TileMatrixSet
    if (!TILE_MATRIX_SETS[tileMatrixSetId as keyof typeof TILE_MATRIX_SETS]) {
      sendOgcError(reply, new OgcError(
        404,
        'TileMatrixSet Not Found',
        `TileMatrixSet '${tileMatrixSetId}' does not exist`
      ));
      return;
    }

    // Get Martin source for this collection
    const martinSource = MARTIN_SOURCES[collectionId];
    if (!martinSource) {
      sendOgcError(reply, new OgcError(
        404,
        'Tiles Not Available',
        `No tiles available for collection '${collectionId}'`
      ));
      return;
    }

    // Parse tile coordinates
    const z = parseInt(tileMatrix, 10);
    const y = parseInt(tileRow, 10);
    const x = parseInt(tileCol, 10);

    if (isNaN(z) || isNaN(y) || isNaN(x)) {
      sendOgcError(reply, new OgcError(
        400,
        'Invalid Tile Coordinates',
        'Tile coordinates must be integers'
      ));
      return;
    }

    // Map OGC path to Martin path
    // OGC: /tiles/{tileMatrixSetId}/{tileMatrix}/{tileRow}/{tileCol}
    // Martin: /{source}/{z}/{x}/{y}
    const martinUrl = `${MARTIN_URL}/${martinSource}/${z}/${x}/${y}`;

    try {
      // Proxy request to Martin
      const response = await fetch(martinUrl);

      if (!response.ok) {
        if (response.status === 404) {
          // Empty tile - return 204 No Content
          reply.status(204);
          return null;
        }
        throw new Error(`Martin returned ${response.status}`);
      }

      const tileData = await response.arrayBuffer();

      // Set response headers
      reply.header('Content-Type', 'application/vnd.mapbox-vector-tile');

      // Pass through compression header if present
      const contentEncoding = response.headers.get('content-encoding');
      if (contentEncoding) {
        reply.header('Content-Encoding', contentEncoding);
      }

      // Cache headers for tiles
      reply.header('Cache-Control', 'public, max-age=86400'); // 24 hours

      return reply.send(Buffer.from(tileData));
    } catch (error) {
      // If Martin is not available, return 503
      sendOgcError(reply, new OgcError(
        503,
        'Tile Service Unavailable',
        `Failed to fetch tile from tile server: ${error instanceof Error ? error.message : String(error)}`
      ));
      return;
    }
  });
}

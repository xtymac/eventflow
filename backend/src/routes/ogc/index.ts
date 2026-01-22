import { FastifyInstance } from 'fastify';
import { landingRoutes } from './landing.js';
import { conformanceRoutes } from './conformance.js';
import { collectionsRoutes } from './collections.js';
import { featuresRoutes } from './features.js';
import { tilesRoutes } from './tiles.js';
import { openapiRoutes } from './openapi.js';

/**
 * OGC API plugin - registers all OGC API routes under /ogc prefix
 *
 * Implements:
 * - OGC API - Features Part 1: Core
 * - OGC API - Features Part 2: CRS by Reference
 * - OGC API - Features Part 3: Filtering (CQL2)
 * - OGC API - Features Part 4: Create, Replace, Delete
 * - OGC API - Tiles Part 1: Core
 */
export async function ogcRoutes(fastify: FastifyInstance) {
  // Landing page: GET /ogc
  await fastify.register(landingRoutes);

  // Conformance: GET /ogc/conformance
  await fastify.register(conformanceRoutes);

  // Collections: GET /ogc/collections, GET /ogc/collections/:id
  await fastify.register(collectionsRoutes);

  // Features (items) endpoints: GET/POST/PUT/PATCH/DELETE
  await fastify.register(featuresRoutes);

  // Tiles endpoints: /collections/{id}/tiles
  await fastify.register(tilesRoutes);

  // OpenAPI specification: GET /ogc/api
  await fastify.register(openapiRoutes);
}

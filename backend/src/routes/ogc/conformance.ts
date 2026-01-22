import { FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { ConformanceSchema } from './schemas/ogc-common.js';

/**
 * OGC API Conformance classes supported by this implementation
 */
export const CONFORMANCE_CLASSES = [
  // OGC API - Features Part 1: Core
  'http://www.opengis.net/spec/ogcapi-features-1/1.0/conf/core',
  'http://www.opengis.net/spec/ogcapi-features-1/1.0/conf/oas30',
  'http://www.opengis.net/spec/ogcapi-features-1/1.0/conf/geojson',

  // OGC API - Features Part 2: CRS by Reference
  'http://www.opengis.net/spec/ogcapi-features-2/1.0/conf/crs',

  // OGC API - Features Part 3: Filtering
  'http://www.opengis.net/spec/ogcapi-features-3/1.0/conf/filter',
  'http://www.opengis.net/spec/ogcapi-features-3/1.0/conf/features-filter',

  // CQL2
  'http://www.opengis.net/spec/cql2/1.0/conf/cql2-text',
  'http://www.opengis.net/spec/cql2/1.0/conf/basic-cql2',
  'http://www.opengis.net/spec/cql2/1.0/conf/basic-spatial-operators',

  // OGC API - Features Part 4: Create, Replace, Update, Delete
  'http://www.opengis.net/spec/ogcapi-features-4/1.0/conf/create-replace-delete',

  // OGC API - Tiles Part 1: Core
  'http://www.opengis.net/spec/ogcapi-tiles-1/1.0/conf/core',
];

export async function conformanceRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // GET /ogc/conformance - Conformance classes
  app.get('/conformance', {
    schema: {
      description: 'OGC API Conformance Classes',
      tags: ['OGC API'],
      response: {
        200: ConformanceSchema,
      },
    },
  }, async () => {
    return {
      conformsTo: CONFORMANCE_CLASSES,
    };
  });
}

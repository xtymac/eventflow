import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { LandingPageSchema } from './schemas/ogc-common.js';

export async function landingRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // GET /ogc - OGC API Landing Page
  app.get('/', {
    schema: {
      description: 'OGC API Landing Page',
      tags: ['OGC API'],
      response: {
        200: LandingPageSchema,
      },
    },
  }, async (request) => {
    const baseUrl = `${request.protocol}://${request.hostname}`;

    return {
      title: 'Nagoya Infrastructure DX - OGC API',
      description: 'OGC API Features and Tiles for Nagoya road infrastructure assets, construction events, and inspections',
      links: [
        {
          href: `${baseUrl}/ogc`,
          rel: 'self',
          type: 'application/json',
          title: 'This document',
        },
        {
          href: `${baseUrl}/ogc/conformance`,
          rel: 'conformance',
          type: 'application/json',
          title: 'Conformance classes',
        },
        {
          href: `${baseUrl}/ogc/collections`,
          rel: 'data',
          type: 'application/json',
          title: 'Feature collections',
        },
        {
          href: `${baseUrl}/ogc/api`,
          rel: 'service-desc',
          type: 'application/vnd.oai.openapi+json;version=3.0',
          title: 'OpenAPI definition',
        },
        {
          href: `${baseUrl}/ogc/api.html`,
          rel: 'service-doc',
          type: 'text/html',
          title: 'API documentation',
        },
      ],
    };
  });
}

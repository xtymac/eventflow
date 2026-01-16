import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import multipart from '@fastify/multipart';
import { eventsRoutes } from './routes/events.js';
import { assetsRoutes } from './routes/assets.js';
import { inspectionsRoutes } from './routes/inspections.js';
import { importExportRoutes } from './routes/import-export.js';
import { osmSyncRoutes } from './routes/osm-sync.js';
import { sseRoutes } from './routes/sse.js';
import { riversRoutes } from './routes/rivers.js';
import { greenspacesRoutes } from './routes/greenspaces.js';
import { streetlightsRoutes } from './routes/streetlights.js';
import { searchRoutes } from './routes/search.js';
import { initScheduler } from './services/scheduler.js';
import { db } from './db/index.js';
import { importVersionsRoutes } from './routes/import-versions.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function main() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    },
  });

  // Register plugins
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });
  await fastify.register(sensible);
  await fastify.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB
    },
  });

  // Health check endpoint
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // API version info
  fastify.get('/version', async () => {
    return {
      name: 'Nagoya Construction Lifecycle API',
      version: '0.1.0',
      ngsiLd: {
        supported: true,
        contextUrl: '/ngsi-ld/v1/context.jsonld',
      },
    };
  });

  // Register routes
  await fastify.register(eventsRoutes, { prefix: '/events' });
  await fastify.register(assetsRoutes, { prefix: '/assets' });
  await fastify.register(inspectionsRoutes, { prefix: '/inspections' });
  await fastify.register(importExportRoutes, { prefix: '/import' });
  await fastify.register(importExportRoutes, { prefix: '/export' });
  await fastify.register(importVersionsRoutes, { prefix: '/import/versions' });
  await fastify.register(osmSyncRoutes, { prefix: '/osm-sync' });
  await fastify.register(sseRoutes, { prefix: '/sse' });

  // New asset type routes
  await fastify.register(riversRoutes, { prefix: '/rivers' });
  await fastify.register(greenspacesRoutes, { prefix: '/greenspaces' });
  await fastify.register(streetlightsRoutes, { prefix: '/streetlights' });

  // Search routes (Google Maps + local data)
  await fastify.register(searchRoutes, { prefix: '/search' });

  // Initialize background job scheduler
  initScheduler();

  // Start server
  try {
    await fastify.listen({ port: PORT, host: HOST });
    fastify.log.info(`Server running at http://${HOST}:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();

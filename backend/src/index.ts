import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { eventsRoutes } from './routes/events.js';
import { assetsRoutes } from './routes/assets.js';
import { inspectionsRoutes } from './routes/inspections.js';
import { importExportRoutes } from './routes/import-export.js';
import { osmSyncRoutes } from './routes/osm-sync.js';
import { initScheduler } from './services/scheduler.js';
import { db } from './db/index.js';

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
  await fastify.register(osmSyncRoutes, { prefix: '/osm-sync' });

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

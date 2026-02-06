import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
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
import nagoyaSyncRoutes from './routes/nagoya-sync.js';
import { pmtilesExportRoutes } from './routes/pmtiles-export.js';
import { ogcRoutes } from './routes/ogc/index.js';
import { initScheduler } from './services/scheduler.js';
import { db } from './db/index.js';
import { importVersionsRoutes } from './routes/import-versions.js';
import { workordersRoutes } from './routes/workorders.js';
import { streetTreesRoutes } from './routes/street-trees.js';
import { parkFacilitiesRoutes } from './routes/park-facilities.js';
import { pavementSectionsRoutes } from './routes/pavement-sections.js';
import { pumpStationsRoutes } from './routes/pump-stations.js';
import { lifecyclePlansRoutes } from './routes/lifecycle-plans.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Get directory paths for static file serving
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TILES_DIR = join(__dirname, '../../frontend/public/tiles');
const UPLOADS_DIR = join(__dirname, '../uploads');

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
    // Trust proxy headers (X-Forwarded-Proto, X-Forwarded-Host) from Caddy
    trustProxy: true,
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

  // Static file serving for PMTiles (supports HTTP Range requests)
  await fastify.register(fastifyStatic, {
    root: TILES_DIR,
    prefix: '/tiles/',
    decorateReply: false,  // Don't conflict with other static servers
    acceptRanges: true,    // Enable Range requests for PMTiles
    cacheControl: true,
    maxAge: '1d',
    immutable: false,
  });

  // Static file serving for uploads (evidence files)
  await fastify.register(fastifyStatic, {
    root: UPLOADS_DIR,
    prefix: '/uploads/',
    decorateReply: false,
    cacheControl: true,
    maxAge: '1h',
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

  // Serve NGSI-LD @context document
  const contextJsonLd = readFileSync(
    join(__dirname, '../../shared/ngsi-ld/context.jsonld'),
    'utf-8'
  );
  fastify.get('/ngsi-ld/v1/context.jsonld', async (_request, reply) => {
    reply.header('Content-Type', 'application/ld+json');
    reply.header('Cache-Control', 'public, max-age=86400');
    return reply.send(contextJsonLd);
  });

  // Register routes
  await fastify.register(eventsRoutes, { prefix: '/events' });
  await fastify.register(assetsRoutes, { prefix: '/assets' });
  await fastify.register(workordersRoutes, { prefix: '/workorders' });
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

  // RFI asset type routes
  await fastify.register(streetTreesRoutes, { prefix: '/street-trees' });
  await fastify.register(parkFacilitiesRoutes, { prefix: '/park-facilities' });
  await fastify.register(pavementSectionsRoutes, { prefix: '/pavement-sections' });
  await fastify.register(pumpStationsRoutes, { prefix: '/pump-stations' });
  await fastify.register(lifecyclePlansRoutes, { prefix: '/lifecycle-plans' });

  // Search routes (Google Maps + local data)
  await fastify.register(searchRoutes, { prefix: '/search' });

  // Nagoya designated road sync routes
  await fastify.register(nagoyaSyncRoutes);

  // PMTiles export routes (streaming NDJSON for tippecanoe)
  await fastify.register(pmtilesExportRoutes);

  // OGC API routes (Features, Tiles)
  await fastify.register(ogcRoutes, { prefix: '/ogc' });

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

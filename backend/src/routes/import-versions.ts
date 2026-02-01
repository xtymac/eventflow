/**
 * Import Versions API Routes
 *
 * Provides endpoints for GeoPackage/GeoJSON import with versioning,
 * validation, preview, publish, and rollback capabilities.
 */

import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { importVersionService } from '../services/import-version.js';

// Phase 0: Road assets are frozen (read-only) by default
// Set ROAD_ASSETS_FROZEN=false to re-enable import publish
const ROAD_ASSETS_FROZEN = process.env.ROAD_ASSETS_FROZEN !== 'false';

// TypeBox schemas
const ImportVersionSchema = Type.Object({
  id: Type.String(),
  versionNumber: Type.Number(),
  status: Type.Union([
    Type.Literal('draft'),
    Type.Literal('published'),
    Type.Literal('archived'),
    Type.Literal('rolled_back'),
  ]),
  fileName: Type.String(),
  fileType: Type.Union([Type.Literal('geojson'), Type.Literal('geopackage')]),
  filePath: Type.String(),
  layerName: Type.Union([Type.String(), Type.Null()]),
  sourceCRS: Type.Union([Type.String(), Type.Null()]),
  importScope: Type.String(),
  regionalRefresh: Type.Boolean(),
  defaultDataSource: Type.String(),
  fileSizeMB: Type.Union([Type.String(), Type.Null()]),
  featureCount: Type.Number(),
  uploadedBy: Type.Union([Type.String(), Type.Null()]),
  uploadedAt: Type.String({ format: 'date-time' }),
  publishedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  publishedBy: Type.Union([Type.String(), Type.Null()]),
  archivedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  rolledBackAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  snapshotPath: Type.Union([Type.String(), Type.Null()]),
  diffPath: Type.Union([Type.String(), Type.Null()]),
  notes: Type.Union([Type.String(), Type.Null()]),
});

const ImportJobSchema = Type.Object({
  id: Type.String(),
  versionId: Type.String(),
  jobType: Type.Union([
    Type.Literal('validation'),
    Type.Literal('publish'),
    Type.Literal('rollback'),
  ]),
  status: Type.Union([
    Type.Literal('pending'),
    Type.Literal('running'),
    Type.Literal('completed'),
    Type.Literal('failed'),
  ]),
  progress: Type.Number(),
  startedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  completedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  errorMessage: Type.Union([Type.String(), Type.Null()]),
  resultSummary: Type.Union([Type.Any(), Type.Null()]),
});

const LayerInfoSchema = Type.Object({
  name: Type.String(),
  featureCount: Type.Number(),
  geometryType: Type.String(),
});

const ValidationErrorSchema = Type.Object({
  featureIndex: Type.Number(),
  featureId: Type.Optional(Type.String()),
  field: Type.String(),
  error: Type.String(),
  hint: Type.String(),
});

const ValidationWarningSchema = Type.Object({
  featureIndex: Type.Number(),
  featureId: Type.Optional(Type.String()),
  message: Type.String(),
});

const ValidationResultSchema = Type.Object({
  valid: Type.Boolean(),
  featureCount: Type.Number(),
  errors: Type.Array(ValidationErrorSchema),
  warnings: Type.Array(ValidationWarningSchema),
  geometryTypes: Type.Array(Type.String()),
  missingIdCount: Type.Number(),
  missingDataSourceCount: Type.Number(),
});

const DiffStatsSchema = Type.Object({
  scopeCurrentCount: Type.Number(),
  importCount: Type.Number(),
  addedCount: Type.Number(),
  updatedCount: Type.Number(),
  deactivatedCount: Type.Number(),
  geometryMatchCount: Type.Optional(Type.Number()),
});

const DiffResultSchema = Type.Object({
  scope: Type.String(),
  regionalRefresh: Type.Boolean(),
  comparisonMode: Type.Optional(Type.String()),
  added: Type.Array(Type.Any()),
  updated: Type.Array(Type.Any()),
  deactivated: Type.Array(Type.Any()),
  unchanged: Type.Number(),
  stats: DiffStatsSchema,
});

const PublishResultSchema = Type.Object({
  success: Type.Boolean(),
  added: Type.Number(),
  updated: Type.Number(),
  deactivated: Type.Number(),
  unchanged: Type.Number(),
  snapshotPath: Type.String(),
  publishedAt: Type.String({ format: 'date-time' }),
  scope: Type.String(),
});

const RollbackResultSchema = Type.Object({
  success: Type.Boolean(),
  restored: Type.Number(),
  snapshotPath: Type.String(),
  rolledBackAt: Type.String({ format: 'date-time' }),
});

const ConfigureRequestSchema = Type.Object({
  layerName: Type.Optional(Type.String()),
  sourceCRS: Type.Optional(Type.String()),
  // importScope is auto-calculated from file bounding box - no longer needed from client
  defaultDataSource: Type.Union([
    Type.Literal('osm_test'),
    Type.Literal('official_ledger'),
    Type.Literal('manual'),
  ]),
  regionalRefresh: Type.Optional(Type.Boolean()),
});

function formatVersion(version: Awaited<ReturnType<typeof importVersionService.getVersion>>) {
  if (!version) return null;
  return {
    ...version,
    uploadedAt: version.uploadedAt.toISOString(),
    publishedAt: version.publishedAt?.toISOString() || null,
    archivedAt: version.archivedAt?.toISOString() || null,
  };
}

function formatJob(job: Awaited<ReturnType<typeof importVersionService.getJob>>) {
  if (!job) return null;
  return {
    ...job,
    startedAt: job.startedAt?.toISOString() || null,
    completedAt: job.completedAt?.toISOString() || null,
  };
}

export async function importVersionsRoutes(fastify: FastifyInstance) {
  const app = fastify.withTypeProvider<TypeBoxTypeProvider>();

  // POST /upload - Upload a GeoPackage or GeoJSON file
  app.post('/upload', {
    schema: {
      response: {
        200: Type.Object({ data: ImportVersionSchema }),
        400: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    try {
      const file = await request.file();

      if (!file) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      const fileName = file.filename;
      const ext = fileName.toLowerCase().split('.').pop();

      if (!['gpkg', 'geojson', 'json'].includes(ext || '')) {
        return reply.status(400).send({
          error: 'Invalid file type. Supported: .gpkg, .geojson, .json',
        });
      }

      // Read file buffer
      const chunks: Buffer[] = [];
      for await (const chunk of file.file) {
        chunks.push(chunk);
      }
      const fileBuffer = Buffer.concat(chunks);

      const version = await importVersionService.saveUploadedFile(
        fileBuffer,
        fileName,
        undefined // uploadedBy - could get from auth header in future
      );

      return { data: formatVersion(version) };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Import] Upload failed:', error);
      return reply.status(500).send({ error: `Upload failed: ${message}` });
    }
  });

  // GET /:id/layers - List layers in a GeoPackage file
  app.get('/:id/layers', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      response: {
        200: Type.Object({ data: Type.Array(LayerInfoSchema) }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    const version = await importVersionService.getVersion(id);
    if (!version) {
      return reply.status(404).send({ error: `Version ${id} not found` });
    }

    const layers = await importVersionService.listGeoPackageLayers(id);
    return { data: layers };
  });

  // POST /:id/configure - Configure import (layer, CRS, scope, dataSource)
  app.post('/:id/configure', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      body: ConfigureRequestSchema,
      response: {
        200: Type.Object({ data: ImportVersionSchema }),
        400: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const config = request.body;

    try {
      const version = await importVersionService.getVersion(id);
      if (!version) {
        return reply.status(404).send({ error: `Version ${id} not found` });
      }

      const updated = await importVersionService.configureVersion(id, config);
      return { data: formatVersion(updated) };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Import] Configure failed:', error);
      return reply.status(500).send({ error: `Configure failed: ${message}` });
    }
  });

  // GET / - List all versions
  app.get('/', {
    schema: {
      querystring: Type.Object({
        status: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Number({ default: 20 })),
        offset: Type.Optional(Type.Number({ default: 0 })),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(ImportVersionSchema),
          total: Type.Number(),
        }),
      },
    },
  }, async (request) => {
    const { status, limit, offset } = request.query;

    const result = await importVersionService.listVersions({ status, limit, offset });

    return {
      data: result.versions.map(v => formatVersion(v)),
      total: result.total,
    };
  });

  // GET /:id - Get version details
  app.get('/:id', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      response: {
        200: Type.Object({ data: ImportVersionSchema }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    const version = await importVersionService.getVersion(id);
    if (!version) {
      return reply.status(404).send({ error: `Version ${id} not found` });
    }

    return { data: formatVersion(version) };
  });

  // DELETE /:id - Delete a draft version
  app.delete('/:id', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      response: {
        200: Type.Object({ success: Type.Boolean() }),
        400: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    try {
      const success = await importVersionService.deleteVersion(id);
      if (!success) {
        return reply.status(404).send({ error: `Version ${id} not found` });
      }
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.status(400).send({ error: message });
    }
  });

  // POST /:id/validate - Trigger validation (async job)
  app.post('/:id/validate', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      response: {
        200: Type.Object({ data: ImportJobSchema }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    const version = await importVersionService.getVersion(id);
    if (!version) {
      return reply.status(404).send({ error: `Version ${id} not found` });
    }

    // Create job and run validation in background
    const job = await importVersionService.createJob(id, 'validation');

    // Run validation asynchronously
    setImmediate(async () => {
      try {
        await importVersionService.updateJobProgress(job.id, 10, 'running');

        const result = await importVersionService.validateGeoJSON(id);

        await importVersionService.updateJobProgress(
          job.id,
          100,
          'completed',
          undefined,
          result as unknown as Record<string, unknown>
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        await importVersionService.updateJobProgress(job.id, 0, 'failed', message);
      }
    });

    return { data: formatJob(job) };
  });

  // GET /:id/validation - Get validation results
  app.get('/:id/validation', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      response: {
        200: Type.Object({ data: ValidationResultSchema }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    try {
      const result = await importVersionService.validateGeoJSON(id);
      return { data: result };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('not found')) {
        return reply.status(404).send({ error: message });
      }
      return reply.status(500).send({ error: message });
    }
  });

  // GET /:id/preview - Get diff preview
  app.get('/:id/preview', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      response: {
        200: Type.Object({ data: DiffResultSchema }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    try {
      const result = await importVersionService.generateDiff(id);
      return { data: result };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('not found')) {
        return reply.status(404).send({ error: message });
      }
      return reply.status(500).send({ error: message });
    }
  });

  // POST /:id/publish - Publish version (async job)
  app.post('/:id/publish', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      response: {
        200: Type.Object({ data: ImportJobSchema }),
        400: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String(), message: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    // Phase 0: Road asset import is disabled
    if (ROAD_ASSETS_FROZEN) {
      return reply.status(403).send({
        error: 'Road asset import is disabled',
        message: 'Road asset modifications are disabled (Phase 0). Import publish is not allowed.',
      });
    }

    const { id } = request.params;

    const version = await importVersionService.getVersion(id);
    if (!version) {
      return reply.status(404).send({ error: `Version ${id} not found` });
    }

    if (version.status !== 'draft') {
      return reply.status(400).send({ error: 'Can only publish draft versions' });
    }

    // Create job and run publish in background
    const job = await importVersionService.createJob(id, 'publish');

    // Run publish asynchronously
    setImmediate(async () => {
      try {
        await importVersionService.updateJobProgress(job.id, 10, 'running');

        const result = await importVersionService.publishVersion(
          id,
          undefined,
          async (percent) => {
            await importVersionService.updateJobProgress(job.id, percent);
          }
        );

        await importVersionService.updateJobProgress(
          job.id,
          100,
          'completed',
          undefined,
          result as unknown as Record<string, unknown>
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        await importVersionService.updateJobProgress(job.id, 0, 'failed', message);
      }
    });

    return { data: formatJob(job) };
  });

  // POST /:id/rollback - Rollback to version (async job)
  app.post('/:id/rollback', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      response: {
        200: Type.Object({ data: ImportJobSchema }),
        400: Type.Object({ error: Type.String() }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    const version = await importVersionService.getVersion(id);
    if (!version) {
      return reply.status(404).send({ error: `Version ${id} not found` });
    }

    if (!version.snapshotPath) {
      return reply.status(400).send({ error: 'Version has no snapshot for rollback' });
    }

    // Create job and run rollback in background
    const job = await importVersionService.createJob(id, 'rollback');

    // Run rollback asynchronously
    setImmediate(async () => {
      try {
        await importVersionService.updateJobProgress(job.id, 10, 'running');

        const result = await importVersionService.rollbackToVersion(id);

        await importVersionService.updateJobProgress(
          job.id,
          100,
          'completed',
          undefined,
          result as unknown as Record<string, unknown>
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        await importVersionService.updateJobProgress(job.id, 0, 'failed', message);
      }
    });

    return { data: formatJob(job) };
  });

  // GET /:id/history - Get historical diff (changes made during this import)
  app.get('/:id/history', {
    schema: {
      params: Type.Object({ id: Type.String() }),
      response: {
        200: Type.Object({ data: DiffResultSchema }),
        404: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;

    try {
      const version = await importVersionService.getVersion(id);
      if (!version) {
        return reply.status(404).send({ error: `Version ${id} not found` });
      }

      if (!version.diffPath) {
        return reply.status(404).send({ error: 'No history available for this version' });
      }

      const diff = await importVersionService.getHistoricalDiff(id);
      if (!diff) {
        // Diff file is missing (deleted or never created) - return 404, not 500
        return reply.status(404).send({ error: 'History file not found. It may have been deleted or never created.' });
      }

      return { data: diff };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Import] History fetch failed:', error);
      return reply.status(500).send({ error: message });
    }
  });

  // GET /jobs/:jobId - Get job status
  app.get('/jobs/:jobId', {
    schema: {
      params: Type.Object({ jobId: Type.String() }),
      response: {
        200: Type.Object({ data: ImportJobSchema }),
        404: Type.Object({ error: Type.String() }),
      },
    },
  }, async (request, reply) => {
    const { jobId } = request.params;

    const job = await importVersionService.getJob(jobId);
    if (!job) {
      return reply.status(404).send({ error: `Job ${jobId} not found` });
    }

    return { data: formatJob(job) };
  });
}

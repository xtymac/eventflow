import { FastifyReply } from 'fastify';
import type { ProblemDetail } from '../../routes/ogc/schemas/ogc-common.js';

/**
 * Base OGC API error class following RFC 7807 Problem Details
 */
export class OgcError extends Error {
  constructor(
    public readonly status: number,
    public readonly title: string,
    public readonly detail: string,
    public readonly type?: string
  ) {
    super(detail);
    this.name = 'OgcError';
  }

  toProblemDetail(): ProblemDetail {
    return {
      type: this.type,
      title: this.title,
      status: this.status,
      detail: this.detail,
    };
  }
}

/**
 * Invalid CRS URI error
 */
export class InvalidCrsError extends OgcError {
  constructor(crsUri: string) {
    super(
      400,
      'Invalid CRS',
      `Unsupported CRS URI: ${crsUri}. Supported CRS: CRS84, EPSG:4326, EPSG:3857, EPSG:6675`,
      'http://www.opengis.net/def/exceptions/ogcapi-features-2/1.0/invalid-crs'
    );
  }
}

/**
 * Invalid CQL2 filter error
 */
export class InvalidFilterError extends OgcError {
  constructor(detail: string) {
    super(
      400,
      'Invalid Filter',
      detail,
      'http://www.opengis.net/def/exceptions/ogcapi-features-3/1.0/invalid-filter'
    );
  }
}

/**
 * Collection not found error
 */
export class CollectionNotFoundError extends OgcError {
  constructor(collectionId: string) {
    super(
      404,
      'Collection Not Found',
      `Collection '${collectionId}' does not exist`,
      'http://www.opengis.net/def/exceptions/ogcapi-features-1/1.0/not-found'
    );
  }
}

/**
 * Feature not found error
 */
export class FeatureNotFoundError extends OgcError {
  constructor(collectionId: string, featureId: string) {
    super(
      404,
      'Feature Not Found',
      `Feature '${featureId}' not found in collection '${collectionId}'`,
      'http://www.opengis.net/def/exceptions/ogcapi-features-1/1.0/not-found'
    );
  }
}

/**
 * Write not allowed for collection
 */
export class WriteNotAllowedError extends OgcError {
  constructor(collectionId: string) {
    super(
      501,
      'Write Not Implemented',
      `Write operations are not allowed for collection '${collectionId}'`,
      'http://www.opengis.net/def/exceptions/ogcapi-features-4/1.0/not-implemented'
    );
  }
}

/**
 * ID mismatch error for PUT/PATCH
 */
export class IdMismatchError extends OgcError {
  constructor(pathId: string, bodyId: string) {
    super(
      400,
      'ID Mismatch',
      `Body ID "${bodyId}" does not match path ID "${pathId}"`,
      'http://www.opengis.net/def/exceptions/ogcapi-features-4/1.0/id-mismatch'
    );
  }
}

/**
 * Unauthorized error for write operations
 */
export class UnauthorizedError extends OgcError {
  constructor() {
    super(
      401,
      'Unauthorized',
      'Valid X-API-Key header required for write operations',
      'http://www.opengis.net/def/exceptions/ogcapi-features-4/1.0/unauthorized'
    );
  }
}

/**
 * Invalid bbox error
 */
export class InvalidBboxError extends OgcError {
  constructor(detail: string) {
    super(
      400,
      'Invalid Bbox',
      detail,
      'http://www.opengis.net/def/exceptions/ogcapi-features-1/1.0/invalid-parameter-value'
    );
  }
}

/**
 * Send OGC error response in application/problem+json format
 */
export function sendOgcError(reply: FastifyReply, error: Error): void {
  const problem: ProblemDetail = error instanceof OgcError
    ? error.toProblemDetail()
    : {
        title: 'Internal Server Error',
        status: 500,
        detail: error.message,
      };

  reply
    .status(problem.status)
    .header('Content-Type', 'application/problem+json')
    .send(problem);
}

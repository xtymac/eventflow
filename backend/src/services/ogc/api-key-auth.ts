import { FastifyRequest } from 'fastify';
import { UnauthorizedError } from './ogc-error.js';

/**
 * Placeholder API key authentication for OGC write operations
 * This is a temporary solution until Phase 9 SSO integration
 *
 * Set OGC_WRITE_API_KEY environment variable to enable write operations
 */

const API_KEY = process.env.OGC_WRITE_API_KEY;

/**
 * Validate API key from request headers
 * @throws UnauthorizedError if API key is invalid or missing
 */
export function validateApiKey(request: FastifyRequest): void {
  // If no API key is configured, allow all requests (development mode)
  if (!API_KEY) {
    return;
  }

  const providedKey = request.headers['x-api-key'];

  if (!providedKey || providedKey !== API_KEY) {
    throw new UnauthorizedError();
  }
}

/**
 * Check if API key authentication is enabled
 */
export function isAuthEnabled(): boolean {
  return !!API_KEY;
}

/**
 * Check if request has valid API key (non-throwing version)
 */
export function hasValidApiKey(request: FastifyRequest): boolean {
  if (!API_KEY) {
    return true; // No auth configured
  }

  const providedKey = request.headers['x-api-key'];
  return providedKey === API_KEY;
}

/**
 * Transaction wrapper with retry on serialization errors.
 *
 * Usage:
 *   const result = await withTransaction(async (client) => {
 *     await client.query('UPDATE ... SET status = $1 WHERE id = $2', ['closed', eventId]);
 *     await client.query('INSERT INTO decisions ...');
 *     return { ok: true };
 *   });
 */

import pg from 'pg';
import { pool } from '../../backend/src/db/index.js';

export interface TransactionOptions {
  /** Max retry attempts on serialization error (code 40001). Default: 3 */
  maxRetries?: number;
  /** PostgreSQL isolation level. Default: 'READ COMMITTED' */
  isolationLevel?: 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
  /** Optional label for logging / diagnostics */
  label?: string;
}

export interface TransactionResult<T> {
  data: T;
  retries: number;
  durationMs: number;
}

/**
 * Execute a callback within a PostgreSQL transaction.
 * Automatically retries on serialization failure (40001).
 */
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
  options: TransactionOptions = {},
): Promise<TransactionResult<T>> {
  const { maxRetries = 3, isolationLevel = 'READ COMMITTED', label } = options;
  const start = performance.now();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const client = await pool.connect();
    try {
      await client.query(`BEGIN ISOLATION LEVEL ${isolationLevel}`);
      const result = await fn(client);
      await client.query('COMMIT');
      return {
        data: result,
        retries: attempt,
        durationMs: performance.now() - start,
      };
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      const pgError = error as { code?: string };
      if (pgError.code === '40001' && attempt < maxRetries) {
        // Serialization failure — retry
        if (label) {
          console.warn(`[TX:${label}] Serialization conflict, retry ${attempt + 1}/${maxRetries}`);
        }
        continue;
      }
      throw error;
    } finally {
      client.release();
    }
  }

  throw new Error(`Transaction${label ? ` [${label}]` : ''} failed after ${maxRetries} retries`);
}

/**
 * Measure raw query execution time (no transaction wrapping).
 * Used in benchmarks for individual queries.
 */
export async function measureQuery<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<{ data: T; durationMs: number }> {
  const client = await pool.connect();
  const start = performance.now();
  try {
    const data = await fn(client);
    return { data, durationMs: performance.now() - start };
  } finally {
    client.release();
  }
}

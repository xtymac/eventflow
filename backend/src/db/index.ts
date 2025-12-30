import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5433/nagoya_construction';

const pool = new Pool({
  connectionString,
});

export const db = drizzle(pool, { schema });

export { pool };

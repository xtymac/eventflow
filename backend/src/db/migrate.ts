import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5433/nagoya_construction';

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  console.log('Running migrations...');

  await migrate(db, {
    migrationsFolder: join(__dirname, '../../drizzle'),
  });

  console.log('Migrations completed!');

  await pool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

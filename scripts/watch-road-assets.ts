/**
 * Road Assets Change Watcher
 *
 * Listens to PostgreSQL notifications when road_assets table changes.
 * Uses debounce (30 seconds) to avoid frequent PMTiles regeneration.
 *
 * Usage:
 * npm run watch:road-assets
 *
 * This script runs on the host machine (not in Docker) because tippecanoe
 * is installed on the host.
 */

import pg from 'pg';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const DEBOUNCE_MS = 30000; // 30 seconds
const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://mac@localhost:5432/nagoya_construction';

let debounceTimer: NodeJS.Timeout | null = null;
let pendingChanges = 0;
let isRegenerating = false;

async function regeneratePMTiles() {
  if (isRegenerating) {
    console.log('[Watcher] PMTiles regeneration already in progress, skipping...');
    return;
  }

  isRegenerating = true;
  const changesCount = pendingChanges;
  pendingChanges = 0;

  console.log(`\n[Watcher] Regenerating PMTiles (${changesCount} changes detected)...`);
  const startTime = Date.now();

  try {
    // Export road assets from database
    console.log('[Watcher] Step 1/2: Exporting road assets...');
    const { stdout: exportOut } = await execAsync('npm run export:road-assets', {
      cwd: process.cwd(),
    });

    // Extract feature count from output
    const featureMatch = exportOut.match(/Exported (\d+) features/);
    if (featureMatch) {
      console.log(`[Watcher] Exported ${featureMatch[1]} features`);
    }

    // Generate PMTiles
    console.log('[Watcher] Step 2/2: Generating PMTiles...');
    await execAsync('npm run tiles:generate', {
      cwd: process.cwd(),
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Watcher] PMTiles regenerated successfully in ${duration}s`);
    console.log('[Watcher] Refresh your browser to see the changes.\n');
  } catch (error) {
    console.error('[Watcher] Error regenerating PMTiles:', error);
  } finally {
    isRegenerating = false;
  }
}

function scheduleRegeneration() {
  pendingChanges++;

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  console.log(
    `[Watcher] Change detected (${pendingChanges} pending). ` +
    `Will regenerate in ${DEBOUNCE_MS / 1000}s if no more changes...`
  );

  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    regeneratePMTiles();
  }, DEBOUNCE_MS);
}

async function main() {
  console.log('===========================================');
  console.log('  Road Assets Change Watcher');
  console.log('===========================================');
  console.log(`Database: ${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`Debounce: ${DEBOUNCE_MS / 1000} seconds`);
  console.log('');
  console.log('Listening for changes to road_assets table...');
  console.log('Press Ctrl+C to stop.\n');

  const client = new pg.Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('[Watcher] Connected to database');

    // Listen to notifications
    await client.query('LISTEN road_assets_changed');
    console.log('[Watcher] Subscribed to road_assets_changed notifications\n');

    client.on('notification', (msg) => {
      if (msg.channel === 'road_assets_changed') {
        try {
          const payload = JSON.parse(msg.payload || '{}');
          console.log(
            `[Watcher] ${new Date().toLocaleTimeString()} - ` +
            `${payload.operation} on ${payload.table}`
          );
        } catch {
          console.log(`[Watcher] Change notification received`);
        }
        scheduleRegeneration();
      }
    });

    client.on('error', (err) => {
      console.error('[Watcher] Database connection error:', err.message);
      process.exit(1);
    });

    // Keep the process running
    process.on('SIGINT', async () => {
      console.log('\n[Watcher] Shutting down...');
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        console.log('[Watcher] Cancelled pending regeneration');
      }
      await client.end();
      console.log('[Watcher] Disconnected from database');
      process.exit(0);
    });
  } catch (error) {
    console.error('[Watcher] Failed to connect to database:', error);
    process.exit(1);
  }
}

main();

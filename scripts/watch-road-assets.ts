/**
 * Road Assets Change Watcher
 *
 * Listens to PostgreSQL notifications when road_assets table changes.
 * Uses debounce (30 seconds) to avoid frequent PMTiles regeneration.
 *
 * Usage:
 * # For EC2 (default - requires SSH tunnel on port 15432):
 * ssh -i ~/.ssh/eventflow-prod-key.pem -L 15432:localhost:5433 ubuntu@18.177.72.233 -N &
 * npm run watch:road-assets
 *
 * # For local database:
 * DATABASE_URL=postgresql://mac@localhost:5432/nagoya_construction npm run watch:road-assets
 *
 * This script runs on the host machine (not in Docker) because tippecanoe
 * is installed on the host.
 */

import pg from 'pg';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const DEBOUNCE_MS = 30000; // 30 seconds
// Default to EC2 via SSH tunnel (port 15432)
const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:15432/nagoya_construction';

const IS_EC2 = DATABASE_URL.includes('15432');
const SSH_KEY = '~/.ssh/eventflow-prod-key.pem';
const EC2_HOST = 'ubuntu@18.177.72.233';

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
    if (IS_EC2) {
      // Export from EC2 database
      console.log('[Watcher] Step 1/3: Exporting from EC2 database...');
      const exportCmd = `ssh -i ${SSH_KEY} ${EC2_HOST} "docker exec nagoya-db psql -U postgres -d nagoya_construction -t -A -c \\"
SELECT json_build_object(
  'type', 'FeatureCollection',
  'features', COALESCE(json_agg(
    json_build_object(
      'type', 'Feature',
      'geometry', ST_AsGeoJSON(geometry)::json,
      'properties', json_build_object(
        'id', id,
        'road_type', road_type,
        'name_ja', name_ja,
        'local_ref', local_ref,
        'ward', ward,
        'displayName', COALESCE(name_ja, local_ref, 'Road ' || id)
      )
    )
  ), '[]')
)
FROM road_assets WHERE geometry IS NOT NULL;\\""`;

      const { stdout } = await execAsync(exportCmd, { maxBuffer: 200 * 1024 * 1024 });
      const fs = await import('fs');
      fs.writeFileSync('/tmp/ec2_road_assets.geojson', stdout);

      const features = JSON.parse(stdout).features?.length || 0;
      console.log(`[Watcher] Exported ${features} features from EC2`);

      // Generate PMTiles
      console.log('[Watcher] Step 2/3: Generating PMTiles...');
      await execAsync(
        'tippecanoe --output=/tmp/roads_ec2.pmtiles --minimum-zoom=8 --maximum-zoom=16 ' +
        '--simplification=10 --drop-densest-as-needed --include=id --include=road_type ' +
        '--include=displayName --include=name_ja --include=local_ref --include=ward ' +
        '--layer=roads --force /tmp/ec2_road_assets.geojson'
      );

      // Sync to EC2
      console.log('[Watcher] Step 3/3: Syncing PMTiles to EC2...');
      await execAsync(
        `rsync -az -e "ssh -i ${SSH_KEY}" /tmp/roads_ec2.pmtiles ` +
        `${EC2_HOST}:/home/ubuntu/eventflow/frontend/public/tiles/roads.pmtiles`
      );
    } else {
      // Local database flow
      console.log('[Watcher] Step 1/2: Exporting road assets...');
      const { stdout: exportOut } = await execAsync('npm run export:road-assets', {
        cwd: process.cwd(),
      });

      const featureMatch = exportOut.match(/Exported (\d+) features/);
      if (featureMatch) {
        console.log(`[Watcher] Exported ${featureMatch[1]} features`);
      }

      console.log('[Watcher] Step 2/2: Generating PMTiles...');
      await execAsync('npm run tiles:generate', {
        cwd: process.cwd(),
      });
    }

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
  console.log(`Mode: ${IS_EC2 ? 'EC2 (via SSH tunnel)' : 'Local'}`);
  console.log(`Database: ${DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);
  console.log(`Debounce: ${DEBOUNCE_MS / 1000} seconds`);
  if (IS_EC2) {
    console.log('');
    console.log('Make sure SSH tunnel is running:');
    console.log(`  ssh -i ${SSH_KEY} -L 15432:localhost:5433 ${EC2_HOST} -N &`);
  }
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

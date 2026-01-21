/**
 * Enrich Road Names from OSM via Overpass API
 *
 * This script queries OpenStreetMap via Overpass API to fetch road names
 * for the Nagoya area and matches them to existing unnamed road_assets
 * using spatial proximity (ST_DWithin).
 *
 * Usage:
 * npx tsx scripts/enrich-from-osm.ts [--dry-run] [--ward=WARD_NAME]
 *
 * Options:
 * --dry-run    Show what would be updated without making changes
 * --ward=NAME  Only process roads in specific ward (e.g., --ward=Naka-ku)
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
import type { Feature, LineString, FeatureCollection } from 'geojson';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SAMPLE_DATA_DIR = join(__dirname, '../sample-data');
const REPORT_PATH = join(SAMPLE_DATA_DIR, 'osm-enrichment-report.json');

// Nagoya city bounding box (approximate)
const NAGOYA_BBOX = {
  south: 35.05,
  west: 136.80,
  north: 35.25,
  east: 137.05,
};

// Split into grid cells for smaller queries
const GRID_SIZE = 4; // 4x4 grid = 16 cells

// Overpass API endpoints (multiple for load balancing)
const OVERPASS_APIS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
];

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;
const DELAY_BETWEEN_REQUESTS_MS = 2000;

interface OSMRoad {
  id: number;
  name?: string;
  nameJa?: string;
  ref?: string;
  localRef?: string;
  highway: string;
  geometry: LineString;
}

interface EnrichmentStats {
  timestamp: string;
  totalOsmRoads: number;
  namedOsmRoads: number;
  beforeStats: {
    total: number;
    named: number;
    unnamed: number;
    coverageRate: number;
  };
  afterStats: {
    total: number;
    named: number;
    unnamed: number;
    coverageRate: number;
  };
  enriched: number;
  reviewCandidates: number; // Phase 2: 33-60m (not auto-written)
  byConfidence: {
    high: number;
    medium: number;
    low: number;
  };
  byWard: Record<string, number>;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface GridCell {
  south: number;
  west: number;
  north: number;
  east: number;
  index: number;
}

function getGridCells(): GridCell[] {
  const cells: GridCell[] = [];
  const latStep = (NAGOYA_BBOX.north - NAGOYA_BBOX.south) / GRID_SIZE;
  const lonStep = (NAGOYA_BBOX.east - NAGOYA_BBOX.west) / GRID_SIZE;

  let index = 0;
  for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
      cells.push({
        south: NAGOYA_BBOX.south + i * latStep,
        west: NAGOYA_BBOX.west + j * lonStep,
        north: NAGOYA_BBOX.south + (i + 1) * latStep,
        east: NAGOYA_BBOX.west + (j + 1) * lonStep,
        index: ++index,
      });
    }
  }
  return cells;
}

async function fetchCellWithRetry(cell: GridCell, apiIndex: number = 0): Promise<OSMRoad[]> {
  const api = OVERPASS_APIS[apiIndex % OVERPASS_APIS.length];

  const query = `
[out:json][timeout:90];
(
  way["highway"]["name"](${cell.south},${cell.west},${cell.north},${cell.east});
  way["highway"]["name:ja"](${cell.south},${cell.west},${cell.north},${cell.east});
  way["highway"]["ref"](${cell.south},${cell.west},${cell.north},${cell.east});
);
out geom;
`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(api, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (response.status === 429 || response.status === 504) {
        console.log(`  Cell ${cell.index}: Rate limited/timeout, waiting...`);
        await sleep(RETRY_DELAY_MS * attempt);
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const roads: OSMRoad[] = [];

      for (const element of data.elements || []) {
        if (element.type !== 'way' || !element.geometry) continue;

        const coordinates = element.geometry.map((node: { lat: number; lon: number }) => [
          node.lon,
          node.lat,
        ]);

        if (coordinates.length < 2) continue;

        const road: OSMRoad = {
          id: element.id,
          name: element.tags?.name,
          nameJa: element.tags?.['name:ja'],
          ref: element.tags?.ref,
          localRef: element.tags?.['local_ref'] || element.tags?.['nat_ref'],
          highway: element.tags?.highway,
          geometry: {
            type: 'LineString',
            coordinates,
          },
        };

        if (road.name || road.nameJa || road.ref || road.localRef) {
          roads.push(road);
        }
      }

      return roads;
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        console.log(`  Cell ${cell.index}: Failed after ${MAX_RETRIES} attempts, skipping`);
        return [];
      }
      console.log(`  Cell ${cell.index}: Attempt ${attempt} failed, retrying...`);
      await sleep(RETRY_DELAY_MS);
    }
  }

  return [];
}

async function fetchOsmRoads(): Promise<OSMRoad[]> {
  console.log('Fetching road data from OSM via Overpass API...');
  console.log(`Bounding box: ${NAGOYA_BBOX.south},${NAGOYA_BBOX.west},${NAGOYA_BBOX.north},${NAGOYA_BBOX.east}`);
  console.log(`Splitting into ${GRID_SIZE}x${GRID_SIZE} = ${GRID_SIZE * GRID_SIZE} grid cells\n`);

  const cells = getGridCells();
  const allRoads: Map<number, OSMRoad> = new Map(); // Dedupe by OSM ID

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    process.stdout.write(`Fetching cell ${cell.index}/${cells.length}... `);

    const roads = await fetchCellWithRetry(cell, i);

    for (const road of roads) {
      if (!allRoads.has(road.id)) {
        allRoads.set(road.id, road);
      }
    }

    console.log(`${roads.length} roads (total unique: ${allRoads.size})`);

    // Delay between requests to avoid rate limiting
    if (i < cells.length - 1) {
      await sleep(DELAY_BETWEEN_REQUESTS_MS);
    }
  }

  const roads = Array.from(allRoads.values());
  console.log(`\nTotal: ${roads.length} unique named roads from OSM`);
  return roads;
}

async function getDbStats(client: pg.PoolClient): Promise<{ total: number; named: number; unnamed: number; coverageRate: number }> {
  const result = await client.query(`
    SELECT
      COUNT(*)::int as total,
      COUNT(display_name)::int as named,
      (COUNT(*) - COUNT(display_name))::int as unnamed,
      ROUND(100.0 * COUNT(display_name) / NULLIF(COUNT(*), 0), 1) as coverage_rate
    FROM road_assets
  `);
  return {
    total: result.rows[0].total,
    named: result.rows[0].named,
    unnamed: result.rows[0].unnamed,
    coverageRate: parseFloat(result.rows[0].coverage_rate) || 0,
  };
}

async function insertOsmRoadsToTemp(client: pg.PoolClient, roads: OSMRoad[]): Promise<void> {
  console.log('Creating temporary table for OSM roads...');

  // Create temp table
  await client.query(`
    DROP TABLE IF EXISTS temp_osm_roads;
    CREATE TEMP TABLE temp_osm_roads (
      osm_id BIGINT PRIMARY KEY,
      name VARCHAR(255),
      name_ja VARCHAR(255),
      ref VARCHAR(100),
      local_ref VARCHAR(100),
      highway VARCHAR(50),
      geometry geometry(LineString, 4326)
    );
    CREATE INDEX idx_temp_osm_roads_geom ON temp_osm_roads USING GIST(geometry);
  `);

  // Batch insert
  const batchSize = 500;
  let inserted = 0;

  for (let i = 0; i < roads.length; i += batchSize) {
    const batch = roads.slice(i, i + batchSize);
    const values: string[] = [];
    const params: (string | number | null)[] = [];
    let paramIndex = 1;

    for (const road of batch) {
      values.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, ST_SetSRID(ST_GeomFromGeoJSON($${paramIndex++}), 4326))`);
      params.push(
        road.id,
        road.name || null,
        road.nameJa || null,
        road.ref || null,
        road.localRef || null,
        road.highway,
        JSON.stringify(road.geometry)
      );
    }

    await client.query(
      `INSERT INTO temp_osm_roads (osm_id, name, name_ja, ref, local_ref, highway, geometry)
       VALUES ${values.join(', ')}
       ON CONFLICT (osm_id) DO NOTHING`,
      params
    );

    inserted += batch.length;
    process.stdout.write(`\rInserted ${inserted}/${roads.length} OSM roads...`);
  }

  console.log('\nTemp table created with spatial index');
}

async function runEnrichment(client: pg.PoolClient, dryRun: boolean, wardFilter?: string): Promise<{
  matchCount: number;
  byConfidence: { high: number; medium: number; low: number };
  byWard: Record<string, number>;
}> {
  console.log(`\nRunning spatial matching (dry-run: ${dryRun})...`);

  // Build ward filter if specified
  const wardClause = wardFilter ? `AND r.ward = '${wardFilter}'` : '';

  // Phase 1: Auto-write threshold (using geography for accurate meter distance)
  const AUTO_DISTANCE_M = 33; // Auto-write for ≤33m matches
  const HIGH_THRESHOLD_M = 5;
  const MEDIUM_THRESHOLD_M = 15;

  await client.query(`
    DROP TABLE IF EXISTS temp_match_results;
    CREATE TEMP TABLE temp_match_results AS
    SELECT DISTINCT ON (r.id)
      r.id as asset_id,
      r.ward,
      COALESCE(o.name, o.name_ja, o.ref, o.local_ref) as matched_name,
      o.name as osm_name,
      o.name_ja as osm_name_ja,
      o.ref as osm_ref,
      o.local_ref as osm_local_ref,
      ST_Distance(r.geometry::geography, o.geometry::geography) as distance_m,
      CASE
        WHEN ST_Distance(r.geometry::geography, o.geometry::geography) <= ${HIGH_THRESHOLD_M} THEN 'high'
        WHEN ST_Distance(r.geometry::geography, o.geometry::geography) <= ${MEDIUM_THRESHOLD_M} THEN 'medium'
        ELSE 'low'
      END as confidence
    FROM road_assets r
    JOIN temp_osm_roads o ON ST_DWithin(r.geometry::geography, o.geometry::geography, ${AUTO_DISTANCE_M})
    WHERE r.display_name IS NULL
      AND COALESCE(o.name, o.name_ja, o.ref, o.local_ref) IS NOT NULL
      AND COALESCE(o.name, o.name_ja, o.ref, o.local_ref) != ''
      ${wardClause}
    ORDER BY r.id, ST_Distance(r.geometry::geography, o.geometry::geography);
  `);

  // Get match statistics
  const statsResult = await client.query(`
    SELECT
      COUNT(*)::int as total,
      SUM(CASE WHEN confidence = 'high' THEN 1 ELSE 0 END)::int as high,
      SUM(CASE WHEN confidence = 'medium' THEN 1 ELSE 0 END)::int as medium,
      SUM(CASE WHEN confidence = 'low' THEN 1 ELSE 0 END)::int as low
    FROM temp_match_results
  `);

  const byConfidence = {
    high: statsResult.rows[0].high || 0,
    medium: statsResult.rows[0].medium || 0,
    low: statsResult.rows[0].low || 0,
  };

  // Get ward distribution
  const wardResult = await client.query(`
    SELECT ward, COUNT(*)::int as count
    FROM temp_match_results
    WHERE ward IS NOT NULL
    GROUP BY ward
    ORDER BY count DESC
  `);

  const byWard: Record<string, number> = {};
  for (const row of wardResult.rows) {
    byWard[row.ward] = row.count;
  }

  const matchCount = statsResult.rows[0].total || 0;
  console.log(`Found ${matchCount} matches within ${AUTO_DISTANCE_M}m (Phase 1: auto-write)`);
  console.log(`  High confidence (≤${HIGH_THRESHOLD_M}m): ${byConfidence.high}`);
  console.log(`  Medium confidence (≤${MEDIUM_THRESHOLD_M}m): ${byConfidence.medium}`);
  console.log(`  Low confidence (≤${AUTO_DISTANCE_M}m): ${byConfidence.low}`);

  if (!dryRun && matchCount > 0) {
    // Apply updates
    console.log('\nApplying updates to road_assets...');

    const updateResult = await client.query(`
      UPDATE road_assets r
      SET
        display_name = m.matched_name,
        name = COALESCE(r.name, m.osm_name),
        name_ja = COALESCE(r.name_ja, m.osm_name_ja),
        ref = COALESCE(r.ref, m.osm_ref),
        local_ref = COALESCE(r.local_ref, m.osm_local_ref),
        name_source = 'osm',
        name_confidence = m.confidence,
        updated_at = NOW()
      FROM temp_match_results m
      WHERE r.id = m.asset_id
      RETURNING r.id
    `);

    console.log(`Updated ${updateResult.rowCount} road assets`);
  }

  return { matchCount, byConfidence, byWard };
}

async function exportLowConfidence(client: pg.PoolClient): Promise<void> {
  const csvPath = join(SAMPLE_DATA_DIR, 'osm-low-confidence-roads.csv');

  const result = await client.query(`
    SELECT
      asset_id,
      ward,
      matched_name,
      ROUND(distance_m::numeric, 1) as distance_m,
      confidence
    FROM temp_match_results
    WHERE confidence = 'low'
    ORDER BY distance_m DESC
    LIMIT 500
  `);

  if (result.rows.length === 0) {
    console.log('No low-confidence matches to export');
    return;
  }

  const csv = [
    'asset_id,ward,matched_name,distance_m,confidence',
    ...result.rows.map(row =>
      `${row.asset_id},${row.ward || ''},${row.matched_name?.replace(/,/g, '，') || ''},${row.distance_m},${row.confidence}`
    ),
  ].join('\n');

  writeFileSync(csvPath, csv);
  console.log(`\nExported ${result.rows.length} low-confidence matches to:`);
  console.log(`  ${csvPath}`);
}

/**
 * Phase 2: Export review candidates (33-60m range)
 * These are matches too far for auto-write but close enough for manual review.
 * NO auto-write - only generates CSV for manual verification.
 */
async function exportReviewCandidates(client: pg.PoolClient, wardFilter?: string): Promise<number> {
  const csvPath = join(SAMPLE_DATA_DIR, 'manual-review-candidates.csv');

  const AUTO_DISTANCE_M = 33;
  const REVIEW_DISTANCE_M = 60;

  const wardClause = wardFilter ? `AND r.ward = '${wardFilter}'` : '';

  console.log(`\n=== Phase 2: Review Candidates (${AUTO_DISTANCE_M}-${REVIEW_DISTANCE_M}m) ===`);
  console.log('Searching for extended matches (no auto-write)...');

  // Find matches in the 33-60m range that weren't already matched
  const result = await client.query(`
    SELECT DISTINCT ON (r.id)
      r.id as asset_id,
      r.ward,
      COALESCE(o.name, o.name_ja, o.ref, o.local_ref) as suggested_name,
      o.name as osm_name,
      o.name_ja as osm_name_ja,
      ROUND(ST_Distance(r.geometry::geography, o.geometry::geography)::numeric, 1) as distance_m
    FROM road_assets r
    JOIN temp_osm_roads o ON ST_DWithin(r.geometry::geography, o.geometry::geography, ${REVIEW_DISTANCE_M})
    WHERE r.display_name IS NULL
      AND COALESCE(o.name, o.name_ja, o.ref, o.local_ref) IS NOT NULL
      AND COALESCE(o.name, o.name_ja, o.ref, o.local_ref) != ''
      AND ST_Distance(r.geometry::geography, o.geometry::geography) > ${AUTO_DISTANCE_M}
      ${wardClause}
    ORDER BY r.id, ST_Distance(r.geometry::geography, o.geometry::geography)
  `);

  if (result.rows.length === 0) {
    console.log(`No review candidates found in ${AUTO_DISTANCE_M}-${REVIEW_DISTANCE_M}m range`);
    return 0;
  }

  const csv = [
    'asset_id,ward,suggested_name,osm_name,osm_name_ja,distance_m',
    ...result.rows.map(row =>
      `${row.asset_id},${row.ward || ''},${row.suggested_name?.replace(/,/g, '，') || ''},${row.osm_name?.replace(/,/g, '，') || ''},${row.osm_name_ja?.replace(/,/g, '，') || ''},${row.distance_m}`
    ),
  ].join('\n');

  writeFileSync(csvPath, csv);
  console.log(`Found ${result.rows.length} review candidates`);
  console.log(`Exported to: ${csvPath}`);
  console.log('NOTE: These are NOT auto-written. Use the UI to manually verify and name.');

  return result.rows.length;
}

async function main() {
  console.log('=== OSM Road Name Enrichment via Overpass API ===\n');

  // Parse arguments
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const wardArg = args.find(a => a.startsWith('--ward='));
  const wardFilter = wardArg?.split('=')[1];

  if (dryRun) {
    console.log('DRY RUN MODE - No changes will be made\n');
  }

  if (wardFilter) {
    console.log(`Filtering by ward: ${wardFilter}\n`);
  }

  // Connect to database
  const pool = new pg.Pool({
    connectionString:
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5433/nagoya_construction',
  });

  const client = await pool.connect();

  try {
    // Get before stats
    const beforeStats = await getDbStats(client);
    console.log('\n=== Current Statistics ===');
    console.log(`Total road assets: ${beforeStats.total}`);
    console.log(`Named: ${beforeStats.named} (${beforeStats.coverageRate}%)`);
    console.log(`Unnamed: ${beforeStats.unnamed}`);

    // Fetch OSM roads
    const osmRoads = await fetchOsmRoads();

    if (osmRoads.length === 0) {
      console.log('No OSM roads fetched. Exiting.');
      return;
    }

    // Insert to temp table
    await insertOsmRoadsToTemp(client, osmRoads);

    // Run enrichment
    const { matchCount, byConfidence, byWard } = await runEnrichment(client, dryRun, wardFilter);

    // Get after stats
    const afterStats = dryRun ? beforeStats : await getDbStats(client);

    if (!dryRun) {
      console.log('\n=== After Enrichment ===');
      console.log(`Total road assets: ${afterStats.total}`);
      console.log(`Named: ${afterStats.named} (${afterStats.coverageRate}%)`);
      console.log(`Unnamed: ${afterStats.unnamed}`);
      console.log(`Improvement: +${afterStats.named - beforeStats.named} roads named`);
    }

    // Export low confidence for review
    if (!dryRun) {
      await exportLowConfidence(client);
    }

    // Phase 2: Export review candidates (33-60m) - no auto-write
    const reviewCount = await exportReviewCandidates(client, wardFilter);

    // Save report
    const report: EnrichmentStats = {
      timestamp: new Date().toISOString(),
      totalOsmRoads: osmRoads.length,
      namedOsmRoads: osmRoads.filter(r => r.name || r.nameJa).length,
      beforeStats,
      afterStats,
      enriched: matchCount,
      reviewCandidates: reviewCount,
      byConfidence,
      byWard,
    };

    if (!existsSync(SAMPLE_DATA_DIR)) {
      mkdirSync(SAMPLE_DATA_DIR, { recursive: true });
    }

    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    console.log(`\nReport saved to: ${REPORT_PATH}`);

    if (dryRun) {
      console.log('\n=== DRY RUN COMPLETE ===');
      console.log('Run without --dry-run to apply changes');
    } else {
      console.log('\n=== ENRICHMENT COMPLETE ===');
      console.log('\nNext steps:');
      console.log('1. Review Phase 2 candidates (33-60m): cat sample-data/manual-review-candidates.csv');
      console.log('2. Use the UI to manually name roads from the review list');
      console.log('3. Export GeoJSON: npx tsx scripts/export-road-assets.ts');
      console.log('4. Regenerate PMTiles: npm run tiles:generate');
    }

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

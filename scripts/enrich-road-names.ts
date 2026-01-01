/**
 * Municipal GIS Road Name Enrichment Script
 *
 * Enriches existing road_assets with names from municipal GIS data.
 * Uses ST_DWithin spatial proximity matching with confidence scoring.
 *
 * Prerequisites:
 * 1. Place municipal Shapefile in sample-data/municipal-gis/roads.shp
 * 2. Run migration: npm run db:migrate
 * 3. Ensure PostGIS is running
 *
 * Usage:
 * npx tsx scripts/enrich-road-names.ts
 *
 * Options (via env vars):
 * - MATCH_DISTANCE=30 (meters, default 30)
 * - DRY_RUN=true (preview without updating)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import proj4 from 'proj4';
import * as shapefile from 'shapefile';
import pg from 'pg';
import type { Feature, LineString, MultiLineString, Geometry, Position } from 'geojson';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SAMPLE_DATA_DIR = join(__dirname, '../sample-data');
const MUNICIPAL_GIS_DIR = join(SAMPLE_DATA_DIR, 'municipal-gis');

// Configuration
const MATCH_DISTANCE = parseInt(process.env.MATCH_DISTANCE || '30', 10);
const DRY_RUN = process.env.DRY_RUN === 'true';

// Confidence thresholds (meters)
const CONFIDENCE_THRESHOLDS = {
  high: 5,    // Very close match
  medium: 15, // Reasonable match
  low: 30,    // Possible match (needs review)
};

// CRS definitions - verify from .prj file!
// EPSG:2443 = JGD2000 / Japan Plane Rectangular CS VII (Central Honshu)
proj4.defs('EPSG:2443', '+proj=tmerc +lat_0=36 +lon_0=137.166666666667 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');
// EPSG:6675 = JGD2011 / Japan Zone 7 (newer datum)
proj4.defs('EPSG:6675', '+proj=tmerc +lat_0=36 +lon_0=137.166666666667 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs');

interface MunicipalRoad {
  road_name: string | null;
  route_ref: string | null;
  geometry: Geometry;
}

interface EnrichmentStats {
  timestamp: string;
  municipalDataSource: string;
  crs: string;
  matchDistance: number;
  dryRun: boolean;
  summary: {
    totalAssets: number;
    before: {
      named: number;
      unnamed: number;
      coverageRate: number;
    };
    after: {
      named: number;
      unnamed: number;
      coverageRate: number;
    };
    enriched: number;
    bySource: {
      osm: number;
      municipal: number;
      manual: number;
    };
    byConfidence: {
      high: number;
      medium: number;
      low: number;
    };
    byWard: Record<string, number>;
  };
}

interface LowConfidenceMatch {
  asset_id: string;
  ward: string | null;
  matched_name: string;
  distance_m: number;
  confidence: string;
}

/**
 * Transform coordinates from source CRS to WGS84 (EPSG:4326)
 */
function transformCoords(coords: Position[], sourceCrs: string): Position[] {
  return coords.map(([x, y]) => {
    const [lng, lat] = proj4(sourceCrs, 'EPSG:4326', [x, y]);
    return [lng, lat];
  });
}

/**
 * Transform geometry from source CRS to WGS84
 */
function transformGeometry(geometry: Geometry, sourceCrs: string): Geometry {
  if (geometry.type === 'LineString') {
    return {
      type: 'LineString',
      coordinates: transformCoords(geometry.coordinates as Position[], sourceCrs),
    };
  } else if (geometry.type === 'MultiLineString') {
    return {
      type: 'MultiLineString',
      coordinates: (geometry.coordinates as Position[][]).map(
        (ring) => transformCoords(ring, sourceCrs)
      ),
    };
  } else if (geometry.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: (geometry.coordinates as Position[][]).map(
        (ring) => transformCoords(ring, sourceCrs)
      ),
    };
  } else if (geometry.type === 'Point') {
    const [lng, lat] = proj4(sourceCrs, 'EPSG:4326', geometry.coordinates as Position);
    return {
      type: 'Point',
      coordinates: [lng, lat],
    };
  }
  // Return as-is for unsupported types
  return geometry;
}

/**
 * Detect CRS from .prj file
 */
function detectCrs(prjPath: string): string {
  if (!existsSync(prjPath)) {
    console.warn('No .prj file found, defaulting to EPSG:2443');
    return 'EPSG:2443';
  }

  const prj = readFileSync(prjPath, 'utf-8');
  console.log('CRS from .prj:', prj.slice(0, 100) + '...');

  // Simple detection based on common patterns
  if (prj.includes('JGD2011') || prj.includes('JGD_2011')) {
    return 'EPSG:6675';
  } else if (prj.includes('JGD2000') || prj.includes('JGD_2000')) {
    return 'EPSG:2443';
  }

  // Default to JGD2000
  console.warn('Could not auto-detect CRS, defaulting to EPSG:2443');
  return 'EPSG:2443';
}

/**
 * Load municipal Shapefile and transform to WGS84
 */
async function loadMunicipalData(shpPath: string, sourceCrs: string): Promise<MunicipalRoad[]> {
  const source = await shapefile.open(shpPath);
  const roads: MunicipalRoad[] = [];

  let result;
  while (!(result = await source.read()).done) {
    const feature = result.value;
    const props = feature.properties || {};

    // Extract road name - try common field names
    const roadName =
      props.road_name ||
      props.ROAD_NAME ||
      props.name ||
      props.NAME ||
      props['路線名'] ||
      props['道路名'] ||
      null;

    // Extract route reference
    const routeRef =
      props.route_ref ||
      props.ROUTE_REF ||
      props.ref ||
      props.REF ||
      props['路線番号'] ||
      null;

    // Skip if no name
    if (!roadName && !routeRef) {
      continue;
    }

    // Transform geometry to WGS84
    const transformedGeometry = transformGeometry(feature.geometry, sourceCrs);

    roads.push({
      road_name: roadName,
      route_ref: routeRef,
      geometry: transformedGeometry,
    });
  }

  return roads;
}

/**
 * Get statistics from database
 */
async function getStats(client: pg.PoolClient): Promise<{
  total: number;
  named: number;
  unnamed: number;
  bySource: Record<string, number>;
  byWard: Record<string, number>;
}> {
  const totalResult = await client.query('SELECT COUNT(*)::int as count FROM road_assets');
  const namedResult = await client.query(
    'SELECT COUNT(*)::int as count FROM road_assets WHERE display_name IS NOT NULL'
  );

  const sourceResult = await client.query(`
    SELECT COALESCE(name_source, 'none') as source, COUNT(*)::int as count
    FROM road_assets
    GROUP BY name_source
  `);

  const wardResult = await client.query(`
    SELECT COALESCE(ward, 'unknown') as ward, COUNT(*)::int as count
    FROM road_assets
    WHERE display_name IS NOT NULL
    GROUP BY ward
  `);

  const bySource: Record<string, number> = {};
  for (const row of sourceResult.rows) {
    bySource[row.source] = row.count;
  }

  const byWard: Record<string, number> = {};
  for (const row of wardResult.rows) {
    byWard[row.ward] = row.count;
  }

  const total = totalResult.rows[0].count;
  const named = namedResult.rows[0].count;

  return {
    total,
    named,
    unnamed: total - named,
    bySource,
    byWard,
  };
}

async function main() {
  console.log('=== Municipal GIS Road Name Enrichment ===\n');

  // Check for municipal data
  const shpPath = join(MUNICIPAL_GIS_DIR, 'roads.shp');
  if (!existsSync(shpPath)) {
    console.error('ERROR: Municipal data not found.');
    console.error(`Expected: ${shpPath}`);
    console.error('\nPlease download municipal GIS road data and place it in:');
    console.error(`  ${MUNICIPAL_GIS_DIR}/`);
    console.error('\nRequired files:');
    console.error('  - roads.shp');
    console.error('  - roads.dbf');
    console.error('  - roads.shx');
    console.error('  - roads.prj (optional, for CRS detection)');
    process.exit(1);
  }

  // Detect CRS
  const prjPath = shpPath.replace('.shp', '.prj');
  const sourceCrs = detectCrs(prjPath);
  console.log(`Using CRS: ${sourceCrs}`);
  console.log(`Match distance: ${MATCH_DISTANCE}m`);
  console.log(`Dry run: ${DRY_RUN}\n`);

  // Connect to database
  const pool = new pg.Pool({
    connectionString:
      process.env.DATABASE_URL ||
      'postgresql://postgres:postgres@localhost:5433/nagoya_construction',
  });

  const client = await pool.connect();

  try {
    // Get before stats
    console.log('Capturing before statistics...');
    const beforeStats = await getStats(client);
    console.log(`  Total assets: ${beforeStats.total}`);
    console.log(`  Named: ${beforeStats.named} (${((beforeStats.named / beforeStats.total) * 100).toFixed(1)}%)`);
    console.log(`  Unnamed: ${beforeStats.unnamed}`);

    // Load municipal data
    console.log('\nLoading municipal data...');
    const municipalRoads = await loadMunicipalData(shpPath, sourceCrs);
    console.log(`  Loaded ${municipalRoads.length} municipal road features`);

    if (municipalRoads.length === 0) {
      console.error('ERROR: No valid road features found in municipal data.');
      console.error('Check that the Shapefile contains road_name or similar field.');
      process.exit(1);
    }

    // Create temp table for municipal roads
    console.log('\nCreating temp table...');
    await client.query(`
      CREATE TEMP TABLE municipal_roads (
        id SERIAL PRIMARY KEY,
        road_name VARCHAR(255),
        route_ref VARCHAR(100),
        geometry geometry(Geometry, 4326)
      )
    `);

    // Insert municipal roads
    console.log('Inserting municipal data...');
    let insertCount = 0;
    for (const road of municipalRoads) {
      await client.query(
        `INSERT INTO municipal_roads (road_name, route_ref, geometry)
         VALUES ($1, $2, ST_SetSRID(ST_GeomFromGeoJSON($3), 4326))`,
        [road.road_name, road.route_ref, JSON.stringify(road.geometry)]
      );
      insertCount++;
      if (insertCount % 1000 === 0) {
        console.log(`  Inserted ${insertCount}/${municipalRoads.length}...`);
      }
    }
    console.log(`  Inserted ${insertCount} municipal roads`);

    // Create spatial index
    console.log('Creating spatial index...');
    await client.query('CREATE INDEX ON municipal_roads USING GIST(geometry)');

    // Run batch matching
    console.log('\nRunning spatial matching...');
    const matchResult = await client.query(`
      CREATE TEMP TABLE match_results AS
      SELECT DISTINCT ON (r.id)
        r.id as asset_id,
        r.ward,
        COALESCE(m.road_name, m.route_ref) as matched_name,
        ST_Distance(r.geometry::geography, m.geometry::geography) as distance_m,
        CASE
          WHEN ST_Distance(r.geometry::geography, m.geometry::geography) <= ${CONFIDENCE_THRESHOLDS.high} THEN 'high'
          WHEN ST_Distance(r.geometry::geography, m.geometry::geography) <= ${CONFIDENCE_THRESHOLDS.medium} THEN 'medium'
          ELSE 'low'
        END as confidence
      FROM road_assets r
      JOIN municipal_roads m ON ST_DWithin(r.geometry::geography, m.geometry::geography, ${MATCH_DISTANCE})
      WHERE r.display_name IS NULL
        AND COALESCE(m.road_name, m.route_ref) IS NOT NULL
        AND TRIM(COALESCE(m.road_name, m.route_ref)) != ''
      ORDER BY r.id, ST_Distance(r.geometry::geography, m.geometry::geography)
    `);

    // Get match count
    const matchCountResult = await client.query('SELECT COUNT(*)::int as count FROM match_results');
    const matchCount = matchCountResult.rows[0].count;
    console.log(`  Found ${matchCount} matches`);

    // Get confidence distribution
    const confidenceResult = await client.query(`
      SELECT confidence, COUNT(*)::int as count
      FROM match_results
      GROUP BY confidence
      ORDER BY confidence
    `);
    console.log('  Confidence distribution:');
    for (const row of confidenceResult.rows) {
      console.log(`    ${row.confidence}: ${row.count}`);
    }

    if (!DRY_RUN && matchCount > 0) {
      // Update road assets
      console.log('\nUpdating road assets...');
      await client.query(`
        UPDATE road_assets r
        SET
          display_name = m.matched_name,
          name_source = 'municipal',
          name_confidence = m.confidence
        FROM match_results m
        WHERE r.id = m.asset_id
      `);
      console.log(`  Updated ${matchCount} assets`);
    } else if (DRY_RUN) {
      console.log('\n[DRY RUN] Skipping database update');
    }

    // Get after stats
    console.log('\nCapturing after statistics...');
    const afterStats = await getStats(client);
    console.log(`  Total assets: ${afterStats.total}`);
    console.log(`  Named: ${afterStats.named} (${((afterStats.named / afterStats.total) * 100).toFixed(1)}%)`);
    console.log(`  Unnamed: ${afterStats.unnamed}`);

    // Export low-confidence matches for review
    console.log('\nExporting low-confidence matches...');
    const lowConfidenceResult = await client.query<LowConfidenceMatch>(`
      SELECT asset_id, ward, matched_name, distance_m, confidence
      FROM match_results
      WHERE confidence = 'low'
      ORDER BY distance_m DESC
    `);

    const lowConfidenceCsv = [
      'asset_id,ward,matched_name,distance_m,confidence',
      ...lowConfidenceResult.rows.map(
        (r) => `${r.asset_id},${r.ward || ''},${r.matched_name},${r.distance_m.toFixed(2)},${r.confidence}`
      ),
    ].join('\n');

    const csvPath = join(SAMPLE_DATA_DIR, 'low-confidence-roads.csv');
    writeFileSync(csvPath, lowConfidenceCsv);
    console.log(`  Exported ${lowConfidenceResult.rows.length} low-confidence matches to:`);
    console.log(`  ${csvPath}`);

    // Generate report
    const report: EnrichmentStats = {
      timestamp: new Date().toISOString(),
      municipalDataSource: 'roads.shp',
      crs: sourceCrs,
      matchDistance: MATCH_DISTANCE,
      dryRun: DRY_RUN,
      summary: {
        totalAssets: afterStats.total,
        before: {
          named: beforeStats.named,
          unnamed: beforeStats.unnamed,
          coverageRate: parseFloat(((beforeStats.named / beforeStats.total) * 100).toFixed(1)),
        },
        after: {
          named: afterStats.named,
          unnamed: afterStats.unnamed,
          coverageRate: parseFloat(((afterStats.named / afterStats.total) * 100).toFixed(1)),
        },
        enriched: matchCount,
        bySource: {
          osm: afterStats.bySource.osm || 0,
          municipal: afterStats.bySource.municipal || 0,
          manual: afterStats.bySource.manual || 0,
        },
        byConfidence: {
          high: confidenceResult.rows.find((r) => r.confidence === 'high')?.count || 0,
          medium: confidenceResult.rows.find((r) => r.confidence === 'medium')?.count || 0,
          low: confidenceResult.rows.find((r) => r.confidence === 'low')?.count || 0,
        },
        byWard: afterStats.byWard,
      },
    };

    const reportPath = join(SAMPLE_DATA_DIR, 'enrichment-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nReport saved to: ${reportPath}`);

    // Print summary
    console.log('\n=== Summary ===');
    console.log(`Before: ${beforeStats.named}/${beforeStats.total} named (${report.summary.before.coverageRate}%)`);
    console.log(`After:  ${afterStats.named}/${afterStats.total} named (${report.summary.after.coverageRate}%)`);
    console.log(`Enriched: ${matchCount} roads`);
    console.log(`Improvement: +${(report.summary.after.coverageRate - report.summary.before.coverageRate).toFixed(1)}%`);

    if (DRY_RUN) {
      console.log('\n[DRY RUN] No changes were made. Run without DRY_RUN=true to apply changes.');
    } else {
      console.log('\nNext steps:');
      console.log('1. Review low-confidence matches: sample-data/low-confidence-roads.csv');
      console.log('2. Export GeoJSON: npx tsx scripts/export-road-assets.ts');
      console.log('3. Regenerate tiles: npm run tiles:generate');
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

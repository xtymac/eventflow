/**
 * Validate Import Script
 *
 * Automated validation of imported road assets after database seeding.
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/nagoya_construction';

interface ValidationResult {
  passed: string[];
  failed: string[];
  warnings: string[];
}

/**
 * Main validation function
 */
async function validateImport(): Promise<ValidationResult> {
  console.log('=== Road Asset Import Validation ===\n');

  const results: ValidationResult = {
    passed: [],
    failed: [],
    warnings: [],
  };

  const client = new pg.Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // 1. Check total asset count
    console.log('1. Checking total asset count...');
    const countResult = await client.query('SELECT count(*)::int as count FROM road_assets');
    const totalCount = countResult.rows[0].count;

    if (totalCount === 0) {
      results.failed.push('No road assets found in database');
      console.log('   [FAIL] No road assets found');
    } else {
      results.passed.push(`Total asset count: ${totalCount}`);
      console.log(`   [OK] Total assets: ${totalCount}`);
    }

    // 2. Check assets per ward
    console.log('\n2. Checking assets per ward...');
    const wardCountResult = await client.query(`
      SELECT ward, count(*)::int as count
      FROM road_assets
      WHERE ward IS NOT NULL
      GROUP BY ward
      ORDER BY ward
    `);

    if (wardCountResult.rows.length === 0) {
      results.warnings.push('No ward data found - all assets have NULL ward');
      console.log('   [WARN] No ward data found');
    } else {
      for (const row of wardCountResult.rows) {
        console.log(`   ${row.ward}: ${row.count} assets`);
      }
      results.passed.push(`Ward distribution: ${wardCountResult.rows.map((r) => `${r.ward}=${r.count}`).join(', ')}`);
    }

    // Check for expected wards (all 16 wards of Nagoya)
    const expectedWards = [
      'Naka-ku', 'Nakamura-ku', 'Higashi-ku', 'Kita-ku', 'Nishi-ku',
      'Chikusa-ku', 'Showa-ku', 'Mizuho-ku', 'Atsuta-ku', 'Nakagawa-ku',
      'Minato-ku', 'Minami-ku', 'Moriyama-ku', 'Midori-ku', 'Meito-ku', 'Tempaku-ku'
    ];
    const foundWards = wardCountResult.rows.map((r) => r.ward);
    for (const ward of expectedWards) {
      if (!foundWards.includes(ward)) {
        results.warnings.push(`Expected ward "${ward}" not found`);
        console.log(`   [WARN] Expected ward "${ward}" not found`);
      }
    }

    // 3. Validate ID format
    console.log('\n3. Validating ID format (RA-<WARD>-<SEQ>)...');
    const invalidIdResult = await client.query(`
      SELECT id FROM road_assets
      WHERE id !~ '^RA-(NAKA|NKMR|HIGA|KITA|NISH|CHIK|SHOW|MIZH|ATSU|NKGW|MINA|MNMI|MORY|MIDR|MEIT|TEMP)-[0-9]+$'
      LIMIT 10
    `);

    if (invalidIdResult.rows.length > 0) {
      const invalidIds = invalidIdResult.rows.map((r) => r.id);
      results.warnings.push(`Found ${invalidIdResult.rows.length} assets with non-standard IDs: ${invalidIds.join(', ')}`);
      console.log(`   [WARN] Found non-standard IDs: ${invalidIds.slice(0, 5).join(', ')}${invalidIds.length > 5 ? '...' : ''}`);
    } else {
      results.passed.push('All IDs follow RA-<WARD>-<SEQ> format');
      console.log('   [OK] All IDs follow expected format');
    }

    // 4. Check geometry validity
    console.log('\n4. Checking geometry validity...');
    const invalidGeomResult = await client.query(`
      SELECT id FROM road_assets
      WHERE NOT ST_IsValid(geometry)
      LIMIT 10
    `);

    if (invalidGeomResult.rows.length > 0) {
      results.failed.push(`Found ${invalidGeomResult.rows.length} assets with invalid geometries`);
      console.log(`   [FAIL] ${invalidGeomResult.rows.length} invalid geometries found`);
    } else {
      results.passed.push('All geometries are valid');
      console.log('   [OK] All geometries are valid');
    }

    // 5. Check for NULL geometries
    console.log('\n5. Checking for NULL geometries...');
    const nullGeomResult = await client.query(`
      SELECT count(*)::int as count FROM road_assets
      WHERE geometry IS NULL
    `);

    if (nullGeomResult.rows[0].count > 0) {
      results.failed.push(`${nullGeomResult.rows[0].count} assets have NULL geometry`);
      console.log(`   [FAIL] ${nullGeomResult.rows[0].count} NULL geometries`);
    } else {
      results.passed.push('No NULL geometries');
      console.log('   [OK] No NULL geometries');
    }

    // 6. Check for duplicate IDs
    console.log('\n6. Checking for duplicate IDs...');
    const duplicateResult = await client.query(`
      SELECT id, count(*)::int as count
      FROM road_assets
      GROUP BY id
      HAVING count(*) > 1
    `);

    if (duplicateResult.rows.length > 0) {
      results.failed.push(`Found ${duplicateResult.rows.length} duplicate IDs`);
      console.log(`   [FAIL] Found duplicate IDs: ${duplicateResult.rows.map((r) => r.id).join(', ')}`);
    } else {
      results.passed.push('No duplicate IDs');
      console.log('   [OK] No duplicate IDs');
    }

    // 7. Check road type distribution
    console.log('\n7. Checking road type distribution...');
    const typeDistResult = await client.query(`
      SELECT road_type, count(*)::int as count
      FROM road_assets
      GROUP BY road_type
      ORDER BY count DESC
    `);

    for (const row of typeDistResult.rows) {
      console.log(`   ${row.road_type}: ${row.count} assets`);
    }
    results.passed.push(`Road type distribution: ${typeDistResult.rows.map((r) => `${r.road_type}=${r.count}`).join(', ')}`);

    // 8. Check status distribution
    console.log('\n8. Checking status distribution...');
    const statusDistResult = await client.query(`
      SELECT status, count(*)::int as count
      FROM road_assets
      GROUP BY status
      ORDER BY count DESC
    `);

    for (const row of statusDistResult.rows) {
      console.log(`   ${row.status}: ${row.count} assets`);
    }
    results.passed.push(`Status distribution: ${statusDistResult.rows.map((r) => `${r.status}=${r.count}`).join(', ')}`);

    // 9. Check geometry types
    console.log('\n9. Checking geometry types...');
    const geomTypeResult = await client.query(`
      SELECT ST_GeometryType(geometry) as geom_type, count(*)::int as count
      FROM road_assets
      GROUP BY ST_GeometryType(geometry)
    `);

    for (const row of geomTypeResult.rows) {
      console.log(`   ${row.geom_type}: ${row.count} assets`);
    }

    const expectedType = 'ST_LineString';
    const hasNonLineString = geomTypeResult.rows.some((r) => r.geom_type !== expectedType);
    if (hasNonLineString) {
      results.warnings.push('Found non-LineString geometries');
      console.log('   [WARN] Expected only LineString geometries');
    } else {
      results.passed.push('All geometries are LineString');
    }

    // 10. Check for very short segments
    console.log('\n10. Checking for very short segments (<5m)...');
    const shortSegmentResult = await client.query(`
      SELECT count(*)::int as count
      FROM road_assets
      WHERE ST_Length(geometry::geography) < 5
    `);

    if (shortSegmentResult.rows[0].count > 0) {
      results.warnings.push(`${shortSegmentResult.rows[0].count} segments shorter than 5m`);
      console.log(`   [WARN] ${shortSegmentResult.rows[0].count} very short segments`);
    } else {
      results.passed.push('No very short segments');
      console.log('   [OK] No very short segments');
    }

    // 11. Check source GeoJSON matches (if exists)
    console.log('\n11. Comparing with source GeoJSON...');
    const sourceFile = join(__dirname, '../sample-data/road_assets.geojson');
    if (existsSync(sourceFile)) {
      const content = readFileSync(sourceFile, 'utf-8');
      const geojson = JSON.parse(content);
      const sourceCount = geojson.features?.length || 0;

      if (sourceCount !== totalCount) {
        results.warnings.push(`Source GeoJSON has ${sourceCount} features but DB has ${totalCount}`);
        console.log(`   [WARN] Source: ${sourceCount}, DB: ${totalCount}`);
      } else {
        results.passed.push(`DB count matches source GeoJSON (${sourceCount})`);
        console.log(`   [OK] Counts match: ${sourceCount}`);
      }
    } else {
      console.log('   [SKIP] Source GeoJSON not found');
    }

    // --- Spatial Checks (requires PostGIS) ---
    console.log('\n--- Spatial Checks (requires PostGIS) ---');
    const postgisCheck = await client.query(`
      SELECT 1 FROM pg_extension WHERE extname = 'postgis'
    `);
    if (postgisCheck.rows.length === 0) {
      console.log('[SKIP] PostGIS extension not installed, skipping spatial checks');
    } else {
      // 12. Check BBOX spatial query performance
      console.log('\n12. Testing BBOX spatial query...');
      const bboxStart = Date.now();
      const bboxResult = await client.query(`
        SELECT count(*)::int as count
        FROM road_assets
        WHERE ST_Intersects(geometry, ST_MakeEnvelope(136.88, 35.16, 136.92, 35.20, 4326))
      `);
      const bboxTime = Date.now() - bboxStart;
      console.log(`   Query returned ${bboxResult.rows[0].count} assets in ${bboxTime}ms`);
      if (bboxTime > 1000) {
        results.warnings.push(`BBOX query slow: ${bboxTime}ms (expected <1000ms)`);
        console.log('   [WARN] Query slower than expected');
      } else {
        results.passed.push(`BBOX query fast: ${bboxTime}ms`);
        console.log('   [OK] Query performance acceptable');
      }

      // 13. Verify GIST index exists
      console.log('\n13. Checking GIST index on road_assets.geometry...');
      const indexResult = await client.query(`
        SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'road_assets'
          AND indexdef LIKE '%gist%'
          AND indexdef LIKE '%geometry%'
      `);
      if (indexResult.rows.length === 0) {
        results.failed.push('GIST index on geometry not found');
        console.log('   [FAIL] No GIST index found');
      } else {
        results.passed.push(`GIST index found: ${indexResult.rows[0].indexname}`);
        console.log(`   [OK] Index: ${indexResult.rows[0].indexname}`);
      }

      // 14. Check SRID consistency (should all be 4326)
      console.log('\n14. Checking SRID consistency...');
      const sridResult = await client.query(`
        SELECT DISTINCT ST_SRID(geometry) as srid
        FROM road_assets
        WHERE geometry IS NOT NULL
      `);
      const srids = sridResult.rows.map((r: { srid: number }) => r.srid);
      if (srids.length === 0) {
        console.log('   [SKIP] No geometries to check SRID');
      } else if (srids.length === 1 && srids[0] === 4326) {
        results.passed.push('All geometries have SRID 4326');
        console.log('   [OK] All geometries use SRID 4326');
      } else {
        results.failed.push(`Inconsistent SRIDs found: ${srids.join(', ')}`);
        console.log(`   [FAIL] SRIDs: ${srids.join(', ')} (expected only 4326)`);
      }

      // 15. Test buffer operation (used for event geometry generation)
      console.log('\n15. Testing buffer operation...');
      if (totalCount === 0) {
        console.log('   [SKIP] No assets to test buffer on');
      } else {
        const bufferResult = await client.query(`
          SELECT ST_AsGeoJSON(
            ST_Buffer(
              (SELECT geometry FROM road_assets WHERE geometry IS NOT NULL LIMIT 1)::geography,
              15
            )::geometry
          ) as buffered
        `);
        if (bufferResult.rows[0]?.buffered) {
          results.passed.push('Buffer operation works correctly');
          console.log('   [OK] Buffer operation successful');
        } else {
          results.failed.push('Buffer operation returned null');
          console.log('   [FAIL] Buffer operation failed');
        }
      }
    } // end PostGIS check

  } catch (error) {
    results.failed.push(`Database error: ${error}`);
    console.error(`\nDatabase error: ${error}`);
  } finally {
    await client.end();
  }

  return results;
}

/**
 * Print validation report
 */
function printReport(results: ValidationResult) {
  console.log('\n' + '='.repeat(50));
  console.log('VALIDATION REPORT');
  console.log('='.repeat(50));

  console.log(`\nPASSED (${results.passed.length}):`);
  results.passed.forEach((p) => console.log(`  [OK] ${p}`));

  if (results.warnings.length > 0) {
    console.log(`\nWARNINGS (${results.warnings.length}):`);
    results.warnings.forEach((w) => console.log(`  [WARN] ${w}`));
  }

  if (results.failed.length > 0) {
    console.log(`\nFAILED (${results.failed.length}):`);
    results.failed.forEach((f) => console.log(`  [FAIL] ${f}`));
  }

  console.log('\n' + '='.repeat(50));
  if (results.failed.length === 0) {
    console.log('RESULT: VALIDATION PASSED');
    if (results.warnings.length > 0) {
      console.log(`  (with ${results.warnings.length} warnings)`);
    }
  } else {
    console.log('RESULT: VALIDATION FAILED');
    console.log(`  ${results.failed.length} checks failed`);
  }
  console.log('='.repeat(50));
}

/**
 * Main entry point
 */
async function main() {
  const results = await validateImport();
  printReport(results);

  // Exit with error code if validation failed
  if (results.failed.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

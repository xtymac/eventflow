/**
 * Prepare Seed Data Script
 *
 * Combines segmented ward road data into the final road_assets.geojson file
 * that can be seeded into the database.
 */

import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { Feature, FeatureCollection, LineString } from 'geojson';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface WardConfig {
  englishName: string;
  fileName: string;
}

const WARDS: WardConfig[] = [
  // 現有
  { englishName: 'Naka-ku', fileName: 'naka-ku-segments.geojson' },
  { englishName: 'Nakamura-ku', fileName: 'nakamura-ku-segments.geojson' },
  // 新増 14 区
  { englishName: 'Higashi-ku', fileName: 'higashi-ku-segments.geojson' },
  { englishName: 'Kita-ku', fileName: 'kita-ku-segments.geojson' },
  { englishName: 'Nishi-ku', fileName: 'nishi-ku-segments.geojson' },
  { englishName: 'Chikusa-ku', fileName: 'chikusa-ku-segments.geojson' },
  { englishName: 'Showa-ku', fileName: 'showa-ku-segments.geojson' },
  { englishName: 'Mizuho-ku', fileName: 'mizuho-ku-segments.geojson' },
  { englishName: 'Atsuta-ku', fileName: 'atsuta-ku-segments.geojson' },
  { englishName: 'Nakagawa-ku', fileName: 'nakagawa-ku-segments.geojson' },
  { englishName: 'Minato-ku', fileName: 'minato-ku-segments.geojson' },
  { englishName: 'Minami-ku', fileName: 'minami-ku-segments.geojson' },
  { englishName: 'Moriyama-ku', fileName: 'moriyama-ku-segments.geojson' },
  { englishName: 'Midori-ku', fileName: 'midori-ku-segments.geojson' },
  { englishName: 'Meito-ku', fileName: 'meito-ku-segments.geojson' },
  { englishName: 'Tempaku-ku', fileName: 'tempaku-ku-segments.geojson' },
];

/**
 * Load segmented roads from a ward file
 */
function loadWardSegments(wardConfig: WardConfig): Feature<LineString>[] {
  const inputPath = join(__dirname, '../sample-data/segmented-roads', wardConfig.fileName);

  if (!existsSync(inputPath)) {
    console.warn(`  Segment file not found: ${inputPath}`);
    return [];
  }

  const content = readFileSync(inputPath, 'utf-8');
  const collection = JSON.parse(content) as FeatureCollection;

  return collection.features.filter(
    (f): f is Feature<LineString> => f.geometry.type === 'LineString'
  );
}

/**
 * Validate and normalize segment properties
 */
function normalizeSegment(segment: Feature<LineString>): Feature<LineString> {
  const props = segment.properties || {};

  return {
    type: 'Feature',
    properties: {
      id: props.id,
      name: props.name || 'Unnamed Road',
      roadType: props.roadType || 'local',
      lanes: props.lanes || 2,
      direction: props.direction || 'two-way',
      status: props.status || 'active',
      validFrom: props.validFrom || new Date().toISOString().split('T')[0],
      validTo: props.validTo || null,
      ownerDepartment: props.ownerDepartment || 'Road Maintenance Division',
      ward: props.ward,
      landmark: props.landmark || null,
    },
    geometry: segment.geometry,
  };
}

/**
 * Main function
 */
async function main() {
  console.log('=== Prepare Seed Data ===\n');

  const sampleDataDir = join(__dirname, '../sample-data');
  const outputPath = join(sampleDataDir, 'road_assets.geojson');

  // Backup existing file if it exists
  if (existsSync(outputPath)) {
    const backupPath = join(sampleDataDir, 'road_assets_backup.geojson');
    copyFileSync(outputPath, backupPath);
    console.log(`Backed up existing road_assets.geojson to road_assets_backup.geojson`);
  }

  // Load and combine segments from all wards
  const allSegments: Feature<LineString>[] = [];

  for (const ward of WARDS) {
    console.log(`Loading ${ward.englishName}...`);
    const segments = loadWardSegments(ward);
    console.log(`  Loaded ${segments.length} segments`);
    allSegments.push(...segments);
  }

  if (allSegments.length === 0) {
    console.error('\nNo segments found. Run fetch and segmentation scripts first.');
    process.exit(1);
  }

  // Normalize all segments
  console.log(`\nNormalizing ${allSegments.length} segments...`);
  const normalizedSegments = allSegments.map(normalizeSegment);

  // Validate unique IDs
  const ids = new Set<string>();
  const duplicates: string[] = [];

  for (const segment of normalizedSegments) {
    const id = segment.properties?.id;
    if (id) {
      if (ids.has(id)) {
        duplicates.push(id);
      } else {
        ids.add(id);
      }
    }
  }

  if (duplicates.length > 0) {
    console.warn(`\nWarning: Found ${duplicates.length} duplicate IDs:`);
    duplicates.slice(0, 10).forEach((id) => console.warn(`  - ${id}`));
    if (duplicates.length > 10) {
      console.warn(`  ... and ${duplicates.length - 10} more`);
    }
  }

  // Create final GeoJSON
  const finalCollection: FeatureCollection = {
    type: 'FeatureCollection',
    features: normalizedSegments,
  };

  // Write output
  writeFileSync(outputPath, JSON.stringify(finalCollection, null, 2));
  console.log(`\nSaved ${normalizedSegments.length} road assets to: ${outputPath}`);

  // Print summary statistics
  console.log('\n=== Summary ===');
  console.log(`Total road assets: ${normalizedSegments.length}`);

  // Count by ward
  const wardCounts = new Map<string, number>();
  for (const segment of normalizedSegments) {
    const ward = segment.properties?.ward || 'Unknown';
    wardCounts.set(ward, (wardCounts.get(ward) || 0) + 1);
  }
  console.log('\nBy ward:');
  for (const [ward, count] of wardCounts) {
    console.log(`  ${ward}: ${count}`);
  }

  // Count by road type
  const typeCounts = new Map<string, number>();
  for (const segment of normalizedSegments) {
    const type = segment.properties?.roadType || 'unknown';
    typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
  }
  console.log('\nBy road type:');
  for (const [type, count] of typeCounts) {
    console.log(`  ${type}: ${count}`);
  }

  console.log('\n=== Next Steps ===');
  console.log('1. Optionally run road matching: npm run match-roads');
  console.log('2. Seed database: npm run db:seed');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

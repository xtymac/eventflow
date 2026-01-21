/**
 * Import PLATEAU roads via the API in batches
 */

import * as fs from 'fs';
import * as path from 'path';

const INPUT_FILE = path.join(__dirname, '../sample-data/plateau/nagoya-roads-transformed.geojson');
const API_BASE = process.env.API_URL || 'http://localhost:3000';
const BATCH_SIZE = 500;

interface GeoJSONFeature {
  type: 'Feature';
  properties: Record<string, any>;
  geometry: {
    type: string;
    coordinates: any;
  };
}

interface FeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

async function importBatch(features: GeoJSONFeature[], batchNum: number): Promise<{ imported: number; failed: number }> {
  // Map 'two-way' to 'both' for direction field
  const mappedFeatures = features.map(f => ({
    ...f,
    properties: {
      ...f.properties,
      direction: f.properties.direction === 'two-way' ? 'both' : f.properties.direction,
    },
  }));

  const body: FeatureCollection = {
    type: 'FeatureCollection',
    features: mappedFeatures,
  };

  try {
    const response = await fetch(`${API_BASE}/import/geojson?type=assets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Batch ${batchNum} failed: ${response.status} ${text.substring(0, 200)}`);
      return { imported: 0, failed: features.length };
    }

    const result = await response.json() as { imported: number; failed: number; errors: string[] };
    if (result.errors.length > 0) {
      console.error(`Batch ${batchNum} errors:`, result.errors.slice(0, 3));
    }
    return { imported: result.imported, failed: result.failed };
  } catch (err) {
    console.error(`Batch ${batchNum} error:`, err);
    return { imported: 0, failed: features.length };
  }
}

async function main() {
  console.log('Reading input file...');
  const inputData: FeatureCollection = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  console.log(`Total features: ${inputData.features.length}`);
  console.log(`API URL: ${API_BASE}`);

  const totalBatches = Math.ceil(inputData.features.length / BATCH_SIZE);
  console.log(`Batches: ${totalBatches} (${BATCH_SIZE} features each)`);

  let totalImported = 0;
  let totalFailed = 0;

  for (let i = 0; i < totalBatches; i++) {
    const start = i * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, inputData.features.length);
    const batch = inputData.features.slice(start, end);

    const result = await importBatch(batch, i + 1);
    totalImported += result.imported;
    totalFailed += result.failed;

    console.log(`Batch ${i + 1}/${totalBatches}: imported ${result.imported}, failed ${result.failed} (total: ${totalImported}/${totalImported + totalFailed})`);

    // Small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\nImport complete:`);
  console.log(`- Total imported: ${totalImported}`);
  console.log(`- Total failed: ${totalFailed}`);
}

main().catch(console.error);

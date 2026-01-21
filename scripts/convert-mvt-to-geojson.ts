/**
 * Convert PLATEAU MVT road tiles to GeoJSON
 * MVT tiles use Web Mercator projection with z/x/y tile coordinates
 */

import * as fs from 'fs';
import * as path from 'path';
import Protobuf from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';

const PLATEAU_ROAD_DIR = path.join(
  __dirname,
  '../sample-data/plateau/extracted/23100_nagoya-shi_2020_3Dtiles_etc_1_op/03_road/23100_nagoya-shi_2020_tran'
);

const OUTPUT_FILE = path.join(__dirname, '../sample-data/plateau/nagoya-roads.geojson');

// Convert tile coordinates to lon/lat
// Formula: https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
function tile2lon(x: number, z: number): number {
  return (x / Math.pow(2, z)) * 360 - 180;
}

function tile2lat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

// Convert extent-relative coordinates to lon/lat
function convertCoord(
  x: number,
  y: number,
  extent: number,
  tileX: number,
  tileY: number,
  tileZ: number
): [number, number] {
  const lon = tile2lon(tileX + x / extent, tileZ);
  const lat = tile2lat(tileY + y / extent, tileZ);
  return [lon, lat];
}

// Parse tile path to get z/x/y
function parseTilePath(filePath: string): { z: number; x: number; y: number } | null {
  const match = filePath.match(/\/(\d+)\/(\d+)\/(\d+)\.mvt$/);
  if (!match) return null;
  return {
    z: parseInt(match[1]),
    x: parseInt(match[2]),
    y: parseInt(match[3]),
  };
}

// Find all MVT files recursively
function findMvtFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.mvt')) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

// Convert ring coordinates
function convertRing(
  ring: { x: number; y: number }[],
  extent: number,
  tileX: number,
  tileY: number,
  tileZ: number
): [number, number][] {
  return ring.map((pt) => convertCoord(pt.x, pt.y, extent, tileX, tileY, tileZ));
}

// Convert geometry based on type
function convertGeometry(
  geom: any,
  extent: number,
  tileX: number,
  tileY: number,
  tileZ: number
): GeoJSON.Geometry | null {
  const type = geom.type;

  if (type === 1) {
    // Point
    const coords = geom.loadGeometry()[0][0];
    return {
      type: 'Point',
      coordinates: convertCoord(coords.x, coords.y, extent, tileX, tileY, tileZ),
    };
  } else if (type === 2) {
    // LineString or MultiLineString
    const lines = geom.loadGeometry();
    if (lines.length === 1) {
      return {
        type: 'LineString',
        coordinates: convertRing(lines[0], extent, tileX, tileY, tileZ),
      };
    } else {
      return {
        type: 'MultiLineString',
        coordinates: lines.map((line: { x: number; y: number }[]) =>
          convertRing(line, extent, tileX, tileY, tileZ)
        ),
      };
    }
  } else if (type === 3) {
    // Polygon or MultiPolygon
    const rings = geom.loadGeometry();
    // Simple case: single polygon
    if (rings.length === 1) {
      return {
        type: 'Polygon',
        coordinates: [convertRing(rings[0], extent, tileX, tileY, tileZ)],
      };
    }
    // Check if multiple polygons or polygon with holes
    // For simplicity, treat each ring as outer ring of separate polygon
    return {
      type: 'MultiPolygon',
      coordinates: rings.map((ring: { x: number; y: number }[]) => [
        convertRing(ring, extent, tileX, tileY, tileZ),
      ]),
    };
  }

  return null;
}

async function main() {
  console.log('Finding MVT files...');
  const mvtFiles = findMvtFiles(PLATEAU_ROAD_DIR);
  console.log(`Found ${mvtFiles.length} MVT files`);

  // Use highest zoom level tiles only (most detailed)
  const highZoomFiles = mvtFiles.filter((f) => {
    const tile = parseTilePath(f);
    return tile && tile.z === 15; // Max zoom for this dataset
  });
  console.log(`Using ${highZoomFiles.length} zoom level 15 tiles`);

  const features: GeoJSON.Feature[] = [];
  let processedCount = 0;
  let featureCount = 0;

  for (const file of highZoomFiles) {
    const tileInfo = parseTilePath(file);
    if (!tileInfo) continue;

    const { z, x, y } = tileInfo;
    const data = fs.readFileSync(file);
    const pbf = new Protobuf(data);
    const tile = new VectorTile(pbf);

    // Get the road layer
    const roadLayer = tile.layers['road'];
    if (!roadLayer) continue;

    for (let i = 0; i < roadLayer.length; i++) {
      const feature = roadLayer.feature(i);
      const geometry = convertGeometry(feature, roadLayer.extent, x, y, z);

      if (geometry) {
        features.push({
          type: 'Feature',
          properties: {
            // PLATEAU MVT has no attributes, but we can add metadata
            source: 'plateau',
            sourceVersion: 'nagoya_2020',
            dataSource: 'official_ledger',
          },
          geometry,
        });
        featureCount++;
      }
    }

    processedCount++;
    if (processedCount % 100 === 0) {
      console.log(`Processed ${processedCount}/${highZoomFiles.length} tiles, ${featureCount} features`);
    }
  }

  console.log(`\nTotal features: ${featureCount}`);

  const geojson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features,
  };

  console.log('Writing GeoJSON file...');
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(geojson));
  console.log(`Output: ${OUTPUT_FILE}`);

  // Also create a sample file with first 100 features for testing
  const sampleGeojson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: features.slice(0, 100),
  };
  const sampleFile = OUTPUT_FILE.replace('.geojson', '-sample.geojson');
  fs.writeFileSync(sampleFile, JSON.stringify(sampleGeojson, null, 2));
  console.log(`Sample file (100 features): ${sampleFile}`);
}

main().catch(console.error);

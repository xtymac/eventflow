/**
 * Transform PLATEAU road polygons to our schema format
 * Converts polygons to LineString centerlines and adds required fields
 */

import * as fs from 'fs';
import * as path from 'path';
import * as turf from '@turf/turf';

const INPUT_FILE = path.join(__dirname, '../sample-data/plateau/nagoya-roads.geojson');
const OUTPUT_FILE = path.join(__dirname, '../sample-data/plateau/nagoya-roads-transformed.geojson');

interface RoadFeature {
  type: 'Feature';
  properties: {
    name?: string;
    roadType: 'arterial' | 'collector' | 'local';
    lanes: number;
    direction: 'one-way' | 'two-way';
    dataSource: 'official_ledger';
    sourceVersion: string;
  };
  geometry: GeoJSON.LineString;
}

/**
 * Convert a polygon to its centerline
 * For road polygons, we extract the "spine" by finding the longest axis
 */
function polygonToCenterline(polygon: GeoJSON.Polygon): GeoJSON.LineString | null {
  const coords = polygon.coordinates[0];
  if (coords.length < 4) return null;

  // For road polygons, compute the centerline by finding midpoints along the road
  // We assume the polygon is a long narrow road segment

  // Method: Find the two longest edges and compute midpoints between opposite pairs
  const edges: { start: number[]; end: number[]; length: number; idx: number }[] = [];

  for (let i = 0; i < coords.length - 1; i++) {
    const start = coords[i];
    const end = coords[i + 1];
    const length = turf.distance(turf.point(start), turf.point(end));
    edges.push({ start, end, length, idx: i });
  }

  // Sort edges by length
  edges.sort((a, b) => b.length - a.length);

  // If the polygon is a simple quad or similar, just use the midpoints of opposite sides
  if (coords.length <= 6) {
    // Simple case: take first and third edge (opposite sides) midpoints
    const midpoint1 = [
      (coords[0][0] + coords[1][0]) / 2,
      (coords[0][1] + coords[1][1]) / 2,
    ];
    const midpoint2 = [
      (coords[2][0] + coords[3][0]) / 2,
      (coords[2][1] + coords[3][1]) / 2,
    ];
    return {
      type: 'LineString',
      coordinates: [midpoint1, midpoint2],
    };
  }

  // For more complex polygons, use turf's centerOfMass approach
  // Create a line from the centroid extended along the longest axis
  const centroid = turf.centroid(turf.polygon(polygon.coordinates));
  const bbox = turf.bbox(turf.polygon(polygon.coordinates));
  const width = bbox[2] - bbox[0];
  const height = bbox[3] - bbox[1];

  // Determine if the road runs more E-W or N-S
  const isHorizontal = width > height;

  if (isHorizontal) {
    // Create a horizontal line through centroid
    return {
      type: 'LineString',
      coordinates: [
        [bbox[0], centroid.geometry.coordinates[1]],
        [bbox[2], centroid.geometry.coordinates[1]],
      ],
    };
  } else {
    // Create a vertical line through centroid
    return {
      type: 'LineString',
      coordinates: [
        [centroid.geometry.coordinates[0], bbox[1]],
        [centroid.geometry.coordinates[0], bbox[3]],
      ],
    };
  }
}

/**
 * Multi-polygon to multiple LineStrings
 */
function multiPolygonToLineStrings(multiPolygon: GeoJSON.MultiPolygon): GeoJSON.LineString[] {
  const lineStrings: GeoJSON.LineString[] = [];
  for (const polygon of multiPolygon.coordinates) {
    const centerline = polygonToCenterline({ type: 'Polygon', coordinates: polygon });
    if (centerline) {
      lineStrings.push(centerline);
    }
  }
  return lineStrings;
}

/**
 * Estimate road type based on road width
 */
function estimateRoadType(polygon: GeoJSON.Polygon): 'arterial' | 'collector' | 'local' {
  const area = turf.area(turf.polygon(polygon.coordinates));
  const bbox = turf.bbox(turf.polygon(polygon.coordinates));
  const width = Math.min(bbox[2] - bbox[0], bbox[3] - bbox[1]) * 111000; // Rough conversion to meters

  // Estimate based on approximate width
  if (width > 15) return 'arterial';
  if (width > 8) return 'collector';
  return 'local';
}

async function main() {
  console.log('Reading input file...');
  const inputData: GeoJSON.FeatureCollection = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  console.log(`Input features: ${inputData.features.length}`);

  const outputFeatures: RoadFeature[] = [];
  let skipped = 0;
  let converted = 0;

  for (const feature of inputData.features) {
    try {
      if (feature.geometry.type === 'Polygon') {
        const centerline = polygonToCenterline(feature.geometry);
        if (centerline && centerline.coordinates.length >= 2) {
          outputFeatures.push({
            type: 'Feature',
            properties: {
              roadType: estimateRoadType(feature.geometry),
              lanes: 2,
              direction: 'two-way',
              dataSource: 'official_ledger',
              sourceVersion: 'plateau_nagoya_2020',
            },
            geometry: centerline,
          });
          converted++;
        } else {
          skipped++;
        }
      } else if (feature.geometry.type === 'MultiPolygon') {
        const lineStrings = multiPolygonToLineStrings(feature.geometry);
        for (const ls of lineStrings) {
          if (ls.coordinates.length >= 2) {
            outputFeatures.push({
              type: 'Feature',
              properties: {
                roadType: 'local',
                lanes: 2,
                direction: 'two-way',
                dataSource: 'official_ledger',
                sourceVersion: 'plateau_nagoya_2020',
              },
              geometry: ls,
            });
            converted++;
          }
        }
      } else if (feature.geometry.type === 'LineString') {
        // Already a LineString, just add properties
        outputFeatures.push({
          type: 'Feature',
          properties: {
            roadType: 'local',
            lanes: 2,
            direction: 'two-way',
            dataSource: 'official_ledger',
            sourceVersion: 'plateau_nagoya_2020',
          },
          geometry: feature.geometry,
        });
        converted++;
      } else {
        skipped++;
      }
    } catch (e) {
      skipped++;
    }

    if ((converted + skipped) % 10000 === 0) {
      console.log(`Progress: ${converted + skipped}/${inputData.features.length} (converted: ${converted}, skipped: ${skipped})`);
    }
  }

  console.log(`\nConversion complete:`);
  console.log(`- Converted: ${converted}`);
  console.log(`- Skipped: ${skipped}`);
  console.log(`- Output features: ${outputFeatures.length}`);

  const outputData: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: outputFeatures as any[],
  };

  console.log('\nWriting output file...');
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(outputData));
  console.log(`Output: ${OUTPUT_FILE}`);

  // Create sample file
  const sampleData: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: outputFeatures.slice(0, 100) as any[],
  };
  const sampleFile = OUTPUT_FILE.replace('.geojson', '-sample.geojson');
  fs.writeFileSync(sampleFile, JSON.stringify(sampleData, null, 2));
  console.log(`Sample: ${sampleFile}`);
}

main().catch(console.error);

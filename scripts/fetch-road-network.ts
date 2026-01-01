/**
 * Fetch Road Network Script
 *
 * Queries Overpass API for all paved roads within ward boundaries,
 * clips them to ward polygons, and normalizes attributes.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type {
  Feature,
  FeatureCollection,
  LineString,
  MultiLineString,
  Polygon,
  MultiPolygon,
  Position,
} from 'geojson';
import * as turf from '@turf/turf';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

interface WardConfig {
  englishName: string;
  fileName: string;
  outputFileName: string;
}

const WARDS: WardConfig[] = [
  // 現有
  { englishName: 'Naka-ku', fileName: 'naka-ku.geojson', outputFileName: 'naka-ku-roads.geojson' },
  { englishName: 'Nakamura-ku', fileName: 'nakamura-ku.geojson', outputFileName: 'nakamura-ku-roads.geojson' },
  // 新増 14 区
  { englishName: 'Higashi-ku', fileName: 'higashi-ku.geojson', outputFileName: 'higashi-ku-roads.geojson' },
  { englishName: 'Kita-ku', fileName: 'kita-ku.geojson', outputFileName: 'kita-ku-roads.geojson' },
  { englishName: 'Nishi-ku', fileName: 'nishi-ku.geojson', outputFileName: 'nishi-ku-roads.geojson' },
  { englishName: 'Chikusa-ku', fileName: 'chikusa-ku.geojson', outputFileName: 'chikusa-ku-roads.geojson' },
  { englishName: 'Showa-ku', fileName: 'showa-ku.geojson', outputFileName: 'showa-ku-roads.geojson' },
  { englishName: 'Mizuho-ku', fileName: 'mizuho-ku.geojson', outputFileName: 'mizuho-ku-roads.geojson' },
  { englishName: 'Atsuta-ku', fileName: 'atsuta-ku.geojson', outputFileName: 'atsuta-ku-roads.geojson' },
  { englishName: 'Nakagawa-ku', fileName: 'nakagawa-ku.geojson', outputFileName: 'nakagawa-ku-roads.geojson' },
  { englishName: 'Minato-ku', fileName: 'minato-ku.geojson', outputFileName: 'minato-ku-roads.geojson' },
  { englishName: 'Minami-ku', fileName: 'minami-ku.geojson', outputFileName: 'minami-ku-roads.geojson' },
  { englishName: 'Moriyama-ku', fileName: 'moriyama-ku.geojson', outputFileName: 'moriyama-ku-roads.geojson' },
  { englishName: 'Midori-ku', fileName: 'midori-ku.geojson', outputFileName: 'midori-ku-roads.geojson' },
  { englishName: 'Meito-ku', fileName: 'meito-ku.geojson', outputFileName: 'meito-ku-roads.geojson' },
  { englishName: 'Tempaku-ku', fileName: 'tempaku-ku.geojson', outputFileName: 'tempaku-ku-roads.geojson' },
];

// OSM highway types to include
const HIGHWAY_TYPES = [
  'primary',
  'primary_link',
  'secondary',
  'secondary_link',
  'tertiary',
  'tertiary_link',
  'residential',
  'unclassified',
  'living_street',
  'service',
];

// Mapping from OSM highway to our roadType
const ROAD_TYPE_MAP: Record<string, string> = {
  primary: 'arterial',
  primary_link: 'arterial',
  secondary: 'arterial',
  secondary_link: 'arterial',
  tertiary: 'collector',
  tertiary_link: 'collector',
  residential: 'local',
  unclassified: 'local',
  living_street: 'local',
  service: 'local',
};

/**
 * Delay helper for rate limiting
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Query Overpass API with retry
 */
async function queryOverpass(query: string, maxRetries = 3): Promise<any> {
  console.log('  Querying Overpass API...');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(OVERPASS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (response.status === 429 || response.status === 504) {
        if (attempt < maxRetries) {
          const waitTime = attempt * 10;
          console.log(`  API returned ${response.status}, retrying in ${waitTime}s (attempt ${attempt}/${maxRetries})...`);
          await delay(waitTime * 1000);
          continue;
        }
      }

      if (!response.ok) {
        throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      if (attempt < maxRetries && String(error).includes('504')) {
        const waitTime = attempt * 10;
        console.log(`  Request failed, retrying in ${waitTime}s (attempt ${attempt}/${maxRetries})...`);
        await delay(waitTime * 1000);
      } else if (attempt === maxRetries) {
        throw error;
      }
    }
  }
}

/**
 * Load ward boundary from GeoJSON file
 */
function loadWardBoundary(wardConfig: WardConfig): Feature<Polygon | MultiPolygon> | null {
  const boundaryPath = join(__dirname, '../sample-data/ward-boundaries', wardConfig.fileName);

  if (!existsSync(boundaryPath)) {
    console.error(`  Boundary file not found: ${boundaryPath}`);
    return null;
  }

  const content = readFileSync(boundaryPath, 'utf-8');
  const collection = JSON.parse(content) as FeatureCollection;

  if (collection.features.length === 0) {
    console.error(`  No features in boundary file: ${boundaryPath}`);
    return null;
  }

  return collection.features[0] as Feature<Polygon | MultiPolygon>;
}

/**
 * Get bounding box string from boundary feature
 */
function getBboxString(boundary: Feature<Polygon | MultiPolygon>): string {
  const bbox = turf.bbox(boundary);
  // Overpass uses: south,west,north,east
  return `${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]}`;
}

/**
 * Convert OSM way to GeoJSON LineString feature
 */
function osmWayToGeoJSON(
  element: any,
  wardName: string
): Feature<LineString> | null {
  if (element.type !== 'way' || !element.geometry || element.geometry.length < 2) {
    return null;
  }

  const coordinates: Position[] = element.geometry.map((node: any) => [node.lon, node.lat]);
  const tags = element.tags || {};

  // Extract road name fields - keep raw values, don't combine
  const name = tags.name || tags['name:en'] || null;  // Raw name, no placeholder
  const name_ja = tags['name:ja'] || null;            // Japanese name
  const ref = tags.ref || null;                       // Route reference (e.g., 国道23号)
  const local_ref = tags.local_ref || null;           // Local reference code

  // Extract lanes
  let lanes = 2;
  if (tags.lanes) {
    const parsed = parseInt(tags.lanes, 10);
    if (!isNaN(parsed) && parsed > 0) {
      lanes = parsed;
    }
  }

  // Extract direction
  let direction = 'two-way';
  if (tags.oneway === 'yes' || tags.oneway === '1' || tags.oneway === 'true') {
    direction = 'one-way';
  }

  // Get road type
  const roadType = ROAD_TYPE_MAP[tags.highway] || 'local';

  return {
    type: 'Feature',
    properties: {
      osmId: element.id,
      name,
      name_ja,      // Japanese name from OSM
      ref,          // Route reference (e.g., 国道23号)
      local_ref,    // Local reference code
      roadType,
      lanes,
      direction,
      ward: wardName,
      osmHighway: tags.highway,
      surface: tags.surface || null,
    },
    geometry: {
      type: 'LineString',
      coordinates,
    },
  };
}

/**
 * Clip road features to ward boundary
 */
function clipRoadsToBoundary(
  roads: Feature<LineString>[],
  boundary: Feature<Polygon | MultiPolygon>
): Feature<LineString>[] {
  console.log(`  Clipping ${roads.length} roads to boundary...`);

  const clipped: Feature<LineString>[] = [];

  for (const road of roads) {
    try {
      // Use turf to clip the line to the polygon
      const clippedGeom = turf.booleanWithin(road, boundary)
        ? road
        : clipLineToPolygon(road, boundary);

      if (clippedGeom) {
        if (clippedGeom.geometry.type === 'LineString') {
          clipped.push(clippedGeom as Feature<LineString>);
        } else if (clippedGeom.geometry.type === 'MultiLineString') {
          // Split MultiLineString into separate LineStrings
          const multi = clippedGeom as Feature<MultiLineString>;
          for (const coords of multi.geometry.coordinates) {
            if (coords.length >= 2) {
              clipped.push({
                ...road,
                geometry: {
                  type: 'LineString',
                  coordinates: coords,
                },
              });
            }
          }
        }
      }
    } catch (error) {
      // Skip roads that fail clipping
      continue;
    }
  }

  console.log(`  Clipped to ${clipped.length} road segments`);
  return clipped;
}

/**
 * Clip a LineString to a Polygon
 */
function clipLineToPolygon(
  line: Feature<LineString>,
  polygon: Feature<Polygon | MultiPolygon>
): Feature<LineString | MultiLineString> | null {
  try {
    // Use lineSplit with polygon boundary
    const polygonBoundary = turf.polygonToLine(polygon);

    // Get intersection points
    const intersectionResult = turf.lineIntersect(line, polygonBoundary as any);

    if (intersectionResult.features.length === 0) {
      // Line doesn't intersect boundary - check if fully inside or outside
      const midpoint = turf.along(line, turf.length(line) / 2);
      if (turf.booleanPointInPolygon(midpoint, polygon)) {
        return line;
      }
      return null;
    }

    // Get segments inside polygon
    const segments: Position[][] = [];
    const coords = line.geometry.coordinates;
    let currentSegment: Position[] = [];
    let lastInside = turf.booleanPointInPolygon(turf.point(coords[0]), polygon);

    if (lastInside) {
      currentSegment.push(coords[0]);
    }

    for (let i = 1; i < coords.length; i++) {
      const isInside = turf.booleanPointInPolygon(turf.point(coords[i]), polygon);

      if (isInside) {
        if (!lastInside) {
          // Entering polygon - find intersection point
          const segmentLine = turf.lineString([coords[i - 1], coords[i]]);
          const intersects = turf.lineIntersect(segmentLine, polygonBoundary as any);
          if (intersects.features.length > 0) {
            currentSegment.push(intersects.features[0].geometry.coordinates);
          }
        }
        currentSegment.push(coords[i]);
      } else {
        if (lastInside) {
          // Exiting polygon - find intersection point
          const segmentLine = turf.lineString([coords[i - 1], coords[i]]);
          const intersects = turf.lineIntersect(segmentLine, polygonBoundary as any);
          if (intersects.features.length > 0) {
            currentSegment.push(intersects.features[0].geometry.coordinates);
          }
          if (currentSegment.length >= 2) {
            segments.push(currentSegment);
          }
          currentSegment = [];
        }
      }

      lastInside = isInside;
    }

    // Save last segment if inside
    if (currentSegment.length >= 2) {
      segments.push(currentSegment);
    }

    if (segments.length === 0) {
      return null;
    }

    if (segments.length === 1) {
      return {
        ...line,
        geometry: {
          type: 'LineString',
          coordinates: segments[0],
        },
      };
    }

    return {
      ...line,
      geometry: {
        type: 'MultiLineString',
        coordinates: segments,
      },
    } as Feature<MultiLineString>;
  } catch (error) {
    return null;
  }
}

/**
 * Fetch roads for a single ward
 */
async function fetchRoadsForWard(wardConfig: WardConfig): Promise<Feature<LineString>[]> {
  console.log(`\nFetching roads for ${wardConfig.englishName}...`);

  // Load ward boundary
  const boundary = loadWardBoundary(wardConfig);
  if (!boundary) {
    return [];
  }

  const bboxString = getBboxString(boundary);
  console.log(`  Bounding box: ${bboxString}`);

  // Build Overpass query
  const highwayFilter = HIGHWAY_TYPES.map((t) => `["highway"="${t}"]`).join('');
  const query = `
[out:json][timeout:120];
(
  way(${bboxString})${highwayFilter.replace(/\]\[/g, '"];\n  way(' + bboxString + ')["')};
);
out geom;
`;

  // Simpler query approach
  const simpleQuery = `
[out:json][timeout:120];
(
  way(${bboxString})["highway"~"^(${HIGHWAY_TYPES.join('|')})$"];
);
out geom;
`;

  try {
    const result = await queryOverpass(simpleQuery);

    if (!result.elements || result.elements.length === 0) {
      console.log(`  No roads found in bounding box`);
      return [];
    }

    console.log(`  Found ${result.elements.length} ways in bounding box`);

    // Convert to GeoJSON
    const roads: Feature<LineString>[] = [];
    for (const element of result.elements) {
      const feature = osmWayToGeoJSON(element, wardConfig.englishName);
      if (feature) {
        roads.push(feature);
      }
    }

    console.log(`  Converted ${roads.length} roads to GeoJSON`);

    // Clip to ward boundary
    const clippedRoads = clipRoadsToBoundary(roads, boundary);

    // Filter out very short segments (< 10m)
    const filteredRoads = clippedRoads.filter((road) => {
      const length = turf.length(road, { units: 'meters' });
      return length >= 10;
    });

    console.log(`  After filtering: ${filteredRoads.length} road segments (>=10m)`);

    return filteredRoads;
  } catch (error) {
    console.error(`  Error fetching roads: ${error}`);
    return [];
  }
}

/**
 * Main function
 */
async function main() {
  console.log('=== Fetch Road Network ===\n');

  const outputDir = join(__dirname, '../sample-data/raw-roads');
  mkdirSync(outputDir, { recursive: true });

  let totalRoads = 0;

  for (const ward of WARDS) {
    const roads = await fetchRoadsForWard(ward);

    if (roads.length > 0) {
      const outputPath = join(outputDir, ward.outputFileName);
      const collection: FeatureCollection = {
        type: 'FeatureCollection',
        features: roads,
      };
      writeFileSync(outputPath, JSON.stringify(collection, null, 2));
      console.log(`  Saved to: ${outputPath}`);
      totalRoads += roads.length;
    }

    // Rate limiting between wards
    await delay(2000);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total roads fetched: ${totalRoads}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

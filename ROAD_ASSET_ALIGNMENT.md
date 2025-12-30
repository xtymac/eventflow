# Road Asset Alignment Notes

## Overview
The sample road assets were simplified two-point LineStrings. This made them appear as straight segments that did not follow real road curves on the map. To improve visual alignment, we snapped each road asset to the OSM road network using OSRM Route API, producing multi-point LineStrings that follow actual road geometry while keeping IDs and business attributes unchanged.

## Root Cause
- Each road asset had only two points (start and end).
- Straight-line geometry does not match real-world road curvature.
- Coordinate order and SRID were correct; the geometry detail was insufficient.

## Solution
Use OSRM Route API to route between the two endpoints and replace the geometry with the returned route geometry.

## Script
Path: `scripts/match-roads.ts`

Inputs/Outputs:
- Input: `sample-data/road_assets.geojson`
- Output: `sample-data/road_assets_matched.geojson`

Behavior:
- Tries `driving` profile first; falls back to `foot` if driving fails.
- Applies snap distance and detour checks; keeps original geometry on failure.
- Adds matching metadata to GeoJSON properties (not stored in the DB).

Config (environment variables):
- `OSRM_BASE_URL` (default: `https://router.project-osrm.org`)
- `DELAY_MS` (default: `1000`)
- `SNAP_RADIUS` (default: `50` meters)
- `DETOUR_RATIO` (default: `3.0`)

Quality gates (hard-coded):
- Max snap distance: `100` meters
- Detour ratio threshold: `3.0`

Metadata added per feature:
- `matched` (boolean)
- `matchProfile` (`driving` or `foot`)
- `snapDistance` (meters)
- `detourRatio` (route distance / straight-line distance)
- `originalPointCount`
- `matchedPointCount`

## Workflow
1) Run the script:

```bash
cd nagoya-construction-lifecycle
node --loader tsx scripts/match-roads.ts
```

2) Review output:
- Check `matched=false` features and warnings in the console.
- Inspect `road_assets_matched.geojson` on the map.

3) Replace the input file after verification:

```bash
cp sample-data/road_assets_matched.geojson sample-data/road_assets.geojson
```

4) Re-seed the database:

```bash
cd nagoya-construction-lifecycle
npm run db:seed
```

## Notes
- Matching metadata is stored only in GeoJSON; it is not persisted in the database.
- If endpoints are inaccurate, the route may still be offset even after snapping.
- This step improves road asset geometry only; event geometries are unchanged.

## Rollback
- Restore the original `sample-data/road_assets.geojson`.
- Re-run `npm run db:seed`.

## Backend BBOX Loading (Implementation Summary)
To support viewport-based loading for large asset counts, `GET /assets` now supports bbox filtering and pagination.

Changes:
- Added `parseBbox` helper and query params: `q`, `searchName` (compat), `bbox`, `limit`, `offset`, `includeTotal`.
- Switched to raw SQL with PostGIS geometry conversion and stable pagination sort (`ORDER BY id`).
- `includeTotal=false` skips the COUNT query for faster bbox requests.

API examples:
```bash
curl "localhost:3000/assets?bbox=136.88,35.16,136.92,35.20&limit=500&includeTotal=false"
curl "localhost:3000/assets?q=通&limit=50&offset=100"
```

Test results:
- `GET /assets?limit=2` → total 18726, returned 2
- `GET /assets?bbox=136.88,35.16,136.92,35.20` → 3802 assets
- `GET /assets?bbox=0,0,1,1` → 0 assets
- `GET /assets?bbox=invalid` → 400 error
- `GET /assets?bbox=...&ward=Naka-ku` → 2674 assets
- `GET /assets?includeTotal=false` → total null
- `GET /assets?q=出来町` → 30 matches

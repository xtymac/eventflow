# OGC API Scope (Phase 7)

## Goals
- Provide OGC API Features and Tiles for assets, events, and inspections.
- Support read/write workflows for field reporting.
- Enable CQL2 filtering and CRS reprojection.
- Offer GeoJSON and GeoPackage outputs for exchange.
- Track implementation tasks: `docs/planning/ogc-api-implementation-checklist.md`.

## Base URL
- `/ogc`

## Collections (Initial)
| Collection ID | Geometry | Write Support | Notes |
| --- | --- | --- | --- |
| `road-assets` | LineString/MultiLineString | Internal only | Centerline assets in PostGIS |
| `construction-events` | Polygon/LineString/Multi* | Yes | Field-registered events/repairs |
| `inspections` | Point | Yes | Field inspections and patrols |
| `road-areas` | Polygon | Planned | Legal road area polygons (Phase 8) |

## Endpoints (Features)
- `GET /ogc` (landing page)
- `GET /ogc/conformance`
- `GET /ogc/collections`
- `GET /ogc/collections/{collectionId}`
- `GET /ogc/collections/{collectionId}/items`
- `GET /ogc/collections/{collectionId}/items/{itemId}`
- `POST /ogc/collections/{collectionId}/items`
- `PUT /ogc/collections/{collectionId}/items/{itemId}`
- `PATCH /ogc/collections/{collectionId}/items/{itemId}`
- `DELETE /ogc/collections/{collectionId}/items/{itemId}`

## Endpoints (Tiles)
- `GET /ogc/collections/{collectionId}/tiles`
- `GET /ogc/collections/{collectionId}/tiles/{tileMatrixSetId}`
- `GET /ogc/collections/{collectionId}/tiles/{tileMatrixSetId}/{tileMatrix}/{tileRow}/{tileCol}`

## Output Formats
- GeoJSON (default): `application/geo+json` or `f=geojson`
- GeoPackage: `application/geopackage+sqlite3` or `f=gpkg`
- MVT tiles: `application/vnd.mapbox-vector-tile` or `f=mvt`

## CRS Support
- Default output CRS: `http://www.opengis.net/def/crs/OGC/1.3/CRS84`
- Supported output CRS:
  - `http://www.opengis.net/def/crs/EPSG/0/4326`
  - `http://www.opengis.net/def/crs/EPSG/0/3857`
  - `http://www.opengis.net/def/crs/EPSG/0/6669` to `http://www.opengis.net/def/crs/EPSG/0/6676` (JGD2011 plane zones)
- Query parameters:
  - `crs` for output CRS.
  - `bbox-crs` for input bbox CRS.
- Internal storage remains EPSG:4326 in PostGIS.

## Filtering (CQL2)
- Supported via:
  - `filter=<CQL2 text>` and `filter-lang=cql2-text`
- CQL2 subset:
  - Logical: `AND`, `OR`, `NOT`
  - Comparison: `=`, `<>`, `<`, `<=`, `>`, `>=`, `BETWEEN`, `IN`, `LIKE`
  - Spatial: `S_INTERSECTS`, `S_WITHIN`, `S_DWITHIN`
  - Geometry literals: WKT for spatial predicates
- BBOX is supported via `bbox` (without CQL2).

## Paging
- `limit` supported for item collections.
- `next` and `prev` links included in responses.
- `numberMatched` returned when `count=true`.

## Write Semantics
- Payloads use GeoJSON Feature objects.
- `POST` creates features; `PUT` replaces; `PATCH` updates; `DELETE` removes.
- Write endpoints require authentication and role-based access (Phase 9).
- Writes to `road-assets` are restricted to internal roles.
- Writes to `construction-events` and `inspections` are enabled for field roles.

## Tile Matrix Sets
- Default: `WebMercatorQuad` (EPSG:3857)
- Optional: `WorldCRS84Quad` (EPSG:4326)
- Tile metadata includes scale, extent, and link to MVT content type.

## Mapping to Current APIs
| OGC Collection | Current API |
| --- | --- |
| `road-assets` | `/assets` |
| `construction-events` | `/events` |
| `inspections` | `/inspections` |

## Error Responses
- Use `application/problem+json` with `title`, `detail`, and `status`.

## Examples

List assets in bbox:
```http
GET /ogc/collections/road-assets/items?bbox=136.88,35.16,136.92,35.20&limit=100
```

Filter events by status and ward (CQL2):
```http
GET /ogc/collections/construction-events/items?filter=status='active' AND ward='Nakamura-ku'&filter-lang=cql2-text
```

Create an inspection:
```http
POST /ogc/collections/inspections/items
Content-Type: application/geo+json

{
  "type": "Feature",
  "id": "IR-1001",
  "properties": {
    "inspectionDate": "2024-03-15",
    "result": "passed",
    "notes": "No issues found"
  },
  "geometry": {
    "type": "Point",
    "coordinates": [136.9066, 35.1815]
  }
}
```

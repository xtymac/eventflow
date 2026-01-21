# OGC API Implementation Checklist (Phase 7)

This checklist turns the OGC API scope into concrete implementation tasks.

## 0) Prereqs and Decisions
- [ ] Confirm base path (`/ogc`) and versioning strategy.
- [ ] Confirm auth model for write endpoints (field vs internal roles).
- [ ] Choose CQL2 parser/library (or implement minimal parser).
- [ ] Confirm CRS list and naming (CRS84 vs EPSG:4326).

## 1) Routing and Metadata
- [ ] Add `GET /ogc` landing page with links.
- [ ] Add `GET /ogc/conformance` returning conformance classes.
- [ ] Add `GET /ogc/collections` and `GET /ogc/collections/{id}`.
- [ ] Map collections to existing domains:
  - `road-assets` -> `road_assets`
  - `construction-events` -> `construction_events`
  - `inspections` -> `inspection_records`
- [ ] Include `extent` (bbox), `crs`, `itemType`, and `links`.

## 2) Features: Read (List + Item)
- [ ] `GET /ogc/collections/{id}/items`:
  - [ ] Support `bbox`, `bbox-crs`, `limit`, `offset` (or `cursor`).
  - [ ] Support `filter` + `filter-lang=cql2-text`.
  - [ ] Support `crs` for output reprojection.
  - [ ] Return `FeatureCollection` with `links`, `numberReturned`, `numberMatched`.
- [ ] `GET /ogc/collections/{id}/items/{itemId}`:
  - [ ] Accept `crs` for output reprojection.
  - [ ] Return `Feature` with `links`.
- [ ] Content negotiation:
  - [ ] `application/geo+json` default.
  - [ ] `f=geojson` query override.

## 3) Features: Write (Create/Update/Delete)
- [ ] `POST /ogc/collections/{id}/items`:
  - [ ] Validate GeoJSON Feature.
  - [ ] Enforce role-based access and allowed collections.
  - [ ] Support `crs` for input reprojection (optional).
- [ ] `PUT /ogc/collections/{id}/items/{itemId}`:
  - [ ] Full replace; ensure ID consistency.
- [ ] `PATCH /ogc/collections/{id}/items/{itemId}`:
  - [ ] Partial update with `properties` and/or `geometry`.
- [ ] `DELETE /ogc/collections/{id}/items/{itemId}`:
  - [ ] Soft-delete if required by business rules.

## 4) CRS Handling
- [ ] Maintain internal storage at EPSG:4326.
- [ ] Implement `crs` output transform using `ST_Transform`.
- [ ] Implement `bbox-crs` input transform for bbox filters.
- [ ] Support JGD2011 plane zones (EPSG:6669-6676).
- [ ] Validate CRS URIs and map to EPSG codes.

## 5) CQL2 Filter Mapping
- [ ] Define supported subset and reject unsupported ops.
- [ ] Map attribute predicates to SQL with safe parameterization.
- [ ] Map spatial predicates to PostGIS:
  - [ ] `S_INTERSECTS` -> `ST_Intersects`
  - [ ] `S_WITHIN` -> `ST_Within`
  - [ ] `S_DWITHIN` -> `ST_DWithin`
- [ ] Support geometry literals as WKT.
- [ ] Combine with bbox and pagination safely.

## 6) GeoPackage Output
- [ ] Add `f=gpkg` for `items` list:
  - [ ] Reuse existing export service (ogr2ogr).
  - [ ] Apply filters (bbox, CQL2, CRS) before export.
- [ ] Ensure layer names and CRS metadata are consistent.

## 7) Tiles (OGC API - Tiles)
- [ ] `GET /ogc/collections/{id}/tiles` (tileset list + links).
- [ ] `GET /ogc/collections/{id}/tiles/{tileMatrixSetId}`:
  - [ ] Return TileMatrixSet metadata (WebMercatorQuad, WorldCRS84Quad).
- [ ] `GET /ogc/collections/{id}/tiles/{tileMatrixSetId}/{tileMatrix}/{tileRow}/{tileCol}`:
  - [ ] Proxy to Martin or PMTiles.
  - [ ] Support `f=mvt`.

## 8) Error Handling and Responses
- [ ] Return `application/problem+json` for errors.
- [ ] Standardize error codes for invalid CRS, bad CQL2, etc.

## 9) Auth and Audit
- [ ] Add auth middleware for write endpoints.
- [ ] Log edits with user identity and source (field/internal).
- [ ] Enforce collection-level permissions.

## 10) Tests
- [ ] Unit tests for CQL2 parsing and SQL generation.
- [ ] API tests for list/item endpoints with bbox and filter.
- [ ] CRS transform tests (EPSG:4326 <-> 6672, etc.).
- [ ] Write tests for create/update/delete.
- [ ] Tiles metadata validation tests.

## 11) Documentation
- [ ] Update OpenAPI or docs with OGC endpoints.
- [ ] Add examples for QGIS/ArcGIS/MapLibre consumption.

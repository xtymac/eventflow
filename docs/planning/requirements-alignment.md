# DX Requirements Recalibration (Nagoya Infrastructure DX Platform)

## Purpose
Align the latest requirements with the current implementation and the project plan. This is a delta-oriented view for planning and prioritization.

## Latest Requirements Baseline (Normalized)
- Standards and interoperability
  - OGC API - Features for feature query/edit (WFS successor)
  - OGC API - Tiles or MVT for scalable vector tile delivery
  - NGSI-LD (FIWARE/Orion-LD) for event-driven status and anomaly flows
  - GeoPackage + GeoJSON for offline and portable exchange
  - SXF v3.0 parsing and generation for legacy legal CAD ledgers
- Legal geometry and data engineering
  - Road Law Article 18 road area polygons (legal boundaries)
  - CAD-to-GIS semantic mapping with layer/attribute extraction
  - PostGIS as spatial source of truth
  - Versioning and historical (spatiotemporal) queries
- Three-portal GIS architecture
  - Internal GIS for staff (analysis, modeling, lifecycle management)
  - External shared GIS for contractors (mobile field entry + GPS)
  - Public GIS for citizens (read-only disclosure)
- Performance and deployment
  - PMTiles + CDN for large-scale static distribution
  - Cloud-native deployment and security
  - SSO integration across subsystems
- Delivery and operations
  - Preference for packaged products and configuration-first approach
  - Long-term operational stability and support

## Current Implementation Snapshot (As-Is)
- Spatial DB: PostGIS with geometry columns for events/assets/inspections.
- APIs: Custom REST endpoints (Fastify) with bbox filtering and pagination.
- Map: MapLibre GL JS with raster basemap; vector overlays from:
  - Martin tile server (MVT) in production.
  - PMTiles for local static tiles (pre-generated).
- NGSI-LD: One-way sync for ConstructionEvent only.
- Import/Export: GeoJSON + GeoPackage for road assets with validation, versioning, and rollback.
- Road assets: Centerline LineStrings; polygon column exists but is not yet used for legal boundaries.
- Legal road areas: Rendered as Nagoya designated road MVT overlays (read-only, not authoritative in road_assets).
- Versioning: Import versions + road asset change logs; no full time-travel queries.
- Portals: Single internal UI; no public/external portals or SSO.

## Alignment Matrix (Requirement -> Status)

### Standards and Interoperability
- OGC API - Features: Gap.
  - Current: `/assets` and `/events` support bbox filtering but are not OGC-conformant.
  - Plan: Add OGC API Features endpoints and conformance metadata.
- OGC API - Tiles / MVT: Partial.
  - Current: MVT via Martin and PMTiles (custom endpoints, no OGC API Tiles metadata).
  - Plan: Provide OGC API Tiles wrapper (tile matrices + metadata) or adopt OGC API Tiles endpoints.
- NGSI-LD for events + anomalies: Partial.
  - Current: ConstructionEvent sync only.
  - Plan: Extend to RoadAsset and InspectionRecord (Phase 5).
- GeoPackage + GeoJSON exchange: Implemented (road assets).
  - Plan: Extend to events/inspections; define offline exchange contracts.
- SXF v3.0: Gap.
  - Plan: Add SXF parse/generate pipeline and validation.

### Legal Geometry and Data Engineering
- Road area polygons (legal boundary): Partial.
  - Current: Overlays from official MVT; no authoritative polygon in core asset model.
  - Plan: Persist legal polygons and link to assets; validate with JACIC samples.
- CAD-to-GIS semantic mapping: Gap.
  - Plan: ETL pipeline for CAD layers -> GIS schema + QA checks.
- PostGIS: Implemented.
- Spatiotemporal versioning: Partial.
  - Current: Import versioning and change logs.
  - Plan: Add temporal tables or history views for time-travel queries.

### Three-Portal GIS Architecture
- Internal GIS: Implemented (single app).
- External shared GIS (contractor/mobile): Gap.
  - Plan: Contractor portal with GPS capture and simplified workflows.
- Public GIS: Gap.
  - Plan: Read-only disclosure portal with high-performance tiles.
- SSO: Gap.
  - Plan: Integrate IdP and unify user roles across portals.

### Performance and Operations
- PMTiles + CDN: Partial.
  - Current: PMTiles generation and local hosting; Martin for live tiles.
  - Plan: CDN distribution for static tiles + cache policy.
- Cloud-native deployment: Partial (Docker Compose baseline).
  - Plan: Hardened deployment profile with monitoring and security controls.

## Plan Recalibration (Proposed Additions)
- Phase 7: OGC Standards & Interoperability
  - Deliverables: OGC API Features endpoints, Tiles metadata, conformance docs.
  - Exit criteria: Features/Tiles queries work with standard clients.
- Phase 8: Legal CAD/SXF Pipeline + Road Area Polygons
  - Deliverables: SXF v3.0 import/export, CAD-to-GIS ETL, legal polygon storage.
  - Exit criteria: JACIC sample validates end-to-end; legal polygons drive GIS views.
- Phase 9: Multi-Portal GIS + SSO
  - Deliverables: Internal/external/public portals, contractor mobile entry, SSO roles.
  - Exit criteria: Role-based access works across all portals.
- Phase 10: Spatiotemporal Versioning
  - Deliverables: History model + time-travel queries for assets/events.
  - Exit criteria: Boundary changes are queryable by timestamp.

## Open Questions
- OGC API conformance targets (Features/Tiles classes to implement first).
- SXF integration strategy (library choice, validation rules, output schema).
- Authoritative source for legal road polygons (SXF vs MVT vs other).
- IdP choice and SSO requirements (SAML/OIDC, tenant separation).

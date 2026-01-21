# Nagoya Construction Lifecycle - Execution Plan

## Overview
A GIS + workflow prototype for road construction lifecycle management, targeting local government road management staff in Nagoya.

## Status Summary
- Completed: Phase 1 (Foundation), Phase 2 (Core API), Phase 3 (Frontend Core), Phase 5.5 (Event Detail UI), Import/Export (GeoJSON + GeoPackage)
- Remaining: Phase 4 (State Management and Data Flow), Phase 5 (NGSI-LD Extended Features), Phase 6 (Polish and Demo)
- Backlog: Phase 7+ (OGC API Features/Tiles, SXF pipeline, public/external GIS, SSO, spatiotemporal history)

Recalibration reference: `docs/planning/requirements-alignment.md`

## Key Decisions
- Scope: Full prototype (all phases)
- ORM: Drizzle ORM (type-safe, PostGIS support)
- NGSI-LD: Include from Phase 1 (Orion-LD + minimal sync path)
- Validation: TypeBox (native Fastify integration)
- SRID: EPSG:4326 (WGS84) for all geometry
- Data authority: PostGIS is source of truth; Orion-LD entity data is one-way (PostGIS -> Orion-LD only, no entity writes back); subscription management API writes to Orion-LD are allowed
- Deployment: x86_64 (AWS target); Apple Silicon dev uses platform emulation

## Completed Highlights
- Orion-LD infrastructure fix (Mongo 4.4 compatibility, healthcheck updates). See Appendix B.
- Phase 2 gap implementation: /assets/:id/events endpoint, inspection CRUD refinements, validate-import script enhancements.
- Phase 5.5 Event Detail UI enhancement (drill-down navigation, actions, map-sidebar sync).

## Next Phases Plan (Upcoming Implementation)

### Phase 4: State Management and Data Flow
Goal: Consolidate stores, unify filter state, and stabilize data fetching to prevent unnecessary refetch/rerender.

Planned tasks:
- Audit and normalize Zustand stores (useEventStore, useAssetStore, useMapStore, useUIStore).
- Standardize filter shapes and debounced search behavior across list and map views.
- Consolidate API hooks and caching strategy (consistent error/loading states).
- Reduce redundant map updates by stabilizing data inputs (avoid unnecessary setData calls).

Deliverables:
- Clean store interfaces with consistent filter types.
- Unified API hook patterns for events/assets/inspections.
- Map and list views update without flicker or redundant refetch.

Exit criteria:
- List and map views stay in sync under rapid pan/zoom.
- Filters apply consistently across tabs.
- Loading/error UX is predictable and not duplicated.

### Phase 5: NGSI-LD Extended Features
Goal: Extend NGSI-LD coverage to road assets and inspections, with observability and reconciliation.

Planned tasks:
- Add RoadAsset and InspectionRecord entity schemas and mapping.
- Implement sync for asset and inspection changes.
- Add subscription management API (read-only to PostGIS).
- Add sync health monitoring, dead letter handling, and manual reconciliation UI.

Deliverables:
- Updated NGSI-LD @context and entity payloads.
- Subscription endpoints with documentation.
- Sync health dashboards/logs.

Exit criteria:
- Assets and inspections appear in Orion-LD with correct geometry and metadata.
- Subscriptions deliver change notifications.
- Failed syncs are visible and recoverable.

### Phase 6: Polish and Demo Preparation
Goal: Production-quality UI/UX and a repeatable demo flow.

Planned tasks:
- UI polish (tooltips, legend, skeletons, error boundaries, toasts).
- Demo data verification and scenario walkthrough.
- Documentation: OpenAPI/Swagger and setup README updates.

Deliverables:
- Demo script and verified sample dataset.
- Updated docs and API specs.

Exit criteria:
- End-to-end lifecycle demo runs without manual fixes.
- Health endpoints and demo scripts pass on a clean environment.

### Phase 7: OGC Standards and Interoperability
Goal: Provide OGC API Features/Tiles compatibility for external systems.

Planned tasks:
- Implement OGC API Features endpoints for assets/events/inspections.
- Add conformance and collections metadata.
- Provide OGC API Tiles metadata for MVT/PMTiles distribution.

Deliverables:
- OGC API Features/Tiles endpoints documented.
- Compatibility verified with standard clients.

Exit criteria:
- Features and Tiles endpoints work with bbox/limit queries.
- Conformance classes reported correctly.

### Phase 8: Legal CAD/SXF Pipeline and Road Area Polygons
Goal: Close the legal CAD (SXF) to GIS gap and persist legal road area polygons.

Planned tasks:
- SXF v3.0 parse/generate pipeline (GDAL or dedicated library).
- CAD layer to GIS schema mapping and QA validation.
- Store authoritative road area polygons and link to road assets.

Deliverables:
- SXF import/export workflow with validation report.
- Legal polygons stored in PostGIS with provenance.

Exit criteria:
- JACIC sample validates end-to-end.
- Legal polygons drive GIS views without manual fixes.

### Phase 9: Multi-Portal GIS and SSO
Goal: Split internal, contractor, and public portals with unified identity.

Planned tasks:
- Role-based access and portal separation.
- Contractor mobile workflows (GPS capture, field forms).
- Public read-only disclosure portal.
- SSO integration (OIDC/SAML).

Deliverables:
- Three portals with scoped access.
- SSO-backed role model.

Exit criteria:
- Contractor field entry works end-to-end.
- Public portal meets performance and disclosure requirements.

### Phase 10: Spatiotemporal Versioning
Goal: Enable time-travel queries and boundary change history.

Planned tasks:
- History tables or bitemporal model for assets/events.
- Time-based query endpoints and UI.

Deliverables:
- Historical query API and UI.

Exit criteria:
- Boundary changes are queryable by timestamp.

## Phase Summaries (Completed)

### Phase 1: Foundation Setup (COMPLETE)
- Monorepo layout with backend, frontend, shared types.
- Backend Fastify + Drizzle + PostGIS.
- Frontend Vite + React + MapLibre GL.
- Docker Compose with db/api/web/orion-ld/mongo.
- Minimal NGSI-LD sync and retry behavior.

### Phase 2: Core API Development (COMPLETE)
- Database schema with join table for events/assets.
- CRUD endpoints for events, assets, inspections.
- Geometry conversion helpers and spatial indexes.
- Background jobs for status transitions (node-cron).

### Phase 3: Frontend Core Features (COMPLETE)
- Responsive sidebar + map layout.
- Event and asset CRUD with map drawing.
- Road update mode and asset change tracking.
- Inspection record creation and map display.

### Phase 5.5: Event Detail UI Enhancement (COMPLETE)
New components:
- frontend/src/features/events/EventDetailPanel.tsx
- frontend/src/features/events/EventActionButtons.tsx
- frontend/src/features/events/AffectedAssetsList.tsx

Features:
- Drill-down navigation and map-sidebar synchronization.
- Action buttons for status/decision handling.
- Clickable affected assets list and enhanced map hover.

## Migration Notes (If Needed)
Schema changes after Phase 1 require explicit migrations. See Appendix A for SQL details.

## Critical Files

File | Purpose
--- | ---
docker-compose.yml | Container orchestration (db, api, web, orion-ld, mongo)
backend/src/index.ts | API entry point
backend/src/db/schema.ts | Drizzle ORM schema with PostGIS types
backend/src/db/seed.ts | Seed script using ST_GeomFromGeoJSON
backend/src/routes/events.ts | Event API routes
backend/src/routes/assets.ts | Asset API routes (including POST)
backend/src/services/ngsi-sync.ts | PostGIS -> Orion-LD sync service (inline @context)
frontend/src/App.tsx | Main app component
frontend/src/components/MapView.tsx | Map component with layer toggles and hover popups
frontend/src/features/events/EventList.tsx | Event list with drill-down to detail
frontend/src/features/assets/AssetList.tsx | Asset list with selection highlight
frontend/src/features/assets/RoadUpdateMode.tsx | Road update mode after decision
docs/NGSI-LD.md | NGSI-LD integration documentation

## Definition of Done / Demo Criteria
- All core services run via Docker Compose and Orion-LD responds to /version
- Seed data loads: 12 construction events and 24 road assets visible on the map
- Create and edit an event with geometry; updates appear on the map
- Manual and scheduled status transitions work; map styling reflects status
- Post-end decision flow works; asset updates record RoadAssetChange
- Cross-department filtering works in the event list
- Inspection records can be added and displayed on the map
- NGSI-LD sync proves that event create/update appears in Orion-LD
- Demo script runs end-to-end without manual data fixes

## Appendix A: Join-Table Migration SQL

```sql
-- 1. Create join table
CREATE TABLE event_road_assets (
  event_id VARCHAR NOT NULL REFERENCES construction_events(id),
  road_asset_id VARCHAR NOT NULL REFERENCES road_assets(id),
  relation_type VARCHAR CHECK (relation_type IN ('affected', 'updated')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (event_id, road_asset_id)
);

-- 2. Backfill from affectedRoadAssetIds array (if data exists)
INSERT INTO event_road_assets (event_id, road_asset_id, relation_type)
SELECT id, unnest(affected_road_asset_ids), 'affected'
FROM construction_events
WHERE affected_road_asset_ids IS NOT NULL AND array_length(affected_road_asset_ids, 1) > 0;

-- 3. Drop old column
ALTER TABLE construction_events DROP COLUMN affected_road_asset_ids;

-- 4. Migrate inspection_records (if data exists)
ALTER TABLE inspection_records ADD COLUMN event_id VARCHAR REFERENCES construction_events(id);
ALTER TABLE inspection_records ADD COLUMN road_asset_id VARCHAR REFERENCES road_assets(id);
UPDATE inspection_records SET event_id = related_id WHERE related_type = 'event';
UPDATE inspection_records SET road_asset_id = related_id WHERE related_type = 'asset';

-- 5. Clean invalid inspection data (if any)
DELETE FROM inspection_records
WHERE event_id IS NULL AND road_asset_id IS NULL;

ALTER TABLE inspection_records DROP COLUMN related_type;
ALTER TABLE inspection_records DROP COLUMN related_id;
ALTER TABLE inspection_records ADD CHECK ((event_id IS NOT NULL) <> (road_asset_id IS NOT NULL));
```

## Appendix B: Orion-LD MongoDB Compatibility Fix

Problem: Orion-LD 1.5.1 crashes with MongoDB 6 due to removed OP_QUERY support.

Solution summary:
- MongoDB image pinned to 4.4
- Orion-LD image pinned to 1.5.1
- Healthchecks use mongo and wget

Reference docker-compose snippet:

```yaml
# MongoDB - Use 4.4 for Orion-LD compatibility
mongo:
  image: mongo:4.4
  container_name: nagoya-mongo
  restart: unless-stopped
  ports:
    - "27017:27017"
  volumes:
    - mongo_data:/data/db
  healthcheck:
    test: ["CMD", "mongo", "--eval", "db.adminCommand('ping')"]
    interval: 10s
    timeout: 5s
    retries: 5

# Orion-LD
orion-ld:
  image: fiware/orion-ld:1.5.1
  platform: linux/amd64
  container_name: nagoya-orion-ld
  restart: unless-stopped
  depends_on:
    mongo:
      condition: service_healthy
  ports:
    - "1026:1026"
  environment:
    ORIONLD_MONGO_HOST: mongo
    ORIONLD_MONGO_DB: orionld
    ORIONLD_LOG_LEVEL: DEBUG
  command: -dbhost mongo -logLevel DEBUG
  healthcheck:
    test: ["CMD-SHELL", "wget -q --spider http://localhost:1026/version || exit 1"]
    interval: 10s
    timeout: 5s
    retries: 5
```

Execution notes:
- Use `docker compose down` before changes.
- Removing the mongo volume is destructive in dev.
- Reseed data to trigger NGSI-LD sync.

For full details, see docs/NGSI-LD.md.

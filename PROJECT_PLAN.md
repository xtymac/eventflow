# Nagoya Construction Lifecycle - Execution Plan

## Project Overview
A GIS + workflow prototype for road construction lifecycle management, targeting local government road management staff in Nagoya.

Current Status: Phase 1 complete, Phase 2 complete, Phase 5.5 (Event Detail UI) complete.

## Decisions
- Scope: Full prototype (all phases)
- ORM: Drizzle ORM (type-safe, PostGIS support)
- NGSI-LD: Include from Phase 1 (Orion-LD + minimal sync path)
- Validation: TypeBox (native Fastify integration)
- SRID: EPSG:4326 (WGS84) for all geometry
- Data authority: PostGIS is source of truth; Orion-LD entity data is one-way (PostGIS -> Orion-LD only, no entity writes back); subscription management API writes to Orion-LD are allowed
- Deployment: x86_64 (AWS target); Apple Silicon dev uses platform emulation

## Schema Changes (from PROJECT_PLAN.md)

Migration steps required

Since the schema was changed after Phase 1, explicit migration is needed:

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

InspectionRecord - Fixed FK integrity

```sql
CREATE TABLE inspection_records (
  id VARCHAR PRIMARY KEY,
  event_id VARCHAR REFERENCES construction_events(id),
  road_asset_id VARCHAR REFERENCES road_assets(id),
  inspection_date DATE,
  result VARCHAR,
  notes TEXT,
  geometry GEOMETRY(Point, 4326),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK ((event_id IS NOT NULL) <> (road_asset_id IS NOT NULL))
);
```

Event-Asset Relationship - Join table

```sql
CREATE TABLE event_road_assets (
  event_id VARCHAR NOT NULL REFERENCES construction_events(id),
  road_asset_id VARCHAR NOT NULL REFERENCES road_assets(id),
  relation_type VARCHAR CHECK (relation_type IN ('affected', 'updated')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (event_id, road_asset_id)
);
```

## NGSI-LD Sync Resilience (linked to tasks)
- Phase 1 Task: Implement basic retry in ngsi-sync.ts (3 attempts, exponential backoff)
- Phase 5 Task: Add dead letter queue, manual reconciliation UI, sync health monitoring

## Scope Clarification
- Phase 1-6: Core prototype (event workflow, NGSI-LD sync, demo)
- Phase 7+ (Backlog): GIS import/export, auth, offline support

## COMPLETED: Orion-LD Infrastructure Fix
MongoDB compatibility issue resolved. See `docs/NGSI-LD.md` for full documentation.
- MongoDB 6 -> 4.4 (OP_QUERY compatibility)
- healthcheck: mongosh -> mongo, curl -> wget
- ngsi-sync.ts uses inline @context (no external URL dependency)
- All 12 events synced to Orion-LD successfully

## COMPLETED: Phase 2 Gap Implementation

- Added `/assets/:id/events` endpoint with deterministic ordering.
- Added `PUT /inspections/:id` and `DELETE /inspections/:id` with FK constraint validation and empty-string normalization.
- Enhanced `scripts/validate-import.ts` with PostGIS preflight plus BBOX perf, GIST index, SRID consistency, and buffer checks.
- Validation checks pass in dev environment (BBOX perf, GIST index, SRID 4326, buffer operation).

## Phase 1: Foundation Setup (COMPLETE)

### 1.1 Project Structure
Create monorepo structure with /frontend and /backend directories.
Initialize package.json at root with workspace configuration.
Create shared types package for TypeScript definitions.

### 1.2 Backend Setup

```
/backend
├── src/
│   ├── index.ts           # Fastify entry point
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   ├── models/            # Database models
│   └── utils/             # Helpers
├── package.json
├── tsconfig.json
└── Dockerfile
```

Tasks:
- Initialize Node.js + TypeScript + Fastify project
- Configure ESLint + Prettier
- Set up PostgreSQL + PostGIS connection with Drizzle ORM
- Create database schema (ConstructionEvent, RoadAsset, RoadAssetChange, InspectionRecord)
- Seed database with sample data from GeoJSON files

### 1.3 Frontend Setup

```
/frontend
├── src/
│   ├── components/        # UI components
│   ├── features/          # Feature modules
│   ├── hooks/             # Custom hooks
│   ├── stores/            # Zustand stores
│   ├── types/             # TypeScript types
│   └── utils/             # Utilities
├── package.json
├── vite.config.ts
└── tsconfig.json
```

Tasks:
- Initialize Vite + React + TypeScript project
- Install dependencies: Mantine UI, Zustand, React Hook Form, Day.js
- Install mapping: MapLibre GL JS, @maplibre/maplibre-gl-draw, Turf.js
- Configure environment variables
- Create basic layout component (sidebar + map)

### 1.4 Docker Compose + NGSI-LD Minimal Path

Services:
- db: PostgreSQL + PostGIS
- api: Fastify backend
- web: React frontend
- orion-ld: FIWARE Orion-LD context broker
- mongo: MongoDB for Orion-LD

Tasks:
- Create docker-compose.yml with all services including Orion-LD + MongoDB
- Create Dockerfile for backend
- Create Dockerfile for frontend
- Set up health checks
- Create NGSI-LD @context file for ConstructionEvent entity
- Implement minimal sync service (PostGIS -> Orion-LD) on entity create/update
- Add basic retry to ngsi-sync.ts (3 attempts, exponential backoff)
- Verify Orion-LD subscription endpoint works

## Phase 2: Core API Development
Status: COMPLETE.


### 2.1 Database Schema
Note: Schema aligned with PROJECT_PLAN.md - see "Schema Changes" section at top for details.

```sql
-- ConstructionEvent (NO affected_road_asset_ids array - use join table instead)
CREATE TABLE construction_events (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  status VARCHAR CHECK (status IN ('planned', 'active', 'ended')),
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  restriction_type VARCHAR,
  geometry GEOMETRY(Geometry, 4326),
  post_end_decision VARCHAR,
  department VARCHAR,
  created_by VARCHAR,
  updated_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_events_geometry ON construction_events USING GIST (geometry);

-- Event-RoadAsset join table (replaces affected_road_asset_ids array)
CREATE TABLE event_road_assets (
  event_id VARCHAR NOT NULL REFERENCES construction_events(id),
  road_asset_id VARCHAR NOT NULL REFERENCES road_assets(id),
  relation_type VARCHAR CHECK (relation_type IN ('affected', 'updated')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (event_id, road_asset_id)
);
CREATE INDEX idx_event_road_assets_asset ON event_road_assets (road_asset_id);

-- RoadAsset
CREATE TABLE road_assets (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  geometry GEOMETRY(Geometry, 4326),
  road_type VARCHAR,
  lanes INTEGER,
  direction VARCHAR,
  status VARCHAR CHECK (status IN ('active', 'inactive')),
  valid_from TIMESTAMP WITH TIME ZONE,
  valid_to TIMESTAMP WITH TIME ZONE,
  replaced_by VARCHAR REFERENCES road_assets(id),
  owner_department VARCHAR,
  updated_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_assets_geometry ON road_assets USING GIST (geometry);

-- RoadAssetChange (auto-written by event workflow)
CREATE TABLE road_asset_changes (
  id VARCHAR PRIMARY KEY,
  event_id VARCHAR NOT NULL REFERENCES construction_events(id),
  change_type VARCHAR CHECK (change_type IN ('create', 'update', 'retire')),
  old_road_asset_id VARCHAR REFERENCES road_assets(id),
  new_road_asset_id VARCHAR REFERENCES road_assets(id),
  geometry GEOMETRY(Geometry, 4326),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- InspectionRecord (FK integrity with check constraint)
CREATE TABLE inspection_records (
  id VARCHAR PRIMARY KEY,
  event_id VARCHAR REFERENCES construction_events(id),
  road_asset_id VARCHAR REFERENCES road_assets(id),
  inspection_date DATE,
  result VARCHAR,
  notes TEXT,
  geometry GEOMETRY(Point, 4326),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK ((event_id IS NOT NULL) <> (road_asset_id IS NOT NULL))
);
CREATE INDEX idx_inspections_geometry ON inspection_records USING GIST (geometry);
```

Tasks:
- Create migration files with EPSG:4326 SRID
- Implement GIST spatial indexes on all geometry columns
- Implement event_road_assets join table (replaces array)
- Add check constraint for inspection_records (exactly one FK)
- Seed sample data using ST_GeomFromGeoJSON for geometry conversion
- Test spatial queries with sample data

### 2.2 REST API Endpoints

Endpoint | Method | Description
--- | --- | ---
/events | GET | List events with filters (status, date, name, department)
/events | POST | Create new event (accepts roadAssetIds: string[] in body)
/events/:id | GET | Get event detail (returns roadAssets: RoadAsset[] joined)
/events/:id | PUT | Update event (can update roadAssetIds)
/events/:id/status | PATCH | Change status (start/end)
/events/:id/decision | PATCH | Set post-end decision, triggers road update mode
/assets | GET | List road assets
/assets | POST | Create new road asset (from road update mode)
/assets/:id | GET | Get asset detail
/assets/:id | PUT | Update asset
/assets/:id/retire | PATCH | Retire asset (set inactive, validTo)
/assets/:id/events | GET | (Optional) List events affecting this asset
/inspections | GET | List inspections
/inspections | POST | Create inspection (must have exactly one of eventId or roadAssetId)
/inspections/:id | GET | Get inspection detail

Event-RoadAsset relationship request/response:

```json
// POST /events request body
{ "name": "...", "startDate": "...", "endDate": "...", "roadAssetIds": ["RA-001", "RA-002"] }

// GET /events/:id response
{ "id": "CE-001", "name": "...", "roadAssets": [{ "id": "RA-001", "name": "..." }] }
```

Inspection validation:
- API must validate: exactly one of eventId or roadAssetId is provided
- Return 400 if both or neither are provided (before hitting DB check constraint)

RoadAssetChange write path:
- POST /assets with eventId -> create change with type='create'
- PUT /assets/:id with eventId -> create change with type='update'
- PATCH /assets/:id/retire with eventId -> create change with type='retire'

Tasks:
- Implement CRUD for ConstructionEvent (with roadAssetIds in request/response)
- Implement status transition logic (planned -> active -> ended)
- Implement post-end decision handling
- Implement RoadAsset CRUD including POST for creation
- Implement asset retire endpoint
- Auto-create RoadAssetChange on asset mutations with eventId
- Manage event-asset relationships via event_road_assets join table (not array)
- Implement InspectionRecord CRUD (validate exactly one of event_id or road_asset_id)
- Add validation with TypeBox schemas
- Add GeoJSON <-> PostGIS geometry conversion (ST_GeomFromGeoJSON / ST_AsGeoJSON)

### 2.3 Background Jobs
Tasks:
- Set up node-cron scheduler
- Implement auto-transition job (planned -> active at startDate, active -> ended at endDate)
- Use Asia/Tokyo timezone

## Phase 3: Frontend Core Features
Status: IN PROGRESS.

### 3.1 Layout and Navigation
Tasks:
- [x] Create AppShell with Mantine (sidebar + main content)
- [x] Implement responsive layout (list left, map right)
- [x] Create navigation between events/assets/inspections

### 3.2 Map Component
Tasks:
- [x] Initialize MapLibre GL JS with Nagoya center coordinates
- [x] Add base map tiles (OSM or similar)
- [x] Create map wrapper component with event handling
- [x] Implement geometry rendering for events (color by status)
- [x] Implement geometry rendering for road assets
- [x] Add legend component

### 3.3 Event Management
Tasks:
- [ ] Event list with status filter, date range, name search, department filter (status + name search done; date range + department pending)
- [x] Event detail view with all fields (modal via EventDetailPanel)
- [ ] Create event form (React Hook Form + Mantine inputs) (form exists but uses local state)
- [x] Edit event form
- [x] Status chips (planned=blue, active=yellow, ended=gray)
- [ ] Start/End buttons with confirmation dialog (buttons exist; confirm dialog pending)

### 3.4 Map Drawing
Tasks:
- [ ] Integrate maplibre-gl-draw
- [ ] Draw polygon mode for event geometry
- [ ] Draw line mode for linear events
- [ ] Edit vertices functionality
- [ ] Delete geometry button
- [ ] Preview geometry during create/edit

### 3.5 Post-End Decision Flow
Tasks:
- [ ] Decision modal after ending event (Permanent Change: Yes/No) (decision menu exists; modal pending)
- [ ] If No: archive event, disable editing
- [ ] If Yes: enter road update mode

### 3.6 Road Update Mode
Tasks:
- [ ] Create new road asset form
- [ ] Modify existing road asset
- [ ] Retire road asset (set inactive, validTo)
- [ ] Before/after preview on map
- [ ] Link changes to source event (eventId)

### 3.7 Inspection Records
Tasks:
- [ ] Inspection list in event detail (global list exists; event detail pending)
- [ ] Create inspection form (point geometry, date, result, notes)
- [x] Display inspection points on map
- [ ] Click to view inspection detail

## Phase 4: State Management and Data Flow

### 4.1 Zustand Stores
Tasks:
- useEventStore: events state, filters, selected event
- useAssetStore: road assets state
- useMapStore: map state, viewport, selected layers
- useUIStore: modals, sidebar state

### 4.2 API Integration
Tasks:
- Create API client with fetch/axios
- Implement React Query or SWR for data fetching
- Handle loading/error states
- Optimistic updates for better UX

## Phase 5: NGSI-LD Extended Features
Basic sync path is set up in Phase 1; this extends functionality.
See `docs/NGSI-LD.md` for full NGSI-LD documentation.

Tasks:
- Add RoadAsset entity schema to NGSI-LD
- Add InspectionRecord entity schema
- Implement subscription for status change notifications (READ-ONLY - no writes back to PostGIS)
- Add subscription management API endpoint
- Test external system notification flow
- NGSI-LD resilience: add dead letter queue, manual reconciliation UI, sync health monitoring

## Phase 5.5: Event Detail UI Enhancement (COMPLETE)

Event detail panel with drill-down navigation and map-sidebar synchronization.

### New Components Created

| File | Purpose |
|------|---------|
| frontend/src/features/events/EventDetailPanel.tsx | Full event detail display with back navigation |
| frontend/src/features/events/EventActionButtons.tsx | Edit, Start/End, Set Decision buttons |
| frontend/src/features/events/AffectedAssetsList.tsx | Clickable list of affected road assets |

### Features Implemented

- **Drill-down navigation**: EventList shows EventDetailPanel when event selected
- **Action buttons**: Edit event, Start/End status change, Set Decision menu
- **Affected assets**: Clickable list that switches view to Assets
- **Enhanced map hover**: Shows dates, department, affected assets count
- **Map-sidebar sync**: Clicking map features switches sidebar view and highlights item
- **Auto-scroll**: Selected item scrolls into view in sidebar list

### State Management Updates

Added to `uiStore.ts`:
- `currentView`: 'events' | 'assets' | 'inspections'
- `setCurrentView(view)`: Switch sidebar view
- `isStatusChangeModalOpen`, `statusChangeTargetStatus`: Status change modal state

## Phase 6: Polish and Demo Preparation

### 6.1 UI Polish
Tasks:
- Hover tooltips on map features
- Color-coded legend for restriction types
- Loading skeletons
- Error boundaries
- Toast notifications

### 6.2 Demo Data and Script
Tasks:
- Verify all 12 sample events load correctly
- Verify all 24 road assets display
- Create demo walkthrough script
- Test full lifecycle: Create -> Active -> End -> Decision -> Asset Update

### 6.3 Documentation
Tasks:
- API documentation (Swagger/OpenAPI)
- NGSI-LD entity definitions
- README with setup instructions

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
frontend/src/features/events/EventDetailPanel.tsx | Event detail panel with all fields
frontend/src/features/events/EventActionButtons.tsx | Edit, Start/End, Set Decision buttons
frontend/src/features/events/AffectedAssetsList.tsx | Clickable affected assets list
frontend/src/features/events/EventForm.tsx | Event create/edit form
frontend/src/features/assets/AssetList.tsx | Asset list with selection highlight
frontend/src/features/assets/RoadUpdateMode.tsx | Road update mode after decision
frontend/src/stores/uiStore.ts | UI state (selection, view, modals)
frontend/src/stores/mapStore.ts | Map state (center, zoom, layers)
docs/NGSI-LD.md | NGSI-LD integration documentation

## Implementation Order (Recommended)
- Docker Compose + Orion-LD + Database: all infrastructure including NGSI-LD broker
- Backend API skeleton: Fastify server with health check + NGSI-LD @context
- Database schema + migrations: create tables with GIST indexes + join table
- Minimal NGSI-LD sync: PostGIS -> Orion-LD on event create/update (with retry)
- Seed sample data: import GeoJSON using ST_GeomFromGeoJSON
- Frontend scaffold: Vite + React + basic layout
- Map component: display road assets and events (including Multi* geometries)
- Event list + detail: read-only first
- Event CRUD: create/edit forms with geometry drawing
- Status transitions: manual + auto (node-cron)
- Post-end decision flow: modal and workflow
- Road update mode: asset creation/editing with RoadAssetChange tracking
- Inspection records: simple form + point display
- NGSI-LD subscriptions: status change notifications (READ-ONLY)
- Polish + demo script
- Phase 7+ backlog: GIS import/export for ArcGIS/QGIS (deferred)

## Notes
- Focus on demonstrating event/asset separation concept
- Keep UI simple for non-technical users
- Authentication/permissions are deferred (prototype scope)
- Latest write wins for conflicts (no complex locking)

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

## Join-Table Migration: API and Seed Handling

API changes
- POST /events accepts roadAssetIds: string[] in body, creates rows in event_road_assets
- PUT /events/:id can update roadAssetIds (delete old, insert new)
- GET /events/:id returns roadAssets: RoadAsset[] (joined)
- GET /assets/:id/events (optional): returns events affecting this asset

Seed script changes
- Sample data affectedRoadAssetIds arrays must be migrated:

```ts
// In seed.ts, after inserting events:
for (const event of sampleEvents) {
  for (const assetId of event.affectedRoadAssetIds || []) {
    await db.insert(eventRoadAssets).values({
      eventId: event.id,
      roadAssetId: assetId,
      relationType: 'affected',
    });
  }
}
```

Seed idempotency

```ts
// Use TRUNCATE or upsert to avoid duplicate rows
await db.execute(sql`TRUNCATE construction_events, road_assets, event_road_assets, inspection_records CASCADE`);
// Then insert fresh data
```

## Hotfix: Orion-LD MongoDB Compatibility

Problem
Orion-LD 1.5.1 crashes with MongoDB 6 due to removed legacy wire protocol (OP_QUERY) support.

Error:

```
Unsupported OP_QUERY command: listDatabases.
The client driver may require an upgrade.
```

Root cause
MongoDB 6+ removed legacy wire protocol (OP_QUERY/OP_INSERT/OP_UPDATE/OP_DELETE). Orion-LD uses the legacy MongoDB C++ driver which requires these protocols.

Version compatibility matrix

Orion-LD Version | MongoDB Version | Notes
--- | --- | ---
1.5.1 (current) | 4.4.x | Recommended
1.5.1 | 5.x | May work, not tested
1.5.1 | 6.x | OP_QUERY removed
1.6.0+ | TBD | Check release notes

Solution
File: nagoya-construction-lifecycle/docker-compose.yml

```yaml
# MongoDB - Use 4.4 for Orion-LD compatibility
mongo:
  image: mongo:4.4                    # Pinned version, not :latest
  container_name: nagoya-mongo
  restart: unless-stopped
  ports:
    - "27017:27017"
  volumes:
    - mongo_data:/data/db
  healthcheck:
    test: ["CMD", "mongo", "--eval", "db.adminCommand('ping')"]  # mongo shell for 4.4
    interval: 10s
    timeout: 5s
    retries: 5

# Orion-LD
orion-ld:
  image: fiware/orion-ld:1.5.1        # Pinned version
  platform: linux/amd64               # Required for Apple Silicon (M1/M2/M3)
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
    # Use wget instead of curl (curl not in orion-ld image)
    test: ["CMD-SHELL", "wget -q --spider http://localhost:1026/version || exit 1"]
    interval: 10s
    timeout: 5s
    retries: 5
```

Key changes

Item | Before | After | Reason
--- | --- | --- | ---
MongoDB image | mongo:6 | mongo:4.4 | OP_QUERY compatibility
MongoDB healthcheck | mongosh | mongo | mongosh not in 4.4
Orion-LD image | 1.5.1 | 1.5.1 | Pinned (no :latest)
Orion-LD platform | linux/amd64 | linux/amd64 | Apple Silicon support
Orion-LD healthcheck | curl | wget | curl not in image

Execution steps

WARNING: Step 2 is destructive - all Orion-LD data will be lost. This is acceptable for development only; for production, use mongodump/mongorestore.

Pre-flight check:

```sh
# Verify wget exists in orion-ld image (should return 0)
docker run --rm fiware/orion-ld:1.5.1 which wget

# Get actual volume name (may vary by directory name)
docker volume ls | grep mongo
```

```sh
# 1. Stop containers
cd nagoya-construction-lifecycle
docker compose down

# 2. Remove old mongo volume (DESTRUCTIVE - dev only!)
# NOTE: Volume name depends on project directory name
docker volume rm nagoya-construction-lifecycle_mongo_data

# 3. Apply docker-compose.yml changes (see above)

# 4. Start containers
docker compose up -d

# 5. Wait for Orion-LD to start (~30s)
sleep 30

# 6. Verify Orion-LD health
curl http://localhost:1026/version

# 7. Re-seed data to trigger NGSI-LD sync
cd backend && npm run db:seed
```

Expected result

```json
{
  "orionld version": "1.5.1",
  "based on orion": "1.15.0-next"
}
```

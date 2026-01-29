# Requirements Gap Issues (Prototype 1/28)

This is a ticket-style breakdown of gaps and conflicts identified in the latest alignment analysis.

## P0 - Conflicts (Must Fix)

### REQ-001: Roads must be read-only and not linked to Events
- Type: Conflict
- Priority: P0
- Outcome: Remove road asset edit flows and Event <-> Road linkage requirements.
- Touch points:
  - `backend/src/routes/assets.ts`
  - `backend/src/routes/events.ts`
  - `backend/src/db/schema.ts`
  - `frontend/src/features/assets/RoadUpdateModePanel.tsx`
  - `frontend/src/components/MapView.tsx`
  - `docs/import-export.md`
  - `docs/qgis-setup-guide.md`
  - `docs/map-implementation.md`

### REQ-002: Asset/Event separation with AssetChangeRequest workflow
- Type: Conflict
- Priority: P0
- Outcome: Replace direct asset edits with AssetChangeRequest -> Draft -> Review -> Publish.
- Touch points:
  - `backend/src/db/schema.ts`
  - `backend/src/routes/assets.ts`
  - `frontend/src/features/assets/RoadChangeFormModal.tsx`
  - `frontend/src/stores/uiStore.ts`

### REQ-003: WorkOrder + Evidence data model and workflow
- Type: Gap
- Priority: P0
- Outcome: Add WorkOrder entities, Evidence/Attachment storage, and enforce Event -> WorkOrder binding.
- Touch points:
  - `backend/src/db/schema.ts`
  - `backend/src/routes/*` (new workorders, evidence routes)
  - `frontend/src/features/*` (new workorder and evidence UI)

### REQ-004: App-level separation (Gov/Public/Partner/Mobile)
- Type: Gap
- Priority: P0
- Outcome: Split into separate apps with distinct routes, data access, and UI boundaries.
- Touch points:
  - `frontend/src/App.tsx`
  - `frontend/src/*`
  - `package.json` (scripts/builds)

### REQ-005: RBAC + Views for role isolation
- Type: Gap
- Priority: P0
- Outcome: Implement roles, enforce RBAC in API, and add DB views for gov/partner/public data scopes.
- Touch points:
  - `backend/src/*`
  - `backend/src/services/ogc/api-key-auth.ts`
  - DB migrations / SQL views (new)

## P1 - Core Gaps

### REQ-006: Init import pipeline (Excel/GIS/CAD) with lineage
- Type: Gap
- Priority: P1
- Outcome: Import Excel ledger + GIS features + CAD evidence; map IDs to UUID and preserve legacyId + lineage metadata.
- Touch points:
  - `backend/src/services/import-version.ts`
  - `backend/src/routes/import-versions.ts`
  - `scripts/*` (new Excel/CAD import scripts)
  - `docs/import-export.md`

### REQ-007: Public Portal (read-only disclosure)
- Type: Gap
- Priority: P1
- Outcome: Build a lightweight public app with read-only map + public assets + road tiles.
- Touch points:
  - `frontend/src/*` (new public app)
  - `backend/src/routes/*` (public views)

### REQ-008: Partner Portal (assigned WorkOrders + Evidence)
- Type: Gap
- Priority: P1
- Outcome: Partner app to view assigned workorders and submit evidence.
- Touch points:
  - `frontend/src/*` (new partner app)
  - `backend/src/routes/*` (partner views, evidence upload)

### REQ-009: Mobile Mock (field inspection/evidence)
- Type: Gap
- Priority: P1
- Outcome: Mobile-first UI for evidence upload and result submission.
- Touch points:
  - `frontend/src/*` (new mobile app or mobile route)

### REQ-010: Non-road asset model (parks, trees, facilities, pumps)
- Type: Gap
- Priority: P1
- Outcome: Add or refactor asset schemas for non-road infrastructure with proper APIs.
- Touch points:
  - `backend/src/db/schema.ts`
  - `backend/src/routes/*`
  - `frontend/src/features/assets/*`

### REQ-011: Demo dataset aligned to prototype scope
- Type: Gap
- Priority: P1
- Outcome: Provide minimal dataset (park + assets + events + workorders + evidence).
- Touch points:
  - `sample-data/*`
  - `backend/src/db/seed.ts`

## P2 - Supporting Gaps

### REQ-012: Visualization layer neutrality (documented adapters)
- Type: Gap
- Priority: P2
- Outcome: Document map layer as an upper layer and avoid coupling to a single renderer.
- Touch points:
  - `docs/map-implementation.md`
  - `docs/implementation-architecture.md`

### REQ-013: Standards alignment for handoff and interoperability
- Type: Gap
- Priority: P2
- Outcome: Clarify which open standards are used for core assets/events.
- Touch points:
  - `docs/NGSI-LD.md`
  - `docs/architecture-principles.md`
  - `docs/planning/ogc-api-scope.md`

# Requirements Gap Issues (Prototype 1/30)

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

### REQ-003: Master Data DB vs Event DB separation + notification boundary
- Type: Conflict
- Priority: P0
- Phase: **Phase 2** (outbox/inbox deferred; Phase 1 focuses on Event/WorkOrder/Evidence core workflow)
- Outcome: Separate Master Data DB and Event/Case DB; introduce outbox/inbox so Events can **notify** asset updates but cannot edit assets directly. Prototype may run both DBs on the same Postgres instance.
- Touch points:
  - `backend/src/db/schema.ts`
  - `backend/src/routes/assets.ts`
  - `backend/src/routes/events.ts`
  - `backend/src/services/*` (new notification bridge)

### REQ-004: WorkOrder + Evidence data model and workflow
- Type: Gap
- Priority: P0
- Outcome: Add WorkOrder entities, Evidence/Attachment storage, and enforce Event -> WorkOrder binding.
- Touch points:
  - `backend/src/db/schema.ts`
  - `backend/src/routes/*` (new workorders, evidence routes)
  - `frontend/src/features/*` (new workorder and evidence UI)

### REQ-005: Event status machine + WorkOrder types
- Type: Gap
- Priority: P0
- Outcome: Implement Planned → Active → Pending Review → Closed → Archived; add WorkOrder types (inspection/repair/update), multi-location, and multi-partner assignment.
- Include inspection → repair flow under the same Event, with repair WorkOrders assigned to partners.
- Touch points:
  - `backend/src/db/schema.ts`
  - `backend/src/routes/events.ts`
  - `backend/src/routes/workorders.ts` (new)
  - `frontend/src/features/events/*`
  - `frontend/src/features/workorders/*` (new)

### REQ-006: Gov-only Event closure + notification confirmation
- Type: Gap
- Priority: P0
- Phase: Gov-only close implemented in **Phase 1** (via `X-User-Role` header); notification confirmation deferred to **Phase 2**
- Outcome: Only Gov can close Events; close flow must confirm whether changes should be notified to Master Data, and record notification dispatch.
- Touch points:
  - `backend/src/routes/events.ts` (Phase 1 ✓ — Gov-only close with work order gate)
  - `backend/src/routes/notifications.ts` (Phase 2)
  - `backend/src/services/*` (notification outbox — Phase 2)
  - `frontend/src/features/events/*` (Phase 1 ✓ — DecisionModal for close)

### REQ-007: App-level separation (Gov/Public/Partner/Mobile)
- Type: Gap
- Priority: P0
- Outcome: Split into separate apps with distinct routes, data access, and UI boundaries.
- Touch points:
  - `frontend/src/App.tsx`
  - `frontend/src/*`
  - `package.json` (scripts/builds)

### REQ-008: RBAC + Views for role isolation
- Type: Gap
- Priority: P0
- Outcome: Implement roles, enforce RBAC in API, and add DB views for gov/partner/public data scopes (including gov_event_ops vs gov_master_data).
- Touch points:
  - `backend/src/*`
  - `backend/src/services/ogc/api-key-auth.ts`
  - DB migrations / SQL views (new)

## P1 - Core Gaps

### REQ-009: Gov mobile inspection app (internal execution)
- Type: Gap
- Priority: P1
- Outcome: Gov mobile flow for inspection WorkOrders (forms, photos, location capture, offline sync).
- Touch points:
  - `frontend/src/*` (new gov mobile app)
  - `backend/src/routes/workorders.ts` (new)
  - `backend/src/routes/evidence.ts` (new)

### REQ-010: Partner Portal boundaries (assigned work only)
- Type: Gap
- Priority: P1
- Outcome: Partner portal can view assigned WorkOrders and submit Evidence; cannot create/close Events.
- Touch points:
  - `frontend/src/*` (new partner app)
  - `backend/src/routes/*` (partner views, evidence upload)
  - RBAC policies

### REQ-011: Init import pipeline (Excel/GIS/CAD) with lineage
- Type: Gap
- Priority: P1
- Outcome: Import Excel ledger + GIS features + CAD evidence; map IDs to UUID and preserve legacyId + lineage metadata.
- Touch points:
  - `backend/src/services/import-version.ts`
  - `backend/src/routes/import-versions.ts`
  - `scripts/*` (new Excel/CAD import scripts)
  - `docs/import-export.md`

### REQ-012: Public Portal (read-only disclosure)
- Type: Gap
- Priority: P1
- Outcome: Build a lightweight public app with read-only map + public assets + road tiles.
- Touch points:
  - `frontend/src/*` (new public app)
  - `backend/src/routes/*` (public views)

### REQ-013: Mobile Mock (field inspection/evidence)
- Type: Gap
- Priority: P1
- Outcome: Mobile-first UI for evidence upload and result submission (partner + gov flavors).
- Touch points:
  - `frontend/src/*` (new mobile app or mobile route)

### REQ-014: Non-road asset model (parks, trees, facilities, pumps)
- Type: Gap
- Priority: P1
- Outcome: Add or refactor asset schemas for non-road infrastructure with proper APIs.
- Touch points:
  - `backend/src/db/schema.ts`
  - `backend/src/routes/*`
  - `frontend/src/features/assets/*`

### REQ-015: Standard schemas per asset type
- Type: Gap
- Priority: P1
- Outcome: Define standard schemas for trees, park facilities, toilets, etc., and align APIs/import.
- Touch points:
  - `backend/src/db/schema.ts`
  - `docs/*` (schema definitions)
  - `sample-data/*`

### REQ-016: Demo dataset aligned to prototype scope
- Type: Gap
- Priority: P1
- Outcome: Provide minimal dataset (park + assets + events + workorders + evidence).
- Touch points:
  - `sample-data/*`
  - `backend/src/db/seed.ts`

## P2 - Supporting Gaps

### REQ-017: Visualization layer neutrality (documented adapters)
- Type: Gap
- Priority: P2
- Outcome: Document map layer as an upper layer and avoid coupling to a single renderer.
- Touch points:
  - `docs/map-implementation.md`
  - `docs/implementation-architecture.md`

### REQ-018: Standards alignment for handoff and interoperability
- Type: Gap
- Priority: P2
- Outcome: Clarify which open standards are used for core assets/events.
- Touch points:
  - `docs/NGSI-LD.md`
  - `docs/architecture-principles.md`
  - `docs/planning/ogc-api-scope.md`

### REQ-019: Map layer strategy (Event + WorkOrder simultaneous display)
- Type: Gap
- Priority: P2
- Outcome: Implement dual layers (Event area + WorkOrder points) and interaction rules for simultaneous display.
- Touch points:
  - `frontend/src/components/MapView.tsx`
  - `docs/map-implementation.md`

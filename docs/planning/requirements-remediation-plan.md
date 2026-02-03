# Requirements Remediation Plan (Prototype 1/30)

## Objective
Bring the current implementation into alignment with the Prototype Architecture and Scope (1/30 update), with explicit app separation, **two DBs (Master Data + Event/Case)** linked by a notification boundary, strict boundaries (roads read-only), and a WorkOrder/Evidence-centered workflow.

## Guiding Principles
- Two DBs (Master Data + Event/Case) with a notification boundary (no direct asset edits from Events).
- Prototype may host both DBs on the **same PostgreSQL instance** to control cost while keeping separation.
- Event closure is **Gov-only** and must confirm whether changes should be notified to Master Data.
- Gov Event Ops and Master Data are **different departments**; roles and permissions must be separated.
- Roads are read-only tiles/layers only; no editing and no Event linkage.
- Asset and Event are strictly separated; asset updates follow AssetChangeRequest -> Draft -> Review -> Publish.
- GIS is a presentation layer, not the core business system.
- App-level separation is mandatory: Gov, Public, Partner, Mobile are independent apps.
- Event can exist without WorkOrder; WorkOrder cannot exist without Event.
- Event status machine is fixed: Planned → Active → Pending Review → Closed → Archived.

## Phase Plan (Proposed)

### Phase 0: Boundary Freeze and Safety Rails
**Goal:** Prevent further drift from the new scope while planning core changes.

**Deliverables**
- Disable road asset edit UI flows and API write endpoints.
- Remove Event <-> Road linkage requirements from event creation/update paths.
- Add explicit "read-only road" warnings in docs and UI where applicable.

**Exit Criteria**
- Road assets cannot be modified via API or UI.
- Events no longer require roadAssetIds.

### Phase 1: Core Domain Remodel (Events, WorkOrders, Evidence)
**Goal:** Establish the correct Event lifecycle and WorkOrder/Evidence workflow.

**Deliverables**
- Add WorkOrder model and endpoints.
- Add Evidence/Attachment model and endpoints.
- Implement WorkOrder types (inspection/repair/update), multi-location, multi-partner assignment.
- Enforce Event/WorkOrder binding rules (WorkOrder requires Event; Event can exist without WorkOrder).
- Implement Event state machine: Planned → Active → Pending Review → Closed → Archived.
- Add review gate: Event closure goes through Pending Review before Closed.
- Event close flow requires Gov role (enforced via `X-User-Role` header; notification confirmation deferred to Phase 2).
- Support inspection → repair flow: Gov creates inspection WorkOrder, then creates repair WorkOrder under the **same Event** and assigns to partner(s).

**Exit Criteria**
- Event cannot close without WorkOrder completion + review.
- WorkOrder cannot exist without Event.
- Only Gov can close Events (notification decision deferred to Phase 2).

### Phase 2: AssetChangeRequest + Notification Boundary
**Goal:** Enforce asset update workflow and add an outbox/inbox boundary between Master Data DB and Event DB.

**Deliverables**
- AssetChangeRequest -> Draft -> Review -> Publish workflow.
- Notification bridge (outbox/inbox) for Event → Asset updates.
- Split DBs (Master Data DB + Event/Case DB). Prototype can run both on a single instance.
- Establish separate Gov roles: Event Ops vs Master Data (same org, different departments).
- Remove direct asset edits from Event system paths.

**Exit Criteria**
- Asset updates are only possible through AssetChangeRequest.
- Event workflows cannot directly modify assets.

### Phase 3: RBAC + Views + Identity
**Goal:** Enforce role-based access with explicit boundaries.

**Deliverables**
- Roles and permissions (gov_admin, gov_editor, partner_user, public_user).
- DB views for gov/partner/public visibility.
- API layer uses RBAC and views for data access.
- Separate Gov roles: Event Ops (close events) vs Master Data (asset review/notifications).

**Exit Criteria**
- Partner users only see assigned WorkOrders.
- Public users only see public assets.

### Phase 4: App Separation (Gov, Public, Partner, Mobile)
**Goal:** Implement distinct apps with correct UX and data boundaries.

**Deliverables**
- Gov Console app (assets, events, workorders).
- Public Portal app (read-only map + public assets + road tiles).
- Partner Portal app (assigned workorders + evidence submission).
- Mobile Mock: gov inspection app + partner field app (separate shells).
- Map shows Event areas + WorkOrder points simultaneously (gov + partner contexts).

**Exit Criteria**
- Each app runs independently with its own routes and UI.
- Role-specific UI and data access are enforced.

### Phase 5: Init Import + Demo Data + Standard Schemas
**Goal:** Demonstrate data onboarding, auditability, and standard schemas.

**Deliverables**
- Import pipeline for Excel + GIS (GeoPackage/Shapefile) + CAD evidence.
- ID mapping with legacyId and lineage metadata.
- Minimal demo dataset (park polygon + 5-10 assets + 2-3 events + workorders + evidence).
- Standard schemas for trees, park facilities, toilets, etc.

**Exit Criteria**
- Demo shows "Excel before -> Asset list after".
- Lineage metadata visible in UI/API.

## Dependencies and Risks
- Disabling road edits may break existing workflows; coordinate with demo stakeholders.
- WorkOrder/Evidence additions require new storage (DB + file/object storage).
- Notification boundary adds integration complexity (outbox/inbox — Phase 2).
- Event status change impacts existing UI and API contracts.
- RBAC and app separation impact all UI routing and API contracts.
- Import pipeline needs clear source data formats and field mapping decisions.

## Suggested Order of Execution
1. Phase 0 (prevent scope drift)
2. Phase 1 (event/workorder/evidence + status machine)
3. Phase 2 (master data separation + notification + asset change workflow)
4. Phase 3 (RBAC + views)
5. Phase 4 (app separation)
6. Phase 5 (init import + demo data + schemas)

## Success Criteria (Prototype-Level)
- Two DBs (may be co-located), different roles show different apps and capabilities.
- Event -> WorkOrder -> Evidence -> Close loop is fully demonstrable.
- Roads are tiles-only and explicitly out of scope for edits or Event linkage.
- Init import flow demonstrates ID mapping and lineage.
- Event status machine and review gate are visible in UI/API.
- Gov inspection + partner repair flow can be demonstrated end-to-end.
- Map shows Event areas and WorkOrder points at the same time.
- Event close is Gov-only and records notification decision to Master Data.

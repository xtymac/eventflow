# Requirements Remediation Plan (Prototype 1/28)

## Objective
Bring the current implementation into alignment with the Prototype Architecture and Scope (1/28), with explicit separation of apps, strict boundaries (roads read-only), and a WorkOrder/Evidence-centered workflow.

## Guiding Principles
- Single Master DB + Views + RBAC, not multiple databases.
- Roads are read-only tiles/layers only; no editing and no Event linkage.
- Asset and Event are strictly separated; asset updates follow AssetChangeRequest -> Draft -> Review -> Publish.
- GIS is a presentation layer, not the core business system.
- App-level separation is mandatory: Gov, Public, Partner, Mobile are independent apps.

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

### Phase 1: Core Domain Remodel (Assets, Events, WorkOrders)
**Goal:** Establish the correct domain model and workflow.

**Deliverables**
- Add WorkOrder model and endpoints.
- Add Evidence/Attachment model and endpoints.
- Enforce Event -> WorkOrder binding (1:1 or 1:N).
- Implement AssetChangeRequest -> Draft -> Review -> Publish workflow.

**Exit Criteria**
- Event cannot close without WorkOrder completion.
- Asset updates are only possible through AssetChangeRequest.

### Phase 2: RBAC + Views + Identity
**Goal:** Enforce role-based access with explicit boundaries.

**Deliverables**
- Roles and permissions (gov_admin, gov_editor, partner_user, public_user).
- DB views for gov/partner/public visibility.
- API layer uses RBAC and views for data access.

**Exit Criteria**
- Partner users only see assigned WorkOrders.
- Public users only see public assets.

### Phase 3: App Separation (Gov, Public, Partner, Mobile)
**Goal:** Implement distinct apps with correct UX and data boundaries.

**Deliverables**
- Gov Console app (assets, events, workorders).
- Public Portal app (read-only map + public assets + road tiles).
- Partner Portal app (assigned workorders + evidence submission).
- Mobile Mock (field upload UI).

**Exit Criteria**
- Each app runs independently with its own routes and UI.
- Role-specific UI and data access are enforced.

### Phase 4: Init Import + Demo Data
**Goal:** Demonstrate data onboarding and auditability.

**Deliverables**
- Import pipeline for Excel + GIS (GeoPackage/Shapefile) + CAD evidence.
- ID mapping with legacyId and lineage metadata.
- Minimal demo dataset (park polygon + 5-10 assets + 2-3 events + workorders + evidence).

**Exit Criteria**
- Demo shows "Excel before -> Asset list after".
- Lineage metadata visible in UI/API.

## Dependencies and Risks
- Disabling road edits may break existing workflows; coordinate with demo stakeholders.
- WorkOrder/Evidence additions require new storage (DB + file/object storage).
- RBAC and app separation impact all UI routing and API contracts.
- Import pipeline needs clear source data formats and field mapping decisions.

## Suggested Order of Execution
1. Phase 0 (prevent scope drift)
2. Phase 1 (domain model + workflow)
3. Phase 2 (RBAC + views)
4. Phase 3 (app separation)
5. Phase 4 (init import + demo data)

## Success Criteria (Prototype-Level)
- Same DB, different roles show different apps and capabilities.
- Event -> WorkOrder -> Evidence -> Close loop is fully demonstrable.
- Roads are tiles-only and explicitly out of scope for edits or Event linkage.
- Init import flow demonstrates ID mapping and lineage.

# Implementation Guide (Prototype)

This guide translates the latest requirements (meeting update: 2026-01-30) into actionable implementation steps. It is the **single source** for engineering execution.

## 1. Scope and Non-Negotiables

- Two **separate databases**:
  - **Master Data DB** (assets + authoritative ledger)
  - **Event/Case DB** (events + workorders + evidence)
  - Prototype may host both DBs on the **same PostgreSQL instance** to control cost.
- **Notification boundary** between Event DB and Master Data DB:
  - Event system cannot directly modify master data.
  - Event closure requires a notification decision.
- **Roads are read-only** tiles/layers; no editing, no Event linkage.
- GIS is a presentation layer; core value is ledger + workflow + auditability.
- Apps are separated: Gov, Public, Partner, Mobile.
- **Event close is Gov-only** (enforced via `X-User-Role: gov` header in Phase 1; notification decision deferred to Phase 2).
- **Gov Event Ops and Gov Master Data** are different departments; roles and permissions must be separated (Phase 3).
- **Map must show Event polygons + WorkOrder points simultaneously**.

## 2. Architecture Overview

```
Master Data DB (Phase 2)          Event/Case DB (Phase 1 ✓)
--------------------             ----------------------
assets                            events
asset_change_requests             work_orders
asset_versions                    work_order_locations
asset_audit                        work_order_partners
import_lineage                    evidence
inbox_notifications               (outbox — Phase 2)
```

> **Phase 2:** Notification flow (Event DB outbox → bridge → Master Data DB inbox) is not yet implemented. Phase 1 focuses on Event/WorkOrder/Evidence core workflow.

## 3. Roles and RBAC

### Roles
- **gov_event_ops**: create/update events, create workorders, close events
- **gov_master_data**: review asset change requests, process inbox notifications
- **partner_user**: view assigned workorders, submit evidence
- **public_user**: read-only assets/road tiles

### Key RBAC Rules
- Only `gov_event_ops` can close Events.
- Close flow will record **notification decision** (Phase 2; currently close records `closeNotes` only).
- `gov_master_data` is the only role that can publish asset changes.

## 4. Data Model (Minimum)

### Master Data DB
- **assets** (polygons/points/lines for parks/trees/facilities/etc)
  - `id`, `type`, `geometry`, `properties`, `legacyId`, `status`
- **asset_change_requests**
  - `id`, `assetId`, `changeType`, `draftData`, `status`
- **asset_versions**
  - `id`, `assetId`, `version`, `data`, `publishedAt`
- **import_lineage**
  - `sourceType`, `sourceId`, `importedAt`, `operator`
- **inbox_notifications**
  - `id`, `eventId`, `payload`, `status`, `receivedAt`

### Event/Case DB
- **events**
  - `id`, `name`, `status`, `geometry`, `startDate`, `endDate`, `department`
- **work_orders**
  - `id`, `eventId`, `type` (inspection/repair/update), `status`, `assignedDept`
- **work_order_locations**
  - `workOrderId`, `geometry`, `note`
- **work_order_partners**
  - `workOrderId`, `partnerId`
- **evidence**
  - `workOrderId`, `type`, `files[]`, `submittedBy`, `submittedAt`
- **outbox_notifications** (Phase 2 — not yet implemented)
  - `id`, `eventId`, `payload`, `status`, `createdAt`

## 5. Workflow Rules

### Event State Machine
`Planned → Active → Pending Review → Closed → Archived`

### WorkOrder Rules
- WorkOrder cannot exist without Event.
- Event can exist without WorkOrder.
- WorkOrder types: **inspection / repair / update**
- WorkOrder can have **multiple locations** and **multiple partners**.

### Gov Inspection → Partner Repair Flow
1) Gov creates Event  
2) Gov creates **Inspection WorkOrder**  
3) Gov executes inspection via **gov mobile app**  
4) If repair needed: create **Repair WorkOrder under the same Event**  
5) Assign repair WorkOrder to partner(s)  
6) Partner submits Evidence  
7) Gov reviews → Pending Review → Closed  
8) On close: Gov closes event with close notes (notification to Master Data deferred to Phase 2)

## 6. Notification Boundary (Outbox/Inbox) — Phase 2

> **Not yet implemented.** The outbox/inbox notification boundary between Event DB and Master Data DB is planned for Phase 2. Phase 1 focuses on Event/WorkOrder/Evidence core workflow with Gov-only close.

### When to notify (Phase 2)
- At **Event close**, if changes require Master Data update.

### Minimum payload (Phase 2)
- `eventId`, `assetId(s)`, `changeType`, `summary`, `evidenceLinks`

### Required behavior (Phase 2)
- Event close will record notification decision and dispatch to Master Data inbox.
- Master Data team handles inbox notifications as **input** to AssetChangeRequest.

## 7. API Surface (Draft)

### Event/Case DB
- `POST /events` `GET /events/:id`
- `PATCH /events/:id/status`
- `POST /workorders` `GET /workorders/:id`
- `POST /workorders/:id/evidence`
- `POST /events/:id/close` (Gov-only; notification decision deferred to Phase 2)

### Master Data DB
- `GET /assets`
- `POST /asset-change-requests`
- `PATCH /asset-change-requests/:id/status`
- `GET /notifications/inbox`

## 8. Map Layers (Simultaneous Display)

Layer order (top → bottom):
1) WorkOrder points
2) Event polygons/areas
3) Public assets (parks, facilities)
4) Road tiles (read-only)
5) Basemap

Interaction rules:
- Hover Event → show Event tooltip
- Click WorkOrder → open WorkOrder detail
- Filter toggles: Events / WorkOrders / Assets / Roads

## 9. App Separation

- **Gov Console**: assets + events + workorders + close/review
- **Partner Portal**: assigned workorders + evidence upload
- **Public Portal**: public assets + road tiles only
- **Mobile (Gov)**: inspection workorder forms + photos + location
- **Mobile (Partner)**: repair/update submission + photos + location

## 10. Demo Dataset (Minimum)

- 1 park polygon
- 5–10 assets (toilets, trees, lighting, pumps, facilities)
- 2–3 events
- Each event has ≥1 workorder
- Each workorder has ≥3 evidence photos

## 11. Implementation Phasing (Short Form)

1) **Phase 0**: freeze boundaries (roads read-only, remove event-road links) ✓
2) **Phase 1**: workorder/evidence + status machine + Gov-only close ✓
3) **Phase 2**: outbox/inbox + notification boundary + asset change workflow (two DBs)
4) **Phase 3**: RBAC + app separation
5) **Phase 4**: import + demo data + schemas

## 12. Open Questions

- Minimal park ledger fields?
- Partner submission format?
- Which Event info is public?
- Road system export formats for tiles?
- Existing unified IDs? If none, define strategy.

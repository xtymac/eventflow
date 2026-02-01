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
- **Event close is Gov-only** and must confirm whether changes need notification to Master Data.
- **Gov Event Ops and Gov Master Data** are different departments; roles and permissions must be separated.
- **Map must show Event polygons + WorkOrder points simultaneously**.

## 2. Architecture Overview

```
Master Data DB                    Event/Case DB
--------------------             ----------------------
assets                            events
asset_change_requests             work_orders
asset_versions                    work_order_locations
asset_audit                        work_order_partners
import_lineage                    evidence
inbox_notifications               outbox_notifications
```

Notification flow: Event DB writes **outbox_notifications** → bridge → Master Data DB **inbox_notifications**.

## 3. Roles and RBAC

### Roles
- **gov_event_ops**: create/update events, create workorders, close events
- **gov_master_data**: review asset change requests, process inbox notifications
- **partner_user**: view assigned workorders, submit evidence
- **public_user**: read-only assets/road tiles

### Key RBAC Rules
- Only `gov_event_ops` can close Events.
- Close flow must record **notification decision** (notify Master Data or not).
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
- **outbox_notifications**
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
8) On close: confirm whether to notify Master Data

## 6. Notification Boundary (Outbox/Inbox)

### When to notify
- At **Event close**, if changes require Master Data update.

### Minimum payload
- `eventId`, `assetId(s)`, `changeType`, `summary`, `evidenceLinks`

### Required behavior
- Event close records:
  - `notifyMasterData = true/false`
  - `notificationId` (if dispatched)
- Master Data team handles inbox notifications as **input** to AssetChangeRequest.

## 7. API Surface (Draft)

### Event/Case DB
- `POST /events` `GET /events/:id`
- `PATCH /events/:id/status`
- `POST /workorders` `GET /workorders/:id`
- `POST /workorders/:id/evidence`
- `POST /events/:id/close` (Gov-only; requires notification decision)

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

1) **Phase 0**: freeze boundaries (roads read-only, remove event-road links)
2) **Phase 1**: workorder/evidence + status machine
3) **Phase 2**: outbox/inbox + asset change workflow (two DBs)
4) **Phase 3**: RBAC + app separation
5) **Phase 4**: import + demo data + schemas

## 12. Open Questions

- Minimal park ledger fields?
- Partner submission format?
- Which Event info is public?
- Road system export formats for tiles?
- Existing unified IDs? If none, define strategy.

# Requirements Alignment Analysis (Prototype Architecture and Scope 1/30)

## Purpose
Compare the latest Prototype Architecture and Scope (1/30 update) requirements to the current implementation in this repo and identify alignments, gaps, and conflicts.

## Status Legend
- Aligned: Implemented and consistent with requirement.
- Partial: Implemented but incomplete or limited scope.
- Gap: Not implemented.
- Conflict: Implemented in a way that contradicts the requirement.

## Requirements Baseline (1/30 update)
- App-level separation: Gov Console, Public Portal, Partner Portal, Mobile Mock as **distinct apps** (Public + Partner are app-level separation).
- Role isolation: Views + RBAC for gov/partner/public.
- Boundary rules:
  - Roads are read-only tiles/layers only; **no editing** and **no Event linkage**.
  - GIS is presentation only; core is ledger + Event/WorkOrder workflow + auditability.
  - Asset and Event strictly separated; Asset updates via AssetChangeRequest -> Draft -> Review -> Publish.
- Two DBs with a notification boundary:
  - **Master Data DB** for assets and authoritative records.
  - **Event/Case DB** for events, workorders, evidence.
  - Event system cannot directly modify master data; uses a **notification/outbox** boundary.
  - Prototype may run both DBs on the **same PostgreSQL instance** to control cost, while keeping DB separation.
- Workflow updates:
  - **Event can exist without WorkOrder**, but WorkOrder cannot exist without Event.
  - Event may have multiple WorkOrders.
  - WorkOrder types: inspection / repair / update.
  - Evidence submission and review is mandatory for closure.
- Event state machine: Planned → Active → Pending Review → Closed → Archived.
- Gov can execute **inspection WorkOrders** using a gov mobile app; partner executes repair/update.
- Inspection may lead to a **Repair WorkOrder under the same Event**, assigned to partner(s).
- Partner portal boundaries: partner cannot create/close Events; can submit Evidence only for assigned WorkOrders.
- Event closure is **Gov-only** and must confirm whether changes should be notified to Master Data.
- Event ops and Master Data are **different gov departments**; roles must be separated even within Gov Console.
- Map display: **Event + WorkOrder shown simultaneously** (Event area/polygon + WorkOrder point/locations, multi-location allowed).
- Standard schemas required per asset type (trees, park facilities, toilets, etc.).
- Data strategy: OSM only as basemap; demo data is reference implementation aligned with CityOS/Digital Twin; init import from Excel/GIS/CAD with ID mapping and lineage.

## Current Implementation Snapshot (As-Is)
- Single web app with tabs for Events, Assets, Inspections. Evidence: `frontend/src/App.tsx`.
- Core tables focus on road assets and construction events with join table and change logs. Evidence: `backend/src/db/schema.ts`.
- Road assets are editable via REST and UI "road update mode". Evidence: `backend/src/routes/assets.ts`, `frontend/src/features/assets/RoadUpdateModePanel.tsx`.
- Events require roadAssetIds and link to roads. Evidence: `backend/src/routes/events.ts`, `backend/src/db/schema.ts`.
- Inspections exist as point records linked to events or road assets. Evidence: `backend/src/routes/inspections.ts`.
- Import/Export and versioning are for road assets via GeoJSON/GPKG. Evidence: `backend/src/routes/import-versions.ts`, `backend/src/services/import-version.ts`, `docs/import-export.md`.
- OGC API Features/Tiles for road assets, construction events, inspections. Evidence: `backend/src/routes/ogc`, `backend/src/services/ogc/collection-registry.ts`.
- OSM based data pipelines and fields for assets. Evidence: `backend/src/services/osm-sync.ts`, `scripts/osm/import-to-db.ts`, `backend/src/db/schema.ts`.
- No user/auth/RBAC model (OGC write uses optional API key only). Evidence: `backend/src/services/ogc/api-key-auth.ts`.
- No WorkOrder or Evidence tables/routes. Evidence: no matches for work_order in repo.
- No Public/Partner/Mobile apps. Evidence: `frontend/src/App.tsx`.

## Alignment Matrix

### Architecture and Boundaries
| Requirement | Status | Evidence | Notes |
| --- | --- | --- | --- |
| App-level separation (Gov/Public/Partner/Mobile as independent apps) | Gap | `frontend/src/App.tsx` | Single internal UI only. |
| Two DBs (Master Data + Event/Case) with Views + RBAC | Conflict | `backend/src/db/schema.ts` | Single DB exists; no DB separation or views/RBAC. |
| Asset/Event separation + notification boundary (no direct asset edits) | Conflict | `backend/src/routes/assets.ts`, `backend/src/routes/events.ts` | Assets are directly modified via Event flows; no outbox/inbox boundary. |
| Roads are read-only tiles/layers; no editing | Conflict | `backend/src/routes/assets.ts`, `frontend/src/features/assets/RoadUpdateModePanel.tsx`, `docs/import-export.md` | Roads are editable and have import/export workflows. |
| Roads cannot be linked to Events | Conflict | `backend/src/routes/events.ts`, `backend/src/db/schema.ts` | Events require roadAssetIds and use event_road_assets. |
| GIS is not core (presentation only) | Conflict | `docs/map-implementation.md`, `frontend/src/components/MapView.tsx` | GIS is central to editing and workflows. |
| Asset/Event separation; AssetChangeRequest flow | Conflict | `backend/src/routes/assets.ts` | Assets can be created/updated with eventId; no AssetChangeRequest workflow. |

### Apps and Roles
| Requirement | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Gov Console manages assets + Events + WorkOrders | Partial | `backend/src/db/schema.ts`, `frontend/src/App.tsx` | Only roads are editable; no WorkOrders or Evidence. |
| Public Portal (read-only disclosure) | Gap | `frontend/src/App.tsx` | No public app or routing. |
| Partner Portal (assigned WorkOrders + evidence) | Gap | `frontend/src/App.tsx` | No partner app or scoped data access. |
| Mobile Mock (gov inspection + partner submissions) | Gap | `frontend/src/App.tsx` | No mobile UI; no gov/partner split. |

### Workflow and Data Model
| Requirement | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Event -> WorkOrder -> Evidence -> Review/Close loop | Gap | `backend/src/db/schema.ts` | WorkOrder/Evidence models do not exist. |
| Event can exist without WorkOrder; WorkOrder requires Event | Gap | `backend/src/db/schema.ts` | No WorkOrder tables or routes. |
| WorkOrder types (inspection/repair/update), multi-location, multi-partner | Gap | `backend/src/db/schema.ts` | No WorkOrder tables or routes. |
| Gov inspection WorkOrders with gov mobile app | Gap | `frontend/src/App.tsx` | No mobile app or gov inspection flows. |
| Evidence (photos/results) submission | Gap | `backend/src/routes/inspections.ts` | Inspections exist, but no evidence/attachments model. |
| Event status machine (Planned/Active/Pending Review/Closed/Archived) | Conflict | `backend/src/routes/events.ts` | Current statuses: planned/active/ended + postEndDecision. |
| Event closure is Gov-only + notification confirmation | Gap | `backend/src/routes/events.ts` | No RBAC and no close-time notification confirmation. |
| Event can reference assets but cannot modify assets | Conflict | `backend/src/routes/assets.ts` | Asset updates are directly tied to eventId. |
| Notification boundary (outbox/inbox) for master data updates | Gap | `backend/src/*` | No notification/outbox mechanism exists. |
| Map display: Event + WorkOrder simultaneously | Gap | `frontend/src/components/MapView.tsx` | Map shows events/assets/inspections; no WorkOrder layer. |

### Data Strategy and Import
| Requirement | Status | Evidence | Notes |
| --- | --- | --- | --- |
| OSM is basemap only (not ledger) | Conflict | `backend/src/services/osm-sync.ts`, `backend/src/db/schema.ts` | OSM fields and sync populate asset tables. |
| Reference implementation aligned with CityOS/Digital Twin models | Gap | `backend/src/db/schema.ts` | Schema is road and OSM centric; no CityOS-aligned asset taxonomy. |
| Standard schemas per asset type | Gap | `backend/src/db/schema.ts` | No standard schema definitions for toilets/park facilities/trees. |
| Minimal demo dataset (park + assets + events + workorders + evidence) | Gap | `sample-data` | No dataset matching the required scenario. |
| Init import from Excel/GIS/CAD with ID mapping and lineage | Partial | `backend/src/routes/import-versions.ts`, `backend/src/services/import-version.ts` | GeoJSON/GPKG import for roads only; no Excel/CAD, legacyId, or lineage metadata. |
| Executable import script and before/after demo | Partial | `scripts/import-nagoya-to-assets.ts` | Scripts exist for roads; no Excel import flow. |

### Standards and Extensibility
| Requirement | Status | Evidence | Notes |
| Open standards to avoid vendor lock-in | Partial | `backend/src/routes/ogc`, `docs/import-export.md` | OGC Features/Tiles and GeoJSON/GPKG exist but only for road assets/events/inspections. |
| Visualization layer is tech-neutral | Partial | `docs/map-implementation.md` | MapLibre is open source, but map logic is tightly embedded in the main app. |

## Key Conflicts (Highest Priority)
1. Road assets are editable and Event-linked, but requirements mandate roads as read-only with no Event linkage.
2. Asset/Event separation is violated by eventId-driven asset changes; no AssetChangeRequest flow or notification boundary exists.
3. WorkOrder and Evidence model is missing, so the required closed-loop workflow is not implementable.
4. Event status machine and WorkOrder types do not exist; current statuses conflict with required lifecycle.
5. App-level separation and RBAC are absent; only a single internal UI exists.
6. OSM is used as asset source, conflicting with "OSM basemap only".

## Implications for Existing Modules
- Road asset editing (UI + APIs + QGIS workflows) is out of scope under the new boundary and should be deprecated or isolated.
- Import/Export and OSM sync are road-centric and should be refocused toward init import of park/asset ledgers and reference data.
- Event workflows need to be re-modeled around WorkOrders and Evidence rather than road edits and inspections.
- Existing event status transitions (planned/active/ended) must be replaced with the new lifecycle.
- A notification boundary between Event workflows and Asset updates must be introduced (two DBs, possibly on the same instance).

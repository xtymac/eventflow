# Requirements Alignment Analysis (Prototype Architecture and Scope 1/28)

## Purpose
Compare the latest Prototype Architecture and Scope (1/28) requirements to the current implementation in this repo and identify alignments, gaps, and conflicts.

## Status Legend
- Aligned: Implemented and consistent with requirement.
- Partial: Implemented but incomplete or limited scope.
- Gap: Not implemented.
- Conflict: Implemented in a way that contradicts the requirement.

## Requirements Baseline (1/28)
- App-level separation: Gov Console, Public Portal, Partner Portal, Mobile Mock as distinct apps.
- Single Master DB with Views and RBAC to separate roles.
- Boundary rules:
  - Roads are read-only tiles/layers only; no editing or Event linkage.
  - GIS is presentation only; core is ledger + Event/WorkOrder workflow + auditability.
  - Asset and Event strictly separated; Asset updates via AssetChangeRequest -> Draft -> Review -> Publish.
- Workflow: Event must bind WorkOrder(s); WorkOrder cannot exist without Event; Evidence submission and acceptance loop.
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
| Single Master DB (Assets, Events, WorkOrders, Evidence) | Partial | `backend/src/db/schema.ts` | Single DB exists, but WorkOrders/Evidence missing; assets are road-centric. |
| Views + RBAC to enforce role boundaries | Gap | `backend/src/services/ogc/api-key-auth.ts` | No auth, roles, or DB views. |
| Roads are read-only tiles/layers; no editing | Conflict | `backend/src/routes/assets.ts`, `frontend/src/features/assets/RoadUpdateModePanel.tsx`, `docs/import-export.md` | Roads are editable and have import/export workflows. |
| Roads cannot be linked to Events | Conflict | `backend/src/routes/events.ts`, `backend/src/db/schema.ts` | Events require roadAssetIds and use event_road_assets. |
| GIS is not core (presentation only) | Conflict | `docs/map-implementation.md`, `frontend/src/components/MapView.tsx` | GIS is central to editing and workflows. |
| Asset/Event separation; AssetChangeRequest flow | Conflict | `backend/src/routes/assets.ts` | Assets can be created/updated with eventId; no AssetChangeRequest workflow. |

### Apps and Roles
| Requirement | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Gov Console manages parks/trees/rivers/pumps/facilities + Events + WorkOrders | Partial | `backend/src/db/schema.ts`, `frontend/src/App.tsx` | Only roads are editable; some non-road read-only assets exist (rivers/greenspaces/streetlights); no WorkOrders. |
| Public Portal (read-only disclosure) | Gap | `frontend/src/App.tsx` | No public app or routing. |
| Partner Portal (assigned tasks + evidence) | Gap | `frontend/src/App.tsx` | No partner app or scoped data access. |
| Mobile Mock (field evidence submission) | Gap | `frontend/src/App.tsx` | No mobile UI. |

### Workflow and Data Model
| Requirement | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Event -> WorkOrder -> Evidence -> Accept/Close loop | Gap | `backend/src/db/schema.ts` | WorkOrder/Evidence models do not exist. |
| Event must bind WorkOrder(s) | Gap | `backend/src/db/schema.ts` | No WorkOrder tables or routes. |
| Evidence (photos/results) submission | Gap | `backend/src/routes/inspections.ts` | Inspections exist, but no evidence/attachments model. |
| Event can reference assets but cannot modify assets | Conflict | `backend/src/routes/assets.ts` | Asset updates are directly tied to eventId. |

### Data Strategy and Import
| Requirement | Status | Evidence | Notes |
| --- | --- | --- | --- |
| OSM is basemap only (not ledger) | Conflict | `backend/src/services/osm-sync.ts`, `backend/src/db/schema.ts` | OSM fields and sync populate asset tables. |
| Reference implementation aligned with CityOS/Digital Twin models | Gap | `backend/src/db/schema.ts` | Schema is road and OSM centric; no CityOS-aligned asset taxonomy. |
| Minimal demo dataset (park + assets + events + workorders + evidence) | Gap | `sample-data` | No dataset matching the required scenario. |
| Init import from Excel/GIS/CAD with ID mapping and lineage | Partial | `backend/src/routes/import-versions.ts`, `backend/src/services/import-version.ts` | GeoJSON/GPKG import for roads only; no Excel/CAD, legacyId, or lineage metadata. |
| Executable import script and before/after demo | Partial | `scripts/import-nagoya-to-assets.ts` | Scripts exist for roads; no Excel import flow. |

### Standards and Extensibility
| Requirement | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Open standards to avoid vendor lock-in | Partial | `backend/src/routes/ogc`, `docs/import-export.md` | OGC Features/Tiles and GeoJSON/GPKG exist but only for road assets/events/inspections. |
| Visualization layer is tech-neutral | Partial | `docs/map-implementation.md` | MapLibre is open source, but map logic is tightly embedded in the main app. |

## Key Conflicts (Highest Priority)
1. Road assets are editable and Event-linked, but requirements mandate roads as read-only with no Event linkage.
2. Asset/Event separation is violated by eventId-driven asset changes; no AssetChangeRequest flow exists.
3. WorkOrder and Evidence model is missing, so the required closed-loop workflow is not implementable.
4. App-level separation and RBAC are absent; only a single internal UI exists.
5. OSM is used as asset source, conflicting with "OSM basemap only".

## Implications for Existing Modules
- Road asset editing (UI + APIs + QGIS workflows) is out of scope under the new boundary and should be deprecated or isolated.
- Import/Export and OSM sync are road-centric and should be refocused toward init import of park/asset ledgers and reference data.
- Event workflows need to be re-modeled around WorkOrders and Evidence rather than road edits and inspections.

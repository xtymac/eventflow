# Implementation Architecture (Prototype)

This document defines the prototype implementation architecture based on the latest scope and boundary decisions.

## Summary (Non-Negotiable)

- **App-Level Separation**: Public Portal (02) and Partner Portal (03) are independent apps, not just UI splits.
- **Single Master DB**: One authoritative database with Views + RBAC, not multiple databases.
- **Asset / Event Separation**: Events never edit assets directly; assets update only through a controlled change flow.
- **Roads Are Read-Only**: Road data is displayed as tiles/layers only; no editing, no Event linkage.
- **GIS Is Not Core**: GIS is a presentation layer; the core is ledger + workflow + auditability.

---

## Architecture Overview

```
+-----------------------------------------------------------------+
|                           Master DB                             |
| Assets / Events / WorkOrders / Evidence / Audit / Lineage        |
+-----------------------------------------------------------------+
                              |
                              v
+-----------------------------------------------------------------+
|                       Core API / Domain                         |
|  - Asset change workflow                                        |
|  - Event + WorkOrder lifecycle                                  |
|  - Evidence submission & review                                 |
+-----------------------------------------------------------------+
                              |
                              v
+-----------------------------------------------------------------+
|                         Views + RBAC                            |
|  - gov_* views                                                   |
|  - partner_* views                                               |
|  - public_* views                                                |
+-----------------------------------------------------------------+
         |                     |                      |
         v                     v                      v
+----------------+   +------------------+   +------------------+
| Gov Console     |   | Partner Portal   |   | Public Portal    |
| (App 01)        |   | (App 03)         |   | (App 02)         |
+----------------+   +------------------+   +------------------+
                              |
                              v
+-----------------------------------------------------------------+
| Mobile / Field Inspector Mock (App 04)                          |
+-----------------------------------------------------------------+
```

---

## Core Data Boundaries

### Asset (Ledger)
- Authoritative, long-lived infrastructure records.
- Updated only via **AssetChangeRequest -> Draft -> Review -> Publish**.
- Includes parks, trees, facilities, rivers, pumps, lights, etc.
- **Roads are excluded from edit scope**.

### Event (Operational History)
- Time-bound administrative record (inspection, repair, project).
- Must reference assets but **cannot edit assets**.
- **Every Event must bind to WorkOrder(s)** (1:1 or 1:N).

### WorkOrder
- Execution unit tied to a specific Event.
- Cannot exist without an Event.
- Receives Evidence and inspection results.

### Evidence / Inspection
- Photos, forms, results; triggers status transitions.

---

## Access Control (RBAC + Views)

- **Single Master DB**
- Role-based access enforced at API and view layer.
- Example view split:
  - `gov_assets_view`, `gov_events_view`, `gov_workorders_view`
  - `partner_workorders_view` (only assigned tasks)
  - `public_assets_view` (public-only fields)

---

## Apps (Roles & Boundaries)

### App 01: Gov Console
- Manage assets (excluding roads)
- Create Events and link assets
- Issue WorkOrders and accept Evidence

### App 02: Public Portal
- Public assets only (parks, basic info)
- Road tiles/layers read-only
- No Event/WorkOrder visibility

### App 03: Partner Portal
- View assigned WorkOrders / Events
- Submit Evidence & results
- No access to unrelated Events or asset editing

### App 04: Mobile / Field Inspector Mock
- On-site submission (photos, results)
- Evidence upload & status update

---

## Workflow (Mandatory Demo Loop)

```
Create Event -> Bind WorkOrder -> Execute -> Submit Evidence -> Review -> Close
```

- Event cannot be closed without WorkOrder completion.
- WorkOrder cannot exist without Event.

---

## Road Data Handling

- Road data is **read-only tiles/layers**.
- No feature editing, no Event binding.
- Roads are excluded from the core business loop.

---

## Data Strategy (Prototype)

- **OSM is only a basemap**, not a ledger source.
- Demo data is a **reference implementation**, aligned with CityOS / Digital Twin models.

### Minimum Demo Dataset
- 1 park polygon
- 5-10 assets inside the park
- 2-3 events
  - each event has >=1 workorder
  - each workorder has >=3 evidence photos

---

## Init Import (Required)

### Sources
- Excel ledger (park info)
- Shapefile / GeoPackage (tree locations)
- CAD drawings (stored as evidence, not converted to features)

### ID Mapping
- Generate UUIDs when legacy IDs are missing
- Preserve existing IDs as `legacyId`
- Record lineage metadata (source, time, operator)

### Script Requirement
- Provide at least one executable import script (Python or SQL)
- Demo must show: **Excel before -> Asset list after**

---

## High Points for Demo

- Same DB, different roles, **completely different interfaces**
- Full **Event -> WorkOrder -> Evidence -> Close** loop
- Road layer is read-only (clearly out of scope)
- Init Import exists and is shown

---

## Open Questions (Before 2/2)

1. Minimal field set for park ledger?
2. Partner submission format (photo, form fields, signature, accuracy)?
3. What portion of Events can be public, and at what granularity?
4. What data export formats are available from Michilog (road system)?
5. Existing unified IDs? If none, how should we generate and maintain them?

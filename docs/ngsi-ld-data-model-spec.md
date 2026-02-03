# NGSI-LD Data Model Specification — Nagoya Construction Lifecycle

> **Standards**: ETSI GS CIM 009 (NGSI-LD) + FIWARE Smart Data Models
> **Version**: 1.1.0 (RFI追加: 街路樹/公園施設/舗装/ポンプ/点検/LCC)
> **Date**: 2026-02-03

---

## 1. Overview

This document defines the canonical data models for the Nagoya Construction Lifecycle system using the **NGSI-LD** information model (ETSI standard) and **FIWARE Smart Data Models** as reference templates.

### 1.1 Why NGSI-LD

| Benefit | Description |
|---------|-------------|
| **International standard** | ETSI ISG CIM — adopted by EU, OASC, and smart city programs globally |
| **Semantic interoperability** | JSON-LD + @context enables cross-system data exchange without schema coupling |
| **Context broker ready** | Direct compatibility with Orion-LD / Scorpio brokers for publish/subscribe |
| **Property graph model** | Entity → Property/Relationship/GeoProperty cleanly maps to our domain |
| **Industry templates** | FIWARE Smart Data Models provide pre-defined schemas for roads, buildings, streetlights, parks |

### 1.2 Scope

All municipal infrastructure assets and construction lifecycle entities are modeled as **NGSI-LD entities** with:
- Unique URN identifiers (`urn:ngsi-ld:{Type}:{id}`)
- Typed attributes (Property, Relationship, GeoProperty)
- JSON-LD @context for semantic resolution
- Bidirectional converters between internal PostGIS format and external NGSI-LD format

---

## 2. Entity Catalog

| Entity Type | FIWARE Base Model | Domain | Description |
|-------------|-------------------|--------|-------------|
| `CivicOperation` | `BuildingOperation` | Event/Case | Time-bound construction or maintenance operation |
| `WorkOrder` | `IssueReporting` | Event/Case | Specific task (inspection, repair, update) under an operation |
| `WorkLocation` | *(custom)* | Event/Case | Geographic point/area where work is performed |
| `Organization` | `Organization` (schema.org) | Event/Case | Partner/contractor assigned to a work order |
| `Road` | `Road` | Master Data | Logical road entity with centerline/polygon geometry |
| `GreenSpace` | `Garden` | Master Data | Park, garden, or green area |
| `Streetlight` | `Streetlight` | Master Data | Public lighting fixture |
| `WaterBody` | *(custom)* | Master Data | River, stream, canal, or drain |
| `Evidence` | *(custom)* | Event/Case | Photo/document/report attached to work order |
| `DesignatedRoad` | *(custom)* | Reference | Nagoya municipal road designation (MVT source) |
| `BuildingZone` | *(custom)* | Reference | Nagoya building regulation zone (MVT source) |
| `StreetTree` | `FlowerBed` (extended) | Master Data | Managed street tree (RFI: 街路樹維持管理台帳) |
| `ParkFacility` | *(custom)* | Master Data | Park facility: toilet, playground, bench, etc. (RFI: 公園管理) |
| `PavementSection` | *(custom)* | Master Data | Road pavement condition section (RFI: 舗装維持補修) |
| `PumpStation` | *(custom)* | Master Data | Stormwater/sewage pump station (RFI: ポンプ施設管理) |
| `InspectionRecord` | *(custom)* | Cross-cutting | Inspection/diagnostic record for any asset |
| `LifecyclePlan` | *(custom)* | Cross-cutting | Lifecycle cost / longevity plan (LCC / 長寿命化計画) |

---

## 3. Entity Relationship Graph

```
┌─────────────────────── EVENT/CASE LAYER ───────────────────────┐
│                                                                │
│ CivicOperation ──refAffectedAsset──▶ (any asset)              │
│       │                                                        │
│       ├──refWorkOrder──▶ WorkOrder                             │
│       │                     ├──refWorkLocation──▶ WorkLocation │
│       │                     │                      └──refAsset──▶ (any asset)
│       │                     ├──refPartner──▶ Organization      │
│       │                     └──refEvidence──▶ Evidence         │
│       │                                                        │
│       └── InspectionRecord ──refInspectedAsset──▶ (any asset) │
└────────────────────────────────────────────────────────────────┘

┌─────────────────────── MASTER DATA LAYER ─────────────────────┐
│                                                                │
│ Road ──refRoadSegment──▶ RoadSegment (future)                 │
│    └──refReplacedBy──▶ Road                                   │
│                                                                │
│ GreenSpace ◀──refGreenSpace── ParkFacility                   │
│                                  └──refLifecyclePlan──▶ LCP   │
│                                                                │
│ StreetTree ──refRoad──▶ Road                                  │
│           └──refGreenSpace──▶ GreenSpace                      │
│                                                                │
│ Streetlight ──refRoad──▶ Road                                 │
│                                                                │
│ PavementSection ──refRoad──▶ Road                             │
│                  └──refLifecyclePlan──▶ LifecyclePlan         │
│                                                                │
│ PumpStation ──refWaterBody──▶ WaterBody                       │
│            └──refLifecyclePlan──▶ LifecyclePlan               │
│                                                                │
│ LifecyclePlan ──refAsset──▶ (any asset)                       │
└────────────────────────────────────────────────────────────────┘

┌─────────────────────── REFERENCE LAYER ───────────────────────┐
│ DesignatedRoad (no operational relationships)                  │
│ BuildingZone   (no operational relationships)                  │
└────────────────────────────────────────────────────────────────┘
```

---

## 4. Entity Definitions

### 4.1 CivicOperation

**FIWARE base**: `dataModel.Building/BuildingOperation`
**Extension**: Generalized from building-only to any civic infrastructure; adds restriction zones, post-end decisions, governance workflow.

| Property | NGSI-LD Type | Value Type | Required | FIWARE Origin |
|----------|-------------|------------|----------|---------------|
| `id` | — | URI | ✓ | `urn:ngsi-ld:CivicOperation:{uuid}` |
| `type` | — | string | ✓ | `"CivicOperation"` |
| `name` | Property | string | ✓ | schema:name |
| `description` | Property | string | | schema:description |
| `status` | Property | enum | ✓ | BuildingOperation.status |
| `startDate` | Property | DateTime | ✓ | BuildingOperation.startDate |
| `endDate` | Property | DateTime | ✓ | BuildingOperation.endDate |
| `dateStarted` | Property | DateTime | | BuildingOperation.dateStarted |
| `dateFinished` | Property | DateTime | | BuildingOperation.dateFinished |
| `restrictionCategory` | Property | enum | ✓ | *custom* |
| `location` | GeoProperty | Polygon | ✓ | common |
| `geometrySource` | Property | enum | | *custom* |
| `postEndDecision` | Property | enum | ✓ | *custom* |
| `department` | Property | string | ✓ | *custom* |
| `ward` | Property | string | | *custom* |
| `createdBy` | Property | string | | *custom* |
| `closedBy` | Property | string | | *custom* |
| `closedAt` | Property | DateTime | | *custom* |
| `closeNotes` | Property | string | | *custom* |
| `archivedAt` | Property | DateTime | | *custom* |
| `refAffectedAsset` | Relationship | URI[] | | *custom* |
| `refWorkOrder` | Relationship | URI[] | | *custom* |

**Status lifecycle mapping** (internal → NGSI-LD):

| Internal Status | NGSI-LD Status | FIWARE BuildingOperation |
|----------------|---------------|--------------------------|
| `planned` | `planned` | ✓ `planned` |
| `active` | `ongoing` | ✓ `ongoing` |
| `pending_review` | `pendingReview` | *extension* |
| `closed` | `finished` | ✓ `finished` |
| `archived` | `archived` | *extension* |
| `cancelled` | `cancelled` | ✓ `cancelled` |

**NGSI-LD Normalized Example**:

```json
{
  "id": "urn:ngsi-ld:CivicOperation:evt-001",
  "type": "CivicOperation",
  "name": {
    "type": "Property",
    "value": "鶴舞公園 遊歩道改修工事"
  },
  "status": {
    "type": "Property",
    "value": "ongoing"
  },
  "startDate": {
    "type": "Property",
    "value": "2026-03-01T00:00:00Z"
  },
  "endDate": {
    "type": "Property",
    "value": "2026-06-30T00:00:00Z"
  },
  "restrictionCategory": {
    "type": "Property",
    "value": "partialClosure"
  },
  "location": {
    "type": "GeoProperty",
    "value": {
      "type": "Polygon",
      "coordinates": [[[136.9136, 35.1560], [136.9150, 35.1560], [136.9150, 35.1575], [136.9136, 35.1575], [136.9136, 35.1560]]]
    }
  },
  "postEndDecision": {
    "type": "Property",
    "value": "pending"
  },
  "department": {
    "type": "Property",
    "value": "緑政土木局"
  },
  "ward": {
    "type": "Property",
    "value": "昭和区"
  },
  "refAffectedAsset": {
    "type": "Relationship",
    "object": ["urn:ngsi-ld:Road:road-042", "urn:ngsi-ld:GreenSpace:gs-015"]
  },
  "refWorkOrder": {
    "type": "Relationship",
    "object": ["urn:ngsi-ld:WorkOrder:wo-101", "urn:ngsi-ld:WorkOrder:wo-102"]
  },
  "@context": [
    "https://nagoya-construction.example.org/ngsi-ld/v1/context.jsonld",
    "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld"
  ]
}
```

---

### 4.2 WorkOrder

**FIWARE base**: `dataModel.IssueTracking/IssueReporting`
**Extension**: Multi-location, multi-partner, evidence review gate.

| Property | NGSI-LD Type | Value Type | Required | FIWARE Origin |
|----------|-------------|------------|----------|---------------|
| `id` | — | URI | ✓ | `urn:ngsi-ld:WorkOrder:{uuid}` |
| `type` | — | string | ✓ | `"WorkOrder"` |
| `title` | Property | string | ✓ | IssueReporting.title |
| `description` | Property | string | | IssueReporting.description |
| `category` | Property | enum | ✓ | IssueReporting.category |
| `resolutionStatus` | Property | enum | ✓ | IssueReporting.resolutionStatus |
| `assignedDepartment` | Property | string | | IssueReporting.departmentId |
| `assignedBy` | Property | string | | *custom* |
| `assignedAt` | Property | DateTime | | *custom* |
| `dueDate` | Property | DateTime | | *custom* |
| `dateStarted` | Property | DateTime | | *custom* |
| `dateFinished` | Property | DateTime | | *custom* |
| `reviewedBy` | Property | string | | *custom* |
| `reviewedAt` | Property | DateTime | | *custom* |
| `reviewNotes` | Property | string | | *custom* |
| `refCivicOperation` | Relationship | URI | ✓ | *custom* |
| `refWorkLocation` | Relationship | URI[] | | *custom* |
| `refPartner` | Relationship | URI[] | | *custom* |
| `refEvidence` | Relationship | URI[] | | *custom* |

**Status mapping** (internal → NGSI-LD):

| Internal | NGSI-LD | FIWARE IssueReporting |
|----------|---------|----------------------|
| `draft` | `open` | ✓ `Open` |
| `assigned` | `assigned` | ✓ `Assigned` |
| `in_progress` | `inProgress` | ✓ `InProgress` |
| `completed` | `closed` | ✓ `Closed` |
| `cancelled` | `cancelled` | *extension* |

---

### 4.3 Road

**FIWARE base**: `dataModel.Transportation/Road`

| Property | NGSI-LD Type | Value Type | Required | FIWARE Origin |
|----------|-------------|------------|----------|---------------|
| `id` | — | URI | ✓ | `urn:ngsi-ld:Road:{uuid}` |
| `type` | — | string | ✓ | `"Road"` |
| `name` | Property | string | | Road.name |
| `alternateName` | Property | string | | Road.alternateName (name:ja) |
| `refCode` | Property | string | | *custom* (route ref) |
| `localRef` | Property | string | | *custom* |
| `displayName` | Property | string | | *custom* (computed) |
| `roadClass` | Property | enum | ✓ | Road.roadClass |
| `totalLaneNumber` | Property | number | | RoadSegment.totalLaneNumber |
| `direction` | Property | string | | *custom* |
| `responsible` | Property | string | | Road.responsible |
| `location` | GeoProperty | LineString/Polygon | ✓ | Road.location |
| `status` | Property | enum | ✓ | *custom lifecycle* |
| `validFrom` | Property | DateTime | ✓ | *custom* |
| `validTo` | Property | DateTime | | *custom* |
| `ward` | Property | string | | *custom* |
| `landmark` | Property | string | | *custom* |
| `sublocality` | Property | string | | *custom* |
| `crossSection` | Property | string | | *custom* |
| `managingDept` | Property | string | | *custom* |
| `intersection` | Property | string | | *custom* |
| `pavementState` | Property | string | | *custom* |
| `nameSource` | Property | string | | *custom provenance* |
| `nameConfidence` | Property | string | | *custom provenance* |
| `dataProvider` | Property | string | | common.dataProvider |
| `sourceVersion` | Property | string | | *custom provenance* |
| `sourceDate` | Property | DateTime | | *custom provenance* |
| `lastVerifiedAt` | Property | DateTime | | *custom provenance* |
| `osmType` | Property | string | | *custom OSM sync* |
| `osmId` | Property | number | | *custom OSM sync* |
| `osmTimestamp` | Property | DateTime | | *custom OSM sync* |
| `lastSyncedAt` | Property | DateTime | | *custom OSM sync* |
| `isManuallyEdited` | Property | boolean | | *custom* |
| `refRoadSegment` | Relationship | URI[] | | Road.refRoadSegment |
| `refReplacedBy` | Relationship | URI | | *custom lifecycle* |

---

### 4.4 GreenSpace

**FIWARE base**: `dataModel.ParksAndGardens/Garden`

| Property | NGSI-LD Type | Value Type | Required | FIWARE Origin |
|----------|-------------|------------|----------|---------------|
| `id` | — | URI | ✓ | `urn:ngsi-ld:GreenSpace:{uuid}` |
| `type` | — | string | ✓ | `"GreenSpace"` |
| `name` | Property | string | | Garden.name |
| `alternateName` | Property | string | | common.alternateName |
| `displayName` | Property | string | | *custom* |
| `category` | Property | enum | ✓ | Garden.category |
| `operator` | Property | string | | Garden.operator |
| `openingHours` | Property | string[] | | Garden.openingHours |
| `location` | GeoProperty | Polygon | ✓ | common |
| `areaServed` | Property | number (m²) | | *custom (area calc)* |
| `leisureType` | Property | string | | *custom (OSM)* |
| `landuseType` | Property | string | | *custom (OSM)* |
| `naturalType` | Property | string | | *custom (OSM)* |
| `vegetationType` | Property | string | | *custom* |
| `status` | Property | enum | ✓ | *custom lifecycle* |
| `ward` | Property | string | | *custom* |
| `dataProvider` | Property | string | | common.dataProvider |
| *(OSM sync fields)* | Property | various | | *custom* |

---

### 4.5 Streetlight

**FIWARE base**: `dataModel.Streetlighting/Streetlight`

| Property | NGSI-LD Type | Value Type | Required | FIWARE Origin |
|----------|-------------|------------|----------|---------------|
| `id` | — | URI | ✓ | `urn:ngsi-ld:Streetlight:{uuid}` |
| `type` | — | string | ✓ | `"Streetlight"` |
| `lampId` | Property | string | | *custom (physical ID)* |
| `displayName` | Property | string | | *custom* |
| `lampTechnology` | Property | enum | ✓ | Streetlight.lampTechnology |
| `powerConsumption` | Property | number (W) | | Streetlight.powerConsumption |
| `dateInstalled` | Property | DateTime | | Streetlight.dateInstalled |
| `operatingStatus` | Property | enum | ✓ | Streetlight.status |
| `location` | GeoProperty | Point | ✓ | common |
| `status` | Property | enum | ✓ | *custom lifecycle* |
| `ward` | Property | string | | *custom* |
| `refRoad` | Relationship | URI | | *custom (road ref)* |
| `dataProvider` | Property | string | | common.dataProvider |

**Lamp technology mapping** (internal → NGSI-LD):

| Internal | NGSI-LD (FIWARE) |
|----------|------------------|
| `led` | `LED` |
| `sodium` | `HPS` |
| `mercury` | `mercuryVapor` |
| `fluorescent` | `fluorescent` |
| `halogen` | `halogen` |

---

### 4.6 WaterBody

**Custom entity** — no direct FIWARE equivalent. Follows NGSI-LD patterns.

| Property | NGSI-LD Type | Value Type | Required |
|----------|-------------|------------|----------|
| `id` | — | URI | ✓ |
| `type` | — | string | ✓ |
| `name` | Property | string | |
| `alternateName` | Property | string | |
| `displayName` | Property | string | |
| `category` | Property | enum (river/stream/canal/drain) | ✓ |
| `width` | Property | number (m) | |
| `managementLevel` | Property | enum | |
| `maintainer` | Property | string | |
| `location` | GeoProperty | LineString/Polygon | ✓ |
| `geometryRepresentation` | Property | enum (line/polygon/collection) | ✓ |
| `status` | Property | enum | ✓ |
| `ward` | Property | string | |
| `dataProvider` | Property | string | |
| *(OSM sync fields)* | Property | various | |

---

### 4.7 Evidence

**Custom entity** — no direct FIWARE equivalent.

| Property | NGSI-LD Type | Value Type | Required |
|----------|-------------|------------|----------|
| `id` | — | URI | ✓ |
| `type` | — | string | ✓ |
| `title` | Property | string | |
| `description` | Property | string | |
| `mediaType` | Property | enum | ✓ |
| `fileName` | Property | string | ✓ |
| `filePath` | Property | string | ✓ |
| `fileSizeBytes` | Property | number | |
| `mimeType` | Property | string | |
| `captureDate` | Property | DateTime | |
| `location` | GeoProperty | Point | |
| `submittedBy` | Property | string | ✓ |
| `submittedAt` | Property | DateTime | ✓ |
| `reviewStatus` | Property | enum | ✓ |
| `reviewedBy` | Property | string | |
| `reviewedAt` | Property | DateTime | |
| `reviewNotes` | Property | string | |
| `refWorkOrder` | Relationship | URI | ✓ |

---

### 4.8 StreetTree (RFI: 街路樹維持管理台帳)

**Custom entity** — extends FIWARE ParksAndGardens patterns for individual tree management.

| Property | NGSI-LD Type | Value Type | Required |
|----------|-------------|------------|----------|
| `id` | — | URI | ✓ |
| `type` | — | string | ✓ |
| `ledgerId` | Property | string | | (台帳番号)
| `displayName` | Property | string | |
| `speciesName` | Property | string | | (和名)
| `scientificName` | Property | string | | (学名)
| `category` | Property | enum | ✓ | deciduous/evergreen/conifer/palmLike/shrub
| `trunkDiameter` | Property | number (cm) | | (胸高直径)
| `height` | Property | number (m) | | (樹高)
| `crownSpread` | Property | number (m) | | (枝張り)
| `datePlanted` | Property | DateTime | |
| `estimatedAge` | Property | number (yr) | |
| `healthStatus` | Property | enum | ✓ | healthy/declining/hazardous/dead/removed
| `conditionGrade` | Property | enum | | A/B/C/D/S
| `lastDiagnosticDate` | Property | DateTime | |
| `diagnosticNotes` | Property | string | |
| `location` | GeoProperty | Point | ✓ |
| `status` | Property | enum | ✓ |
| `ward` | Property | string | |
| `managingDept` | Property | string | |
| `refRoad` | Relationship | URI | |
| `refGreenSpace` | Relationship | URI | |
| `refInspectionRecord` | Relationship | URI[] | |
| `refLifecyclePlan` | Relationship | URI | |

---

### 4.9 ParkFacility (RFI: 公園管理 施設情報)

**Custom entity** — covers toilets, playground equipment, benches, shelters, fences, etc.

| Property | NGSI-LD Type | Value Type | Required |
|----------|-------------|------------|----------|
| `id` | — | URI | ✓ |
| `type` | — | string | ✓ |
| `facilityId` | Property | string | | (施設管理番号)
| `name` | Property | string | ✓ |
| `description` | Property | string | |
| `category` | Property | enum | ✓ | toilet/playground/bench/shelter/fence/gate/drainage/lighting/waterFountain/signBoard/pavement/sportsFacility/building/other
| `subCategory` | Property | string | |
| `dateInstalled` | Property | DateTime | | (設置日)
| `manufacturer` | Property | string | |
| `material` | Property | string | |
| `quantity` | Property | number | |
| `designLife` | Property | number (yr) | | (設計供用年数)
| `conditionGrade` | Property | enum | | A/B/C/D/S (劣化度)
| `lastInspectionDate` | Property | DateTime | |
| `nextInspectionDate` | Property | DateTime | |
| `safetyConcern` | Property | boolean | |
| `location` | GeoProperty | Point/Polygon | ✓ |
| `status` | Property | enum | ✓ |
| `ward` | Property | string | |
| `managingDept` | Property | string | |
| `refGreenSpace` | Relationship | URI | ✓ | (parent park)
| `refInspectionRecord` | Relationship | URI[] | |
| `refLifecyclePlan` | Relationship | URI | |

---

### 4.10 PavementSection (RFI: 舗装維持補修支援)

**Custom entity** — road pavement condition management with Japanese MCI index.

| Property | NGSI-LD Type | Value Type | Required |
|----------|-------------|------------|----------|
| `id` | — | URI | ✓ |
| `type` | — | string | ✓ |
| `sectionId` | Property | string | | (区間管理番号)
| `name` | Property | string | |
| `routeNumber` | Property | string | | (路線番号)
| `pavementType` | Property | enum | ✓ | asphalt/concrete/interlocking/gravel/other
| `length` | Property | number (m) | |
| `width` | Property | number (m) | |
| `thickness` | Property | number (cm) | |
| `lastResurfacingDate` | Property | DateTime | | (最終舗装年度)
| `mci` | Property | number | | Maintenance Control Index (維持管理指数)
| `crackRate` | Property | number (%) | | (ひび割れ率)
| `rutDepth` | Property | number (mm) | | (わだち掘れ量)
| `iri` | Property | number (m/km) | | International Roughness Index (平坦性)
| `lastMeasurementDate` | Property | DateTime | |
| `plannedInterventionYear` | Property | number | | (計画年度)
| `estimatedCost` | Property | number (JPY) | | (概算費用)
| `priorityRank` | Property | number | |
| `location` | GeoProperty | LineString/Polygon | ✓ |
| `status` | Property | enum | ✓ |
| `ward` | Property | string | |
| `refRoad` | Relationship | URI | ✓ |
| `refInspectionRecord` | Relationship | URI[] | |
| `refLifecyclePlan` | Relationship | URI | |

---

### 4.11 PumpStation (RFI: ポンプ施設管理)

**Custom entity** — pump facility management (調達対象外 but defined for GIS interoperability).

| Property | NGSI-LD Type | Value Type | Required |
|----------|-------------|------------|----------|
| `id` | — | URI | ✓ |
| `type` | — | string | ✓ |
| `stationId` | Property | string | | (施設管理番号)
| `name` | Property | string | ✓ |
| `description` | Property | string | |
| `category` | Property | enum | ✓ | stormwater/sewage/irrigation/combined
| `dateCommissioned` | Property | DateTime | | (竣工日)
| `designCapacity` | Property | number (m³/min) | | (設計排水能力)
| `pumpCount` | Property | number | |
| `totalPower` | Property | number (kW) | |
| `drainageArea` | Property | number (ha) | | (排水区域面積)
| `equipmentStatus` | Property | enum | ✓ | operational/standby/underMaintenance/outOfService
| `conditionGrade` | Property | enum | | A/B/C/D/S
| `lastMaintenanceDate` | Property | DateTime | |
| `nextMaintenanceDate` | Property | DateTime | |
| `location` | GeoProperty | Point/Polygon | ✓ |
| `status` | Property | enum | ✓ |
| `ward` | Property | string | |
| `managingDept` | Property | string | |
| `managingOffice` | Property | string | | (e.g. ポンプ施設管理事務所)
| `refWaterBody` | Relationship | URI | |
| `refInspectionRecord` | Relationship | URI[] | |
| `refLifecyclePlan` | Relationship | URI | |

---

### 4.12 InspectionRecord (点検・診断記録)

**Custom cross-cutting entity** — used by all subsystems for inspections and diagnostics.

| Property | NGSI-LD Type | Value Type | Required |
|----------|-------------|------------|----------|
| `id` | — | URI | ✓ |
| `type` | — | string | ✓ |
| `title` | Property | string | |
| `inspectionType` | Property | enum | ✓ | routine/detailed/emergency/diagnostic
| `inspectionDate` | Property | DateTime | ✓ |
| `result` | Property | enum | ✓ | pass/minor/needsRepair/critical
| `conditionGrade` | Property | enum | | A/B/C/D/S
| `findings` | Property | string | | (所見)
| `inspector` | Property | string | |
| `inspectorOrganization` | Property | string | |
| `measurements` | Property | object | | (MCI, crack%, etc.)
| `location` | GeoProperty | Point/Polygon | |
| `mediaUrls` | Property | string[] | |
| `refInspectedAsset` | Relationship | URI | ✓ |
| `refCivicOperation` | Relationship | URI | |
| `refWorkOrder` | Relationship | URI | |
| `refEvidence` | Relationship | URI[] | |

---

### 4.13 LifecyclePlan (長寿命化計画 / LCC)

**Custom entity** — lifecycle cost planning for municipal asset longevity.

| Property | NGSI-LD Type | Value Type | Required |
|----------|-------------|------------|----------|
| `id` | — | URI | ✓ |
| `type` | — | string | ✓ |
| `title` | Property | string | ✓ |
| `version` | Property | string | |
| `planStartYear` | Property | number | ✓ |
| `planEndYear` | Property | number | ✓ |
| `planStatus` | Property | enum | | draft/approved/active/archived
| `assetType` | Property | string | ✓ |
| `baselineCondition` | Property | enum | | A/B/C/D/S
| `designLife` | Property | number (yr) | |
| `remainingLife` | Property | number (yr) | |
| `interventions` | Property | array | | [{year, type, description, estimatedCostJpy}]
| `totalLifecycleCostJpy` | Property | number | |
| `annualAverageCostJpy` | Property | number | |
| `refAsset` | Relationship | URI | ✓ |
| `refInspectionRecord` | Relationship | URI[] | |
| `managingDept` | Property | string | |
| `createdBy` | Property | string | |
| `approvedAt` | Property | DateTime | |

---

## 5. JSON-LD @context

The project defines a custom `@context` at:

```
shared/ngsi-ld/context.jsonld
```

This context file maps short property names to fully qualified URIs:

| Namespace | Prefix | Base URI |
|-----------|--------|----------|
| NGSI-LD core | `ngsi-ld:` | `https://uri.etsi.org/ngsi-ld/` |
| FIWARE SDM | `sdm:` | `https://smartdatamodels.org/` |
| Nagoya custom | `nagoya:` | `https://nagoya-construction.example.org/datamodel/` |
| Schema.org | `schema:` | `https://schema.org/` |
| Dublin Core | `dcterms:` | `http://purl.org/dc/terms/` |

Every NGSI-LD entity references the context as:

```json
"@context": [
  "https://nagoya-construction.example.org/ngsi-ld/v1/context.jsonld",
  "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld"
]
```

---

## 6. Conversion Architecture

```
┌──────────────────────┐         ┌───────────────────────────┐
│  PostGIS / Drizzle   │         │  NGSI-LD Normalized JSON  │
│  (Internal Format)   │ ◀─────▶ │  (External / Broker)      │
│                      │         │                           │
│  schema.ts types     │  toNgsi │  ngsi-ld.ts types         │
│  ConstructionEvent   │ ──────▶ │  CivicOperation           │
│  RoadAsset           │ ──────▶ │  Road                     │
│  GreenSpaceAsset     │ ──────▶ │  GreenSpace               │
│  StreetLightAsset    │ ──────▶ │  Streetlight              │
│  RiverAsset          │ ──────▶ │  WaterBody                │
│  WorkOrder           │ ──────▶ │  WorkOrder                │
│  Evidence            │ ──────▶ │  Evidence                 │
│                      │ fromNgsi│                           │
│                      │ ◀────── │                           │
└──────────────────────┘         └───────────────────────────┘
```

Converter functions are defined in `shared/ngsi-ld/converters.ts`:

| Function | Direction | Description |
|----------|-----------|-------------|
| `toNgsiLdCivicOperation()` | DB → NGSI-LD | Convert ConstructionEvent to CivicOperation |
| `fromNgsiLdCivicOperation()` | NGSI-LD → DB | Convert CivicOperation to ConstructionEvent |
| `toNgsiLdWorkOrder()` | DB → NGSI-LD | Convert WorkOrder to NGSI-LD WorkOrder |
| `fromNgsiLdWorkOrder()` | NGSI-LD → DB | Convert NGSI-LD WorkOrder to internal |
| `toNgsiLdRoad()` | DB → NGSI-LD | Convert RoadAsset to Road |
| `fromNgsiLdRoad()` | NGSI-LD → DB | Convert Road to RoadAsset |
| `toNgsiLdGreenSpace()` | DB → NGSI-LD | Convert GreenSpaceAsset to GreenSpace |
| `toNgsiLdStreetlight()` | DB → NGSI-LD | Convert StreetLightAsset to Streetlight |
| `toNgsiLdWaterBody()` | DB → NGSI-LD | Convert RiverAsset to WaterBody |
| `toNgsiLdEvidence()` | DB → NGSI-LD | Convert Evidence to NGSI-LD Evidence |

---

## 7. File Structure

```
shared/
├── types/
│   ├── index.ts            # Internal PostGIS types (unchanged)
│   └── ngsi-ld.ts          # NGSI-LD entity type definitions
├── ngsi-ld/
│   ├── context.jsonld       # JSON-LD @context vocabulary
│   └── converters.ts        # PostGIS ↔ NGSI-LD converters
docs/
└── ngsi-ld-data-model-spec.md  # This specification document
```

---

## 8. FIWARE Smart Data Model Alignment Summary

| Nagoya Entity | FIWARE Repository | Reuse Level | Notes |
|---------------|-------------------|-------------|-------|
| CivicOperation | dataModel.Building | **Extended** | BuildingOperation pattern generalized to civic infrastructure |
| WorkOrder | dataModel.IssueTracking | **Extended** | IssueReporting status lifecycle; added multi-location/partner |
| Road | dataModel.Transportation | **High** | Road + RoadSegment properties; added Nagoya municipal fields |
| GreenSpace | dataModel.ParksAndGardens | **Moderate** | Garden category/operator; added OSM type tags |
| Streetlight | dataModel.Streetlighting | **High** | Direct reuse of lamp technology, power, install date |
| WaterBody | *(none)* | **Custom** | Follows NGSI-LD conventions; no FIWARE waterway model |
| Evidence | *(none)* | **Custom** | Follows NGSI-LD conventions; uses schema.org media patterns |
| DesignatedRoad | *(none)* | **Custom** | Nagoya municipal reference data |
| BuildingZone | *(none)* | **Custom** | Nagoya municipal reference data |
| StreetTree | dataModel.ParksAndGardens | **Extended** | FlowerBed pattern extended for individual tree management |
| ParkFacility | *(none)* | **Custom** | Covers RFI 公園管理: toilets, playground, benches, etc. |
| PavementSection | *(none)* | **Custom** | Covers RFI 舗装維持補修: MCI, crack rate, 5-year planning |
| PumpStation | *(none)* | **Custom** | Covers RFI ポンプ施設管理 (out of scope but interop-ready) |
| InspectionRecord | *(none)* | **Custom** | Cross-cutting inspection/diagnostic for all asset types |
| LifecyclePlan | *(none)* | **Custom** | Covers RFI 長寿命化計画 / LCC cost projections |

---

## 9. Usage Examples

### 9.1 Publishing to Orion-LD Context Broker

```typescript
import { toNgsiLdCivicOperation } from '../shared/ngsi-ld/converters';

// Fetch event from PostGIS
const event = await db.query.constructionEvents.findFirst({ where: ... });

// Convert to NGSI-LD
const ngsiEntity = toNgsiLdCivicOperation(event);

// Publish to Orion-LD
await fetch('http://orion-ld:1026/ngsi-ld/v1/entities', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/ld+json',
    'Link': '<https://nagoya-construction.example.org/ngsi-ld/v1/context.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"'
  },
  body: JSON.stringify(ngsiEntity)
});
```

### 9.2 Ingesting from External NGSI-LD Source

```typescript
import { fromNgsiLdRoad } from '../shared/ngsi-ld/converters';

// Receive NGSI-LD entity from broker notification
const ngsiRoad = notification.data[0] as Road;

// Convert to internal format
const roadAsset = fromNgsiLdRoad(ngsiRoad);

// Upsert into PostGIS
await db.insert(roadAssets).values(roadAsset).onConflictDoUpdate({ ... });
```

### 9.3 OGC API + NGSI-LD Dual Endpoint

The existing OGC API Features endpoint can serve NGSI-LD format via content negotiation:

```
GET /collections/civic-operations/items/evt-001
Accept: application/ld+json
→ Returns NGSI-LD normalized format

GET /collections/civic-operations/items/evt-001
Accept: application/geo+json
→ Returns GeoJSON (existing behavior)
```

---

## 10. RFI Coverage Analysis (名古屋市インフラDX基盤 RFI対応状況)

The following table maps the Nagoya City RFI subsystem requirements to NGSI-LD entities:

| RFI Subsystem | Description | NGSI-LD Entity | Coverage |
|---|---|---|---|
| **維持管理支援システム（統合型GIS）** | Integrated GIS, construction location management | `CivicOperation`, `WorkOrder`, `Road`, all asset entities | ✅ Full |
| **公園管理システム** | Park info, facility management, lifecycle planning (LCC) | `GreenSpace`, `ParkFacility`, `LifecyclePlan`, `InspectionRecord` | ✅ Full |
| **街路樹維持管理台帳** | Street tree ledger, diagnostics, dedicated GIS | `StreetTree`, `InspectionRecord` | ✅ Full |
| **舗装維持補修支援** | Pavement condition (MCI), 5-year planning, cost estimation | `PavementSection`, `LifecyclePlan`, `InspectionRecord` | ✅ Full |
| **ポンプ施設管理** | Pump facility info, maintenance, asset management | `PumpStation`, `InspectionRecord`, `LifecyclePlan` | ✅ Full (調達対象外) |
| **公開型GIS** | Public-facing map with layer information | All entities via OGC API + NGSI-LD content negotiation | ✅ Supported |
| **外部共有型GIS** | Tablet field access, inspection/repair registration | `WorkOrder`, `Evidence`, `InspectionRecord`, `WorkLocation` | ✅ Supported |
| **電子納品システム** | Electronic deliverables (out of scope) | — | ⬜ Out of scope |
| **河川占用システム** | River occupation (out of scope) | — | ⬜ Out of scope |

### Asset Type Coverage Summary

| Asset Type | Japanese | Entity | Geometry | Ledger | Inspection | LCC |
|---|---|---|---|---|---|---|
| 道路 | Roads | `Road` | LineString/Polygon | ✅ | via `InspectionRecord` | via `LifecyclePlan` |
| 公園 | Parks | `GreenSpace` | Polygon | ✅ | via `InspectionRecord` | — |
| 公園施設 | Park facilities | `ParkFacility` | Point/Polygon | ✅ | ✅ | ✅ |
| 街路樹 | Street trees | `StreetTree` | Point | ✅ | ✅ | ✅ |
| 道路舗装 | Pavement | `PavementSection` | LineString/Polygon | ✅ | ✅ (MCI) | ✅ |
| 街路灯 | Streetlights | `Streetlight` | Point | ✅ | via `InspectionRecord` | — |
| 河川 | Rivers | `WaterBody` | LineString/Polygon | ✅ | via `InspectionRecord` | — |
| ポンプ施設 | Pump stations | `PumpStation` | Point/Polygon | ✅ | ✅ | ✅ |
| 市道指定 | Designated roads | `DesignatedRoad` | LineString | ✅ (ref) | — | — |
| 建築区域 | Building zones | `BuildingZone` | Polygon | ✅ (ref) | — | — |

---

## 11. Future Considerations

1. **Orion-LD Integration (Phase 2)**: One-way sync from PostGIS to Orion-LD on entity changes
2. **Subscription/Notification**: Use NGSI-LD subscriptions for the Event→Asset notification boundary
3. **Temporal API**: Leverage NGSI-LD temporal interface for asset version history
4. **Federation**: Register entities with a federation registry for cross-city data sharing
5. **RoadSegment Entity**: Split Road into logical Road + physical RoadSegment when road editing is re-enabled in Phase 3+

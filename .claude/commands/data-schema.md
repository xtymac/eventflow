# NGSI-LD Data Schema Reference

When the user invokes `/data-schema`, provide quick access to the project's NGSI-LD data model definitions.

## Usage

```
/data-schema [query]
```

- `/data-schema` — Show entity catalog overview
- `/data-schema [EntityName]` — Show specific entity definition (e.g., `/data-schema Road`)
- `/data-schema enums` — List all enumerations and valid values
- `/data-schema relationships` — Show entity relationship graph
- `/data-schema rfi` — Show RFI coverage analysis
- `/data-schema context` — Show JSON-LD @context namespace info
- `/data-schema converters` — Show PostGIS ↔ NGSI-LD converter functions

## Source Files

Always read these files for authoritative definitions:

| File | Content |
|------|---------|
| `shared/types/ngsi-ld.ts` | TypeScript interfaces for all 17 NGSI-LD entities + enums |
| `shared/ngsi-ld/context.jsonld` | JSON-LD @context vocabulary (100+ property mappings) |
| `shared/ngsi-ld/converters.ts` | Bidirectional PostGIS ↔ NGSI-LD converter functions |
| `docs/ngsi-ld-data-model-spec.md` | Full specification document (v1.1.0) |
| `shared/types/index.ts` | Internal PostGIS/Drizzle types (DB layer) |
| `backend/src/db/schema.ts` | Drizzle ORM database schema |

## Instructions

When the user runs `/data-schema`:

1. If no argument, read `shared/types/ngsi-ld.ts` and display the **Entity Catalog** table:

| # | Entity Type | FIWARE Base | Domain | Description |
|---|-------------|-------------|--------|-------------|
| 1 | CivicOperation | BuildingOperation | Event/Case | Time-bound construction/maintenance operation |
| 2 | WorkOrder | IssueReporting | Event/Case | Task (inspection, repair, update) under an operation |
| 3 | WorkLocation | *(custom)* | Event/Case | Geographic point/area where work is performed |
| 4 | Organization | schema:Organization | Event/Case | Partner/contractor assigned to work order |
| 5 | Road | Road (Transportation) | Master Data | Logical road entity with centerline/polygon geometry |
| 6 | GreenSpace | Garden (ParksAndGardens) | Master Data | Park, garden, or green area |
| 7 | Streetlight | Streetlight (Streetlighting) | Master Data | Public lighting fixture |
| 8 | WaterBody | *(custom)* | Master Data | River, stream, canal, or drain |
| 9 | Evidence | *(custom)* | Event/Case | Photo/document/report attached to work order |
| 10 | DesignatedRoad | *(custom)* | Reference | Nagoya municipal road designation (MVT) |
| 11 | BuildingZone | *(custom)* | Reference | Nagoya building regulation zone (MVT) |
| 12 | StreetTree | FlowerBed (extended) | Master Data | 街路樹維持管理台帳 |
| 13 | ParkFacility | *(custom)* | Master Data | 公園管理: toilet, playground, bench, etc. |
| 14 | PavementSection | *(custom)* | Master Data | 舗装維持補修: MCI, crack rate, rut depth |
| 15 | PumpStation | *(custom)* | Master Data | ポンプ施設管理 (interop-ready) |
| 16 | InspectionRecord | *(custom)* | Cross-cutting | 点検・診断記録 for any asset |
| 17 | LifecyclePlan | *(custom)* | Cross-cutting | 長寿命化計画 / LCC cost projections |

2. If a specific entity name is given, read `shared/types/ngsi-ld.ts` and find the matching interface. Display its:
   - Interface definition with all properties
   - NGSI-LD attribute types (Property/Relationship/GeoProperty)
   - Related enumerations
   - Relationships to other entities
   - Status mapping tables (if applicable)

3. If `enums` is given, read `shared/types/ngsi-ld.ts` §4 and list all enumeration constants with their values and Japanese annotations.

4. If `relationships` is given, show the 3-layer relationship graph from `docs/ngsi-ld-data-model-spec.md` §3.

5. If `rfi` is given, show the RFI coverage table from `docs/ngsi-ld-data-model-spec.md` §10.

6. If `context` is given, read `shared/ngsi-ld/context.jsonld` and show namespace prefixes:
   - `ngsi-ld:` → `https://uri.etsi.org/ngsi-ld/`
   - `sdm:` → `https://smartdatamodels.org/`
   - `nagoya:` → `https://nagoya-construction.example.org/datamodel/`
   - `schema:` → `https://schema.org/`
   - `dcterms:` → `http://purl.org/dc/terms/`

7. If `converters` is given, read `shared/ngsi-ld/converters.ts` and list:
   - Available converter functions (toNgsiLd* / fromNgsiLd*)
   - Status mapping tables
   - Helper utilities (prop, rel, geo, val, etc.)

## Key Conventions

- Entity IDs: `urn:ngsi-ld:{Type}:{localId}` (e.g., `urn:ngsi-ld:Road:road-042`)
- Three attribute types: `Property` (data), `Relationship` (link), `GeoProperty` (geometry)
- All entities extend `NgsiLdEntity` base interface
- Internal DB types in `shared/types/index.ts` are kept separate from NGSI-LD types
- Converters handle bidirectional mapping with status/enum translations

## Quick Enum Reference

### Status Enums
- **CivicOperationStatus**: planned, scheduled, ongoing, pendingReview, finished, archived, cancelled
- **WorkOrderResolutionStatus**: open, assigned, inProgress, closed, cancelled
- **AssetLifecycleStatus**: active, inactive, retired

### Domain Enums
- **RoadClass**: motorway, trunk, primary, secondary, tertiary, residential, service, unclassified, arterial, collector, local
- **GreenSpaceCategory**: park, garden, grass, forest, meadow, playground, botanical, community, public
- **LampTechnology**: LED, LPS, HPS, mercuryVapor, fluorescent, halogen
- **TreeCategory**: deciduous, evergreen, conifer, palmLike, shrub
- **TreeHealthStatus**: healthy, declining, hazardous, dead, removed
- **ParkFacilityCategory**: toilet, playground, bench, shelter, fence, gate, drainage, lighting, waterFountain, signBoard, pavement, sportsFacility, building, other
- **ConditionGrade**: A (健全), B (軽微), C (要補修), D (要改築), S (緊急)
- **PavementType**: asphalt, concrete, interlocking, gravel, other
- **PumpStationCategory**: stormwater, sewage, irrigation, combined
- **PumpEquipmentStatus**: operational, standby, underMaintenance, outOfService
- **InspectionType**: routine, detailed, emergency, diagnostic
- **InspectionResult**: pass, minor, needsRepair, critical
- **InterventionType**: repair, renewal, replacement, removal

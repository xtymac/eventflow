# Project Decision Log

This document tracks key architectural and technical decisions made throughout the project lifecycle.

## Phase 1: Foundation Setup

### Decision #2024-12-01: Monorepo Structure

**Context**
Setting up the codebase for a tightly coupled frontend (React) and backend (Fastify) prototype.

**Decision**
Adopt a single repository (Monorepo) structure containing `frontend/` and `backend/` directories.

**Why**
1. Simplifies sharing TypeScript types (DTOs) between frontend and backend.
2. Streamlines development workflow (one git repo to manage).

**Rejected**
- **Separate Repositories**: Adds overhead for syncing types and managing version compatibility.
- **Nx/Turbo**: Too much configuration overhead for a prototype scale.

**Risk if wrong**
CI/CD pipelines might become slow or complex to segregate if the team or project size grows significantly.

---

### Decision #2024-12-05: Database Selection

**Context**
Choosing a persistent storage solution for a construction lifecycle management system requiring spatial queries.

**Decision**
**PostgreSQL with PostGIS** extension.

**Why**
1. Industry standard for open-source GIS data processing (robust `ST_*` functions).
2. Relational integrity is required for the complex Event-Asset-Inspection relationships.

**Rejected**
- **MongoDB**: While Orion-LD uses it, it lacks the mature relational integrity constraints and standard SQL spatial tooling needed for the core business logic.
- **SQLite (Spatialite)**: Insufficient for concurrent write handling in a multi-user web app.

**Risk if wrong**
Scaling horizontally for massive write loads is harder than NoSQL, though unlikely to be an issue for this specific use case.

---

### Decision #2024-12-10: Orion-LD Infrastructure Compatibility

**Context**
Orion-LD 1.5.1 container failed to start with the default MongoDB 6.0 image due to protocol changes.

**Decision**
Pin **MongoDB to version 4.4** and **Orion-LD to 1.5.1**.

**Why**
1. MongoDB 6.0 removed the `OP_QUERY` wire protocol, which the legacy C++ driver in Orion-LD 1.5.1 relies on.
2. 4.4 is the last version fully compatible with the driver used in stable Orion-LD releases.

**Rejected**
- **Upgrade Orion-LD**: Newer versions/builds were not considered stable enough or required untried configuration changes.
- **Custom Build**: Recompiling Orion-LD with a new Mongo driver is out of scope.

**Risk if wrong**
MongoDB 4.4 is older; running end-of-life database versions poses potential long-term security/support risks if not upgraded eventually.

---

### Decision #2024-12-12: NGSI-LD Sync Strategy

**Context**
Integrating Orion-LD for standard data exchange while maintaining a robust internal application state.

**Decision**
**PostGIS as Source of Truth**, with unidirectional sync (PostGIS -> Orion-LD) on change.

**Why**
1. Avoids "split-brain" data consistency issues (dual writes).
2. Keeps the application logic simple and ACID-compliant within PostgreSQL.

**Rejected**
- **Orion-LD as Primary DB**: Query capabilities (especially complex spatial joins) are limited compared to SQL.
- **Bidirectional Sync**: Too complex to resolve conflicts for a prototype.

**Risk if wrong**
External systems reading from Orion-LD might see data that is slightly stale (seconds delay) or cannot write back to the core system easily.

---

## Phase 2: Core API & Data Modeling

### Decision #2024-12-15: Spatial Data Storage Migration

**Context**
Initially stored geometry as GeoJSON blobs, but needed to perform spatial searches (e.g., "find assets in viewport").

**Decision**
Migrate columns to native **PostGIS `GEOMETRY(Geometry, 4326)`** types.

**Why**
1. Enables use of GIST indexes for high-performance spatial queries (`ST_Intersects`).
2. Data validation is enforced by the database type (cannot save invalid geometry).

**Rejected**
- **JSONB Storage**: Querying spatial relationships inside JSONB is slow and complex.

**Risk if wrong**
Requires conversion overhead (`ST_GeomFromGeoJSON`) on every read/write; slight complexity increase in ORM layer.

---

### Decision #2024-12-18: Event-Asset Relationship Modeling

**Context**
Events affect multiple road assets, and the relationship needs to track metadata (e.g., is it just "affected" or actively "updated"?).

**Decision**
Use a **Many-to-Many Join Table** (`event_road_assets`) instead of an array of IDs.

**Why**
1. Ensures database-level referential integrity (cannot reference non-existent assets).
2. Allows efficient reverse lookups (e.g., "Find all events affecting Asset X").

**Rejected**
- **Array Column (`text[]`)**: Hard to query in reverse, no referential integrity, cannot store relationship properties.

**Risk if wrong**
Slightly more complex write operations (requires transaction to insert event + link rows), but standard for relational DBs.

---

### Decision #2024-12-20: Road Geometry Alignment

**Context**
Sample road data consisted of simple straight lines (Start -> End) which visually misaligned with the real map background.

**Decision**
**Snap geometries to the OSRM road network** using a script (`match-roads.ts`).

**Why**
1. Provides visual accuracy and improved user trust in the map interface.
2. Retains original business attributes while correcting spatial representation.

**Rejected**
- **Keep Original Data**: Looked unprofessional and confusing on the map.
- **Manual Drawing**: Too labor-intensive for the dataset size.

**Risk if wrong**
If the routing engine "snaps" to the wrong parallel road, the asset location will be materially incorrect (mitigated by detour ratio checks).

---

## Phase 3: Frontend & Visualization

### Decision #2024-12-25: Map Engine & Tiles

**Context**
Selecting a map rendering engine and basemap provider for a dashboard-style application.

**Decision**
**MapLibre GL JS** with **CARTO Voyager @2x (HiDPI)** tiles.

**Why**
1. MapLibre is open-source, performant (WebGL), and free from usage fees (unlike Mapbox GL JS v2+).
2. @2x tiles prevent fuzzy map labels on modern Retina/4K displays.

**Rejected**
- **Leaflet**: Performance degrades with thousands of vector features; lacks smooth 3D/vector capabilities.
- **Standard OSM Tiles**: Look blurry/pixelated on high-DPI screens.

**Risk if wrong**
Higher bandwidth consumption for map tiles (4x pixels).

---

### Decision #2024-12-28: Viewport-Based Data Loading

**Context**
Loading all road assets (thousands of segments) at once slowed down the initial render.

**Decision**
Implement **BBOX (Bounding Box) Filtering** and Zoom-Dependent Rendering.

**Why**
1. Reduces network payload size significantly.
2. Improves client-side rendering performance by only drawing what is visible.

**Rejected**
- **Load All at Startup**: Caused long initial loading spinners and memory spikes.
- **Vector Tiles (MVT)**: Too complex to set up a dynamic tile server for this prototype scale.

**Risk if wrong**
Users panning rapidly might see "pop-in" of data segments before the request completes.

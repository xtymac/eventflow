# Import/Export Feature

## Overview

EventFlow provides bidirectional data exchange capabilities for road assets:

- **Export**: Download road data as GeoPackage or GeoJSON for use in GIS software
- **Import**: Upload modified data back to EventFlow with validation, diff preview, and versioning

```
EventFlow → Export GeoPackage → Edit in ArcGIS/QGIS → Import back to EventFlow
```

> **Note:** In GIS terminology, individual road segments are called "Features". In EventFlow, they are called "Road Assets" or simply "Assets". This documentation uses both terms interchangeably.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
├─────────────────────────────────────────────────────────────────┤
│  ImportExportSidebar (right drawer, resizable)                  │
│    ├── ExportSection (Tab 1)                                    │
│    │     └── Format, scope selection, download                  │
│    └── ImportSection (Tab 2)                                    │
│          ├── ImportVersionList (timeline/table views)           │
│          └── ImportWizard (4-step modal)                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Backend                                  │
├─────────────────────────────────────────────────────────────────┤
│  /export/geojson         - Export as GeoJSON                    │
│  /export/geopackage      - Export as GeoPackage (ogr2ogr)       │
│  /import/versions/*      - Import versioning API                │
│  /import/versions/jobs/* - Async job status polling             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Database                                  │
├─────────────────────────────────────────────────────────────────┤
│  road_assets      - Main road data table                        │
│  export_records   - Tracks exported road IDs for precise diff   │
│  import_versions  - Import version history + stats              │
│  import_jobs      - Async job tracking (validate/publish/roll)  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Export Feature

### Format Options

| Format | Extension | Best For |
|--------|-----------|----------|
| **GeoJSON** | `.geojson` | Web use, small datasets, easy inspection |
| **GeoPackage** | `.gpkg` | GIS software (QGIS, ArcGIS), large datasets |

### Scope Options

| Scope | Description |
|-------|-------------|
| **All Roads** | Export entire city road network |
| **By Ward** | Filter by administrative ward |
| **By Map Extent** | Export only roads visible in current map view (bbox) |

### Using Map Extent

1. Select "By Map Extent" scope
2. Click **Use Map View** button
3. Pan/zoom the map to desired area
4. Click **Confirm** in the overlay
5. Click **Download Export**

### Exported Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Unique road ID (required for re-import) |
| `_exportId` | String | Export record ID (enables precise diff on re-import) |
| `name` | String | Road name |
| `roadType` | String | arterial / collector / local |
| `ward` | String | Administrative ward |
| `lanes` | Integer | Number of lanes |
| `direction` | String | Traffic direction |
| `dataSource` | String | Data origin |
| `status` | String | active / inactive |

### Export Tracking

Each export creates a record in `export_records` with:
- Unique export ID (embedded as `_exportId` in each feature)
- List of exported road IDs
- Scope and format metadata

This enables **precise comparison** during re-import: the system compares against exactly the roads that were exported, rather than estimating scope from bounding box.

### API Endpoints

```bash
# GeoJSON export
GET /export/geojson?type=assets

# GeoPackage export
GET /export/geopackage?type=assets

# With filters
GET /export/geojson?type=assets&ward=Atsuta-ku
GET /export/geojson?type=assets&bbox=136.9,35.1,137.0,35.2
```

GeoPackage exports use `ogr2ogr` with:
- `-a_srs EPSG:4326` coordinate reference system
- `-nln road_assets` layer name
- `-dsco VERSION=1.2` for ArcGIS compatibility

---

## Import Feature

### Import Workflow (4 Steps)

```
1. Upload → 2. Configure → 3. Review (Validate + Diff) → 4. Publish
```

### Step 1: Upload

- Click **New Import** button in the Import tab
- Select a GeoPackage (`.gpkg`) or GeoJSON (`.geojson`) file
- System creates a draft version and stores the file

### Step 2: Configure

| Option | Description |
|--------|-------------|
| **Layer** | Select layer from GeoPackage (auto-selected if single layer) |
| **Source CRS** | Coordinate system of import file (auto-transforms to EPSG:4326) |
| **Default Data Source** | Applied to features missing `dataSource` property |
| **Regional Refresh** | When ON, roads in scope but NOT in file will be deactivated |

> **Import Scope** is auto-calculated from the file's bounding box. No manual selection needed.

#### Supported CRS

- EPSG:4326 (WGS84) - Default, no transformation
- EPSG:6668 (JGD2011)
- EPSG:6669-6676 (JGD2011 Zones 1-8)

### Step 3: Review (Validation + Diff Preview)

The system first validates the file, then generates a diff preview.

#### Validation Checks

| Check | Severity | Description |
|-------|----------|-------------|
| Missing geometry | Error | Each feature must have valid geometry |
| Invalid geometry type | Error | Must be LineString or MultiLineString |
| Missing ID | Error | Required for incremental updates |
| Duplicate ID | Error | IDs must be unique within file |
| Invalid roadType | Error | Must be arterial / collector / local |
| Missing dataSource | Warning | Will use configured default |
| Coordinates outside Japan | Warning | May indicate CRS misconfiguration |

#### Diff Preview

After validation passes, the system compares the import file against existing data:

| Category | Description |
|----------|-------------|
| **Added** | New roads to be created |
| **Updated** | Existing roads with geometry or attribute changes |
| **Deactivated** | Roads to be marked inactive (Regional Refresh or precise mode) |
| **Unchanged** | Roads with no detected changes |

### Step 4: Publish

Publishing is an async job with progress reporting:

| Progress | Stage |
|----------|-------|
| 15% | Validation |
| 25% | Diff generation |
| 45% | Snapshot creation |
| 60% | Database transaction (upserts, updates, deactivations) |
| 95% | Finalizing |
| 100% | Complete |

Actions performed:
- Creates a pre-publish snapshot (for rollback)
- Saves diff result (for historical viewing)
- Applies all changes atomically in a database transaction
- Archives previous published version

---

## Diff Comparison Modes

The system uses three comparison strategies, applied in priority order:

### 1. Precise Mode (`precise`)

Used when the import file contains an `_exportId` field (from a previous export).

- Compares against exactly the roads from the original export record
- Highest accuracy for round-trip workflows (export → edit → re-import)
- Deactivation is always applied (missing roads = intentionally removed)

### 2. Self-Comparison Mode (`geometry` with baseline)

Used when a previous import version exists with overlapping feature IDs (>50% match).

- Compares current import against the previous import file
- Detects changes made between versions of the same dataset
- Ideal for iterative editing workflows

### 3. Geometry Matching (fallback)

Used when features can't be matched by ID against the database.

**Pass 1 - Exact Geometry:**
- Spatial index on start coordinates
- Exact geometry comparison with floating-point tolerance (~1m)

**Pass 2 - Fuzzy Matching:**
- Start/end coordinate proximity (~50m tolerance)
- Length similarity (0.5x-2.0x ratio)
- Attribute bonuses (roadType, name, ward)
- Score threshold >= 1.0

### 4. BBox Mode (`bbox`)

Default fallback when no export record or baseline exists.

- Queries all active roads within the import file's bounding box
- Deactivation only applied if Regional Refresh is enabled

---

## Version Management

### Version States

| State | Description |
|-------|-------------|
| **Draft** | File uploaded, not yet published |
| **Published** | Currently active version |
| **Archived** | Previously published, superseded by newer version |
| **Rolled Back** | Superseded by a rollback operation (kept for history) |

### Rollback

Each published/archived version stores a pre-publish snapshot. To rollback:

1. Click the rollback icon on any published/archived version
2. Confirm the rollback
3. System restores all roads from the snapshot (including re-activating inactive roads)
4. Roads added after the snapshot are deactivated
5. Versions with higher numbers are marked as `rolled_back` (visible in timeline)
6. Target version becomes the current `published` version

### Historical Diff Viewing

Published and archived versions store their diff results. Click on a version to view:
- Summary statistics (added/updated/deactivated counts)
- Feature lists by category
- Map visualization of changes

---

## File Requirements

### Required Fields

| Field | Description |
|-------|-------------|
| `id` | Unique identifier for each road (string) |
| `geometry` | LineString or MultiLineString |

### Recommended Fields

| Field | Type | Valid Values |
|-------|------|-------------|
| `name` | String | Road name |
| `roadType` | String | `arterial`, `collector`, `local` |
| `ward` | String | Administrative ward name |
| `lanes` | Integer | Number of lanes |
| `direction` | String | Traffic direction |
| `dataSource` | String | `official_ledger`, `manual`, `osm_test` |

---

## Technical Details

### Backend Components

| Component | Path |
|-----------|------|
| Export Routes | `backend/src/routes/import-export.ts` |
| Import Routes | `backend/src/routes/import-versions.ts` |
| Import Service | `backend/src/services/import-version.ts` |
| DB Schema | `backend/src/db/schema.ts` |

### Frontend Components

| Component | Path |
|-----------|------|
| Sidebar | `frontend/src/components/ImportExportSidebar.tsx` |
| Panel | `frontend/src/features/import/ImportExportPanel.tsx` |
| Export Section | `frontend/src/features/import/components/ExportSection.tsx` |
| Import Section | `frontend/src/features/import/components/ImportSection.tsx` |
| Import Wizard | `frontend/src/features/import/ImportWizard.tsx` |
| Version List | `frontend/src/features/import/ImportVersionList.tsx` |
| Timeline View | `frontend/src/features/import/components/ImportVersionTimeline.tsx` |
| Historical Sidebar | `frontend/src/features/import/components/HistoricalPreviewSidebar.tsx` |
| Bbox Overlay | `frontend/src/features/import/components/ExportBboxConfirmOverlay.tsx` |
| Preview Overlay | `frontend/src/features/import/components/ImportPreviewOverlay.tsx` |

### Storage Locations

| Type | Path |
|------|------|
| Uploaded files | `uploads/imports/{versionId}/` |
| Pre-publish snapshots | `uploads/snapshots/` |
| Historical diffs | `uploads/import-diffs/` |
| Temporary exports | `uploads/exports/` |

### API Endpoints Summary

| Method | Path | Description |
|--------|------|-------------|
| GET | `/export/geojson` | Export as GeoJSON |
| GET | `/export/geopackage` | Export as GeoPackage |
| POST | `/import/versions/upload` | Upload file |
| GET | `/import/versions/:id/layers` | List GeoPackage layers |
| POST | `/import/versions/:id/configure` | Configure import |
| GET | `/import/versions/` | List versions (paginated) |
| GET | `/import/versions/:id` | Get version details |
| DELETE | `/import/versions/:id` | Delete draft version |
| POST | `/import/versions/:id/validate` | Trigger validation job |
| GET | `/import/versions/:id/validation` | Get validation results |
| GET | `/import/versions/:id/preview` | Get diff preview |
| POST | `/import/versions/:id/publish` | Publish version (async) |
| POST | `/import/versions/:id/rollback` | Rollback to version (async) |
| GET | `/import/versions/:id/history` | Get historical diff |
| GET | `/import/versions/jobs/:jobId` | Poll job status |

### Database Schema

**import_versions:**
- Version metadata (id, versionNumber, status, fileName, fileType, filePath)
- Configuration (layerName, sourceCRS, importScope, regionalRefresh, defaultDataSource)
- Tracking (sourceExportId, fileSizeMB, featureCount)
- Timestamps (uploadedAt, publishedAt, archivedAt, rolledBackAt)
- Results (snapshotPath, diffPath, addedCount, updatedCount, deactivatedCount)

**import_jobs:**
- Job tracking (id, versionId, jobType, status, progress)
- Timing (startedAt, completedAt)
- Results (errorMessage, resultSummary)

**export_records:**
- Export tracking (id, exportScope, format, roadIds, featureCount, exportedAt)

### Dependencies

- **GDAL/OGR** (`ogr2ogr`) - File format conversion and CRS transformation
- **PostgreSQL + PostGIS** - Spatial database with geometry operations

---

## Troubleshooting

### "Missing id property" Error
Each feature must have an `id` property. Add IDs in your GIS software before exporting.

### "Invalid geometry type" Error
Roads must be LineString or MultiLineString. Convert Polygons to centerlines in ArcGIS/QGIS first.

### Coordinates Outside Japan Warning
Your file may use a non-WGS84 CRS. Select the correct Source CRS in the Configure step.

### Large Import Performance
Large imports (10k+ features) run as background jobs. The progress bar shows real-time status. Diff generation with geometry matching may add processing time.

### GeoPackage Layer Not Found
If your GeoPackage has multiple layers, select the correct one in Step 2 (Configure). The layer list is shown automatically for multi-layer files.

---

## Software Compatibility

| Software | Export | Import |
|----------|--------|--------|
| ArcGIS Pro | GeoPackage / GeoJSON | Export as GeoPackage or GeoJSON |
| QGIS 3.x | GeoPackage / GeoJSON | Save as GeoPackage or GeoJSON |
| MapInfo | GeoPackage | Via Universal Translator |
| PostGIS | Both formats | Via ogr2ogr |

### Notes for ArcGIS Users
- GeoPackage exports use version 1.2 for compatibility
- `_exportId` field may be renamed to `F_exportId` by ogr2ogr (handled automatically on re-import)
- Use `-makevalid` flag if encountering geometry errors

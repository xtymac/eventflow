# Import/Export Feature

## Overview

EventFlow provides bidirectional data exchange capabilities for road assets:

- **Export**: Download road data as GeoPackage or GeoJSON for use in GIS software
- **Import**: Upload modified data back to EventFlow with validation and versioning

```
EventFlow → Export GeoPackage → Edit in ArcGIS/QGIS → Import back to EventFlow
```

> **Note:** In GIS terminology, individual road segments are called "Features". In EventFlow, they are called "Road Assets" or simply "Assets". This documentation uses both terms interchangeably.

## Accessing Import/Export

Click the **Import/Export** icon in the header toolbar to open the sidebar with two tabs:
- **Export** - Download road data
- **Import** - Upload and manage import versions

---

## Export Feature

### Format Options

| Format | Description | Best For |
|--------|-------------|----------|
| **GeoJSON** | Lightweight text-based format | Web use, small datasets, easy inspection |
| **GeoPackage** | SQLite-based container format | GIS software (QGIS, ArcGIS), large datasets |

### Scope Options

| Scope | Description |
|-------|-------------|
| **All Roads** | Export entire city road network |
| **By Ward** | Filter by administrative ward |
| **By Map Extent** | Export only roads visible in current map view |

### Using Map Extent

1. Select "By Map Extent" scope
2. Click **Use Map View** button
3. Pan/zoom the map to desired area
4. Click **Confirm** in the overlay
5. Click **Download Export**

### Export Specifications

| Property | Value |
|----------|-------|
| CRS | WGS 84 (EPSG:4326) |
| Geometry Type | LineString / MultiLineString |
| Layer Name | `road_assets` |

### Exported Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Unique road ID (required for re-import) |
| `name` | String | Road name |
| `roadType` | String | arterial / collector / local |
| `ward` | String | Administrative ward |
| `lanes` | Integer | Number of lanes |
| `direction` | String | Traffic direction |
| `dataSource` | String | Data origin |
| `status` | String | active / inactive |

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

---

## Import Feature

### Import Workflow

```
1. Upload File → 2. Configure → 3. Validate → 4. Preview → 5. Publish
```

### Step 1: Upload

- Click **New Import** button
- Select a GeoPackage (.gpkg) or GeoJSON (.geojson) file
- System creates a draft version

### Step 2: Configure

| Option | Description |
|--------|-------------|
| **Layer** | Select layer from GeoPackage (auto-selected if single layer) |
| **Source CRS** | Coordinate system of import file (auto-transforms to EPSG:4326) |
| **Import Scope** | Full City / By Ward / By Bounding Box |
| **Default Data Source** | Applied to features missing dataSource property |
| **Regional Refresh** | When ON, roads in scope but NOT in file will be deactivated |

#### Supported CRS

- EPSG:4326 (WGS84) - Default
- EPSG:6668 (JGD2011)
- EPSG:6669-6676 (JGD2011 Zones 1-8)

### Step 3: Validation

System validates each feature for:

| Check | Severity | Description |
|-------|----------|-------------|
| Missing geometry | Error | Each feature must have valid geometry |
| Invalid geometry type | Error | Must be LineString or MultiLineString |
| Missing ID | Error | Required for incremental updates |
| Duplicate ID | Error | IDs must be unique within file |
| Invalid roadType | Error | Must be arterial/collector/local |
| Missing dataSource | Warning | Will use default dataSource |
| Coordinates outside Japan | Warning | May indicate CRS misconfiguration |

**Change Preview** is shown after validation passes, displaying:
- Added: New roads to be created
- Updated: Existing roads with changes
- Deactivated: Roads to be marked inactive (Regional Refresh only)
- Unchanged: Roads with no changes

### Step 4: Preview

Detailed diff view with:
- Summary statistics
- Tabbed lists of Added/Updated/Deactivated features
- View on Map button (for bbox scopes)

### Step 5: Publish

- Creates a snapshot of current data (for rollback)
- Applies changes atomically in a transaction
- Archives previous published version
- New version becomes "Published"

---

## Version Management

### Version States

| State | Description |
|-------|-------------|
| **Draft** | Uploaded but not yet published (hidden from list) |
| **Published** | Currently active version |
| **Archived** | Previously published, superseded by newer version |

### Rollback

Each published/archived version stores a pre-publish snapshot. To rollback:

1. Click the rollback icon (↩) on any version row
2. Confirm the rollback
3. System restores roads from snapshot
4. All versions with higher numbers are deleted
5. Next import will continue numbering from rolled-back version

**Example:**
- Have versions #1, #2, #3 (published)
- Rollback to #1
- Versions #2, #3 are deleted
- Next import becomes #2

---

## File Requirements

### Required Fields

| Field | Description |
|-------|-------------|
| `id` | Unique identifier for each road (string) |
| `geometry` | LineString or MultiLineString |

### Recommended Fields

| Field | Type | Example |
|-------|------|---------|
| `name` | String | "Main Street" |
| `roadType` | String | "arterial" |
| `ward` | String | "Atsuta-ku" |
| `dataSource` | String | "official_ledger" |

### Valid Values

**roadType:**
- `arterial` - Major roads
- `collector` - Medium roads
- `local` - Local streets

**dataSource:**
- `official_ledger` - Official GIS data
- `manual` - Manually entered
- `osm_test` - OpenStreetMap test data

---

## Technical Details

### Backend Components

| Component | Path |
|-----------|------|
| Routes | `backend/src/routes/import-export.ts` |
| Service | `backend/src/services/import-version.ts` |
| Schema | `backend/src/db/schema.ts` (importVersions, importJobs) |

### Frontend Components

| Component | Path |
|-----------|------|
| Sidebar | `frontend/src/components/ImportExportSidebar.tsx` |
| Export Section | `frontend/src/features/import/components/ExportSection.tsx` |
| Import Section | `frontend/src/features/import/components/ImportSection.tsx` |
| Import Wizard | `frontend/src/features/import/ImportWizard.tsx` |
| Version List | `frontend/src/features/import/ImportVersionList.tsx` |

### Storage Locations

| Type | Path |
|------|------|
| Uploaded files | `backend/uploads/imports/{versionId}/` |
| Pre-publish snapshots | `backend/uploads/snapshots/` |
| Temporary exports | `backend/uploads/exports/` |

### Dependencies

- **GDAL/OGR** - For file format conversion (ogr2ogr)
- **PostgreSQL + PostGIS** - Spatial database

---

## Troubleshooting

### "Missing id property" Error

Each feature in your import file must have an `id` property for incremental updates. Add IDs in your GIS software before export.

### "Invalid geometry type" Error

Roads must be LineString or MultiLineString. If you have Polygons, convert them to centerlines in ArcGIS/QGIS first.

### Coordinates Outside Japan Warning

Your file may have a different CRS. Select the correct Source CRS in the Configure step.

### Import Takes Too Long

Large imports (100k+ features) may take several minutes. The progress indicator shows current status.

### Rollback Not Working

- Check that the version has a snapshot (rollback icon should be visible)
- Check server logs for errors
- Verify database connection

---

## Software Compatibility

| Software | Export | Import |
|----------|--------|--------|
| ArcGIS Pro | ✅ | ✅ (export as GeoJSON/GPKG) |
| QGIS 3.x | ✅ | ✅ |
| MapInfo | ✅ | ✅ (via Universal Translator) |
| PostGIS | ✅ | ✅ (use ogr2ogr) |

# Import / Export Feature

Road assets data import and export functionality for the Nagoya Construction Lifecycle platform.

## Overview

The Import/Export feature allows users to:
- **Export** road assets to GeoJSON or GeoPackage format for use in external GIS software (QGIS, ArcGIS)
- **Import** modified road data back into the system with version tracking and diff preview

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
├─────────────────────────────────────────────────────────────────┤
│  App.tsx                                                        │
│    └── Header: Import/Export icon button                        │
│    └── ImportExportSidebar (Drawer)                             │
│          ├── ExportSection (Tab 1)                              │
│          │     └── Format selection, scope selection, download  │
│          └── ImportSection (Tab 2)                              │
│                └── ImportVersionList                            │
│                └── ImportWizard (modal)                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Backend                                  │
├─────────────────────────────────────────────────────────────────┤
│  /export/geojson      - Export as GeoJSON                       │
│  /export/geopackage   - Export as GeoPackage (ogr2ogr)          │
│  /import/versions/*   - Import versioning API                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Database                                  │
├─────────────────────────────────────────────────────────────────┤
│  road_assets      - Main road data table                        │
│  export_records   - Tracks exported road IDs for diff           │
│  import_versions  - Import version history                      │
│  import_jobs      - Import processing jobs                      │
└─────────────────────────────────────────────────────────────────┘
```

## Export Feature

### Supported Formats

| Format | Extension | Use Case | Notes |
|--------|-----------|----------|-------|
| GeoJSON | `.geojson` | Web, quick inspection | Smaller files, human-readable |
| GeoPackage | `.gpkg` | QGIS, ArcGIS | Full attribute support, recommended for GIS workflows |

### Export Scopes

- **All Roads**: Export entire road asset database
- **By Ward**: Filter by administrative ward (区)
- **By Map Extent**: Export only roads within current map viewport (bbox)

### Backend Endpoints

#### GET `/export/geojson`

Query parameters:
- `type`: `assets` (required)
- `ward`: Filter by ward name (optional)
- `bbox`: `west,south,east,north` format (optional)

Response: GeoJSON FeatureCollection with `Content-Disposition` header for download.

#### GET `/export/geopackage`

Same parameters as GeoJSON. Uses `ogr2ogr` for conversion with:
- `-a_srs EPSG:4326`: Set coordinate reference system
- `-nln road_assets`: Layer name
- `-dsco VERSION=1.2`: GeoPackage version for ArcGIS compatibility

### Export Tracking

Each export creates a record in `export_records` table:
- `id`: Unique export ID (prefixed `exp_`)
- `export_scope`: `full`, `ward:xxx`, or `bbox:xxx`
- `format`: `geojson` or `geopackage`
- `road_ids`: JSONB array of exported road IDs
- `feature_count`: Number of features exported
- `exported_at`: Timestamp

This enables precise diff calculation during import.

## Import Feature

### Import Workflow

```
1. Upload File (.geojson or .gpkg)
       │
       ▼
2. Create Import Version
   - Store file metadata
   - Parse and validate features
       │
       ▼
3. Preview Changes (Diff)
   - Compare with export_records if _exportId present
   - Show added/modified/removed roads
   - Map preview with feature browsing
       │
       ▼
4. Publish Changes
   - Apply changes to road_assets table
   - Update version status
```

### Import Version States

| State | Description |
|-------|-------------|
| `draft` | File uploaded, awaiting preview |
| `previewing` | Diff calculated, reviewing changes |
| `publishing` | Changes being applied |
| `published` | Successfully imported |
| `failed` | Import failed |
| `cancelled` | User cancelled import |

### Backend Endpoints

#### POST `/import/versions/upload`
Upload file and create new import version.

#### GET `/import/versions`
List all import versions with pagination.

#### GET `/import/versions/:id`
Get single import version details.

#### GET `/import/versions/:id/preview`
Get diff preview showing added/modified/removed features.

#### POST `/import/versions/:id/publish`
Apply changes to database.

#### DELETE `/import/versions/:id`
Cancel/delete import version.

## Frontend Components

### UI Store State (`uiStore.ts`)

```typescript
// Import/Export sidebar
isImportExportSidebarOpen: boolean;
openImportExportSidebar: () => void;
closeImportExportSidebar: () => void;
toggleImportExportSidebar: () => void;

// Export scope selection
exportBbox: string | null;
exportScopeType: 'full' | 'ward' | 'bbox';
isExportBboxConfirming: boolean;

// Import wizard
importWizardOpen: boolean;
importWizardStep: 'upload' | 'configure' | 'review' | 'publish';
currentImportVersionId: string | null;

// Import preview mode (map browsing)
isImportPreviewMode: boolean;
importPreviewFeatures: Feature[];
importPreviewIndex: number;
```

### Component Hierarchy

```
ImportExportSidebar.tsx
├── ExportSection.tsx
│   ├── Format radio buttons (GeoJSON/GeoPackage)
│   ├── Scope radio buttons (All/Ward/Bbox)
│   ├── Ward dropdown (when ward selected)
│   ├── "Use Map View" button (when bbox selected)
│   └── Download button
│
└── ImportSection.tsx
    ├── ImportVersionList.tsx
    │   └── List of past imports with status badges
    └── ImportWizard.tsx (modal)
        ├── Step 1: Upload file
        ├── Step 2: Configure options
        ├── Step 3: Review diff with map preview
        └── Step 4: Publish confirmation
```

## Database Schema

### export_records

```sql
CREATE TABLE export_records (
  id VARCHAR(50) PRIMARY KEY,
  export_scope VARCHAR(255) NOT NULL,
  format VARCHAR(20) NOT NULL,
  road_ids JSONB NOT NULL,
  feature_count INTEGER NOT NULL,
  exported_by VARCHAR(100),
  exported_at TIMESTAMPTZ NOT NULL
);
```

### import_versions

```sql
CREATE TABLE import_versions (
  id VARCHAR(50) PRIMARY KEY,
  display_number INTEGER NOT NULL,
  filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(500),
  file_size INTEGER NOT NULL,
  format VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  feature_count INTEGER,
  source_export_id VARCHAR(50),
  uploaded_by VARCHAR(100),
  uploaded_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ,
  notes TEXT
);
```

### import_jobs

```sql
CREATE TABLE import_jobs (
  id VARCHAR(50) PRIMARY KEY,
  version_id VARCHAR(50) NOT NULL REFERENCES import_versions(id),
  job_type VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  result_summary JSONB
);
```

## ArcGIS/QGIS Compatibility

### GeoPackage Requirements

For ArcGIS compatibility, exports include:
- EPSG:4326 coordinate reference system
- GeoPackage version 1.2
- Layer name: `road_assets`

### Opening in ArcGIS Pro

1. Open ArcGIS Pro
2. Go to **Insert > Add Data > Add Data**
3. Navigate to the `.gpkg` file
4. Select the `road_assets` layer
5. Click **OK**

### Opening in QGIS

1. Open QGIS
2. Drag and drop the `.gpkg` file onto the map canvas
3. Or use **Layer > Add Layer > Add Vector Layer**

## Error Handling

### Common Export Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `invalid input syntax for type json` | Null geometry in database | Fixed: Added `geometry IS NOT NULL` filter |
| `ogr2ogr failed` | Missing GDAL tools | Ensure `gdal-tools` is installed |

### Common Import Errors

| Error | Cause | Solution |
|-------|-------|----------|
| Invalid GeoJSON | Malformed file | Validate file structure |
| Missing geometry | Feature without geometry | Filter or fix source data |
| Duplicate IDs | Same road ID in file | Use unique identifiers |

## Configuration

### Environment Variables

```bash
# Backend
UPLOADS_DIR=/path/to/uploads  # Temp file storage for exports
DATABASE_URL=postgres://...    # PostgreSQL connection

# Frontend
VITE_API_URL=/api             # API base URL (default: /api)
```

## Future Enhancements

- [ ] Support for construction events export
- [ ] Scheduled automatic exports
- [ ] Email notification on import completion
- [ ] Bulk import validation rules
- [ ] Export history with re-download capability

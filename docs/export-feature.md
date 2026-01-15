# Road Assets Export Feature

## Overview

Export road assets from EventFlow platform to GeoPackage (.gpkg) or GeoJSON (.geojson) format for use in desktop GIS software like ArcGIS or QGIS.

## Supported Workflows

```
EventFlow → Export GeoPackage → Edit in ArcGIS/QGIS → Import back to EventFlow
```

## How to Use

1. Open the application at `http://localhost:5173/`
2. Navigate to **Assets** tab in the sidebar
3. Click the **Import** tab
4. Select export format:
   - **GeoPackage (.gpkg)** - Recommended for ArcGIS and large datasets
   - **GeoJSON (.geojson)** - For small datasets or debugging
5. Click **Export Road Assets**
6. File will download automatically

## Export Specifications

### File Details

| Property | Value |
|----------|-------|
| Format | GeoPackage 1.2 / GeoJSON |
| CRS | WGS 84 (EPSG:4326) |
| Geometry Type | LineString |
| Layer Name | `road_assets` |
| Feature Count | ~128,955 roads |
| File Size | ~26 MB (GeoPackage) |

### Exported Fields

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `id` | String | Road asset ID (e.g., RA-ATSU-xxx) | Required |
| `status` | String | Asset status | `active` |
| `dataSource` | String | Data origin | `manual` |
| `roadType` | String | Road classification | `local` |
| `lanes` | Integer | Number of lanes | `2` |
| `direction` | String | Traffic direction | `two-way` |
| `osmId` | String | OpenStreetMap ID | null |
| `osmType` | String | OSM element type (way/relation) | null |

### Status Values

| Value | Description |
|-------|-------------|
| `active` | Currently valid road asset |
| `inactive` | Retired or replaced road asset |

### Road Type Values

| Value | Description |
|-------|-------------|
| `primary` | Primary road |
| `secondary` | Secondary road |
| `tertiary` | Tertiary road |
| `local` | Local road |
| `residential` | Residential road |
| `service` | Service road |

### Direction Values

| Value | Description |
|-------|-------------|
| `one-way` | One-way traffic |
| `two-way` | Two-way traffic |

## API Endpoints

### Export as GeoPackage

```
GET /export/geopackage?type=assets
```

Optional query parameters:
- `ward` - Filter by ward name (e.g., `Atsuta-ku`)
- `bbox` - Filter by bounding box (`minLon,minLat,maxLon,maxLat`)

Example:
```bash
curl -o roads.gpkg "http://localhost:3000/export/geopackage?type=assets&ward=Atsuta-ku"
```

### Export as GeoJSON

```
GET /export/geojson?type=assets
```

Same optional parameters as GeoPackage endpoint.

## Software Compatibility

| Software | Status | Notes |
|----------|--------|-------|
| ArcGIS Pro | ✅ Supported | Drag & drop or Add Data |
| ArcGIS Desktop 10.2+ | ✅ Supported | Use Catalog to add |
| QGIS 3.x | ✅ Supported | Drag & drop |
| MapInfo | ✅ Supported | Via Universal Translator |
| PostGIS | ✅ Supported | Use `ogr2ogr` to import |

## Troubleshooting

### ArcGIS "Failed to add data" Error

1. **Check file path**: Avoid paths with special characters or spaces
2. **Try Catalog**: Instead of drag & drop, use Catalog > Add Data
3. **Check ArcGIS version**: Requires ArcGIS 10.2 or later

### File is empty or has 0 features

1. Check if the backend server is running
2. Verify database connection
3. Check server logs for errors

### Export takes too long

The full export (~129,000 features) may take 10-30 seconds. Consider using `ward` or `bbox` filters for smaller exports.

## Technical Implementation

### Backend

- Endpoint: `backend/src/routes/import-export.ts`
- Uses `ogr2ogr` for GeoJSON to GeoPackage conversion
- Temporary files stored in `backend/uploads/exports/`

### Frontend

- Component: `frontend/src/features/assets/AssetList.tsx` (ExportSection)
- Hook: `frontend/src/hooks/useApi.ts` (useExportAssets)

### Dependencies

- GDAL/OGR (for `ogr2ogr` command)
- PostgreSQL with PostGIS extension

## Future Enhancements

- [ ] Add UI filters (ward, bbox) to export dialog
- [ ] Support Shapefile (.shp) export
- [ ] Add progress indicator for large exports
- [ ] Support selective field export

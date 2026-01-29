# Map Implementation Guide

## Overview

The map component (`MapView.tsx`) uses MapLibre GL JS to render an interactive map with construction events, road assets, and inspection data.

## Scope Update (2026-01-28)

The prototype scope has changed. Key implications for map behavior:

- Roads are **read-only tiles/layers** and must not be edited or linked to Events.
- GIS is a presentation layer; the core workflow is Event -> WorkOrder -> Evidence -> Close.
- Public Portal is a lightweight, read-only map; Partner and Mobile are separate apps.
- The sections below describe the current internal map implementation; road editing behavior is **legacy** and out of scope for the prototype demo.

## Technology Stack

| Technology | Purpose |
|------------|---------|
| [MapLibre GL JS](https://maplibre.org/) | Open-source map rendering library (fork of Mapbox GL JS) |
| [Turf.js](https://turfjs.org/) | Geospatial analysis (centroid, bbox, buffer calculations) |
| [CARTO Basemaps](https://carto.com/basemaps/) | Raster tile basemap (Voyager style) |
| [Zustand](https://zustand-demo.pmnd.rs/) | State management for map settings |

## Basemap Configuration

The map uses CARTO's Voyager raster tiles as the default basemap with **HiDPI/Retina support**:

```typescript
const THEME_CONFIG = {
  voyager: {
    tiles: ['https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png'],
    attribution: '© OpenStreetMap © CARTO',
    tileSize: 512,  // @2x tiles are 512px, displayed at 256px for sharpness
  },
  light: {
    tiles: ['https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png'],
    tileSize: 512,
  },
  dark: {
    tiles: ['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'],
    tileSize: 512,
  },
  standard: {
    // OSM standard tiles don't support @2x
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    tileSize: 256,
  }
};
```

### HiDPI Tile Strategy

| Theme | Tile Resolution | tileSize | Result |
|-------|----------------|----------|--------|
| voyager, light, dark | @2x (512px) | 512 | Crisp on Retina displays |
| standard (OSM) | 1x (256px) | 256 | Standard quality (no @2x available) |

**How it works**: CARTO's `@2x` tiles are 512×512 pixels with double the detail. By setting `tileSize: 512`, MapLibre displays them at 256 CSS pixels, providing 2× pixel density on Retina screens.

**Trade-offs**:
- Slightly larger tile downloads (~4× file size per tile)
- Better caching efficiency (fewer tiles needed at high zoom)
- Crisp text and labels at all zoom levels

## Data Layers

### Layer Structure

```
osm (raster basemap)
  └── assets-line (road assets)
  └── events-fill (event polygons)
  └── events-line (event outlines)
  └── inspections-point (inspection markers)
  └── selected-event-fill/line (highlight)
  └── selected-asset-line (highlight)
  └── preview-geometry-fill/line (corridor preview)
```

**Prototype note**: road layers must be read-only tiles/layers. Interactive road editing layers are legacy and should be disabled in the prototype demo.

### GeoJSON Sources

| Source ID | Type | Description |
|-----------|------|-------------|
| `assets` | GeoJSON | Road asset LineStrings |
| `events` | GeoJSON | Construction event Polygons/LineStrings |
| `inspections` | GeoJSON | Inspection Points |
| `selected-event` | GeoJSON | Currently selected event highlight |
| `selected-asset` | GeoJSON | Currently selected asset highlight |
| `preview-geometry` | GeoJSON | Corridor preview for EventForm |

## Color Scheme

### Event Status Colors

| Status | Color | Hex |
|--------|-------|-----|
| Planned | Blue | `#3B82F6` |
| Active | Amber | `#F59E0B` |
| Ended | Gray | `#6B7280` |

### Road Type Colors

| Type | Color | Hex |
|------|-------|-----|
| Arterial | Purple | `#8B5CF6` |
| Collector | Cyan | `#06B6D4` |
| Local | Lime | `#84CC16` |

### Other Colors

| Element | Color | Hex |
|---------|-------|-----|
| Inspections | Pink | `#EC4899` |
| Selected highlight | Red | `#EF4444` |
| Preview corridor | Cyan | `#06B6D4` |

## Viewport-based Loading

Road assets are loaded based on the current map viewport to optimize performance (legacy internal app):

```typescript
// Only fetch assets when:
// 1. Zoom level >= 12
// 2. Assets layer is visible
// 3. Valid bounding box exists

const { data: assetsData } = useAssets(
  { bbox: mapBbox, limit: 1000, roadType: getRoadTypesForZoom(currentZoom) },
  { enabled: !!mapBbox && currentZoom >= 12 && showAssets }
);
```

The bounding box is updated on `moveend` event with a 250ms debounce.

### Zoom-based Road Type Filtering

To prevent data overload at lower zoom levels, road assets are filtered by type:

| Zoom Level | Road Types Displayed |
|------------|---------------------|
| 12-13 | arterial only |
| 14-15 | arterial, collector |
| >= 16 | all types |

This is implemented in `MapView.tsx` via `getRoadTypesForZoom()`:

```typescript
const getRoadTypesForZoom = (zoom: number): RoadType[] | undefined => {
  const z = Math.floor(zoom); // Avoid float boundary flickering
  if (z < 14) return ['arterial'];
  if (z < 16) return ['arterial', 'collector'];
  return undefined; // Show all types
};
```

## Interactions

### Click Handlers

- **Event polygon/line**: Select event, switch to events view
- **Asset line**: Select asset (read-only), switch to assets view
- **Empty area**: Clear selection

### Hover Effects

- **Events**: Show tooltip with name, status, dates, department
- **Assets**: Show popup with name and road type
- Cursor changes to pointer on hoverable features

### Selection Behavior

When an event or asset is selected:
1. Highlight layer is updated
2. Map flies to feature bounds with padding
3. Detail panel opens in sidebar

**Prototype note**: no road edit or road update mode should be exposed; selection is for reference only.

## State Management

### mapStore (Zustand)

```typescript
interface MapState {
  center: [number, number];      // Default: Nagoya [136.9066, 35.1815]
  zoom: number;                  // Default: 12
  mapTheme: MapTheme;           // Default: 'voyager'
  showEvents: boolean;          // Layer visibility toggles
  showAssets: boolean;
  showInspections: boolean;
  highlightedFeatureId: string | null;
  drawnGeometry: GeoJSON.Geometry | null;
}
```

### uiStore Interactions

- `selectedEventId` / `selectedAssetId`: Current selection
- `previewGeometry`: Corridor preview from EventForm
- `openEventDetailModal()`: Opens event detail modal

## Key Implementation Patterns

### Map Initialization

```typescript
useEffect(() => {
  map.current = new maplibregl.Map({
    container: mapContainer.current,
    style: { version: 8, sources: {...}, layers: [...] },
    center: center,
    zoom: zoom,
  });

  map.current.on('load', () => {
    // Add custom sources and layers
    // Setup event handlers
    setMapLoaded(true);
  });
}, []);
```

### Layer Visibility Control

```typescript
map.current.setLayoutProperty(
  'events-fill',
  'visibility',
  showEvents ? 'visible' : 'none'
);
```

### Feature Selection with Fly-to

```typescript
const bbox = turf.bbox(event.geometry);
map.current.fitBounds(
  [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
  { padding: 100, maxZoom: 16, duration: 1000 }
);
```

## Files

| File | Description |
|------|-------------|
| `components/MapView.tsx` | Main map component |
| `components/EventMapTooltip.tsx` | Event hover tooltip |
| `stores/mapStore.ts` | Map state management |
| `stores/uiStore.ts` | UI state (selection, modals) |

## Future Considerations

### Vector Tiles (Not Implemented)

For better label control and print-like appearance, consider switching to CARTO GL vector styles:

```typescript
// Vector style URL (requires style.load handler for custom layers)
style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'
```

This would enable:
- Label text/halo customization via `setPaintProperty`
- Better zoom-level label visibility control
- Smaller tile sizes at high zoom levels

Trade-offs:
- Requires idempotent layer addition on theme switch
- More complex event handler management

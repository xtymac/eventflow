import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import * as turf from '@turf/turf';
import { Protocol } from 'pmtiles';
import { Box, Paper, Stack, Switch, Text, Group, Button, Badge, Loader, Progress } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconTrash } from '@tabler/icons-react';
import { useEvents, useAssets, useInspections, useEvent, useRiversInBbox, useGreenSpacesInBbox, useStreetLightsInBbox } from '../hooks/useApi';
import { formatLocalDate } from '../utils/dateFormat';
import { useMapStore, type MapTheme } from '../stores/mapStore';
import { useUIStore } from '../stores/uiStore';
import { useSearchStore } from '../stores/searchStore';
import { useMapDraw } from '../hooks/useMapDraw';
import { getRoadAssetLabel, isRoadAssetUnnamed, type RoadAssetLabelFields } from '../utils/roadAssetLabel';
import type { ConstructionEvent, RoadAsset, InspectionRecord, EventStatus, RoadType, AssetStatus } from '@nagoya/shared';
import type { Geometry, Feature } from 'geojson';
import { EventMapTooltip } from './EventMapTooltip';

// Register PMTiles protocol once (avoid duplicate registration on hot reload)
let pmtilesProtocolRegistered = false;
if (!pmtilesProtocolRegistered) {
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  pmtilesProtocolRegistered = true;
}

interface HoveredEventData {
  id: string;
  name: string;
  status: string;
  color: string;
  startDate?: string;
  endDate?: string;
  department?: string;
  restrictionType?: string;
  affectedAssetsCount?: number;
}

// HiDPI/Retina support: CARTO themes use @2x tiles with tileSize 512 for crisp rendering
const THEME_CONFIG: Record<MapTheme, { tiles: string[], attribution: string, tileSize: number }> = {
  light: {
    tiles: ['https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png'],
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    tileSize: 512,
  },
  dark: {
    tiles: ['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'],
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    tileSize: 512,
  },
  voyager: {
    tiles: ['https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png'],
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    tileSize: 512,
  },
  standard: {
    // OSM standard tiles don't support @2x; kept at 256 for compatibility
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    attribution: '&copy; OpenStreetMap Contributors',
    tileSize: 256,
  }
};

const STATUS_COLORS: Record<string, string> = {
  planned: '#3B82F6', // blue
  active: '#F59E0B', // amber
  ended: '#6B7280', // gray
  cancelled: '#EF4444', // red
};

const ROAD_TYPE_COLORS: Record<string, string> = {
  arterial: '#8B5CF6', // purple
  collector: '#06B6D4', // cyan
  local: '#84CC16', // lime
};

// Helper to truncate bbox to 5 decimal places (reduces refetch on tiny moves)
const truncateBbox = (bounds: maplibregl.LngLatBounds) => {
  const fix = (n: number) => n.toFixed(5);
  return `${fix(bounds.getWest())},${fix(bounds.getSouth())},${fix(bounds.getEast())},${fix(bounds.getNorth())}`;
};

// Shrink bbox to center portion (helps API return data centered on viewport)
// At lower zoom levels, we shrink more to ensure data is centered
const shrinkBbox = (bounds: maplibregl.LngLatBounds, zoom: number): maplibregl.LngLatBounds => {
  // Shrink factor: at zoom 14 shrink to 60%, at zoom 16+ use full bbox
  const shrinkFactor = zoom >= 16 ? 1.0 : zoom >= 15 ? 0.8 : 0.6;

  const center = bounds.getCenter();
  const west = bounds.getWest();
  const east = bounds.getEast();
  const south = bounds.getSouth();
  const north = bounds.getNorth();

  const halfWidth = (east - west) / 2 * shrinkFactor;
  const halfHeight = (north - south) / 2 * shrinkFactor;

  return new maplibregl.LngLatBounds(
    [center.lng - halfWidth, center.lat - halfHeight],
    [center.lng + halfWidth, center.lat + halfHeight]
  );
};

export function MapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isMapIdle, setIsMapIdle] = useState(true);

  // Viewport-based asset loading state
  const [mapBbox, setMapBbox] = useState<string | null>(null);
  const [currentZoom, setCurrentZoom] = useState(useMapStore.getState().zoom);
  const moveendTimer = useRef<number | null>(null);
  const handleMoveendRef = useRef<(() => void) | null>(null);

  const {
    center,
    zoom,
    mapTheme,
    showEvents,
    showAssets,
    showInspections,
    showRivers,
    showGreenSpaces,
    showStreetLights,
    toggleEvents,
    toggleAssets,
    toggleInspections,
    toggleRivers,
    toggleGreenSpaces,
    toggleStreetLights,
    roadTileVersion,
    importAreaHighlight,
    setImportAreaHighlight,
  } = useMapStore();
  const {
    selectedEventId,
    selectedAssetId,
    selectedAssetGeometry,
    selectEvent,
    selectAsset,
    currentView,
    setCurrentView,
    previewGeometry,
    isEventFormOpen,
    editingEventId,
    duplicateEventId,
    openEventDetailModal,
    closeEventDetailModal,
    hoveredAssetId,
    hoveredGreenspaceId,
    hoveredStreetlightId,
    hoveredEventId,
    selectedRoadAssetIdsForForm,
    selectedAssetDetailsCache,
    setMapBbox: setMapBboxStore,
    flyToGeometry,
    flyToCloseUp,
    setFlyToGeometry,
    // Drawing state
    drawMode,
    drawnFeatures,
    addDrawnFeature,
    setDrawnFeatures,
    setCurrentDrawType,
    setDrawMode,
    setIsDrawingActive,
    drawAction,
    clearDrawAction,
    shouldZoomToDrawing,
    setShouldZoomToDrawing,
    // Drawing context (shared between event form, road update, inspection form)
    drawingContext,
    setInspectionDrawnPoint,
    setRoadUpdateDrawnFeatures,
    selectInspection,
    // Road update mode
    isRoadUpdateModeActive,
    roadUpdateSelectedAssetIds,
    // Filter state
    eventFilters,
    assetFilters,
  } = useUIStore();

  // Search store for map search marker
  const { searchCenter, clearSearch } = useSearchStore();

  const popup = useRef<maplibregl.Popup | null>(null);

  // Locked tooltip state (for selected event - stays visible)
  const [lockedEvent, setLockedEvent] = useState<HoveredEventData | null>(null);
  const [lockedTooltipPosition, setLockedTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const isLockedTooltipHoveredRef = useRef(false);
  const lockedEventIdRef = useRef<string | null>(null);
  const editingEventIdRef = useRef<string | null>(null);

  // Preview tooltip state (for hovering other events - temporary)
  const [previewEvent, setPreviewEvent] = useState<HoveredEventData | null>(null);
  const [previewTooltipPosition, setPreviewTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const isPreviewTooltipHoveredRef = useRef(false);
  const currentHoveredEventIdRef = useRef<string | null>(null);
  const previewTooltipTimeoutRef = useRef<number | null>(null);

  // Track which asset we've already flown to (prevent repeated fitBounds on assetsData change)
  const lastFlownAssetIdRef = useRef<string | null>(null);

  // Animation ref for flowing border effect
  const animationFrameRef = useRef<number | null>(null);

  // Track last restored features to prevent duplicate restores
  const lastRestoredFeaturesRef = useRef<string | null>(null);

  // Delayed zoom after page refresh: wait 2s before zooming to selected event
  const initialZoomPendingRef = useRef<string | null>(null);
  const initialZoomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userInteractedRef = useRef(false);

  // Track if current zoom is close-up for toggle behavior on double-click
  const isMapCloseUpRef = useRef(false);

  // For manual double-click detection on map events
  const lastClickTimeRef = useRef<number>(0);
  const lastClickEventIdRef = useRef<string | null>(null);

  // Delayed geometry loading state - adds a small delay after draw loads to ensure rendering
  const [isGeometryLoadingDelayed, setIsGeometryLoadingDelayed] = useState(false);
  const geometryLoadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refs to access latest values in polling closure (avoids stale closure issues)
  const isDrawReadyRef = useRef(false);
  const restoreFeaturesRef = useRef<((features: Feature[] | null) => void) | null>(null);
  const doubleClickCooldownRef = useRef<number>(0); // Ignore clicks until this timestamp
  const lastAssetIdsHashRef = useRef<string>(''); // Track rendered asset IDs hash to avoid flickering

  // Debounced asset search (consistent with AssetList behavior)
  const [debouncedAssetSearch] = useDebouncedValue(assetFilters.search, 300);

  // Check if any asset filters are active
  const hasActiveAssetFilters = !!(
    assetFilters.roadType ||
    assetFilters.status ||
    assetFilters.ward ||
    assetFilters.unnamed ||
    debouncedAssetSearch
  );

  const { data: eventsData } = useEvents({
    name: eventFilters.search || undefined,
    status: eventFilters.status as EventStatus | undefined,
    department: eventFilters.department || undefined,
    startDateFrom: formatLocalDate(eventFilters.dateRange.from),
    startDateTo: formatLocalDate(eventFilters.dateRange.to),
  });
  // Fetch editing event separately to avoid losing it when filtered out
  const { data: editingEventResponse } = useEvent(editingEventId);
  // Fetch duplicate event for displaying source geometry in duplicate mode
  const { data: duplicateEventResponse } = useEvent(duplicateEventId);
  // Fetch selected event separately (for archived event preview on map)
  const { data: selectedEventResponse } = useEvent(selectedEventId);
  // Viewport-based asset loading for interaction
  // - zoom >= 14: load assets in viewport (for selection)
  // - filters active at low zoom: load ALL filtered assets (no bbox, show globally)
  // - filters active at high zoom: load filtered assets in viewport (bbox for performance)
  // PMTiles covers all zoom levels for preview; API enables selection and filtering
  const useGlobalFilter = hasActiveAssetFilters && currentZoom < 14;
  // Dynamic limit based on zoom: lower zoom = larger area = need higher limit
  // Zoom 14: ~9000 roads in viewport, zoom 16+: ~500 roads
  const assetLimit = currentZoom >= 17 ? 2000 : currentZoom >= 16 ? 5000 : 10000;
  const { data: assetsData, isLoading: isAssetsLoading, isFetching: isAssetsFetching } = useAssets(
    {
      roadType: assetFilters.roadType as RoadType | undefined,
      status: assetFilters.status as AssetStatus | undefined,
      ward: assetFilters.ward || undefined,
      q: debouncedAssetSearch || undefined,
      unnamed: assetFilters.unnamed || undefined,
      // At low zoom with filters: skip bbox to show all filtered assets globally
      // At high zoom or no filters: use bbox for viewport-based loading
      bbox: useGlobalFilter ? undefined : (mapBbox ?? undefined),
      limit: assetLimit,
      includeTotal: false,
    },
    // Enable when: showAssets AND (mapBbox exists for viewport mode OR global filter mode)
    { enabled: showAssets && (!!mapBbox || useGlobalFilter) && (currentZoom >= 14 || hasActiveAssetFilters) }
  );
  const { data: inspectionsData } = useInspections();

  // Rivers data - load when visible and zoom >= 13 (with geometry simplification)
  const { data: riversData } = useRiversInBbox(
    mapBbox ?? null,
    undefined,
    { enabled: showRivers && !!mapBbox && currentZoom >= 13, zoom: currentZoom }
  );

  // Green spaces data - load when zoom >= 12 (for map display and sidebar hover support)
  const { data: greenSpacesData } = useGreenSpacesInBbox(
    mapBbox ?? null,
    undefined,
    { enabled: !!mapBbox && currentZoom >= 12, zoom: currentZoom }
  );

  // Street lights data - load when zoom >= 14 (for map display and sidebar hover support)
  const { data: streetLightsData } = useStreetLightsInBbox(
    mapBbox ?? null,
    undefined,
    { enabled: !!mapBbox && currentZoom >= 14 }
  );

  // Drawing mode: enable when any editor has active drawing context
  const isDrawingEnabled = !!drawingContext;

  // Get initial geometry for editing (only used when editing an existing event with manual geometry)
  // Use separately fetched data first (in case event is filtered out), then fall back to list data
  const editingEventData = editingEventResponse?.data ?? eventsData?.data?.find((e: ConstructionEvent) => e.id === editingEventId);
  const initialDrawGeometry = editingEventData?.geometrySource === 'manual' ? editingEventData.geometry : null;

  // Handle new feature created - add to store and lock type
  const handleFeatureCreated = (feature: import('geojson').Feature) => {
    console.log('[MapView] Feature created:', feature.geometry?.type, 'context:', drawingContext);
    const geomType = feature.geometry?.type;

    // Route based on drawing context
    if (drawingContext === 'inspection-form' && geomType === 'Point') {
      // For inspection forms, set the point directly
      setInspectionDrawnPoint(feature.geometry as import('geojson').Point);
      return;
    }

    if (drawingContext === 'road-update' && (geomType === 'LineString' || geomType === 'MultiLineString')) {
      // For road update mode, store in road update features
      setRoadUpdateDrawnFeatures([feature]);
      return;
    }

    // Default: event form drawing
    addDrawnFeature(feature);

    // Lock to this geometry type after first shape
    if (geomType === 'Polygon') {
      setCurrentDrawType('polygon');
    } else if (geomType === 'LineString') {
      setCurrentDrawType('line');
    }
  };

  // Handle features changed (update/delete, also called when loading initial geometry)
  const handleFeaturesChange = (features: import('geojson').Feature[]) => {
    console.log('[MapView] Features changed:', features.length);
    setDrawnFeatures(features.length > 0 ? features : null);

    if (features.length === 0) {
      // Unlock type if no features left
      setCurrentDrawType(null);
    } else if (features.length > 0 && !drawnFeatures?.length) {
      // When loading initial geometry, set the type based on first feature
      const firstType = features[0].geometry?.type;
      if (firstType === 'Polygon') {
        setCurrentDrawType('polygon');
      } else if (firstType === 'LineString') {
        setCurrentDrawType('line');
      }
    }
  };

  // Handle drawing completion - switch to select mode in UI and trigger zoom
  const handleDrawComplete = () => {
    console.log('[MapView] Drawing complete, switching to select mode');
    setDrawMode(null); // null represents 'select' mode
    setIsDrawingActive(false);
    // Note: No auto-zoom after drawing - user can use manual zoom button in EventForm
  };

  // Initialize map drawing - pass currentMode so hook handles mode changes internally
  // Note: deleteLastFeature and startAddAnother are available for EventForm via store actions
  const {
    deleteAll: deleteDrawing,
    deleteLastFeature: _deleteLastFeature,
    finishDrawing,
    cancelDrawing,
    startAddAnother: _startAddAnother,
    isDrawing: _isDrawing, // Used by EventForm via store actions
    restoreFeatures,
    isReady: isDrawReady,
    getAllFeatures,
  } = useMapDraw(
    map.current,
    isDrawingEnabled,
    mapLoaded,
    {
      onFeatureCreated: handleFeatureCreated,
      onFeaturesChange: handleFeaturesChange,
      onDrawComplete: handleDrawComplete,
      initialGeometry: initialDrawGeometry,
      geometrySource: editingEventData?.geometrySource,
      currentMode: drawMode,
    }
  );

  // Keep refs updated for use in polling closures (avoids stale closure issues)
  isDrawReadyRef.current = isDrawReady;
  restoreFeaturesRef.current = restoreFeatures;

  // Clear restore tracking when form closes
  useEffect(() => {
    if (!isEventFormOpen) {
      lastRestoredFeaturesRef.current = null;
    }
  }, [isEventFormOpen]);

  // Handle draw actions from store (for touch-friendly buttons in EventForm)
  useEffect(() => {
    if (!drawAction) return;

    switch (drawAction) {
      case 'finish':
        finishDrawing();
        clearDrawAction();
        break;
      case 'cancel':
        cancelDrawing();
        // Clear the restore ref when canceling
        lastRestoredFeaturesRef.current = null;
        clearDrawAction();
        break;
      case 'restore':
        // Restore features from store (for undo/redo and duplicate load)
        // Guard: wait for draw control to be ready - don't clear action, let effect re-run
        if (!isDrawReady) {
          console.log('[MapView] Draw control not ready, waiting...');
          return; // Effect will re-run when isDrawReady changes
        }

        // Guard: prevent duplicate restores for the same features
        const featuresHash = drawnFeatures ? JSON.stringify(drawnFeatures) : null;
        if (featuresHash === lastRestoredFeaturesRef.current) {
          console.log('[MapView] Skipping duplicate restore');
          clearDrawAction();
          return;
        }

        console.log('[MapView] Restoring features:', drawnFeatures?.length ?? 0);
        restoreFeatures(drawnFeatures);
        lastRestoredFeaturesRef.current = featuresHash;

        // Fly to restored geometry after features are on map
        // Must handle BOTH Polygon and LineString types
        if (drawnFeatures && drawnFeatures.length > 0) {
          let combinedGeometry: Geometry;
          const firstType = drawnFeatures[0].geometry?.type;

          console.log('[MapView] Restore: flying to geometry, firstType:', firstType, 'count:', drawnFeatures.length);

          if (drawnFeatures.length === 1) {
            combinedGeometry = drawnFeatures[0].geometry as Geometry;
          } else if (firstType === 'Polygon') {
            combinedGeometry = {
              type: 'MultiPolygon',
              coordinates: drawnFeatures.map(f => (f.geometry as GeoJSON.Polygon).coordinates),
            };
          } else if (firstType === 'LineString') {
            combinedGeometry = {
              type: 'MultiLineString',
              coordinates: drawnFeatures.map(f => (f.geometry as GeoJSON.LineString).coordinates),
            };
          } else {
            // Fallback: use bbox for other types
            const fc = turf.featureCollection(drawnFeatures);
            const bbox = turf.bbox(fc);
            combinedGeometry = turf.bboxPolygon(bbox).geometry;
          }

          console.log('[MapView] Restore: calling setFlyToGeometry with', combinedGeometry.type);
          setFlyToGeometry(combinedGeometry, true);
        }

        clearDrawAction();
        break;
    }
  }, [drawAction, finishDrawing, cancelDrawing, restoreFeatures, drawnFeatures, clearDrawAction, isDrawReady, setFlyToGeometry]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const theme = useMapStore.getState().mapTheme; // Get initial theme

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        // Glyphs URL for text labels - using Protomaps font service (reliable, free)
        glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
        sources: {
          osm: {
            type: 'raster',
            tiles: THEME_CONFIG[theme].tiles,
            tileSize: THEME_CONFIG[theme].tileSize,
            attribution: THEME_CONFIG[theme].attribution,
          },
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
          },
        ],
      },
      center: center,
      zoom: zoom,
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.current.addControl(new maplibregl.ScaleControl(), 'bottom-right');

    map.current.on('load', () => {
      if (!map.current) return;

      // Add direction arrow image for one-way roads
      // Arrow points RIGHT (east) - MapLibre rotates from this base direction to follow line geometry
      const arrowSvg = `
        <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 12 L12 6 L12 10 L20 10 L20 14 L12 14 L12 18 Z" fill="#ffffff" stroke="#333333" stroke-width="1"/>
        </svg>
      `;
      const img = new Image(24, 24);
      img.onload = () => {
        if (map.current && !map.current.hasImage('direction-arrow')) {
          map.current.addImage('direction-arrow', img);
        }
      };
      img.src = 'data:image/svg+xml;base64,' + btoa(arrowSvg);

      // Road assets source and layers
      map.current.addSource('assets', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Road assets line layer (renders LineString centerlines with zoom-based width)
      map.current.addLayer({
        id: 'assets-line',
        type: 'line',
        source: 'assets',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            14, 4,
            16, 6,
            18, 8
          ],
          'line-opacity': 0.8,
        },
      });

      // Separate source for editing/selected assets (independent of zoom level)
      map.current.addSource('editing-assets', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Editing selection - breathing glow effect (animated)
      map.current.addLayer({
        id: 'editing-assets-glow',
        type: 'line',
        source: 'editing-assets',
        paint: {
          'line-color': '#60a5fa',
          'line-width': 20,
          'line-blur': 10,
          'line-opacity': 0.3,
        },
      });

      // Editing selection - semi-transparent outline
      map.current.addLayer({
        id: 'editing-assets-line',
        type: 'line',
        source: 'editing-assets',
        paint: {
          'line-color': '#2563eb',
          'line-width': 3,
          'line-opacity': 0.7,
        },
      });

      // Assets label layer (high zoom: 15+, where API data is available)
      map.current.addLayer({
        id: 'assets-label',
        type: 'symbol',
        source: 'assets',
        minzoom: 14,
        layout: {
          'text-field': [
            'get',
            'labelText',
          ],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10, 15, 11, 18, 14],
          'symbol-placement': 'line',
          'text-max-angle': 30,
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#1a1a1a',
          'text-halo-color': 'rgba(255,255,255,0.9)',
          'text-halo-width': 2,
        },
      });

      // Direction arrows for one-way roads
      map.current.addLayer({
        id: 'road-direction-arrows',
        type: 'symbol',
        source: 'assets',
        minzoom: 15,  // Only visible at high zoom
        filter: ['==', ['get', 'direction'], 'one-way'],
        layout: {
          'icon-image': 'direction-arrow',
          'symbol-placement': 'line',
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': false,
          'symbol-spacing': 100,  // Pixels between arrows
          'icon-size': [
            'interpolate', ['linear'], ['zoom'],
            15, 0.5,
            17, 0.7,
            18, 0.9
          ],
        },
        paint: {
          'icon-opacity': [
            'interpolate', ['linear'], ['zoom'],
            14, 0,
            15, 0.6,
            16, 0.8
          ],
        },
      });

      // Roads preview source - always use PMTiles for performance
      // PMTiles are pre-generated with optimized geometry simplification
      // Martin is available for real-time data needs but slower
      map.current.addSource('roads-preview', {
        type: 'vector',
        url: 'pmtiles:///tiles/roads.pmtiles',
      });

      // Roads preview layer (PMTiles source layer is 'roads')
      // Visible at all zoom levels as background; API data overlays on top at zoom >= 14
      const sourceLayer = 'roads';
      map.current.addLayer({
        id: 'roads-preview-line',
        type: 'line',
        source: 'roads-preview',
        'source-layer': sourceLayer,
        paint: {
          'line-color': [
            'match',
            ['get', 'roadType'],
            'arterial', '#8B5CF6', // purple
            'collector', '#06B6D4', // cyan
            'local', '#84CC16', // lime
            '#84CC16' // default
          ],
          'line-width': ['interpolate', ['linear'], ['zoom'], 13, 2, 14, 4],
          'line-opacity': 0.8,
        },
      }, 'assets-line'); // Insert below assets-line

      // Roads preview label layer (Martin or PMTiles, zoom < 14 only)
      // At zoom 14+, API data (assets-label) takes over with more accurate labels
      map.current.addLayer({
        id: 'roads-preview-label',
        type: 'symbol',
        source: 'roads-preview',
        'source-layer': sourceLayer,
        maxzoom: 14, // Hide at zoom 14+, where assets-label takes over
        layout: {
          'text-field': [
            'coalesce',
            ['get', 'displayName'],
            ['get', 'name'],
            ['get', 'ref'],
            '',
          ],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 10, 9, 14, 11],
          'symbol-placement': 'line-center',
          'text-max-angle': 30,
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#333',
          'text-halo-color': '#fff',
          'text-halo-width': 1.5,
        },
      });

      // Events source and layers
      // Status-based layers: ended (bottom) → planned (middle) → active (top)
      // This ensures active events are always clickable on top
      map.current.addSource('events', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // ENDED events (bottom layer - gray, less prominent)
      // Note: Using legacy filter syntax - property names as strings, not ['get', 'prop']
      // $type only supports Point, LineString, Polygon (MultiPolygon treated as Polygon)
      map.current.addLayer({
        id: 'events-ended-fill',
        type: 'fill',
        source: 'events',
        filter: ['all', ['==', '$type', 'Polygon'], ['==', 'status', 'ended']],
        paint: {
          'fill-color': STATUS_COLORS.ended,
          'fill-opacity': 0.1,
        },
      });

      map.current.addLayer({
        id: 'events-ended-line',
        type: 'line',
        source: 'events',
        filter: ['==', 'status', 'ended'],
        paint: {
          'line-color': STATUS_COLORS.ended,
          'line-width': 2,
        },
      });

      // PLANNED events (middle layer - blue)
      map.current.addLayer({
        id: 'events-planned-fill',
        type: 'fill',
        source: 'events',
        filter: ['all', ['==', '$type', 'Polygon'], ['==', 'status', 'planned']],
        paint: {
          'fill-color': STATUS_COLORS.planned,
          'fill-opacity': 0.15,
        },
      });

      map.current.addLayer({
        id: 'events-planned-line',
        type: 'line',
        source: 'events',
        filter: ['==', 'status', 'planned'],
        paint: {
          'line-color': STATUS_COLORS.planned,
          'line-width': 3,
        },
      });

      // ACTIVE events (top layer - amber, most prominent)
      map.current.addLayer({
        id: 'events-active-fill',
        type: 'fill',
        source: 'events',
        filter: ['all', ['==', '$type', 'Polygon'], ['==', 'status', 'active']],
        paint: {
          'fill-color': STATUS_COLORS.active,
          'fill-opacity': 0.2,
        },
      });

      map.current.addLayer({
        id: 'events-active-line',
        type: 'line',
        source: 'events',
        filter: ['==', 'status', 'active'],
        paint: {
          'line-color': STATUS_COLORS.active,
          'line-width': 4,
        },
      });

      // Hit areas for easier clicking - MUST have BOTH fill and line types
      // Fill hit area (for Polygon events - MapLibre treats MultiPolygon as Polygon for $type)
      map.current.addLayer({
        id: 'events-hit-area-fill',
        type: 'fill',
        source: 'events',
        filter: ['==', '$type', 'Polygon'],
        paint: {
          'fill-color': '#000000',
          'fill-opacity': 0.001,
        },
      });

      // Line hit area (for LineString events - MapLibre treats MultiLineString as LineString for $type)
      map.current.addLayer({
        id: 'events-hit-area-line',
        type: 'line',
        source: 'events',
        filter: ['==', '$type', 'LineString'],
        paint: {
          'line-color': '#000000',
          'line-width': 20,
          'line-opacity': 0.001,
        },
      });

      // Hover highlight layers for events (shown when hovering event card in list)
      // Fill layer for Polygon/MultiPolygon events
      map.current.addLayer({
        id: 'hovered-event-fill',
        type: 'fill',
        source: 'events',
        filter: ['==', ['get', 'id'], ''], // Initial: match nothing
        paint: {
          'fill-color': '#f59e0b', // Amber/orange
          'fill-opacity': 0.15, // Low opacity so roads underneath are visible
        },
      });

      // Line layer for all event geometry types
      map.current.addLayer({
        id: 'hovered-event-line',
        type: 'line',
        source: 'events',
        filter: ['==', ['get', 'id'], ''], // Initial: match nothing
        paint: {
          'line-color': '#f59e0b', // Amber/orange
          'line-width': 6,
          'line-opacity': 1,
        },
      });

      // Inspections source and layers
      map.current.addSource('inspections', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.current.addLayer({
        id: 'inspections-point',
        type: 'circle',
        source: 'inspections',
        paint: {
          'circle-radius': 8,
          'circle-color': '#EC4899',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
        },
      });

      // Rivers source and layers (blue for water)
      map.current.addSource('rivers', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Rivers fill layer (for polygon rivers - water body areas)
      // Very low opacity so roads on bridges are still clearly visible
      // Insert before roads-preview-line so rivers render BELOW roads
      map.current.addLayer({
        id: 'rivers-fill',
        type: 'fill',
        source: 'rivers',
        filter: ['==', ['get', 'geometryType'], 'polygon'],
        paint: {
          'fill-color': '#60A5FA', // Lighter blue for water body
          'fill-opacity': 0.15,   // Very low opacity
        },
      }, 'roads-preview-line'); // Insert below roads

      // Rivers line layer (for line rivers only - not polygon outlines)
      map.current.addLayer({
        id: 'rivers-line',
        type: 'line',
        source: 'rivers',
        filter: ['!=', ['get', 'geometryType'], 'polygon'], // Only line rivers
        paint: {
          'line-color': '#3B82F6',
          'line-width': [
            'case',
            ['==', ['get', 'waterwayType'], 'river'], 4,   // Wider for major rivers
            ['==', ['get', 'waterwayType'], 'canal'], 3,   // Medium for canals
            2 // Default for streams/drains
          ],
          'line-opacity': 0.8,
        },
      }, 'roads-preview-line'); // Insert below roads

      // Rivers label layer
      map.current.addLayer({
        id: 'rivers-label',
        type: 'symbol',
        source: 'rivers',
        minzoom: 13,
        layout: {
          'text-field': ['get', 'displayName'],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10, 16, 12],
          'symbol-placement': 'line',
          'text-max-angle': 30,
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#1e40af',
          'text-halo-color': 'rgba(255,255,255,0.9)',
          'text-halo-width': 2,
        },
      });

      // Green spaces source and layers (green for parks/gardens)
      map.current.addSource('greenspaces', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Green spaces fill layer - render below roads
      map.current.addLayer({
        id: 'greenspaces-fill',
        type: 'fill',
        source: 'greenspaces',
        layout: {
          'visibility': 'visible',
        },
        paint: {
          'fill-color': '#22C55E',
          'fill-opacity': 0.4,
        },
      }, 'roads-preview-line'); // Insert below roads

      // Green spaces outline layer
      map.current.addLayer({
        id: 'greenspaces-line',
        type: 'line',
        source: 'greenspaces',
        layout: {
          'visibility': 'visible',
        },
        paint: {
          'line-color': '#16A34A',
          'line-width': 2,
          'line-opacity': 0.8,
        },
      }, 'roads-preview-line'); // Insert below roads

      // Green spaces label layer
      map.current.addLayer({
        id: 'greenspaces-label',
        type: 'symbol',
        source: 'greenspaces',
        minzoom: 14,
        layout: {
          'visibility': 'visible',
          'text-field': ['get', 'displayName'],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10, 16, 12],
          'text-anchor': 'center',
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#166534',
          'text-halo-color': 'rgba(255,255,255,0.9)',
          'text-halo-width': 2,
        },
      });

      // Street lights source and layers (amber for lights)
      map.current.addSource('streetlights', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Street lights circle layer
      map.current.addLayer({
        id: 'streetlights-circle',
        type: 'circle',
        source: 'streetlights',
        minzoom: 14,
        layout: {
          'visibility': 'visible',
        },
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            14, 4,
            16, 6,
            18, 10
          ],
          'circle-color': '#FBBF24', // Default amber for all (lampStatus might not be set)
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
          'circle-opacity': 1,
        },
      });

      // Highlight layers for selected features
      map.current.addSource('selected-event', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.current.addLayer({
        id: 'selected-event-fill',
        type: 'fill',
        source: 'selected-event',
        filter: ['==', '$type', 'Polygon'],
        paint: {
          'fill-color': '#EF4444',
          'fill-opacity': 0.5,
        },
      });

      map.current.addLayer({
        id: 'selected-event-line',
        type: 'line',
        source: 'selected-event',
        paint: {
          'line-color': '#EF4444',
          'line-width': 6,
        },
      });

      // Editing event source and layers (transparent polygon for editing mode)
      map.current.addSource('editing-event', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.current.addLayer({
        id: 'editing-event-fill',
        type: 'fill',
        source: 'editing-event',
        filter: ['==', '$type', 'Polygon'],
        paint: {
          'fill-color': '#ffffff', // white panel
          'fill-opacity': 0.5, // Semi-transparent white
        },
      });

      // Solid line for editing event (color from event status)
      map.current.addLayer({
        id: 'editing-event-line',
        type: 'line',
        source: 'editing-event',
        paint: {
          'line-color': ['get', 'color'], // Use event status color
          'line-width': 3,
          'line-opacity': 1,
        },
      });

      map.current.addSource('selected-asset', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Glow layer (outer) for selected asset - animated breathing effect
      map.current.addLayer({
        id: 'selected-asset-glow',
        type: 'line',
        source: 'selected-asset',
        paint: {
          'line-color': '#f87171',
          'line-width': 16,
          'line-blur': 8,
          'line-opacity': 0.4,
        },
      });

      // Fill layer for polygon geometries (selected asset) - more transparent
      map.current.addLayer({
        id: 'selected-asset-fill',
        type: 'fill',
        source: 'selected-asset',
        filter: ['==', '$type', 'Polygon'],
        paint: {
          'fill-color': '#ef4444',
          'fill-opacity': 0.15,
        },
      });

      // Outline for polygon geometries (selected asset) - semi-transparent
      map.current.addLayer({
        id: 'selected-asset-outline',
        type: 'line',
        source: 'selected-asset',
        filter: ['==', '$type', 'Polygon'],
        paint: {
          'line-color': '#dc2626',
          'line-width': 2.5,
          'line-opacity': 0.8,
        },
      });

      // Hover highlight glow layer (outer glow for visibility)
      map.current.addLayer({
        id: 'hovered-asset-glow',
        type: 'line',
        source: 'assets',
        filter: ['==', ['get', 'id'], ''], // Initial: match nothing
        paint: {
          'line-color': '#f59e0b', // Amber/orange glow
          'line-width': 16,
          'line-blur': 6,
          'line-opacity': 0.7,
        },
      }, 'selected-asset-glow'); // Insert below selected layer

      // Hover highlight layer (main line)
      map.current.addLayer({
        id: 'hovered-asset-line',
        type: 'line',
        source: 'assets',
        filter: ['==', ['get', 'id'], ''], // Initial: match nothing
        paint: {
          'line-color': '#f59e0b', // Amber/orange - more visible
          'line-width': 8,
          'line-opacity': 1,
        },
      }, 'selected-asset-glow'); // Insert below selected layer

      // Greenspace hover highlight layers
      map.current.addLayer({
        id: 'hovered-greenspace-fill',
        type: 'fill',
        source: 'greenspaces',
        filter: ['==', ['get', 'id'], ''], // Initial: match nothing
        paint: {
          'fill-color': '#f59e0b', // Amber/orange
          'fill-opacity': 0.5,
        },
      });

      map.current.addLayer({
        id: 'hovered-greenspace-line',
        type: 'line',
        source: 'greenspaces',
        filter: ['==', ['get', 'id'], ''], // Initial: match nothing
        paint: {
          'line-color': '#f59e0b', // Amber/orange
          'line-width': 5,
          'line-opacity': 1,
        },
      });

      // Streetlight hover highlight layer
      map.current.addLayer({
        id: 'hovered-streetlight-circle',
        type: 'circle',
        source: 'streetlights',
        filter: ['==', ['get', 'id'], ''], // Initial: match nothing
        paint: {
          'circle-radius': 18,
          'circle-color': '#f59e0b', // Amber/orange
          'circle-stroke-width': 3,
          'circle-stroke-color': '#fff',
          'circle-opacity': 0.9,
        },
      });

      // Preview geometry source and layers (for EventForm corridor preview)
      map.current.addSource('preview-geometry', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.current.addLayer({
        id: 'preview-geometry-fill',
        type: 'fill',
        source: 'preview-geometry',
        filter: ['==', '$type', 'Polygon'],
        paint: {
          'fill-color': '#06B6D4', // cyan
          'fill-opacity': 0, // No fill for preview - just outline
        },
      });

      map.current.addLayer({
        id: 'preview-geometry-line',
        type: 'line',
        source: 'preview-geometry',
        layout: {
          'visibility': 'none', // Hidden - corridor preview not needed
        },
        paint: {
          'line-color': '#06B6D4', // cyan
          'line-width': 3,
        },
      });

      // Create popup
      popup.current = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
      });

      // Click handlers
      map.current.on('click', (e) => {
        // Don't handle background clicks while actively drawing - let the draw library handle them
        if (useUIStore.getState().isDrawingActive) return;

        // Check if we clicked on any features
        const features = map.current?.queryRenderedFeatures(e.point, {
          layers: [
            'events-ended-fill', 'events-ended-line',
            'events-planned-fill', 'events-planned-line',
            'events-active-fill', 'events-active-line',
            'events-hit-area-fill', 'events-hit-area-line',
            'assets-line', 'inspections-point'
          ]
        });

        // If no features were clicked, clear selection and tooltips
        if (!features || features.length === 0) {
          const state = useUIStore.getState();
          // Don't clear selection during any editor mode
          if (state.isEventFormOpen || state.isRoadUpdateModeActive || state.drawingContext) return;
          selectEvent(null);
          selectAsset(null);
          // Clear both tooltips
          lockedEventIdRef.current = null;
          setLockedEvent(null);
          setLockedTooltipPosition(null);
          setPreviewEvent(null);
          setPreviewTooltipPosition(null);
          currentHoveredEventIdRef.current = null;
          // Don't change currentView to keep context
        }
      });

      // Helper to check if road interaction should be enabled
      const shouldAllowRoadInteraction = () => {
        const state = useUIStore.getState();
        // Allow road interaction in event form (for asset selection)
        if (state.isEventFormOpen) return true;
        // Allow road interaction in road update mode (for asset selection)
        if (state.isRoadUpdateModeActive) return true;
        // Disable road interaction when event is selected, UNLESS in assets view
        if (state.selectedEventId && state.currentView !== 'assets') {
          return false;
        }
        return true;
      };

      // Event click handler with manual double-click detection
      const handleEventClick = (e: maplibregl.MapLayerMouseEvent) => {
        // Don't handle event clicks while actively drawing
        if (useUIStore.getState().isDrawingActive) return;

        if (e.features && e.features[0]) {
          e.originalEvent.stopPropagation();
          const props = e.features[0].properties;
          const eventId = props?.id;
          const geometry = e.features[0].geometry as Geometry;
          const state = useUIStore.getState();
          // Don't handle event clicks during any editor mode
          if (state.isEventFormOpen || state.isRoadUpdateModeActive || state.drawingContext) return;

          const now = Date.now();

          // Ignore clicks during cooldown period (after double-click)
          if (now < doubleClickCooldownRef.current) {
            console.log('[MapView] Ignoring click during cooldown');
            return;
          }

          const timeSinceLastClick = now - lastClickTimeRef.current;
          const isSameEvent = lastClickEventIdRef.current === eventId;

          // Check if this is a double-click (same event within 400ms)
          if (isSameEvent && timeSinceLastClick < 400) {
            console.log('[MapView] Double-click detected on event:', eventId);
            // Double-click: toggle zoom
            const newCloseUp = !isMapCloseUpRef.current;
            console.log('[MapView] Toggling zoom, newCloseUp:', newCloseUp);
            setFlyToGeometry(geometry, newCloseUp);
            // Reset click tracking and set cooldown to ignore subsequent clicks
            lastClickTimeRef.current = 0;
            lastClickEventIdRef.current = null;
            doubleClickCooldownRef.current = now + 500; // Ignore clicks for 500ms after double-click
          } else {
            console.log('[MapView] Single click on event:', eventId);
            // Single click: normal behavior
            // Update click tracking for potential double-click
            lastClickTimeRef.current = now;
            lastClickEventIdRef.current = eventId;

            // Clear tooltips
            setPreviewEvent(null);
            setPreviewTooltipPosition(null);
            setLockedTooltipPosition(null);

            // Toggle right sidebar: if same event is already showing, close it
            if (state.detailModalEventId === eventId) {
              closeEventDetailModal();
            } else {
              // Select event and open detail panel
              if (eventId !== state.selectedEventId) {
                selectEvent(eventId);
                setCurrentView('events');
              }
              openEventDetailModal(eventId);
              // Zoom in to the event geometry (overview)
              setFlyToGeometry(geometry, false);
              isMapCloseUpRef.current = false; // Reset zoom state for new event
            }
          }
        }
      };

      // Disable default map double-click zoom on event features
      map.current.on('dblclick', (e) => {
        const features = map.current?.queryRenderedFeatures(e.point, {
          layers: [
            'events-ended-fill', 'events-ended-line',
            'events-planned-fill', 'events-planned-line',
            'events-active-fill', 'events-active-line',
            'events-hit-area-fill', 'events-hit-area-line',
            'selected-event-fill', 'selected-event-line'
          ]
        });
        if (features && features.length > 0) {
          // Prevent default map zoom on double-click when over event features
          e.preventDefault();
        }
      });

      // Add click handlers for all status-specific event layers
      // Include selected-event layers so clicking a selected event still works
      const eventLayerIds = [
        'events-ended-fill', 'events-ended-line',
        'events-planned-fill', 'events-planned-line',
        'events-active-fill', 'events-active-line',
        'events-hit-area-fill', 'events-hit-area-line',
        'selected-event-fill', 'selected-event-line'
      ];
      for (const layerId of eventLayerIds) {
        map.current.on('click', layerId, handleEventClick);
      }

      map.current.on('click', 'assets-line', (e) => {
        if (e.features && e.features[0]) {
          const feature = e.features[0];
          const props = feature.properties;
          const assetId = props?.id as string | undefined;
          if (!assetId) return;

          const state = useUIStore.getState();

          // Don't handle road clicks while actively drawing - let the draw library handle them
          if (state.isDrawingActive) {
            return;
          }

          // Check if click is on a drawn feature - if so, let the draw library handle it
          // This allows clicking on polygons/lines to select them for editing
          if (state.isEventFormOpen && state.drawnFeatures && state.drawnFeatures.length > 0) {
            const clickPoint = turf.point([e.lngLat.lng, e.lngLat.lat]);

            for (const feature of state.drawnFeatures) {
              if (!feature.geometry) continue;

              try {
                if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
                  // Check if click is inside polygon
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  if (turf.booleanPointInPolygon(clickPoint, feature as any)) {
                    console.log('[MapView] Click inside drawn polygon, letting draw library handle');
                    return;
                  }
                } else if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
                  // Check if click is near line (within ~20 pixels at current zoom)
                  const tolerance = 0.0001 * Math.pow(2, 18 - (map.current?.getZoom() || 14));
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const buffered = turf.buffer(feature as any, tolerance, { units: 'degrees' });
                  if (buffered && turf.booleanPointInPolygon(clickPoint, buffered)) {
                    console.log('[MapView] Click near drawn line, letting draw library handle');
                    return;
                  }
                }
              } catch (err) {
                console.warn('[MapView] Error checking click against drawn feature:', err);
              }
            }
          }

          if (state.isEventFormOpen) {
            e.originalEvent.stopPropagation();
            const current = state.selectedRoadAssetIdsForForm || [];
            const isRemoving = current.includes(assetId);
            const next = isRemoving
              ? current.filter((id) => id !== assetId)
              : [...current, assetId];
            state.setSelectedRoadAssetsForForm(next);

            // Cache asset details when adding (not removing)
            if (!isRemoving && props) {
              const assetFields: RoadAssetLabelFields = {
                id: assetId,
                name: props.name as string | undefined,
                nameJa: props.nameJa as string | undefined,
                ref: props.ref as string | undefined,
                localRef: props.localRef as string | undefined,
                displayName: props.displayName as string | undefined,
              };
              const label = getRoadAssetLabel(assetFields);
              const wardLabel = (props.ward as string) || 'No ward';
              const fullLabel = isRoadAssetUnnamed(assetFields)
                ? `${label} (${wardLabel})`
                : `${label} (${wardLabel}) - ${assetId}`;

              state.cacheAssetDetails([{
                id: assetId,
                label: fullLabel,
                ward: props.ward as string | undefined,
                roadType: props.roadType as string | undefined,
                geometry: feature.geometry as Geometry,  // Include geometry for display at all zoom levels
              }]);
            }
            return;
          }

          // Road Update Mode: toggle asset selection
          if (state.isRoadUpdateModeActive) {
            e.originalEvent.stopPropagation();
            state.toggleRoadUpdateAsset(assetId);

            // Cache asset details for display
            if (props) {
              const assetFields: RoadAssetLabelFields = {
                id: assetId,
                name: props.name as string | undefined,
                nameJa: props.nameJa as string | undefined,
                ref: props.ref as string | undefined,
                localRef: props.localRef as string | undefined,
                displayName: props.displayName as string | undefined,
              };
              const label = getRoadAssetLabel(assetFields);

              state.cacheAssetDetails([{
                id: assetId,
                label,
                ward: props.ward as string | undefined,
                roadType: props.roadType as string | undefined,
                geometry: feature.geometry as Geometry,
              }]);
            }
            return;
          }

          // Don't allow road selection when event is selected (unless in assets view or road update mode)
          if (!shouldAllowRoadInteraction()) {
            return;
          }

          e.originalEvent.stopPropagation();

          // Allow asset selection - this will clear any selected event
          selectAsset(assetId);
          setCurrentView('assets');
        }
      });

      // Inspection point click handler
      map.current.on('click', 'inspections-point', (e) => {
        if (e.features && e.features[0]) {
          const feature = e.features[0];
          const inspectionId = feature.properties?.id as string | undefined;
          if (!inspectionId) return;

          const state = useUIStore.getState();
          // Don't handle inspection clicks during any editor mode
          if (state.isEventFormOpen || state.isRoadUpdateModeActive || state.drawingContext) return;

          e.originalEvent.stopPropagation();
          selectInspection(inspectionId);
        }
      });

      // Alias for backward compatibility in hover handlers
      const shouldAllowRoadHover = shouldAllowRoadInteraction;

      // Cursor changes for event layers
      const eventCursorLayerIds = [
        'events-ended-fill', 'events-ended-line',
        'events-planned-fill', 'events-planned-line',
        'events-active-fill', 'events-active-line',
        'events-hit-area-fill', 'events-hit-area-line',
        'selected-event-fill', 'selected-event-line'
      ];
      for (const layerId of eventCursorLayerIds) {
        map.current.on('mouseenter', layerId, () => {
          if (map.current) map.current.getCanvas().style.cursor = 'pointer';
        });
        map.current.on('mouseleave', layerId, () => {
          if (map.current) map.current.getCanvas().style.cursor = '';
        });
      }
      map.current.on('mouseenter', 'assets-line', () => {
        if (map.current && shouldAllowRoadHover()) {
          map.current.getCanvas().style.cursor = 'pointer';
        }
      });
      map.current.on('mouseleave', 'assets-line', () => {
        if (map.current) map.current.getCanvas().style.cursor = '';
      });

      // Hover tooltip for events (using React component)
      // Shows preview tooltip for non-selected events, locked tooltip stays visible
      const handleEventMouseMove = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
        // Skip tooltips while actively drawing to avoid interaction interruption
        // Use getState() to get fresh value and avoid closure staleness
        if (useUIStore.getState().isDrawingActive) return;

        if (e.features && e.features[0]) {
          const props = e.features[0].properties;
          const eventId = props?.id;

          // Only update when hovering a NEW event
          if (eventId !== currentHoveredEventIdRef.current) {
            // Clear any pending hide timeout since we're on a new event
            if (previewTooltipTimeoutRef.current !== null) {
              window.clearTimeout(previewTooltipTimeoutRef.current);
              previewTooltipTimeoutRef.current = null;
            }

            currentHoveredEventIdRef.current = eventId;

            // If hovering the locked (selected) event or editing event, clear preview tooltip
            if (eventId === lockedEventIdRef.current || eventId === editingEventIdRef.current) {
              setPreviewEvent(null);
              setPreviewTooltipPosition(null);
              return;
            }

            // Show preview tooltip for other events
            const containerRect = mapContainer.current?.getBoundingClientRect();
            const viewportX = (containerRect?.left ?? 0) + e.point.x;
            const viewportY = (containerRect?.top ?? 0) + e.point.y;

            setPreviewEvent({
              id: props?.id,
              name: props?.name,
              status: props?.status,
              color: props?.color,
              startDate: props?.startDate,
              endDate: props?.endDate,
              department: props?.department,
              restrictionType: props?.restrictionType,
              affectedAssetsCount: props?.affectedAssetsCount,
            });
            setPreviewTooltipPosition({ x: viewportX, y: viewportY });
          }
        }
      };

      const handleEventMouseLeave = () => {
        currentHoveredEventIdRef.current = null;

        // Delay to allow user to move mouse to preview tooltip
        previewTooltipTimeoutRef.current = window.setTimeout(() => {
          previewTooltipTimeoutRef.current = null;
          if (!isPreviewTooltipHoveredRef.current && !currentHoveredEventIdRef.current) {
            setPreviewEvent(null);
            setPreviewTooltipPosition(null);
          }
        }, 300);
      };

      // Add hover handlers for all status-specific event layers
      const eventHoverLayerIds = [
        'events-ended-fill', 'events-ended-line',
        'events-planned-fill', 'events-planned-line',
        'events-active-fill', 'events-active-line',
        'events-hit-area-fill', 'events-hit-area-line',
        'selected-event-fill', 'selected-event-line'
      ];
      for (const layerId of eventHoverLayerIds) {
        map.current.on('mousemove', layerId, handleEventMouseMove);
        map.current.on('mouseleave', layerId, handleEventMouseLeave);
      }

      // Hover popup for assets
      map.current.on('mousemove', 'assets-line', (e) => {
        // Skip hover while actively drawing to avoid interaction interruption
        // Use getState() to get fresh value and avoid closure staleness
        if (useUIStore.getState().isDrawingActive) {
          if (popup.current) popup.current.remove();
          return;
        }

        // Skip hover when event is selected (unless in assets view or road update mode)
        if (!shouldAllowRoadHover()) {
          if (map.current) map.current.getCanvas().style.cursor = '';
          if (popup.current) popup.current.remove();
          return;
        }

        // Skip hover when mouse is over an event polygon (show event tooltip instead)
        if (currentHoveredEventIdRef.current || lockedEventIdRef.current) {
          if (popup.current) popup.current.remove();
          return;
        }

        if (map.current && popup.current && e.features && e.features[0]) {
          const props = e.features[0].properties;
          const assetLabel = props
            ? getRoadAssetLabel(props as RoadAssetLabelFields)
            : 'Unnamed Road';
          const html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif; padding: 2px;">
              <div style="font-weight: 700; margin-bottom: 4px; font-size: 14px; color: #000;">${assetLabel}</div>
              <div style="font-size: 12px; color: #222; display: flex; align-items: center;">
                <span style="display:inline-block; width: 8px; height: 8px; background-color: ${props?.color}; border-radius: 50%; margin-right: 6px;"></span>
                <span style="text-transform: capitalize; font-weight: 600;">${props?.roadType}</span>
              </div>
            </div>
          `;
          popup.current.setLngLat(e.lngLat).setHTML(html).addTo(map.current);
        }
      });
      map.current.on('mouseleave', 'assets-line', () => {
        if (popup.current) popup.current.remove();
      });

      // Mark map as loaded
      setMapLoaded(true);

      // Setup moveend handler for viewport-based asset loading
      const handleMoveend = () => {
        if (moveendTimer.current) window.clearTimeout(moveendTimer.current);

        moveendTimer.current = window.setTimeout(() => {
          const zoom = map.current?.getZoom() ?? 0;
          setCurrentZoom(zoom);

          // Sync map center and zoom for distance-based sorting and conditional rendering
          const center = map.current?.getCenter();
          if (center) {
            useUIStore.getState().setMapCenter([center.lng, center.lat]);
            // Persist to mapStore for localStorage persistence
            useMapStore.getState().setCenter([center.lng, center.lat]);
          }
          useUIStore.getState().setMapZoom(zoom);
          // Persist to mapStore for localStorage persistence
          useMapStore.getState().setZoom(zoom);

          // Always update mapBounds for export scope (independent of zoom level)
          const currentBounds = map.current?.getBounds();
          if (currentBounds) {
            useUIStore.getState().setMapBounds({
              north: currentBounds.getNorth(),
              south: currentBounds.getSouth(),
              east: currentBounds.getEast(),
              west: currentBounds.getWest(),
            });
          }

          if (zoom >= 12) {
            const bounds = map.current!.getBounds();
            // Shrink bbox at lower zoom levels to ensure API returns centered data
            const shrunkBounds = shrinkBbox(bounds, zoom);
            const bboxString = truncateBbox(shrunkBounds);
            setMapBbox(bboxString);

            // Sync to uiStore for asset list filtering
            useUIStore.getState().setMapBbox(bboxString);
          } else {
            setMapBbox(null);
            // Clear uiStore bbox when zoomed out
            useUIStore.getState().setMapBbox(null);
          }
        }, 250);
      };

      handleMoveendRef.current = handleMoveend;
      map.current.on('moveend', handleMoveend);

      // Also update on zoomend for faster response when zooming to selectable level
      map.current.on('zoomend', () => {
        const zoom = map.current?.getZoom() ?? 0;
        setCurrentZoom(zoom);
        // Immediately update bbox when crossing zoom 14 threshold
        if (zoom >= 12 && map.current) {
          const bounds = map.current.getBounds();
          // Shrink bbox at lower zoom levels to ensure API returns centered data
          const shrunkBounds = shrinkBbox(bounds, zoom);
          const bboxString = truncateBbox(shrunkBounds);
          setMapBbox(bboxString);
          useUIStore.getState().setMapBbox(bboxString);
        }
      });

      // Cancel delayed initial zoom when user interacts with the map
      const cancelInitialZoom = () => {
        userInteractedRef.current = true;
        if (initialZoomTimerRef.current) {
          clearTimeout(initialZoomTimerRef.current);
          initialZoomTimerRef.current = null;
        }
      };
      map.current.on('dragstart', cancelInitialZoom);
      map.current.on('zoomstart', cancelInitialZoom);

      // Call once after load to fetch initial data without user interaction
      handleMoveend();
    });

    return () => {
      if (moveendTimer.current) window.clearTimeout(moveendTimer.current);
      if (initialZoomTimerRef.current) clearTimeout(initialZoomTimerRef.current);
      if (handleMoveendRef.current && map.current) {
        map.current.off('moveend', handleMoveendRef.current);
      }
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Handle container resize (e.g., when sidebar width changes)
  useEffect(() => {
    if (!mapContainer.current || !map.current) return;

    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;

    const resizeObserver = new ResizeObserver(() => {
      // Debounce resize - only trigger after drag stops (150ms delay)
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        map.current?.resize();
      }, 150);
    });

    resizeObserver.observe(mapContainer.current);

    return () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
    };
  }, [mapLoaded]);

  // Handle theme changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const currentConfig = THEME_CONFIG[mapTheme];
    const mapInstance = map.current;

    // Check if osm source exists
    if (mapInstance.getSource('osm')) {
      // Find the layer immediately above 'osm' to insert before it
      const layers = mapInstance.getStyle().layers;
      const osmLayerIndex = layers?.findIndex(l => l.id === 'osm');
      // If osm is not found, or is the last one, nextLayerId is undefined (adds to top)
      // But we want it at the bottom, so if osm is gone, we might need to find the first layer.
      // If we are replacing, we know where it was.
      
      let nextLayerId: string | undefined;
      if (layers && osmLayerIndex !== undefined && osmLayerIndex !== -1 && osmLayerIndex + 1 < layers.length) {
        nextLayerId = layers[osmLayerIndex + 1].id;
      } else if (layers && layers.length > 0 && (!layers.find(l => l.id === 'osm'))) {
        // If osm layer is missing for some reason, insert before the first layer
        nextLayerId = layers[0].id;
      }

      if (mapInstance.getLayer('osm')) {
        mapInstance.removeLayer('osm');
      }
      // Source removal might fail if layer is still there, but we removed it.
      if (mapInstance.getSource('osm')) {
         mapInstance.removeSource('osm');
      }

      mapInstance.addSource('osm', {
        type: 'raster',
        tiles: currentConfig.tiles,
        tileSize: currentConfig.tileSize,
        attribution: currentConfig.attribution,
      });

      mapInstance.addLayer({
        id: 'osm',
        type: 'raster',
        source: 'osm',
      }, nextLayerId);
    }
  }, [mapTheme, mapLoaded]);

  // Track map idle state for loading progress indicator
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const handleMoveStart = () => setIsMapIdle(false);
    const handleIdle = () => setIsMapIdle(true);

    map.current.on('movestart', handleMoveStart);
    map.current.on('idle', handleIdle);

    return () => {
      map.current?.off('movestart', handleMoveStart);
      map.current?.off('idle', handleIdle);
    };
  }, [mapLoaded]);

  // Road tile refresh when roadTileVersion changes (triggered by SSE road edit events)
  // Note: Preview layer uses PMTiles (static files) for performance, so real-time refresh
  // only affects the API-loaded road data at zoom >= 14, not the preview layer.
  // To update preview layer, regenerate PMTiles with: npm run tiles:roads
  useEffect(() => {
    // PMTiles are static - no real-time refresh needed for preview layer
    // The zoom >= 14 API data already refreshes automatically via React Query
    // roadTileVersion is kept in the dependency array for future use if needed
  }, [roadTileVersion, mapLoaded]);

  // Update assets layer (API data for zoom >= 14, or any zoom when filters active)
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const source = map.current.getSource('assets') as maplibregl.GeoJSONSource;
    if (!source) return;

    // Clear assets when:
    // - showAssets is off, OR
    // - No mapBbox AND not in global filter mode, OR
    // - zoom < 14 AND no filters active (rely on PMTiles preview instead)
    const shouldClearAssets = !showAssets || (!mapBbox && !hasActiveAssetFilters) || (currentZoom < 14 && !hasActiveAssetFilters);

    if (shouldClearAssets) {
      // Only clear if there was data before
      if (lastAssetIdsHashRef.current !== '') {
        source.setData({ type: 'FeatureCollection', features: [] });
        lastAssetIdsHashRef.current = '';
      }
      map.current.setLayoutProperty('assets-line', 'visibility', 'none');
      map.current.setLayoutProperty('assets-label', 'visibility', 'none');
      map.current.setLayoutProperty('road-direction-arrows', 'visibility', 'none');
      return;
    }

    // Get assets data (empty array if no data or loading)
    const assets = assetsData?.data ?? [];

    // Compare asset IDs using hash string (faster than Set comparison)
    const newIdsHash = assets.map((a: RoadAsset) => a.id).sort().join(',');

    if (newIdsHash === lastAssetIdsHashRef.current) {
      // Data is identical, skip setData() to avoid flickering
      return;
    }

    // Update ref for next comparison
    lastAssetIdsHashRef.current = newIdsHash;

    const features = assets.map((asset: RoadAsset) => ({
      type: 'Feature' as const,
      geometry: asset.geometry,
      properties: {
        id: asset.id,
        name: asset.name,
        nameJa: asset.nameJa,
        ref: asset.ref,
        localRef: asset.localRef,
        displayName: asset.displayName,
        ward: asset.ward,
        sublocality: asset.sublocality,
        labelText: (() => {
          // Show road name if available
          if (!isRoadAssetUnnamed(asset)) {
            return getRoadAssetLabel(asset);
          }
          // For unnamed roads with sublocality, show enhanced format: "道路 · {sublocality} · #{shortId}"
          const displayText = getRoadAssetLabel(asset);
          const isGenericName = displayText === '道路' || displayText === 'Unnamed Road';
          if (isGenericName && (asset.sublocality || asset.ward)) {
            const locationLabel = asset.sublocality || asset.ward;
            const shortId = asset.id.replace(/^RA-/, '').replace(/^[A-Z]+-/, '');
            return `${displayText} · ${locationLabel} · #${shortId}`;
          }
          // Fallback: show simplified ID (e.g., "NISH-4032" instead of "RA-NISH-4032")
          if (asset.id) {
            const id = String(asset.id);
            // Remove "RA-" prefix if present
            return id.startsWith('RA-') ? id.substring(3) : id;
          }
          return '';
        })(),
        roadType: asset.roadType,
        color: ROAD_TYPE_COLORS[asset.roadType] || '#666',
        direction: asset.direction || 'two-way',
      },
    }));

    source.setData({ type: 'FeatureCollection', features });
    map.current.setLayoutProperty('assets-line', 'visibility', 'visible');
    map.current.setLayoutProperty('assets-label', 'visibility', 'visible');
    map.current.setLayoutProperty('road-direction-arrows', 'visibility', 'visible');
  }, [assetsData, showAssets, mapLoaded, mapBbox, currentZoom, hasActiveAssetFilters]);

  // Update rivers layer (API data for zoom >= 12)
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const source = map.current.getSource('rivers') as maplibregl.GeoJSONSource;
    if (!source) return;

    // Clear rivers when showRivers is off or no data
    if (!showRivers || currentZoom < 12) {
      source.setData({ type: 'FeatureCollection', features: [] });
      map.current.setLayoutProperty('rivers-fill', 'visibility', 'none');
      map.current.setLayoutProperty('rivers-line', 'visibility', 'none');
      map.current.setLayoutProperty('rivers-label', 'visibility', 'none');
      return;
    }

    // Get rivers features from API response (already in GeoJSON format)
    // Validate features array to prevent "Input data is not a valid GeoJSON object" errors
    const features = Array.isArray(riversData?.features) ? riversData.features : [];

    source.setData({ type: 'FeatureCollection', features });
    // Hide polygon rivers (water bodies) by default, only show line rivers
    map.current.setLayoutProperty('rivers-fill', 'visibility', 'none');
    map.current.setLayoutProperty('rivers-line', 'visibility', 'visible');
    map.current.setLayoutProperty('rivers-label', 'visibility', 'visible');
  }, [riversData, showRivers, mapLoaded, currentZoom]);

  // Update green spaces layer (API data for zoom >= 12)
  // Always load data to source for hover support, only toggle layer visibility
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const source = map.current.getSource('greenspaces') as maplibregl.GeoJSONSource;
    if (!source) return;

    // Load data if zoom is high enough (for hover support even when layer is hidden)
    // Validate features array to prevent "Input data is not a valid GeoJSON object" errors
    if (currentZoom >= 12) {
      const features = Array.isArray(greenSpacesData?.features) ? greenSpacesData.features : [];
      source.setData({ type: 'FeatureCollection', features });
    } else {
      source.setData({ type: 'FeatureCollection', features: [] });
    }

    // Toggle layer visibility based on showGreenSpaces setting
    const visibility = showGreenSpaces && currentZoom >= 12 ? 'visible' : 'none';
    map.current.setLayoutProperty('greenspaces-fill', 'visibility', visibility);
    map.current.setLayoutProperty('greenspaces-line', 'visibility', visibility);
    map.current.setLayoutProperty('greenspaces-label', 'visibility', visibility);
  }, [greenSpacesData, showGreenSpaces, mapLoaded, currentZoom]);

  // Update street lights layer (API data for zoom >= 14)
  // Always load data to source for hover support, only toggle layer visibility
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const source = map.current.getSource('streetlights') as maplibregl.GeoJSONSource;
    if (!source) return;

    // Load data if zoom is high enough (for hover support even when layer is hidden)
    // Validate features array to prevent "Input data is not a valid GeoJSON object" errors
    if (currentZoom >= 14) {
      const features = Array.isArray(streetLightsData?.features) ? streetLightsData.features : [];
      source.setData({ type: 'FeatureCollection', features });
    } else {
      source.setData({ type: 'FeatureCollection', features: [] });
    }

    // Toggle layer visibility based on showStreetLights setting
    const visibility = showStreetLights && currentZoom >= 14 ? 'visible' : 'none';
    map.current.setLayoutProperty('streetlights-circle', 'visibility', visibility);
  }, [streetLightsData, showStreetLights, mapLoaded, currentZoom]);

  // Highlight selected assets while editing an event
  // Uses separate source so it shows at all zoom levels
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const source = map.current.getSource('editing-assets') as maplibregl.GeoJSONSource;
    if (!source) return;

    // Determine which asset IDs to highlight
    // Event form mode: use selectedRoadAssetIdsForForm
    // Road update mode: use roadUpdateSelectedAssetIds
    let assetIds: string[] = [];
    if (isEventFormOpen && selectedRoadAssetIdsForForm.length > 0) {
      assetIds = selectedRoadAssetIdsForForm;
    } else if (isRoadUpdateModeActive && roadUpdateSelectedAssetIds.length > 0) {
      assetIds = roadUpdateSelectedAssetIds;
    }

    if (assetIds.length > 0) {
      // Build features from cache (includes geometry) and fallback to assetsData
      const features: GeoJSON.Feature[] = [];

      for (const assetId of assetIds) {
        // First check cache (which stores geometry when assets are selected)
        const cached = selectedAssetDetailsCache[assetId];
        if (cached?.geometry) {
          features.push({
            type: 'Feature',
            geometry: cached.geometry,
            properties: { id: assetId },
          });
        } else {
          // Fallback to assetsData (if asset is in current viewport)
          const asset = assetsData?.data?.find((a: RoadAsset) => a.id === assetId);
          if (asset?.geometry) {
            features.push({
              type: 'Feature',
              geometry: asset.geometry,
              properties: { id: assetId },
            });
          }
        }
      }

      source.setData({ type: 'FeatureCollection', features });
      map.current.setLayoutProperty('editing-assets-line', 'visibility', 'visible');
      if (map.current.getLayer('editing-assets-fill')) {
        map.current.setLayoutProperty('editing-assets-fill', 'visibility', 'visible');
      }
      if (map.current.getLayer('editing-assets-glow')) {
        map.current.setLayoutProperty('editing-assets-glow', 'visibility', 'visible');
      }
    } else {
      source.setData({ type: 'FeatureCollection', features: [] });
      map.current.setLayoutProperty('editing-assets-line', 'visibility', 'none');
      if (map.current.getLayer('editing-assets-fill')) {
        map.current.setLayoutProperty('editing-assets-fill', 'visibility', 'none');
      }
      if (map.current.getLayer('editing-assets-glow')) {
        map.current.setLayoutProperty('editing-assets-glow', 'visibility', 'none');
      }
    }
  }, [selectedRoadAssetIdsForForm, isEventFormOpen, isRoadUpdateModeActive, roadUpdateSelectedAssetIds, mapLoaded, selectedAssetDetailsCache, assetsData]);

  // Update roads preview layer visibility and opacity
  // PMTiles shows all road types at all zoom levels; hidden when filters are active
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const z = Math.floor(currentZoom);

    // Hide PMTiles preview when:
    // 1. showAssets is off, OR
    // 2. Any filters are active (PMTiles cannot be filtered, so hide it entirely)
    const shouldHidePreview = !showAssets || hasActiveAssetFilters;

    // Opacity: reduce when API data is visible (zoom >= 14) to avoid visual clutter
    const previewOpacity = z >= 14 && showAssets ? 0.5 : 0.6;

    try {
      const visibility = shouldHidePreview ? 'none' : 'visible';
      map.current.setLayoutProperty('roads-preview-line', 'visibility', visibility);
      map.current.setLayoutProperty('roads-preview-label', 'visibility', visibility);
      // Apply opacity (no filter - show all road types)
      map.current.setPaintProperty('roads-preview-line', 'line-opacity', previewOpacity);
    } catch {
      // Layers may not exist if PMTiles file is not available
    }
  }, [currentZoom, showAssets, mapLoaded, hasActiveAssetFilters]);

  // Update events layer
  useEffect(() => {
    if (!map.current || !mapLoaded || !eventsData?.data) return;

    const source = map.current.getSource('events') as maplibregl.GeoJSONSource;
    if (!source) return;

    // Merge selected event (from separate query) if not in main data (e.g., archived events)
    const selectedEvent = selectedEventResponse?.data;
    const allEvents = [...eventsData.data];
    if (selectedEvent && !allEvents.some(e => e.id === selectedEvent.id)) {
      allEvents.push(selectedEvent);
    }

    // Filter out:
    // 1. The event being edited (it's shown in editing-event layer instead)
    // 2. Cancelled events by default (unless explicitly filtered to show cancelled)
    // 3. Archived events (hidden on map, except when selected for preview)
    const eventsToShow = allEvents.filter((e: ConstructionEvent) => {
      // Exclude event being edited
      if (isEventFormOpen && editingEventId && e.id === editingEventId) return false;
      // Hide cancelled events unless explicitly filtering for them
      if (e.status === 'cancelled' && eventFilters.status !== 'cancelled') return false;
      // Hide archived events on the map, but show if currently selected or hovered (for preview)
      if (e.archivedAt && e.id !== selectedEventId && e.id !== hoveredEventId) return false;
      return true;
    });

    const features = eventsToShow.map((event: ConstructionEvent) => ({
      type: 'Feature' as const,
      geometry: event.geometry,
      properties: {
        id: event.id,
        name: event.name,
        status: event.status,
        restrictionType: event.restrictionType,
        color: STATUS_COLORS[event.status] || '#666',
        startDate: event.startDate,
        endDate: event.endDate,
        department: event.department,
        affectedAssetsCount: event.roadAssets?.length || 0,
      },
    }));

    source.setData({ type: 'FeatureCollection', features });

    // Hide all events while editing to allow clicking roads underneath
    const eventsVisible = showEvents && !isEventFormOpen;
    const statusLayers = [
      'events-ended-fill', 'events-ended-line',
      'events-planned-fill', 'events-planned-line',
      'events-active-fill', 'events-active-line',
      'events-hit-area-fill', 'events-hit-area-line',
      'hovered-event-fill', 'hovered-event-line',
    ];
    for (const layerId of statusLayers) {
      // Guard: check layer exists before setting property (layer might not be created yet on first render)
      if (map.current.getLayer(layerId)) {
        map.current.setLayoutProperty(layerId, 'visibility', eventsVisible ? 'visible' : 'none');
      }
    }
  }, [eventsData, showEvents, mapLoaded, isEventFormOpen, editingEventId, eventFilters.status, selectedEventId, selectedEventResponse, hoveredEventId]);

  // Reduce event polygon opacity in Road Update Mode so roads are visible underneath
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const fillLayers = [
      'events-ended-fill',
      'events-planned-fill',
      'events-active-fill',
      'selected-event-fill',
    ];

    const opacity = isRoadUpdateModeActive ? 0.08 : undefined; // Very low opacity in Road Update Mode

    for (const layerId of fillLayers) {
      if (map.current.getLayer(layerId)) {
        if (opacity !== undefined) {
          map.current.setPaintProperty(layerId, 'fill-opacity', opacity);
        } else {
          // Reset to original opacity based on layer
          const originalOpacity = layerId === 'selected-event-fill' ? 0.5 :
                                  layerId === 'events-active-fill' ? 0.2 :
                                  layerId === 'events-planned-fill' ? 0.15 : 0.1;
          map.current.setPaintProperty(layerId, 'fill-opacity', originalOpacity);
        }
      }
    }
  }, [isRoadUpdateModeActive, mapLoaded]);

  // Update inspections layer
  useEffect(() => {
    if (!map.current || !mapLoaded || !inspectionsData?.data) return;

    const source = map.current.getSource('inspections') as maplibregl.GeoJSONSource;
    if (!source) return;

    const features = inspectionsData.data.map((inspection: InspectionRecord) => ({
      type: 'Feature' as const,
      geometry: inspection.geometry,
      properties: {
        id: inspection.id,
        result: inspection.result,
      },
    }));

    source.setData({ type: 'FeatureCollection', features });
    map.current.setLayoutProperty('inspections-point', 'visibility', showInspections ? 'visible' : 'none');
  }, [inspectionsData, showInspections, mapLoaded]);

  // Highlight and fly to selected event
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const source = map.current.getSource('selected-event') as maplibregl.GeoJSONSource;
    if (!source) return;

    // Clear locked tooltip when event is deselected or changed
    if (!selectedEventId || lockedEventIdRef.current !== selectedEventId) {
      lockedEventIdRef.current = null;
      setLockedEvent(null);
      setLockedTooltipPosition(null);
    }

    // Also clear preview tooltip
    setPreviewEvent(null);
    setPreviewTooltipPosition(null);
    currentHoveredEventIdRef.current = null;

    // Clear road popup when event is selected
    if (selectedEventId && popup.current) {
      popup.current.remove();
    }

    if (selectedEventId) {
      // Look for event in main data or selected event response (for archived events)
      const event = eventsData?.data?.find((e: ConstructionEvent) => e.id === selectedEventId)
        || (selectedEventResponse?.data?.id === selectedEventId ? selectedEventResponse.data : null);
      if (event && event.geometry) {
        // Update highlight source (no auto-zoom - user clicks again to zoom)
        source.setData({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: event.geometry,
            properties: { id: event.id },
          }],
        });

        // Delayed zoom after page refresh: wait 1s before zooming to selected event
        // Only triggers once per selectedEventId (on initial page load from URL)
        if (initialZoomPendingRef.current !== selectedEventId) {
          initialZoomPendingRef.current = selectedEventId;
          userInteractedRef.current = false;

          // Clear any existing timer
          if (initialZoomTimerRef.current) {
            clearTimeout(initialZoomTimerRef.current);
          }

          // Zoom in after 0.5 second if user hasn't interacted
          initialZoomTimerRef.current = setTimeout(() => {
            if (!userInteractedRef.current && event.geometry) {
              setFlyToGeometry(event.geometry, false);
            }
            initialZoomTimerRef.current = null;
          }, 500);
        }
      }
    } else {
      source.setData({ type: 'FeatureCollection', features: [] });
      // Clear delayed zoom when event is deselected
      if (initialZoomTimerRef.current) {
        clearTimeout(initialZoomTimerRef.current);
        initialZoomTimerRef.current = null;
      }
    }
  }, [selectedEventId, eventsData, selectedEventResponse, mapLoaded, setFlyToGeometry]);

  // Show editing/duplicate event with transparent fill and fly to it
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const source = map.current.getSource('editing-event') as maplibregl.GeoJSONSource;
    if (!source) return;

    // Sync editingEventId to ref for use in event handlers
    editingEventIdRef.current = editingEventId ?? null;

    // Determine source event data: editing takes priority, then duplicate
    const sourceEventData = editingEventId
      ? (editingEventResponse?.data ?? eventsData?.data?.find((e: ConstructionEvent) => e.id === editingEventId))
      : (duplicateEventId ? duplicateEventResponse?.data : null);

    // Check if we're still waiting for the detail response
    const isWaitingForEditingResponse = editingEventId && !editingEventResponse?.data;
    const isWaitingForDuplicateResponse = duplicateEventId && !duplicateEventResponse?.data;

    console.log('[MapView] editing-event effect:', {
      editingEventId,
      duplicateEventId,
      hasSourceEventData: !!sourceEventData,
      geometrySource: sourceEventData?.geometrySource,
      isEventFormOpen,
      isWaitingForEditingResponse,
      drawnFeaturesLength: drawnFeatures?.length ?? 0,
    });

    // Clear tooltips if editing/duplicating event (sidebar shows details, no need for tooltip)
    const activeEventId = editingEventId || duplicateEventId;
    if (activeEventId) {
      if (lockedEventIdRef.current === activeEventId) {
        lockedEventIdRef.current = null;
        setLockedEvent(null);
        setLockedTooltipPosition(null);
      }
      if (previewEvent?.id === activeEventId) {
        setPreviewEvent(null);
        setPreviewTooltipPosition(null);
      }
    }

    // IMPORTANT: When editing, wait for editingEventResponse to load before making decisions
    // The list data (eventsData) may not include full geometry, so we need the detail response
    // to know if it's a manual geometry event that draw control should handle
    if (isEventFormOpen && (isWaitingForEditingResponse || isWaitingForDuplicateResponse)) {
      // Still waiting for detail response - don't clear anything, keep previous state
      console.log('[MapView] editing-event effect: waiting for response, keeping current overlay');
      return;
    }

    if (isEventFormOpen && sourceEventData?.geometry) {
      const isManualGeometry = sourceEventData.geometrySource === 'manual';
      const hasDrawnFeatures = drawnFeatures && drawnFeatures.length > 0;

      // For manual geometry events: hide overlay ONLY after loading delay has passed
      // This ensures draw control has time to fully render before we remove the overlay
      const shouldHideOverlay = isManualGeometry && hasDrawnFeatures && !isGeometryLoadingDelayed;

      if (shouldHideOverlay) {
        // Draw control is ready and has rendered - hide overlay to allow vertex editing
        source.setData({ type: 'FeatureCollection', features: [] });
        console.log('[MapView] editing-event effect: hiding overlay (draw ready)');
      } else {
        // Show overlay as visual feedback
        const statusColor = STATUS_COLORS[sourceEventData.status] || '#3B82F6';
        source.setData({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: sourceEventData.geometry,
            properties: { id: sourceEventData.id, color: statusColor },
          }],
        });
        console.log('[MapView] editing-event effect: showing overlay for', sourceEventData.id, 'isManualGeometry=', isManualGeometry, 'hasDrawnFeatures=', hasDrawnFeatures, 'isGeometryLoadingDelayed=', isGeometryLoadingDelayed);
      }
      // Note: FlyTo is handled in the restore action handler for better timing
    } else {
      source.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [isEventFormOpen, editingEventId, duplicateEventId, editingEventResponse, duplicateEventResponse, eventsData, mapLoaded, previewEvent?.id, drawnFeatures, isGeometryLoadingDelayed]);

  // Manage delayed geometry loading state for smooth overlay transitions
  // Also includes retry logic if draw control fails to load features
  useEffect(() => {
    // Clear any pending timer when dependencies change
    if (geometryLoadingTimerRef.current) {
      clearTimeout(geometryLoadingTimerRef.current);
      geometryLoadingTimerRef.current = null;
    }

    const sourceEvent = editingEventResponse?.data;
    const isWaitingForResponse = editingEventId && !sourceEvent;
    const isManualGeometry = sourceEvent?.geometrySource === 'manual';
    const hasDrawnFeatures = drawnFeatures && drawnFeatures.length > 0;

    if (isEventFormOpen && editingEventId) {
      if (isWaitingForResponse) {
        // Still waiting for API response - show loading
        setIsGeometryLoadingDelayed(true);
      } else if (isManualGeometry) {
        if (hasDrawnFeatures) {
          // Features are loaded - hide loading overlay immediately
          // Force a map repaint to ensure draw control is rendered
          if (map.current) {
            map.current.triggerRepaint();
          }
          setIsGeometryLoadingDelayed(false);
        } else {
          // Still waiting for draw control to load features - show loading
          setIsGeometryLoadingDelayed(true);

          // Polling retry logic: check every 300ms up to 5 times for features
          let retryCount = 0;
          const maxRetries = 5;

          const pollForFeatures = () => {
            retryCount++;
            // Check CURRENT features from draw control (not stale closure value)
            const currentFeatures = getAllFeatures();

            if (currentFeatures && currentFeatures.length > 0) {
              // Draw control has features - sync to store if needed and finish loading
              console.log('[MapView] Poll: found', currentFeatures.length, 'features in draw control, syncing store');
              setDrawnFeatures(currentFeatures);
              // Trigger repaint to ensure visibility
              if (map.current) {
                map.current.triggerRepaint();
              }
              // Don't set another timer - the effect will re-run when drawnFeatures updates
              return;
            }

            if (retryCount >= maxRetries) {
              // Max retries reached, force restore
              // Use refs to get latest values (avoids stale closure)
              const currentIsDrawReady = isDrawReadyRef.current;
              const currentRestoreFeatures = restoreFeaturesRef.current;
              console.log('[MapView] Poll: max retries reached, forcing restore, isDrawReady=', currentIsDrawReady);

              if (sourceEvent?.geometry && currentIsDrawReady && currentRestoreFeatures) {
                const geometry = sourceEvent.geometry;
                const featuresToRestore: Feature[] = [];

                // Handle both single geometry and multi-geometry (GeometryCollection, MultiPolygon, etc.)
                if (geometry.type === 'GeometryCollection') {
                  for (const geom of (geometry as GeoJSON.GeometryCollection).geometries) {
                    featuresToRestore.push({
                      type: 'Feature',
                      geometry: geom,
                      properties: {},
                    } as Feature);
                  }
                } else if (geometry.type === 'MultiPolygon') {
                  for (const coords of (geometry as GeoJSON.MultiPolygon).coordinates) {
                    featuresToRestore.push({
                      type: 'Feature',
                      geometry: { type: 'Polygon', coordinates: coords },
                      properties: {},
                    } as Feature);
                  }
                } else if (geometry.type === 'MultiLineString') {
                  for (const coords of (geometry as GeoJSON.MultiLineString).coordinates) {
                    featuresToRestore.push({
                      type: 'Feature',
                      geometry: { type: 'LineString', coordinates: coords },
                      properties: {},
                    } as Feature);
                  }
                } else {
                  featuresToRestore.push({
                    type: 'Feature',
                    geometry: geometry,
                    properties: {},
                  } as Feature);
                }

                // Call restoreFeatures to reload the geometry into draw control
                currentRestoreFeatures(featuresToRestore);

                // Also trigger a repaint
                if (map.current) {
                  map.current.triggerRepaint();
                }
              } else if (!currentIsDrawReady) {
                // Draw control not ready yet - schedule another check
                console.log('[MapView] Poll: draw control not ready, scheduling retry');
                geometryLoadingTimerRef.current = setTimeout(pollForFeatures, 300);
                return;
              }
              return;
            }

            // Schedule next poll
            console.log('[MapView] Poll: retry', retryCount, '/', maxRetries, 'features not found yet');
            geometryLoadingTimerRef.current = setTimeout(pollForFeatures, 300);
          };

          // Start polling after a short delay
          geometryLoadingTimerRef.current = setTimeout(pollForFeatures, 300);
        }
      } else {
        // Not a manual geometry event (auto geometry) - no loading needed
        setIsGeometryLoadingDelayed(false);
      }
    } else {
      // Not editing - no loading needed
      setIsGeometryLoadingDelayed(false);
    }

    return () => {
      if (geometryLoadingTimerRef.current) {
        clearTimeout(geometryLoadingTimerRef.current);
        geometryLoadingTimerRef.current = null;
      }
    };
  }, [isEventFormOpen, editingEventId, editingEventResponse, drawnFeatures, isDrawReady, restoreFeatures, getAllFeatures, setDrawnFeatures]);

  // Animated breathing glow effect for selected road assets during editing
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Start animation when editing and has selected roads
    if (isEventFormOpen && selectedRoadAssetIdsForForm.length > 0) {
      let time = 0;

      const animate = () => {
        if (!map.current || !map.current.getLayer('editing-assets-glow')) {
          return;
        }

        // Breathing/flashing glow effect - more noticeable
        time += 0.06; // Faster for flashing effect
        const pulse = 0.5 + 0.5 * Math.sin(time);
        const glowOpacity = 0.15 + 0.5 * pulse;  // 0.15 to 0.65
        const glowWidth = 12 + 16 * pulse;       // 12 to 28

        try {
          map.current.setPaintProperty('editing-assets-glow', 'line-opacity', glowOpacity);
          map.current.setPaintProperty('editing-assets-glow', 'line-width', glowWidth);
        } catch {
          // Layer might not exist
        }

        animationFrameRef.current = requestAnimationFrame(animate);
      };

      animationFrameRef.current = requestAnimationFrame(animate);
    }

    // Cleanup animation when not editing
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isEventFormOpen, selectedRoadAssetIdsForForm.length, mapLoaded]);

  // Highlight and fly to selected asset
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const source = map.current.getSource('selected-asset') as maplibregl.GeoJSONSource;
    if (!source) return;

    if (selectedAssetId) {
      // Try to find asset in viewport data, otherwise use geometry from store
      const asset = assetsData?.data?.find((a: RoadAsset) => a.id === selectedAssetId);
      const geometry = asset?.geometry || selectedAssetGeometry;

      if (geometry) {
        // Update highlight source
        source.setData({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: geometry,
            properties: { id: selectedAssetId },
          }],
        });

        // Only fly to feature when:
        // 1. Selecting a NEW asset (not when assetsData changes)
        // 2. Selection came from sidebar (selectedAssetGeometry is provided)
        //    - When clicking on map, the road is already visible, no need to zoom
        if (lastFlownAssetIdRef.current !== selectedAssetId && selectedAssetGeometry) {
          lastFlownAssetIdRef.current = selectedAssetId;
          try {
            const assetBbox = turf.bbox(geometry);
            const currentBounds = map.current.getBounds();
            const currentZoom = map.current.getZoom();

            // Check if asset is already visible in current viewport (only skip when zoomed in enough)
            const isInView = currentZoom > 17 &&
              assetBbox[0] >= currentBounds.getWest() &&
              assetBbox[1] >= currentBounds.getSouth() &&
              assetBbox[2] <= currentBounds.getEast() &&
              assetBbox[3] <= currentBounds.getNorth();

            if (!isInView) {
              // Calculate road length to determine appropriate zoom
              const feature = turf.feature(geometry);
              const length = turf.length(feature, { units: 'meters' });

              // Smaller roads need higher zoom (closer view)
              // length < 50m -> zoom 18, length < 150m -> zoom 17, length < 400m -> zoom 16, else 15
              let minZoom = 15;
              if (length < 50) minZoom = 18;
              else if (length < 150) minZoom = 17;
              else if (length < 400) minZoom = 16;

              map.current.fitBounds(
                [[assetBbox[0], assetBbox[1]], [assetBbox[2], assetBbox[3]]],
                { padding: 100, maxZoom: 18, minZoom, duration: 1000 }
              );
            }
          } catch (e) {
            console.warn('Could not calculate bounds for asset geometry');
          }
        }
      }
    } else {
      source.setData({ type: 'FeatureCollection', features: [] });
      lastFlownAssetIdRef.current = null; // Reset when asset is deselected
    }
  }, [selectedAssetId, selectedAssetGeometry, assetsData, mapLoaded]);

  // Breathing animation for selected asset glow
  const selectedAssetAnimRef = useRef<number | null>(null);
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Start animation when asset is selected
    if (selectedAssetId) {
      const animate = () => {
        if (!map.current || !map.current.getLayer('selected-asset-glow')) {
          return;
        }

        // Selection highlight disabled
        const glowOpacity = 0;
        const glowWidth = 0;

        try {
          map.current.setPaintProperty('selected-asset-glow', 'line-opacity', glowOpacity);
          map.current.setPaintProperty('selected-asset-glow', 'line-width', glowWidth);
        } catch {
          // Layer might not exist
        }

        selectedAssetAnimRef.current = requestAnimationFrame(animate);
      };

      selectedAssetAnimRef.current = requestAnimationFrame(animate);
    }

    // Cleanup animation
    return () => {
      if (selectedAssetAnimRef.current) {
        cancelAnimationFrame(selectedAssetAnimRef.current);
        selectedAssetAnimRef.current = null;
      }
    };
  }, [selectedAssetId, mapLoaded]);

  // Update preview geometry layer (for EventForm corridor preview)
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const source = map.current.getSource('preview-geometry') as maplibregl.GeoJSONSource;
    if (!source) return;

    if (previewGeometry && isEventFormOpen) {
      source.setData({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: previewGeometry,
          properties: {},
        }],
      });
      // NO fitBounds here - zoom only via flyToGeometry to prevent zoom on every vertex edit
    } else {
      source.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [previewGeometry, isEventFormOpen, mapLoaded]);

  // Auto-zoom to drawn features when shouldZoomToDrawing is set (after draw completes)
  useEffect(() => {
    if (!shouldZoomToDrawing || !drawnFeatures || drawnFeatures.length === 0) return;

    // Combine features into a single geometry for flyTo
    let combinedGeometry: Geometry | null = null;
    if (drawnFeatures.length === 1) {
      combinedGeometry = drawnFeatures[0].geometry as Geometry;
    } else {
      // Create a feature collection to calculate bounds for all features
      const firstType = drawnFeatures[0].geometry?.type;
      if (firstType === 'Polygon') {
        combinedGeometry = {
          type: 'MultiPolygon',
          coordinates: drawnFeatures.map(f => (f.geometry as GeoJSON.Polygon).coordinates),
        };
      } else if (firstType === 'LineString') {
        combinedGeometry = {
          type: 'MultiLineString',
          coordinates: drawnFeatures.map(f => (f.geometry as GeoJSON.LineString).coordinates),
        };
      }
    }

    if (combinedGeometry) {
      setFlyToGeometry(combinedGeometry, true); // closeUp: true to zoom in on the drawn feature
    }
    setShouldZoomToDrawing(false);
  }, [shouldZoomToDrawing, drawnFeatures, setFlyToGeometry, setShouldZoomToDrawing]);

  // Update hover highlight layer filter when hoveredAssetId changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    if (!map.current.getLayer('hovered-asset-line')) return;

    // Show hover highlight only if not already selected
    const filter: maplibregl.FilterSpecification = hoveredAssetId && hoveredAssetId !== selectedAssetId
      ? ['==', ['get', 'id'], hoveredAssetId]
      : ['==', ['get', 'id'], '']; // Match nothing

    map.current.setFilter('hovered-asset-line', filter);
    if (map.current.getLayer('hovered-asset-glow')) {
      map.current.setFilter('hovered-asset-glow', filter);
    }
  }, [hoveredAssetId, selectedAssetId, mapLoaded]);

  // Update hover highlight layer filter when hoveredEventId changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    if (!map.current.getLayer('hovered-event-line')) return;

    // Show hover highlight only if:
    // - hoveredEventId is set
    // - Not already selected (avoid duplicate highlight)
    // - Event form is closed (events layer is visible)
    const shouldHighlight = hoveredEventId &&
      hoveredEventId !== selectedEventId &&
      !isEventFormOpen;

    const filter: maplibregl.FilterSpecification = shouldHighlight
      ? ['==', ['get', 'id'], hoveredEventId]
      : ['==', ['get', 'id'], '']; // Match nothing

    map.current.setFilter('hovered-event-line', filter);
    if (map.current.getLayer('hovered-event-fill')) {
      map.current.setFilter('hovered-event-fill', filter);
    }
  }, [hoveredEventId, selectedEventId, isEventFormOpen, mapLoaded]);

  // Update hover highlight layer filter when hoveredGreenspaceId changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    if (!map.current.getLayer('hovered-greenspace-fill')) return;

    const filter: maplibregl.FilterSpecification = hoveredGreenspaceId
      ? ['==', ['get', 'id'], hoveredGreenspaceId]
      : ['==', ['get', 'id'], '']; // Match nothing

    map.current.setFilter('hovered-greenspace-fill', filter);
    if (map.current.getLayer('hovered-greenspace-line')) {
      map.current.setFilter('hovered-greenspace-line', filter);
    }
  }, [hoveredGreenspaceId, mapLoaded]);

  // Update hover highlight layer filter when hoveredStreetlightId changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    if (!map.current.getLayer('hovered-streetlight-circle')) return;

    const filter: maplibregl.FilterSpecification = hoveredStreetlightId
      ? ['==', ['get', 'id'], hoveredStreetlightId]
      : ['==', ['get', 'id'], '']; // Match nothing

    map.current.setFilter('hovered-streetlight-circle', filter);
  }, [hoveredStreetlightId, mapLoaded]);

  // Fly to geometry when triggered (e.g., clicking road badge in selector or event in list)
  useEffect(() => {
    console.log('[MapView] flyTo effect triggered:', {
      mapLoaded,
      hasMapRef: !!map.current,
      geometryType: flyToGeometry?.type || 'null',
      flyToCloseUp
    });
    if (!map.current || !mapLoaded || !flyToGeometry) {
      if (flyToGeometry) {
        console.warn('[MapView] flyTo skipped: map not ready', { mapLoaded, hasMapRef: !!map.current });
      }
      return;
    }

    console.log('[MapView] Flying to geometry:', flyToGeometry.type, 'closeUp:', flyToCloseUp);

    try {
      const bbox = turf.bbox(flyToGeometry);

      // Account for right panel (420px + 16px padding) when event form is open
      // Reduced from 450 to 250 for better centering
      const rightPadding = isEventFormOpen ? 250 : 100;

      // Use fitBounds with padding for both cases - this properly accounts for the right panel
      // The right padding shifts the visible center to the left, placing geometry in the visible area
      const padding = { top: 100, bottom: 100, left: 100, right: rightPadding };

      if (flyToCloseUp) {
        // Close-up view: use higher minZoom for closer view
        // Calculate zoom based on feature size
        const feature = turf.feature(flyToGeometry);
        const length = turf.length(feature, { units: 'meters' });

        let minZoom = 17;
        if (length < 50) minZoom = 18.5;
        else if (length < 150) minZoom = 18;
        else if (length < 500) minZoom = 17.5;
        else if (length < 1000) minZoom = 17;
        else if (length < 2000) minZoom = 16.5;
        else minZoom = 16;

        map.current.fitBounds(
          [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
          { padding, minZoom, maxZoom: 18.5, duration: 1000 }
        );
      } else {
        // Overview: wider view (maxZoom 15.5 for good initial view)
        map.current.fitBounds(
          [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
          { padding, maxZoom: 15.5, duration: 1000 }
        );
      }

      // Track current zoom state for toggle behavior
      isMapCloseUpRef.current = flyToCloseUp;

      // Clear the flyToGeometry after animation starts
      setTimeout(() => {
        setFlyToGeometry(null);
      }, 100);
    } catch (e) {
      console.error('[MapView] flyTo error:', e, 'geometry:', flyToGeometry);
      setFlyToGeometry(null);
    }
  }, [flyToGeometry, flyToCloseUp, mapLoaded, setFlyToGeometry, isEventFormOpen]);

  // Search marker layer - show temporary marker at search center (coordinate search)
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const sourceId = 'search-marker';
    const layerId = 'search-marker-layer';
    const pulseLayerId = 'search-marker-pulse';

    // If no search center, remove existing layers
    if (!searchCenter) {
      if (map.current.getLayer(pulseLayerId)) {
        map.current.removeLayer(pulseLayerId);
      }
      if (map.current.getLayer(layerId)) {
        map.current.removeLayer(layerId);
      }
      if (map.current.getSource(sourceId)) {
        map.current.removeSource(sourceId);
      }
      return;
    }

    const geojsonData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: searchCenter,
        },
        properties: {},
      }],
    };

    // Create or update source
    const existingSource = map.current.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
    if (existingSource) {
      existingSource.setData(geojsonData);
    } else {
      map.current.addSource(sourceId, {
        type: 'geojson',
        data: geojsonData,
      });

      // Pulse effect layer (larger, semi-transparent)
      map.current.addLayer({
        id: pulseLayerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 20,
          'circle-color': '#ff6b6b',
          'circle-opacity': 0.3,
          'circle-stroke-width': 0,
        },
      });

      // Main marker layer
      map.current.addLayer({
        id: layerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 10,
          'circle-color': '#ff6b6b',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#ffffff',
        },
      });
    }

    // Auto-clear search marker after 10 seconds
    const timeout = setTimeout(() => {
      clearSearch();
    }, 10000);

    return () => clearTimeout(timeout);
  }, [searchCenter, mapLoaded, clearSearch]);

  // Import area highlight layer - show bbox outline when viewing import area
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const sourceId = 'import-area-highlight';
    const fillLayerId = 'import-area-fill';
    const lineLayerId = 'import-area-line';
    const labelLayerId = 'import-area-label';

    // If no highlight, remove existing layers
    if (!importAreaHighlight) {
      if (map.current.getLayer(labelLayerId)) {
        map.current.removeLayer(labelLayerId);
      }
      if (map.current.getLayer(lineLayerId)) {
        map.current.removeLayer(lineLayerId);
      }
      if (map.current.getLayer(fillLayerId)) {
        map.current.removeLayer(fillLayerId);
      }
      if (map.current.getSource(sourceId + '-label')) {
        map.current.removeSource(sourceId + '-label');
      }
      if (map.current.getSource(sourceId)) {
        map.current.removeSource(sourceId);
      }
      return;
    }

    const geojsonData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: importAreaHighlight.geometry,
        properties: {
          label: importAreaHighlight.label || 'Import Area',
        },
      }],
    };

    // Calculate center for label (geometry is always a Polygon from bbox)
    const geom = importAreaHighlight.geometry as GeoJSON.Polygon;
    const coords = geom.coordinates[0];
    const centerLng = (coords[0][0] + coords[2][0]) / 2;
    const centerLat = (coords[0][1] + coords[2][1]) / 2;

    const labelData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [centerLng, centerLat],
        },
        properties: {
          label: importAreaHighlight.label || 'Import Area',
        },
      }],
    };

    // Create or update source
    const existingSource = map.current.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
    const existingLabelSource = map.current.getSource(sourceId + '-label') as maplibregl.GeoJSONSource | undefined;

    if (existingSource) {
      existingSource.setData(geojsonData);
      existingLabelSource?.setData(labelData);
    } else {
      map.current.addSource(sourceId, {
        type: 'geojson',
        data: geojsonData,
      });

      map.current.addSource(sourceId + '-label', {
        type: 'geojson',
        data: labelData,
      });

      // Semi-transparent fill
      map.current.addLayer({
        id: fillLayerId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': '#3B82F6',
          'fill-opacity': 0.1,
        },
      });

      // Dashed border outline
      map.current.addLayer({
        id: lineLayerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': '#3B82F6',
          'line-width': 3,
          'line-dasharray': [3, 2],
        },
      });

      // Label at center
      map.current.addLayer({
        id: labelLayerId,
        type: 'symbol',
        source: sourceId + '-label',
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 14,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-anchor': 'center',
        },
        paint: {
          'text-color': '#3B82F6',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2,
        },
      });
    }

    // Auto-clear highlight after 15 seconds
    const timeout = setTimeout(() => {
      setImportAreaHighlight(null);
    }, 15000);

    return () => clearTimeout(timeout);
  }, [importAreaHighlight, mapLoaded, setImportAreaHighlight]);

  // Sync bbox to uiStore when mapBbox changes
  useEffect(() => {
    setMapBboxStore(mapBbox);
  }, [mapBbox, setMapBboxStore]);

  return (
    <Box style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {/* Loading overlay */}
      {!mapLoaded && (
        <Box
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'var(--mantine-color-gray-1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
        >
          <Stack align="center" gap="sm">
            <Loader size="lg" />
            <Text size="sm" c="dimmed">Loading map...</Text>
          </Stack>
        </Box>
      )}

      {/* Assets loading progress bar */}
      {mapLoaded && showAssets && (isAssetsFetching || isAssetsLoading || !isMapIdle) && (
        <Box
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 20,
            height: 6,
          }}
        >
          <Progress
            value={100}
            animated
            striped
            color="cyan"
            size="sm"
            style={{ height: '100%', borderRadius: 0 }}
          />
        </Box>
      )}

      {/* Geometry loading overlay - shown when editing manual geometry event and draw control hasn't loaded yet */}
      {(() => {
        // Check if we're editing and waiting for data or draw control to load
        const isWaitingForResponse = editingEventId && !editingEventResponse?.data;

        // Show loading when:
        // 1. We're editing and waiting for response (don't know geometry type yet)
        // 2. We're editing a manual geometry event and draw control hasn't fully rendered yet (with delay)
        const isLoadingGeometry = isEventFormOpen && editingEventId && (
          isWaitingForResponse || isGeometryLoadingDelayed
        );

        return isLoadingGeometry ? (
          <Box
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: isEventFormOpen ? 450 : 0, // Account for right sidebar
              bottom: 0,
              backgroundColor: 'rgba(255, 255, 255, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 15,
              pointerEvents: 'none',
            }}
          >
            <Paper shadow="sm" p="md" radius="md">
              <Stack align="center" gap="xs">
                <Loader size="sm" color="cyan" />
                <Text size="sm" c="dimmed">Loading geometry...</Text>
              </Stack>
            </Paper>
          </Box>
        ) : null;
      })()}

      {/* Road assets zoom/type indicator (hidden on Events tab) */}
      {showAssets && mapLoaded && currentView !== 'events' && (
        <Paper
          shadow="sm"
          p="xs"
          style={{
            position: 'absolute',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1,
            pointerEvents: 'none',
          }}
        >
          <Text size="sm" c="dimmed">
            {Math.floor(currentZoom) < 14
              ? 'Preview (not selectable)'
              : 'All road types (selectable)'}
          </Text>
        </Paper>
      )}

      {/* Drawing mode toolbar */}
      {isDrawingEnabled && mapLoaded && (
        <Paper
          shadow="sm"
          p="xs"
          style={{
            position: 'absolute',
            top: 60,
            right: 10,
            zIndex: 2,
            pointerEvents: 'auto',
            backgroundColor: '#0e7490', // cyan-700
          }}
        >
          <Group gap="sm">
            <Group gap={4}>
              <Text size="sm" c="white" fw={500}>
                Drawing:
              </Text>
              <Badge
                color={drawMode === 'polygon' ? 'cyan' : drawMode === 'line' ? 'teal' : 'gray'}
                variant="filled"
                size="sm"
              >
                {drawMode === 'polygon' ? 'Polygon' : drawMode === 'line' ? 'Line' : 'Select'}
              </Badge>
            </Group>
            {drawnFeatures && drawnFeatures.length > 0 && (
              <Button
                size="xs"
                variant="subtle"
                color="red"
                leftSection={<IconTrash size={14} />}
                onClick={() => {
                  deleteDrawing();
                  setDrawMode(null);
                  setCurrentDrawType(null);
                }}
                style={{ color: 'white' }}
              >
                Clear All ({drawnFeatures.length})
              </Button>
            )}
          </Group>
        </Paper>
      )}

      {/* Layer controls */}
      <Paper
        shadow="sm"
        p="sm"
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 1,
          minWidth: 180,
        }}
      >
        <Text size="sm" fw={600} mb="xs">Layers</Text>
        <Stack gap="xs">
          <Switch
            label="Events"
            checked={showEvents}
            onChange={toggleEvents}
            size="sm"
          />
          <Switch
            label="Road Assets"
            checked={showAssets}
            onChange={toggleAssets}
            size="sm"
          />
          <Switch
            label="Inspections"
            checked={showInspections}
            onChange={toggleInspections}
            size="sm"
          />
          <Switch
            label="Rivers"
            checked={showRivers}
            onChange={toggleRivers}
            size="sm"
          />
          <Switch
            label="Green Spaces"
            checked={showGreenSpaces}
            onChange={toggleGreenSpaces}
            size="sm"
          />
          <Switch
            label="Street Lights"
            checked={showStreetLights}
            onChange={toggleStreetLights}
            size="sm"
          />
        </Stack>
      </Paper>

      {/* Legend */}
      <Paper
        shadow="sm"
        p="sm"
        style={{
          position: 'absolute',
          bottom: 40,
          left: 10,
          zIndex: 1,
          minWidth: 160,
        }}
      >
        <Text size="sm" fw={600} mb="xs">Event Status</Text>
        <Stack gap={4}>
          <Group gap="xs">
            <Box style={{ width: 12, height: 12, backgroundColor: STATUS_COLORS.planned, borderRadius: 2 }} />
            <Text size="xs">Planned</Text>
          </Group>
          <Group gap="xs">
            <Box style={{ width: 12, height: 12, backgroundColor: STATUS_COLORS.active, borderRadius: 2 }} />
            <Text size="xs">Active</Text>
          </Group>
          <Group gap="xs">
            <Box style={{ width: 12, height: 12, backgroundColor: STATUS_COLORS.ended, borderRadius: 2 }} />
            <Text size="xs">Ended</Text>
          </Group>
        </Stack>

        <Text size="sm" fw={600} mt="sm" mb="xs">Road Types</Text>
        <Stack gap={4}>
          <Group gap="xs">
            <Box style={{ width: 12, height: 3, backgroundColor: ROAD_TYPE_COLORS.arterial }} />
            <Text size="xs">Arterial</Text>
          </Group>
          <Group gap="xs">
            <Box style={{ width: 12, height: 3, backgroundColor: ROAD_TYPE_COLORS.collector }} />
            <Text size="xs">Collector</Text>
          </Group>
          <Group gap="xs">
            <Box style={{ width: 12, height: 3, backgroundColor: ROAD_TYPE_COLORS.local }} />
            <Text size="xs">Local</Text>
          </Group>
        </Stack>

        {showRivers && (
          <>
            <Text size="sm" fw={600} mt="sm" mb="xs">Rivers</Text>
            <Stack gap={4}>
              <Group gap="xs">
                <Box style={{ width: 12, height: 3, backgroundColor: '#3B82F6' }} />
                <Text size="xs">River/Stream</Text>
              </Group>
            </Stack>
          </>
        )}

        {showGreenSpaces && (
          <>
            <Text size="sm" fw={600} mt="sm" mb="xs">Green Spaces</Text>
            <Stack gap={4}>
              <Group gap="xs">
                <Box style={{ width: 12, height: 12, backgroundColor: '#22C55E', opacity: 0.5, borderRadius: 2 }} />
                <Text size="xs">Park/Garden</Text>
              </Group>
            </Stack>
          </>
        )}

        {showStreetLights && (
          <>
            <Text size="sm" fw={600} mt="sm" mb="xs">Street Lights</Text>
            <Stack gap={4}>
              <Group gap="xs">
                <Box style={{ width: 10, height: 10, backgroundColor: '#FBBF24', borderRadius: '50%' }} />
                <Text size="xs">Operational</Text>
              </Group>
              <Group gap="xs">
                <Box style={{ width: 10, height: 10, backgroundColor: '#F97316', borderRadius: '50%' }} />
                <Text size="xs">Maintenance</Text>
              </Group>
              <Group gap="xs">
                <Box style={{ width: 10, height: 10, backgroundColor: '#EF4444', borderRadius: '50%' }} />
                <Text size="xs">Damaged</Text>
              </Group>
            </Stack>
          </>
        )}

        {isEventFormOpen && (
          <>
            <Text size="sm" fw={600} mt="sm" mb="xs">Editing</Text>
            <Stack gap={4}>
              {editingEventId && (
                <Group gap="xs">
                  <Box style={{ width: 12, height: 12, backgroundColor: '#ffffff', opacity: 0.7, borderRadius: 2, border: '2px solid #3B82F6' }} />
                  <Text size="xs">Event Area</Text>
                </Group>
              )}
              {selectedRoadAssetIdsForForm.length > 0 && (
                <Group gap="xs">
                  <Box style={{ width: 12, height: 3, backgroundColor: '#2563eb', boxShadow: '0 0 4px #2563eb' }} />
                  <Text size="xs">Selected Roads (pulsing)</Text>
                </Group>
              )}
              {previewGeometry && (
                <Group gap="xs">
                  <Box style={{ width: 12, height: 12, backgroundColor: '#06B6D4', opacity: 0.5, borderRadius: 2, border: '1px dashed #06B6D4' }} />
                  <Text size="xs">Corridor (15m buffer)</Text>
                </Group>
              )}
            </Stack>
          </>
        )}
      </Paper>

      {/* Locked tooltip for selected event - stays visible */}
      {lockedEvent && lockedTooltipPosition && (
        <EventMapTooltip
          event={lockedEvent}
          position={lockedTooltipPosition}
          onMouseEnter={() => {
            isLockedTooltipHoveredRef.current = true;
          }}
          onMouseLeave={() => {
            isLockedTooltipHoveredRef.current = false;
          }}
        />
      )}

      {/* Preview tooltip for hovering other events */}
      {previewEvent && previewTooltipPosition && (
        <EventMapTooltip
          event={previewEvent}
          position={previewTooltipPosition}
          onMouseEnter={() => {
            isPreviewTooltipHoveredRef.current = true;
          }}
          onMouseLeave={() => {
            isPreviewTooltipHoveredRef.current = false;
            // Hide preview tooltip when mouse leaves
            setPreviewEvent(null);
            setPreviewTooltipPosition(null);
          }}
        />
      )}

    </Box>
  );
}

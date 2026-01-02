import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import * as turf from '@turf/turf';
import { Protocol } from 'pmtiles';
import { Box, Paper, Stack, Switch, Text, Group } from '@mantine/core';
import { useEvents, useAssets, useInspections } from '../hooks/useApi';
import { useMapStore, type MapTheme } from '../stores/mapStore';
import { useUIStore } from '../stores/uiStore';
import { getRoadAssetLabel, isRoadAssetUnnamed, type RoadAssetLabelFields } from '../utils/roadAssetLabel';
import type { ConstructionEvent, RoadAsset, InspectionRecord } from '@nagoya/shared';
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

export function MapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

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
    showOsmLabels,
    toggleEvents,
    toggleAssets,
    toggleInspections,
    toggleOsmLabels,
  } = useMapStore();
  const {
    selectedEventId,
    selectedAssetId,
    selectedAssetGeometry,
    selectEvent,
    selectAsset,
    setCurrentView,
    previewGeometry,
    isEventFormOpen,
    editingEventId,
    openEventDetailModal,
    closeEventDetailModal,
    hoveredAssetId,
    selectedRoadAssetIdsForForm,
    setMapBbox: setMapBboxStore,
    flyToGeometry,
    setFlyToGeometry,
  } = useUIStore();
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

  const { data: eventsData } = useEvents();
  // Viewport-based asset loading for interaction (zoom >= 14)
  // PMTiles covers all zoom levels for preview; API enables selection
  const { data: assetsData } = useAssets(
    { bbox: mapBbox ?? undefined, limit: 1000, includeTotal: false },
    { enabled: !!mapBbox && currentZoom >= 14 && showAssets }
  );
  const { data: inspectionsData } = useInspections();

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const theme = useMapStore.getState().mapTheme; // Get initial theme

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        // Glyphs URL for text labels
        glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
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

      // Road assets source and layers
      map.current.addSource('assets', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.current.addLayer({
        id: 'assets-line',
        type: 'line',
        source: 'assets',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 4,
          'line-opacity': 0.8,
        },
      });

      // Editing selection glow (outer glow for breathing effect)
      map.current.addLayer({
        id: 'editing-assets-glow',
        type: 'line',
        source: 'assets',
        filter: ['in', ['get', 'id'], ['literal', []]], // Initial: match nothing
        paint: {
          'line-color': '#2563eb',
          'line-width': 24, // Wider glow
          'line-blur': 8,   // More blur
          'line-opacity': 0.6, // Will be animated
        },
      });

      // Editing selection highlight (for event editor map picking)
      map.current.addLayer({
        id: 'editing-assets-line',
        type: 'line',
        source: 'assets',
        filter: ['in', ['get', 'id'], ['literal', []]], // Initial: match nothing
        paint: {
          'line-color': '#2563eb',
          'line-width': 6,
          'line-opacity': 1,
        },
      });

      // Invisible hit area layer for easier clicking (wider than visible line)
      // Note: opacity must be > 0 for MapLibre to render and make it clickable
      map.current.addLayer({
        id: 'assets-hit-area',
        type: 'line',
        source: 'assets',
        paint: {
          'line-color': '#000000',
          'line-width': 20,
          'line-opacity': 0.001,
        },
      });

      // Assets label layer (high zoom: 15+, where API data is available)
      map.current.addLayer({
        id: 'assets-label',
        type: 'symbol',
        source: 'assets',
        minzoom: 15,
        layout: {
          'text-field': [
            'get',
            'labelText',
          ],
          'text-font': ['Open Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 15, 11, 18, 14],
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

      // Roads preview source (PMTiles for low-zoom overview)
      map.current.addSource('roads-preview', {
        type: 'vector',
        url: 'pmtiles:///tiles/roads.pmtiles',
      });

      // Roads preview layer (PMTiles for all zoom levels, filtered by road type)
      map.current.addLayer({
        id: 'roads-preview-line',
        type: 'line',
        source: 'roads-preview',
        'source-layer': 'roads',
        paint: {
          'line-color': [
            'match', ['get', 'roadType'],
            'arterial', '#8B5CF6',
            'collector', '#06B6D4',
            'local', '#84CC16',
            '#666'
          ],
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 12, 2, 16, 4],
          'line-opacity': 0.6,
        },
      }, 'assets-line'); // Insert below assets-line

      // Roads preview label layer (PMTiles, zoom 14-15, before API data kicks in)
      map.current.addLayer({
        id: 'roads-preview-label',
        type: 'symbol',
        source: 'roads-preview',
        'source-layer': 'roads',
        minzoom: 14,
        maxzoom: 15,  // Exclusive - shows at zoom 14-14.99, then assets-label takes over
        layout: {
          'text-field': [
            'coalesce',
            ['get', 'displayName'],
            ['get', 'name'],
            ['get', 'ref'],
            ['case', ['has', 'id'], ['concat', 'ID ', ['get', 'id']], ''],
          ],
          'text-font': ['Open Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10, 15, 11],
          'text-anchor': 'center',
          'symbol-placement': 'line',
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
      map.current.addSource('events', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.current.addLayer({
        id: 'events-fill',
        type: 'fill',
        source: 'events',
        filter: ['==', '$type', 'Polygon'],
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.15, // Reduced from 0.3 to allow clicking roads underneath
        },
      });

      map.current.addLayer({
        id: 'events-line',
        type: 'line',
        source: 'events',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 3,
        },
      });

      // Invisible hit area layer for events (wider clickable area for lines)
      map.current.addLayer({
        id: 'events-hit-area',
        type: 'line',
        source: 'events',
        paint: {
          'line-color': '#000000',
          'line-width': 20,
          'line-opacity': 0.001,
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

      // Glow layer (outer) for selected asset
      map.current.addLayer({
        id: 'selected-asset-glow',
        type: 'line',
        source: 'selected-asset',
        paint: {
          'line-color': '#EF4444',
          'line-width': 20,
          'line-blur': 8,
          'line-opacity': 0.6,
        },
      });

      // Main line for selected asset
      map.current.addLayer({
        id: 'selected-asset-line',
        type: 'line',
        source: 'selected-asset',
        paint: {
          'line-color': '#EF4444',
          'line-width': 10,
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
      }, 'selected-asset-line'); // Insert below selected layer

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
      }, 'selected-asset-line'); // Insert below selected layer

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
          'fill-opacity': 0.25,
        },
      });

      map.current.addLayer({
        id: 'preview-geometry-line',
        type: 'line',
        source: 'preview-geometry',
        paint: {
          'line-color': '#06B6D4', // cyan
          'line-width': 3,
          'line-dasharray': [3, 2], // dashed line to indicate preview
        },
      });

      // OSM Road Labels (CARTO Vector)
      map.current.addSource('carto-vector', {
        type: 'vector',
        url: 'https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/tiles.json',
        attribution: '© <a href="https://carto.com/">CARTO</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      });

      map.current.addLayer({
        id: 'osm-road-labels',
        type: 'symbol',
        source: 'carto-vector',
        'source-layer': 'transportation_name',
        minzoom: 12,
        maxzoom: 15,  // Handoff to assets-label at zoom 15
        layout: {
          'text-field': ['coalesce', ['get', 'name'], ['get', 'name:ja'], ['get', 'ref'], ''],
          'text-font': ['Noto Sans Regular', 'Open Sans Regular'],  // CJK support
          'text-size': ['interpolate', ['linear'], ['zoom'], 12, 10, 15, 14],
          'symbol-placement': 'line',
          'text-max-angle': 30,
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#2b2b2b',
          'text-halo-color': 'rgba(255,255,255,0.9)',
          'text-halo-width': 2,
        },
      }, 'assets-line');  // Insert before assets-line

      // Create popup
      popup.current = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
      });

      // Click handlers
      map.current.on('click', (e) => {
        // Check if we clicked on any features
        const features = map.current?.queryRenderedFeatures(e.point, {
          layers: ['events-fill', 'events-line', 'events-hit-area', 'assets-hit-area', 'inspections-point']
        });

        // If no features were clicked, clear selection and tooltips
        if (!features || features.length === 0) {
          if (useUIStore.getState().isEventFormOpen) return;
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
        if (state.isEventFormOpen) return true;
        // Disable road interaction when event is selected, UNLESS in assets view or road update mode
        if (state.selectedEventId && state.currentView !== 'assets' && !state.isRoadUpdateModeActive) {
          return false;
        }
        return true;
      };

      // Event click handlers
      map.current.on('click', 'events-fill', (e) => {
        if (e.features && e.features[0]) {
          e.originalEvent.stopPropagation();
          const props = e.features[0].properties;
          const eventId = props?.id;
          const state = useUIStore.getState();
          if (state.isEventFormOpen) return;

          // Clear preview tooltip
          setPreviewEvent(null);
          setPreviewTooltipPosition(null);

          // Clear any existing tooltip and open detail panel
          setLockedTooltipPosition(null);
          if (eventId !== state.selectedEventId) {
            selectEvent(eventId);
            setCurrentView('events');
          }
          openEventDetailModal(eventId);
        }
      });

      map.current.on('click', 'events-line', (e) => {
        if (e.features && e.features[0]) {
          e.originalEvent.stopPropagation();
          const props = e.features[0].properties;
          const eventId = props?.id;
          const state = useUIStore.getState();
          if (state.isEventFormOpen) return;

          setPreviewEvent(null);
          setPreviewTooltipPosition(null);

          // Clear any existing tooltip and open detail panel
          setLockedTooltipPosition(null);
          if (eventId !== state.selectedEventId) {
            selectEvent(eventId);
            setCurrentView('events');
          }
          openEventDetailModal(eventId);
        }
      });

      map.current.on('click', 'events-hit-area', (e) => {
        if (e.features && e.features[0]) {
          e.originalEvent.stopPropagation();
          const props = e.features[0].properties;
          const eventId = props?.id;
          const state = useUIStore.getState();
          if (state.isEventFormOpen) return;

          setPreviewEvent(null);
          setPreviewTooltipPosition(null);

          // Clear any existing tooltip and open detail panel
          setLockedTooltipPosition(null);
          if (eventId !== state.selectedEventId) {
            selectEvent(eventId);
            setCurrentView('events');
          }
          openEventDetailModal(eventId);
        }
      });

      map.current.on('click', 'assets-hit-area', (e) => {
        if (e.features && e.features[0]) {
          const props = e.features[0].properties;
          const assetId = props?.id as string | undefined;
          if (!assetId) return;

          const state = useUIStore.getState();
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

      // Alias for backward compatibility in hover handlers
      const shouldAllowRoadHover = shouldAllowRoadInteraction;

      // Cursor changes
      map.current.on('mouseenter', 'events-fill', () => {
        if (map.current) map.current.getCanvas().style.cursor = 'pointer';
      });
      map.current.on('mouseleave', 'events-fill', () => {
        if (map.current) map.current.getCanvas().style.cursor = '';
      });
      map.current.on('mouseenter', 'events-line', () => {
        if (map.current) map.current.getCanvas().style.cursor = 'pointer';
      });
      map.current.on('mouseleave', 'events-line', () => {
        if (map.current) map.current.getCanvas().style.cursor = '';
      });
      map.current.on('mouseenter', 'events-hit-area', () => {
        if (map.current) map.current.getCanvas().style.cursor = 'pointer';
      });
      map.current.on('mouseleave', 'events-hit-area', () => {
        if (map.current) map.current.getCanvas().style.cursor = '';
      });
      map.current.on('mouseenter', 'assets-hit-area', () => {
        if (map.current && shouldAllowRoadHover()) {
          map.current.getCanvas().style.cursor = 'pointer';
        }
      });
      map.current.on('mouseleave', 'assets-hit-area', () => {
        if (map.current) map.current.getCanvas().style.cursor = '';
      });

      // Hover tooltip for events (using React component)
      // Shows preview tooltip for non-selected events, locked tooltip stays visible
      const handleEventMouseMove = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
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

      map.current.on('mousemove', 'events-fill', handleEventMouseMove);
      map.current.on('mouseleave', 'events-fill', handleEventMouseLeave);
      map.current.on('mousemove', 'events-line', handleEventMouseMove);
      map.current.on('mouseleave', 'events-line', handleEventMouseLeave);
      map.current.on('mousemove', 'events-hit-area', handleEventMouseMove);
      map.current.on('mouseleave', 'events-hit-area', handleEventMouseLeave);

      // Hover popup for assets
      map.current.on('mousemove', 'assets-hit-area', (e) => {
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
      map.current.on('mouseleave', 'assets-hit-area', () => {
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
          }
          useUIStore.getState().setMapZoom(zoom);

          if (zoom >= 12) {
            const bounds = map.current!.getBounds();
            const bboxString = truncateBbox(bounds);
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

      // Call once after load to fetch initial data without user interaction
      handleMoveend();
    });

    return () => {
      if (moveendTimer.current) window.clearTimeout(moveendTimer.current);
      if (handleMoveendRef.current && map.current) {
        map.current.off('moveend', handleMoveendRef.current);
      }
      map.current?.remove();
      map.current = null;
    };
  }, []);

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

  // Update assets layer (API data for zoom >= 14)
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const source = map.current.getSource('assets') as maplibregl.GeoJSONSource;
    if (!source) return;

    // Clear assets when zoomed out below interaction threshold OR layer is hidden
    if (!mapBbox || currentZoom < 14 || !showAssets) {
      source.setData({ type: 'FeatureCollection', features: [] });
      map.current.setLayoutProperty('assets-line', 'visibility', 'none');
      map.current.setLayoutProperty('assets-hit-area', 'visibility', 'none');
      map.current.setLayoutProperty('assets-label', 'visibility', 'none');
      return;
    }

    if (!assetsData?.data) return;

    const features = assetsData.data.map((asset: RoadAsset) => ({
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
        labelText: (() => {
          // Show road name if available
          if (!isRoadAssetUnnamed(asset)) {
            return getRoadAssetLabel(asset);
          }
          // For unnamed roads, show simplified ID (e.g., "NISH-4032" instead of "RA-NISH-4032")
          if (asset.id) {
            const id = String(asset.id);
            // Remove "RA-" prefix if present
            return id.startsWith('RA-') ? id.substring(3) : id;
          }
          return '';
        })(),
        roadType: asset.roadType,
        color: ROAD_TYPE_COLORS[asset.roadType] || '#666',
      },
    }));

    source.setData({ type: 'FeatureCollection', features });
    map.current.setLayoutProperty('assets-line', 'visibility', 'visible');
    map.current.setLayoutProperty('assets-hit-area', 'visibility', 'visible');
    map.current.setLayoutProperty('assets-label', 'visibility', 'visible');
  }, [assetsData, showAssets, mapLoaded, mapBbox, currentZoom]);

  // Highlight selected assets while editing an event
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    if (!map.current.getLayer('editing-assets-line')) return;

    if (!showAssets || currentZoom < 14 || !mapBbox) {
      map.current.setLayoutProperty('editing-assets-line', 'visibility', 'none');
      map.current.setFilter('editing-assets-line', ['in', ['get', 'id'], ['literal', []]]);
      if (map.current.getLayer('editing-assets-glow')) {
        map.current.setLayoutProperty('editing-assets-glow', 'visibility', 'none');
        map.current.setFilter('editing-assets-glow', ['in', ['get', 'id'], ['literal', []]]);
      }
      return;
    }

    if (isEventFormOpen && selectedRoadAssetIdsForForm.length > 0) {
      const filter: maplibregl.FilterSpecification = ['in', ['get', 'id'], ['literal', selectedRoadAssetIdsForForm]];
      map.current.setFilter('editing-assets-line', filter);
      map.current.setLayoutProperty('editing-assets-line', 'visibility', 'visible');
      if (map.current.getLayer('editing-assets-glow')) {
        map.current.setFilter('editing-assets-glow', filter);
        map.current.setLayoutProperty('editing-assets-glow', 'visibility', 'visible');
      }
    } else {
      map.current.setFilter('editing-assets-line', ['in', ['get', 'id'], ['literal', []]]);
      map.current.setLayoutProperty('editing-assets-line', 'visibility', 'none');
      if (map.current.getLayer('editing-assets-glow')) {
        map.current.setFilter('editing-assets-glow', ['in', ['get', 'id'], ['literal', []]]);
        map.current.setLayoutProperty('editing-assets-glow', 'visibility', 'none');
      }
    }
  }, [selectedRoadAssetIdsForForm, isEventFormOpen, mapLoaded, showAssets, currentZoom, mapBbox]);

  // Update roads preview layer visibility and opacity
  // PMTiles shows all road types at all zoom levels; no filter needed
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const z = Math.floor(currentZoom);

    // Opacity: reduce when API data is visible (zoom >= 14) to avoid visual clutter
    const previewOpacity = z >= 14 && showAssets ? 0.5 : 0.6;

    try {
      // Visibility follows showAssets toggle (sync both line and label layers)
      const visibility = showAssets ? 'visible' : 'none';
      map.current.setLayoutProperty('roads-preview-line', 'visibility', visibility);
      map.current.setLayoutProperty('roads-preview-label', 'visibility', visibility);
      // Apply opacity (no filter - show all road types)
      map.current.setPaintProperty('roads-preview-line', 'line-opacity', previewOpacity);
    } catch {
      // Layers may not exist if PMTiles file is not available
    }
  }, [currentZoom, showAssets, mapLoaded]);

  // Update OSM road labels visibility
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Guard: check layer exists before setting property
    if (!map.current.getLayer('osm-road-labels')) return;

    map.current.setLayoutProperty(
      'osm-road-labels',
      'visibility',
      showOsmLabels ? 'visible' : 'none'
    );
  }, [showOsmLabels, mapLoaded]);

  // Update events layer
  useEffect(() => {
    if (!map.current || !mapLoaded || !eventsData?.data) return;

    const source = map.current.getSource('events') as maplibregl.GeoJSONSource;
    if (!source) return;

    // Filter out the event being edited (it's shown in editing-event layer instead)
    const eventsToShow = isEventFormOpen && editingEventId
      ? eventsData.data.filter((e: ConstructionEvent) => e.id !== editingEventId)
      : eventsData.data;

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
    map.current.setLayoutProperty('events-fill', 'visibility', eventsVisible ? 'visible' : 'none');
    map.current.setLayoutProperty('events-line', 'visibility', eventsVisible ? 'visible' : 'none');
    map.current.setLayoutProperty('events-hit-area', 'visibility', eventsVisible ? 'visible' : 'none');
  }, [eventsData, showEvents, mapLoaded, isEventFormOpen, editingEventId]);

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

    if (selectedEventId && eventsData?.data) {
      const event = eventsData.data.find((e: ConstructionEvent) => e.id === selectedEventId);
      if (event && event.geometry) {
        // Update highlight source
        source.setData({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: event.geometry,
            properties: { id: event.id },
          }],
        });

        // Calculate bounds and fly to feature
        try {
          const bbox = turf.bbox(event.geometry);
          map.current.fitBounds(
            [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
            { padding: 100, maxZoom: 17, duration: 1000 } // Increased from 16 for better road visibility
          );
          // No auto-show tooltip - user will hover/click to see it
        } catch (e) {
          console.warn('Could not calculate bounds for event geometry');
        }
      }
    } else {
      source.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [selectedEventId, eventsData, mapLoaded]);

  // Show editing event with transparent fill and zoom to it
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const source = map.current.getSource('editing-event') as maplibregl.GeoJSONSource;
    if (!source) return;

    // Sync editingEventId to ref for use in event handlers
    editingEventIdRef.current = editingEventId ?? null;

    // Clear tooltips if editing event (sidebar shows details, no need for tooltip)
    if (editingEventId) {
      if (lockedEventIdRef.current === editingEventId) {
        lockedEventIdRef.current = null;
        setLockedEvent(null);
        setLockedTooltipPosition(null);
      }
      if (previewEvent?.id === editingEventId) {
        setPreviewEvent(null);
        setPreviewTooltipPosition(null);
      }
    }

    if (isEventFormOpen && editingEventId && eventsData?.data) {
      const event = eventsData.data.find((e: ConstructionEvent) => e.id === editingEventId);
      if (event && event.geometry) {
        // Update editing event source (keep current zoom level - don't fly to event)
        const statusColor = STATUS_COLORS[event.status] || '#3B82F6';
        source.setData({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: event.geometry,
            properties: { id: event.id, color: statusColor },
          }],
        });
      }
    } else {
      source.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [isEventFormOpen, editingEventId, eventsData, mapLoaded]);

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

        // Breathing glow effect (opacity 0.3 to 0.9)
        time += 0.04; // Medium speed
        const glowOpacity = 0.3 + 0.6 * (0.5 + 0.5 * Math.sin(time));

        try {
          map.current.setPaintProperty('editing-assets-glow', 'line-opacity', glowOpacity);
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

      // Fit map to preview geometry
      try {
        const bbox = turf.bbox(previewGeometry);
        map.current.fitBounds(
          [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
          { padding: 100, maxZoom: 16, duration: 1000 }
        );
      } catch (e) {
        console.warn('Could not calculate bounds for preview geometry');
      }
    } else {
      source.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [previewGeometry, isEventFormOpen, mapLoaded]);

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

  // Fly to geometry when triggered (e.g., clicking road badge in selector)
  useEffect(() => {
    if (!map.current || !mapLoaded || !flyToGeometry) return;

    try {
      const bbox = turf.bbox(flyToGeometry);

      // Calculate feature length to determine appropriate zoom
      const feature = turf.feature(flyToGeometry);
      const length = turf.length(feature, { units: 'meters' });

      // Smaller features need higher zoom (closer view)
      let minZoom = 15;
      if (length < 50) minZoom = 18;
      else if (length < 150) minZoom = 17;
      else if (length < 400) minZoom = 16;

      map.current.fitBounds(
        [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
        { padding: 100, maxZoom: 18, minZoom, duration: 1000 }
      );

      // Clear the flyToGeometry after animation starts
      setTimeout(() => {
        setFlyToGeometry(null);
      }, 100);
    } catch (e) {
      console.warn('Could not calculate bounds for flyTo geometry');
      setFlyToGeometry(null);
    }
  }, [flyToGeometry, mapLoaded, setFlyToGeometry]);

  // Sync bbox to uiStore when mapBbox changes
  useEffect(() => {
    setMapBboxStore(mapBbox);
  }, [mapBbox, setMapBboxStore]);

  return (
    <Box style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {/* Road assets zoom/type indicator */}
      {showAssets && mapLoaded && (
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
            label="OSM Road Labels"
            checked={showOsmLabels}
            onChange={toggleOsmLabels}
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
          onViewDetails={(eventId) => {
            openEventDetailModal(eventId);
            lockedEventIdRef.current = null;
            setLockedEvent(null);
            setLockedTooltipPosition(null);
          }}
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
          onViewDetails={(eventId) => {
            openEventDetailModal(eventId);
            setPreviewEvent(null);
            setPreviewTooltipPosition(null);
          }}
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

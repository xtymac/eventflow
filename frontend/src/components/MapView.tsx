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
  const { selectedEventId, selectedAssetId, selectedAssetGeometry, selectEvent, selectAsset, setCurrentView, previewGeometry, isEventFormOpen, openEventDetailModal, hoveredAssetId, setMapBbox: setMapBboxStore } = useUIStore();
  const popup = useRef<maplibregl.Popup | null>(null);

  // Event hover tooltip state
  const [hoveredEvent, setHoveredEvent] = useState<HoveredEventData | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const isTooltipHoveredRef = useRef(false);

  // Track which asset we've already flown to (prevent repeated fitBounds on assetsData change)
  const lastFlownAssetIdRef = useRef<string | null>(null);
  const isTooltipLockedRef = useRef(false); // Locked when user clicks on event
  const lockedEventIdRef = useRef<string | null>(null); // Store the ID of the locked event
  const currentHoveredEventIdRef = useRef<string | null>(null); // Track current hovered event (for closure access)

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
          'fill-opacity': 0.3,
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

      // Hover highlight layer (uses filter on existing assets source)
      map.current.addLayer({
        id: 'hovered-asset-line',
        type: 'line',
        source: 'assets',
        filter: ['==', ['get', 'id'], ''], // Initial: match nothing
        paint: {
          'line-color': '#3b82f6', // Blue
          'line-width': 6,
          'line-opacity': 0.9,
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

        // If no features were clicked, clear selection and tooltip
        if (!features || features.length === 0) {
          selectEvent(null);
          selectAsset(null);
          // Clear tooltip
          isTooltipLockedRef.current = false;
          lockedEventIdRef.current = null;
          currentHoveredEventIdRef.current = null;
          setHoveredEvent(null);
          setTooltipPosition(null);
          // Don't change currentView to keep context
        }
      });

      // Helper to check if road interaction should be enabled
      const shouldAllowRoadInteraction = () => {
        const state = useUIStore.getState();
        // Disable road interaction when event is selected, UNLESS in assets view or road update mode
        if (state.selectedEventId && state.currentView !== 'assets' && !state.isRoadUpdateModeActive) {
          return false;
        }
        return true;
      };

      // Helper to show event tooltip at click position
      const showEventTooltip = (e: maplibregl.MapMouseEvent, props: Record<string, unknown>) => {
        const containerRect = mapContainer.current?.getBoundingClientRect();
        const viewportX = (containerRect?.left ?? 0) + e.point.x;
        const viewportY = (containerRect?.top ?? 0) + e.point.y;

        currentHoveredEventIdRef.current = props?.id as string;
        setHoveredEvent({
          id: props?.id as string,
          name: props?.name as string,
          status: props?.status as string,
          color: props?.color as string,
          startDate: props?.startDate as string | undefined,
          endDate: props?.endDate as string | undefined,
          department: props?.department as string | undefined,
          restrictionType: props?.restrictionType as string | undefined,
          affectedAssetsCount: props?.affectedAssetsCount as number | undefined,
        });
        setTooltipPosition({ x: viewportX, y: viewportY });
      };

      map.current.on('click', 'events-fill', (e) => {
        if (e.features && e.features[0]) {
          // Stop propagation to prevent map click handler from clearing selection
          e.originalEvent.stopPropagation();
          const eventId = e.features[0].properties?.id;
          const props = e.features[0].properties;

          // Get latest state to avoid closure issue
          const state = useUIStore.getState();

          // If clicking the same selected event, reset hover tracking to allow tooltip refresh
          if (eventId === state.selectedEventId) {
            currentHoveredEventIdRef.current = null;
          }

          // Select and highlight the event
          selectEvent(eventId);
          setCurrentView('events');
          // Lock tooltip so it stays visible after click
          isTooltipLockedRef.current = true;
          lockedEventIdRef.current = eventId;

          // Show tooltip immediately at click position
          if (props) {
            showEventTooltip(e, props);
          }
        }
      });

      map.current.on('click', 'events-line', (e) => {
        if (e.features && e.features[0]) {
          e.originalEvent.stopPropagation();
          const eventId = e.features[0].properties?.id;
          const props = e.features[0].properties;

          // Get latest state to avoid closure issue
          const state = useUIStore.getState();

          // If clicking the same selected event, reset hover tracking to allow tooltip refresh
          if (eventId === state.selectedEventId) {
            currentHoveredEventIdRef.current = null;
          }

          // Select and highlight the event
          selectEvent(eventId);
          setCurrentView('events');
          // Lock tooltip so it stays visible after click
          isTooltipLockedRef.current = true;
          lockedEventIdRef.current = eventId;

          // Show tooltip immediately at click position
          if (props) {
            showEventTooltip(e, props);
          }
        }
      });

      // Events hit area click handler (for easier clicking on thin lines)
      map.current.on('click', 'events-hit-area', (e) => {
        if (e.features && e.features[0]) {
          e.originalEvent.stopPropagation();
          const eventId = e.features[0].properties?.id;
          const props = e.features[0].properties;

          const state = useUIStore.getState();
          if (eventId === state.selectedEventId) {
            currentHoveredEventIdRef.current = null;
          }

          selectEvent(eventId);
          setCurrentView('events');
          isTooltipLockedRef.current = true;
          lockedEventIdRef.current = eventId;

          if (props) {
            showEventTooltip(e, props);
          }
        }
      });

      map.current.on('click', 'assets-hit-area', (e) => {
        if (e.features && e.features[0]) {
          // Don't allow road selection when event is selected (unless in assets view or road update mode)
          if (!shouldAllowRoadInteraction()) {
            return;
          }

          e.originalEvent.stopPropagation();

          // Allow asset selection - this will clear any selected event
          selectAsset(e.features[0].properties?.id);
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
      const handleEventMouseMove = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
        if (e.features && e.features[0]) {
          const props = e.features[0].properties;
          const eventId = props?.id;

          // If tooltip is locked (from click or auto-show), don't update anything
          // The locked tooltip should stay in place until user interacts with it
          if (isTooltipLockedRef.current) {
            return;
          }

          // Only update position when hovering a NEW event (not on every mouse move)
          if (eventId !== currentHoveredEventIdRef.current) {
            currentHoveredEventIdRef.current = eventId;

            // Get map container's position to calculate viewport coordinates
            const containerRect = mapContainer.current?.getBoundingClientRect();
            const viewportX = (containerRect?.left ?? 0) + e.point.x;
            const viewportY = (containerRect?.top ?? 0) + e.point.y;

            setHoveredEvent({
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
            setTooltipPosition({ x: viewportX, y: viewportY });
          }
        }
      };

      const handleEventMouseLeave = () => {
        // Don't do anything if tooltip is locked
        if (isTooltipLockedRef.current) {
          return;
        }

        // Reset tracked event ID
        currentHoveredEventIdRef.current = null;
        // Only hide if tooltip is not being hovered - longer delay for better UX
        setTimeout(() => {
          if (!isTooltipHoveredRef.current && !isTooltipLockedRef.current) {
            setHoveredEvent(null);
            setTooltipPosition(null);
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

    const features = eventsData.data.map((event: ConstructionEvent) => ({
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
    map.current.setLayoutProperty('events-fill', 'visibility', showEvents ? 'visible' : 'none');
    map.current.setLayoutProperty('events-line', 'visibility', showEvents ? 'visible' : 'none');
    map.current.setLayoutProperty('events-hit-area', 'visibility', showEvents ? 'visible' : 'none');
  }, [eventsData, showEvents, mapLoaded]);

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

    // Always reset lock state when selectedEventId changes
    // This ensures hover works correctly after map fly animation completes
    isTooltipLockedRef.current = false;
    lockedEventIdRef.current = null;
    currentHoveredEventIdRef.current = null;

    // Clear tooltip if it's showing a different event (e.g., from sidebar click)
    if (hoveredEvent && hoveredEvent.id !== selectedEventId) {
      setHoveredEvent(null);
      setTooltipPosition(null);
    }

    // Clear road popup when event is selected (avoid leftover tooltip when mouse doesn't move)
    if (selectedEventId && popup.current) {
      popup.current.remove();
    }

    let tooltipTimeoutId: number | undefined;

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
            { padding: 100, maxZoom: 16, duration: 1000 }
          );

          // Show tooltip automatically after fly animation completes
          const mapInstance = map.current;
          tooltipTimeoutId = window.setTimeout(() => {
            if (!mapInstance || !mapContainer.current) return;

            // Use bbox to position tooltip at the top of the polygon (not blocking it)
            // bbox = [minX, minY, maxX, maxY] = [west, south, east, north]
            const centerX = (bbox[0] + bbox[2]) / 2; // Center longitude
            const topY = bbox[3]; // North (top) latitude

            // Project geo coordinates to screen coordinates
            const point = mapInstance.project([centerX, topY]);
            const containerRect = mapContainer.current.getBoundingClientRect();

            // Position tooltip above the top edge of the polygon
            // Note: EventMapTooltip adds +12 to both x and y
            const tooltipX = containerRect.left + point.x;
            const tooltipY = containerRect.top + point.y - 200; // Above the top edge of polygon

            // Set tooltip data
            setHoveredEvent({
              id: event.id,
              name: event.name,
              status: event.status,
              color: STATUS_COLORS[event.status] || '#666',
              startDate: event.startDate,
              endDate: event.endDate,
              department: event.department,
              restrictionType: event.restrictionType,
              affectedAssetsCount: event.roadAssets?.length || 0,
            });
            setTooltipPosition({ x: tooltipX, y: tooltipY });

            // Lock the tooltip so it doesn't disappear on mouse move
            isTooltipLockedRef.current = true;
            lockedEventIdRef.current = event.id;
            currentHoveredEventIdRef.current = event.id;
          }, 1050); // Wait for fly animation to complete (1000ms duration + buffer)
        } catch (e) {
          console.warn('Could not calculate bounds for event geometry');
        }
      }
    } else {
      source.setData({ type: 'FeatureCollection', features: [] });
    }

    // Cleanup timeout on unmount or when effect re-runs
    return () => {
      if (tooltipTimeoutId !== undefined) {
        window.clearTimeout(tooltipTimeoutId);
      }
    };
  }, [selectedEventId, eventsData, mapLoaded]);

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
    if (hoveredAssetId && hoveredAssetId !== selectedAssetId) {
      map.current.setFilter('hovered-asset-line', ['==', ['get', 'id'], hoveredAssetId]);
    } else {
      map.current.setFilter('hovered-asset-line', ['==', ['get', 'id'], '']); // Match nothing
    }
  }, [hoveredAssetId, selectedAssetId, mapLoaded]);

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

        {isEventFormOpen && previewGeometry && (
          <>
            <Text size="sm" fw={600} mt="sm" mb="xs">Preview</Text>
            <Stack gap={4}>
              <Group gap="xs">
                <Box style={{ width: 12, height: 12, backgroundColor: '#06B6D4', opacity: 0.5, borderRadius: 2, border: '1px dashed #06B6D4' }} />
                <Text size="xs">Corridor (15m buffer)</Text>
              </Group>
            </Stack>
          </>
        )}
      </Paper>

      {/* Event hover tooltip */}
      {hoveredEvent && tooltipPosition && (
        <EventMapTooltip
          event={hoveredEvent}
          position={tooltipPosition}
          onViewDetails={(eventId) => {
            openEventDetailModal(eventId);
            isTooltipLockedRef.current = false;
            lockedEventIdRef.current = null;
            currentHoveredEventIdRef.current = null;
            setHoveredEvent(null);
            setTooltipPosition(null);
          }}
          onMouseEnter={() => {
            isTooltipHoveredRef.current = true;
          }}
          onMouseLeave={() => {
            // Only update hover state, don't unlock
            // Tooltip stays until event is deselected (click elsewhere) or View Details is clicked
            isTooltipHoveredRef.current = false;
          }}
        />
      )}

    </Box>
  );
}

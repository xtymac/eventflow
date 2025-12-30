import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import * as turf from '@turf/turf';
import { Protocol } from 'pmtiles';
import { Box, Paper, Stack, Switch, Text, Group } from '@mantine/core';
import { useEvents, useAssets, useInspections } from '../hooks/useApi';
import { useMapStore, type MapTheme } from '../stores/mapStore';
import { useUIStore } from '../stores/uiStore';
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
    toggleEvents,
    toggleAssets,
    toggleInspections
  } = useMapStore();
  const { selectedEventId, selectedAssetId, selectedAssetGeometry, selectEvent, selectAsset, setCurrentView, previewGeometry, isEventFormOpen, openEventDetailModal, hoveredAssetId, assetFilters, setMapBbox: setMapBboxStore } = useUIStore();
  const { filterByMapView } = assetFilters;
  const popup = useRef<maplibregl.Popup | null>(null);

  // Event hover tooltip state
  const [hoveredEvent, setHoveredEvent] = useState<HoveredEventData | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const isTooltipHoveredRef = useRef(false);
  const isTooltipLockedRef = useRef(false); // Locked when user clicks on event

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

      map.current.addLayer({
        id: 'selected-asset-line',
        type: 'line',
        source: 'selected-asset',
        paint: {
          'line-color': '#EF4444',
          'line-width': 8,
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

      // Create popup
      popup.current = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
      });

      // Click handlers
      map.current.on('click', (e) => {
        // Check if we clicked on any features
        const features = map.current?.queryRenderedFeatures(e.point, {
          layers: ['events-fill', 'events-line', 'assets-line', 'inspections-point']
        });

        // If no features were clicked, clear selection and tooltip
        if (!features || features.length === 0) {
          selectEvent(null);
          selectAsset(null);
          // Clear tooltip
          isTooltipLockedRef.current = false;
          setHoveredEvent(null);
          setTooltipPosition(null);
          // Don't change currentView to keep context
        }
      });

      map.current.on('click', 'events-fill', (e) => {
        if (e.features && e.features[0]) {
          // Stop propagation to prevent map click handler from clearing selection
          e.originalEvent.stopPropagation();
          // Select and highlight the event
          selectEvent(e.features[0].properties?.id);
          setCurrentView('events');
          // Lock tooltip so it stays visible after click
          isTooltipLockedRef.current = true;
        }
      });

      map.current.on('click', 'events-line', (e) => {
        if (e.features && e.features[0]) {
          e.originalEvent.stopPropagation();
          // Select and highlight the event
          selectEvent(e.features[0].properties?.id);
          setCurrentView('events');
          // Lock tooltip so it stays visible after click
          isTooltipLockedRef.current = true;
        }
      });

      map.current.on('click', 'assets-line', (e) => {
        if (e.features && e.features[0]) {
          e.originalEvent.stopPropagation();
          selectAsset(e.features[0].properties?.id);
          setCurrentView('assets');
        }
      });

      // Helper to check if road hover should be enabled
      const shouldAllowRoadHover = () => {
        const state = useUIStore.getState();
        // Disable road hover when event is selected, UNLESS in assets view or road update mode
        if (state.selectedEventId && state.currentView !== 'assets' && !state.isRoadUpdateModeActive) {
          return false;
        }
        return true;
      };

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
      map.current.on('mouseenter', 'assets-line', () => {
        if (map.current && shouldAllowRoadHover()) {
          map.current.getCanvas().style.cursor = 'pointer';
        }
      });
      map.current.on('mouseleave', 'assets-line', () => {
        if (map.current) map.current.getCanvas().style.cursor = '';
      });

      // Hover tooltip for events (using React component)
      // Track current hovered event ID to avoid re-setting position on same event
      let currentHoveredEventId: string | null = null;

      const handleEventMouseMove = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
        if (e.features && e.features[0]) {
          const props = e.features[0].properties;
          const eventId = props?.id;

          // Only update position when hovering a NEW event (not on every mouse move)
          if (eventId !== currentHoveredEventId) {
            currentHoveredEventId = eventId;
            // Reset lock when moving to a different event so previous tooltip disappears
            isTooltipLockedRef.current = false;

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
        // Reset tracked event ID
        currentHoveredEventId = null;
        // Only hide if tooltip is not being hovered or locked - longer delay for better UX
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

      // Hover popup for assets
      map.current.on('mousemove', 'assets-line', (e) => {
        // Skip hover when event is selected (unless in assets view or road update mode)
        if (!shouldAllowRoadHover()) {
          if (map.current) map.current.getCanvas().style.cursor = '';
          if (popup.current) popup.current.remove();
          return;
        }

        if (map.current && popup.current && e.features && e.features[0]) {
          const props = e.features[0].properties;
          const html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif; padding: 2px;">
              <div style="font-weight: 700; margin-bottom: 4px; font-size: 14px; color: #000;">${props?.name}</div>
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
          if (zoom >= 12) {
            const bounds = map.current!.getBounds();
            const bboxString = truncateBbox(bounds);
            setMapBbox(bboxString);

            // Sync to uiStore only when filterByMapView is ON
            const { filterByMapView } = useUIStore.getState().assetFilters;
            if (filterByMapView) {
              useUIStore.getState().setMapBbox(bboxString);
            }
          } else {
            setMapBbox(null);
            // Clear uiStore bbox when zoomed out
            const { filterByMapView } = useUIStore.getState().assetFilters;
            if (filterByMapView) {
              useUIStore.getState().setMapBbox(null);
            }
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
      return;
    }

    if (!assetsData?.data) return;

    const features = assetsData.data.map((asset: RoadAsset) => ({
      type: 'Feature' as const,
      geometry: asset.geometry,
      properties: {
        id: asset.id,
        name: asset.name,
        roadType: asset.roadType,
        color: ROAD_TYPE_COLORS[asset.roadType] || '#666',
      },
    }));

    source.setData({ type: 'FeatureCollection', features });
    map.current.setLayoutProperty('assets-line', 'visibility', 'visible');
  }, [assetsData, showAssets, mapLoaded, mapBbox, currentZoom]);

  // Update roads preview layer visibility and opacity
  // PMTiles shows all road types at all zoom levels; no filter needed
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const z = Math.floor(currentZoom);

    // Opacity: reduce when API data is visible (zoom >= 14) to avoid visual clutter
    const previewOpacity = z >= 14 && showAssets ? 0.5 : 0.6;

    try {
      // Visibility follows showAssets toggle
      map.current.setLayoutProperty(
        'roads-preview-line',
        'visibility',
        showAssets ? 'visible' : 'none'
      );
      // Apply opacity (no filter - show all road types)
      map.current.setPaintProperty('roads-preview-line', 'line-opacity', previewOpacity);
    } catch {
      // Layer may not exist if PMTiles file is not available
    }
  }, [currentZoom, showAssets, mapLoaded]);

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

    // Clear tooltip when selectedEventId changes (e.g., from sidebar click)
    // This prevents stale tooltips from previous map interactions
    if (hoveredEvent && hoveredEvent.id !== selectedEventId) {
      isTooltipLockedRef.current = false;
      setHoveredEvent(null);
      setTooltipPosition(null);
    }

    // Clear road popup when event is selected (avoid leftover tooltip when mouse doesn't move)
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
            { padding: 100, maxZoom: 16, duration: 1000 }
          );
        } catch (e) {
          console.warn('Could not calculate bounds for event geometry');
        }
      }
    } else {
      source.setData({ type: 'FeatureCollection', features: [] });
    }
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

        // Calculate bounds and fly to feature
        try {
          const bbox = turf.bbox(geometry);
          map.current.fitBounds(
            [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
            { padding: 100, maxZoom: 16, duration: 1000 }
          );
        } catch (e) {
          console.warn('Could not calculate bounds for asset geometry');
        }
      }
    } else {
      source.setData({ type: 'FeatureCollection', features: [] });
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

  // Sync bbox to uiStore when filterByMapView toggle changes
  useEffect(() => {
    if (filterByMapView && mapBbox) {
      setMapBboxStore(mapBbox);
    } else if (!filterByMapView) {
      setMapBboxStore(null);
    }
  }, [filterByMapView, mapBbox, setMapBboxStore]);

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
            setHoveredEvent(null);
            setTooltipPosition(null);
          }}
          onMouseEnter={() => {
            isTooltipHoveredRef.current = true;
          }}
          onMouseLeave={() => {
            isTooltipHoveredRef.current = false;
            isTooltipLockedRef.current = false; // Unlock when leaving tooltip
            setHoveredEvent(null);
            setTooltipPosition(null);
          }}
        />
      )}

    </Box>
  );
}

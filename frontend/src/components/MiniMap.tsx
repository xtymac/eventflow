import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import * as turf from '@turf/turf';
import type * as GeoJSONTypes from 'geojson';

interface MiniMapProps {
  geometry?: GeoJSONTypes.Geometry | null;
  markers?: Array<{ lng: number; lat: number; color?: string }>;
  height?: number | string;
  center?: [number, number];
  zoom?: number;
  fillColor?: string;
  fillOpacity?: number;
  /** Index of marker to highlight (pulse + scale up) */
  highlightedMarkerIndex?: number | null;
  /** When true, center/zoom on markers instead of fitting full geometry bounds */
  focusOnMarkers?: boolean;
  /** 'pin' (default MapLibre markers) or 'circle' (SVG circle dot) */
  markerType?: 'pin' | 'circle';
}

// Same raster basemap as main MapView (CARTO Voyager @2x for HiDPI)
const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png'],
      tileSize: 512,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

export function MiniMap({ geometry, markers, height = 300, center, zoom, fillColor = '#228be6', fillOpacity = 0.15, highlightedMarkerIndex, focusOnMarkers, markerType = 'pin' }: MiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerEls = useRef<HTMLElement[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: center || [136.933, 35.14],
      zoom: zoom || 14,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      // Add geometry if provided
      if (geometry) {
        map.addSource('geometry', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry } as GeoJSONTypes.Feature,
        });

        if (geometry.type === 'Point') {
          map.addLayer({
            id: 'geometry-point',
            type: 'circle',
            source: 'geometry',
            paint: {
              'circle-radius': 8,
              'circle-color': fillColor,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#fff',
            },
          });
        } else if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
          map.addLayer({
            id: 'geometry-fill',
            type: 'fill',
            source: 'geometry',
            paint: {
              'fill-color': fillColor,
              'fill-opacity': fillOpacity,
            },
          });
          map.addLayer({
            id: 'geometry-line',
            type: 'line',
            source: 'geometry',
            paint: {
              'line-color': fillColor,
              'line-width': 2,
            },
          });
        } else {
          map.addLayer({
            id: 'geometry-line',
            type: 'line',
            source: 'geometry',
            paint: {
              'line-color': fillColor,
              'line-width': 3,
            },
          });
        }

        // Compute geometry bbox
        try {
          if (focusOnMarkers && markers && markers.length > 0) {
            // Center on the first marker; use zoom prop or default 16
            map.setCenter([markers[0].lng, markers[0].lat]);
            map.setZoom(zoom || 16);
          } else {
            const geoBbox = turf.bbox({ type: 'Feature', properties: {}, geometry });
            // Extend bbox to include marker positions
            let [minLng, minLat, maxLng, maxLat] = geoBbox;
            if (markers) {
              for (const m of markers) {
                if (m.lng < minLng) minLng = m.lng;
                if (m.lat < minLat) minLat = m.lat;
                if (m.lng > maxLng) maxLng = m.lng;
                if (m.lat > maxLat) maxLat = m.lat;
              }
            }
            map.fitBounds(
              [[minLng, minLat], [maxLng, maxLat]],
              { padding: 40, maxZoom: 17, duration: 0 }
            );
          }
        } catch { /* ignore invalid geometry */ }
      }

      // Add markers
      markerEls.current = [];
      if (markers) {
        markers.forEach((m) => {
          let marker: maplibregl.Marker;
          if (markerType === 'circle') {
            const el = document.createElement('div');
            el.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="6" fill="white"/><circle cx="6" cy="6" r="4" fill="${m.color || '#3B82F6'}"/></svg>`;
            el.style.cursor = 'pointer';
            marker = new maplibregl.Marker({ element: el, anchor: 'center' })
              .setLngLat([m.lng, m.lat])
              .addTo(map);
          } else {
            marker = new maplibregl.Marker({ color: m.color || '#e03131' })
              .setLngLat([m.lng, m.lat])
              .addTo(map);
          }
          markerEls.current.push(marker.getElement());
        });
      }
    });

    mapRef.current = map;
    return () => { map.remove(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Highlight marker on hover — target inner SVG to avoid conflicting with
  // MapLibre's position transform on the outer container element.
  useEffect(() => {
    markerEls.current.forEach((el, i) => {
      const svg = el.querySelector('svg');
      if (!svg) return;
      if (i === highlightedMarkerIndex) {
        svg.style.transform = 'scale(1.5)';
        svg.style.filter = 'drop-shadow(0 0 6px rgba(255,180,0,0.9))';
        svg.style.transition = 'transform 0.15s ease, filter 0.15s ease';
        el.style.zIndex = '10';
      } else {
        svg.style.transform = '';
        svg.style.filter = '';
        svg.style.transition = 'transform 0.15s ease, filter 0.15s ease';
        el.style.zIndex = '';
      }
    });
  }, [highlightedMarkerIndex]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height,
        borderRadius: 'var(--mantine-radius-md)',
        overflow: 'hidden',
        border: '1px solid var(--mantine-color-gray-3)',
      }}
    />
  );
}

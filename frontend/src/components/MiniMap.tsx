import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import * as turf from '@turf/turf';
import type * as GeoJSONTypes from 'geojson';

interface MiniMapProps {
  geometry?: GeoJSONTypes.Geometry | null;
  markers?: Array<{ lng: number; lat: number; color?: string }>;
  height?: number;
  center?: [number, number];
  zoom?: number;
  fillColor?: string;
  /** Index of marker to highlight (pulse + scale up) */
  highlightedMarkerIndex?: number | null;
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

export function MiniMap({ geometry, markers, height = 300, center, zoom, fillColor = '#228be6', highlightedMarkerIndex }: MiniMapProps) {
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
              'fill-opacity': 0.15,
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
        } catch { /* ignore invalid geometry */ }
      }

      // Add markers
      markerEls.current = [];
      if (markers) {
        markers.forEach((m) => {
          const marker = new maplibregl.Marker({ color: m.color || '#e03131' })
            .setLngLat([m.lng, m.lat])
            .addTo(map);
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

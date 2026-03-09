import { useCallback, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import * as turf from '@turf/turf';
import type * as GeoJSONTypes from 'geojson';
import type { DummyFacility } from '../data/dummyFacilities';
import { FACILITY_CLASSIFICATION_LABELS, FACILITY_STATUS_CONFIG } from '../data/dummyFacilities';

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
  /** Full facility data for popups — parallel to markers array */
  facilityData?: DummyFacility[];
  /** Callback when a marker is clicked */
  onMarkerClick?: (index: number) => void;
  /** Index of currently selected/clicked marker (shows popup) */
  selectedMarkerIndex?: number | null;
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

function buildFacilityPopupHTML(f: DummyFacility): string {
  const statusConfig = FACILITY_STATUS_CONFIG[f.status] || { label: f.status, className: '' };
  const statusBg = f.status === 'active' ? '#dcfce7' : f.status === 'suspended' || f.status === 'removed' ? '#fee2e2' : '#fef9c3';
  const statusColor = f.status === 'active' ? '#22c55e' : f.status === 'suspended' || f.status === 'removed' ? '#ef4444' : '#ca8a04';
  const classLabel = f.facilityClassification ? (FACILITY_CLASSIFICATION_LABELS[f.facilityClassification] || f.facilityClassification) : '-';
  const rankColor = (r?: string) => {
    if (!r) return '#e5e7eb';
    const map: Record<string, string> = { A: '#22c55e', B: '#facc15', C: '#f87171', D: '#6b7280' };
    return map[r] || '#e5e7eb';
  };
  const rankTextColor = (r?: string) => r === 'B' ? '#713F12' : '#fff';
  const imgSrc = `/facilities/${f.category === 'restFacility' ? 'bench-park.jpg' : f.category === 'playEquipment' ? 'playground-composite.jpg' : f.category === 'sportsFacility' ? 'sports-ground.jpg' : 'park-default.jpg'}`;

  return `
    <div style="font-family:'Noto Sans JP',sans-serif;min-width:280px;max-width:340px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:12px;font-weight:500;color:#0a0a0a;">${f.name}</span>
          <span style="font-size:12px;font-weight:500;color:${statusColor};background:${statusBg};border-radius:9999px;padding:1px 8px;">${statusConfig.label}</span>
        </div>
      </div>
      <img src="${imgSrc}" alt="${f.name}" style="width:100%;height:140px;object-fit:cover;border-radius:6px;margin-bottom:8px;" onerror="this.style.display='none'" />
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">
        <div>
          <div style="font-size:11px;color:#737373;">施設ID</div>
          <div style="font-size:12px;font-weight:500;color:#0a0a0a;">${f.facilityId || '-'}</div>
        </div>
        <div>
          <div style="font-size:11px;color:#737373;">施設分類</div>
          <div style="font-size:12px;font-weight:500;color:#0a0a0a;">${classLabel}</div>
        </div>
        <div>
          <div style="font-size:11px;color:#737373;">数量</div>
          <div style="font-size:12px;font-weight:500;color:#0a0a0a;">${f.quantity ? f.quantity + ' 基' : '-'}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
        <div>
          <div style="font-size:11px;color:#737373;">構造ランク</div>
          <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:4px;background:${rankColor(f.structureRank)};color:${rankTextColor(f.structureRank)};font-size:11px;font-weight:700;">${f.structureRank || '-'}</span>
        </div>
        <div>
          <div style="font-size:11px;color:#737373;">消耗ランク</div>
          <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:4px;background:${rankColor(f.wearRank)};color:${rankTextColor(f.wearRank)};font-size:11px;font-weight:700;">${f.wearRank || '-'}</span>
        </div>
      </div>
      <div style="border-top:1px solid #f0f0f0;padding-top:6px;display:flex;flex-direction:column;gap:6px;">
        <div style="display:flex;justify-content:space-between;font-size:11px;">
          <span style="color:#737373;">設置年</span>
          <span style="color:#0a0a0a;">${f.dateInstalled || '-'}</span>
        </div>
        <div style="border-top:1px solid #f0f0f0;padding-top:6px;display:flex;justify-content:space-between;font-size:11px;">
          <span style="color:#737373;">詳細・規格</span>
          <span style="color:#0a0a0a;">${f.description || '-'}</span>
        </div>
        <div style="border-top:1px solid #f0f0f0;padding-top:6px;display:flex;justify-content:space-between;font-size:11px;">
          <span style="color:#737373;">主要部材</span>
          <span style="color:#0a0a0a;">${f.mainMaterial || '-'}</span>
        </div>
      </div>
    </div>
  `;
}

export function MiniMap({ geometry, markers, height = 300, center, zoom, fillColor = '#228be6', fillOpacity = 0.15, highlightedMarkerIndex, focusOnMarkers, facilityData, onMarkerClick, selectedMarkerIndex }: MiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerEls = useRef<HTMLElement[]>([]);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const initialBounds = useRef<[[number, number], [number, number]] | null>(null);
  const initialCenter = useRef<[number, number] | null>(null);
  const initialZoom = useRef<number | null>(null);

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
            initialCenter.current = [markers[0].lng, markers[0].lat];
            initialZoom.current = zoom || 16;
            map.setCenter(initialCenter.current);
            map.setZoom(initialZoom.current);
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
            initialBounds.current = [[minLng, minLat], [maxLng, maxLat]];
            map.fitBounds(
              initialBounds.current,
              { padding: 40, maxZoom: 17, duration: 0 }
            );
          }
        } catch { /* ignore invalid geometry */ }
      }

      // Add markers using teardrop pin shape
      markerEls.current = [];
      if (markers) {
        markers.forEach((m, markerIdx) => {
          const el = document.createElement('div');
          const color = m.color || '#3B82F6';
          const svgNs = 'http://www.w3.org/2000/svg';
          const svg = document.createElementNS(svgNs, 'svg');
          svg.setAttribute('width', '24');
          svg.setAttribute('height', '32');
          svg.setAttribute('viewBox', '0 0 24 32');
          // Teardrop body
          const path = document.createElementNS(svgNs, 'path');
          path.setAttribute('d', 'M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20s12-11 12-20C24 5.373 18.627 0 12 0z');
          path.setAttribute('fill', 'white');
          path.setAttribute('stroke', '#d4d4d4');
          path.setAttribute('stroke-width', '1');
          // Inner circle
          const circle = document.createElementNS(svgNs, 'circle');
          circle.setAttribute('cx', '12');
          circle.setAttribute('cy', '11');
          circle.setAttribute('r', '5');
          circle.setAttribute('fill', color);
          svg.appendChild(path);
          svg.appendChild(circle);
          el.appendChild(svg);
          el.style.cursor = 'pointer';

          el.addEventListener('click', (e) => {
            e.stopPropagation();
            onMarkerClick?.(markerIdx);
          });

          const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([m.lng, m.lat])
            .addTo(map);
          markerEls.current.push(marker.getElement());
        });
      }
    });

    mapRef.current = map;
    return () => { map.remove(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Show/hide popup when selectedMarkerIndex changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !facilityData || !markers) return;

    // Remove existing popup
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }

    if (selectedMarkerIndex == null || selectedMarkerIndex < 0 || selectedMarkerIndex >= markers.length) return;

    const f = facilityData[selectedMarkerIndex];
    if (!f) return;

    const m = markers[selectedMarkerIndex];
    const popup = new maplibregl.Popup({ closeOnClick: true, closeButton: true, maxWidth: '360px', offset: [0, -30] })
      .setLngLat([m.lng, m.lat])
      .setHTML(buildFacilityPopupHTML(f))
      .addTo(map);

    popup.on('close', () => {
      popupRef.current = null;
      onMarkerClick?.(-1); // signal deselection
    });

    popupRef.current = popup;
  }, [selectedMarkerIndex, facilityData, markers, onMarkerClick]);

  // Highlight marker on hover / selected state
  useEffect(() => {
    markerEls.current.forEach((el, i) => {
      const svg = el.querySelector('svg');
      if (!svg) return;
      const path = svg.querySelector('path');
      const circle = svg.querySelector('circle');
      if (i === selectedMarkerIndex) {
        if (path) { path.setAttribute('fill', '#3B82F6'); path.setAttribute('stroke', '#2563EB'); }
        if (circle) circle.setAttribute('fill', 'white');
        svg.style.transform = 'scale(1.3)';
        svg.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))';
        svg.style.transition = 'transform 0.15s ease, filter 0.15s ease';
        el.style.zIndex = '10';
      } else if (i === highlightedMarkerIndex) {
        if (path) { path.setAttribute('fill', 'white'); path.setAttribute('stroke', '#d4d4d4'); }
        if (circle) circle.setAttribute('fill', markers?.[i]?.color || '#3B82F6');
        svg.style.transform = 'scale(1.5)';
        svg.style.filter = 'drop-shadow(0 0 6px rgba(255,180,0,0.9))';
        svg.style.transition = 'transform 0.15s ease, filter 0.15s ease';
        el.style.zIndex = '10';
      } else {
        if (path) { path.setAttribute('fill', 'white'); path.setAttribute('stroke', '#d4d4d4'); }
        if (circle) circle.setAttribute('fill', markers?.[i]?.color || '#3B82F6');
        svg.style.transform = '';
        svg.style.filter = '';
        svg.style.transition = 'transform 0.15s ease, filter 0.15s ease';
        el.style.zIndex = '';
      }
    });
  }, [highlightedMarkerIndex, selectedMarkerIndex, markers]);

  const handleRefocus = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (initialBounds.current) {
      map.fitBounds(initialBounds.current, { padding: 40, maxZoom: 17, duration: 300 });
    } else if (initialCenter.current && initialZoom.current != null) {
      map.flyTo({ center: initialCenter.current, zoom: initialZoom.current, duration: 300 });
    } else if (center) {
      map.flyTo({ center, zoom: zoom || 14, duration: 300 });
    }
  }, [center, zoom]);

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 'var(--mantine-radius-md)',
          overflow: 'hidden',
          border: '1px solid var(--mantine-color-gray-3)',
        }}
      />
      <button
        type="button"
        onClick={handleRefocus}
        title="公園に戻る"
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          width: 32,
          height: 32,
          borderRadius: 6,
          border: '1px solid rgba(0,0,0,0.12)',
          background: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
      </button>
    </div>
  );
}

import { create } from 'zustand';
import type { LngLatBoundsLike } from 'maplibre-gl';

export type MapTheme = 'light' | 'dark' | 'voyager' | 'standard';

interface MapState {
  center: [number, number];
  zoom: number;
  bounds: LngLatBoundsLike | null;
  mapTheme: MapTheme;
  showEvents: boolean;
  showAssets: boolean;
  showInspections: boolean;
  highlightedFeatureId: string | null;
  drawnGeometry: GeoJSON.Geometry | null;

  // Actions
  setCenter: (center: [number, number]) => void;
  setZoom: (zoom: number) => void;
  setBounds: (bounds: LngLatBoundsLike | null) => void;
  setMapTheme: (theme: MapTheme) => void;
  toggleEvents: () => void;
  toggleAssets: () => void;
  toggleInspections: () => void;
  setHighlightedFeature: (id: string | null) => void;
  setDrawnGeometry: (geometry: GeoJSON.Geometry | null) => void;
}

// Nagoya city center coordinates
const NAGOYA_CENTER: [number, number] = [136.9066, 35.1815];
const DEFAULT_ZOOM = 12;

export const useMapStore = create<MapState>((set) => ({
  center: NAGOYA_CENTER,
  zoom: DEFAULT_ZOOM,
  bounds: null,
  mapTheme: 'voyager',
  showEvents: true,
  showAssets: true,
  showInspections: true,
  highlightedFeatureId: null,
  drawnGeometry: null,

  setCenter: (center) => set({ center }),
  setZoom: (zoom) => set({ zoom }),
  setBounds: (bounds) => set({ bounds }),
  setMapTheme: (theme) => set({ mapTheme: theme }),
  toggleEvents: () => set((state) => ({ showEvents: !state.showEvents })),
  toggleAssets: () => set((state) => ({ showAssets: !state.showAssets })),
  toggleInspections: () => set((state) => ({ showInspections: !state.showInspections })),
  setHighlightedFeature: (id) => set({ highlightedFeatureId: id }),
  setDrawnGeometry: (geometry) => set({ drawnGeometry: geometry }),
}));

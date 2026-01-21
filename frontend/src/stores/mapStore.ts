import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LngLatBoundsLike } from 'maplibre-gl';

export type MapTheme = 'light' | 'dark' | 'voyager' | 'standard';

interface ImportAreaHighlight {
  geometry: GeoJSON.Geometry;
  label: string;
  isHover?: boolean; // If true, use orange hover color; otherwise blue selection color
}

interface MapState {
  center: [number, number];
  zoom: number;
  bounds: LngLatBoundsLike | null;
  mapTheme: MapTheme;
  showEvents: boolean;
  showAssets: boolean;
  showInspections: boolean;
  showRivers: boolean;
  showGreenSpaces: boolean;
  showStreetLights: boolean;
  showNagoyaRoads: boolean;
  showNagoyaBuildingZones: boolean;
  highlightedFeatureId: string | null;
  drawnGeometry: GeoJSON.Geometry | null;
  roadTileVersion: number; // Incremented to force road tile refresh
  importAreaHighlight: ImportAreaHighlight | null; // Highlight for import area preview

  // Actions
  setCenter: (center: [number, number]) => void;
  setZoom: (zoom: number) => void;
  setBounds: (bounds: LngLatBoundsLike | null) => void;
  setMapTheme: (theme: MapTheme) => void;
  toggleEvents: () => void;
  toggleAssets: () => void;
  toggleInspections: () => void;
  toggleRivers: () => void;
  toggleGreenSpaces: () => void;
  toggleStreetLights: () => void;
  toggleNagoyaRoads: () => void;
  toggleNagoyaBuildingZones: () => void;
  setHighlightedFeature: (id: string | null) => void;
  setDrawnGeometry: (geometry: GeoJSON.Geometry | null) => void;
  refreshRoadTiles: () => void;
  setImportAreaHighlight: (highlight: ImportAreaHighlight | null) => void;
}

// Nagoya city center coordinates
const NAGOYA_CENTER: [number, number] = [136.9066, 35.1815];
const DEFAULT_ZOOM = 12;

export const useMapStore = create<MapState>()(
  persist(
    (set) => ({
      center: NAGOYA_CENTER,
      zoom: DEFAULT_ZOOM,
      bounds: null,
      mapTheme: 'voyager',
      showEvents: true,
      showAssets: true,
      showInspections: true,
      showRivers: true,
      showGreenSpaces: true,
      showStreetLights: false, // Off by default (large quantity)
      showNagoyaRoads: false, // Off by default (official designated roads overlay)
      showNagoyaBuildingZones: false, // Off by default (building regulation zones)
      highlightedFeatureId: null,
      drawnGeometry: null,
      roadTileVersion: 0,
      importAreaHighlight: null,

      setCenter: (center) => set({ center }),
      setZoom: (zoom) => set({ zoom }),
      setBounds: (bounds) => set({ bounds }),
      setMapTheme: (theme) => set({ mapTheme: theme }),
      toggleEvents: () => set((state) => ({ showEvents: !state.showEvents })),
      toggleAssets: () => set((state) => ({ showAssets: !state.showAssets })),
      toggleInspections: () => set((state) => ({ showInspections: !state.showInspections })),
      toggleRivers: () => set((state) => ({ showRivers: !state.showRivers })),
      toggleGreenSpaces: () => set((state) => ({ showGreenSpaces: !state.showGreenSpaces })),
      toggleStreetLights: () => set((state) => ({ showStreetLights: !state.showStreetLights })),
      toggleNagoyaRoads: () => set((state) => ({ showNagoyaRoads: !state.showNagoyaRoads })),
      toggleNagoyaBuildingZones: () => set((state) => ({ showNagoyaBuildingZones: !state.showNagoyaBuildingZones })),
      setHighlightedFeature: (id) => set({ highlightedFeatureId: id }),
      setDrawnGeometry: (geometry) => set({ drawnGeometry: geometry }),
      refreshRoadTiles: () => set((state) => ({ roadTileVersion: state.roadTileVersion + 1 })),
      setImportAreaHighlight: (highlight) => set({ importAreaHighlight: highlight }),
    }),
    {
      name: 'map-store',
      partialize: (state) => ({
        center: state.center,
        zoom: state.zoom,
        mapTheme: state.mapTheme,
      }),
    }
  )
);

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
  showInspections: boolean;
  showRivers: boolean;
  showGreenSpaces: boolean;
  showStreetLights: boolean;
  showStreetTrees: boolean;
  showParkTrees: boolean;
  showParkFacilities: boolean;
  showPavementSections: boolean;
  showPumpStations: boolean;
  showInspectionRecords: boolean;
  showNagoyaBuildingZones: boolean;
  showNagoyaRoads: boolean;
  highlightedFeatureId: string | null;
  drawnGeometry: GeoJSON.Geometry | null;
  importAreaHighlight: ImportAreaHighlight | null; // Highlight for import area preview

  // Actions
  setCenter: (center: [number, number]) => void;
  setZoom: (zoom: number) => void;
  setBounds: (bounds: LngLatBoundsLike | null) => void;
  setMapTheme: (theme: MapTheme) => void;
  toggleEvents: () => void;
  toggleInspections: () => void;
  toggleRivers: () => void;
  toggleGreenSpaces: () => void;
  toggleStreetLights: () => void;
  toggleStreetTrees: () => void;
  toggleParkTrees: () => void;
  toggleParkFacilities: () => void;
  togglePavementSections: () => void;
  togglePumpStations: () => void;
  toggleInspectionRecords: () => void;
  toggleNagoyaBuildingZones: () => void;
  toggleNagoyaRoads: () => void;
  setHighlightedFeature: (id: string | null) => void;
  setDrawnGeometry: (geometry: GeoJSON.Geometry | null) => void;
  setImportAreaHighlight: (highlight: ImportAreaHighlight | null) => void;
}

// Nagoya city center (covers all imported designated roads)
const NAGOYA_CENTER: [number, number] = [136.933, 35.140];
const DEFAULT_ZOOM = 14;

export const useMapStore = create<MapState>()(
  persist(
    (set) => ({
      center: NAGOYA_CENTER,
      zoom: DEFAULT_ZOOM,
      bounds: null,
      mapTheme: 'standard',
      showEvents: false,
      showInspections: false,
      showRivers: false,
      showGreenSpaces: true,
      showStreetLights: false,
      showStreetTrees: false,
      showParkTrees: false,
      showParkFacilities: true,
      showPavementSections: false,
      showPumpStations: false,
      showInspectionRecords: false, // Off by default (opt-in)
      showNagoyaBuildingZones: false, // Building regulation zones
      showNagoyaRoads: false, // Designated roads
      highlightedFeatureId: null,
      drawnGeometry: null,
      importAreaHighlight: null,

      setCenter: (center) => set({ center }),
      setZoom: (zoom) => set({ zoom }),
      setBounds: (bounds) => set({ bounds }),
      setMapTheme: (theme) => set({ mapTheme: theme }),
      toggleEvents: () => set((state) => ({ showEvents: !state.showEvents })),
      toggleInspections: () => set((state) => ({ showInspections: !state.showInspections })),
      toggleRivers: () => set((state) => ({ showRivers: !state.showRivers })),
      toggleGreenSpaces: () => set((state) => ({ showGreenSpaces: !state.showGreenSpaces })),
      toggleStreetLights: () => set((state) => ({ showStreetLights: !state.showStreetLights })),
      toggleStreetTrees: () => set((state) => ({ showStreetTrees: !state.showStreetTrees })),
      toggleParkTrees: () => set((state) => ({ showParkTrees: !state.showParkTrees })),
      toggleParkFacilities: () => set((state) => ({ showParkFacilities: !state.showParkFacilities })),
      togglePavementSections: () => set((state) => ({ showPavementSections: !state.showPavementSections })),
      togglePumpStations: () => set((state) => ({ showPumpStations: !state.showPumpStations })),
      toggleInspectionRecords: () => set((state) => ({ showInspectionRecords: !state.showInspectionRecords })),
      toggleNagoyaBuildingZones: () => set((state) => ({ showNagoyaBuildingZones: !state.showNagoyaBuildingZones })),
      toggleNagoyaRoads: () => set((state) => ({ showNagoyaRoads: !state.showNagoyaRoads })),
      setHighlightedFeature: (id) => set({ highlightedFeatureId: id }),
      setDrawnGeometry: (geometry) => set({ drawnGeometry: geometry }),
      setImportAreaHighlight: (highlight) => set({ importAreaHighlight: highlight }),
    }),
    {
      name: 'map-store',
      version: 3, // Bump to discard old localStorage (v2→v3: default theme voyager→standard)
      partialize: (state) => ({
        center: state.center,
        zoom: state.zoom,
        mapTheme: state.mapTheme,
      }),
    }
  )
);

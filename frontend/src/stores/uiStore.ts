import { create } from 'zustand';
import type { Geometry } from 'geojson';

type ViewType = 'events' | 'assets' | 'inspections';

// Asset cache entry for selected assets display
export interface AssetCacheEntry {
  id: string;
  label: string;
  ward?: string;
  roadType?: string;
}

interface UIState {
  selectedEventId: string | null;
  selectedAssetId: string | null;
  selectedAssetGeometry: Geometry | null; // For fly-to when asset is outside viewport
  selectedInspectionId: string | null;
  isEventFormOpen: boolean;
  isAssetFormOpen: boolean;
  isInspectionFormOpen: boolean;
  isDecisionModalOpen: boolean;
  decisionEventId: string | null;
  isStatusChangeModalOpen: boolean;
  statusChangeTargetStatus: 'active' | 'ended' | null;
  detailModalEventId: string | null;
  isRoadUpdateModeActive: boolean;
  editingEventId: string | null;
  drawMode: 'polygon' | 'line' | 'point' | null;
  currentView: ViewType;

  // Event form state
  selectedRoadAssetIdsForForm: string[];
  previewGeometry: Geometry | null;

  // Asset selector state (for AdvancedRoadAssetSelector)
  assetSelectorFilters: {
    ward: string | null;
    roadType: string | null;
    search: string;
    filterByMapView: boolean;
  };
  selectedAssetDetailsCache: Record<string, AssetCacheEntry>;

  // Map state for asset filtering
  mapBbox: string | null;           // Current map viewport bounds
  mapCenter: [number, number] | null;  // Current map center [lng, lat] for distance sorting
  mapZoom: number;                  // Current map zoom level
  hoveredAssetId: string | null;    // Asset being hovered in list (for map highlight)
  sidebarAssets: Array<{ id: string; name: string | null; geometry: Geometry }>;  // Assets in sidebar with geometry (for map markers)

  // Filter panel state (persisted across tab switches)
  filtersOpen: boolean;

  // Filter state (persisted across tab switches)
  assetFilters: {
    roadType: string | null;
    status: string | null;
    ward: string | null;
    search: string;
    unnamed: boolean;
    filterByMapView: boolean;       // Toggle for visible area filter
  };
  eventFilters: {
    status: string | null;
    search: string;
    department: string | null;
    dateRange: {
      from: Date | null;
      to: Date | null;
    };
  };

  // Actions
  selectEvent: (id: string | null) => void;
  selectAsset: (id: string | null, geometry?: Geometry | null) => void;
  selectInspection: (id: string | null) => void;
  openEventForm: (editingId?: string) => void;
  closeEventForm: () => void;
  openAssetForm: () => void;
  closeAssetForm: () => void;
  openInspectionForm: () => void;
  closeInspectionForm: () => void;
  openDecisionModal: (eventId: string) => void;
  closeDecisionModal: () => void;
  openStatusChangeModal: (targetStatus: 'active' | 'ended') => void;
  closeStatusChangeModal: () => void;
  openEventDetailModal: (eventId: string) => void;
  closeEventDetailModal: () => void;
  enterRoadUpdateMode: () => void;
  exitRoadUpdateMode: () => void;
  setDrawMode: (mode: 'polygon' | 'line' | 'point' | null) => void;
  setCurrentView: (view: ViewType) => void;

  // Event form actions
  setSelectedRoadAssetsForForm: (ids: string[]) => void;
  setPreviewGeometry: (geometry: Geometry | null) => void;
  clearFormState: () => void;

  // Asset selector actions
  setAssetSelectorFilter: <K extends keyof UIState['assetSelectorFilters']>(key: K, value: UIState['assetSelectorFilters'][K]) => void;
  resetAssetSelectorFilters: () => void;
  cacheAssetDetails: (assets: AssetCacheEntry[]) => void;
  removeAssetFromCache: (id: string) => void;
  clearAssetCache: () => void;

  // Filter actions
  setFiltersOpen: (open: boolean) => void;
  toggleFilters: () => void;
  setAssetFilter: <K extends keyof UIState['assetFilters']>(key: K, value: UIState['assetFilters'][K]) => void;
  resetEventFilters: () => void;
  setEventFilter: <K extends keyof UIState['eventFilters']>(key: K, value: UIState['eventFilters'][K]) => void;

  // Map actions
  setMapBbox: (bbox: string | null) => void;
  setMapCenter: (center: [number, number] | null) => void;
  setMapZoom: (zoom: number) => void;
  setHoveredAsset: (id: string | null) => void;
  setSidebarAssets: (assets: Array<{ id: string; name: string | null; geometry: Geometry }>) => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedEventId: null,
  selectedAssetId: null,
  selectedAssetGeometry: null,
  selectedInspectionId: null,
  isEventFormOpen: false,
  isAssetFormOpen: false,
  isInspectionFormOpen: false,
  isDecisionModalOpen: false,
  decisionEventId: null,
  isStatusChangeModalOpen: false,
  statusChangeTargetStatus: null,
  detailModalEventId: null,
  isRoadUpdateModeActive: false,
  editingEventId: null,
  drawMode: null,
  currentView: 'events',

  // Event form state
  selectedRoadAssetIdsForForm: [],
  previewGeometry: null,

  // Asset selector state
  assetSelectorFilters: {
    ward: null,
    roadType: null,
    search: '',
    filterByMapView: false,  // Default OFF to avoid user confusion about missing data
  },
  selectedAssetDetailsCache: {},

  // Map state
  mapBbox: null,
  mapCenter: null,
  mapZoom: 0,
  hoveredAssetId: null,
  sidebarAssets: [],

  // Filter panel state
  filtersOpen: false,

  // Filter state
  assetFilters: {
    roadType: null,
    status: null,
    ward: null,
    search: '',
    unnamed: false,
    filterByMapView: true,
  },
  eventFilters: {
    status: null,
    search: '',
    department: null,
    dateRange: { from: null, to: null },
  },

  selectEvent: (id) => set({ selectedEventId: id, selectedAssetId: null, selectedAssetGeometry: null, selectedInspectionId: null }),
  selectAsset: (id, geometry) => set({ selectedAssetId: id, selectedAssetGeometry: geometry ?? null, selectedEventId: null, selectedInspectionId: null }),
  selectInspection: (id) => set({ selectedInspectionId: id, selectedEventId: null, selectedAssetId: null, selectedAssetGeometry: null }),

  openEventForm: (editingId) => set((state) => ({
    isEventFormOpen: true,
    editingEventId: editingId || null,
    detailModalEventId: null,
    // Clear selection when editing to hide red highlight layer and prevent fitBounds conflict
    selectedEventId: editingId ? null : state.selectedEventId,
  })),
  closeEventForm: () => set({
    isEventFormOpen: false,
    editingEventId: null,
    drawMode: null,
    selectedRoadAssetIdsForForm: [],
    previewGeometry: null,
  }),

  openAssetForm: () => set({ isAssetFormOpen: true }),
  closeAssetForm: () => set({ isAssetFormOpen: false, drawMode: null }),

  openInspectionForm: () => set({ isInspectionFormOpen: true }),
  closeInspectionForm: () => set({ isInspectionFormOpen: false, drawMode: null }),

  openDecisionModal: (eventId) => set({ isDecisionModalOpen: true, decisionEventId: eventId }),
  closeDecisionModal: () => set({ isDecisionModalOpen: false, decisionEventId: null }),

  openStatusChangeModal: (targetStatus) => set({ isStatusChangeModalOpen: true, statusChangeTargetStatus: targetStatus }),
  closeStatusChangeModal: () => set({ isStatusChangeModalOpen: false, statusChangeTargetStatus: null }),

  openEventDetailModal: (eventId) => set({ detailModalEventId: eventId }),
  closeEventDetailModal: () => set({ detailModalEventId: null }),

  enterRoadUpdateMode: () => set({ isRoadUpdateModeActive: true }),
  exitRoadUpdateMode: () => set({ isRoadUpdateModeActive: false }),

  setDrawMode: (mode) => set({ drawMode: mode }),
  setCurrentView: (view) => set({ currentView: view }),

  // Event form actions
  setSelectedRoadAssetsForForm: (ids) => set({ selectedRoadAssetIdsForForm: ids }),
  setPreviewGeometry: (geometry) => set({ previewGeometry: geometry }),
  clearFormState: () => set({
    selectedRoadAssetIdsForForm: [],
    previewGeometry: null,
    drawMode: null,
  }),

  // Asset selector actions
  setAssetSelectorFilter: (key, value) => set((state) => ({
    assetSelectorFilters: { ...state.assetSelectorFilters, [key]: value },
  })),
  resetAssetSelectorFilters: () => set({
    assetSelectorFilters: {
      ward: null,
      roadType: null,
      search: '',
      filterByMapView: false,
    },
  }),
  cacheAssetDetails: (assets) => set((state) => {
    const newCache = { ...state.selectedAssetDetailsCache };
    for (const asset of assets) {
      newCache[asset.id] = asset;
    }
    return { selectedAssetDetailsCache: newCache };
  }),
  removeAssetFromCache: (id) => set((state) => {
    const newCache = { ...state.selectedAssetDetailsCache };
    delete newCache[id];
    return { selectedAssetDetailsCache: newCache };
  }),
  clearAssetCache: () => set({ selectedAssetDetailsCache: {} }),

  // Filter actions
  setFiltersOpen: (open) => set({ filtersOpen: open }),
  toggleFilters: () => set((state) => ({ filtersOpen: !state.filtersOpen })),
  setAssetFilter: (key, value) => set((state) => ({
    assetFilters: { ...state.assetFilters, [key]: value },
  })),
  resetEventFilters: () => set({
    eventFilters: {
      status: null,
      search: '',
      department: null,
      dateRange: { from: null, to: null },
    },
  }),
  setEventFilter: (key, value) => set((state) => ({
    eventFilters: { ...state.eventFilters, [key]: value },
  })),

  // Map actions
  setMapBbox: (bbox) => set({ mapBbox: bbox }),
  setMapCenter: (center) => set({ mapCenter: center }),
  setMapZoom: (zoom) => set({ mapZoom: zoom }),
  setHoveredAsset: (id) => set({ hoveredAssetId: id }),
  setSidebarAssets: (assets) => set({ sidebarAssets: assets }),
}));

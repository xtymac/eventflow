import { create } from 'zustand';
import type { Geometry, Feature } from 'geojson';

type ViewType = 'events' | 'assets' | 'inspections';

// Asset cache entry for selected assets display
export interface AssetCacheEntry {
  id: string;
  label: string;
  ward?: string;
  roadType?: string;
  geometry?: Geometry; // For fly-to when clicking badge
}

// Unified snapshot for undo/redo - captures both drawing AND asset selection state
export interface EditingStateSnapshot {
  drawnFeatures: Feature[] | null;
  currentDrawType: 'polygon' | 'line' | null;
  selectedRoadAssetIds: string[];
  assetDetailsCache: Record<string, AssetCacheEntry>;
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
  drawnFeatures: Feature[] | null;        // Features drawn via maplibre-gl-draw (multi-draw support)
  currentDrawType: 'polygon' | 'line' | null;  // Locked after first shape drawn
  drawAction: 'finish' | 'undo' | 'cancel' | 'restore' | null; // Touch-friendly draw actions
  isDrawingActive: boolean;               // True when actively drawing a shape (not in select mode)
  shouldZoomToDrawing: boolean;           // Flag to trigger zoom after draw completes (one-time)

  // Unified history for undo/redo (captures both drawing AND asset selection)
  editHistory: EditingStateSnapshot[];    // Stack of previous states (deep copied)
  editRedoStack: EditingStateSnapshot[];  // Stack for redo
  _lastSnapshotTime: number;              // For throttling snapshots during drag
  _isUndoRedoInProgress: boolean;         // Flag to prevent saveEditSnapshot during undo/redo

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
  flyToGeometry: Geometry | null;   // Geometry to fly to (set to trigger flyTo, auto-clears after animation)
  flyToCloseUp: boolean;            // If true, zoom closer when flying to geometry

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
  setDrawnFeatures: (features: Feature[] | null) => void;
  addDrawnFeature: (feature: Feature) => void;
  removeLastFeature: () => void;
  setCurrentDrawType: (type: 'polygon' | 'line' | null) => void;
  setIsDrawingActive: (active: boolean) => void;
  clearDrawing: () => void;  // Clears drawnFeatures, currentDrawType, drawMode, and history
  clearFormState: () => void;
  triggerDrawAction: (action: 'finish' | 'undo' | 'cancel' | 'restore') => void;
  clearDrawAction: () => void;
  setShouldZoomToDrawing: (should: boolean) => void;

  // Unified editing history actions (for both drawing AND asset selection)
  saveEditSnapshot: () => void;           // Save current state with throttle
  undoEdit: () => void;                   // Undo - restores previous state (drawing + assets)
  redoEdit: () => void;                   // Redo - restores next state (drawing + assets)
  clearEditHistory: () => void;
  isUndoRedoInProgress: () => boolean;    // Check if undo/redo is in progress (to skip auto-save)

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
  setFlyToGeometry: (geometry: Geometry | null, closeUp?: boolean) => void;
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
  drawnFeatures: null,
  currentDrawType: null,
  drawAction: null,
  isDrawingActive: false,
  shouldZoomToDrawing: false,

  // Unified editing history
  editHistory: [],
  editRedoStack: [],
  _lastSnapshotTime: 0,
  _isUndoRedoInProgress: false,

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
  flyToGeometry: null,
  flyToCloseUp: false,

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
    drawnFeatures: null,
    currentDrawType: null,
    isDrawingActive: false,
    editHistory: [],
    editRedoStack: [],
    _lastSnapshotTime: 0,
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
  setDrawnFeatures: (features) => set({ drawnFeatures: features }),
  addDrawnFeature: (feature) => set((state) => ({
    drawnFeatures: state.drawnFeatures ? [...state.drawnFeatures, feature] : [feature],
  })),
  removeLastFeature: () => set((state) => {
    if (!state.drawnFeatures || state.drawnFeatures.length === 0) return state;
    const newFeatures = state.drawnFeatures.slice(0, -1);
    return {
      drawnFeatures: newFeatures.length > 0 ? newFeatures : null,
      // Unlock type if no features left
      currentDrawType: newFeatures.length > 0 ? state.currentDrawType : null,
    };
  }),
  setCurrentDrawType: (type) => set({ currentDrawType: type }),
  setIsDrawingActive: (active) => set({ isDrawingActive: active }),
  clearDrawing: () => set({
    drawnFeatures: null,
    currentDrawType: null,
    drawMode: null,
    isDrawingActive: false,
    editHistory: [],
    editRedoStack: [],
    _lastSnapshotTime: 0,
  }),
  clearFormState: () => set({
    selectedRoadAssetIdsForForm: [],
    previewGeometry: null,
    drawnFeatures: null,
    currentDrawType: null,
    drawMode: null,
    drawAction: null,
    isDrawingActive: false,
    shouldZoomToDrawing: false,
    editHistory: [],
    editRedoStack: [],
    _lastSnapshotTime: 0,
  }),
  triggerDrawAction: (action) => set({ drawAction: action }),
  clearDrawAction: () => set({ drawAction: null }),
  setShouldZoomToDrawing: (should) => set({ shouldZoomToDrawing: should }),

  // Unified editing history actions (for both drawing AND asset selection)
  saveEditSnapshot: () => set((state) => {
    // Skip if undo/redo just happened (to preserve redo stack)
    if (state._isUndoRedoInProgress) {
      return { _isUndoRedoInProgress: false }; // Reset flag but don't save
    }

    const now = Date.now();
    const THROTTLE_MS = 300;
    // Throttle to prevent too many snapshots during drag
    if (now - state._lastSnapshotTime < THROTTLE_MS) return state;

    // Create snapshot of both drawing AND asset selection state
    const snapshot: EditingStateSnapshot = {
      drawnFeatures: state.drawnFeatures
        ? JSON.parse(JSON.stringify(state.drawnFeatures))
        : null,
      currentDrawType: state.currentDrawType,
      selectedRoadAssetIds: [...state.selectedRoadAssetIdsForForm],
      assetDetailsCache: JSON.parse(JSON.stringify(state.selectedAssetDetailsCache)),
    };

    return {
      editHistory: [...state.editHistory, snapshot],
      editRedoStack: [],  // Clear redo on new action
      _lastSnapshotTime: now,
    };
  }),

  undoEdit: () => set((state) => {
    if (state.editHistory.length === 0) return state;

    const newHistory = [...state.editHistory];
    const previousState = newHistory.pop()!;

    // Create snapshot of current state for redo stack
    const currentSnapshot: EditingStateSnapshot = {
      drawnFeatures: state.drawnFeatures
        ? JSON.parse(JSON.stringify(state.drawnFeatures))
        : null,
      currentDrawType: state.currentDrawType,
      selectedRoadAssetIds: [...state.selectedRoadAssetIdsForForm],
      assetDetailsCache: JSON.parse(JSON.stringify(state.selectedAssetDetailsCache)),
    };

    return {
      editHistory: newHistory,
      editRedoStack: [currentSnapshot, ...state.editRedoStack],
      drawnFeatures: previousState.drawnFeatures,
      currentDrawType: previousState.currentDrawType,
      selectedRoadAssetIdsForForm: previousState.selectedRoadAssetIds,
      selectedAssetDetailsCache: previousState.assetDetailsCache,
      // Clear drawMode if no shapes left
      drawMode: previousState.drawnFeatures?.length ? state.drawMode : null,
      // Set flag to prevent saveEditSnapshot from clearing redo stack
      _isUndoRedoInProgress: true,
    };
  }),

  redoEdit: () => set((state) => {
    if (state.editRedoStack.length === 0) return state;

    const [nextState, ...remaining] = state.editRedoStack;

    // Create snapshot of current state for history
    const currentSnapshot: EditingStateSnapshot = {
      drawnFeatures: state.drawnFeatures
        ? JSON.parse(JSON.stringify(state.drawnFeatures))
        : null,
      currentDrawType: state.currentDrawType,
      selectedRoadAssetIds: [...state.selectedRoadAssetIdsForForm],
      assetDetailsCache: JSON.parse(JSON.stringify(state.selectedAssetDetailsCache)),
    };

    return {
      editRedoStack: remaining,
      editHistory: [...state.editHistory, currentSnapshot],
      drawnFeatures: nextState.drawnFeatures,
      currentDrawType: nextState.currentDrawType,
      selectedRoadAssetIdsForForm: nextState.selectedRoadAssetIds,
      selectedAssetDetailsCache: nextState.assetDetailsCache,
      // Set flag to prevent saveEditSnapshot from clearing redo stack
      _isUndoRedoInProgress: true,
    };
  }),

  clearEditHistory: () => set({
    editHistory: [],
    editRedoStack: [],
    _lastSnapshotTime: 0,
    _isUndoRedoInProgress: false,
  }),

  isUndoRedoInProgress: () => useUIStore.getState()._isUndoRedoInProgress,

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
  setFlyToGeometry: (geometry, closeUp = false) => set({ flyToGeometry: geometry, flyToCloseUp: closeUp }),
}));

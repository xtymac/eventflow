import { useEffect, useRef, useCallback, useState } from 'react';
import MapboxDraw from 'maplibre-gl-draw';
import maplibregl, { type Map as MapLibreMap } from 'maplibre-gl';
import type { Geometry, Feature } from 'geojson';
import { drawStyles } from '../styles/drawStyles';
import { useUIStore } from '../stores/uiStore';

type DrawModeType = 'polygon' | 'line' | 'point' | 'select' | null;

interface UseMapDrawOptions {
  onFeatureCreated?: (feature: Feature) => void;  // Called when a new feature is drawn
  onFeaturesChange?: (features: Feature[]) => void;  // Called when features are updated/deleted
  onDrawComplete?: () => void;
  onUserEdit?: () => void;  // Called on first user interaction after loading (vertex drag, new shape)
  initialGeometry?: Geometry | null;
  geometrySource?: 'auto' | 'manual';
  currentMode?: DrawModeType;
}

interface UseMapDrawReturn {
  setMode: (mode: DrawModeType) => void;
  deleteAll: () => void;
  deleteLastFeature: () => void;
  getAllFeatures: () => Feature[];
  isReady: boolean;
  // Touch-friendly methods
  finishDrawing: () => void;
  cancelDrawing: () => void;
  startAddAnother: () => void;  // Start drawing another shape without clearing
  isDrawing: boolean;
  // Restore features from store (for undo/redo)
  restoreFeatures: (features: Feature[] | null) => void;
  // Force draw control to re-render (mode cycle)
  forceRerender: () => void;
}

/**
 * Hook to manage MapLibre GL Draw integration.
 */
export function useMapDraw(
  map: MapLibreMap | null,
  isEnabled: boolean,
  mapLoaded: boolean,
  options?: UseMapDrawOptions
): UseMapDrawReturn {
  const drawRef = useRef<MapboxDraw | null>(null);
  const initialGeometryLoadedRef = useRef(false);
  // Track which geometry was loaded to allow reloading when geometry changes
  const loadedGeometryHashRef = useRef<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  // Flag to skip mode effect after draw.create (we handle mode change manually)
  const skipNextModeEffectRef = useRef(false);
  // Flag to indicate geometry is being loaded - prevents mode effect interference
  const isLoadingGeometryRef = useRef(false);
  // Track the last draw mode to re-enter when adding another shape
  const lastDrawModeRef = useRef<'polygon' | 'line' | null>(null);
  // Track previous features for undo (cached before update)
  const previousFeaturesRef = useRef<Feature[] | null>(null);
  // Flag to skip saving snapshot after restore (prevents duplicate snapshots)
  const skipNextSnapshotRef = useRef(false);
  // Store modechange handler ref for cleanup
  const modeChangeHandlerRef = useRef<((e: { mode: string }) => void) | null>(null);
  // Polling interval for waiting on draw control layer creation
  const drawInitIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Store callbacks in refs to avoid recreating handlers on every render
  const onFeatureCreatedRef = useRef(options?.onFeatureCreated);
  onFeatureCreatedRef.current = options?.onFeatureCreated;
  const onFeaturesChangeRef = useRef(options?.onFeaturesChange);
  onFeaturesChangeRef.current = options?.onFeaturesChange;
  const onDrawCompleteRef = useRef(options?.onDrawComplete);
  onDrawCompleteRef.current = options?.onDrawComplete;
  const onUserEditRef = useRef(options?.onUserEdit);
  onUserEditRef.current = options?.onUserEdit;
  // Track if we've already notified about user interaction (only notify once per edit session)
  const hasNotifiedUserEditRef = useRef(false);

  // Get all features from draw control
  const getAllFeatures = useCallback((): Feature[] => {
    if (!drawRef.current) return [];
    const data = drawRef.current.getAll();
    return data.features as Feature[];
  }, []);

  // Handle draw events - use refs to avoid dependency on options
  const handleDrawCreate = useCallback(() => {
    console.log('[useMapDraw] draw.create event');
    if (!drawRef.current) return;

    // Notify that user has started editing (first interaction after loading)
    if (!hasNotifiedUserEditRef.current) {
      hasNotifiedUserEditRef.current = true;
      console.log('[useMapDraw] First user edit detected (create), notifying');
      onUserEditRef.current?.();
    }

    // Save snapshot of current state BEFORE the new feature (for proper undo)
    // Note: saveEditSnapshot captures both drawing AND asset selection state
    useUIStore.getState().saveEditSnapshot();

    const data = drawRef.current.getAll();
    const allFeatures = data.features as Feature[];

    // Get the most recently created feature (last in the array)
    const newFeature = allFeatures[allFeatures.length - 1];
    if (newFeature) {
      console.log('[useMapDraw] New feature created:', newFeature.geometry?.type);
      // Notify about the new feature
      onFeatureCreatedRef.current?.(newFeature);
    }

    // Also notify about full features list change to trigger auto-intersection
    onFeaturesChangeRef.current?.(allFeatures);

    // Switch to direct_select mode for the new feature to allow vertex editing
    if (newFeature && newFeature.id) {
      const featureId = newFeature.id as string;
      console.log('[useMapDraw] Switching to direct_select for vertex editing, featureId:', featureId);

      // Skip the next mode effect since we're manually setting the mode
      skipNextModeEffectRef.current = true;

      // Use requestAnimationFrame to ensure mode switch happens after draw internals settle
      requestAnimationFrame(() => {
        try {
          // direct_select mode allows immediate vertex editing
          drawRef.current?.changeMode('direct_select', { featureId });
        } catch (e) {
          console.warn('Failed to switch to direct_select mode:', e);
          // Fallback to simple_select
          try {
            drawRef.current?.changeMode('simple_select');
          } catch (e2) {
            console.warn('Fallback to simple_select also failed:', e2);
          }
        }
      });

      setIsDrawing(false);
      // Notify that drawing is complete so UI can update
      onDrawCompleteRef.current?.();
    }
  }, []);

  const handleDrawUpdate = useCallback(() => {
    // Ignore draw.update events during initial geometry loading
    // MapLibre GL Draw may fire update events when entering direct_select mode
    if (isLoadingGeometryRef.current) {
      console.log('[useMapDraw] draw.update event IGNORED (geometry is loading)');
      return;
    }

    console.log('[useMapDraw] draw.update event, previousFeaturesRef:', previousFeaturesRef.current ? 'set' : 'null', 'skipNextSnapshot:', skipNextSnapshotRef.current);

    // Notify that user has started editing (first interaction after loading)
    if (!hasNotifiedUserEditRef.current) {
      hasNotifiedUserEditRef.current = true;
      console.log('[useMapDraw] First user edit detected, notifying');
      onUserEditRef.current?.();
    }

    // Only save history if we have a cached previous state AND we're not skipping (after restore)
    if (previousFeaturesRef.current && !skipNextSnapshotRef.current) {
      // Use unified saveEditSnapshot which captures both drawing AND asset selection state
      useUIStore.getState().saveEditSnapshot();
      console.log('[useMapDraw] Saved edit snapshot');
    }

    // Clear the skip flag after first update (whether we saved or not)
    if (skipNextSnapshotRef.current) {
      console.log('[useMapDraw] Skipped snapshot save (after restore)');
      skipNextSnapshotRef.current = false;
    }

    // Always update previousFeaturesRef with current state for next update
    // This ensures consecutive modifications are tracked
    const allFeatures = getAllFeatures();
    if (allFeatures && allFeatures.length > 0) {
      previousFeaturesRef.current = JSON.parse(JSON.stringify(allFeatures));
    } else {
      previousFeaturesRef.current = null;
    }

    onFeaturesChangeRef.current?.(allFeatures);
  }, [getAllFeatures]);

  const handleDrawDelete = useCallback(() => {
    console.log('[useMapDraw] draw.delete event');
    const allFeatures = getAllFeatures();
    onFeaturesChangeRef.current?.(allFeatures);
  }, [getAllFeatures]);

  // Initialize/cleanup draw control
  useEffect(() => {
    if (!map || !mapLoaded) {
      return;
    }

    if (isEnabled && !drawRef.current) {
      console.log('[useMapDraw] Initializing draw control');
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: {},
        defaultMode: 'simple_select',
        styles: drawStyles,
      });

      map.addControl(draw as unknown as maplibregl.IControl);
      drawRef.current = draw;
      console.log('[useMapDraw] Draw control added to map');

      // Add event listeners
      map.on('draw.create', handleDrawCreate);
      map.on('draw.update', handleDrawUpdate);
      map.on('draw.delete', handleDrawDelete);

      // Cache state when entering edit mode (for undo on update)
      const handleModeChange = (e: { mode: string }) => {
        // When entering direct_select or simple_select, cache current state
        if (e.mode === 'direct_select' || e.mode === 'simple_select') {
          const currentFeatures = drawRef.current?.getAll().features as Feature[] | undefined;
          if (currentFeatures && currentFeatures.length > 0) {
            previousFeaturesRef.current = JSON.parse(JSON.stringify(currentFeatures));
          }
        }
      };
      modeChangeHandlerRef.current = handleModeChange;
      map.on('draw.modechange', handleModeChange);

      initialGeometryLoadedRef.current = false;
      hasNotifiedUserEditRef.current = false;

      // maplibre-gl-draw defers layer creation if map.loaded() is false (during flyTo, etc.).
      // Its internal code does: map.on("load", setup.connect) + 16ms polling for map.loaded().
      // If tiles never finish loading, connect() never fires and layers never exist.
      // Fix: fire 'load' on the map to force the draw library's deferred connect().
      if (map.getSource('mapbox-gl-draw-hot')) {
        console.log('[useMapDraw] Draw layers ready immediately');
        setIsReady(true);
      } else {
        // Force the draw library to create its layers by triggering the 'load' event
        // that its deferred connect() is listening for. This is safe because:
        // 1. connect() removes the listener and clears its interval (idempotent)
        // 2. addLayers() checks if sources exist before adding (idempotent)
        // 3. The map's internal loaded() state is unaffected by firing this event
        console.log('[useMapDraw] Draw layers deferred, forcing connect via load event');
        map.fire('load');

        if (map.getSource('mapbox-gl-draw-hot')) {
          console.log('[useMapDraw] Draw layers created after forced load');
          setIsReady(true);
        } else {
          // Fallback: poll briefly in case fire('load') was async
          console.log('[useMapDraw] Draw layers still missing, polling...');
          drawInitIntervalRef.current = setInterval(() => {
            if (map.getSource('mapbox-gl-draw-hot')) {
              console.log('[useMapDraw] Draw layers now ready');
              if (drawInitIntervalRef.current) {
                clearInterval(drawInitIntervalRef.current);
                drawInitIntervalRef.current = null;
              }
              setIsReady(true);
            }
          }, 50);
        }
      }
    } else if (!isEnabled && drawRef.current) {
      console.log('[useMapDraw] Cleaning up draw control');
      if (drawInitIntervalRef.current) {
        clearInterval(drawInitIntervalRef.current);
        drawInitIntervalRef.current = null;
      }
      map.off('draw.create', handleDrawCreate);
      map.off('draw.update', handleDrawUpdate);
      map.off('draw.delete', handleDrawDelete);
      if (modeChangeHandlerRef.current) {
        map.off('draw.modechange', modeChangeHandlerRef.current);
        modeChangeHandlerRef.current = null;
      }

      try {
        map.removeControl(drawRef.current as unknown as maplibregl.IControl);
      } catch (e) {
        // Control might already be removed
      }
      drawRef.current = null;
      initialGeometryLoadedRef.current = false;
      isLoadingGeometryRef.current = false;
      setIsReady(false);
    }

    return () => {
      if (drawInitIntervalRef.current) {
        clearInterval(drawInitIntervalRef.current);
        drawInitIntervalRef.current = null;
      }
      if (drawRef.current && map) {
        map.off('draw.create', handleDrawCreate);
        map.off('draw.update', handleDrawUpdate);
        map.off('draw.delete', handleDrawDelete);
        if (modeChangeHandlerRef.current) {
          map.off('draw.modechange', modeChangeHandlerRef.current);
          modeChangeHandlerRef.current = null;
        }

        try {
          map.removeControl(drawRef.current as unknown as maplibregl.IControl);
        } catch (e) {
          // Control might already be removed
        }
        drawRef.current = null;
        isLoadingGeometryRef.current = false;
        setIsReady(false);
      }
    };
  }, [map, mapLoaded, isEnabled, handleDrawCreate, handleDrawUpdate, handleDrawDelete]);

  // Apply currentMode when it changes
  useEffect(() => {
    if (!drawRef.current || !isEnabled || !isReady) {
      return;
    }

    const mode = options?.currentMode;

    // Skip if we just handled draw.create/restore and mode is still select
    if (skipNextModeEffectRef.current) {
      if (mode === null || mode === 'select' || mode === undefined) {
        console.log('[useMapDraw] Skipping mode effect (handled by manual mode change)');
        skipNextModeEffectRef.current = false;
        return;
      }
      // Explicit draw mode requested - honor it
      skipNextModeEffectRef.current = false;
    }

    // Skip if geometry is currently being loaded (prevents race conditions)
    if (isLoadingGeometryRef.current) {
      console.log('[useMapDraw] Skipping mode effect (geometry is loading)');
      return;
    }
    const existingFeatures = drawRef.current.getAll();
    console.log('[useMapDraw] Applying mode:', mode, 'existing features:', existingFeatures.features.length);

    try {
      switch (mode) {
        case 'polygon':
          lastDrawModeRef.current = 'polygon';
          drawRef.current.changeMode('draw_polygon');
          break;
        case 'line':
          lastDrawModeRef.current = 'line';
          drawRef.current.changeMode('draw_line_string');
          break;
        case 'point':
          drawRef.current.changeMode('draw_point');
          break;
        case 'select':
        case null:
        default:
          // When switching to select mode with existing features, enter direct_select
          // to allow immediate vertex editing on the last feature
          const data = drawRef.current.getAll();
          const currentMode = drawRef.current.getMode();

          // Don't change mode if already in direct_select with features (prevents React StrictMode double-run issues)
          if (currentMode === 'direct_select' && data.features.length > 0) {
            console.log('[useMapDraw] Mode effect: already in direct_select with features, skipping');
            break;
          }

          if (data.features.length > 0) {
            const lastFeature = data.features[data.features.length - 1];
            if (lastFeature.id) {
              drawRef.current.changeMode('direct_select', { featureId: lastFeature.id as string });
              console.log('[useMapDraw] Mode effect: entered direct_select for feature:', lastFeature.id);
            } else {
              drawRef.current.changeMode('simple_select');
              console.log('[useMapDraw] Mode effect: entered simple_select (no feature id)');
            }
          } else {
            drawRef.current.changeMode('simple_select');
            console.log('[useMapDraw] Mode effect: entered simple_select (no features)');
          }
          break;
      }
      // Log final mode
      console.log('[useMapDraw] Mode effect: final mode is', drawRef.current.getMode());
    } catch (e) {
      console.warn('Failed to change draw mode:', e);
    }
  }, [isEnabled, isReady, options?.currentMode]);

  // Load initial geometry for editing (supports Multi* by splitting into individual features)
  useEffect(() => {
    // Compute hash of current geometry to detect changes
    const currentGeometryHash = options?.initialGeometry ? JSON.stringify(options.initialGeometry) : null;

    // Check if we need to load: either never loaded, or geometry changed
    const needsLoad = !initialGeometryLoadedRef.current ||
      (currentGeometryHash !== null && currentGeometryHash !== loadedGeometryHashRef.current);

    const effectiveGeometrySource = options?.geometrySource ?? 'manual';

    console.log('[useMapDraw] initialGeometry effect:', {
      hasDrawRef: !!drawRef.current,
      isEnabled,
      isReady,
      hasInitialGeometry: !!options?.initialGeometry,
      geometrySource: options?.geometrySource,
      effectiveGeometrySource,
      needsLoad,
      initialGeometryLoaded: initialGeometryLoadedRef.current,
      geometryHashChanged: currentGeometryHash !== loadedGeometryHashRef.current,
    });

    if (
      drawRef.current &&
      isEnabled &&
      isReady &&
      options?.initialGeometry &&
      effectiveGeometrySource === 'manual' &&
      needsLoad
    ) {
      drawRef.current.deleteAll();

      const geometry = options.initialGeometry;
      if (!geometry) return;

      const featuresToAdd: Feature[] = [];

      // Split Multi* geometries into individual features
      if (geometry.type === 'MultiPolygon') {
        lastDrawModeRef.current = 'polygon';
        for (const coords of geometry.coordinates) {
          featuresToAdd.push({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: coords },
            properties: {},
          });
        }
      } else if (geometry.type === 'MultiLineString') {
        lastDrawModeRef.current = 'line';
        for (const coords of geometry.coordinates) {
          featuresToAdd.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: coords },
            properties: {},
          });
        }
      } else if (geometry.type === 'GeometryCollection') {
        // Handle GeometryCollection by adding each geometry
        for (const geom of geometry.geometries) {
          featuresToAdd.push({
            type: 'Feature',
            geometry: geom,
            properties: {},
          });
        }
        // Set lastDrawModeRef based on first geometry type
        if (geometry.geometries.length > 0) {
          const firstType = geometry.geometries[0].type;
          lastDrawModeRef.current = firstType === 'Polygon' ? 'polygon' : 'line';
        }
      } else {
        // Single geometry (Polygon, LineString, etc.)
        featuresToAdd.push({
          type: 'Feature',
          geometry: geometry,
          properties: {},
        });
        lastDrawModeRef.current = geometry.type === 'Polygon' ? 'polygon' : 'line';
      }

      try {
        // Set loading flag to prevent mode effect interference
        isLoadingGeometryRef.current = true;

        let lastFeatureId: string | undefined;
        for (const feature of featuresToAdd) {
          const ids = drawRef.current!.add(feature);
          if (ids && ids.length > 0) {
            lastFeatureId = ids[0];
          }
        }

        // Skip the next mode effect since we're manually setting the mode
        // This prevents the mode effect from interfering with the loaded features
        skipNextModeEffectRef.current = true;

        initialGeometryLoadedRef.current = true;
        loadedGeometryHashRef.current = currentGeometryHash;
        console.log('[useMapDraw] Loaded', featuresToAdd.length, 'features for editing');

        // Enter direct_select IMMEDIATELY so the polygon is visible right away
        // (active polygon has higher fill opacity than inactive)
        if (lastFeatureId) {
          try {
            drawRef.current!.changeMode('direct_select', { featureId: lastFeatureId });
            console.log('[useMapDraw] Loaded features: entered direct_select for feature:', lastFeatureId);
          } catch (e) {
            console.warn('[useMapDraw] Failed to enter direct_select after load:', e);
            drawRef.current!.changeMode('simple_select');
          }
        } else {
          drawRef.current!.changeMode('simple_select');
        }

        // Force map to repaint to ensure the polygon is rendered
        if (map) {
          map.triggerRepaint();
        }

        // Cache initial state so first edit can be undone
        // Note: Programmatic changeMode doesn't trigger draw.modechange, so we must set this manually
        previousFeaturesRef.current = JSON.parse(JSON.stringify(featuresToAdd));
        console.log('[useMapDraw] Initial load: cached previousFeaturesRef with', featuresToAdd.length, 'features');

        // Clear loading flag after a short delay to cover any async draw.update events
        // that MapLibre GL Draw may fire when entering direct_select mode
        setTimeout(() => {
          isLoadingGeometryRef.current = false;
        }, 100);

        // Notify about loaded features so MapView can update store (including currentDrawType)
        // Do this AFTER entering direct_select so the polygon is already visible
        onFeaturesChangeRef.current?.(featuresToAdd);
      } catch (e) {
        console.warn('Failed to load initial geometry into draw:', e);
        isLoadingGeometryRef.current = false;
      }
    }
  }, [map, isEnabled, isReady, options?.initialGeometry, options?.geometrySource]);

  const setMode = useCallback((mode: DrawModeType) => {
    if (!drawRef.current) return;

    try {
      switch (mode) {
        case 'polygon':
          lastDrawModeRef.current = 'polygon';
          drawRef.current.changeMode('draw_polygon');
          break;
        case 'line':
          lastDrawModeRef.current = 'line';
          drawRef.current.changeMode('draw_line_string');
          break;
        case 'point':
          drawRef.current.changeMode('draw_point');
          break;
        case 'select':
        case null:
          drawRef.current.changeMode('simple_select');
          break;
      }
    } catch (e) {
      console.warn('Failed to change draw mode:', e);
    }
  }, []);

  const deleteAll = useCallback(() => {
    if (!drawRef.current) return;

    try {
      drawRef.current.deleteAll();
      onFeaturesChangeRef.current?.([]);
    } catch (e) {
      console.warn('Failed to delete all features:', e);
    }
  }, []);

  const deleteLastFeature = useCallback(() => {
    if (!drawRef.current) return;

    try {
      const data = drawRef.current.getAll();
      if (data.features.length === 0) return;

      // Delete the last feature
      const lastFeature = data.features[data.features.length - 1];
      if (lastFeature.id) {
        drawRef.current.delete(lastFeature.id as string);
      }

      // Notify about remaining features
      const remainingFeatures = getAllFeatures();
      onFeaturesChangeRef.current?.(remainingFeatures);

      // If there are remaining features, select the new last one
      if (remainingFeatures.length > 0) {
        const newLastFeature = remainingFeatures[remainingFeatures.length - 1];
        if (newLastFeature.id) {
          drawRef.current.changeMode('direct_select', { featureId: newLastFeature.id as string });
        }
      } else {
        drawRef.current.changeMode('simple_select');
      }
    } catch (e) {
      console.warn('Failed to delete last feature:', e);
    }
  }, [getAllFeatures]);

  // Touch-friendly methods
  const finishDrawing = useCallback(() => {
    if (!drawRef.current) return;

    console.log('[useMapDraw] finishDrawing called');
    try {
      const data = drawRef.current.getAll();

      // Validate minimum points for the current drawing
      if (data.features.length > 0) {
        const lastFeature = data.features[data.features.length - 1];
        const geom = lastFeature.geometry;

        if (geom) {
          if (geom.type === 'Polygon') {
            // Polygon needs at least 4 points (3 vertices + closing point)
            const coords = geom.coordinates[0];
            if (!coords || coords.length < 4) {
              console.warn('[useMapDraw] Polygon needs at least 3 vertices to complete');
              return; // Don't finish, keep drawing
            }
          } else if (geom.type === 'LineString') {
            // Line needs at least 2 points
            const coords = geom.coordinates;
            if (!coords || coords.length < 2) {
              console.warn('[useMapDraw] Line needs at least 2 points to complete');
              return; // Don't finish, keep drawing
            }
          }
        }
      }

      // Skip the next mode effect since we're manually setting the mode
      skipNextModeEffectRef.current = true;

      // Switch to direct_select for immediate vertex editing on the last feature
      if (data.features.length > 0) {
        const lastFeature = data.features[data.features.length - 1];
        if (lastFeature.id) {
          drawRef.current.changeMode('direct_select', { featureId: lastFeature.id as string });
        } else {
          drawRef.current.changeMode('simple_select');
        }
      } else {
        drawRef.current.changeMode('simple_select');
      }
      setIsDrawing(false);
      onDrawCompleteRef.current?.();
    } catch (e) {
      console.warn('Failed to finish drawing:', e);
    }
  }, []);

  const cancelDrawing = useCallback(() => {
    if (!drawRef.current) return;

    console.log('[useMapDraw] cancelDrawing called');
    try {
      drawRef.current.deleteAll();
      drawRef.current.changeMode('simple_select');
      setIsDrawing(false);
      onFeaturesChangeRef.current?.([]);
    } catch (e) {
      console.warn('Failed to cancel drawing:', e);
    }
  }, []);

  // Start drawing another shape without clearing existing ones
  const startAddAnother = useCallback(() => {
    if (!drawRef.current) return;

    console.log('[useMapDraw] startAddAnother called, lastDrawMode:', lastDrawModeRef.current);
    try {
      // Re-enter the last draw mode
      if (lastDrawModeRef.current === 'polygon') {
        drawRef.current.changeMode('draw_polygon');
        setIsDrawing(true);
      } else if (lastDrawModeRef.current === 'line') {
        drawRef.current.changeMode('draw_line_string');
        setIsDrawing(true);
      } else {
        console.warn('No last draw mode to resume');
      }
    } catch (e) {
      console.warn('Failed to start adding another shape:', e);
    }
  }, []);

  // Track drawing state based on mode changes
  useEffect(() => {
    const mode = options?.currentMode;
    setIsDrawing(mode === 'polygon' || mode === 'line' || mode === 'point');
  }, [options?.currentMode]);

  // Restore features from store (for undo/redo)
  const restoreFeatures = useCallback((features: Feature[] | null) => {
    if (!drawRef.current) return;

    console.log('[useMapDraw] restoreFeatures called with', features?.length ?? 0, 'features');

    // Set loading flag to prevent mode effect interference
    isLoadingGeometryRef.current = true;

    try {
      // Clear draw canvas
      drawRef.current.deleteAll();

      // Re-add features from store
      if (features && features.length > 0) {
        let lastAddedId: string | undefined;

        for (const feature of features) {
          // add() returns an array of assigned IDs
          const addedIds = drawRef.current.add(feature);
          if (addedIds && addedIds.length > 0) {
            lastAddedId = addedIds[0];
          }
        }

        // Skip the next mode effect since we're manually setting the mode
        // This prevents the mode effect from interfering with the restored features
        skipNextModeEffectRef.current = true;

        // Enter direct_select IMMEDIATELY so the polygon is visible right away
        if (lastAddedId) {
          try {
            drawRef.current.changeMode('direct_select', { featureId: lastAddedId });
            console.log('[useMapDraw] restoreFeatures: entered direct_select for feature:', lastAddedId);
          } catch (modeError) {
            console.warn('[useMapDraw] Failed to enter direct_select, using simple_select:', modeError);
            drawRef.current.changeMode('simple_select');
          }
        } else {
          drawRef.current.changeMode('simple_select');
        }

        // Force map to repaint to ensure the polygon is rendered
        if (map) {
          map.triggerRepaint();
        }

        // Cache restored state so the NEXT edit can be undone
        // Also set skip flag to prevent duplicate snapshot (the restored state was already in history)
        const restoredFeatures = drawRef.current.getAll().features as Feature[];
        previousFeaturesRef.current = JSON.parse(JSON.stringify(restoredFeatures));
        skipNextSnapshotRef.current = true;  // Don't save duplicate snapshot on next update
        console.log('[useMapDraw] restoreFeatures: cached previousFeaturesRef with', restoredFeatures.length, 'features, skipNextSnapshot=true');

        // Delay clearing loading flag to suppress draw.update events
        // that fire asynchronously after changeMode('direct_select')
        setTimeout(() => {
          isLoadingGeometryRef.current = false;
        }, 100);
      } else {
        // No features - go to simple_select
        drawRef.current.changeMode('simple_select');
        previousFeaturesRef.current = null;
        skipNextSnapshotRef.current = false;
        isLoadingGeometryRef.current = false;
      }
    } catch (e) {
      console.warn('Failed to restore features:', e);
      isLoadingGeometryRef.current = false;
    }
  }, [map]);

  // Force the draw control to re-render by:
  // 1. Deleting and re-adding all features (clean source pipeline)
  // 2. Moving draw layers to top of layer stack (fix z-ordering)
  // 3. Entering direct_select mode (feature in HOT source = active)
  const forceRerender = useCallback(() => {
    if (!drawRef.current || !map) return;

    const data = drawRef.current.getAll();
    const features = data.features as Feature[];
    if (features.length === 0) return;

    console.log('[useMapDraw] forceRerender: delete+re-add+moveLayer, features:', features.length);

    // Suppress mode effect and draw.update events during re-render
    isLoadingGeometryRef.current = true;
    skipNextModeEffectRef.current = true;

    // Deep copy features before deleting (remove IDs so draw assigns fresh ones)
    const featuresCopy: Feature[] = JSON.parse(JSON.stringify(features));
    for (const f of featuresCopy) {
      delete (f as { id?: string | number }).id;
    }

    // Delete all features from draw control
    drawRef.current.deleteAll();

    // Wait one animation frame for the deletion to be processed by MapLibre's renderer,
    // then re-add features. This forces a clean source update in the draw pipeline.
    requestAnimationFrame(() => {
      if (!drawRef.current) {
        isLoadingGeometryRef.current = false;
        return;
      }

      let lastId: string | undefined;
      for (const feature of featuresCopy) {
        const ids = drawRef.current.add(feature);
        if (ids && ids.length > 0) {
          lastId = ids[0];
        }
      }

      // Enter direct_select so the polygon is visible (active state in HOT source)
      if (lastId) {
        try {
          skipNextModeEffectRef.current = true;
          drawRef.current.changeMode('direct_select', { featureId: lastId });
          console.log('[useMapDraw] forceRerender: re-added features, direct_select for:', lastId);
        } catch (e) {
          console.warn('[useMapDraw] forceRerender: direct_select failed:', e);
          try { drawRef.current.changeMode('simple_select'); } catch {}
        }
      }

      // Move all draw layers to the top of the layer stack.
      // maplibre-gl-draw creates layers with .cold and .hot suffixes for each style.
      // COLD layers first (inactive features), then HOT on top (active features).
      const baseIds = [
        'gl-draw-polygon-fill-inactive',
        'gl-draw-polygon-fill-active',
        'gl-draw-polygon-stroke-inactive',
        'gl-draw-polygon-stroke-active',
        'gl-draw-line-inactive',
        'gl-draw-line-active',
        'gl-draw-vertex-active',
        'gl-draw-vertex-selected',
        'gl-draw-midpoint',
        'gl-draw-point-inactive',
        'gl-draw-point-active',
      ];
      // Move cold layers first, then hot layers on top
      for (const id of baseIds) {
        try { map.moveLayer(`${id}.cold`); } catch {}
      }
      for (const id of baseIds) {
        try { map.moveLayer(`${id}.hot`); } catch {}
      }

      // Update previousFeaturesRef with the new feature references (new IDs)
      const newFeatures = drawRef.current.getAll().features as Feature[];
      if (newFeatures.length > 0) {
        previousFeaturesRef.current = JSON.parse(JSON.stringify(newFeatures));
      }

      // Trigger map repaint and clear loading flag
      map.triggerRepaint();
      setTimeout(() => {
        isLoadingGeometryRef.current = false;
      }, 50);
    });
  }, [map]);

  return {
    setMode,
    deleteAll,
    deleteLastFeature,
    getAllFeatures,
    isReady,
    finishDrawing,
    cancelDrawing,
    startAddAnother,
    isDrawing,
    restoreFeatures,
    forceRerender,
  };
}

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
  const [isReady, setIsReady] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  // Flag to skip mode effect after draw.create (we handle mode change manually)
  const skipNextModeEffectRef = useRef(false);
  // Track the last draw mode to re-enter when adding another shape
  const lastDrawModeRef = useRef<'polygon' | 'line' | null>(null);
  // Track previous features for undo (cached before update)
  const previousFeaturesRef = useRef<Feature[] | null>(null);
  // Store modechange handler ref for cleanup
  const modeChangeHandlerRef = useRef<((e: { mode: string }) => void) | null>(null);

  // Store callbacks in refs to avoid recreating handlers on every render
  const onFeatureCreatedRef = useRef(options?.onFeatureCreated);
  onFeatureCreatedRef.current = options?.onFeatureCreated;
  const onFeaturesChangeRef = useRef(options?.onFeaturesChange);
  onFeaturesChangeRef.current = options?.onFeaturesChange;
  const onDrawCompleteRef = useRef(options?.onDrawComplete);
  onDrawCompleteRef.current = options?.onDrawComplete;

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
    console.log('[useMapDraw] draw.update event');

    // Only save history if we have a cached previous state (from modechange)
    if (previousFeaturesRef.current) {
      // Use unified saveEditSnapshot which captures both drawing AND asset selection state
      useUIStore.getState().saveEditSnapshot();
      previousFeaturesRef.current = null;  // Clear cache
    }

    const allFeatures = getAllFeatures();
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
      setIsReady(true);
    } else if (!isEnabled && drawRef.current) {
      console.log('[useMapDraw] Cleaning up draw control');
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
      setIsReady(false);
    }

    return () => {
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
        setIsReady(false);
      }
    };
  }, [map, mapLoaded, isEnabled, handleDrawCreate, handleDrawUpdate, handleDrawDelete]);

  // Apply currentMode when it changes
  useEffect(() => {
    if (!drawRef.current || !isEnabled || !isReady) {
      return;
    }

    // Skip if we just handled draw.create (we already set the mode manually)
    if (skipNextModeEffectRef.current) {
      console.log('[useMapDraw] Skipping mode effect (handled by draw.create)');
      skipNextModeEffectRef.current = false;
      return;
    }

    const mode = options?.currentMode;
    console.log('[useMapDraw] Applying mode:', mode);

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
          break;
      }
    } catch (e) {
      console.warn('Failed to change draw mode:', e);
    }
  }, [isEnabled, isReady, options?.currentMode]);

  // Load initial geometry for editing (supports Multi* by splitting into individual features)
  useEffect(() => {
    if (
      drawRef.current &&
      isEnabled &&
      isReady &&
      options?.initialGeometry &&
      options?.geometrySource === 'manual' &&
      !initialGeometryLoadedRef.current
    ) {
      drawRef.current.deleteAll();

      const geometry = options.initialGeometry;
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
        let lastFeatureId: string | undefined;
        for (const feature of featuresToAdd) {
          const ids = drawRef.current.add(feature);
          if (ids && ids.length > 0) {
            lastFeatureId = ids[0];
          }
        }

        // Use direct_select for immediate vertex editing on the last feature
        if (lastFeatureId) {
          drawRef.current.changeMode('direct_select', { featureId: lastFeatureId });
        } else {
          drawRef.current.changeMode('simple_select');
        }
        initialGeometryLoadedRef.current = true;
        console.log('[useMapDraw] Loaded', featuresToAdd.length, 'features for editing');

        // Notify about loaded features so MapView can update store (including currentDrawType)
        onFeaturesChangeRef.current?.(featuresToAdd);
      } catch (e) {
        console.warn('Failed to load initial geometry into draw:', e);
      }
    }
  }, [isEnabled, isReady, options?.initialGeometry, options?.geometrySource]);

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

    try {
      // Clear draw canvas
      drawRef.current.deleteAll();

      // Re-add features from store
      if (features && features.length > 0) {
        for (const feature of features) {
          drawRef.current.add(feature);
        }
        // Select the last feature for editing
        const lastId = features[features.length - 1].id;
        if (lastId) {
          drawRef.current.changeMode('direct_select', { featureId: lastId as string });
        }
      } else {
        // No features - go to simple_select
        drawRef.current.changeMode('simple_select');
      }
    } catch (e) {
      console.warn('Failed to restore features:', e);
    }
  }, []);

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
  };
}

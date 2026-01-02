import { useEffect, useRef, useCallback } from 'react';
import MapboxDraw from 'maplibre-gl-draw';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { Geometry, Feature } from 'geojson';
import { drawStyles } from '../styles/drawStyles';

type DrawModeType = 'polygon' | 'line' | 'select' | null;

interface UseMapDrawOptions {
  onGeometryChange?: (geometry: Geometry | null) => void;
  initialGeometry?: Geometry | null;
  geometrySource?: 'auto' | 'manual';
}

interface UseMapDrawReturn {
  setMode: (mode: DrawModeType) => void;
  deleteAll: () => void;
  getGeometry: () => Geometry | null;
}

/**
 * Hook to manage MapLibre GL Draw integration.
 *
 * - Initializes/cleans up draw control based on isEnabled
 * - Listens for draw.create, draw.update, draw.delete events
 * - Syncs drawn geometry via onGeometryChange callback
 * - Loads initial geometry when editing (only for manual geometrySource)
 */
export function useMapDraw(
  map: MapLibreMap | null,
  isEnabled: boolean,
  mapLoaded: boolean,
  options?: UseMapDrawOptions
): UseMapDrawReturn {
  const drawRef = useRef<MapboxDraw | null>(null);
  const initialGeometryLoadedRef = useRef(false);

  // Extract geometry from draw features
  const extractGeometry = useCallback((): Geometry | null => {
    if (!drawRef.current) return null;

    const data = drawRef.current.getAll();
    if (!data.features || data.features.length === 0) return null;

    // Get the first feature's geometry
    const feature = data.features[0];
    return feature.geometry as Geometry;
  }, []);

  // Handle draw events
  const handleDrawCreate = useCallback(() => {
    const geometry = extractGeometry();
    options?.onGeometryChange?.(geometry);
  }, [extractGeometry, options]);

  const handleDrawUpdate = useCallback(() => {
    const geometry = extractGeometry();
    options?.onGeometryChange?.(geometry);
  }, [extractGeometry, options]);

  const handleDrawDelete = useCallback(() => {
    options?.onGeometryChange?.(null);
  }, [options]);

  // Initialize/cleanup draw control
  useEffect(() => {
    if (!map || !mapLoaded) return;

    if (isEnabled && !drawRef.current) {
      // Initialize draw control
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: {},
        defaultMode: 'simple_select',
        styles: drawStyles,
      });

      map.addControl(draw);
      drawRef.current = draw;

      // Add event listeners
      map.on('draw.create', handleDrawCreate);
      map.on('draw.update', handleDrawUpdate);
      map.on('draw.delete', handleDrawDelete);

      // Reset the initial geometry loaded flag when draw is initialized
      initialGeometryLoadedRef.current = false;
    } else if (!isEnabled && drawRef.current) {
      // Cleanup draw control
      map.off('draw.create', handleDrawCreate);
      map.off('draw.update', handleDrawUpdate);
      map.off('draw.delete', handleDrawDelete);

      try {
        map.removeControl(drawRef.current);
      } catch (e) {
        // Control might already be removed
      }
      drawRef.current = null;
      initialGeometryLoadedRef.current = false;
    }

    return () => {
      // Cleanup on unmount
      if (drawRef.current && map) {
        map.off('draw.create', handleDrawCreate);
        map.off('draw.update', handleDrawUpdate);
        map.off('draw.delete', handleDrawDelete);

        try {
          map.removeControl(drawRef.current);
        } catch (e) {
          // Control might already be removed
        }
        drawRef.current = null;
      }
    };
  }, [map, mapLoaded, isEnabled, handleDrawCreate, handleDrawUpdate, handleDrawDelete]);

  // Load initial geometry for editing (only when geometrySource is 'manual')
  useEffect(() => {
    if (
      drawRef.current &&
      isEnabled &&
      options?.initialGeometry &&
      options?.geometrySource === 'manual' &&
      !initialGeometryLoadedRef.current
    ) {
      // Clear any existing features
      drawRef.current.deleteAll();

      // Add the initial geometry as a feature
      const feature: Feature = {
        type: 'Feature',
        geometry: options.initialGeometry,
        properties: {},
      };

      try {
        drawRef.current.add(feature);
        // Switch to select mode to allow editing vertices
        drawRef.current.changeMode('simple_select');
        initialGeometryLoadedRef.current = true;
      } catch (e) {
        console.warn('Failed to load initial geometry into draw:', e);
      }
    }
  }, [isEnabled, options?.initialGeometry, options?.geometrySource]);

  // Set drawing mode
  const setMode = useCallback((mode: DrawModeType) => {
    if (!drawRef.current) return;

    try {
      switch (mode) {
        case 'polygon':
          drawRef.current.changeMode('draw_polygon');
          break;
        case 'line':
          drawRef.current.changeMode('draw_line_string');
          break;
        case 'select':
          drawRef.current.changeMode('simple_select');
          break;
        case null:
          drawRef.current.changeMode('simple_select');
          break;
      }
    } catch (e) {
      console.warn('Failed to change draw mode:', e);
    }
  }, []);

  // Delete all drawn features
  const deleteAll = useCallback(() => {
    if (!drawRef.current) return;

    try {
      drawRef.current.deleteAll();
      options?.onGeometryChange?.(null);
    } catch (e) {
      console.warn('Failed to delete all features:', e);
    }
  }, [options]);

  // Get current geometry
  const getGeometry = useCallback((): Geometry | null => {
    return extractGeometry();
  }, [extractGeometry]);

  return {
    setMode,
    deleteAll,
    getGeometry,
  };
}

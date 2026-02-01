import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Stack,
  TextInput,
  Select,
  Button,
  Group,
  Text,
  Divider,
  Alert,
  ActionIcon,
  Badge,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconAlertCircle, IconPolygon, IconLine, IconArrowBack, IconArrowForward, IconEraser, IconFocus2, IconRefresh } from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { useForm, Controller } from 'react-hook-form';
import * as turf from '@turf/turf';
// Phase 0: Road-Event linking disabled - Road editing is frozen
// import { AdvancedRoadAssetSelector } from './AdvancedRoadAssetSelector';
// Still needed for legacy code paths in effects
import { getRoadAssetLabel } from '../../utils/roadAssetLabel';
import { generateCorridorGeometry } from '../../utils/geometryGenerator';
import { geometryToFeatures, getDrawTypeFromGeometry } from '../../utils/geometryToFeatures';
import { useUIStore } from '../../stores/uiStore';
import {
  useCreateEvent,
  useUpdateEvent,
  useEvent,
  useAssets,
  useEventIntersectingAssets,
} from '../../hooks/useApi';
import type { RestrictionType, SupportedGeometry } from '@nagoya/shared';

interface EventFormProps {
  eventId?: string | null;
  onClose: () => void;
}

const RESTRICTION_TYPES: { value: RestrictionType; label: string }[] = [
  { value: 'full', label: 'Full Closure' },
  { value: 'partial', label: 'Partial Restriction' },
  { value: 'workzone', label: 'Work Zone' },
];

interface EventFormData {
  name: string;
  startDate: Date | null;
  endDate: Date | null;
  restrictionType: RestrictionType;
  department: string;
  ward: string;
  selectedRoadAssetIds: string[];
}

const defaultValues: EventFormData = {
  name: '',
  startDate: null,
  endDate: null,
  restrictionType: 'partial',
  department: '',
  ward: '',
  selectedRoadAssetIds: [],
};

export function EventForm({ eventId, onClose }: EventFormProps) {
  const {
    setPreviewGeometry,
    selectedRoadAssetIdsForForm,
    setSelectedRoadAssetsForForm,
    cacheAssetDetails,
    resetAssetSelectorFilters,
    clearAssetCache,
    selectedAssetDetailsCache, // For getting geometry from map clicks
    // Drawing state
    drawnFeatures,
    currentDrawType,
    drawMode,
    setDrawMode,
    clearDrawing,
    triggerDrawAction,
    isDrawingActive,
    setDrawnFeatures,
    setCurrentDrawType,
    // Duplicate state
    duplicateEventId,
    // Unified editing history (for both drawing AND asset selection)
    editHistory,
    editRedoStack,
    undoEdit,
    redoEdit,
    saveEditSnapshot,
    clearEditHistory,
    isUndoRedoInProgress,
    // Map navigation
    setFlyToGeometry,
  } = useUIStore();

  // Computed history state
  const canUndo = editHistory.length > 0;
  const canRedo = editRedoStack.length > 0;
  const [geometry, setGeometry] = useState<SupportedGeometry | null>(null);

  const { data: eventData, isLoading: isLoadingEvent } = useEvent(eventId || null);
  const { data: duplicateEventData } = useEvent(duplicateEventId || null);
  // Phase 0: isLoadingIntersecting no longer used since AdvancedRoadAssetSelector is hidden
  const { data: intersectingAssetsData } = useEventIntersectingAssets(eventId || null);

  // Helper to combine multiple features into final geometry for submission
  const combineFeatures = useCallback((features: import('geojson').Feature[]): SupportedGeometry | null => {
    if (!features || features.length === 0) return null;

    if (features.length === 1) {
      return features[0].geometry as SupportedGeometry;
    }

    // Multiple features - create Multi* geometry
    const firstType = features[0].geometry?.type;
    if (firstType === 'Polygon') {
      return {
        type: 'MultiPolygon',
        coordinates: features.map(f => (f.geometry as import('geojson').Polygon).coordinates),
      } as SupportedGeometry;
    } else if (firstType === 'LineString') {
      return {
        type: 'MultiLineString',
        coordinates: features.map(f => (f.geometry as import('geojson').LineString).coordinates),
      } as SupportedGeometry;
    }

    return features[0].geometry as SupportedGeometry;
  }, []);

  // Compute bbox from all drawn features for efficient asset filtering
  const drawnBbox = useMemo(() => {
    if (!drawnFeatures || drawnFeatures.length === 0) return undefined;
    try {
      // Create a feature collection from all features and compute combined bbox
      const fc = turf.featureCollection(drawnFeatures as import('geojson').Feature[]);
      const bbox = turf.bbox(fc);
      // Expand bbox by ~50m (~0.0005 degrees) to catch nearby roads
      const buffer = 0.0005;
      return `${bbox[0] - buffer},${bbox[1] - buffer},${bbox[2] + buffer},${bbox[3] + buffer}`;
    } catch {
      return undefined;
    }
  }, [drawnFeatures]);

  // Fetch assets with bbox filter when drawing, or all active assets otherwise
  const { data: assetsData } = useAssets(
    drawnBbox
      ? { status: 'active', bbox: drawnBbox, limit: 500 }
      : { status: 'active' }
  );

  // Memoize selected assets with geometry for preview generation
  // Combines data from API (assetsData) AND cache (selectedAssetDetailsCache from map clicks)
  const selectedAssetsWithGeometry = useMemo(() => {
    if (selectedRoadAssetIdsForForm.length === 0) return [];

    const result: Array<{ id: string; geometry: import('geojson').Geometry }> = [];

    for (const id of selectedRoadAssetIdsForForm) {
      // Priority 1: Get from assetsData (full RoadAsset info from API)
      const fromApi = assetsData?.data?.find((a) => a.id === id);
      if (fromApi?.geometry) {
        result.push({ id: fromApi.id, geometry: fromApi.geometry });
        continue;
      }

      // Priority 2: Get from cache (geometry from map clicks, works even if outside bbox)
      const cached = selectedAssetDetailsCache[id];
      if (cached?.geometry) {
        result.push({ id: cached.id, geometry: cached.geometry });
      }
      // If neither has geometry, skip (can't generate preview)
    }

    return result;
  }, [assetsData, selectedRoadAssetIdsForForm, selectedAssetDetailsCache]);

  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();

  const isEditing = !!eventId;
  const isSubmitting = createEvent.isPending || updateEvent.isPending;

  const { control, handleSubmit, watch, reset, setValue, formState: { isValid } } = useForm<EventFormData>({
    defaultValues,
    mode: 'onChange',
  });

  const selectedRoadAssetIds = watch('selectedRoadAssetIds');
  const startDate = watch('startDate');

  const areArraysEqual = (left: string[], right: string[]) => {
    if (left.length !== right.length) return false;
    return left.every((value, index) => value === right[index]);
  };

  // Shared clear all handler - clears geometry, roads, preview, cache, and history
  const handleClearAll = useCallback(() => {
    // Clear map canvas
    triggerDrawAction('cancel');
    clearDrawing();
    setGeometry(null);
    // Clear road assets
    setValue('selectedRoadAssetIds', [], { shouldValidate: true });
    setSelectedRoadAssetsForForm([]);
    // Clear preview and cache
    setPreviewGeometry(null);
    clearAssetCache();
    // Clear undo/redo history
    clearEditHistory();
  }, [triggerDrawAction, clearDrawing, setValue, setSelectedRoadAssetsForForm, setPreviewGeometry, clearAssetCache, clearEditHistory]);

  // Handler for manual recalculation button
  const handleRecalculateGeometry = useCallback(() => {
    modals.openConfirmModal({
      title: 'Recalculate Geometry',
      children: 'This will regenerate the event geometry based on the currently selected roads and find all roads that intersect with it. Continue?',
      labels: { confirm: 'Recalculate', cancel: 'Cancel' },
      confirmProps: { color: 'blue' },
      onConfirm: () => {
        // Set flag to trigger recalculation
        userRequestedRecalculationRef.current = true;
        processedGeometryRef.current = null;

        // Regenerate geometry from selected roads
        if (selectedAssetsWithGeometry.length > 0) {
          const corridorGeometry = generateCorridorGeometry(selectedAssetsWithGeometry);
          if (corridorGeometry) {
            const features = geometryToFeatures(corridorGeometry);
            setDrawnFeatures(features);
            setCurrentDrawType(getDrawTypeFromGeometry(corridorGeometry));
            triggerDrawAction('restore');

            // Flag will be reset after auto-intersection completes
          }
        }
      },
    });
  }, [selectedAssetsWithGeometry, setDrawnFeatures, setCurrentDrawType, triggerDrawAction]);

  // Phase 1: Load event data immediately
  useEffect(() => {
    if (eventId && eventData?.data) {
      const event = eventData.data;
      const linkedRoadIds = event.roadAssets?.map((a) => a.id) || [];

      // Reset modification tracking flags when loading new event
      hasManuallyModifiedGeometryRef.current = false;
      userRequestedRecalculationRef.current = false;
      isReadyToTrackRef.current = false; // Will be set after geometry loads
      didMergeIntersectingRef.current = false;
      initialGeometryHashRef.current = null;

      reset({
        name: event.name,
        startDate: new Date(event.startDate),
        endDate: new Date(event.endDate),
        restrictionType: event.restrictionType,
        department: event.department,
        ward: event.ward || '',
        selectedRoadAssetIds: linkedRoadIds,
      });
      setSelectedRoadAssetsForForm(linkedRoadIds);
      setGeometry(event.geometry);

      // Cache asset details for display in the selector
      if (event.roadAssets) {
        cacheAssetDetails(
          event.roadAssets.map((a) => ({
            id: a.id,
            label: getRoadAssetLabel(a),
            ward: a.ward,
            roadType: a.roadType,
            geometry: a.geometry, // Important: cache geometry for preview
          }))
        );
      }

      // Fly to event geometry to center the map (closeUp: true for better zoom)
      if (event.geometry) {
        setFlyToGeometry(event.geometry, true);
      }

      // For auto-generated geometry, we're ready immediately (no drawnFeatures to wait for)
      // For manual geometry, isReadyToTrackRef will be set in Phase 3 after drawnFeatures loads
      if (event.geometrySource === 'auto') {
        // No need to wait for drawnFeatures - already have the selection
        isReadyToTrackRef.current = true;
      }
    } else if (!eventId) {
      // CREATE mode - reset all refs
      reset(defaultValues);
      setSelectedRoadAssetsForForm([]);
      setGeometry(null);
      resetAssetSelectorFilters();
      hasManuallyModifiedGeometryRef.current = false;
      userRequestedRecalculationRef.current = false;
      isReadyToTrackRef.current = true; // Create mode is ready immediately
      didMergeIntersectingRef.current = false;
    }
  }, [eventId, eventData, reset, setSelectedRoadAssetsForForm, cacheAssetDetails, resetAssetSelectorFilters, setFlyToGeometry]);

  // Phase 1b: Load duplicate event data (only when NOT editing)
  useEffect(() => {
    // CRITICAL: Skip if we're editing an existing event
    if (eventId) return;

    // Skip if no duplicate ID or data not loaded yet
    if (!duplicateEventId || !duplicateEventData?.data) return;

    // Guard: prevent re-triggering if we've already processed this duplicate
    if (processedDuplicateIdRef.current === duplicateEventId) {
      return;
    }
    processedDuplicateIdRef.current = duplicateEventId;

    const event = duplicateEventData.data;
    const linkedRoadIds = event.roadAssets?.map((a) => a.id) || [];

    // Step 1: Clear any existing drawing state FIRST
    clearDrawing();

    // Step 2: Reset form with copied values
    reset({
      name: `${event.name} (Copy)`,
      startDate: null,
      endDate: null,
      restrictionType: event.restrictionType,
      department: event.department,
      ward: event.ward || '',
      selectedRoadAssetIds: linkedRoadIds,
    });
    setSelectedRoadAssetsForForm(linkedRoadIds);

    // Step 3: Cache asset details for badges
    if (event.roadAssets) {
      cacheAssetDetails(
        event.roadAssets.map((a) => ({
          id: a.id,
          label: getRoadAssetLabel(a),
          ward: a.ward,
          roadType: a.roadType,
          geometry: a.geometry,
        }))
      );
    }

    // Step 4: Handle geometry based on source
    if (event.geometrySource === 'manual' && event.geometry) {
      const features = geometryToFeatures(event.geometry);
      const drawType = getDrawTypeFromGeometry(event.geometry);

      console.log('[EventForm] Duplicate: restoring manual geometry', {
        featureCount: features.length,
        drawType,
      });

      // Set features and type in store
      setDrawnFeatures(features);
      setCurrentDrawType(drawType);

      // Trigger restore action - MapView will wait for draw control to be ready
      triggerDrawAction('restore');
    }
    // For 'auto' source: road selection triggers preview automatically
    // Note: FlyTo is handled in MapView's restore action handler for better timing

    // Note: We no longer call clearDuplicateEvent() here since:
    // 1. processedDuplicateIdRef prevents re-triggering
    // 2. Keeping duplicateEventId allows MapView to show the source event overlay
    // 3. It gets cleared automatically when form closes
  }, [
    duplicateEventId,
    duplicateEventData,
    eventId,
    reset,
    clearDrawing,
    setSelectedRoadAssetsForForm,
    cacheAssetDetails,
    setDrawnFeatures,
    setCurrentDrawType,
    triggerDrawAction,
  ]);

  // Phase 2: Merge intersecting roads when they arrive (background)
  useEffect(() => {
    if (eventId && eventData?.data && intersectingAssetsData?.data) {
      const event = eventData.data;
      const geometrySource = event.geometrySource || 'auto';

      // GATE 1: Only run once to prevent late-arriving data from overwriting user changes
      if (didMergeIntersectingRef.current) {
        console.log('[EventForm] Phase 2: Already merged, skipping');
        return;
      }

      // GATE 2: Skip auto-merge for auto-generated geometry UNLESS:
      // 1. Geometry was manually drawn (geometrySource = 'manual'), OR
      // 2. User has manually modified the geometry in this session, OR
      // 3. User explicitly requested recalculation
      const shouldAutoMerge =
        geometrySource === 'manual' ||
        hasManuallyModifiedGeometryRef.current ||
        userRequestedRecalculationRef.current;

      if (!shouldAutoMerge) {
        console.log('[EventForm] Phase 2: Skipping auto-merge for auto-generated geometry');

        // Still cache the intersecting assets for display purposes
        cacheAssetDetails(
          intersectingAssetsData.data.map(a => ({
            id: a.id,
            label: getRoadAssetLabel(a),
            ward: a.ward,
            roadType: a.roadType,
          }))
        );

        // Mark as merged even though we didn't merge, to prevent future runs
        didMergeIntersectingRef.current = true;
        return;
      }

      // Proceed with merge for manual geometry or recalculation
      const linkedRoadIds = event.roadAssets?.map((a) => a.id) || [];
      const intersectingRoadIds = intersectingAssetsData.data.map((a) => a.id);
      const mergedRoadIds = [...new Set([...linkedRoadIds, ...intersectingRoadIds])];

      // Cache intersecting asset details for display
      cacheAssetDetails(
        intersectingAssetsData.data.map((a) => ({
          id: a.id,
          label: getRoadAssetLabel(a),
          ward: a.ward,
          roadType: a.roadType,
        }))
      );

      // Only update if there are new roads to add
      if (mergedRoadIds.length > linkedRoadIds.length) {
        console.log('[EventForm] Phase 2: Auto-merging intersecting roads', {
          linkedCount: linkedRoadIds.length,
          intersectingCount: intersectingRoadIds.length,
          mergedCount: mergedRoadIds.length,
        });
        setValue('selectedRoadAssetIds', mergedRoadIds, { shouldValidate: true });
        setSelectedRoadAssetsForForm(mergedRoadIds);
      }

      // Mark as merged
      didMergeIntersectingRef.current = true;
    }
  }, [eventId, eventData, intersectingAssetsData, setValue, setSelectedRoadAssetsForForm, cacheAssetDetails]);

  useEffect(() => {
    if (!areArraysEqual(selectedRoadAssetIdsForForm, selectedRoadAssetIds)) {
      setValue('selectedRoadAssetIds', selectedRoadAssetIdsForForm, { shouldValidate: true });
    }
  }, [selectedRoadAssetIdsForForm, selectedRoadAssetIds, setValue]);

  // Auto-select polygon mode when form opens in CREATE mode (no existing features)
  // In EDIT mode: geometry loads in direct_select mode for vertex editing
  // User can click the Polygon button to start drawing a new polygon
  useEffect(() => {
    const isCreateMode = !eventId && !duplicateEventId && !drawnFeatures?.length;

    console.log('[EventForm] Auto-activation effect:', {
      drawMode,
      isCreateMode,
      eventId,
      hasDrawnFeatures: !!drawnFeatures?.length,
    });

    if (!drawMode && isCreateMode) {
      console.log('[EventForm] Auto-activating polygon mode (create mode)');
      setDrawMode('polygon');
    }
  }, [drawMode, drawnFeatures, eventId, duplicateEventId, setDrawMode]);

  // Track if we've already processed intersecting roads for this geometry (combined hash: geom+bbox+assets)
  const processedGeometryRef = useRef<string | null>(null);

  // Track the initial geometry hash for detecting user modifications (geometry-only hash)
  const initialGeometryHashRef = useRef<string | null>(null);

  // Track if we've already processed a duplicate event (prevent re-triggering)
  const processedDuplicateIdRef = useRef<string | null>(null);

  // Track if we've completed initial load and ready to track user modifications
  const isReadyToTrackRef = useRef(false);

  // Track if user has manually modified geometry since load
  const hasManuallyModifiedGeometryRef = useRef(false);

  // Track if user has manually triggered recalculation
  const userRequestedRecalculationRef = useRef(false);

  // Track if Phase 2 merge has already run (prevent multiple runs)
  const didMergeIntersectingRef = useRef(false);

  // Sync drawnFeatures from MapView to form state
  // Also auto-select intersecting road assets (only for CREATE mode or manual geometry changes)
  useEffect(() => {
    if (drawnFeatures && drawnFeatures.length > 0) {
      // Combine features into single geometry for form state
      const combinedGeometry = combineFeatures(drawnFeatures);
      if (combinedGeometry) {
        setGeometry(combinedGeometry);
        // Note: Don't set preview geometry here - drawn features are rendered by maplibre-gl-draw
        // The preview layer only shows road buffer preview (dashed cyan)

        // Track manual modification in EDIT mode
        if (eventId && isReadyToTrackRef.current) {
          // Compare geometry-only hash to detect if user made a real change
          const geomHash = JSON.stringify(drawnFeatures);
          if (geomHash !== initialGeometryHashRef.current) {
            hasManuallyModifiedGeometryRef.current = true;
            console.log('[EventForm] Detected manual geometry modification in edit mode');
          }
        } else if (eventId && !isReadyToTrackRef.current) {
          // First drawnFeatures load in manual edit mode - cache initial hash and mark ready
          // Treat NULL/undefined geometrySource as 'manual' for legacy data
          const effectiveSource = eventData?.data?.geometrySource ?? 'manual';
          if (effectiveSource === 'manual') {
            initialGeometryHashRef.current = JSON.stringify(drawnFeatures);
            isReadyToTrackRef.current = true;
            console.log('[EventForm] Initial geometry hash cached, ready to track modifications');
          }
        }
      }

      // Skip auto-intersection during undo/redo - the assets are already restored from snapshot
      if (isUndoRedoInProgress()) {
        console.log('[EventForm] Skipping intersection check during undo/redo');
        return;
      }

      // GATE: Determine if we should run auto-intersection
      // Run if:
      // 1. CREATE mode (!eventId), OR
      // 2. Editing manual geometry (geometrySource = 'manual'), OR
      // 3. User manually modified geometry in this session, OR
      // 4. User explicitly clicked recalculate
      const geometrySource = eventData?.data?.geometrySource;
      const shouldAutoIntersect =
        !eventId || // CREATE mode
        geometrySource === 'manual' || // Manual geometry always auto-intersects
        hasManuallyModifiedGeometryRef.current || // User modified geometry
        userRequestedRecalculationRef.current; // Explicit recalculation

      if (!shouldAutoIntersect) {
        console.log('[EventForm] Skipping auto-intersection: editing auto-generated event without changes');
        return;
      }

      // Generate a combined hash to detect if geometry OR assets changed
      // Include geometry, bbox, AND assets count/IDs to ensure we re-run when:
      // 1. Geometry changes (user draws/edits)
      // 2. New assets arrive for the current bbox (query completes)
      const geomHash = JSON.stringify(drawnFeatures);
      const assetsHash = assetsData?.data ? `${assetsData.data.length}:${assetsData.data[0]?.id}` : '';
      const combinedHash = `${geomHash}:${drawnBbox}:${assetsHash}`;

      // Find intersecting road assets (if geometry OR assets changed)
      if (assetsData?.data && combinedHash !== processedGeometryRef.current) {
        processedGeometryRef.current = combinedHash;

        console.log('[EventForm] Running auto-intersection with', assetsData.data.length, 'assets');
        console.log('[EventForm] Drawn features:', drawnFeatures.map(f => ({ type: f.geometry?.type, bbox: f.bbox, coords: f.geometry?.type === 'Polygon' ? (f.geometry as import('geojson').Polygon).coordinates[0]?.slice(0, 3) : null })));
        console.log('[EventForm] Sample assets:', assetsData.data.slice(0, 3).map(a => ({ id: a.id, type: a.geometry?.type, geom: a.geometry })));

        try {
          const intersectingIds: string[] = [];

          // Check each drawn feature against each asset
          for (const drawnFeature of drawnFeatures) {
            for (const asset of assetsData.data) {
              if (asset.geometry) {
                try {
                  const assetFeature = turf.feature(asset.geometry);
                  // Check if geometries intersect
                  if (turf.booleanIntersects(drawnFeature, assetFeature)) {
                    if (!intersectingIds.includes(asset.id)) {
                      intersectingIds.push(asset.id);
                      // Cache asset details for display
                      cacheAssetDetails([{
                        id: asset.id,
                        label: getRoadAssetLabel(asset),
                        ward: asset.ward,
                        roadType: asset.roadType,
                      }]);
                    }
                  }
                } catch (geomError) {
                  // Skip assets with invalid geometry
                  console.warn('[EventForm] Invalid asset geometry:', asset.id, geomError);
                }
              }
            }
          }

          console.log('[EventForm] Total intersecting assets:', intersectingIds.length);

          // Replace selection with only currently intersecting assets
          setSelectedRoadAssetsForForm(intersectingIds);
          setValue('selectedRoadAssetIds', intersectingIds, { shouldValidate: true });

          // Reset recalculation flag after completion
          if (userRequestedRecalculationRef.current) {
            console.log('[EventForm] Recalculation complete, resetting flag');
            userRequestedRecalculationRef.current = false;
          }
        } catch (e) {
          console.warn('Failed to find intersecting assets:', e);
        }
      }
    }
  }, [
    drawnFeatures,
    assetsData,
    eventId,
    eventData,
    setPreviewGeometry,
    setSelectedRoadAssetsForForm,
    setValue,
    cacheAssetDetails,
    combineFeatures,
    isUndoRedoInProgress
  ]);

  // Generate PREVIEW geometry from selected roads
  // This now shows BOTH drawn shapes (via maplibre-gl-draw) AND road buffer preview (via preview-geometry layer)
  useEffect(() => {
    // Always generate road corridor preview, regardless of drawn features
    if (selectedAssetsWithGeometry.length > 0) {
      const corridorGeometry = generateCorridorGeometry(selectedAssetsWithGeometry);
      setPreviewGeometry(corridorGeometry);
    } else {
      setPreviewGeometry(null);
    }
  }, [selectedAssetsWithGeometry, setPreviewGeometry]);

  // Track asset selection changes for unified undo/redo
  const prevAssetsRef = useRef<string[]>([]);

  useEffect(() => {
    // Skip if not ready to track (still in initial loading phase)
    if (!isReadyToTrackRef.current) return;

    const prevAssets = prevAssetsRef.current;
    const currentAssets = selectedRoadAssetIdsForForm;

    // Only save snapshot if there's a meaningful change
    if (JSON.stringify(prevAssets) !== JSON.stringify(currentAssets)) {
      // Skip if undo/redo is in progress
      if (!isUndoRedoInProgress()) {
        saveEditSnapshot();
      }
    }
    prevAssetsRef.current = [...currentAssets];
  }, [selectedRoadAssetIdsForForm, saveEditSnapshot, isUndoRedoInProgress]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setPreviewGeometry(null);
      clearDrawing();
      // Reset the processed duplicate ref so the effect can run again if form reopens
      processedDuplicateIdRef.current = null;

      // Reset geometry tracking refs
      isReadyToTrackRef.current = false;
      hasManuallyModifiedGeometryRef.current = false;
      userRequestedRecalculationRef.current = false;
      didMergeIntersectingRef.current = false;
    };
  }, [setPreviewGeometry, clearDrawing]);

  const onSubmit = async (data: EventFormData) => {
    try {
      const hasDrawnGeometry = drawnFeatures && drawnFeatures.length > 0;

      // Phase 0: Geometry is required since road auto-generation is disabled
      if (!hasDrawnGeometry || !geometry) {
        modals.open({
          title: 'Geometry Required',
          children: (
            <Text size="sm">
              Please draw the event area on the map using the Polygon or Line tools before submitting.
            </Text>
          ),
        });
        return;
      }

      const submitData = {
        name: data.name,
        startDate: data.startDate!.toISOString(),
        endDate: data.endDate!.toISOString(),
        restrictionType: data.restrictionType,
        department: data.department,
        ward: data.ward || undefined,
        // Phase 0: roadAssetIds is sent but ignored by backend (Road-Event linking disabled)
        roadAssetIds: [] as string[],
        // Geometry is now required (Phase 0: no auto-generation from roads)
        geometry: geometry,
      };

      if (eventId) {
        await updateEvent.mutateAsync({
          id: eventId,
          data: submitData,
        });
      } else {
        await createEvent.mutateAsync(submitData);
      }
      onClose();
    } catch (error) {
      // Error handled by mutation
    }
  };

  if (isLoadingEvent && isEditing) {
    return <Text>Loading event...</Text>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Stack gap="md">
        {/* Step 1: Define Area (Geometry + Road Selection) */}
        <div>
          <Group gap="xs" mb="xs" align="center">
            <Text size="sm" fw={600}>
              Step 1: Define Area
            </Text>
            {eventId && eventData?.data?.geometrySource && (
              <Badge
                size="xs"
                color={eventData.data.geometrySource === 'manual' ? 'blue' : 'gray'}
                variant="light"
                title={
                  eventData.data.geometrySource === 'manual'
                    ? 'This geometry was manually drawn'
                    : 'This geometry was auto-generated from roads. Roads will not auto-update unless you modify the geometry or click Recalculate.'
                }
                style={{ cursor: 'help' }}
              >
                {eventData.data.geometrySource === 'manual' ? 'Manual' : 'Auto-generated'}
              </Badge>
            )}
          </Group>
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              Draw on the map or select roads below. Double-click to finish drawing.
            </Text>

            {/* Drawing controls row: Undo/Redo | Drawing tools | Clear All */}
            <Group gap="xs" wrap="wrap" align="center">
              {/* Undo/Redo buttons - now unified for both drawing AND asset selection */}
              <ActionIcon
                variant="light"
                size="sm"
                disabled={!canUndo}
                onClick={() => {
                  undoEdit();
                  triggerDrawAction('restore');
                }}
                title="Undo"
              >
                <IconArrowBack size={14} />
              </ActionIcon>
              <ActionIcon
                variant="light"
                size="sm"
                disabled={!canRedo}
                onClick={() => {
                  redoEdit();
                  triggerDrawAction('restore');
                }}
                title="Redo"
              >
                <IconArrowForward size={14} />
              </ActionIcon>

              {/* Drawing tool buttons */}
              <Button
                variant={drawMode === 'polygon' ? 'filled' : 'light'}
                color="cyan"
                size="xs"
                leftSection={<IconPolygon size={14} />}
                onClick={() => {
                  // Force mode change even if already in polygon mode
                  // This allows switching from vertex editing (direct_select) to drawing new polygon
                  if (drawMode === 'polygon') {
                    setDrawMode(null);
                    setTimeout(() => setDrawMode('polygon'), 0);
                  } else {
                    setDrawMode('polygon');
                  }
                }}
                disabled={isDrawingActive || currentDrawType === 'line'}
              >
                Polygon
              </Button>
              <Button
                variant={drawMode === 'line' ? 'filled' : 'light'}
                color="cyan"
                size="xs"
                leftSection={<IconLine size={14} />}
                onClick={() => {
                  // Force mode change even if already in line mode
                  // This allows switching from vertex editing (direct_select) to drawing new line
                  if (drawMode === 'line') {
                    setDrawMode(null);
                    setTimeout(() => setDrawMode('line'), 0);
                  } else {
                    setDrawMode('line');
                  }
                }}
                disabled={isDrawingActive || currentDrawType === 'polygon'}
              >
                Line
              </Button>

              {/* Zoom to geometry button */}
              <ActionIcon
                variant="light"
                size="sm"
                disabled={!drawnFeatures?.length}
                onClick={() => {
                  if (drawnFeatures && drawnFeatures.length > 0) {
                    const combinedGeometry = combineFeatures(drawnFeatures);
                    if (combinedGeometry) {
                      setFlyToGeometry(combinedGeometry, true);
                    }
                  }
                }}
                title="定位到绘制区域"
              >
                <IconFocus2 size={14} />
              </ActionIcon>

              {/* Recalculate button - show in EDIT mode for auto-generated geometry */}
              {eventId && eventData?.data?.geometrySource === 'auto' && (
                <Button
                  variant="light"
                  color="blue"
                  size="xs"
                  onClick={handleRecalculateGeometry}
                  disabled={selectedRoadAssetIds.length === 0}
                  title="Regenerate geometry and selection from currently selected roads"
                  leftSection={<IconRefresh size={14} />}
                >
                  Recalculate
                </Button>
              )}

              {/* Clear All button - clears geometry AND road assets */}
              <Button
                variant="subtle"
                color="red"
                size="xs"
                onClick={() => {
                  modals.openConfirmModal({
                    title: 'Confirm Clear All',
                    children: (
                      <Text size="sm">
                        This will clear all drawn shapes and selected roads. Continue?
                      </Text>
                    ),
                    labels: { confirm: 'Clear All', cancel: 'Cancel' },
                    confirmProps: { color: 'red' },
                    onConfirm: handleClearAll,
                  });
                }}
                disabled={!drawnFeatures?.length && selectedRoadAssetIds.length === 0}
                title="Clear All"
                px={8}
              >
                <IconEraser size={14} />
              </Button>
            </Group>

            {/* Phase 0: Road-Event linking disabled
            <Divider label="Or select roads from the list" labelPosition="center" />

            <Controller
              name="selectedRoadAssetIds"
              control={control}
              rules={{
                validate: (value) => value.length > 0 || 'At least one road asset is required',
              }}
              render={({ field, fieldState }) => (
                <AdvancedRoadAssetSelector
                  value={field.value}
                  onChange={(value) => {
                    field.onChange(value);
                    setSelectedRoadAssetsForForm(value);
                  }}
                  required
                  error={fieldState.error?.message}
                  initialWard={eventData?.data?.ward || null}
                  isLoadingIntersecting={isEditing && isLoadingIntersecting}
                  onClearAll={handleClearAll}
                />
              )}
            />
            */}

            <Alert color="blue" variant="light" title="Phase 0: Road Selection Disabled">
              Road-Event linking is currently disabled. Draw the event area directly on the map using the polygon or line tools above.
            </Alert>
          </Stack>
        </div>

        <Divider />

        {/* Step 2: Event Details */}
        <div>
          <Text size="sm" fw={600} mb="xs">
            Step 2: Event Details
          </Text>
          <Stack gap="sm">
            <Controller
              name="name"
              control={control}
              rules={{ required: 'Event name is required' }}
              render={({ field, fieldState }) => (
                <TextInput
                  label="Event Name"
                  placeholder="Enter event name"
                  required
                  error={fieldState.error?.message}
                  {...field}
                />
              )}
            />

            <Group grow>
              <Controller
                name="startDate"
                control={control}
                rules={{ required: 'Start date is required' }}
                render={({ field, fieldState }) => (
                  <DatePickerInput
                    label="Start Date"
                    placeholder="Select start date"
                    required
                    error={fieldState.error?.message}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <Controller
                name="endDate"
                control={control}
                rules={{
                  required: 'End date is required',
                  validate: (value) => {
                    if (value && startDate && value < startDate) {
                      return 'End date must be on or after start date';
                    }
                    return true;
                  },
                }}
                render={({ field, fieldState }) => (
                  <DatePickerInput
                    label="End Date"
                    placeholder="Select end date"
                    required
                    error={fieldState.error?.message}
                    value={field.value}
                    onChange={field.onChange}
                    minDate={startDate || undefined}
                  />
                )}
              />
            </Group>

            <Controller
              name="restrictionType"
              control={control}
              render={({ field }) => (
                <Select
                  label="Restriction Type"
                  data={RESTRICTION_TYPES}
                  value={field.value}
                  onChange={(val) => field.onChange((val as RestrictionType) || 'partial')}
                  required
                />
              )}
            />

            <Controller
              name="department"
              control={control}
              rules={{ required: 'Department is required' }}
              render={({ field, fieldState }) => (
                <TextInput
                  label="Department"
                  placeholder="Enter department"
                  required
                  error={fieldState.error?.message}
                  {...field}
                />
              )}
            />

            <Controller
              name="ward"
              control={control}
              render={({ field }) => (
                <TextInput
                  label="Ward"
                  placeholder="Enter ward (optional)"
                  {...field}
                />
              )}
            />
          </Stack>
        </div>

        <Divider />

        {(createEvent.error || updateEvent.error) && (
          <Alert icon={<IconAlertCircle size={16} />} color="red">
            {(createEvent.error || updateEvent.error)?.message || 'An error occurred'}
          </Alert>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={isSubmitting} type="button">
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting} disabled={!isValid}>
            {isEditing ? 'Update Event' : 'Create Event'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

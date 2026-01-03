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
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconAlertCircle, IconPolygon, IconLine, IconArrowBack, IconArrowForward, IconEraser } from '@tabler/icons-react';
import { modals } from '@mantine/modals';
import { useForm, Controller } from 'react-hook-form';
import * as turf from '@turf/turf';
import { AdvancedRoadAssetSelector } from './AdvancedRoadAssetSelector';
import { getRoadAssetLabel } from '../../utils/roadAssetLabel';
import { generateCorridorGeometry } from '../../utils/geometryGenerator';
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
    // Unified editing history (for both drawing AND asset selection)
    editHistory,
    editRedoStack,
    undoEdit,
    redoEdit,
    saveEditSnapshot,
    clearEditHistory,
    isUndoRedoInProgress,
  } = useUIStore();

  // Computed history state
  const canUndo = editHistory.length > 0;
  const canRedo = editRedoStack.length > 0;
  const [geometry, setGeometry] = useState<SupportedGeometry | null>(null);

  const { data: eventData, isLoading: isLoadingEvent } = useEvent(eventId || null);
  const { data: intersectingAssetsData, isLoading: isLoadingIntersecting } = useEventIntersectingAssets(eventId || null);

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

  // Phase 1: Load event data immediately
  useEffect(() => {
    if (eventId && eventData?.data) {
      const event = eventData.data;
      const linkedRoadIds = event.roadAssets?.map((a) => a.id) || [];

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
          }))
        );
      }
    } else if (!eventId) {
      reset(defaultValues);
      setSelectedRoadAssetsForForm([]);
      setGeometry(null);
      resetAssetSelectorFilters();
    }
  }, [eventId, eventData, reset, setSelectedRoadAssetsForForm, cacheAssetDetails, resetAssetSelectorFilters]);

  // Phase 2: Merge intersecting roads when they arrive (background)
  useEffect(() => {
    if (eventId && eventData?.data && intersectingAssetsData?.data) {
      const linkedRoadIds = eventData.data.roadAssets?.map((a) => a.id) || [];
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
        setValue('selectedRoadAssetIds', mergedRoadIds, { shouldValidate: true });
        setSelectedRoadAssetsForForm(mergedRoadIds);
      }
    }
  }, [eventId, eventData, intersectingAssetsData, setValue, setSelectedRoadAssetsForForm, cacheAssetDetails]);

  useEffect(() => {
    if (!areArraysEqual(selectedRoadAssetIdsForForm, selectedRoadAssetIds)) {
      setValue('selectedRoadAssetIds', selectedRoadAssetIdsForForm, { shouldValidate: true });
    }
  }, [selectedRoadAssetIdsForForm, selectedRoadAssetIds, setValue]);

  // Auto-select polygon mode when form opens and no mode selected
  useEffect(() => {
    if (!drawMode) {
      setDrawMode('polygon');
    }
  }, [drawMode, setDrawMode]);

  // Track if we've already processed intersecting roads for this geometry
  const processedGeometryRef = useRef<string | null>(null);

  // Sync drawnFeatures from MapView to form state
  // Also auto-select intersecting road assets
  useEffect(() => {
    if (drawnFeatures && drawnFeatures.length > 0) {
      // Combine features into single geometry for form state
      const combinedGeometry = combineFeatures(drawnFeatures);
      if (combinedGeometry) {
        setGeometry(combinedGeometry);
        // Note: Don't set preview geometry here - drawn features are rendered by maplibre-gl-draw
        // The preview layer only shows road buffer preview (dashed cyan)
      }

      // Skip auto-intersection during undo/redo - the assets are already restored from snapshot
      if (isUndoRedoInProgress()) {
        console.log('[EventForm] Skipping intersection check during undo/redo');
        return;
      }

      // Generate a simple hash to detect if geometry changed
      const geomHash = JSON.stringify(drawnFeatures);

      // Find intersecting road assets (only if geometry changed)
      if (assetsData?.data && geomHash !== processedGeometryRef.current) {
        processedGeometryRef.current = geomHash;

        console.log('[EventForm] Checking intersection with', assetsData.data.length, 'assets');

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
                      console.log('[EventForm] Found intersecting asset:', asset.id, asset.name);
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
          // (Don't accumulate - only keep assets that intersect with final position)
          console.log('[EventForm] Replacing selected roads with:', intersectingIds);
          setSelectedRoadAssetsForForm(intersectingIds);
          setValue('selectedRoadAssetIds', intersectingIds, { shouldValidate: true });
        } catch (e) {
          console.warn('Failed to find intersecting assets:', e);
        }
      }
    }
  }, [drawnFeatures, assetsData, setPreviewGeometry, setSelectedRoadAssetsForForm, setValue, cacheAssetDetails, combineFeatures, isUndoRedoInProgress]);

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
  // Use a delay to skip initial data loading before starting to track changes
  const prevAssetsRef = useRef<string[]>([]);
  const isReadyToTrackRef = useRef(false);

  // Start tracking after a short delay to skip initial data load
  useEffect(() => {
    const timer = setTimeout(() => {
      isReadyToTrackRef.current = true;
      // Initialize prevAssetsRef with current state when ready
      prevAssetsRef.current = [...selectedRoadAssetIdsForForm];
    }, 500); // Wait for initial data loading to complete

    return () => clearTimeout(timer);
  }, []); // Only run once on mount

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
    };
  }, [setPreviewGeometry, clearDrawing]);

  const onSubmit = async (data: EventFormData) => {
    try {
      // Determine if we have manually drawn geometry
      const hasDrawnGeometry = drawnFeatures && drawnFeatures.length > 0;

      const submitData = {
        name: data.name,
        startDate: data.startDate!.toISOString(),
        endDate: data.endDate!.toISOString(),
        restrictionType: data.restrictionType,
        department: data.department,
        ward: data.ward || undefined,
        roadAssetIds: data.selectedRoadAssetIds,
        // Only submit geometry if manually drawn
        geometry: hasDrawnGeometry && geometry ? geometry : undefined,
        // Signal backend to auto-generate if no manual geometry
        regenerateGeometry: !hasDrawnGeometry,
      };

      if (isEditing && eventId) {
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
          <Text size="sm" fw={600} mb="xs">
            Step 1: Define Area
          </Text>
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
                onClick={() => setDrawMode('polygon')}
                disabled={isDrawingActive || currentDrawType === 'line'}
              >
                Polygon
              </Button>
              <Button
                variant={drawMode === 'line' ? 'filled' : 'light'}
                color="cyan"
                size="xs"
                leftSection={<IconLine size={14} />}
                onClick={() => setDrawMode('line')}
                disabled={isDrawingActive || currentDrawType === 'polygon'}
              >
                Line
              </Button>

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

            <Divider label="Or select roads from the list" labelPosition="center" />

            {/* Road Asset Selector */}
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

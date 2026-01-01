import { useState, useEffect, useMemo } from 'react';
import {
  Stack,
  TextInput,
  Select,
  Button,
  Group,
  Text,
  Radio,
  Divider,
  Alert,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconAlertCircle, IconRefresh } from '@tabler/icons-react';
import { useForm, Controller } from 'react-hook-form';
import { AdvancedRoadAssetSelector } from './AdvancedRoadAssetSelector';
import { getRoadAssetLabel } from '../../utils/roadAssetLabel';
import { useUIStore } from '../../stores/uiStore';
import {
  useCreateEvent,
  useUpdateEvent,
  useEvent,
  useAssets,
  useEventIntersectingAssets,
} from '../../hooks/useApi';
import { generateCorridorGeometry } from '../../utils/geometryGenerator';
import type { RestrictionType, SupportedGeometry } from '@nagoya/shared';

interface EventFormProps {
  eventId?: string | null;
  onClose: () => void;
}

type GeometryMode = 'auto' | 'manual';

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
  geometryMode: GeometryMode;
}

const defaultValues: EventFormData = {
  name: '',
  startDate: null,
  endDate: null,
  restrictionType: 'partial',
  department: '',
  ward: '',
  selectedRoadAssetIds: [],
  geometryMode: 'auto',
};

export function EventForm({ eventId, onClose }: EventFormProps) {
  const {
    setPreviewGeometry,
    selectedRoadAssetIdsForForm,
    setSelectedRoadAssetsForForm,
    cacheAssetDetails,
    resetAssetSelectorFilters,
  } = useUIStore();
  const [geometry, setGeometry] = useState<SupportedGeometry | null>(null);

  const { data: eventData, isLoading: isLoadingEvent } = useEvent(eventId || null);
  const { data: intersectingAssetsData, isLoading: isLoadingIntersecting } = useEventIntersectingAssets(eventId || null);
  const { data: assetsData } = useAssets({ status: 'active' });
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();

  const isEditing = !!eventId;
  const isSubmitting = createEvent.isPending || updateEvent.isPending;

  const { control, handleSubmit, watch, reset, setValue, formState: { isValid } } = useForm<EventFormData>({
    defaultValues,
    mode: 'onChange',
  });

  const selectedRoadAssetIds = watch('selectedRoadAssetIds');
  const geometryMode = watch('geometryMode');
  const startDate = watch('startDate');

  const areArraysEqual = (left: string[], right: string[]) => {
    if (left.length !== right.length) return false;
    return left.every((value, index) => value === right[index]);
  };

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
        geometryMode: event.geometrySource === 'auto' ? 'auto' : 'manual',
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

  const selectedAssets = useMemo(() => {
    if (!assetsData?.data || selectedRoadAssetIds.length === 0) return [];
    return assetsData.data.filter((a) => selectedRoadAssetIds.includes(a.id));
  }, [assetsData, selectedRoadAssetIds]);

  useEffect(() => {
    if (!areArraysEqual(selectedRoadAssetIdsForForm, selectedRoadAssetIds)) {
      setValue('selectedRoadAssetIds', selectedRoadAssetIdsForForm, { shouldValidate: true });
    }
  }, [selectedRoadAssetIdsForForm, selectedRoadAssetIds, setValue]);

  useEffect(() => {
    if (geometryMode === 'auto' && selectedAssets.length > 0) {
      const corridorGeometry = generateCorridorGeometry(selectedAssets);
      if (corridorGeometry) {
        setGeometry(corridorGeometry);
        setPreviewGeometry(corridorGeometry);
      }
    }
  }, [selectedAssets, geometryMode, setPreviewGeometry]);

  useEffect(() => {
    return () => {
      setPreviewGeometry(null);
    };
  }, [setPreviewGeometry]);

  const handleRegenerateGeometry = () => {
    if (selectedAssets.length > 0) {
      const corridorGeometry = generateCorridorGeometry(selectedAssets);
      if (corridorGeometry) {
        setGeometry(corridorGeometry);
        setPreviewGeometry(corridorGeometry);
        setValue('geometryMode', 'auto');
      }
    }
  };

  const handlePreview = () => {
    if (geometry) {
      setPreviewGeometry(geometry);
    }
  };

  const onSubmit = async (data: EventFormData) => {
    try {
      if (isEditing && eventId) {
        await updateEvent.mutateAsync({
          id: eventId,
          data: {
            name: data.name,
            startDate: data.startDate!.toISOString(),
            endDate: data.endDate!.toISOString(),
            restrictionType: data.restrictionType,
            department: data.department,
            ward: data.ward || undefined,
            roadAssetIds: data.selectedRoadAssetIds,
            geometry: data.geometryMode === 'manual' ? geometry || undefined : undefined,
            regenerateGeometry: data.geometryMode === 'auto' && eventData?.data.geometrySource !== 'auto',
          },
        });
      } else {
        await createEvent.mutateAsync({
          name: data.name,
          startDate: data.startDate!.toISOString(),
          endDate: data.endDate!.toISOString(),
          restrictionType: data.restrictionType,
          department: data.department,
          ward: data.ward || undefined,
          roadAssetIds: data.selectedRoadAssetIds,
          geometry: data.geometryMode === 'manual' ? geometry || undefined : undefined,
        });
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
        <div>
          <Text size="sm" fw={600} mb="xs">
            Step 1: Select Road Assets
          </Text>
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
              />
            )}
          />
        </div>

        <Divider />

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

        <div>
          <Text size="sm" fw={600} mb="xs">
            Step 3: Geometry
          </Text>
          <Stack gap="sm">
            <Controller
              name="geometryMode"
              control={control}
              render={({ field }) => (
                <Radio.Group value={field.value} onChange={field.onChange}>
                  <Stack gap="xs">
                    <Radio value="auto" label="Auto-generate from road assets (15m buffer)" />
                    <Radio value="manual" label="Draw manually on map" />
                  </Stack>
                </Radio.Group>
              )}
            />

            {geometryMode === 'manual' && (
              <Alert icon={<IconAlertCircle size={16} />} color="blue">
                Drawing on map is not yet implemented. Using auto-generated geometry.
              </Alert>
            )}

            <Group>
              <Button
                variant="light"
                size="xs"
                onClick={handlePreview}
                disabled={!geometry}
                type="button"
              >
                Preview on Map
              </Button>

              {isEditing && (
                <Button
                  variant="light"
                  size="xs"
                  leftSection={<IconRefresh size={14} />}
                  onClick={handleRegenerateGeometry}
                  disabled={selectedRoadAssetIds.length === 0}
                  type="button"
                >
                  Regenerate from Roads
                </Button>
              )}
            </Group>
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

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
import { RoadAssetSelector } from './RoadAssetSelector';
import { useUIStore } from '../../stores/uiStore';
import {
  useCreateEvent,
  useUpdateEvent,
  useEvent,
  useAssets,
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
  const { setPreviewGeometry } = useUIStore();
  const [geometry, setGeometry] = useState<SupportedGeometry | null>(null);

  const { data: eventData, isLoading: isLoadingEvent } = useEvent(eventId || null);
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

  useEffect(() => {
    if (eventId && eventData?.data) {
      const event = eventData.data;
      reset({
        name: event.name,
        startDate: new Date(event.startDate),
        endDate: new Date(event.endDate),
        restrictionType: event.restrictionType,
        department: event.department,
        ward: event.ward || '',
        selectedRoadAssetIds: event.roadAssets?.map((a) => a.id) || [],
        geometryMode: event.geometrySource === 'auto' ? 'auto' : 'manual',
      });
      setGeometry(event.geometry);
    } else if (!eventId) {
      reset(defaultValues);
      setGeometry(null);
    }
  }, [eventId, eventData, reset]);

  const selectedAssets = useMemo(() => {
    if (!assetsData?.data || selectedRoadAssetIds.length === 0) return [];
    return assetsData.data.filter((a) => selectedRoadAssetIds.includes(a.id));
  }, [assetsData, selectedRoadAssetIds]);

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
              <RoadAssetSelector
                value={field.value}
                onChange={field.onChange}
                required
                error={fieldState.error?.message}
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

import { useEffect, useMemo } from 'react';
import {
  Stack,
  Textarea,
  Select,
  Button,
  Group,
  Text,
  Paper,
  Radio,
  Loader,
  Center,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconMapPin, IconCheck } from '@tabler/icons-react';
import { useForm, Controller } from 'react-hook-form';
import { useUIStore } from '../../stores/uiStore';
import {
  useEvents,
  useAssets,
  useCreateInspection,
  useUpdateInspection,
  useInspection,
} from '../../hooks/useApi';
import type { Point } from 'geojson';

interface InspectionFormProps {
  inspectionId?: string | null; // For editing
  prefillEventId?: string | null;
  prefillAssetId?: string | null;
  onClose: () => void;
}

interface InspectionFormData {
  linkType: 'event' | 'asset';
  eventId: string;
  roadAssetId: string;
  inspectionDate: Date | null;
  result: string;
  notes: string;
}

const resultOptions = [
  { value: 'pass', label: 'Pass' },
  { value: 'fail', label: 'Fail' },
  { value: 'pending', label: 'Pending Review' },
  { value: 'na', label: 'N/A' },
];

export function InspectionForm({
  inspectionId,
  prefillEventId,
  prefillAssetId,
  onClose,
}: InspectionFormProps) {
  const {
    inspectionDrawnPoint,
    startDrawing,
    stopDrawing,
    drawingContext,
    setDrawMode,
    setInspectionDrawnPoint,
  } = useUIStore();

  // Load existing inspection for editing
  const { data: inspectionData, isLoading: isLoadingInspection } = useInspection(
    inspectionId ?? null
  );
  const existingInspection = inspectionData?.data;

  // Load events and assets for dropdowns
  const { data: eventsData, isLoading: isLoadingEvents } = useEvents({ includeArchived: false });
  const { data: assetsData, isLoading: isLoadingAssets } = useAssets({ status: 'active', limit: 500 });

  const events = eventsData?.data || [];
  const assets = assetsData?.data || [];

  // Mutations
  const createInspection = useCreateInspection();
  const updateInspection = useUpdateInspection();

  const isLoading = createInspection.isPending || updateInspection.isPending;
  const isDataLoading = isLoadingInspection || isLoadingEvents || isLoadingAssets;

  const { control, handleSubmit, reset, watch, setValue } = useForm<InspectionFormData>({
    defaultValues: {
      linkType: prefillAssetId ? 'asset' : 'event',
      eventId: prefillEventId || '',
      roadAssetId: prefillAssetId || '',
      inspectionDate: new Date(),
      result: 'pending',
      notes: '',
    },
    mode: 'onChange',
  });

  const linkType = watch('linkType');

  // Reset form when existing inspection loads
  useEffect(() => {
    if (existingInspection) {
      reset({
        linkType: existingInspection.roadAssetId ? 'asset' : 'event',
        eventId: existingInspection.eventId || '',
        roadAssetId: existingInspection.roadAssetId || '',
        inspectionDate: new Date(existingInspection.inspectionDate),
        result: existingInspection.result,
        notes: existingInspection.notes || '',
      });
      // Set the existing geometry
      if (existingInspection.geometry) {
        setInspectionDrawnPoint(existingInspection.geometry);
      }
    }
  }, [existingInspection, reset, setInspectionDrawnPoint]);

  // Handle link type change - clear the other field
  useEffect(() => {
    if (linkType === 'event') {
      setValue('roadAssetId', '');
    } else {
      setValue('eventId', '');
    }
  }, [linkType, setValue]);

  // Geometry from drawn point or existing
  const geometry = useMemo<Point | null>(() => {
    if (inspectionDrawnPoint) {
      return inspectionDrawnPoint;
    }
    if (existingInspection?.geometry) {
      return existingInspection.geometry;
    }
    return null;
  }, [inspectionDrawnPoint, existingInspection]);

  const hasValidGeometry = geometry !== null;

  const handleStartDrawing = () => {
    startDrawing('inspection-form');
    setDrawMode('point');
  };

  const handleClearPoint = () => {
    setInspectionDrawnPoint(null);
  };

  const onSubmit = (data: InspectionFormData) => {
    if (!geometry) {
      notifications.show({
        title: 'Location Required',
        message: 'Please click on the map to set the inspection location.',
        color: 'red',
      });
      return;
    }

    if (!data.inspectionDate) {
      notifications.show({
        title: 'Date Required',
        message: 'Please select an inspection date.',
        color: 'red',
      });
      return;
    }

    const inspectionData = {
      eventId: linkType === 'event' ? data.eventId : undefined,
      roadAssetId: linkType === 'asset' ? data.roadAssetId : undefined,
      inspectionDate: data.inspectionDate.toISOString().split('T')[0],
      result: data.result,
      notes: data.notes || undefined,
      geometry,
    };

    if (inspectionId) {
      // Update
      updateInspection.mutate(
        { id: inspectionId, data: inspectionData },
        {
          onSuccess: () => {
            notifications.show({
              title: 'Inspection Updated',
              message: 'Inspection record has been updated.',
              color: 'green',
            });
            handleClose();
          },
          onError: (error) => {
            notifications.show({
              title: 'Update Failed',
              message: error instanceof Error ? error.message : 'Failed to update inspection',
              color: 'red',
            });
          },
        }
      );
    } else {
      // Create
      createInspection.mutate(inspectionData, {
        onSuccess: () => {
          notifications.show({
            title: 'Inspection Created',
            message: 'Inspection record has been created.',
            color: 'green',
          });
          handleClose();
        },
        onError: (error) => {
          notifications.show({
            title: 'Create Failed',
            message: error instanceof Error ? error.message : 'Failed to create inspection',
            color: 'red',
          });
        },
      });
    }
  };

  const handleClose = () => {
    if (drawingContext === 'inspection-form') {
      stopDrawing();
    }
    setInspectionDrawnPoint(null);
    reset();
    onClose();
  };

  if (isDataLoading) {
    return (
      <Center h={200}>
        <Loader size="lg" />
      </Center>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Stack gap="md">
        {/* Link Type Selection */}
        <Controller
          name="linkType"
          control={control}
          render={({ field }) => (
            <Radio.Group
              label="Link Inspection To"
              {...field}
            >
              <Group mt="xs">
                <Radio value="event" label="Construction Event" />
                <Radio value="asset" label="Road Asset" />
              </Group>
            </Radio.Group>
          )}
        />

        {/* Event/Asset Selection */}
        {linkType === 'event' ? (
          <Controller
            name="eventId"
            control={control}
            rules={{ required: linkType === 'event' }}
            render={({ field }) => (
              <Select
                label="Event"
                placeholder="Select event"
                data={events.map((e) => ({
                  value: e.id,
                  label: `${e.name} (${e.status})`,
                }))}
                searchable
                required
                {...field}
              />
            )}
          />
        ) : (
          <Controller
            name="roadAssetId"
            control={control}
            rules={{ required: linkType === 'asset' }}
            render={({ field }) => (
              <Select
                label="Road Asset"
                placeholder="Select road asset"
                data={assets.map((a) => ({
                  value: a.id,
                  label: a.displayName || a.name || a.ref || a.id,
                }))}
                searchable
                required
                {...field}
              />
            )}
          />
        )}

        {/* Location Section */}
        <Paper p="sm" withBorder>
          <Text size="sm" fw={500} mb="xs">
            Inspection Location
          </Text>
          {hasValidGeometry ? (
            <Group justify="space-between">
              <Group gap="xs">
                <IconMapPin size={16} color="green" />
                <Text size="sm" c="green">
                  Location set ({geometry?.coordinates[0].toFixed(5)}, {geometry?.coordinates[1].toFixed(5)})
                </Text>
              </Group>
              <Button
                size="xs"
                variant="light"
                color="red"
                onClick={handleClearPoint}
              >
                Clear
              </Button>
            </Group>
          ) : (
            <Stack gap="xs" align="center">
              <Text size="sm" c="dimmed">
                Click on the map to set the inspection location
              </Text>
              <Button
                size="sm"
                variant="light"
                leftSection={<IconMapPin size={14} />}
                onClick={handleStartDrawing}
              >
                Set Location
              </Button>
            </Stack>
          )}
        </Paper>

        {/* Inspection Details */}
        <Controller
          name="inspectionDate"
          control={control}
          rules={{ required: true }}
          render={({ field }) => (
            <DatePickerInput
              label="Inspection Date"
              placeholder="Select date"
              required
              {...field}
            />
          )}
        />

        <Controller
          name="result"
          control={control}
          rules={{ required: true }}
          render={({ field }) => (
            <Select
              label="Result"
              data={resultOptions}
              required
              {...field}
            />
          )}
        />

        <Controller
          name="notes"
          control={control}
          render={({ field }) => (
            <Textarea
              label="Notes"
              placeholder="Additional notes..."
              rows={3}
              {...field}
            />
          )}
        />

        {/* Action Buttons */}
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            color="green"
            leftSection={<IconCheck size={16} />}
            loading={isLoading}
            disabled={!hasValidGeometry}
          >
            {inspectionId ? 'Save Changes' : 'Create Inspection'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

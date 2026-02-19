import { useEffect, useMemo } from 'react';
import { Stack, Group, Text, Paper, Center, Loader } from '@/components/shims';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { showNotification } from '@/lib/toast';
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
      showNotification({
        title: 'Location Required',
        message: 'Please click on the map to set the inspection location.',
        color: 'red',
      });
      return;
    }

    if (!data.inspectionDate) {
      showNotification({
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
            showNotification({
              title: 'Inspection Updated',
              message: 'Inspection record has been updated.',
              color: 'green',
            });
            handleClose();
          },
          onError: (error) => {
            showNotification({
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
          showNotification({
            title: 'Inspection Created',
            message: 'Inspection record has been created.',
            color: 'green',
          });
          handleClose();
        },
        onError: (error) => {
          showNotification({
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
            <div>
              <Label className="mb-2 block">Link Inspection To</Label>
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
                className="flex flex-row gap-4 mt-1"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="event" id="link-event" />
                  <Label htmlFor="link-event">Construction Event</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="asset" id="link-asset" />
                  <Label htmlFor="link-asset">Road Asset</Label>
                </div>
              </RadioGroup>
            </div>
          )}
        />

        {/* Event/Asset Selection */}
        {linkType === 'event' ? (
          <Controller
            name="eventId"
            control={control}
            rules={{ required: linkType === 'event' }}
            render={({ field }) => (
              <div>
                <Label className="mb-1 block">Event *</Label>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select event" />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name} ({e.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          />
        ) : (
          <Controller
            name="roadAssetId"
            control={control}
            rules={{ required: linkType === 'asset' }}
            render={({ field }) => (
              <div>
                <Label className="mb-1 block">Road Asset *</Label>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select road asset" />
                  </SelectTrigger>
                  <SelectContent>
                    {assets.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.displayName || a.name || a.ref || a.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                size="sm"
                variant="outline"
                className="text-red-600 border-red-300 hover:bg-red-50"
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
                variant="outline"
                onClick={handleStartDrawing}
              >
                <IconMapPin size={14} className="mr-1" />
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
            <div>
              <Label className="mb-1 block">Result *</Label>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select result" />
                </SelectTrigger>
                <SelectContent>
                  {resultOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        />

        <Controller
          name="notes"
          control={control}
          render={({ field }) => (
            <div>
              <Label className="mb-1 block">Notes</Label>
              <Textarea
                placeholder="Additional notes..."
                rows={3}
                {...field}
              />
            </div>
          )}
        />

        {/* Action Buttons */}
        <Group justify="flex-end" mt="md">
          <Button variant="ghost" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!hasValidGeometry || isLoading}
          >
            <IconCheck size={16} className="mr-1" />
            {isLoading ? 'Saving...' : inspectionId ? 'Save Changes' : 'Create Inspection'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

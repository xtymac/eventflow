import { useEffect, useMemo } from 'react';
import {
  Modal,
  Stack,
  TextInput,
  Select,
  NumberInput,
  Button,
  Group,
  Text,
  Alert,
  Badge,
  Paper,
  Loader,
  Center,
  Divider,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconMapPin, IconCheck, IconTrashX } from '@tabler/icons-react';
import { useForm, Controller } from 'react-hook-form';
import { useUIStore } from '../../stores/uiStore';
import { useAsset, useCreateAsset, useUpdateAsset, useRetireAsset, useAssets } from '../../hooks/useApi';
import { getRoadAssetLabel } from '../../utils/roadAssetLabel';
import type { RoadAsset, RoadType, SupportedGeometry } from '@nagoya/shared';

type ChangeAction = 'create' | 'modify' | 'retire';

interface RoadChangeFormModalProps {
  opened: boolean;
  onClose: () => void;
  action: ChangeAction;
  assetId?: string | null;
  eventId: string;
}

interface AssetFormData {
  name: string;
  nameJa: string;
  ref: string;
  localRef: string;
  roadType: RoadType;
  lanes: number;
  direction: string;
  ward: string;
  ownerDepartment: string;
  replacedBy: string; // For retire action only
}

const roadTypeOptions = [
  { value: 'arterial', label: 'Arterial (主要幹線)' },
  { value: 'collector', label: 'Collector (補助幹線)' },
  { value: 'local', label: 'Local (生活道路)' },
];

const directionOptions = [
  { value: 'two-way', label: 'Two Way (両方向)' },
  { value: 'one-way', label: 'One Way (一方通行)' },
];

export function RoadChangeFormModal({
  opened,
  onClose,
  action,
  assetId,
  eventId,
}: RoadChangeFormModalProps) {
  const {
    roadUpdateDrawnFeatures,
    startDrawing,
    stopDrawing,
    drawingContext,
    setDrawMode,
    clearDrawing,
  } = useUIStore();

  // Load existing asset for modify/retire
  const { data: assetData, isLoading: isLoadingAsset } = useAsset(
    action !== 'create' && assetId ? assetId : null
  );
  const existingAsset = assetData?.data;

  // Load assets for replacedBy dropdown (retire action)
  const { data: assetsData } = useAssets(
    { status: 'active', limit: 500 },
    { enabled: action === 'retire' }
  );
  const availableAssets = assetsData?.data || [];

  // Mutations
  const createAsset = useCreateAsset();
  const updateAsset = useUpdateAsset();
  const retireAsset = useRetireAsset();

  const isLoading = createAsset.isPending || updateAsset.isPending || retireAsset.isPending;

  const { control, handleSubmit, reset } = useForm<AssetFormData>({
    defaultValues: {
      name: '',
      nameJa: '',
      ref: '',
      localRef: '',
      roadType: 'local',
      lanes: 2,
      direction: 'two-way',
      ward: '',
      ownerDepartment: '',
      replacedBy: '',
    },
    mode: 'onChange',
  });

  // Reset form when asset loads (for modify/retire)
  useEffect(() => {
    if (existingAsset && (action === 'modify' || action === 'retire')) {
      reset({
        name: existingAsset.name || '',
        nameJa: existingAsset.nameJa || '',
        ref: existingAsset.ref || '',
        localRef: existingAsset.localRef || '',
        roadType: existingAsset.roadType || 'local',
        lanes: existingAsset.lanes || 2,
        direction: existingAsset.direction || 'two-way',
        ward: existingAsset.ward || '',
        ownerDepartment: existingAsset.ownerDepartment || '',
        replacedBy: '',
      });
    }
  }, [existingAsset, action, reset]);

  // Start drawing when modal opens (for create action)
  useEffect(() => {
    if (opened && action === 'create') {
      startDrawing('road-update');
      // Trigger line draw mode
      setDrawMode('line');
    }

    return () => {
      if (drawingContext === 'road-update') {
        stopDrawing();
      }
    };
  }, [opened, action, startDrawing, stopDrawing, setDrawMode, drawingContext]);

  // Geometry for the form
  const geometry = useMemo<SupportedGeometry | null>(() => {
    if (action === 'create') {
      // Use drawn geometry from road update mode
      if (roadUpdateDrawnFeatures && roadUpdateDrawnFeatures.length > 0) {
        const feature = roadUpdateDrawnFeatures[0];
        if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
          return feature.geometry as SupportedGeometry;
        }
      }
      return null;
    } else if (existingAsset) {
      return existingAsset.geometry;
    }
    return null;
  }, [action, roadUpdateDrawnFeatures, existingAsset]);

  const hasValidGeometry = geometry !== null;

  const handleStartDrawing = () => {
    startDrawing('road-update');
    setDrawMode('line');
  };

  const handleClearDrawing = () => {
    clearDrawing();
  };

  const onSubmit = (data: AssetFormData) => {
    if (action === 'create') {
      if (!geometry) {
        notifications.show({
          title: 'Geometry Required',
          message: 'Please draw the road geometry on the map.',
          color: 'red',
        });
        return;
      }

      createAsset.mutate(
        {
          name: data.name || undefined,
          nameJa: data.nameJa || undefined,
          ref: data.ref || undefined,
          localRef: data.localRef || undefined,
          geometry,
          roadType: data.roadType,
          lanes: data.lanes,
          direction: data.direction,
          ward: data.ward || undefined,
          ownerDepartment: data.ownerDepartment || undefined,
          eventId,
        },
        {
          onSuccess: () => {
            notifications.show({
              title: 'Asset Created',
              message: 'New road asset has been created successfully.',
              color: 'green',
            });
            handleClose();
          },
          onError: (error) => {
            notifications.show({
              title: 'Create Failed',
              message: error instanceof Error ? error.message : 'Failed to create asset',
              color: 'red',
            });
          },
        }
      );
    } else if (action === 'modify' && assetId) {
      updateAsset.mutate(
        {
          id: assetId,
          data: {
            name: data.name || undefined,
            nameJa: data.nameJa || undefined,
            ref: data.ref || undefined,
            localRef: data.localRef || undefined,
            geometry: geometry || undefined,
            roadType: data.roadType,
            lanes: data.lanes,
            direction: data.direction,
            ward: data.ward || undefined,
            ownerDepartment: data.ownerDepartment || undefined,
            eventId,
          },
        },
        {
          onSuccess: () => {
            notifications.show({
              title: 'Asset Updated',
              message: 'Road asset has been updated successfully.',
              color: 'green',
            });
            handleClose();
          },
          onError: (error) => {
            notifications.show({
              title: 'Update Failed',
              message: error instanceof Error ? error.message : 'Failed to update asset',
              color: 'red',
            });
          },
        }
      );
    } else if (action === 'retire' && assetId) {
      retireAsset.mutate(
        {
          id: assetId,
          eventId,
          replacedBy: data.replacedBy || undefined,
        },
        {
          onSuccess: () => {
            notifications.show({
              title: 'Asset Retired',
              message: 'Road asset has been retired successfully.',
              color: 'green',
            });
            handleClose();
          },
          onError: (error) => {
            notifications.show({
              title: 'Retire Failed',
              message: error instanceof Error ? error.message : 'Failed to retire asset',
              color: 'red',
            });
          },
        }
      );
    }
  };

  const handleClose = () => {
    if (drawingContext === 'road-update') {
      stopDrawing();
    }
    reset();
    onClose();
  };

  const getTitle = () => {
    switch (action) {
      case 'create':
        return 'Create New Road Asset';
      case 'modify':
        return 'Modify Road Asset';
      case 'retire':
        return 'Retire Road Asset';
      default:
        return 'Road Asset';
    }
  };

  const getActionColor = () => {
    switch (action) {
      case 'create':
        return 'teal';
      case 'modify':
        return 'blue';
      case 'retire':
        return 'red';
      default:
        return 'gray';
    }
  };

  if (isLoadingAsset && action !== 'create') {
    return (
      <Modal opened={opened} onClose={handleClose} title={getTitle()} size="lg" centered zIndex={400}>
        <Center h={200}>
          <Loader size="lg" />
        </Center>
      </Modal>
    );
  }

  if (action !== 'create' && !existingAsset && assetId) {
    return (
      <Modal opened={opened} onClose={handleClose} title={getTitle()} size="lg" centered zIndex={400}>
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          Asset not found
        </Alert>
      </Modal>
    );
  }

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="xs">
          <Text fw={600}>{getTitle()}</Text>
          <Badge color={getActionColor()} size="sm">
            {action}
          </Badge>
        </Group>
      }
      size="lg"
      centered
      zIndex={400}
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <Stack gap="md">
          {/* Existing asset info (for modify/retire) */}
          {existingAsset && (
            <Paper p="sm" withBorder>
              <Text size="sm" fw={500}>
                {getRoadAssetLabel(existingAsset)}
              </Text>
              <Group gap="xs" mt={4}>
                <Badge size="xs" color="violet">
                  {existingAsset.roadType}
                </Badge>
                {existingAsset.lanes && (
                  <Text size="xs" c="dimmed">
                    {existingAsset.lanes} lanes
                  </Text>
                )}
              </Group>
            </Paper>
          )}

          {/* Retire action - simplified view */}
          {action === 'retire' ? (
            <>
              <Alert icon={<IconTrashX size={16} />} color="red" variant="light">
                <Text size="sm">
                  This will mark the asset as <strong>inactive</strong> and set its valid-to date to today.
                  This action cannot be easily undone.
                </Text>
              </Alert>

              <Controller
                name="replacedBy"
                control={control}
                render={({ field }) => (
                  <Select
                    label="Replaced By (Optional)"
                    description="If this asset is being replaced by another, select the new asset"
                    placeholder="Select replacement asset"
                    data={availableAssets
                      .filter((a: RoadAsset) => a.id !== assetId)
                      .map((a: RoadAsset) => ({
                        value: a.id,
                        label: getRoadAssetLabel(a),
                      }))}
                    clearable
                    searchable
                    {...field}
                  />
                )}
              />
            </>
          ) : (
            <>
              {/* Geometry section (for create) */}
              {action === 'create' && (
                <>
                  <Divider label="Geometry" labelPosition="center" />
                  <Paper p="sm" withBorder>
                    {hasValidGeometry ? (
                      <Group justify="space-between">
                        <Group gap="xs">
                          <IconMapPin size={16} color="green" />
                          <Text size="sm" c="green">
                            Geometry drawn ({geometry?.type})
                          </Text>
                        </Group>
                        <Button
                          size="xs"
                          variant="light"
                          color="red"
                          onClick={handleClearDrawing}
                        >
                          Clear
                        </Button>
                      </Group>
                    ) : (
                      <Stack gap="xs" align="center">
                        <Text size="sm" c="dimmed">
                          Draw the road geometry on the map
                        </Text>
                        <Button
                          size="sm"
                          variant="light"
                          leftSection={<IconMapPin size={14} />}
                          onClick={handleStartDrawing}
                        >
                          Start Drawing
                        </Button>
                      </Stack>
                    )}
                  </Paper>
                </>
              )}

              <Divider label="Properties" labelPosition="center" />

              {/* Name fields */}
              <Group grow>
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => (
                    <TextInput
                      label="Name"
                      placeholder="Road name"
                      {...field}
                    />
                  )}
                />
                <Controller
                  name="nameJa"
                  control={control}
                  render={({ field }) => (
                    <TextInput
                      label="Name (Japanese)"
                      placeholder="日本語名"
                      {...field}
                    />
                  )}
                />
              </Group>

              <Group grow>
                <Controller
                  name="ref"
                  control={control}
                  render={({ field }) => (
                    <TextInput
                      label="Route Reference"
                      placeholder="e.g., 国道23号"
                      {...field}
                    />
                  )}
                />
                <Controller
                  name="localRef"
                  control={control}
                  render={({ field }) => (
                    <TextInput
                      label="Local Reference"
                      placeholder="e.g., 市道1234号"
                      {...field}
                    />
                  )}
                />
              </Group>

              {/* Road properties */}
              <Group grow>
                <Controller
                  name="roadType"
                  control={control}
                  rules={{ required: true }}
                  render={({ field }) => (
                    <Select
                      label="Road Type"
                      data={roadTypeOptions}
                      required
                      {...field}
                    />
                  )}
                />
                <Controller
                  name="lanes"
                  control={control}
                  rules={{ required: true, min: 1 }}
                  render={({ field }) => (
                    <NumberInput
                      label="Lanes"
                      min={1}
                      max={12}
                      required
                      {...field}
                    />
                  )}
                />
              </Group>

              <Controller
                name="direction"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Select
                    label="Direction"
                    data={directionOptions}
                    required
                    {...field}
                  />
                )}
              />

              {/* Location info */}
              <Group grow>
                <Controller
                  name="ward"
                  control={control}
                  render={({ field }) => (
                    <TextInput
                      label="Ward"
                      placeholder="e.g., 中区"
                      {...field}
                    />
                  )}
                />
                <Controller
                  name="ownerDepartment"
                  control={control}
                  render={({ field }) => (
                    <TextInput
                      label="Owner Department"
                      placeholder="Managing department"
                      {...field}
                    />
                  )}
                />
              </Group>
            </>
          )}

          {/* Action buttons */}
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              type="submit"
              color={getActionColor()}
              leftSection={action === 'retire' ? <IconTrashX size={16} /> : <IconCheck size={16} />}
              loading={isLoading}
              disabled={action === 'create' && !hasValidGeometry}
            >
              {action === 'create'
                ? 'Create Asset'
                : action === 'modify'
                ? 'Save Changes'
                : 'Retire Asset'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

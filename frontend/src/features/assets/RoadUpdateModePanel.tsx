import { useState, useMemo, useEffect, useRef } from 'react';
import { Stack, Text, Button, Group, Checkbox, Paper, Alert, Badge, Divider, Loader, Center } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconEdit, IconTrashX, IconCheck, IconX, IconAlertCircle } from '@tabler/icons-react';
import { useUIStore } from '../../stores/uiStore';
import { useEvent, useEventIntersectingAssets, useArchiveEvent } from '../../hooks/useApi';
import { getRoadAssetLabel } from '../../utils/roadAssetLabel';
import { RoadChangeFormModal } from './RoadChangeFormModal';
import type { RoadAsset } from '@nagoya/shared';

type ChangeAction = 'create' | 'modify' | 'retire';

interface RoadUpdateModePanelProps {
  eventId: string;
  onClose: () => void;
}

export function RoadUpdateModePanel({ eventId, onClose }: RoadUpdateModePanelProps) {
  const {
    roadUpdateSelectedAssetIds,
    toggleRoadUpdateAsset,
    exitRoadUpdateMode,
    cacheAssetDetails,
    setHoveredAsset,
    hoveredAssetId,
  } = useUIStore();

  // Modal state for create/modify/retire
  const [modalAction, setModalAction] = useState<ChangeAction | null>(null);
  const [modalAssetId, setModalAssetId] = useState<string | null>(null);

  // Refs for scroll-to-view when map hover
  const assetRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Scroll to hovered asset when map hover changes
  useEffect(() => {
    if (hoveredAssetId && assetRefs.current.has(hoveredAssetId)) {
      const el = assetRefs.current.get(hoveredAssetId);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [hoveredAssetId]);

  // Fetch event data
  const { data: eventData, isLoading: isLoadingEvent } = useEvent(eventId);
  const event = eventData?.data;

  // Fetch intersecting assets
  const { data: intersectingData, isLoading: isLoadingIntersecting } = useEventIntersectingAssets(eventId);

  // Archive mutation
  const archiveEvent = useArchiveEvent();

  // Merge linked + intersecting assets (deduplicated)
  const allAssets = useMemo(() => {
    const linkedAssets = event?.roadAssets || [];
    const intersecting = intersectingData?.data || [];
    const assetMap = new Map<string, RoadAsset>();

    // Add linked assets first
    linkedAssets.forEach((a: RoadAsset) => assetMap.set(a.id, a));
    // Add intersecting assets (won't overwrite if already present)
    intersecting.forEach((a: RoadAsset) => {
      if (!assetMap.has(a.id)) assetMap.set(a.id, a);
    });

    return Array.from(assetMap.values());
  }, [event?.roadAssets, intersectingData?.data]);

  // Cache assets for map highlighting
  useMemo(() => {
    if (allAssets.length > 0) {
      const cacheEntries = allAssets.map((a) => ({
        id: a.id,
        label: getRoadAssetLabel(a),
        ward: a.ward || undefined,
        roadType: a.roadType,
        geometry: a.geometry,
      }));
      cacheAssetDetails(cacheEntries);
    }
  }, [allAssets, cacheAssetDetails]);

  const isLoading = isLoadingEvent || isLoadingIntersecting;

  const handleFinalize = () => {
    modals.openConfirmModal({
      title: 'Finalize and Archive Event',
      children: (
        <Text size="sm">
          This will archive the event. All road asset changes have been saved.
          Are you sure you want to finalize?
        </Text>
      ),
      labels: { confirm: 'Finalize & Archive', cancel: 'Cancel' },
      confirmProps: { color: 'green' },
      onConfirm: () => {
        archiveEvent.mutate(eventId, {
          onSuccess: () => {
            notifications.show({
              title: 'Event Finalized',
              message: 'Road update completed and event archived.',
              color: 'green',
            });
            exitRoadUpdateMode();
            onClose();
          },
          onError: (error) => {
            notifications.show({
              title: 'Archive Failed',
              message: error instanceof Error ? error.message : 'Failed to archive event',
              color: 'red',
            });
          },
        });
      },
      zIndex: 1100,
    });
  };

  const handleCancel = () => {
    modals.openConfirmModal({
      title: 'Exit Road Update Mode',
      children: (
        <Text size="sm">
          Are you sure you want to exit? Any unsaved changes will be lost.
          You can re-enter Road Update Mode from the event detail panel.
        </Text>
      ),
      labels: { confirm: 'Exit', cancel: 'Stay' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        exitRoadUpdateMode();
        onClose();
      },
      zIndex: 1100,
    });
  };

  const handleCreateNew = () => {
    setModalAction('create');
    setModalAssetId(null);
  };

  const handleModify = (assetId: string) => {
    setModalAction('modify');
    setModalAssetId(assetId);
  };

  const handleRetire = (assetId: string) => {
    setModalAction('retire');
    setModalAssetId(assetId);
  };

  const handleCloseModal = () => {
    setModalAction(null);
    setModalAssetId(null);
  };

  if (isLoading) {
    return (
      <Center h={200}>
        <Loader size="lg" />
      </Center>
    );
  }

  if (!event) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="red">
        Event not found
      </Alert>
    );
  }

  const getRoadTypeBadgeColor = (roadType: string | null | undefined) => {
    switch (roadType) {
      case 'arterial': return 'violet';
      case 'collector': return 'cyan';
      case 'local': return 'lime';
      default: return 'gray';
    }
  };

  return (
    <Stack gap="md">
      {/* Event Info Header */}
      <Paper p="sm" withBorder>
        <Group justify="space-between">
          <div>
            <Text fw={600}>{event.name}</Text>
            <Text size="xs" c="dimmed">
              Decision: {event.postEndDecision === 'permanent-change' ? 'Permanent Change' : event.postEndDecision}
            </Text>
          </div>
          <Badge color="green" variant="light">Road Update Mode</Badge>
        </Group>
      </Paper>

      {/* Create New Button */}
      <Button
        fullWidth
        variant="light"
        color="teal"
        leftSection={<IconPlus size={16} />}
        onClick={handleCreateNew}
      >
        Create New Road Asset
      </Button>

      <Divider label="Affected Assets" labelPosition="center" />

      {/* Asset List */}
      {allAssets.length === 0 ? (
        <Alert icon={<IconAlertCircle size={16} />} color="yellow">
          No assets affected by this event.
        </Alert>
      ) : (
        <Stack gap="xs">
          {allAssets.map((asset) => (
            <Paper
              key={asset.id}
              ref={(el) => {
                if (el) assetRefs.current.set(asset.id, el);
                else assetRefs.current.delete(asset.id);
              }}
              p="xs"
              withBorder
              onMouseEnter={() => setHoveredAsset(asset.id)}
              onMouseLeave={() => setHoveredAsset(null)}
              style={{
                cursor: 'pointer',
                backgroundColor: hoveredAssetId === asset.id ? 'var(--mantine-color-cyan-0)' : undefined,
                borderColor: hoveredAssetId === asset.id ? 'var(--mantine-color-cyan-5)' : undefined,
                transition: 'background-color 0.15s, border-color 0.15s',
              }}
            >
              <Group justify="space-between" wrap="nowrap">
                <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                  <Checkbox
                    checked={roadUpdateSelectedAssetIds.includes(asset.id)}
                    onChange={() => toggleRoadUpdateAsset(asset.id)}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Text size="sm" truncate>
                      {getRoadAssetLabel(asset)}
                    </Text>
                    <Group gap={4}>
                      <Badge size="xs" color={getRoadTypeBadgeColor(asset.roadType)}>
                        {asset.roadType || 'Unknown'}
                      </Badge>
                      {asset.lanes && (
                        <Text size="xs" c="dimmed">{asset.lanes} lanes</Text>
                      )}
                    </Group>
                  </div>
                </Group>
                <Group gap={4} wrap="nowrap">
                  <Button
                    size="compact-xs"
                    variant="light"
                    leftSection={<IconEdit size={12} />}
                    onClick={() => handleModify(asset.id)}
                  >
                    Modify
                  </Button>
                  <Button
                    size="compact-xs"
                    variant="light"
                    color="red"
                    leftSection={<IconTrashX size={12} />}
                    onClick={() => handleRetire(asset.id)}
                  >
                    Retire
                  </Button>
                </Group>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}

      <Divider />

      {/* Action Buttons */}
      <Group justify="space-between">
        <Button
          variant="subtle"
          color="gray"
          leftSection={<IconX size={16} />}
          onClick={handleCancel}
        >
          Cancel
        </Button>
        <Button
          color="green"
          leftSection={<IconCheck size={16} />}
          onClick={handleFinalize}
          loading={archiveEvent.isPending}
        >
          Finalize & Archive
        </Button>
      </Group>

      {/* Road Change Form Modal */}
      {modalAction && (
        <RoadChangeFormModal
          opened={!!modalAction}
          onClose={handleCloseModal}
          action={modalAction}
          assetId={modalAssetId}
          eventId={eventId}
        />
      )}
    </Stack>
  );
}

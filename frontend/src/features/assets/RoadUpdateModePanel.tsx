import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Stack, Text, Group, Paper, Divider, Center, Loader } from '@/components/shims';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { showNotification } from '@/lib/toast';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { IconPlus, IconEdit, IconTrashX, IconCheck, IconX, IconAlertCircle, IconClock } from '@tabler/icons-react';
import { useUIStore } from '../../stores/uiStore';
import { useEvent, useEventIntersectingAssets, useCreateAsset, useUpdateAsset, useRetireAsset } from '../../hooks/useApi';
import { getRoadAssetLabel } from '../../utils/roadAssetLabel';
import { RoadChangeFormModal, type PendingChange } from './RoadChangeFormModal';
import type { RoadAsset } from '@nagoya/shared';

type ChangeAction = 'create' | 'modify' | 'retire';

interface RoadUpdateModePanelProps {
  eventId: string;
  onClose: () => void;
}

export function RoadUpdateModePanel({ eventId, onClose }: RoadUpdateModePanelProps) {
  const { openConfirmModal } = useConfirmDialog();

  const {
    roadUpdateSelectedAssetIds,
    toggleRoadUpdateAsset,
    exitRoadUpdateMode,
    cacheAssetDetails,
    setHoveredAsset,
    hoveredAssetId,
    setFlyToGeometry,
  } = useUIStore();

  // Modal state for create/modify/retire
  const [modalAction, setModalAction] = useState<ChangeAction | null>(null);
  const [modalAssetId, setModalAssetId] = useState<string | null>(null);

  // Pending changes (batch mode - submit all at once when finalizing)
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mutations for batch submission
  const createAsset = useCreateAsset();
  const updateAsset = useUpdateAsset();
  const retireAsset = useRetireAsset();

  // Refs for scroll-to-view when map hover
  const assetRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Scroll to hovered asset when map hover changes
  useEffect(() => {
    if (hoveredAssetId && assetRefs.current.has(hoveredAssetId)) {
      const el = assetRefs.current.get(hoveredAssetId);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [hoveredAssetId]);

  // Track if we've already zoomed to prevent re-zooming on data updates
  const hasZoomedRef = useRef(false);

  // Fetch event data
  const { data: eventData, isLoading: isLoadingEvent } = useEvent(eventId);
  const event = eventData?.data;

  // Zoom to event geometry when panel opens (only once)
  useEffect(() => {
    if (event?.geometry && !hasZoomedRef.current) {
      setFlyToGeometry(event.geometry, true); // closeUp: true to zoom in
      hasZoomedRef.current = true;
    }
  }, [event?.geometry, setFlyToGeometry]);

  // Fetch intersecting assets
  const { data: intersectingData, isLoading: isLoadingIntersecting } = useEventIntersectingAssets(eventId);

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

  // Add a pending change (called from RoadChangeFormModal)
  const handleAddPendingChange = useCallback((change: PendingChange) => {
    setPendingChanges((prev) => {
      // If modifying same asset, replace the previous change
      if (change.action === 'modify' && change.assetId) {
        const filtered = prev.filter((c) => !(c.action === 'modify' && c.assetId === change.assetId));
        return [...filtered, change];
      }
      // If retiring same asset, replace previous changes for that asset
      if (change.action === 'retire' && change.assetId) {
        const filtered = prev.filter((c) => c.assetId !== change.assetId);
        return [...filtered, change];
      }
      return [...prev, change];
    });
  }, []);

  // Submit all pending changes (without archiving)
  const submitPendingChanges = async () => {
    for (const change of pendingChanges) {
      try {
        if (change.action === 'create' && change.data) {
          await createAsset.mutateAsync({
            ...change.data,
            eventId,
          });
        } else if (change.action === 'modify' && change.assetId && change.data) {
          await updateAsset.mutateAsync({
            id: change.assetId,
            data: {
              ...change.data,
              eventId,
            },
          });
        } else if (change.action === 'retire' && change.assetId) {
          await retireAsset.mutateAsync({
            id: change.assetId,
            eventId,
            replacedBy: change.replacedBy,
          });
        }
      } catch (error) {
        throw error; // Re-throw to stop processing
      }
    }
  };

  // Apply pending changes only (no archive)
  const handleApplyChanges = async () => {
    if (pendingChanges.length === 0) return;

    setIsSubmitting(true);
    try {
      await submitPendingChanges();
      showNotification({
        title: 'Changes Applied',
        message: `${pendingChanges.length} change${pendingChanges.length > 1 ? 's' : ''} applied successfully.`,
        color: 'green',
      });
      setPendingChanges([]); // Clear pending changes after successful submission
    } catch (error) {
      showNotification({
        title: 'Apply Failed',
        message: error instanceof Error ? error.message : 'Failed to apply changes',
        color: 'red',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    openConfirmModal({
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
      <Alert variant="destructive">
        <IconAlertCircle size={16} />
        <AlertDescription>Event not found</AlertDescription>
      </Alert>
    );
  }

  const getRoadTypeBadgeColor = (roadType: string | null | undefined) => {
    switch (roadType) {
      case 'arterial': return 'bg-violet-100 text-violet-800';
      case 'collector': return 'bg-cyan-100 text-cyan-800';
      case 'local': return 'bg-lime-100 text-lime-800';
      default: return 'bg-gray-100 text-gray-800';
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
          <Badge variant="secondary" className="bg-green-100 text-green-800">Road Update Mode</Badge>
        </Group>
      </Paper>

      {/* Create New Button */}
      <Button
        variant="outline"
        className="w-full"
        onClick={handleCreateNew}
      >
        <IconPlus size={16} className="mr-2" />
        Create New Road Asset
      </Button>

      <Divider label="Affected Assets" />

      {/* Asset List */}
      {allAssets.length === 0 ? (
        <Alert>
          <IconAlertCircle size={16} />
          <AlertDescription>No assets affected by this event.</AlertDescription>
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
              className="cursor-pointer transition-colors"
              onMouseEnter={() => setHoveredAsset(asset.id)}
              onMouseLeave={() => setHoveredAsset(null)}
              style={{
                backgroundColor: hoveredAssetId === asset.id ? 'hsl(var(--accent))' : undefined,
                borderColor: hoveredAssetId === asset.id ? 'hsl(var(--ring))' : undefined,
              }}
            >
              <Group justify="space-between" className="flex-nowrap">
                <Group gap="xs" className="flex-nowrap flex-1 min-w-0">
                  <Checkbox
                    checked={roadUpdateSelectedAssetIds.includes(asset.id)}
                    onCheckedChange={() => toggleRoadUpdateAsset(asset.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <Text size="sm" truncate>
                      {getRoadAssetLabel(asset)}
                    </Text>
                    <Group gap={4}>
                      <Badge variant="secondary" className={`text-xs ${getRoadTypeBadgeColor(asset.roadType)}`}>
                        {asset.roadType || 'Unknown'}
                      </Badge>
                      {asset.lanes && (
                        <Text size="xs" c="dimmed">{asset.lanes} lanes</Text>
                      )}
                    </Group>
                  </div>
                </Group>
                <Group gap={4} className="flex-nowrap">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs px-2"
                    onClick={() => handleModify(asset.id)}
                  >
                    <IconEdit size={12} className="mr-1" />
                    Modify
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-6 text-xs px-2"
                    onClick={() => handleRetire(asset.id)}
                  >
                    <IconTrashX size={12} className="mr-1" />
                    Retire
                  </Button>
                </Group>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}

      <Divider />

      {/* Pending Changes Summary */}
      {pendingChanges.length > 0 && (
        <Alert>
          <IconClock size={16} />
          <AlertDescription>
            {pendingChanges.length} pending change{pendingChanges.length > 1 ? 's' : ''}
          </AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      <Group justify="space-between">
        <Button
          variant="ghost"
          onClick={handleCancel}
          disabled={isSubmitting}
        >
          <IconX size={16} className="mr-2" />
          Cancel
        </Button>
        <Button
          onClick={handleApplyChanges}
          disabled={pendingChanges.length === 0 || isSubmitting}
        >
          <IconCheck size={16} className="mr-2" />
          {isSubmitting ? 'Applying...' : 'Apply Changes'}
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
          onSavePending={handleAddPendingChange}
        />
      )}
    </Stack>
  );
}

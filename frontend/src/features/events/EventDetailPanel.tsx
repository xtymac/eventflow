import { useState } from 'react';
import {
  Stack,
  Group,
  Text,
  Badge,
  Divider,
  ActionIcon,
  Loader,
  Center,
  Paper,
} from '@mantine/core';
import { IconArrowLeft, IconMapPin, IconAlertCircle, IconExternalLink } from '@tabler/icons-react';
import { useEvent } from '../../hooks/useApi';
import type { AssetTypeRef } from '@nagoya/shared';

// Asset type labels for display
const ASSET_TYPE_LABELS: Record<AssetTypeRef, string> = {
  road: '道路',
  river: '河川',
  streetlight: '街路灯',
  greenspace: '緑地',
  street_tree: '街路樹',
  park_facility: '公園施設',
  pavement_section: '舗装区間',
  pump_station: 'ポンプ場',
};
import { useUIStore, type AssetType } from '../../stores/uiStore';
import type { EventStatus } from '@nagoya/shared';
import dayjs from 'dayjs';
import { EventActionButtons } from './EventActionButtons';
import { AffectedAssetsList } from './AffectedAssetsList';
import { WorkOrdersListSection } from '../workorders/WorkOrdersListSection';
import { WorkOrderDetailModal } from '../workorders/WorkOrderDetailModal';
import { WorkOrderCreateModal } from '../workorders/WorkOrderCreateModal';

const STATUS_COLORS: Record<EventStatus, string> = {
  planned: 'blue',
  active: 'yellow',
  pending_review: 'orange',
  closed: 'gray',
  archived: 'dark',
  cancelled: 'red',
};

const STATUS_LABELS: Record<EventStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  pending_review: 'Pending Review',
  closed: 'Closed',
  archived: 'Archived',
  cancelled: 'Cancelled',
};

const DECISION_LABELS: Record<string, string> = {
  pending: 'Pending',
  'no-change': 'No Change',
  'permanent-change': 'Permanent Change',
};

interface EventDetailPanelProps {
  eventId: string;
  showBackButton?: boolean;
}

export function EventDetailPanel({ eventId, showBackButton = true }: EventDetailPanelProps) {
  const { data, isLoading, error } = useEvent(eventId);
  const { selectEvent, selectAsset } = useUIStore();

  // WorkOrder modal state (local to this component)
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);
  const [isCreateWorkOrderOpen, setIsCreateWorkOrderOpen] = useState(false);

  if (isLoading) {
    return (
      <Center py="md">
        <Loader size="sm" />
      </Center>
    );
  }

  if (error || !data?.data) {
    return (
      <Center py="md">
        <Text c="red" size="sm">Failed to load event details</Text>
      </Center>
    );
  }

  const event = data.data;
  // roadAssets is now populated from JOIN query in the backend
  const affectedAssets = event.roadAssets || [];

  return (
    <Stack gap="sm">
      {/* Header with back button */}
      {showBackButton && (
        <Group gap="xs">
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={() => selectEvent(null)}
            aria-label="Back to list"
          >
            <IconArrowLeft size={18} />
          </ActionIcon>
          <Text fw={600} size="md">
            Event Details
          </Text>
        </Group>
      )}

      <Paper p="sm" withBorder radius="sm">
        <Stack gap="xs">
          <Group justify="space-between" align="flex-start">
            <Stack gap="xs" style={{ flex: 1 }}>
              <Text fw={600} size="lg" lineClamp={2} style={{ lineHeight: 1.2 }}>
                {event.name}
              </Text>
              <Text size="xs" c="dimmed" ff="monospace">
                {event.id}
              </Text>
            </Stack>
            <Group gap={4}>
              {event.archivedAt && (
                <Badge color="gray" size="md" variant="light">
                  Archived
                </Badge>
              )}
              <Badge color={STATUS_COLORS[event.status]} size="md" variant="light">
                {STATUS_LABELS[event.status]}
              </Badge>
            </Group>
          </Group>

          <Divider />

          {/* Info rows */}
          <Stack gap="sm">
            <Group gap="md">
              <Group gap={4}>
                <IconAlertCircle size={16} style={{ opacity: 0.5 }} />
                <Text size="sm" c="dimmed">
                  {event.restrictionType}
                </Text>
              </Group>
              {event.ward && (
                <Group gap={4}>
                  <IconMapPin size={16} style={{ opacity: 0.5 }} />
                  <Text size="sm" c="dimmed">
                    {event.ward}
                  </Text>
                </Group>
              )}
            </Group>

            <Stack gap={4}>
              <Text size="sm" c="dimmed">Schedule</Text>
              <Text size="sm">
                {dayjs(event.startDate).format('YYYY/MM/DD')} - {dayjs(event.endDate).format('YYYY/MM/DD')}
              </Text>
            </Stack>

            <Stack gap={4}>
              <Text size="sm" c="dimmed">Department</Text>
              <Text size="sm">
                {event.department || 'N/A'}
              </Text>
            </Stack>

            <Stack gap={4}>
              <Text size="sm" c="dimmed">Post-End Decision</Text>
              <Text
                size="sm"
                c={event.postEndDecision === 'permanent-change' ? 'green' : event.postEndDecision === 'no-change' ? 'dimmed' : 'orange'}
                fw={500}
              >
                {DECISION_LABELS[event.postEndDecision || 'pending']}
              </Text>
            </Stack>

            {event.createdBy && (
               <Stack gap={4}>
                <Text size="sm" c="dimmed">Created By</Text>
                <Text size="sm">{event.createdBy}</Text>
              </Stack>
            )}

            {/* Linked Asset (refAsset) */}
            {event.refAssetId && event.refAssetType && (
              <Stack gap={4}>
                <Text size="sm" c="dimmed">関連資産</Text>
                <Badge
                  variant="light"
                  color="blue"
                  style={{ cursor: 'pointer', maxWidth: 'fit-content' }}
                  onClick={() => selectAsset(event.refAssetId!, event.refAssetType as AssetType | null)}
                  rightSection={<IconExternalLink size={12} />}
                >
                  {ASSET_TYPE_LABELS[event.refAssetType as AssetTypeRef]}: {event.refAssetId}
                </Badge>
              </Stack>
            )}
          </Stack>

          <Divider />

          {/* Action buttons */}
          <EventActionButtons event={event} />
        </Stack>
      </Paper>

      {/* Affected assets */}
      {affectedAssets.length > 0 && (
        <Paper p="sm" withBorder radius="sm">
          <AffectedAssetsList assets={affectedAssets} />
        </Paper>
      )}

      {/* Work Orders (Phase 1) */}
      <Paper p="sm" withBorder radius="sm">
        <WorkOrdersListSection
          eventId={eventId}
          onCreateWorkOrder={() => setIsCreateWorkOrderOpen(true)}
          onSelectWorkOrder={(id) => setSelectedWorkOrderId(id)}
        />
      </Paper>

      {/* WorkOrder Modals */}
      <WorkOrderDetailModal
        workOrderId={selectedWorkOrderId}
        onClose={() => setSelectedWorkOrderId(null)}
      />
      <WorkOrderCreateModal
        eventId={isCreateWorkOrderOpen ? eventId : null}
        onClose={() => setIsCreateWorkOrderOpen(false)}
      />
    </Stack>
  );
}

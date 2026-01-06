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
import { IconArrowLeft, IconMapPin, IconAlertCircle } from '@tabler/icons-react';
import { useEvent } from '../../hooks/useApi';
import { useUIStore } from '../../stores/uiStore';
import type { EventStatus } from '@nagoya/shared';
import dayjs from 'dayjs';
import { EventActionButtons } from './EventActionButtons';
import { AffectedAssetsList } from './AffectedAssetsList';
import { InspectionsListSection } from '../inspections/InspectionsListSection';

const STATUS_COLORS: Record<EventStatus, string> = {
  planned: 'blue',
  active: 'yellow',
  ended: 'gray',
  cancelled: 'red',
};

const STATUS_LABELS: Record<EventStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  ended: 'Ended',
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
  const { selectEvent } = useUIStore();

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

      {/* Inspections */}
      <Paper p="sm" withBorder radius="sm">
        <InspectionsListSection eventId={eventId} />
      </Paper>
    </Stack>
  );
}

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
import { IconArrowLeft } from '@tabler/icons-react';
import { useEvent } from '../../hooks/useApi';
import { useUIStore } from '../../stores/uiStore';
import type { EventStatus } from '@nagoya/shared';
import dayjs from 'dayjs';
import { EventActionButtons } from './EventActionButtons';
import { AffectedAssetsList } from './AffectedAssetsList';

const STATUS_COLORS: Record<EventStatus, string> = {
  planned: 'blue',
  active: 'yellow',
  ended: 'gray',
};

const STATUS_LABELS: Record<EventStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  ended: 'Ended',
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
            <Text fw={600} size="lg" lineClamp={2} style={{ flex: 1, lineHeight: 1.2 }}>
              {event.name}
            </Text>
            <Badge color={STATUS_COLORS[event.status]} size="md" variant="light">
              {STATUS_LABELS[event.status]}
            </Badge>
          </Group>

          <Divider />

          {/* Info rows */}
          <Stack gap="sm">
            <Group gap="xs">
              <Badge variant="light" color="indigo" size="sm">
                {event.restrictionType}
              </Badge>
              {event.ward && (
                <Badge variant="light" size="sm" color="gray">
                  {event.ward}
                </Badge>
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
              <Badge
                size="sm"
                variant="light"
                color={event.postEndDecision === 'permanent-change' ? 'green' : event.postEndDecision === 'no-change' ? 'gray' : 'orange'}
              >
                {DECISION_LABELS[event.postEndDecision || 'pending']}
              </Badge>
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
    </Stack>
  );
}

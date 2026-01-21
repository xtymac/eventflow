import { Paper, Text, Stack, Group, Box } from '@mantine/core';
import dayjs from 'dayjs';

interface HoveredEventData {
  id: string;
  name: string;
  status: string;
  color: string;
  startDate?: string;
  endDate?: string;
  department?: string;
  restrictionType?: string;
  affectedAssetsCount?: number;
}

interface EventMapTooltipProps {
  event: HoveredEventData;
  position: { x: number; y: number };
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr) return 'N/A';
  return dayjs(dateStr).format('MM/DD');
};

export function EventMapTooltip({
  event,
  position,
  onMouseEnter,
  onMouseLeave,
}: EventMapTooltipProps) {
  return (
    <Paper
      shadow="md"
      p="sm"
      radius="sm"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed',
        left: position.x + 12,
        top: position.y + 12,
        zIndex: 1000,
        pointerEvents: 'auto',
        minWidth: 200,
        maxWidth: 280,
      }}
    >
      <Stack gap="xs">
        <Text fw={700} size="sm" lineClamp={2}>
          {event.name}
        </Text>

        <Group gap="xs">
          <Box
            style={{
              width: 8,
              height: 8,
              backgroundColor: event.color,
              borderRadius: '50%',
            }}
          />
          <Text size="xs" fw={600} tt="capitalize">
            {event.status}
          </Text>
        </Group>

        <Stack gap={2}>
          <Text size="xs" c="dimmed">
            <strong>Dates:</strong> {formatDate(event.startDate)} - {formatDate(event.endDate)}
          </Text>
          <Text size="xs" c="dimmed">
            <strong>Department:</strong> {event.department || 'N/A'}
          </Text>
          <Text size="xs" c="dimmed">
            <strong>Type:</strong> {event.restrictionType || 'N/A'}
          </Text>
          <Text size="xs" c="dimmed">
            <strong>Affected Assets:</strong> {event.affectedAssetsCount || 0}
          </Text>
        </Stack>
      </Stack>
    </Paper>
  );
}

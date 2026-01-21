import { Box, Paper, Group, Text, ActionIcon, ScrollArea, Badge } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { RoadUpdateModePanel } from './RoadUpdateModePanel';

interface RoadUpdateModeOverlayProps {
  eventId: string;
  onClose: () => void;
}

export function RoadUpdateModeOverlay({ eventId, onClose }: RoadUpdateModeOverlayProps) {
  return (
    <Box
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 200,
      }}
    >
      <Paper
        shadow="md"
        radius="md"
        p="md"
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          bottom: 16,
          width: 420,
          display: 'flex',
          flexDirection: 'column',
          pointerEvents: 'auto',
        }}
      >
        <Group justify="space-between" mb="xs">
          <div>
            <Group gap="xs">
              <Text fw={600} size="lg">
                Road Update Mode
              </Text>
              <Badge color="teal" size="sm">Active</Badge>
            </Group>
            <Text size="xs" c="dimmed">
              Create, modify, or retire road assets affected by this event.
            </Text>
          </div>
          <ActionIcon variant="subtle" onClick={onClose} aria-label="Close road update mode">
            <IconX size={16} />
          </ActionIcon>
        </Group>

        <ScrollArea offsetScrollbars scrollbarSize={8} style={{ flex: 1 }}>
          <RoadUpdateModePanel eventId={eventId} onClose={onClose} />
        </ScrollArea>
      </Paper>
    </Box>
  );
}

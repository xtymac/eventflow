import { Box, Paper, Group, Text, ActionIcon, ScrollArea } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { EventForm } from './EventForm';

interface EventEditorOverlayProps {
  eventId?: string | null;
  duplicateEventId?: string | null;
  onClose: () => void;
}

export function EventEditorOverlay({ eventId, duplicateEventId, onClose }: EventEditorOverlayProps) {
  const title = eventId ? 'Edit Event' : duplicateEventId ? 'Duplicate Event' : 'Create Event';
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
            <Text fw={600} size="lg">
              {title}
            </Text>
            <Text size="xs" c="dimmed">
              Click road lines on the map to add or remove assets.
            </Text>
          </div>
          <ActionIcon variant="subtle" onClick={onClose} aria-label="Close editor">
            <IconX size={16} />
          </ActionIcon>
        </Group>

        <ScrollArea offsetScrollbars scrollbarSize={8} style={{ flex: 1 }}>
          <EventForm eventId={eventId} onClose={onClose} />
        </ScrollArea>
      </Paper>
    </Box>
  );
}

import { Box, Paper, Group, Text } from '@/components/shims';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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
        className="absolute top-4 right-4 bottom-4 w-[420px] flex flex-col"
        style={{ pointerEvents: 'auto' }}
      >
        <Group justify="space-between" mb="xs">
          <div>
            <Group gap="xs">
              <Text fw={600} size="lg">
                Road Update Mode
              </Text>
              <Badge variant="secondary" className="bg-teal-100 text-teal-800">Active</Badge>
            </Group>
            <Text size="xs" c="dimmed">
              Create, modify, or retire road assets affected by this event.
            </Text>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close road update mode">
            <IconX size={16} />
          </Button>
        </Group>

        <ScrollArea className="flex-1">
          <RoadUpdateModePanel eventId={eventId} onClose={onClose} />
        </ScrollArea>
      </Paper>
    </Box>
  );
}

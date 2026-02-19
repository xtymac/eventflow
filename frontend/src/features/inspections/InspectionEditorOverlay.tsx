import { Box, Paper, Group, Text } from '@/components/shims';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { IconX } from '@tabler/icons-react';
import { InspectionForm } from './InspectionForm';

interface InspectionEditorOverlayProps {
  inspectionId?: string | null;
  prefillEventId?: string | null;
  prefillAssetId?: string | null;
  onClose: () => void;
}

export function InspectionEditorOverlay({
  inspectionId,
  prefillEventId,
  prefillAssetId,
  onClose,
}: InspectionEditorOverlayProps) {
  const title = inspectionId ? 'Edit Inspection' : 'Create Inspection';

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
              Click on the map to set the inspection location.
            </Text>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close editor">
            <IconX size={16} />
          </Button>
        </Group>

        <ScrollArea className="flex-1">
          <InspectionForm
            inspectionId={inspectionId}
            prefillEventId={prefillEventId}
            prefillAssetId={prefillAssetId}
            onClose={onClose}
          />
        </ScrollArea>
      </Paper>
    </Box>
  );
}

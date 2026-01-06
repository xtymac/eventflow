import { Box, Paper, Group, Text, ActionIcon, ScrollArea } from '@mantine/core';
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
          <ActionIcon variant="subtle" onClick={onClose} aria-label="Close editor">
            <IconX size={16} />
          </ActionIcon>
        </Group>

        <ScrollArea offsetScrollbars scrollbarSize={8} style={{ flex: 1 }}>
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

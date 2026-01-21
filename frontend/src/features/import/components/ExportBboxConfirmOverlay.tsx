/**
 * Export Bbox Confirm Overlay Component
 *
 * Shows at the bottom of the map when user is selecting export area.
 * User can pan/zoom the map and then confirm or cancel.
 */

import { Paper, Stack, Group, Text, Button } from '@mantine/core';
import { IconMap, IconCheck, IconX } from '@tabler/icons-react';
import { useUIStore } from '../../../stores/uiStore';

export function ExportBboxConfirmOverlay() {
  const isExportBboxConfirming = useUIStore((s) => s.isExportBboxConfirming);
  const confirmExportBbox = useUIStore((s) => s.confirmExportBbox);
  const cancelExportBboxConfirmation = useUIStore((s) => s.cancelExportBboxConfirmation);

  if (!isExportBboxConfirming) return null;

  return (
    <Paper
      shadow="md"
      p="md"
      style={{
        position: 'absolute',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        minWidth: 320,
      }}
    >
      <Stack gap="sm">
        <Group gap="xs">
          <IconMap size={18} />
          <Text fw={500}>Select Export Area</Text>
        </Group>
        <Text size="sm" c="dimmed">
          Pan and zoom the map to select the area you want to export,
          then click Confirm.
        </Text>
        <Group justify="flex-end" gap="sm">
          <Button
            variant="subtle"
            leftSection={<IconX size={14} />}
            onClick={cancelExportBboxConfirmation}
          >
            Cancel
          </Button>
          <Button
            leftSection={<IconCheck size={14} />}
            onClick={confirmExportBbox}
          >
            Confirm
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

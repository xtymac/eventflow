/**
 * Import Preview Overlay
 *
 * Shows at bottom of map when previewing roads from the import review.
 * Allows user to navigate through modified roads and return to the wizard.
 */

import { Paper, Stack, Group, Text, Button, Badge, ActionIcon } from '@mantine/core';
import { IconArrowBack, IconMap, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { useUIStore } from '../../../stores/uiStore';
import { useMapStore } from '../../../stores/mapStore';

export function ImportPreviewOverlay() {
  const isImportPreviewMode = useUIStore((s) => s.isImportPreviewMode);
  const importPreviewLabel = useUIStore((s) => s.importPreviewLabel);
  const importPreviewFeatures = useUIStore((s) => s.importPreviewFeatures);
  const importPreviewIndex = useUIStore((s) => s.importPreviewIndex);
  const endImportPreview = useUIStore((s) => s.endImportPreview);
  const nextImportPreview = useUIStore((s) => s.nextImportPreview);
  const previousImportPreview = useUIStore((s) => s.previousImportPreview);
  const setImportAreaHighlight = useMapStore((s) => s.setImportAreaHighlight);

  if (!isImportPreviewMode || importPreviewFeatures.length === 0) return null;

  const currentFeature = importPreviewFeatures[importPreviewIndex];
  const props = currentFeature?.properties as Record<string, unknown> | null;
  const roadType = props?.roadType as string | undefined;
  const ward = props?.ward as string | undefined;
  const totalCount = importPreviewFeatures.length;
  const hasMultiple = totalCount > 1;

  const handleNext = () => {
    nextImportPreview();
    // Update highlight
    const nextIndex = (importPreviewIndex + 1) % totalCount;
    const nextFeature = importPreviewFeatures[nextIndex];
    if (nextFeature.geometry) {
      const nextProps = nextFeature.properties as Record<string, unknown> | null;
      const nextLabel = (nextProps?.name as string) || (nextProps?.id as string) || 'Unnamed Road';
      setImportAreaHighlight({ geometry: nextFeature.geometry, label: nextLabel });
    }
  };

  const handlePrevious = () => {
    previousImportPreview();
    // Update highlight
    const prevIndex = importPreviewIndex === 0 ? totalCount - 1 : importPreviewIndex - 1;
    const prevFeature = importPreviewFeatures[prevIndex];
    if (prevFeature.geometry) {
      const prevProps = prevFeature.properties as Record<string, unknown> | null;
      const prevLabel = (prevProps?.name as string) || (prevProps?.id as string) || 'Unnamed Road';
      setImportAreaHighlight({ geometry: prevFeature.geometry, label: prevLabel });
    }
  };

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
        minWidth: 400,
        maxWidth: 520,
      }}
    >
      <Stack gap="sm">
        <Group justify="space-between">
          <Group gap="xs">
            <IconMap size={18} />
            <Text fw={500}>Previewing Changes</Text>
          </Group>
          {hasMultiple && (
            <Badge variant="light" color="gray">
              {importPreviewIndex + 1} / {totalCount}
            </Badge>
          )}
        </Group>

        <Group gap="xs" wrap="wrap">
          <Text size="sm" fw={500} style={{ maxWidth: 280 }} lineClamp={1}>
            {importPreviewLabel || 'Unnamed Road'}
          </Text>
          {roadType && (
            <Badge size="sm" variant="light">
              {roadType}
            </Badge>
          )}
          {ward && (
            <Badge size="sm" variant="light" color="gray">
              {ward}
            </Badge>
          )}
        </Group>

        <Text size="xs" c="dimmed">
          {hasMultiple
            ? 'Use arrows to browse through all modified roads.'
            : 'This road will be modified when you publish the import.'}
        </Text>

        <Group justify="space-between" gap="sm">
          {hasMultiple ? (
            <Group gap="xs">
              <ActionIcon
                variant="light"
                size="lg"
                onClick={handlePrevious}
                aria-label="Previous road"
              >
                <IconChevronLeft size={18} />
              </ActionIcon>
              <ActionIcon
                variant="light"
                size="lg"
                onClick={handleNext}
                aria-label="Next road"
              >
                <IconChevronRight size={18} />
              </ActionIcon>
            </Group>
          ) : (
            <div />
          )}
          <Button
            leftSection={<IconArrowBack size={16} />}
            onClick={() => {
              setImportAreaHighlight(null);  // Clear highlight
              endImportPreview();            // Restore wizard
            }}
          >
            Back to Review
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

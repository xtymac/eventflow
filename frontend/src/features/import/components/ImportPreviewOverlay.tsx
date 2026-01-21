/**
 * Import Preview Overlay
 *
 * Shows at bottom of map when previewing roads from the import review.
 * Allows user to navigate through modified roads and return to the wizard.
 * Includes a backdrop that dims and blocks interactions with other UI elements.
 */

import { Paper, Stack, Group, Text, Button, Badge, Portal, Box } from '@mantine/core';
import { IconArrowBack, IconMap } from '@tabler/icons-react';
import { useUIStore } from '../../../stores/uiStore';
import { useMapStore } from '../../../stores/mapStore';

// Read sidebar width from localStorage (matches App.tsx)
const SIDEBAR_WIDTH_KEY = 'eventflow-sidebar-width';
const DEFAULT_SIDEBAR_WIDTH = 400;

function getSidebarWidth(): number {
  try {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_SIDEBAR_WIDTH;
  } catch {
    return DEFAULT_SIDEBAR_WIDTH;
  }
}

export function ImportPreviewOverlay() {
  const isImportPreviewMode = useUIStore((s) => s.isImportPreviewMode);
  const isHistoricalPreviewMode = useUIStore((s) => s.isHistoricalPreviewMode);
  const importPreviewLabel = useUIStore((s) => s.importPreviewLabel);
  const importPreviewFeatures = useUIStore((s) => s.importPreviewFeatures);
  const importPreviewIndex = useUIStore((s) => s.importPreviewIndex);
  const currentImportVersionId = useUIStore((s) => s.currentImportVersionId);
  const endImportPreview = useUIStore((s) => s.endImportPreview);
  // Arrow navigation removed - users should click rows in table instead
  const setImportAreaHighlight = useMapStore((s) => s.setImportAreaHighlight);

  // Get current sidebar width for overlay positioning
  const sidebarWidth = getSidebarWidth();

  // Determine if we're in import wizard mode or historical view mode
  const isImportWizardMode = !!currentImportVersionId;

  // Don't show overlay in historical preview mode (sidebar handles navigation)
  if (isHistoricalPreviewMode) return null;
  if (!isImportPreviewMode || importPreviewFeatures.length === 0) return null;

  const currentFeature = importPreviewFeatures[importPreviewIndex];
  const props = currentFeature?.properties as Record<string, unknown> | null;
  const roadType = props?.roadType as string | undefined;
  const ward = props?.ward as string | undefined;
  const changeType = props?._changeType as 'added' | 'updated' | 'removed' | undefined;
  const isScopeAreaPreview = props?.id === 'scope-area';

  // Change type badge configuration
  const changeTypeBadge = changeType ? {
    added: { label: 'Added', color: 'green' },
    updated: { label: 'Updated', color: 'blue' },
    removed: { label: 'Removed', color: 'orange' },
  }[changeType] : null;

  const handleClose = () => {
    setImportAreaHighlight(null);
    endImportPreview();
  };

  return (
    <>
      {/* Backdrop overlays - blocks interactions with header and sidebar during preview */}
      <Portal>
        {/* Header overlay */}
        <Box
          onClick={handleClose}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: 60,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 150,
            cursor: 'pointer',
          }}
        />
        {/* Left sidebar overlay */}
        <Box
          onClick={handleClose}
          style={{
            position: 'fixed',
            top: 60,
            left: 0,
            bottom: 0,
            width: sidebarWidth,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 150,
            cursor: 'pointer',
          }}
        />
      </Portal>

      {/* Control panel - positioned above the backdrop */}
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
        <Group gap="xs">
          <IconMap size={18} />
          <Text fw={500}>
            {isScopeAreaPreview ? 'Import Scope Area' : 'Previewing Changes'}
          </Text>
        </Group>

        {!isScopeAreaPreview && (
          <Group gap="xs" wrap="wrap">
            {changeTypeBadge && (
              <Badge size="sm" color={changeTypeBadge.color}>
                {changeTypeBadge.label}
              </Badge>
            )}
            <Text size="sm" fw={500} style={{ maxWidth: 240 }} lineClamp={1}>
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
        )}

        <Text size="xs" c="dimmed">
          {isScopeAreaPreview
            ? 'This is the geographic area covered by your import file.'
            : isImportWizardMode
              ? 'Click rows in the table to preview other roads.'
              : 'This road was modified in this import.'}
        </Text>

        <Group justify="flex-end" gap="sm">
          <Button
            leftSection={<IconArrowBack size={16} />}
            onClick={handleClose}
          >
            {isScopeAreaPreview
              ? 'Back to Import'
              : isImportWizardMode
                ? 'Back to Review'
                : 'Close Preview'}
          </Button>
        </Group>
      </Stack>
      </Paper>
    </>
  );
}

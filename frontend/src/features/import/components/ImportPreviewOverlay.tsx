/**
 * Import Preview Overlay
 *
 * Shows at bottom of map when previewing roads from the import review.
 * Allows user to navigate through modified roads and return to the wizard.
 * Includes a backdrop that dims and blocks interactions with other UI elements.
 */

import { createPortal } from 'react-dom';
import { Paper, Stack, Group, Text, Box } from '@/components/shims';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

const CHANGE_TYPE_BADGE: Record<string, { label: string; className: string }> = {
  added: { label: 'Added', className: 'bg-green-100 text-green-800' },
  updated: { label: 'Updated', className: 'bg-blue-100 text-blue-800' },
  removed: { label: 'Removed', className: 'bg-orange-100 text-orange-800' },
};

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
  const changeTypeBadge = changeType ? CHANGE_TYPE_BADGE[changeType] : null;

  const handleClose = () => {
    setImportAreaHighlight(null);
    endImportPreview();
  };

  return (
    <>
      {/* Backdrop overlays - blocks interactions with header and sidebar during preview */}
      {createPortal(
        <>
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
        </>,
        document.body
      )}

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
              <Badge className={changeTypeBadge.className}>
                {changeTypeBadge.label}
              </Badge>
            )}
            <Text size="sm" fw={500} style={{ maxWidth: 240 }} lineClamp={1}>
              {importPreviewLabel || 'Unnamed Road'}
            </Text>
            {roadType && (
              <Badge variant="secondary">
                {roadType}
              </Badge>
            )}
            {ward && (
              <Badge variant="outline">
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
            onClick={handleClose}
          >
            <IconArrowBack size={16} className="mr-1" />
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

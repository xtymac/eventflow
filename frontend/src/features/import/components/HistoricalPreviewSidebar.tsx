/**
 * Historical Preview Sidebar
 *
 * Right sidebar shown during historical preview mode.
 * Displays change summary and allows navigation through modified features.
 */

import {
  Stack,
  Text,
  Group,
  Card,
  Badge,
  Button,
  ActionIcon,
  ScrollArea,
  Paper,
  Loader,
  Alert,
  Divider,
  Box,
} from '@mantine/core';
import {
  IconX,
  IconPlus,
  IconPencil,
  IconArchive,
  IconChevronLeft,
  IconChevronRight,
  IconInfoCircle,
} from '@tabler/icons-react';
import { useHistoricalDiff } from '../../../hooks/useImportVersions';
import { useUIStore } from '../../../stores/uiStore';
import { useMapStore } from '../../../stores/mapStore';

interface FeatureProperties {
  id?: string;
  name?: string;
  roadType?: string;
  ward?: string;
  _changeType?: 'added' | 'updated' | 'removed';
  [key: string]: unknown;
}

interface ChangeCountCardProps {
  icon: React.ReactNode;
  count: number;
  label: string;
  color: string;
  isActive: boolean;
  onClick: () => void;
}

function ChangeCountCard({ icon, count, label, color, isActive, onClick }: ChangeCountCardProps) {
  return (
    <Paper
      withBorder
      p="xs"
      radius="md"
      onClick={onClick}
      style={{
        cursor: count > 0 ? 'pointer' : 'default',
        borderColor: isActive ? `var(--mantine-color-${color}-5)` : undefined,
        backgroundColor: isActive ? `var(--mantine-color-${color}-0)` : undefined,
        opacity: count === 0 ? 0.5 : 1,
        flex: 1,
        textAlign: 'center',
        transition: 'all 0.15s',
      }}
    >
      <Group justify="center" gap={4}>
        {icon}
        <Text fw={700} size="md" ff="monospace">
          {count.toLocaleString()}
        </Text>
      </Group>
      <Text size="xs" c="dimmed">{label}</Text>
    </Paper>
  );
}

export function HistoricalPreviewSidebar() {
  const isHistoricalPreviewMode = useUIStore((s) => s.isHistoricalPreviewMode);
  const historicalPreviewVersionId = useUIStore((s) => s.historicalPreviewVersionId);
  const historicalPreviewDisplayNumber = useUIStore((s) => s.historicalPreviewDisplayNumber);
  const exitHistoricalPreview = useUIStore((s) => s.exitHistoricalPreview);
  const importPreviewFeatures = useUIStore((s) => s.importPreviewFeatures);
  const importPreviewIndex = useUIStore((s) => s.importPreviewIndex);
  const importPreviewLabel = useUIStore((s) => s.importPreviewLabel);
  const nextImportPreview = useUIStore((s) => s.nextImportPreview);
  const previousImportPreview = useUIStore((s) => s.previousImportPreview);
  const setImportAreaHighlight = useMapStore((s) => s.setImportAreaHighlight);

  const { data: diffData, isLoading, error } = useHistoricalDiff(
    isHistoricalPreviewMode ? historicalPreviewVersionId : null
  );

  if (!isHistoricalPreviewMode) return null;

  const diff = diffData?.data;
  const totalCount = importPreviewFeatures.length;
  const hasMultiple = totalCount > 1;
  const currentFeature = importPreviewFeatures[importPreviewIndex];
  const props = currentFeature?.properties as FeatureProperties | null;
  const changeType = props?._changeType;

  const changeTypeBadge = changeType ? {
    added: { label: 'Added', color: 'green' },
    updated: { label: 'Updated', color: 'blue' },
    removed: { label: 'Removed', color: 'orange' },
  }[changeType] : null;

  const handleNext = () => {
    nextImportPreview();
    const nextIndex = (importPreviewIndex + 1) % totalCount;
    const nextFeature = importPreviewFeatures[nextIndex];
    if (nextFeature.geometry) {
      const nextProps = nextFeature.properties as FeatureProperties | null;
      const nextLabel = nextProps?.name || nextProps?.id || 'Unnamed Road';
      setImportAreaHighlight({ geometry: nextFeature.geometry, label: nextLabel });
    }
  };

  const handlePrevious = () => {
    previousImportPreview();
    const prevIndex = importPreviewIndex === 0 ? totalCount - 1 : importPreviewIndex - 1;
    const prevFeature = importPreviewFeatures[prevIndex];
    if (prevFeature.geometry) {
      const prevProps = prevFeature.properties as FeatureProperties | null;
      const prevLabel = prevProps?.name || prevProps?.id || 'Unnamed Road';
      setImportAreaHighlight({ geometry: prevFeature.geometry, label: prevLabel });
    }
  };

  const handleClose = () => {
    setImportAreaHighlight(null);
    exitHistoricalPreview();
  };

  // Jump to a specific change type
  const jumpToChangeType = (type: 'added' | 'updated' | 'removed') => {
    const targetIndex = importPreviewFeatures.findIndex(
      (f) => (f.properties as FeatureProperties)?._changeType === type
    );
    if (targetIndex >= 0 && targetIndex !== importPreviewIndex) {
      const feature = importPreviewFeatures[targetIndex];
      if (feature.geometry) {
        const featureProps = feature.properties as FeatureProperties | null;
        const label = featureProps?.name || featureProps?.id || 'Unnamed Road';
        setImportAreaHighlight({ geometry: feature.geometry, label });
        // Navigate to this feature
        const delta = targetIndex - importPreviewIndex;
        if (delta > 0) {
          for (let i = 0; i < delta; i++) nextImportPreview();
        } else {
          for (let i = 0; i < Math.abs(delta); i++) previousImportPreview();
        }
      }
    }
  };

  return (
    <Stack h="100%" gap={0}>
      {/* Header */}
      <Group justify="space-between" p="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
        <Stack gap={2}>
          <Text fw={600}>Import #{historicalPreviewDisplayNumber}</Text>
          <Text size="xs" c="dimmed">Change Preview</Text>
        </Stack>
        <ActionIcon variant="subtle" color="gray" onClick={handleClose}>
          <IconX size={18} />
        </ActionIcon>
      </Group>

      {/* Content */}
      <ScrollArea style={{ flex: 1 }} p="md" type="hover" scrollbarSize={10} offsetScrollbars>
        <Stack gap="md">
          {/* Loading state */}
          {isLoading && (
            <Stack align="center" py="xl">
              <Loader size="sm" />
              <Text c="dimmed" size="sm">Loading changes...</Text>
            </Stack>
          )}

          {/* Error state */}
          {error && (
            <Alert color="yellow" variant="light" icon={<IconInfoCircle size={16} />}>
              Change history not available for this version.
            </Alert>
          )}

          {/* Change stats */}
          {diff && (
            <>
              <Group gap="xs">
                <ChangeCountCard
                  icon={<IconPlus size={14} color="var(--mantine-color-green-6)" />}
                  count={diff.stats.addedCount}
                  label="Added"
                  color="green"
                  isActive={changeType === 'added'}
                  onClick={() => diff.stats.addedCount > 0 && jumpToChangeType('added')}
                />
                <ChangeCountCard
                  icon={<IconPencil size={14} color="var(--mantine-color-blue-6)" />}
                  count={diff.stats.updatedCount}
                  label="Updated"
                  color="blue"
                  isActive={changeType === 'updated'}
                  onClick={() => diff.stats.updatedCount > 0 && jumpToChangeType('updated')}
                />
                <ChangeCountCard
                  icon={<IconArchive size={14} color="var(--mantine-color-orange-6)" />}
                  count={diff.stats.deactivatedCount}
                  label="Removed"
                  color="orange"
                  isActive={changeType === 'removed'}
                  onClick={() => diff.stats.deactivatedCount > 0 && jumpToChangeType('removed')}
                />
              </Group>

              <Text size="xs" c="dimmed" ta="center">
                {diff.unchanged.toLocaleString()} roads unchanged
              </Text>
            </>
          )}

          <Divider />

          {/* Current feature info */}
          {currentFeature && (
            <Card withBorder padding="sm">
              <Stack gap="xs">
                <Group justify="space-between">
                  {changeTypeBadge && (
                    <Badge color={changeTypeBadge.color} size="sm">
                      {changeTypeBadge.label}
                    </Badge>
                  )}
                  {hasMultiple && (
                    <Text size="xs" c="dimmed">
                      {importPreviewIndex + 1} / {totalCount}
                    </Text>
                  )}
                </Group>

                <Text fw={600} size="sm" lineClamp={2}>
                  {importPreviewLabel || 'Unnamed Road'}
                </Text>

                {props?.roadType && (
                  <Badge size="xs" variant="light">
                    {props.roadType}
                  </Badge>
                )}

                {props?.ward && (
                  <Text size="xs" c="dimmed">{props.ward}</Text>
                )}
              </Stack>
            </Card>
          )}

          {/* Navigation hint */}
          {hasMultiple && (
            <Text size="xs" c="dimmed" ta="center">
              Use arrows to browse through modified roads
            </Text>
          )}
        </Stack>
      </ScrollArea>

      {/* Footer with navigation */}
      <Box p="md" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
        <Stack gap="sm">
          {hasMultiple && (
            <Group justify="center" gap="xs">
              <ActionIcon
                variant="light"
                size="lg"
                onClick={handlePrevious}
                aria-label="Previous road"
              >
                <IconChevronLeft size={18} />
              </ActionIcon>
              <Text size="sm" fw={500}>
                {importPreviewIndex + 1} / {totalCount}
              </Text>
              <ActionIcon
                variant="light"
                size="lg"
                onClick={handleNext}
                aria-label="Next road"
              >
                <IconChevronRight size={18} />
              </ActionIcon>
            </Group>
          )}

          <Button
            variant="filled"
            fullWidth
            onClick={handleClose}
          >
            Close Preview
          </Button>
        </Stack>
      </Box>
    </Stack>
  );
}

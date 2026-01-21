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

interface RoadItemProps {
  feature: GeoJSON.Feature;
  featureProps: FeatureProperties;
  isSelected: boolean;
  color: string;
  onSelect: () => void;
  onHover: (geometry: GeoJSON.Geometry | null, label: string | null) => void;
  selectedGeometry: GeoJSON.Geometry | null;
  selectedLabel: string | null;
}

function RoadItem({ feature, featureProps, isSelected, color, onSelect, onHover, selectedGeometry, selectedLabel }: RoadItemProps) {
  const label = featureProps?.name || featureProps?.id || 'Unnamed Road';

  return (
    <Paper
      withBorder
      p="xs"
      radius="sm"
      onClick={onSelect}
      onMouseEnter={() => {
        if (feature.geometry && !isSelected) {
          onHover(feature.geometry, label);
        }
      }}
      onMouseLeave={() => {
        if (!isSelected) {
          // Restore selected item's highlight or clear
          onHover(selectedGeometry, selectedLabel);
        }
      }}
      style={{
        cursor: 'pointer',
        borderColor: isSelected ? `var(--mantine-color-${color}-5)` : undefined,
        backgroundColor: isSelected ? `var(--mantine-color-${color}-0)` : undefined,
        transition: 'all 0.15s',
      }}
    >
      <Text size="xs" fw={isSelected ? 600 : 400} lineClamp={1}>
        {label}
      </Text>
      {featureProps?.roadType && (
        <Badge size="xs" variant="light" mt={2}>{featureProps.roadType}</Badge>
      )}
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

  // Track selected item for hover restore
  const selectedGeometry = currentFeature?.geometry || null;
  const selectedLabel = props?.name || props?.id || 'Unnamed Road';

  // Hover handler - shows temporary orange highlight, restores blue selection on leave
  const handleHover = (geometry: GeoJSON.Geometry | null, label: string | null) => {
    if (geometry && label) {
      // Hover: orange highlight
      setImportAreaHighlight({ geometry, label, isHover: true });
    } else if (selectedGeometry) {
      // Restore selected item with blue highlight
      setImportAreaHighlight({ geometry: selectedGeometry, label: selectedLabel, isHover: false });
    }
  };

  // Select handler - navigates to feature and sets permanent blue highlight
  const handleSelectFeature = (feature: GeoJSON.Feature, featureProps: FeatureProperties) => {
    if (feature.geometry) {
      const label = featureProps?.name || featureProps?.id || 'Unnamed Road';
      // Selection: blue highlight
      setImportAreaHighlight({ geometry: feature.geometry, label, isHover: false });
      // Navigate to this feature in the preview list
      const targetIdx = importPreviewFeatures.findIndex(f => f.properties?.id === featureProps?.id);
      if (targetIdx >= 0) {
        const delta = targetIdx - importPreviewIndex;
        if (delta > 0) for (let i = 0; i < delta; i++) nextImportPreview();
        else for (let i = 0; i < Math.abs(delta); i++) previousImportPreview();
      }
    }
  };

  const handleClose = () => {
    setImportAreaHighlight(null);
    exitHistoricalPreview();
  };

  // Jump to a specific change type (selection, not hover)
  const jumpToChangeType = (type: 'added' | 'updated' | 'removed') => {
    const targetIndex = importPreviewFeatures.findIndex(
      (f) => (f.properties as FeatureProperties)?._changeType === type
    );
    if (targetIndex >= 0 && targetIndex !== importPreviewIndex) {
      const feature = importPreviewFeatures[targetIndex];
      if (feature.geometry) {
        const featureProps = feature.properties as FeatureProperties | null;
        const label = featureProps?.name || featureProps?.id || 'Unnamed Road';
        // Selection: blue highlight
        setImportAreaHighlight({ geometry: feature.geometry, label, isHover: false });
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

          {/* List all changed roads by type */}
          {diff && (
            <Stack gap="sm">
              {/* Added roads */}
              {diff.added.length > 0 && (
                <Stack gap={4}>
                  <Text size="xs" fw={600} c="green">Added ({diff.added.length})</Text>
                  {diff.added.map((feature, idx) => {
                    const featureProps = feature.properties as FeatureProperties;
                    const isSelected = currentFeature?.properties?.id === featureProps?.id;
                    return (
                      <RoadItem
                        key={featureProps?.id || idx}
                        feature={feature}
                        featureProps={featureProps}
                        isSelected={isSelected}
                        color="green"
                        onSelect={() => handleSelectFeature(feature, featureProps)}
                        onHover={handleHover}
                        selectedGeometry={selectedGeometry}
                        selectedLabel={selectedLabel}
                      />
                    );
                  })}
                </Stack>
              )}

              {/* Updated roads */}
              {diff.updated.length > 0 && (
                <Stack gap={4}>
                  <Text size="xs" fw={600} c="blue">Updated ({diff.updated.length})</Text>
                  {diff.updated.map((feature, idx) => {
                    const featureProps = feature.properties as FeatureProperties;
                    const isSelected = currentFeature?.properties?.id === featureProps?.id;
                    return (
                      <RoadItem
                        key={featureProps?.id || idx}
                        feature={feature}
                        featureProps={featureProps}
                        isSelected={isSelected}
                        color="blue"
                        onSelect={() => handleSelectFeature(feature, featureProps)}
                        onHover={handleHover}
                        selectedGeometry={selectedGeometry}
                        selectedLabel={selectedLabel}
                      />
                    );
                  })}
                </Stack>
              )}

              {/* Removed roads */}
              {diff.deactivated.length > 0 && (
                <Stack gap={4}>
                  <Text size="xs" fw={600} c="orange">Removed ({diff.deactivated.length})</Text>
                  {diff.deactivated.map((feature, idx) => {
                    const featureProps = feature.properties as FeatureProperties;
                    const isSelected = currentFeature?.properties?.id === featureProps?.id;
                    return (
                      <RoadItem
                        key={featureProps?.id || idx}
                        feature={feature}
                        featureProps={featureProps}
                        isSelected={isSelected}
                        color="orange"
                        onSelect={() => handleSelectFeature(feature, featureProps)}
                        onHover={handleHover}
                        selectedGeometry={selectedGeometry}
                        selectedLabel={selectedLabel}
                      />
                    );
                  })}
                </Stack>
              )}
            </Stack>
          )}
        </Stack>
      </ScrollArea>

      {/* Footer */}
      <Box p="md" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
        <Button
          variant="filled"
          fullWidth
          onClick={handleClose}
        >
          Close Preview
        </Button>
      </Box>
    </Stack>
  );
}

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
  Loader,
  Box,
  Divider,
  Paper,
} from '@/components/shims';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
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

const COLOR_MAP: Record<string, { border: string; activeBorder: string; activeBg: string; iconColor: string }> = {
  green: { border: 'border-transparent', activeBorder: 'border-green-500', activeBg: 'bg-green-50', iconColor: 'text-green-600' },
  blue: { border: 'border-transparent', activeBorder: 'border-blue-500', activeBg: 'bg-blue-50', iconColor: 'text-blue-600' },
  orange: { border: 'border-transparent', activeBorder: 'border-orange-500', activeBg: 'bg-orange-50', iconColor: 'text-orange-600' },
};

function ChangeCountCard({ icon, count, label, color, isActive, onClick }: ChangeCountCardProps) {
  const colors = COLOR_MAP[color] || COLOR_MAP.blue;
  return (
    <Paper
      withBorder
      p="xs"
      radius="md"
      onClick={onClick}
      style={{
        cursor: count > 0 ? 'pointer' : 'default',
        opacity: count === 0 ? 0.5 : 1,
        flex: 1,
        textAlign: 'center',
        transition: 'all 0.15s',
      }}
      className={isActive ? `${colors.activeBorder} ${colors.activeBg}` : colors.border}
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

const ROAD_COLOR_MAP: Record<string, { activeBorder: string; activeBg: string }> = {
  green: { activeBorder: 'border-green-500', activeBg: 'bg-green-50' },
  blue: { activeBorder: 'border-blue-500', activeBg: 'bg-blue-50' },
  orange: { activeBorder: 'border-orange-500', activeBg: 'bg-orange-50' },
};

function RoadItem({ feature, featureProps, isSelected, color, onSelect, onHover, selectedGeometry, selectedLabel }: RoadItemProps) {
  const label = featureProps?.name || featureProps?.id || 'Unnamed Road';
  const colors = ROAD_COLOR_MAP[color] || ROAD_COLOR_MAP.blue;

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
        transition: 'all 0.15s',
      }}
      className={isSelected ? `${colors.activeBorder} ${colors.activeBg}` : ''}
    >
      <Text size="xs" fw={isSelected ? 600 : 400} lineClamp={1}>
        {label}
      </Text>
      {featureProps?.roadType && (
        <Badge variant="secondary" className="text-[10px] px-1 py-0 mt-0.5">{featureProps.roadType}</Badge>
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
  const nextImportPreview = useUIStore((s) => s.nextImportPreview);
  const previousImportPreview = useUIStore((s) => s.previousImportPreview);
  const setImportAreaHighlight = useMapStore((s) => s.setImportAreaHighlight);

  const { data: diffData, isLoading, error } = useHistoricalDiff(
    isHistoricalPreviewMode ? historicalPreviewVersionId : null
  );

  if (!isHistoricalPreviewMode) return null;

  const diff = diffData?.data;
  const currentFeature = importPreviewFeatures[importPreviewIndex];
  const props = currentFeature?.properties as FeatureProperties | null;
  const changeType = props?._changeType;

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
      <Group justify="space-between" p="md" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
        <Stack gap={2}>
          <Text fw={600}>Import #{historicalPreviewDisplayNumber}</Text>
          <Text size="xs" c="dimmed">Change Preview</Text>
        </Stack>
        <Button variant="ghost" size="icon" onClick={handleClose}>
          <IconX size={18} />
        </Button>
      </Group>

      {/* Content */}
      <ScrollArea className="flex-1 p-4">
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
            <Alert>
              <IconInfoCircle size={16} />
              <AlertDescription>
                Change history not available for this version.
              </AlertDescription>
            </Alert>
          )}

          {/* Change stats */}
          {diff && (
            <>
              <Group gap="xs">
                <ChangeCountCard
                  icon={<IconPlus size={14} className="text-green-600" />}
                  count={diff.stats.addedCount}
                  label="Added"
                  color="green"
                  isActive={changeType === 'added'}
                  onClick={() => diff.stats.addedCount > 0 && jumpToChangeType('added')}
                />
                <ChangeCountCard
                  icon={<IconPencil size={14} className="text-blue-600" />}
                  count={diff.stats.updatedCount}
                  label="Updated"
                  color="blue"
                  isActive={changeType === 'updated'}
                  onClick={() => diff.stats.updatedCount > 0 && jumpToChangeType('updated')}
                />
                <ChangeCountCard
                  icon={<IconArchive size={14} className="text-orange-600" />}
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
      <Box p="md" style={{ borderTop: '1px solid hsl(var(--border))' }}>
        <Button
          className="w-full"
          onClick={handleClose}
        >
          Close Preview
        </Button>
      </Box>
    </Stack>
  );
}

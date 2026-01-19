/**
 * Historical Changes Modal Component
 *
 * Displays the changes made during a published import version.
 * Allows clicking on features to highlight them on the map.
 */

import { useState } from 'react';
import {
  Modal,
  Stack,
  Text,
  Group,
  Card,
  Tabs,
  Table,
  Badge,
  Loader,
  Alert,
  ScrollArea,
  Paper,
  Center,
  Button,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconPencil,
  IconArchive,
  IconInfoCircle,
  IconMap,
} from '@tabler/icons-react';
import { useHistoricalDiff } from '../../../hooks/useImportVersions';
import { useUIStore } from '../../../stores/uiStore';
import { useMapStore } from '../../../stores/mapStore';
import type { Feature } from 'geojson';

interface FeatureProperties {
  id?: string;
  name?: string;
  roadType?: string;
  ward?: string;
  [key: string]: unknown;
}

interface FeatureTableProps {
  features: Feature[];
  emptyMessage: string;
  onFeatureClick?: (feature: Feature) => void;
}

function FeatureTable({ features, emptyMessage, onFeatureClick }: FeatureTableProps) {
  if (features.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="lg">
        {emptyMessage}
      </Text>
    );
  }

  return (
    <ScrollArea h={300}>
      <Table striped highlightOnHover withTableBorder fz="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>ID</Table.Th>
            <Table.Th>Name</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Ward</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {features.slice(0, 100).map((feature, index) => {
            const props = feature.properties as FeatureProperties | null;
            const hasGeometry = !!feature.geometry;
            return (
              <Table.Tr
                key={props?.id || index}
                onClick={() => hasGeometry && onFeatureClick?.(feature)}
                style={{
                  cursor: hasGeometry && onFeatureClick ? 'pointer' : 'default',
                }}
              >
                <Table.Td>
                  <Text size="xs" ff="monospace">
                    {props?.id || '-'}
                  </Text>
                </Table.Td>
                <Table.Td>{props?.name || 'Unnamed'}</Table.Td>
                <Table.Td>
                  <Badge size="xs" variant="light">
                    {props?.roadType || '-'}
                  </Badge>
                </Table.Td>
                <Table.Td>{props?.ward || '-'}</Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
      {features.length > 100 && (
        <Text size="xs" c="dimmed" ta="center" mt="sm">
          Showing first 100 of {features.length} features
        </Text>
      )}
    </ScrollArea>
  );
}

interface ChangeCountBadgeProps {
  icon: React.ReactNode;
  count: number;
  label: string;
  color: string;
}

function ChangeCountBadge({ icon, count, label, color }: ChangeCountBadgeProps) {
  return (
    <Stack align="center" gap={4}>
      <Paper
        withBorder
        p="sm"
        radius="md"
        style={{
          borderColor: `var(--mantine-color-${color}-5)`,
          minWidth: 72,
          textAlign: 'center',
        }}
      >
        <Group justify="center" gap={4}>
          {icon}
          <Text fw={700} size="lg" ff="monospace">
            {count.toLocaleString()}
          </Text>
        </Group>
      </Paper>
      <Text size="xs" c="dimmed">{label}</Text>
    </Stack>
  );
}

interface HistoricalChangesModalProps {
  versionId: string | null;
  displayNumber: number;
  onClose: () => void;
}

export function HistoricalChangesModal({
  versionId,
  displayNumber,
  onClose,
}: HistoricalChangesModalProps) {
  const { data: diffData, isLoading, error } = useHistoricalDiff(versionId);
  const [activeTab, setActiveTab] = useState<string | null>('updated');

  // Use correct store hooks
  const { closeImportExportSidebar, startImportPreview, setHistoricalViewContext } = useUIStore();
  const setImportAreaHighlight = useMapStore((s) => s.setImportAreaHighlight);

  const diff = diffData?.data;

  // Collect all modified features with geometry for preview navigation
  // Add _changeType property to indicate the type of change
  const getAllModifiedFeatures = (): Feature[] => {
    if (!diff) return [];
    const allFeatures: Feature[] = [];
    // Add in order: updated, added, deactivated
    for (const f of diff.updated) {
      if (f.geometry) {
        allFeatures.push({
          ...f,
          properties: { ...f.properties, _changeType: 'updated' },
        });
      }
    }
    for (const f of diff.added) {
      if (f.geometry) {
        allFeatures.push({
          ...f,
          properties: { ...f.properties, _changeType: 'added' },
        });
      }
    }
    for (const f of diff.deactivated) {
      if (f.geometry) {
        allFeatures.push({
          ...f,
          properties: { ...f.properties, _changeType: 'removed' },
        });
      }
    }
    return allFeatures;
  };

  // Clear highlight on modal close
  const handleClose = () => {
    setImportAreaHighlight(null);
    onClose();
  };

  const handleFeatureClick = (feature: Feature) => {
    // Guard: check geometry exists before highlighting
    if (!feature.geometry) {
      notifications.show({
        title: 'Cannot highlight',
        message: 'This feature has no geometry data',
        color: 'yellow',
      });
      return;
    }

    const allFeatures = getAllModifiedFeatures();
    const featureIndex = allFeatures.findIndex(
      (f) => f.properties?.id === feature.properties?.id
    );
    const props = feature.properties as FeatureProperties | null;
    const label = props?.name || props?.id || 'Unnamed Road';

    // Highlight on map
    setImportAreaHighlight({
      geometry: feature.geometry,
      label,
    });

    // Save context to restore modal after preview ends
    if (versionId) {
      setHistoricalViewContext({ versionId, displayNumber });
    }

    // Start preview mode with all features, starting at clicked feature's index
    startImportPreview(allFeatures, featureIndex >= 0 ? featureIndex : 0);

    // Close the sidebar and modal so user can see the map with navigation
    closeImportExportSidebar();
    onClose();
  };

  // Calculate if there are any changes
  const hasNoChanges = diff &&
    diff.stats.addedCount === 0 &&
    diff.stats.updatedCount === 0 &&
    diff.stats.deactivatedCount === 0;

  const hasChanges = diff && !hasNoChanges;

  const handleViewOnMap = () => {
    const allFeatures = getAllModifiedFeatures();
    if (allFeatures.length === 0) {
      notifications.show({
        title: 'No changes to preview',
        message: 'No roads were modified in this import',
        color: 'yellow',
      });
      return;
    }
    // Save context to restore modal after preview ends
    if (versionId) {
      setHistoricalViewContext({ versionId, displayNumber });
    }

    // Start preview from the first modified feature
    const firstFeature = allFeatures[0];
    const props = firstFeature.properties as FeatureProperties | null;
    const label = props?.name || props?.id || 'Unnamed Road';
    setImportAreaHighlight({
      geometry: firstFeature.geometry!,
      label,
    });
    startImportPreview(allFeatures, 0);
    closeImportExportSidebar();
    onClose();
  };

  return (
    <Modal
      opened={!!versionId}
      onClose={handleClose}
      title={`Import #${displayNumber} - Change History`}
      size="lg"
    >
      {isLoading && (
        <Center py="xl">
          <Stack align="center" gap="sm">
            <Loader />
            <Text c="dimmed">Loading change history...</Text>
          </Stack>
        </Center>
      )}

      {error && (
        <Alert color="yellow" variant="light" title="History Not Available" icon={<IconInfoCircle size={16} />}>
          This version was published before change tracking was enabled.
          New imports will have detailed change history available.
        </Alert>
      )}

      {diff && (
        <Stack gap="md">
          {/* Empty state */}
          {hasNoChanges && (
            <Alert color="blue" variant="light">
              No changes were made in this import
            </Alert>
          )}

          {/* Stats summary */}
          <Card withBorder padding="md">
            <Group gap="lg" justify="center">
              <ChangeCountBadge
                icon={<IconPlus size={16} color="var(--mantine-color-green-6)" />}
                count={diff.stats.addedCount}
                label="Added"
                color="green"
              />
              <ChangeCountBadge
                icon={<IconPencil size={16} color="var(--mantine-color-blue-6)" />}
                count={diff.stats.updatedCount}
                label="Updated"
                color="blue"
              />
              <ChangeCountBadge
                icon={<IconArchive size={16} color="var(--mantine-color-orange-6)" />}
                count={diff.stats.deactivatedCount}
                label="Removed"
                color="orange"
              />
            </Group>

            <Text size="sm" c="dimmed" ta="center" mt="md">
              <Text span ff="monospace">{diff.unchanged.toLocaleString()}</Text>
              {' '}roads unchanged
            </Text>
          </Card>

          {/* Feature tabs */}
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab
                value="added"
                leftSection={<IconPlus size={14} />}
                rightSection={
                  <Badge size="xs" color="green">{diff.stats.addedCount}</Badge>
                }
              >
                Added
              </Tabs.Tab>
              <Tabs.Tab
                value="updated"
                leftSection={<IconPencil size={14} />}
                rightSection={
                  <Badge size="xs" color="blue">{diff.stats.updatedCount}</Badge>
                }
              >
                Updated
              </Tabs.Tab>
              <Tabs.Tab
                value="deactivated"
                leftSection={<IconArchive size={14} />}
                rightSection={
                  <Badge size="xs" color="orange">{diff.stats.deactivatedCount}</Badge>
                }
              >
                Removed
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="added" pt="xs">
              <FeatureTable
                features={diff.added}
                emptyMessage="No roads were added"
                onFeatureClick={handleFeatureClick}
              />
            </Tabs.Panel>

            <Tabs.Panel value="updated" pt="xs">
              <FeatureTable
                features={diff.updated}
                emptyMessage="No roads were updated"
                onFeatureClick={handleFeatureClick}
              />
            </Tabs.Panel>

            <Tabs.Panel value="deactivated" pt="xs">
              <FeatureTable
                features={diff.deactivated}
                emptyMessage="No roads were removed"
                onFeatureClick={handleFeatureClick}
              />
            </Tabs.Panel>
          </Tabs>

          {/* Preview on Map button */}
          <Button
            variant="light"
            leftSection={<IconMap size={16} />}
            onClick={handleViewOnMap}
            disabled={!hasChanges}
            fullWidth
          >
            Preview All Changes on Map
          </Button>

          {/* Hint text */}
          <Text size="xs" c="dimmed" ta="center">
            Click a row to highlight and navigate to that road
          </Text>
        </Stack>
      )}
    </Modal>
  );
}

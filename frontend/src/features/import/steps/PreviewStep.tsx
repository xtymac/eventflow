/**
 * Preview Step Component
 *
 * Shows diff preview with added/updated/deactivated roads.
 */

import { useState } from 'react';
import {
  Stack,
  Text,
  Group,
  Button,
  Card,
  Tabs,
  Table,
  Badge,
  Loader,
  Alert,
  ScrollArea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowRight,
  IconPlus,
  IconPencil,
  IconArchive,
  IconInfoCircle,
  IconMap,
} from '@tabler/icons-react';
import { useDiffPreview } from '../../../hooks/useImportVersions';
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

function FeatureTable({ features, emptyMessage }: { features: Feature[]; emptyMessage: string }) {
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
            return (
              <Table.Tr key={props?.id || index}>
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

// Parse bbox scope and create a Polygon geometry for map flyTo
function parseBboxScope(scope: string): GeoJSON.Polygon | null {
  if (!scope.startsWith('bbox:')) return null;

  const coords = scope.replace('bbox:', '').split(',').map(Number);
  if (coords.length !== 4 || coords.some(isNaN)) return null;

  const [minLng, minLat, maxLng, maxLat] = coords;

  // Create a polygon from the bbox
  return {
    type: 'Polygon',
    coordinates: [[
      [minLng, minLat],
      [maxLng, minLat],
      [maxLng, maxLat],
      [minLng, maxLat],
      [minLng, minLat], // Close the ring
    ]],
  };
}

export function PreviewStep() {
  const { currentImportVersionId, setImportWizardStep, setFlyToGeometry, closeImportWizard } = useUIStore();
  const setImportAreaHighlight = useMapStore((s) => s.setImportAreaHighlight);
  const [activeTab, setActiveTab] = useState<string | null>('added');

  const { data: diffData, isLoading, error } = useDiffPreview(currentImportVersionId);

  const handleContinue = () => {
    setImportWizardStep('publish');
  };

  const handleViewOnMap = () => {
    if (!diff?.scope) return;

    const geometry = parseBboxScope(diff.scope);
    if (geometry) {
      setFlyToGeometry(geometry, false);
      // Set highlight with label
      setImportAreaHighlight({
        geometry,
        label: 'Import Area',
      });
      closeImportWizard();
      notifications.show({
        title: 'Viewing import area',
        message: `Scope: ${diff.scope}`,
        color: 'blue',
      });
    } else {
      notifications.show({
        title: 'Cannot view on map',
        message: 'Only bbox scopes can be shown on map',
        color: 'yellow',
      });
    }
  };

  if (isLoading) {
    return (
      <Stack align="center" justify="center" mih={200}>
        <Loader />
        <Text c="dimmed">Generating diff preview...</Text>
      </Stack>
    );
  }

  if (error) {
    return (
      <Stack align="center" justify="center" mih={200}>
        <Text c="red">Failed to generate preview</Text>
        <Text size="sm" c="dimmed">
          {error instanceof Error ? error.message : 'Unknown error'}
        </Text>
      </Stack>
    );
  }

  const diff = diffData?.data;

  if (!diff) {
    return (
      <Stack align="center" justify="center" mih={200}>
        <Text c="dimmed">No preview data available</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
        Review the changes that will be applied. Scope: <strong>{diff.scope}</strong>
        {diff.regionalRefresh ? (
          <Text size="xs" mt={4} c="orange" fw={500}>Regional Refresh: ON - Roads not in import will be deactivated</Text>
        ) : (
          <Text size="xs" mt={4} c="dimmed">Incremental Mode: Only add/update operations (no deactivation)</Text>
        )}
      </Alert>

      {/* Stats card */}
      <Card withBorder padding="md">
        <Text fw={500} mb="sm">Change Summary</Text>
        <Group gap="xl">
          <Group gap="xs">
            <Badge color="green" size="lg" leftSection={<IconPlus size={12} />}>
              {diff.stats.addedCount}
            </Badge>
            <Text size="sm">Added</Text>
          </Group>
          <Group gap="xs">
            <Badge color="blue" size="lg" leftSection={<IconPencil size={12} />}>
              {diff.stats.updatedCount}
            </Badge>
            <Text size="sm">Updated</Text>
          </Group>
          <Group gap="xs">
            <Badge color="orange" size="lg" leftSection={<IconArchive size={12} />}>
              {diff.stats.deactivatedCount}
            </Badge>
            <Text size="sm">Deactivated</Text>
          </Group>
          <Group gap="xs">
            <Badge color="gray" size="lg">
              {diff.unchanged}
            </Badge>
            <Text size="sm">Unchanged</Text>
          </Group>
        </Group>

        <Group gap="xl" mt="md">
          <Group gap="xs">
            <Text size="sm" c="dimmed">Current roads in scope:</Text>
            <Text size="sm" fw={500}>{diff.stats.scopeCurrentCount}</Text>
          </Group>
          <Group gap="xs">
            <Text size="sm" c="dimmed">Import features:</Text>
            <Text size="sm" fw={500}>{diff.stats.importCount}</Text>
          </Group>
        </Group>
      </Card>

      {/* Deactivation warning */}
      {diff.stats.deactivatedCount > 0 && (
        <Alert
          icon={<IconArchive size={16} />}
          title={`${diff.stats.deactivatedCount} roads will be deactivated`}
          color="orange"
          variant="light"
        >
          These roads exist in the database within scope "{diff.scope}" but are not
          present in the import file. They will be marked as inactive.
        </Alert>
      )}

      {/* Tabs for feature lists */}
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab
            value="added"
            leftSection={<IconPlus size={14} />}
            rightSection={
              <Badge size="xs" color="green">{diff.added.length}</Badge>
            }
          >
            Added
          </Tabs.Tab>
          <Tabs.Tab
            value="updated"
            leftSection={<IconPencil size={14} />}
            rightSection={
              <Badge size="xs" color="blue">{diff.updated.length}</Badge>
            }
          >
            Updated
          </Tabs.Tab>
          <Tabs.Tab
            value="deactivated"
            leftSection={<IconArchive size={14} />}
            rightSection={
              <Badge size="xs" color="orange">{diff.deactivated.length}</Badge>
            }
          >
            Deactivated
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="added" pt="xs">
          <FeatureTable
            features={diff.added}
            emptyMessage="No new roads will be added"
          />
        </Tabs.Panel>

        <Tabs.Panel value="updated" pt="xs">
          <FeatureTable
            features={diff.updated}
            emptyMessage="No existing roads will be updated"
          />
        </Tabs.Panel>

        <Tabs.Panel value="deactivated" pt="xs">
          <FeatureTable
            features={diff.deactivated}
            emptyMessage={
              diff.regionalRefresh
                ? "No roads will be deactivated"
                : "Regional Refresh is OFF - no roads will be deactivated"
            }
          />
        </Tabs.Panel>
      </Tabs>

      {/* Action buttons */}
      <Group gap="sm">
        <Button
          variant="light"
          leftSection={<IconMap size={16} />}
          onClick={handleViewOnMap}
          disabled={!diff.scope.startsWith('bbox:')}
        >
          View on Map
        </Button>
        <Button
          rightSection={<IconArrowRight size={16} />}
          onClick={handleContinue}
          style={{ flex: 1 }}
        >
          Proceed to Publish
        </Button>
      </Group>
    </Stack>
  );
}

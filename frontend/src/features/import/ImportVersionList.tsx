/**
 * Import Version List Component
 *
 * Displays list of all import versions with status and actions.
 */

import { useState } from 'react';
import {
  Stack,
  Text,
  Button,
  Card,
  Table,
  Badge,
  Group,
  ActionIcon,
  Loader,
  Center,
  Pagination,
  Alert,
  Modal,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconUpload,
  IconTrash,
  IconArrowBack,
  IconInfoCircle,
  IconMap,
} from '@tabler/icons-react';
import {
  useImportVersions,
  useDeleteImportVersion,
  useRollbackVersion,
  useImportJobPolling,
  type ImportVersion,
  type ImportJob,
} from '../../hooks/useImportVersions';
import { useUIStore } from '../../stores/uiStore';
import { useMapStore } from '../../stores/mapStore';

const PAGE_SIZE = 10;

// Parse bbox scope and create a Polygon geometry for map flyTo
function parseBboxScope(scope: string): GeoJSON.Polygon | null {
  if (!scope.startsWith('bbox:')) return null;

  const coords = scope.replace('bbox:', '').split(',').map(Number);
  if (coords.length !== 4 || coords.some(isNaN)) return null;

  const [minLng, minLat, maxLng, maxLat] = coords;

  return {
    type: 'Polygon',
    coordinates: [[
      [minLng, minLat],
      [maxLng, minLat],
      [maxLng, maxLat],
      [minLng, maxLat],
      [minLng, minLat],
    ]],
  };
}

function getStatusColor(status: ImportVersion['status']): string {
  switch (status) {
    case 'draft':
      return 'gray';
    case 'published':
      return 'green';
    case 'archived':
      return 'orange';
    default:
      return 'gray';
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('ja-JP', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ImportVersionList() {
  const { openImportWizard, setFlyToGeometry } = useUIStore();
  const setImportAreaHighlight = useMapStore((s) => s.setImportAreaHighlight);

  const [page, setPage] = useState(1);
  const [rollbackVersionId, setRollbackVersionId] = useState<string | null>(null);
  const [rollbackJobId, setRollbackJobId] = useState<string | null>(null);

  // Queries
  const { data, isLoading, error, refetch } = useImportVersions({
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  // Mutations
  const deleteMutation = useDeleteImportVersion();
  const rollbackMutation = useRollbackVersion();

  // Poll rollback job
  useImportJobPolling(rollbackJobId, {
    onComplete: () => {
      setRollbackJobId(null);
      setRollbackVersionId(null);
      refetch();
      notifications.show({
        title: 'Rollback successful',
        message: 'Roads have been restored to the previous state',
        color: 'green',
      });
    },
    onError: (job: ImportJob) => {
      setRollbackJobId(null);
      setRollbackVersionId(null);
      notifications.show({
        title: 'Rollback failed',
        message: job.errorMessage || 'Unknown error',
        color: 'red',
      });
    },
  });

  const handleNewImport = () => {
    openImportWizard();
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      notifications.show({
        title: 'Version deleted',
        message: 'Draft version has been deleted',
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Delete failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    }
  };

  const handleViewOnMap = (version: ImportVersion) => {
    const geometry = parseBboxScope(version.importScope);
    if (geometry) {
      setFlyToGeometry(geometry, false);
      // Set highlight with label
      setImportAreaHighlight({
        geometry,
        label: `Import #${version.versionNumber}`,
      });
      notifications.show({
        title: 'Viewing import area',
        message: `Version #${version.versionNumber}: ${version.importScope}`,
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

  const handleRollback = async () => {
    if (!rollbackVersionId) return;

    try {
      const job = await rollbackMutation.mutateAsync(rollbackVersionId);
      setRollbackJobId(job.id);
    } catch (error) {
      setRollbackVersionId(null);
      notifications.show({
        title: 'Rollback failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    }
  };

  // Find current published version
  const currentPublishedId = data?.data?.find((v) => v.status === 'published')?.id;

  if (isLoading) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }

  if (error) {
    return (
      <Center py="xl">
        <Text c="red">Failed to load versions</Text>
      </Center>
    );
  }

  const versions = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text fw={600}>Import History</Text>
        <Button
          leftSection={<IconUpload size={16} />}
          onClick={handleNewImport}
          size="sm"
        >
          New Import
        </Button>
      </Group>

      <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
        Import GeoPackage or GeoJSON files to update road data.
        Published versions can be rolled back if needed.
      </Alert>

      {rollbackJobId && (
        <Alert color="blue" variant="light">
          <Group gap="sm">
            <Loader size="sm" />
            <Text size="sm">Rolling back to previous version...</Text>
          </Group>
        </Alert>
      )}

      <Card withBorder padding={0} style={{ overflowX: 'auto' }}>
        <Table striped highlightOnHover style={{ minWidth: 600 }}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 60 }}>Version</Table.Th>
              <Table.Th style={{ minWidth: 150 }}>File</Table.Th>
              <Table.Th style={{ width: 80 }}>Status</Table.Th>
              <Table.Th style={{ width: 70 }}>Features</Table.Th>
              <Table.Th style={{ width: 80 }}>Uploaded</Table.Th>
              <Table.Th style={{ width: 80 }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {versions.map((version) => (
              <Table.Tr key={version.id}>
                <Table.Td>
                  <Text size="sm" fw={500}>#{version.versionNumber}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" lineClamp={1} maw={150} title={version.fileName}>
                    {version.fileName}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {version.fileType.toUpperCase()} · {version.importScope}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge color={getStatusColor(version.status)} size="sm" style={{ minWidth: 70 }}>
                    {version.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{version.featureCount.toLocaleString()}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{formatDate(version.uploadedAt)}</Text>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    {version.importScope.startsWith('bbox:') && (
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        size="sm"
                        onClick={() => handleViewOnMap(version)}
                        title="View import area on map"
                      >
                        <IconMap size={14} />
                      </ActionIcon>
                    )}

                    {version.status === 'draft' && (
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        size="sm"
                        onClick={() => handleDelete(version.id)}
                        loading={deleteMutation.isPending}
                        title="Delete draft"
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    )}

                    {(version.status === 'published' || version.status === 'archived') && version.snapshotPath && (
                      <ActionIcon
                        variant="subtle"
                        color="orange"
                        size="sm"
                        onClick={() => setRollbackVersionId(version.id)}
                        disabled={!!rollbackJobId}
                        title="Rollback to pre-publish state"
                      >
                        <IconArrowBack size={14} />
                      </ActionIcon>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}

            {versions.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text c="dimmed" ta="center" py="lg">
                    No import versions yet. Click "New Import" to get started.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <Group justify="center">
          <Pagination
            size="sm"
            total={totalPages}
            value={page}
            onChange={setPage}
          />
        </Group>
      )}

      {/* Rollback confirmation modal */}
      <Modal
        opened={!!rollbackVersionId && !rollbackJobId}
        onClose={() => setRollbackVersionId(null)}
        title="Confirm Rollback"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to rollback to this version?
            This will restore the road data to the state before this version was published.
          </Text>
          <Text size="sm" c="orange" fw={500}>
            Note: Roads created after this version was published will remain unchanged.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" onClick={() => setRollbackVersionId(null)}>
              Cancel
            </Button>
            <Button
              color="orange"
              onClick={handleRollback}
              loading={rollbackMutation.isPending}
            >
              Confirm Rollback
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

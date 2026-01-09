/**
 * OSM Sync Panel Component
 *
 * Provides UI for synchronizing road data from OpenStreetMap.
 */

import { useState } from 'react';
import {
  Stack,
  Text,
  Button,
  Card,
  Badge,
  Group,
  Alert,
  Table,
  Loader,
  Pagination,
  Divider,
  Select,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconInfoCircle, IconRefresh, IconMapPin } from '@tabler/icons-react';
import { useOsmSyncBbox, useOsmSyncWard, useOsmSyncStatus, useOsmSyncLogs } from '../../hooks/useOsmSync';
import { useWards } from '../../hooks/useApi';
import { useUIStore } from '../../stores/uiStore';

const PAGE_SIZE = 10;

export function OsmSyncPanel() {
  const { mapBbox } = useUIStore();
  const [logsPage, setLogsPage] = useState(1);
  const [selectedWard, setSelectedWard] = useState<string | null>(null);

  const syncBbox = useOsmSyncBbox();
  const syncWard = useOsmSyncWard();
  const { data: syncStatus, isLoading: isLoadingStatus } = useOsmSyncStatus({
    refetchInterval: syncBbox.isPending || syncWard.isPending ? 2000 : 10000,
  });
  const { data: logsData, isLoading: isLoadingLogs } = useOsmSyncLogs(
    PAGE_SIZE,
    (logsPage - 1) * PAGE_SIZE
  );
  const { data: wardsData } = useWards();

  const handleSyncCurrentView = () => {
    if (!mapBbox) {
      notifications.show({
        title: 'Error',
        message: 'Map bbox not available. Please wait for the map to load.',
        color: 'red',
      });
      return;
    }

    const [minLng, minLat, maxLng, maxLat] = mapBbox.split(',').map(Number);
    syncBbox.mutate(
      { minLng, minLat, maxLng, maxLat },
      {
        onSuccess: (result) => {
          notifications.show({
            title: 'Sync completed',
            message: `Created: ${result.roadsCreated}, Updated: ${result.roadsUpdated}, Skipped: ${result.roadsSkipped}`,
            color: result.status === 'completed' ? 'green' : 'yellow',
          });
        },
        onError: (error) => {
          notifications.show({
            title: 'Sync failed',
            message: error.message,
            color: 'red',
          });
        },
      }
    );
  };

  const handleSyncWard = () => {
    if (!selectedWard) {
      notifications.show({
        title: 'Error',
        message: 'Please select a ward first.',
        color: 'red',
      });
      return;
    }

    syncWard.mutate(selectedWard, {
      onSuccess: (result) => {
        notifications.show({
          title: 'Ward sync completed',
          message: `${selectedWard}: Created ${result.roadsCreated}, Updated ${result.roadsUpdated}`,
          color: result.status === 'completed' ? 'green' : 'yellow',
        });
      },
      onError: (error) => {
        notifications.show({
          title: 'Ward sync failed',
          message: error.message,
          color: 'red',
        });
      },
    });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'green';
      case 'running':
        return 'blue';
      case 'partial':
        return 'yellow';
      case 'failed':
        return 'red';
      default:
        return 'gray';
    }
  };

  return (
    <Stack gap="md">
      <Text fw={600}>OSM Sync</Text>

      <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
        OSM data may have delays of a few minutes to hours from Overpass API.
        Low-zoom tile previews are rebuilt daily at 4am JST.
      </Alert>

      {/* Status Card */}
      <Card withBorder padding="sm">
        <Text size="sm" fw={500} mb="xs">Sync Status</Text>
        {isLoadingStatus ? (
          <Loader size="sm" />
        ) : (
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Status:</Text>
              <Badge color={syncStatus?.runningSyncs ? 'blue' : 'green'}>
                {syncStatus?.runningSyncs ? `${syncStatus.runningSyncs} running` : 'Idle'}
              </Badge>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Last sync:</Text>
              <Text size="sm">{formatDate(syncStatus?.lastSyncAt ?? null)}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">OSM-tracked roads:</Text>
              <Text size="sm" fw={500}>{syncStatus?.totalRoadsWithOsmId ?? 0}</Text>
            </Group>
          </Stack>
        )}
      </Card>

      {/* Sync Actions */}
      <Card withBorder padding="sm">
        <Text size="sm" fw={500} mb="xs">Sync Actions</Text>
        <Stack gap="sm">
          <Button
            leftSection={<IconRefresh size={16} />}
            onClick={handleSyncCurrentView}
            loading={syncBbox.isPending}
            disabled={!mapBbox || syncStatus?.runningSyncs ? true : false}
            fullWidth
          >
            Sync Current Viewport
          </Button>

          <Divider label="or" labelPosition="center" />

          <Group gap="sm">
            <Select
              placeholder="Select ward..."
              data={wardsData?.data.map((w) => ({ value: w, label: w })) ?? []}
              value={selectedWard}
              onChange={setSelectedWard}
              style={{ flex: 1 }}
              clearable
            />
            <Button
              leftSection={<IconMapPin size={16} />}
              onClick={handleSyncWard}
              loading={syncWard.isPending}
              disabled={!selectedWard || syncStatus?.runningSyncs ? true : false}
            >
              Sync
            </Button>
          </Group>
        </Stack>
      </Card>

      {/* Sync Result */}
      {(syncBbox.isSuccess || syncWard.isSuccess) && (
        <Card withBorder padding="sm" bg="var(--mantine-color-green-0)">
          <Text size="sm" fw={500} mb="xs">Last Sync Result</Text>
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm">OSM roads fetched:</Text>
              <Text size="sm" fw={500}>
                {(syncBbox.data ?? syncWard.data)?.osmRoadsFetched ?? 0}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm">Roads created:</Text>
              <Text size="sm" fw={500} c="green">
                +{(syncBbox.data ?? syncWard.data)?.roadsCreated ?? 0}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm">Roads updated:</Text>
              <Text size="sm" fw={500} c="blue">
                {(syncBbox.data ?? syncWard.data)?.roadsUpdated ?? 0}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm">Skipped (protected):</Text>
              <Text size="sm" fw={500} c="gray">
                {(syncBbox.data ?? syncWard.data)?.roadsSkipped ?? 0}
              </Text>
            </Group>
          </Stack>
        </Card>
      )}

      {/* Sync Logs */}
      <Card withBorder padding="sm">
        <Text size="sm" fw={500} mb="xs">Recent Sync Logs</Text>
        {isLoadingLogs ? (
          <Loader size="sm" />
        ) : (
          <>
            <Table striped highlightOnHover withTableBorder fz="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Time</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Created</Table.Th>
                  <Table.Th>Updated</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {logsData?.data.map((log) => (
                  <Table.Tr key={log.id}>
                    <Table.Td>{formatDate(log.startedAt)}</Table.Td>
                    <Table.Td>
                      {log.syncType === 'ward' ? log.wardParam : log.syncType}
                    </Table.Td>
                    <Table.Td>
                      <Badge size="xs" color={getStatusColor(log.status)}>
                        {log.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{log.roadsCreated ?? '-'}</Table.Td>
                    <Table.Td>{log.roadsUpdated ?? '-'}</Table.Td>
                  </Table.Tr>
                ))}
                {(!logsData?.data || logsData.data.length === 0) && (
                  <Table.Tr>
                    <Table.Td colSpan={5}>
                      <Text c="dimmed" ta="center" size="sm">No sync logs yet</Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>

            {logsData?.meta && logsData.meta.total > PAGE_SIZE && (
              <Group justify="center" mt="sm">
                <Pagination
                  size="sm"
                  total={Math.ceil(logsData.meta.total / PAGE_SIZE)}
                  value={logsPage}
                  onChange={setLogsPage}
                />
              </Group>
            )}
          </>
        )}
      </Card>
    </Stack>
  );
}

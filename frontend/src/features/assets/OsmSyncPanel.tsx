/**
 * OSM Sync Panel Component
 *
 * Provides UI for synchronizing road data from OpenStreetMap.
 */

import { useState } from 'react';
import { Stack, Text, Group, Divider, Loader } from '@/components/shims';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { showNotification } from '@/lib/toast';
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
      showNotification({
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
          showNotification({
            title: 'Sync completed',
            message: `Created: ${result.roadsCreated}, Updated: ${result.roadsUpdated}, Skipped: ${result.roadsSkipped}`,
            color: result.status === 'completed' ? 'green' : 'yellow',
          });
        },
        onError: (error) => {
          showNotification({
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
      showNotification({
        title: 'Error',
        message: 'Please select a ward first.',
        color: 'red',
      });
      return;
    }

    syncWard.mutate(selectedWard, {
      onSuccess: (result) => {
        showNotification({
          title: 'Ward sync completed',
          message: `${selectedWard}: Created ${result.roadsCreated}, Updated ${result.roadsUpdated}`,
          color: result.status === 'completed' ? 'green' : 'yellow',
        });
      },
      onError: (error) => {
        showNotification({
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
        return 'bg-green-100 text-green-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Stack gap="md">
      <Text fw={600}>OSM Sync</Text>

      <Alert>
        <IconInfoCircle size={16} />
        <AlertDescription>
          OSM data may have delays of a few minutes to hours from Overpass API.
          Low-zoom tile previews are rebuilt daily at 4am JST.
        </AlertDescription>
      </Alert>

      {/* Status Card */}
      <div className="border rounded-md p-2">
        <Text size="sm" fw={500} mb="xs">Sync Status</Text>
        {isLoadingStatus ? (
          <Loader size="sm" />
        ) : (
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Status:</Text>
              <Badge variant="secondary" className={syncStatus?.runningSyncs ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}>
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
      </div>

      {/* Sync Actions */}
      <div className="border rounded-md p-2">
        <Text size="sm" fw={500} mb="xs">Sync Actions</Text>
        <Stack gap="sm">
          <Button
            onClick={handleSyncCurrentView}
            disabled={!mapBbox || (syncStatus?.runningSyncs ? true : false) || syncBbox.isPending}
            className="w-full"
          >
            <IconRefresh size={16} className="mr-2" />
            {syncBbox.isPending ? 'Syncing...' : 'Sync Current Viewport'}
          </Button>

          <Divider label="or" />

          <Group gap="sm">
            <div className="flex-1">
              <Select
                value={selectedWard ?? undefined}
                onValueChange={(val) => setSelectedWard(val || null)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select ward..." />
                </SelectTrigger>
                <SelectContent>
                  {wardsData?.data.map((w) => (
                    <SelectItem key={w} value={w}>{w}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleSyncWard}
              disabled={!selectedWard || (syncStatus?.runningSyncs ? true : false) || syncWard.isPending}
            >
              <IconMapPin size={16} className="mr-2" />
              {syncWard.isPending ? 'Syncing...' : 'Sync'}
            </Button>
          </Group>
        </Stack>
      </div>

      {/* Sync Result */}
      {(syncBbox.isSuccess || syncWard.isSuccess) && (
        <div className="border rounded-md p-2 bg-green-50">
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
              <Text size="sm" fw={500}>
                {(syncBbox.data ?? syncWard.data)?.roadsSkipped ?? 0}
              </Text>
            </Group>
          </Stack>
        </div>
      )}

      {/* Sync Logs */}
      <div className="border rounded-md p-2">
        <Text size="sm" fw={500} mb="xs">Recent Sync Logs</Text>
        {isLoadingLogs ? (
          <Loader size="sm" />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logsData?.data.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">{formatDate(log.startedAt)}</TableCell>
                    <TableCell className="text-xs">
                      {log.syncType === 'ward' ? log.wardParam : log.syncType}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-xs ${getStatusColor(log.status)}`}>
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{log.roadsCreated ?? '-'}</TableCell>
                    <TableCell className="text-xs">{log.roadsUpdated ?? '-'}</TableCell>
                  </TableRow>
                ))}
                {(!logsData?.data || logsData.data.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Text c="dimmed" ta="center" size="sm">No sync logs yet</Text>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {logsData?.meta && logsData.meta.total > PAGE_SIZE && (
              <Group justify="center" mt="sm">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLogsPage((p) => Math.max(1, p - 1))}
                    disabled={logsPage <= 1}
                  >
                    Prev
                  </Button>
                  <Text size="sm">{logsPage} / {Math.ceil(logsData.meta.total / PAGE_SIZE)}</Text>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLogsPage((p) => p + 1)}
                    disabled={logsPage >= Math.ceil(logsData.meta.total / PAGE_SIZE)}
                  >
                    Next
                  </Button>
                </div>
              </Group>
            )}
          </>
        )}
      </div>
    </Stack>
  );
}

/**
 * Import Version List Component
 *
 * Displays list of all import versions with status and actions.
 */

import { useState, useEffect, useRef } from 'react';
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
  Tooltip,
  SegmentedControl,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconUpload,
  IconTrash,
  IconArrowBack,
  IconInfoCircle,
  IconMap,
  IconEye,
  IconList,
  IconTimeline,
} from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
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
import { HistoricalChangesModal } from './components/HistoricalChangesModal';
import { ImportVersionTimeline } from './components/ImportVersionTimeline';

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

/**
 * Format scope string for compact display
 * - "full" → "Full City"
 * - "ward:Nishi" → "Nishi Ward"
 * - "bbox:..." → "File bbox"
 */
function formatScopeDisplay(scope: string): string {
  if (scope === 'full') return 'Full City';
  if (scope.startsWith('ward:')) return `${scope.substring(5)} Ward`;
  if (scope.startsWith('bbox:')) return 'File bbox';
  return scope;
}

function getStatusColor(status: ImportVersion['status']): string {
  switch (status) {
    case 'draft':
      return 'gray';
    case 'published':
      return 'green';
    case 'archived':
      return 'orange';
    case 'rolled_back':
      return 'gray';
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

interface ImportVersionListProps {
  compact?: boolean;  // When true, hide header and show inline New Import button
}

export function ImportVersionList({ compact = false }: ImportVersionListProps) {
  const {
    openImportWizard,
    setFlyToGeometry,
    closeImportExportSidebar,
    historicalViewContext,
    isImportPreviewMode,
    setHistoricalViewContext,
    startImportPreview,
    lastRollbackInfo,
    setLastRollbackInfo,
    clearRollbackInfo,
  } = useUIStore();
  const setImportAreaHighlight = useMapStore((s) => s.setImportAreaHighlight);
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [rollbackVersionId, setRollbackVersionId] = useState<string | null>(null);
  const [rollbackJobId, setRollbackJobId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'table'>('timeline'); // Timeline is default

  // Track pending rollback info to set after rollback completes
  const pendingRollbackInfoRef = useRef<{ fromVersionNumber: number; toVersionNumber: number } | null>(null);

  // State for viewing historical changes
  const [viewingHistoryId, setViewingHistoryId] = useState<string | null>(null);
  const [viewingHistoryNumber, setViewingHistoryNumber] = useState<number>(0);

  // Restore historical changes modal when preview ends
  useEffect(() => {
    if (!isImportPreviewMode && historicalViewContext) {
      // Preview ended, restore the modal
      setViewingHistoryId(historicalViewContext.versionId);
      setViewingHistoryNumber(historicalViewContext.displayNumber);
      // Clear the context
      setHistoricalViewContext(null);
    }
  }, [isImportPreviewMode, historicalViewContext, setHistoricalViewContext]);

  // Queries - fetch more to account for filtered drafts
  const { data, isLoading, error } = useImportVersions({
    limit: PAGE_SIZE * 2,  // Fetch extra to ensure we have enough after filtering
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
      // Invalidate all relevant caches after rollback
      queryClient.invalidateQueries({ queryKey: ['import-versions'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });  // Road data changed

      // Set rollback notification for timeline
      if (pendingRollbackInfoRef.current) {
        setLastRollbackInfo({
          fromVersionNumber: pendingRollbackInfoRef.current.fromVersionNumber,
          toVersionNumber: pendingRollbackInfoRef.current.toVersionNumber,
          timestamp: new Date(),
        });
        pendingRollbackInfoRef.current = null;
      }

      notifications.show({
        title: 'Rollback successful',
        message: 'Roads have been restored to the previous state',
        color: 'green',
      });
    },
    onError: (job: ImportJob) => {
      setRollbackJobId(null);
      setRollbackVersionId(null);
      pendingRollbackInfoRef.current = null;
      notifications.show({
        title: 'Rollback failed',
        message: job.errorMessage || 'Unknown error',
        color: 'red',
      });
    },
  });

  const handleNewImport = () => {
    // Close the sidebar first when in compact mode (inside sidebar)
    if (compact) {
      closeImportExportSidebar();
    }
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

  const handleViewOnMap = (version: ImportVersion, displayNumber: number) => {
    const geometry = parseBboxScope(version.importScope);
    if (geometry) {
      // Close sidebar to focus on map
      closeImportExportSidebar();

      // Create a feature for the scope area
      const scopeFeature: GeoJSON.Feature = {
        type: 'Feature',
        geometry,
        properties: {
          id: 'scope-area',
          name: `Import #${displayNumber}`,
        },
      };

      // Set highlight with label
      setImportAreaHighlight({
        geometry,
        label: `Import #${displayNumber}`,
      });

      // Fly to the area
      setFlyToGeometry(geometry, false);

      // Start preview mode so the overlay shows
      startImportPreview([scopeFeature], 0);
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

    // Find current published version number and target version number
    const currentPublished = data?.data?.find((v) => v.status === 'published');
    const targetVersion = data?.data?.find((v) => v.id === rollbackVersionId);

    if (currentPublished && targetVersion) {
      // Calculate display numbers (versions are sorted newest-first)
      const allNonDraft = (data?.data ?? []).filter((v) => v.status !== 'draft');
      const currentIndex = allNonDraft.findIndex((v) => v.id === currentPublished.id);
      const targetIndex = allNonDraft.findIndex((v) => v.id === targetVersion.id);
      const nonDraftTotal = allNonDraft.length;

      const currentDisplayNumber = nonDraftTotal - currentIndex;
      const targetDisplayNumber = nonDraftTotal - targetIndex;

      pendingRollbackInfoRef.current = {
        fromVersionNumber: currentDisplayNumber,
        toVersionNumber: targetDisplayNumber,
      };
    }

    try {
      const job = await rollbackMutation.mutateAsync(rollbackVersionId);
      setRollbackJobId(job.id);
    } catch (error) {
      setRollbackVersionId(null);
      pendingRollbackInfoRef.current = null;
      notifications.show({
        title: 'Rollback failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    }
  };

  // Find current published version (may be used for future highlighting)
  const _currentPublishedId = data?.data?.find((v) => v.status === 'published')?.id;
  void _currentPublishedId; // Intentionally unused for now

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

  // Filter out draft versions - only show published and archived
  const allNonDraft = (data?.data ?? []).filter((v) => v.status !== 'draft');
  const versions = allNonDraft.slice(0, PAGE_SIZE);
  // Use actual non-draft count for pagination (we fetch extra to ensure accuracy)
  const nonDraftTotal = allNonDraft.length;
  // Only show pagination if we have more than one page worth of data
  const totalPages = nonDraftTotal > PAGE_SIZE ? Math.ceil(nonDraftTotal / PAGE_SIZE) : 1;

  return (
    <Stack gap="md" style={compact ? { height: '100%', display: 'flex', flexDirection: 'column' } : undefined}>
      {/* Only show header when not in compact mode */}
      {!compact && (
        <Group justify="space-between">
          <Text fw={600}>Import History</Text>
          <Group gap="sm">
            <SegmentedControl
              size="xs"
              value={viewMode}
              onChange={(v) => setViewMode(v as 'timeline' | 'table')}
              data={[
                { value: 'timeline', label: <IconTimeline size={14} /> },
                { value: 'table', label: <IconList size={14} /> },
              ]}
            />
            <Button
              leftSection={<IconUpload size={16} />}
              onClick={handleNewImport}
              size="sm"
            >
              New Import
            </Button>
          </Group>
        </Group>
      )}

      {/* Show "New Import" as inline button in compact mode */}
      {compact && (
        <Group gap="xs" mb="xs">
          <Button
            onClick={handleNewImport}
            leftSection={<IconUpload size={16} />}
            style={{ flex: 1 }}
          >
            New Import
          </Button>
          <SegmentedControl
            size="xs"
            value={viewMode}
            onChange={(v) => setViewMode(v as 'timeline' | 'table')}
            data={[
              { value: 'timeline', label: <IconTimeline size={14} /> },
              { value: 'table', label: <IconList size={14} /> },
            ]}
          />
        </Group>
      )}

      {!compact && (
        <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
          Import GeoPackage or GeoJSON files to update road data.
          Published versions can be rolled back if needed.
        </Alert>
      )}

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <Card withBorder padding="md" style={compact ? { flex: 1, overflow: 'auto' } : undefined}>
          <ImportVersionTimeline
            versions={versions}
            onViewChanges={(version, displayNumber) => {
              setViewingHistoryId(version.id);
              setViewingHistoryNumber(displayNumber);
            }}
            onViewOnMap={handleViewOnMap}
            onRollback={(versionId) => setRollbackVersionId(versionId)}
            rollbackJobId={rollbackJobId}
            rollbackInfo={lastRollbackInfo}
            onClearRollbackInfo={clearRollbackInfo}
            totalNonDraft={nonDraftTotal}
            page={page}
            pageSize={PAGE_SIZE}
          />
        </Card>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
      <Card withBorder padding={0} style={{ overflowX: 'auto', ...(compact ? { flex: 1, overflow: 'auto' } : {}) }}>
        {rollbackJobId && (
          <Alert color="blue" variant="light" m="sm">
            <Group gap="sm">
              <Loader size="sm" />
              <Text size="sm">Rolling back to previous version...</Text>
            </Group>
          </Alert>
        )}
        <Table striped highlightOnHover style={{ minWidth: 600 }}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 60 }}>Version</Table.Th>
              <Table.Th style={{ minWidth: 200 }}>File</Table.Th>
              <Table.Th style={{ width: 80 }}>Status</Table.Th>
              <Table.Th style={{ width: 70 }}>Features</Table.Th>
              <Table.Th style={{ width: 80 }}>Uploaded</Table.Th>
              <Table.Th style={{ width: 80 }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {versions.map((version, index) => {
              // Calculate sequential display number (oldest = 1, newest = total)
              // Versions are sorted newest-first, so we reverse the numbering
              const displayNumber = nonDraftTotal - ((page - 1) * PAGE_SIZE) - index;
              return (
              <Table.Tr key={version.id}>
                <Table.Td>
                  <Text size="sm" fw={500}>#{displayNumber}</Text>
                </Table.Td>
                <Table.Td>
                  <Text
                    size="sm"
                    title={(version.status === 'published' || version.status === 'archived')
                      ? `${version.fileName} - Click to view changes`
                      : version.fileName}
                    style={(version.status === 'published' || version.status === 'archived')
                      ? { cursor: 'pointer' }
                      : undefined}
                    onClick={(version.status === 'published' || version.status === 'archived')
                      ? () => {
                          setViewingHistoryId(version.id);
                          setViewingHistoryNumber(displayNumber);
                        }
                      : undefined}
                  >
                    {version.fileName}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {version.fileType.toUpperCase()} · {formatScopeDisplay(version.importScope)}
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
                      <Tooltip label="View import area on map" withArrow>
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          size="sm"
                          onClick={() => handleViewOnMap(version, displayNumber)}
                        >
                          <IconMap size={14} />
                        </ActionIcon>
                      </Tooltip>
                    )}

                    {version.status === 'draft' && (
                      <Tooltip label="Delete draft" withArrow>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="sm"
                          onClick={() => handleDelete(version.id)}
                          loading={deleteMutation.isPending}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Tooltip>
                    )}

                    {/* View changes - for published, archived, and rolled_back */}
                    {(version.status === 'published' || version.status === 'archived' || version.status === 'rolled_back') && (
                      <Tooltip label="View changes from this import" withArrow>
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          size="sm"
                          onClick={() => {
                            setViewingHistoryId(version.id);
                            setViewingHistoryNumber(displayNumber);
                          }}
                        >
                          <IconEye size={14} />
                        </ActionIcon>
                      </Tooltip>
                    )}

                    {/* Rollback - only for archived versions (not rolled_back or published) */}
                    {version.status === 'archived' && version.snapshotPath && (
                      <Tooltip label="Rollback to this version" withArrow>
                        <ActionIcon
                          variant="subtle"
                          color="orange"
                          size="sm"
                          onClick={() => setRollbackVersionId(version.id)}
                          disabled={!!rollbackJobId}
                        >
                          <IconArrowBack size={14} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
              );
            })}

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
      )}

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
            Are you sure you want to rollback? This will restore the road data to the state
            when this version was published.
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

      {/* Historical changes modal */}
      <HistoricalChangesModal
        versionId={viewingHistoryId}
        displayNumber={viewingHistoryNumber}
        onClose={() => setViewingHistoryId(null)}
      />
    </Stack>
  );
}

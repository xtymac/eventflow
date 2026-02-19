/**
 * Import Version List Component
 *
 * Displays list of all import versions with status and actions.
 * Clicking a version triggers one-click preview mode on the map.
 */

import { useState, useRef, useEffect } from 'react';
import { Stack, Text, Group, Center, Loader } from '@/components/shims';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { showNotification } from '@/lib/toast';
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
  useHistoricalDiff,
  type ImportVersion,
  type ImportJob,
} from '../../hooks/useImportVersions';
import { useUIStore } from '../../stores/uiStore';
import { useMapStore } from '../../stores/mapStore';
import { ImportVersionTimeline } from './components/ImportVersionTimeline';
import type { Feature } from 'geojson';

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
 * - "full" -> "Full City"
 * - "ward:Nishi" -> "Nishi Ward"
 * - "bbox:..." -> "File bbox"
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
      return 'bg-gray-100 text-gray-800';
    case 'published':
      return 'bg-green-100 text-green-800';
    case 'archived':
      return 'bg-orange-100 text-orange-800';
    case 'rolled_back':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
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
    startImportPreview,
    lastRollbackInfo,
    setLastRollbackInfo,
    clearRollbackInfo,
    enterHistoricalPreview,
  } = useUIStore();
  const setImportAreaHighlight = useMapStore((s) => s.setImportAreaHighlight);
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [rollbackVersionId, setRollbackVersionId] = useState<string | null>(null);
  const [rollbackJobId, setRollbackJobId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'table'>('timeline'); // Timeline is default

  // Pending preview state - when user clicks to preview, we fetch diff first
  const [pendingPreviewVersionId, setPendingPreviewVersionId] = useState<string | null>(null);
  const [pendingPreviewDisplayNumber, setPendingPreviewDisplayNumber] = useState<number>(0);

  // Track pending rollback info to set after rollback completes
  const pendingRollbackInfoRef = useRef<{ fromVersionNumber: number; toVersionNumber: number } | null>(null);

  // Fetch diff for pending preview
  const { data: diffData, isLoading: isDiffLoading, error: diffError } = useHistoricalDiff(pendingPreviewVersionId);

  // Handle error loading historical diff
  useEffect(() => {
    if (pendingPreviewVersionId && diffError && !isDiffLoading) {
      showNotification({
        title: 'History not available',
        message: 'Change history for this version is not available. It may have been deleted or never created.',
        color: 'yellow',
      });
      setPendingPreviewVersionId(null);
    }
  }, [pendingPreviewVersionId, diffError, isDiffLoading]);

  // Enter preview mode when diff is loaded
  useEffect(() => {
    if (pendingPreviewVersionId && diffData?.data && !isDiffLoading) {
      const diff = diffData.data;
      // Build features array from diff
      const allFeatures: Feature[] = [];
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

      if (allFeatures.length === 0) {
        showNotification({
          title: 'No changes to preview',
          message: 'No roads were modified in this import',
          color: 'yellow',
        });
        setPendingPreviewVersionId(null);
        return;
      }

      // Set highlight for first feature
      const firstFeature = allFeatures[0];
      const props = firstFeature.properties as { name?: string; id?: string } | null;
      const label = props?.name || props?.id || 'Unnamed Road';
      setImportAreaHighlight({
        geometry: firstFeature.geometry!,
        label,
      });

      // Enter historical preview mode
      enterHistoricalPreview(pendingPreviewVersionId, pendingPreviewDisplayNumber, allFeatures);
      closeImportExportSidebar();

      // Clear pending state
      setPendingPreviewVersionId(null);
    }
  }, [pendingPreviewVersionId, diffData, isDiffLoading, pendingPreviewDisplayNumber, enterHistoricalPreview, closeImportExportSidebar, setImportAreaHighlight]);

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

      showNotification({
        title: 'Rollback successful',
        message: 'Roads have been restored to the previous state',
        color: 'green',
      });
    },
    onError: (job: ImportJob) => {
      setRollbackJobId(null);
      setRollbackVersionId(null);
      pendingRollbackInfoRef.current = null;
      showNotification({
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
      showNotification({
        title: 'Version deleted',
        message: 'Draft version has been deleted',
        color: 'green',
      });
    } catch (error) {
      showNotification({
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
      showNotification({
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
      showNotification({
        title: 'Rollback failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    }
  };

  const handleViewDetails = (version: ImportVersion, displayNumber: number) => {
    // Directly trigger preview mode by fetching diff
    setPendingPreviewVersionId(version.id);
    setPendingPreviewDisplayNumber(displayNumber);
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

  // --- Render List View ---
  return (
    <Stack gap="md" style={compact ? { height: '100%', display: 'flex', flexDirection: 'column' } : undefined}>
      {/* Only show header when not in compact mode */}
      {!compact && (
        <Group justify="space-between">
          <Text fw={600}>Import History</Text>
          <Group gap="sm">
            <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as 'timeline' | 'table')}>
              <ToggleGroupItem value="timeline" aria-label="Timeline view" size="sm">
                <IconTimeline size={14} />
              </ToggleGroupItem>
              <ToggleGroupItem value="table" aria-label="Table view" size="sm">
                <IconList size={14} />
              </ToggleGroupItem>
            </ToggleGroup>
            <Button onClick={handleNewImport} size="sm">
              <IconUpload size={16} className="mr-1" />
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
            style={{ flex: 1 }}
          >
            <IconUpload size={16} className="mr-1" />
            New Import
          </Button>
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as 'timeline' | 'table')}>
            <ToggleGroupItem value="timeline" aria-label="Timeline view" size="sm">
              <IconTimeline size={14} />
            </ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label="Table view" size="sm">
              <IconList size={14} />
            </ToggleGroupItem>
          </ToggleGroup>
        </Group>
      )}

      {!compact && (
        <Alert>
          <IconInfoCircle size={16} />
          <AlertDescription>
            Import GeoPackage or GeoJSON files to update road data.
            Published versions can be rolled back if needed.
          </AlertDescription>
        </Alert>
      )}

      {/* Loading overlay when fetching diff for preview */}
      {isDiffLoading && pendingPreviewVersionId && (
        <Alert>
          <AlertDescription>
            <Group gap="sm">
              <Loader size="sm" />
              <Text size="sm">Loading preview...</Text>
            </Group>
          </AlertDescription>
        </Alert>
      )}

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <div className="border rounded-md p-4" style={compact ? { flex: 1, overflowY: 'auto', overflowX: 'hidden' } : undefined}>
          <ImportVersionTimeline
            versions={versions}
            onViewChanges={handleViewDetails}
            onRollback={(versionId) => setRollbackVersionId(versionId)}
            rollbackJobId={rollbackJobId}
            targetRollbackId={rollbackVersionId}
            rollbackInfo={lastRollbackInfo}
            onClearRollbackInfo={clearRollbackInfo}
            totalNonDraft={nonDraftTotal}
            page={page}
            pageSize={PAGE_SIZE}
          />
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="border rounded-md" style={{ overflowX: 'auto', ...(compact ? { flex: 1, overflow: 'auto' } : {}) }}>
          {rollbackJobId && (
            <Alert className="m-2">
              <AlertDescription>
                <Group gap="sm">
                  <Loader size="sm" />
                  <Text size="sm">Rolling back to previous version...</Text>
                </Group>
              </AlertDescription>
            </Alert>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: 60 }}>Version</TableHead>
                <TableHead style={{ minWidth: 200 }}>File</TableHead>
                <TableHead style={{ width: 80 }}>Status</TableHead>
                <TableHead style={{ width: 70 }}>Features</TableHead>
                <TableHead style={{ width: 80 }}>Uploaded</TableHead>
                <TableHead style={{ width: 80 }}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions.map((version, index) => {
                // Calculate sequential display number (oldest = 1, newest = total)
                const displayNumber = nonDraftTotal - ((page - 1) * PAGE_SIZE) - index;
                return (
                  <TableRow key={version.id}>
                    <TableCell>
                      <Text size="sm" fw={500}>#{displayNumber}</Text>
                    </TableCell>
                    <TableCell>
                      <Text
                        size="sm"
                        className={
                          (version.status === 'published' || version.status === 'archived')
                            ? 'cursor-pointer font-medium'
                            : undefined
                        }
                        onClick={(version.status === 'published' || version.status === 'archived')
                          ? () => handleViewDetails(version, displayNumber)
                          : undefined}
                      >
                        {version.fileName}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {version.fileType.toUpperCase()} · {formatScopeDisplay(version.importScope)}
                      </Text>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(version.status)} style={{ minWidth: 70 }}>
                        {version.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Text size="sm">{version.featureCount.toLocaleString()}</Text>
                    </TableCell>
                    <TableCell>
                      <Text size="sm">{formatDate(version.uploadedAt)}</Text>
                    </TableCell>
                    <TableCell>
                      <Group gap="xs">
                        {version.importScope.startsWith('bbox:') && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleViewOnMap(version, displayNumber)}
                              >
                                <IconMap size={14} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View import area on map</TooltipContent>
                          </Tooltip>
                        )}

                        {version.status === 'draft' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-600"
                                onClick={() => handleDelete(version.id)}
                                disabled={deleteMutation.isPending}
                              >
                                <IconTrash size={14} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete draft</TooltipContent>
                          </Tooltip>
                        )}

                        {/* View changes - for published, archived, and rolled_back */}
                        {(version.status === 'published' || version.status === 'archived' || version.status === 'rolled_back') && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleViewDetails(version, displayNumber)}
                              >
                                <IconEye size={14} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View changes from this import</TooltipContent>
                          </Tooltip>
                        )}

                        {/* Rollback - only for archived versions (not rolled_back or published) */}
                        {version.status === 'archived' && version.snapshotPath && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-orange-600"
                                onClick={() => setRollbackVersionId(version.id)}
                                disabled={!!rollbackJobId}
                              >
                                <IconArrowBack size={14} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Rollback to this version</TooltipContent>
                          </Tooltip>
                        )}
                      </Group>
                    </TableCell>
                  </TableRow>
                );
              })}

              {versions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Text c="dimmed" ta="center" py="lg">
                      No import versions yet. Click "New Import" to get started.
                    </Text>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 1 && (
        <Group justify="center">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        </Group>
      )}

      {/* Rollback confirmation modal */}
      <Dialog
        open={!!rollbackVersionId && !rollbackJobId}
        onOpenChange={(v) => !v && setRollbackVersionId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Rollback</DialogTitle>
          </DialogHeader>
          <Stack gap="md">
            <Text size="sm">
              Are you sure you want to rollback? This will restore the road data to the state
              when this version was published.
            </Text>
            <Group justify="flex-end" gap="sm">
              <Button variant="ghost" onClick={() => setRollbackVersionId(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleRollback}
                disabled={rollbackMutation.isPending}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {rollbackMutation.isPending ? 'Rolling back...' : 'Confirm Rollback'}
              </Button>
            </Group>
          </Stack>
        </DialogContent>
      </Dialog>
    </Stack>
  );
}

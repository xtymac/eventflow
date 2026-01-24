/**
 * Import Version Timeline Component
 *
 * Displays import versions in a vertical timeline view.
 * Shows version status, timestamps, change stats, and available actions.
 */

import {
  Stack,
  Text,
  Card,
  Badge,
  Group,
  Alert,
  Tooltip,
  Loader,
  Timeline,
  ThemeIcon,
  Button,
} from '@mantine/core';
import {
  IconCheck,
  IconHistory,
  IconTrendingUp,
  IconTrendingDown,
  IconCalendar,
  IconRoad,
  IconClick,
  IconLock,
} from '@tabler/icons-react';
import type { ImportVersion } from '../../../hooks/useImportVersions';

interface ImportVersionTimelineProps {
  versions: ImportVersion[];
  onViewChanges: (version: ImportVersion, displayNumber: number) => void;
  // onViewOnMap is now handled in details view
  onRollback: (versionId: string) => void;
  rollbackJobId: string | null;
  targetRollbackId?: string | null;
  rollbackInfo: {
    fromVersionNumber: number;
    toVersionNumber: number;
    timestamp: Date;
  } | null;
  onClearRollbackInfo: () => void;
  /** Total count of non-draft versions (for calculating display numbers) */
  totalNonDraft: number;
  /** Current page (1-indexed) */
  page: number;
  /** Page size */
  pageSize: number;
}

interface StatusConfig {
  label: string;
  color: string;
  variant: 'filled' | 'light' | 'outline';
  icon?: React.ReactNode;
  hoverHint?: string;
}

function getStatusConfig(status: ImportVersion['status']): StatusConfig {
  switch (status) {
    case 'published':
      return {
        label: 'Published',
        color: 'green',
        variant: 'filled',
        hoverHint: 'Currently active version',
      };
    case 'archived':
      return {
        label: 'Previous',
        color: 'gray',
        variant: 'light',
        // No lock icon - card is clickable
        hoverHint: 'Click to view changes',
      };
    case 'rolled_back':
      return {
        label: 'Rolled Back',
        color: 'gray',
        variant: 'light',
        hoverHint: 'This version was reverted',
      };
    case 'draft':
      return {
        label: 'Draft',
        color: 'yellow',
        variant: 'light',
        hoverHint: 'Unpublished import',
      };
    default:
      return {
        label: status,
        color: 'gray',
        variant: 'light',
      };
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

export function ImportVersionTimeline({
  versions,
  onViewChanges,
  onRollback,
  rollbackJobId,
  targetRollbackId,
  rollbackInfo,
  onClearRollbackInfo,
  totalNonDraft,
  page,
  pageSize,
}: ImportVersionTimelineProps) {

  if (versions.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="lg">
        No import versions yet. Click "New Import" to get started.
      </Text>
    );
  }

  // Find target version details for the alert
  const targetVersion = targetRollbackId ? versions.find(v => v.id === targetRollbackId) : null;
  const targetIndex = targetVersion ? versions.indexOf(targetVersion) : -1;
  const targetDisplayNumber = targetIndex !== -1
    ? totalNonDraft - ((page - 1) * pageSize) - targetIndex
    : null;

  return (
    <Stack gap="xs">
      {/* Rollback notification */}
      {rollbackInfo && (
        <Alert
          color="blue"
          variant="light"
          icon={<IconHistory size={16} />}
          withCloseButton
          onClose={onClearRollbackInfo}
          mb="sm"
        >
          <Text size="sm">
            <strong>Rolled back to #{rollbackInfo.toVersionNumber}</strong>
            {' '}· Version #{rollbackInfo.fromVersionNumber} was rolled back
          </Text>
        </Alert>
      )}

      {/* Rollback in progress */}
      {rollbackJobId && (
        <Alert color="blue" variant="light" mb="sm">
          <Group gap="sm">
            <Loader size="sm" />
            <Text size="sm">
              {targetVersion && targetDisplayNumber
                ? `Restoring Version #${targetDisplayNumber} (${targetVersion.fileName})...`
                : 'Restoring previous version...'}
            </Text>
          </Group>
        </Alert>
      )}

      <Timeline active={-1} bulletSize={24} lineWidth={2}>
        {versions.map((version, index) => {
          // Calculate sequential display number (oldest = 1, newest = total)
          // Versions are sorted newest-first, so we reverse the numbering
          const displayNumber = totalNonDraft - ((page - 1) * pageSize) - index;

          // Get previous version's feature count for trend comparison
          // Previous version is the next item in the array (older version)
          const previousVersion = versions[index + 1];
          const previousFeatureCount = previousVersion?.featureCount ?? null;

          const isPublished = version.status === 'published';
          const isRolledBack = version.status === 'rolled_back';
          const isDraft = version.status === 'draft';
          const isArchived = version.status === 'archived';
          const hasSnapshot = !!version.snapshotPath;
          const canRollback = hasSnapshot && !isPublished && !isRolledBack && !isDraft;

          // Determine if this is the target of the current rollback
          const isTarget = version.id === targetRollbackId;
          const isProcessing = !!rollbackJobId;

          // Get base status config, then override for archived without snapshot
          let statusConfig = getStatusConfig(version.status);
          if (isArchived && !hasSnapshot) {
            statusConfig = {
              label: 'Locked',
              color: 'gray',
              variant: 'outline',
              icon: <IconLock size={10} />,
              hoverHint: 'Change history unavailable',
            };
          }

          // Calculate trend compared to previous version
          const featureCountDiff = previousFeatureCount != null && version.featureCount != null
            ? version.featureCount - previousFeatureCount
            : null;
          const showTrend = featureCountDiff !== null && featureCountDiff !== 0 && !isRolledBack;

          // Determine interactivity - archived requires snapshot to be viewable
          // Disable interaction during rollback
          const isInteractive = (isPublished || (isArchived && hasSnapshot)) && !isRolledBack && !isProcessing;

          return (
            <Timeline.Item
              key={version.id}
              bullet={
                isPublished ? (
                  <IconCheck size={14} />
                ) : isRolledBack ? (
                  <IconHistory size={14} />
                ) : (
                  <Text size="xs" fw={700}>{displayNumber}</Text>
                )
              }
              color={isPublished ? 'green' : isRolledBack ? 'gray' : isTarget ? 'blue' : 'blue'}
              lineVariant={isRolledBack ? 'dashed' : 'solid'}
            >
              <Tooltip
                label={statusConfig.hoverHint}
                withArrow
                position="top"
                disabled={!statusConfig.hoverHint || isPublished}
                openDelay={400}
              >
              <Card
                padding="xs"
                radius="md"
                withBorder
                onClick={() => isInteractive && onViewChanges(version, displayNumber)}
                style={{
                  cursor: isInteractive ? 'pointer' : 'default',
                  opacity: isRolledBack ? 0.6 : (isArchived && !hasSnapshot) ? 0.5 : 1,
                  transition: 'all 0.2s ease',
                  // Visual differentiation by state
                  borderColor: isTarget ? 'var(--mantine-color-blue-4)' :
                               isPublished ? 'var(--mantine-color-green-4)' :
                               (isArchived && !hasSnapshot) ? 'var(--mantine-color-gray-4)' :
                               isArchived ? 'var(--mantine-color-gray-3)' : undefined,
                  borderStyle: (isArchived && !hasSnapshot) ? 'dashed' : 'solid',
                  backgroundColor: isTarget ? 'var(--mantine-color-blue-0)' :
                                   isPublished ? 'var(--mantine-color-green-0)' :
                                   (isArchived && !hasSnapshot) ? 'var(--mantine-color-gray-1)' :
                                   isArchived ? 'var(--mantine-color-gray-0)' : undefined,
                }}
                className={isInteractive ? 'timeline-card-interactive' : ''}
              >
                <Group justify="space-between" mb={2} align="flex-start" wrap="nowrap">
                  <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                    <Group gap="xs" wrap="nowrap">
                      <Text size="sm" fw={600} lineClamp={1} title={version.fileName}>
                        {version.fileName}
                      </Text>
                      <Badge
                        size="xs"
                        color={statusConfig.color}
                        variant={statusConfig.variant}
                        leftSection={statusConfig.icon}
                        style={{
                          // Archived: lower contrast
                          opacity: isArchived ? 0.8 : 1,
                        }}
                      >
                        {statusConfig.label}
                      </Badge>
                    </Group>
                    <Group gap={6} c="dimmed">
                      <IconCalendar size={12} />
                      <Text size="xs">
                        {version.publishedAt ? formatDate(version.publishedAt) : formatDate(version.uploadedAt)}
                      </Text>
                    </Group>
                  </Stack>
                  {isInteractive && (
                    <ThemeIcon variant="transparent" color="gray" size="sm" mt={2}>
                      <IconClick size={16} />
                    </ThemeIcon>
                  )}
                </Group>

                {/* Stats Row with inline Restore button */}
                {(version.featureCount != null) && !isRolledBack && (
                  <Group gap="md" mt={4} justify="space-between" wrap="nowrap">
                    <Group gap="md" wrap="nowrap">
                      <Group gap={4}>
                        <IconRoad size={14} color="var(--mantine-color-gray-6)" />
                        <Text size="xs" fw={500}>{version.featureCount.toLocaleString()}</Text>
                        {showTrend && (
                          <Tooltip
                            label={`${featureCountDiff! > 0 ? '+' : ''}${featureCountDiff!.toLocaleString()} from previous`}
                            withArrow
                            position="right"
                          >
                            <ThemeIcon
                              size="xs"
                              variant="transparent"
                              color={featureCountDiff! > 0 ? 'green' : 'orange'}
                              >
                              {featureCountDiff! > 0 ? <IconTrendingUp size={12} /> : <IconTrendingDown size={12} />}
                            </ThemeIcon>
                          </Tooltip>
                        )}
                      </Group>

                      {(version.addedCount !== null || version.updatedCount !== null || version.deactivatedCount !== null) && (
                        <Group gap={8}>
                          {version.addedCount !== null && version.addedCount > 0 && <Text size="xs" c="green.7">+{version.addedCount}</Text>}
                          {version.updatedCount !== null && version.updatedCount > 0 && <Text size="xs" c="blue.7">~{version.updatedCount}</Text>}
                          {version.deactivatedCount !== null && version.deactivatedCount > 0 && <Text size="xs" c="orange.7">-{version.deactivatedCount}</Text>}
                        </Group>
                      )}
                    </Group>

                    {/* Inline Restore button */}
                    {canRollback && (
                      isTarget && isProcessing ? (
                        <Group gap={4}>
                          <Loader size={12} />
                          <Text size="xs" c="blue">Restoring...</Text>
                        </Group>
                      ) : (
                      <Button
                        variant="subtle"
                        color="orange"
                        size="compact-xs"
                        leftSection={<IconHistory size={12} />}
                        onClick={(e) => {
                          e.stopPropagation();
                          onRollback(version.id);
                        }}
                        disabled={isProcessing}
                      >
                        Restore
                      </Button>
                      )
                    )}
                  </Group>
                )}

                {isRolledBack && (
                  <Text size="xs" c="dimmed" fs="italic" mt={4}>Rolled back on {formatDate(version.rolledBackAt)}</Text>
                )}

              </Card>
              </Tooltip>
            </Timeline.Item>
          );
        })}
      </Timeline>

      {/* CSS for hover effect */}
      <style>
        {`
          .timeline-card-interactive:hover {
             border-color: var(--mantine-color-blue-4) !important;
             box-shadow: 0 2px 8px rgba(0,0,0,0.08);
             transform: translateY(-1px);
          }
          .timeline-card-interactive:active {
             transform: translateY(0);
          }
          `}
      </style>
    </Stack>
  );
}

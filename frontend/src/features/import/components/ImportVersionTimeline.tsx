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
} from '@tabler/icons-react';
import type { ImportVersion } from '../../../hooks/useImportVersions';

interface ImportVersionTimelineProps {
  versions: ImportVersion[];
  onViewChanges: (version: ImportVersion, displayNumber: number) => void;
  // onViewOnMap is now handled in details view
  onRollback: (versionId: string) => void;
  rollbackJobId: string | null;
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

function getStatusLabel(status: ImportVersion['status']): string {
  switch (status) {
    case 'published':
      return 'Published'; // Changed from 'Current' to be more descriptive in history
    case 'archived':
      return 'Archived';
    case 'rolled_back':
      return 'Rolled Back';
    case 'draft':
      return 'Draft';
    default:
      return status;
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
            <Text size="sm">Rolling back to previous version...</Text>
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
          const canRollback = version.snapshotPath && !isPublished && !isRolledBack && !isDraft;

          // Calculate trend compared to previous version
          const featureCountDiff = previousFeatureCount != null && version.featureCount != null
            ? version.featureCount - previousFeatureCount
            : null;
          const showTrend = featureCountDiff !== null && featureCountDiff !== 0 && !isRolledBack;

          // Determine interactivity
          const isInteractive = (isPublished || isArchived) && !isRolledBack;

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
              color={isPublished ? 'green' : isRolledBack ? 'gray' : 'blue'}
              lineVariant={isRolledBack ? 'dashed' : 'solid'}
            >
              <Card
                padding="xs"
                radius="md"
                withBorder
                onClick={() => isInteractive && onViewChanges(version, displayNumber)}
                style={{
                  cursor: isInteractive ? 'pointer' : 'default',
                  opacity: isRolledBack ? 0.7 : 1,
                  transition: 'all 0.2s ease',
                  borderColor: isPublished ? 'var(--mantine-color-green-3)' : undefined,
                  backgroundColor: isPublished ? 'var(--mantine-color-green-0)' : undefined
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
                        color={isPublished ? 'green' : isRolledBack ? 'gray' : 'gray'}
                        variant="light"
                      >
                        {getStatusLabel(version.status)}
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
                      <Button
                        variant="subtle"
                        color="orange"
                        size="compact-xs"
                        leftSection={<IconHistory size={12} />}
                        onClick={(e) => {
                          e.stopPropagation();
                          onRollback(version.id);
                        }}
                        loading={!!rollbackJobId}
                      >
                        Restore
                      </Button>
                    )}
                  </Group>
                )}

                {isRolledBack && (
                  <Text size="xs" c="dimmed" fs="italic" mt={4}>Rolled back on {formatDate(version.rolledBackAt)}</Text>
                )}

              </Card>
            </Timeline.Item>
          );
        })}
      </Timeline>

      {/* CSS for hover effect */}
      <style>
        {`
          .timeline-card-interactive:hover {
             border-color: var(--mantine-color-blue-4) !important;
             box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          }
          `}
      </style>
    </Stack>
  );
}

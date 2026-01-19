/**
 * Import Version Timeline Component
 *
 * Displays import versions in a vertical timeline view.
 * Shows version status, timestamps, change stats, and available actions.
 */

import {
  Stack,
  Text,
  Box,
  Card,
  Badge,
  Group,
  ActionIcon,
  Alert,
  Tooltip,
  Loader,
} from '@mantine/core';
import {
  IconCheck,
  IconHistory,
  IconTrendingUp,
  IconTrendingDown,
  IconCalendar,
  IconRoad,
  IconFileDescription,
} from '@tabler/icons-react';
import type { ImportVersion } from '../../../hooks/useImportVersions';

interface ImportVersionTimelineProps {
  versions: ImportVersion[];
  onViewChanges: (version: ImportVersion, displayNumber: number) => void;
  onViewOnMap: (version: ImportVersion, displayNumber: number) => void;
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

function getStatusLabel(status: ImportVersion['status']): string {
  switch (status) {
    case 'published':
      return 'Current';
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

interface TimelineNodeProps {
  status: ImportVersion['status'];
  isFirst: boolean;
  isLast: boolean;
}

function TimelineNode({ status, isFirst, isLast }: TimelineNodeProps) {
  const isPublished = status === 'published';
  const isRolledBack = status === 'rolled_back';
  const isDraft = status === 'draft';

  // Node styles based on status - matching reference design with larger circles
  const nodeStyle = {
    width: 32,
    height: 32,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isPublished
      ? 'var(--mantine-color-green-6)'
      : 'var(--mantine-color-white)',
    border: isPublished
      ? '3px solid var(--mantine-color-green-6)'
      : isRolledBack || isDraft
        ? '2px dashed var(--mantine-color-gray-4)'
        : '2px solid var(--mantine-color-gray-4)',
    boxShadow: isPublished ? '0 0 0 4px var(--mantine-color-green-1)' : undefined,
  };

  // Line connecting to next node
  const lineStyle = {
    width: 2,
    flex: 1,
    minHeight: 60,
    backgroundColor: 'var(--mantine-color-gray-3)',
    marginTop: 4,
    marginBottom: 4,
  };

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 40, paddingTop: 4 }}>
      {/* Connecting line from top (if not first) */}
      {!isFirst && (
        <Box
          style={{
            width: 2,
            height: 12,
            backgroundColor: 'var(--mantine-color-gray-3)',
          }}
        />
      )}

      {/* Node */}
      <Box style={nodeStyle}>
        {isPublished && <IconCheck size={18} color="white" strokeWidth={3} />}
      </Box>

      {/* Connecting line to bottom (if not last) */}
      {!isLast && <Box style={lineStyle} />}
    </Box>
  );
}

interface TimelineItemProps {
  version: ImportVersion;
  displayNumber: number;
  isFirst: boolean;
  isLast: boolean;
  onViewChanges: () => void;
  onViewOnMap: () => void;
  onRollback: () => void;
  isRollbackInProgress: boolean;
  /** Previous version's feature count for trend comparison */
  previousFeatureCount?: number | null;
}

function TimelineItem({
  version,
  displayNumber,
  isFirst,
  isLast,
  onViewChanges,
  onViewOnMap,
  onRollback,
  isRollbackInProgress,
  previousFeatureCount,
}: TimelineItemProps) {
  const isPublished = version.status === 'published';
  const isRolledBack = version.status === 'rolled_back';
  const isDraft = version.status === 'draft';
  const isArchived = version.status === 'archived';
  const canViewOnMap = version.importScope.startsWith('bbox:');
  const canRollback = version.snapshotPath && !isPublished && !isRolledBack && !isDraft;

  // Calculate trend compared to previous version
  const featureCountDiff = previousFeatureCount != null && version.featureCount != null
    ? version.featureCount - previousFeatureCount
    : null;
  const showTrend = featureCountDiff !== null && featureCountDiff !== 0 && !isRolledBack;

  // Card styles based on status - matching reference design
  const cardStyle = {
    flex: 1,
    borderColor: isPublished
      ? 'var(--mantine-color-green-5)'
      : 'var(--mantine-color-gray-3)',
    borderWidth: isPublished ? 2 : 1,
    borderStyle: isRolledBack ? 'dashed' : 'solid',
    opacity: isRolledBack ? 0.6 : 1,
    cursor: canViewOnMap ? 'pointer' : 'default',
    transition: 'box-shadow 0.15s',
  };

  // Handle card click for map preview
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking action links
    if ((e.target as HTMLElement).closest('a, button')) return;
    if (canViewOnMap && !isRolledBack) {
      onViewOnMap();
    }
  };

  // Format date for display
  const displayDate = isRolledBack && version.rolledBackAt
    ? formatDate(version.rolledBackAt)
    : version.publishedAt
      ? formatDate(version.publishedAt)
      : formatDate(version.uploadedAt);

  return (
    <Box style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
      <TimelineNode status={version.status} isFirst={isFirst} isLast={isLast} />

      <Card
        withBorder
        padding="md"
        style={cardStyle}
        onClick={handleCardClick}
        className={canViewOnMap && !isRolledBack ? 'timeline-card-clickable' : undefined}
      >
        {/* Header row - Badge and version number */}
        <Group gap="sm" mb="xs">
          <Badge
            color={isPublished ? 'green' : isRolledBack ? 'gray' : 'orange'}
            size="sm"
            variant={isPublished ? 'filled' : 'outline'}
            tt="uppercase"
            fw={600}
          >
            {getStatusLabel(version.status)}
          </Badge>
          <Text size="sm" c="dimmed">#{displayNumber}</Text>
        </Group>

        {/* File name row */}
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
            <IconFileDescription size={18} color="var(--mantine-color-gray-5)" style={{ flexShrink: 0 }} />
            <Tooltip label={version.fileName} withArrow position="top" disabled={version.fileName.length < 30}>
              <Text fw={600} size="md" lineClamp={1}>
                {version.fileName}
              </Text>
            </Tooltip>
          </Group>

          {/* Action links - right side */}
          <Group gap="md" style={{ flexShrink: 0 }}>
            {(version.status !== 'draft') && (
              <Text
                component="a"
                href="#"
                size="sm"
                c="dimmed"
                style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                onClick={(e) => { e.preventDefault(); onViewChanges(); }}
                className="timeline-action-link"
              >
                <Box component="span" style={{ display: 'flex', alignItems: 'center' }}>◎</Box>
                View
              </Text>
            )}

            {canRollback && (
              <Text
                component="a"
                href="#"
                size="sm"
                c="dimmed"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  textDecoration: 'none',
                  opacity: isRollbackInProgress ? 0.5 : 1,
                  pointerEvents: isRollbackInProgress ? 'none' : 'auto',
                }}
                onClick={(e) => { e.preventDefault(); if (!isRollbackInProgress) onRollback(); }}
                className="timeline-action-link"
              >
                <Box component="span" style={{ display: 'flex', alignItems: 'center' }}>↺</Box>
                Restore
              </Text>
            )}
          </Group>
        </Group>

        {/* Metadata row - Date and item count */}
        <Group gap="md" mt="xs">
          <Group gap={6} c="dimmed">
            <IconCalendar size={14} />
            <Text size="xs">{displayDate}</Text>
          </Group>

          {version.featureCount != null && (
            <Group gap={6} align="center">
              <IconRoad size={14} color="var(--mantine-color-dimmed)" />
              <Text size="xs" c={showTrend ? (featureCountDiff! > 0 ? 'green' : 'orange') : 'dimmed'}>
                {version.featureCount.toLocaleString()} items
              </Text>
              {showTrend && (
                <Tooltip
                  label={`${featureCountDiff! > 0 ? '+' : ''}${featureCountDiff!.toLocaleString()} from previous`}
                  withArrow
                >
                  <Box style={{ display: 'flex', alignItems: 'center' }}>
                    {featureCountDiff! > 0 ? (
                      <IconTrendingUp size={12} color="var(--mantine-color-green-6)" />
                    ) : (
                      <IconTrendingDown size={12} color="var(--mantine-color-orange-6)" />
                    )}
                  </Box>
                </Tooltip>
              )}
            </Group>
          )}
        </Group>

        {/* Change stats (if available) - show on separate line for non-rolled-back versions */}
        {(version.addedCount !== null || version.updatedCount !== null || version.deactivatedCount !== null) && !isRolledBack && (
          <Group gap="sm" mt="xs">
            {version.addedCount !== null && version.addedCount > 0 && (
              <Text size="xs" c="green">+{version.addedCount.toLocaleString()} added</Text>
            )}
            {version.updatedCount !== null && version.updatedCount > 0 && (
              <Text size="xs" c="blue">{version.updatedCount.toLocaleString()} updated</Text>
            )}
            {version.deactivatedCount !== null && version.deactivatedCount > 0 && (
              <Text size="xs" c="orange">{version.deactivatedCount.toLocaleString()} removed</Text>
            )}
          </Group>
        )}

        {/* Rolled back message */}
        {isRolledBack && (
          <Text size="xs" c="dimmed" mt="xs" fs="italic">
            Changes from this version were undone
          </Text>
        )}
      </Card>
    </Box>
  );
}

export function ImportVersionTimeline({
  versions,
  onViewChanges,
  onViewOnMap,
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

      {/* Timeline items */}
      {versions.map((version, index) => {
        // Calculate sequential display number (oldest = 1, newest = total)
        // Versions are sorted newest-first, so we reverse the numbering
        const displayNumber = totalNonDraft - ((page - 1) * pageSize) - index;

        // Get previous version's feature count for trend comparison
        // Previous version is the next item in the array (older version)
        const previousVersion = versions[index + 1];
        const previousFeatureCount = previousVersion?.featureCount ?? null;

        return (
          <TimelineItem
            key={version.id}
            version={version}
            displayNumber={displayNumber}
            isFirst={index === 0}
            isLast={index === versions.length - 1}
            onViewChanges={() => onViewChanges(version, displayNumber)}
            onViewOnMap={() => onViewOnMap(version, displayNumber)}
            onRollback={() => onRollback(version.id)}
            isRollbackInProgress={!!rollbackJobId}
            previousFeatureCount={previousFeatureCount}
          />
        );
      })}
    </Stack>
  );
}

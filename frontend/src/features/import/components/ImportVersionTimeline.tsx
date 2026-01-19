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
  IconArrowBack,
  IconMap,
  IconEye,
  IconHistory,
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

  // Node styles based on status
  const nodeStyle = {
    width: 24,
    height: 24,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isPublished
      ? 'var(--mantine-color-green-6)'
      : 'var(--mantine-color-gray-0)',
    border: isRolledBack || isDraft
      ? '2px dashed var(--mantine-color-gray-4)'
      : isPublished
        ? 'none'
        : '2px solid var(--mantine-color-orange-5)',
  };

  // Line connecting to next node
  const lineStyle = {
    width: 2,
    flex: 1,
    minHeight: 40,
    backgroundColor: isPublished
      ? 'var(--mantine-color-green-3)'
      : isRolledBack || isDraft
        ? 'var(--mantine-color-gray-3)'
        : 'var(--mantine-color-gray-3)',
    borderStyle: isRolledBack || isDraft ? 'dashed' : 'solid',
    marginTop: 4,
    marginBottom: 4,
  };

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32 }}>
      {/* Connecting line from top (if not first) */}
      {!isFirst && (
        <Box
          style={{
            width: 2,
            height: 8,
            backgroundColor: 'var(--mantine-color-gray-3)',
          }}
        />
      )}

      {/* Node */}
      <Box style={nodeStyle}>
        {isPublished && <IconCheck size={14} color="white" />}
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
}: TimelineItemProps) {
  const isPublished = version.status === 'published';
  const isRolledBack = version.status === 'rolled_back';
  const isDraft = version.status === 'draft';
  const canViewOnMap = version.importScope.startsWith('bbox:');
  const canRollback = version.snapshotPath && !isPublished && !isRolledBack && !isDraft;

  // Card styles based on status
  const cardStyle = {
    flex: 1,
    borderColor: isPublished
      ? 'var(--mantine-color-green-5)'
      : isRolledBack
        ? 'var(--mantine-color-gray-4)'
        : undefined,
    borderWidth: isPublished ? 2 : 1,
    borderStyle: isRolledBack ? 'dashed' : 'solid',
    backgroundColor: isRolledBack ? 'var(--mantine-color-gray-0)' : undefined,
    opacity: isRolledBack ? 0.8 : 1,
  };

  return (
    <Box style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
      <TimelineNode status={version.status} isFirst={isFirst} isLast={isLast} />

      <Card withBorder padding="sm" style={cardStyle}>
        {/* Header row */}
        <Group justify="space-between" mb={4}>
          <Group gap="xs">
            <Text fw={600} size="sm">#{displayNumber}</Text>
            <Text size="sm" lineClamp={1} style={{ maxWidth: 180 }}>
              {version.fileName}
            </Text>
          </Group>
          <Badge
            color={getStatusColor(version.status)}
            size="sm"
            variant={isPublished ? 'filled' : 'light'}
          >
            {getStatusLabel(version.status)}
          </Badge>
        </Group>

        {/* Timestamp info */}
        <Text size="xs" c="dimmed">
          {isRolledBack && version.rolledBackAt
            ? `Rolled back ${formatDate(version.rolledBackAt)}`
            : isPublished
              ? `Published ${formatDate(version.publishedAt)}`
              : `Uploaded ${formatDate(version.uploadedAt)}`}
          {version.featureCount && ` · ${version.featureCount.toLocaleString()} roads`}
        </Text>

        {/* Change stats (if available) */}
        {(version.addedCount !== null || version.updatedCount !== null || version.deactivatedCount !== null) && !isRolledBack && (
          <Group gap="xs" mt={4}>
            {version.addedCount !== null && version.addedCount > 0 && (
              <Text size="xs" c="green">+{version.addedCount} added</Text>
            )}
            {version.updatedCount !== null && version.updatedCount > 0 && (
              <Text size="xs" c="blue">{version.updatedCount} updated</Text>
            )}
            {version.deactivatedCount !== null && version.deactivatedCount > 0 && (
              <Text size="xs" c="orange">{version.deactivatedCount} removed</Text>
            )}
            {version.addedCount === 0 && version.updatedCount === 0 && version.deactivatedCount === 0 && (
              <Text size="xs" c="dimmed">No changes</Text>
            )}
          </Group>
        )}

        {/* Rolled back message */}
        {isRolledBack && (
          <Text size="xs" c="dimmed" mt={4} fs="italic">
            Changes from this version were undone
          </Text>
        )}

        {/* Action buttons */}
        <Group gap="xs" mt="sm">
          {/* View Changes button - for published, archived, rolled_back */}
          {(version.status !== 'draft') && (
            <Tooltip label="View changes from this import" withArrow>
              <ActionIcon
                variant="light"
                color="blue"
                size="sm"
                onClick={onViewChanges}
              >
                <IconEye size={14} />
              </ActionIcon>
            </Tooltip>
          )}

          {/* View on Map button - only for bbox scopes */}
          {canViewOnMap && !isRolledBack && (
            <Tooltip label="View import area on map" withArrow>
              <ActionIcon
                variant="light"
                color="blue"
                size="sm"
                onClick={onViewOnMap}
              >
                <IconMap size={14} />
              </ActionIcon>
            </Tooltip>
          )}

          {/* Rollback button - only for archived versions with snapshot */}
          {canRollback && (
            <Tooltip label="Rollback to this version" withArrow>
              <ActionIcon
                variant="light"
                color="orange"
                size="sm"
                onClick={onRollback}
                disabled={isRollbackInProgress}
              >
                <IconArrowBack size={14} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
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
          />
        );
      })}
    </Stack>
  );
}

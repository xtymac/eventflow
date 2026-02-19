/**
 * Import Version Timeline Component
 *
 * Displays import versions in a vertical timeline view.
 * Shows version status, timestamps, change stats, and available actions.
 */

import { Stack, Text, Group, Loader } from '@/components/shims';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  IconCheck,
  IconHistory,
  IconTrendingUp,
  IconTrendingDown,
  IconCalendar,
  IconRoad,
  IconClick,
  IconLock,
  IconX,
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

const STATUS_BADGE_CLASS: Record<string, string> = {
  green: 'bg-green-600 text-white',
  gray: 'bg-gray-100 text-gray-700',
  yellow: 'bg-yellow-100 text-yellow-800',
};

const STATUS_BADGE_OUTLINE_CLASS = 'bg-transparent border border-gray-300 text-gray-500';

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
        <Alert className="mb-2">
          <IconHistory size={16} />
          <AlertDescription className="flex items-center justify-between">
            <Text size="sm">
              <strong>Rolled back to #{rollbackInfo.toVersionNumber}</strong>
              {' '} -- Version #{rollbackInfo.fromVersionNumber} was rolled back
            </Text>
            <Button variant="ghost" size="icon" className="h-5 w-5 ml-2" onClick={onClearRollbackInfo}>
              <IconX size={14} />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Rollback in progress */}
      {rollbackJobId && (
        <Alert className="mb-2">
          <AlertDescription>
            <Group gap="sm">
              <Loader size="sm" />
              <Text size="sm">
                {targetVersion && targetDisplayNumber
                  ? `Restoring Version #${targetDisplayNumber} (${targetVersion.fileName})...`
                  : 'Restoring previous version...'}
              </Text>
            </Group>
          </AlertDescription>
        </Alert>
      )}

      {/* Timeline */}
      <div className="relative pl-8">
        {/* Vertical line */}
        <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />

        {versions.map((version, index) => {
          // Calculate sequential display number (oldest = 1, newest = total)
          const displayNumber = totalNonDraft - ((page - 1) * pageSize) - index;

          // Get previous version's feature count for trend comparison
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

          // Determine interactivity
          const isInteractive = (isPublished || (isArchived && hasSnapshot)) && !isRolledBack && !isProcessing;

          // Badge class based on variant
          const badgeClass = statusConfig.variant === 'outline'
            ? STATUS_BADGE_OUTLINE_CLASS
            : (STATUS_BADGE_CLASS[statusConfig.color] || STATUS_BADGE_CLASS.gray);

          // Card border/bg classes
          const cardBorderColor = isTarget ? 'border-blue-400'
            : isPublished ? 'border-green-400'
            : (isArchived && !hasSnapshot) ? 'border-gray-400 border-dashed'
            : isArchived ? 'border-gray-300'
            : '';
          const cardBgColor = isTarget ? 'bg-blue-50'
            : isPublished ? 'bg-green-50'
            : (isArchived && !hasSnapshot) ? 'bg-gray-100'
            : isArchived ? 'bg-gray-50'
            : '';

          // Bullet content
          const bulletContent = isPublished ? (
            <IconCheck size={14} />
          ) : isRolledBack ? (
            <IconHistory size={14} />
          ) : (
            <Text size="xs" fw={700}>{displayNumber}</Text>
          );

          const bulletBg = isPublished ? 'bg-green-500 text-white'
            : isRolledBack ? 'bg-gray-300 text-gray-600'
            : isTarget ? 'bg-blue-500 text-white'
            : 'bg-blue-500 text-white';

          const cardContent = (
            <div
              key={version.id}
              className="relative mb-3"
            >
              {/* Bullet */}
              <div
                className={`absolute -left-8 w-6 h-6 rounded-full flex items-center justify-center z-10 ${bulletBg}`}
              >
                {bulletContent}
              </div>

              {/* Dashed line segment for rolled back */}
              {isRolledBack && (
                <div
                  className="absolute -left-[11px] top-0 bottom-0 w-0.5 bg-transparent"
                  style={{
                    backgroundImage: 'repeating-linear-gradient(to bottom, hsl(var(--border)) 0, hsl(var(--border)) 4px, transparent 4px, transparent 8px)',
                  }}
                />
              )}

              {/* Card */}
              <div
                className={`border rounded-md p-2 ${cardBorderColor} ${cardBgColor} ${isInteractive ? 'timeline-card-interactive cursor-pointer' : ''}`}
                onClick={() => isInteractive && onViewChanges(version, displayNumber)}
                style={{
                  opacity: isRolledBack ? 0.6 : (isArchived && !hasSnapshot) ? 0.5 : 1,
                  transition: 'all 0.2s ease',
                }}
              >
                <Group justify="space-between" mb={2} align="flex-start" wrap="nowrap">
                  <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                    <Group gap="xs" wrap="nowrap">
                      <Text size="sm" fw={600} lineClamp={1} title={version.fileName}>
                        {version.fileName}
                      </Text>
                      <Badge
                        className={`text-[10px] px-1.5 py-0 ${badgeClass}`}
                        style={{ opacity: isArchived ? 0.8 : 1 }}
                      >
                        {statusConfig.icon && <span className="mr-0.5">{statusConfig.icon}</span>}
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
                    <div className="text-gray-400 mt-0.5">
                      <IconClick size={16} />
                    </div>
                  )}
                </Group>

                {/* Stats Row with inline Restore button */}
                {(version.featureCount != null) && !isRolledBack && (
                  <Group gap="md" mt={4} justify="space-between" wrap="nowrap">
                    <Group gap="md" wrap="nowrap">
                      <Group gap={4}>
                        <IconRoad size={14} className="text-gray-500" />
                        <Text size="xs" fw={500}>{version.featureCount.toLocaleString()}</Text>
                        {showTrend && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={featureCountDiff! > 0 ? 'text-green-600' : 'text-orange-600'}>
                                {featureCountDiff! > 0 ? <IconTrendingUp size={12} /> : <IconTrendingDown size={12} />}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {`${featureCountDiff! > 0 ? '+' : ''}${featureCountDiff!.toLocaleString()} from previous`}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </Group>

                      {(version.addedCount !== null || version.updatedCount !== null || version.deactivatedCount !== null) && (
                        <Group gap={8}>
                          {version.addedCount !== null && version.addedCount > 0 && <Text size="xs" c="green">+{version.addedCount}</Text>}
                          {version.updatedCount !== null && version.updatedCount > 0 && <Text size="xs" c="blue">~{version.updatedCount}</Text>}
                          {version.deactivatedCount !== null && version.deactivatedCount > 0 && <Text size="xs" c="orange">-{version.deactivatedCount}</Text>}
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
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-orange-600 hover:text-orange-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRollback(version.id);
                        }}
                        disabled={isProcessing}
                      >
                        <IconHistory size={12} className="mr-0.5" />
                        Restore
                      </Button>
                      )
                    )}
                  </Group>
                )}

                {isRolledBack && (
                  <Text size="xs" c="dimmed" className="italic mt-1">Rolled back on {formatDate(version.rolledBackAt)}</Text>
                )}
              </div>
            </div>
          );

          // Wrap in tooltip if there is a hint and not published
          if (statusConfig.hoverHint && !isPublished) {
            return (
              <Tooltip key={version.id}>
                <TooltipTrigger asChild>
                  {cardContent}
                </TooltipTrigger>
                <TooltipContent>{statusConfig.hoverHint}</TooltipContent>
              </Tooltip>
            );
          }

          return cardContent;
        })}
      </div>

      {/* CSS for hover effect */}
      <style>
        {`
          .timeline-card-interactive:hover {
             border-color: hsl(var(--primary)) !important;
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

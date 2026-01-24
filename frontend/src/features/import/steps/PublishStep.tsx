/**
 * Publish Step Component
 *
 * Confirmation and publish with progress tracking.
 */

import { useState } from 'react';
import {
  Stack,
  Text,
  Group,
  Button,
  Card,
  Checkbox,
  Progress,
  Alert,
  Loader,
  ThemeIcon,
  Anchor,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import {
  IconRocket,
  IconCheck,
  IconX,
  IconInfoCircle,
  IconMap,
} from '@tabler/icons-react';
import {
  useImportVersion,
  useDiffPreview,
  usePublishVersion,
  useImportJobPolling,
  useValidationResults,
  type ImportJob,
} from '../../../hooks/useImportVersions';
import { useUIStore } from '../../../stores/uiStore';
import { useMapStore } from '../../../stores/mapStore';

/**
 * Format scope string for user-friendly display
 * - "full" → "Full City"
 * - "ward:Nishi" → "Nishi Ward"
 * - "bbox:..." → "Import file area" with tooltip showing coords
 */
function formatScopeDisplay(scope: string): { label: string; tooltip?: string } {
  if (scope === 'full') {
    return { label: 'Full City' };
  }
  if (scope.startsWith('ward:')) {
    const ward = scope.substring(5);
    return { label: `${ward} Ward` };
  }
  if (scope.startsWith('bbox:')) {
    const coords = scope.substring(5).split(',');
    if (coords.length === 4) {
      // Format as multi-line with labels for readability
      const [minLng, minLat, maxLng, maxLat] = coords;
      return {
        label: 'Import file area',
        tooltip: `Min: ${Number(minLng).toFixed(6)}, ${Number(minLat).toFixed(6)}\nMax: ${Number(maxLng).toFixed(6)}, ${Number(maxLat).toFixed(6)}`,
      };
    }
    return {
      label: 'Import file area',
      tooltip: `Bounding box: ${coords.join(', ')}`,
    };
  }
  return { label: scope };
}

/**
 * Create a Polygon geometry from bbox string for map fly-to
 */
function bboxToPolygon(scope: string): GeoJSON.Polygon | null {
  if (!scope.startsWith('bbox:')) return null;
  const [minLng, minLat, maxLng, maxLat] = scope.substring(5).split(',').map(Number);
  if (isNaN(minLng) || isNaN(minLat) || isNaN(maxLng) || isNaN(maxLat)) return null;
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

export function PublishStep() {
  const { currentImportVersionId, importHasReviewStep, closeImportWizard, setImportWizardStep, startImportPreview } = useUIStore();
  const queryClient = useQueryClient();

  const [confirmed, setConfirmed] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<Record<string, unknown> | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Queries
  const { data: versionData } = useImportVersion(currentImportVersionId);
  const { data: diffData } = useDiffPreview(currentImportVersionId);

  // Validation gate when Review step is skipped
  const { data: validationData, isLoading: isLoadingValidation } = useValidationResults(
    !importHasReviewStep ? currentImportVersionId : null
  );

  // Mutations
  const publishMutation = usePublishVersion();

  // Poll job status
  const { data: jobData } = useImportJobPolling(currentJobId, {
    pollingInterval: 2000, // Poll every 2 seconds instead of 1
    onComplete: (job: ImportJob) => {
      setCurrentJobId(null);
      setPublishResult(job.resultSummary);
      // Invalidate assets only after job completes successfully
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      notifications.show({
        title: 'Publish successful',
        message: 'Roads have been updated',
        color: 'green',
      });
    },
    onError: (job: ImportJob) => {
      setCurrentJobId(null);
      setPublishError(job.errorMessage || 'Unknown error');
      notifications.show({
        title: 'Publish failed',
        message: job.errorMessage || 'Unknown error',
        color: 'red',
      });
    },
  });

  const handlePublish = async () => {
    if (!currentImportVersionId || !confirmed) return;

    try {
      const job = await publishMutation.mutateAsync(currentImportVersionId);
      setCurrentJobId(job.id);
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : 'Unknown error');
      notifications.show({
        title: 'Publish failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    }
  };

  const handleClose = () => {
    closeImportWizard();
  };

  // Get map store action for highlighting
  const setImportAreaHighlight = useMapStore((s) => s.setImportAreaHighlight);

  // Fly to bbox area on map and temporarily hide wizard
  const handleViewOnMap = (scope: string) => {
    const polygon = bboxToPolygon(scope);
    if (polygon) {
      // Create a dummy feature for the preview system
      const bboxFeature = {
        type: 'Feature' as const,
        geometry: polygon,
        properties: {
          id: 'scope-area',
          name: 'Import Scope Area',
        },
      };
      // Set highlight to show bbox rectangle on map
      setImportAreaHighlight({
        geometry: polygon,
        label: 'Import Scope Area',
      });
      // Use existing preview mode to temporarily hide wizard and show return button
      startImportPreview([bboxFeature], 0);
    }
  };

  const version = versionData?.data;
  const diff = diffData?.data;
  const scopeDisplay = diff?.scope ? formatScopeDisplay(diff.scope) : null;
  const job = jobData?.data;

  // Validation loading state (only when Review step is skipped)
  if (!importHasReviewStep && isLoadingValidation) {
    return (
      <Stack align="center" justify="center" mih={300} gap="md">
        <Loader size="lg" />
        <Text fw={500}>Validating import data...</Text>
        <Text size="xs" c="dimmed">Checking for errors before publish</Text>
      </Stack>
    );
  }

  // Validation failed state (only when Review step is skipped)
  if (!importHasReviewStep && validationData?.data && validationData.data.errors.length > 0) {
    return (
      <Stack align="center" justify="center" mih={300} gap="lg">
        <ThemeIcon size={80} radius="xl" color="red">
          <IconX size={48} />
        </ThemeIcon>
        <Text size="xl" fw={600} c="red">
          Validation Failed
        </Text>
        <Alert color="red" variant="light" w="100%">
          {validationData.data.errors[0].error}
          {validationData.data.errors.length > 1 && ` (+${validationData.data.errors.length - 1} more)`}
        </Alert>
        <Group gap="md">
          <Button variant="light" onClick={() => setImportWizardStep('configure')}>
            Back to Configure
          </Button>
          <Button variant="subtle" color="gray" onClick={handleClose}>
            Close
          </Button>
        </Group>
      </Stack>
    );
  }

  // Show success state
  if (publishResult) {
    const result = publishResult as {
      added?: number;
      updated?: number;
      deactivated?: number;
      unchanged?: number;
      scope?: string;
    };

    return (
      <Stack align="center" justify="center" mih={300} gap="lg">
        <ThemeIcon size={80} radius="xl" color="green">
          <IconCheck size={48} />
        </ThemeIcon>

        <Text size="xl" fw={600}>
          Import Published Successfully
        </Text>

        <Card withBorder padding="md" w="100%">
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm">Version:</Text>
              <Text size="sm" fw={500}>#{version?.versionNumber}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm">Scope:</Text>
              <Text size="sm" fw={500}>
                {formatScopeDisplay(result.scope || diff?.scope || 'full').label}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="green">Roads added:</Text>
              <Text size="sm" fw={500} c="green">+{result.added ?? 0}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="blue">Roads updated:</Text>
              <Text size="sm" fw={500} c="blue">{result.updated ?? 0}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="orange">Roads deactivated:</Text>
              <Text size="sm" fw={500} c="orange">{result.deactivated ?? 0}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Unchanged:</Text>
              <Text size="sm" fw={500} c="dimmed">{result.unchanged ?? 0}</Text>
            </Group>
          </Stack>
        </Card>

        <Button onClick={handleClose} fullWidth>
          Close Wizard
        </Button>
      </Stack>
    );
  }

  // Show error state
  if (publishError) {
    return (
      <Stack align="center" justify="center" mih={300} gap="lg">
        <ThemeIcon size={80} radius="xl" color="red">
          <IconX size={48} />
        </ThemeIcon>

        <Text size="xl" fw={600} c="red">
          Publish Failed
        </Text>

        <Alert color="red" variant="light" w="100%">
          {publishError}
        </Alert>

        <Group gap="md">
          <Button variant="light" onClick={() => setPublishError(null)}>
            Try Again
          </Button>
          <Button variant="subtle" color="gray" onClick={handleClose}>
            Close
          </Button>
        </Group>
      </Stack>
    );
  }

  // Show progress state
  if (currentJobId) {
    const progress = job?.progress ?? 0;
    const statusLabel = progress >= 95 ? 'Finalizing...'
      : progress >= 60 ? 'Applying changes to database...'
      : progress >= 45 ? 'Creating backup snapshot...'
      : progress >= 25 ? 'Calculating changes...'
      : progress >= 15 ? 'Validating data...'
      : 'Starting publish...';

    return (
      <Stack align="center" justify="center" mih={300} gap="md">
        <Loader size="lg" />
        <Text fw={500}>Publishing changes...</Text>
        <Progress
          value={progress}
          size="xl"
          w="80%"
          animated
        />
        <Text size="sm" c="dimmed">
          {statusLabel}
        </Text>
        <Text size="xs" c="dimmed">
          This may take a few minutes for large imports
        </Text>
      </Stack>
    );
  }

  // Show confirmation state
  return (
    <Stack gap="md">
      {/* Summary card */}
      <Card withBorder padding="md">
        <Text fw={500} mb="sm">Publish Summary</Text>
        <Stack gap="xs">
          <Group justify="space-between">
            <Text size="sm">File:</Text>
            <Text size="sm" fw={500}>{version?.fileName}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm">Version:</Text>
            <Text size="sm" fw={500}>#{version?.versionNumber}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm">Scope:</Text>
            <Group gap="xs">
              {scopeDisplay?.tooltip ? (
                <Tooltip label={scopeDisplay.tooltip} multiline w={300}>
                  <Text size="sm" fw={500} style={{ cursor: 'help', textDecoration: 'underline dotted' }}>
                    {scopeDisplay.label}
                  </Text>
                </Tooltip>
              ) : (
                <Text size="sm" fw={500}>{scopeDisplay?.label}</Text>
              )}
              {diff?.scope?.startsWith('bbox:') && (
                <Anchor
                  size="xs"
                  onClick={() => handleViewOnMap(diff.scope)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}
                >
                  <IconMap size={12} />
                  View
                </Anchor>
              )}
            </Group>
          </Group>
          <Group justify="space-between">
            <Text size="sm">Features:</Text>
            <Text size="sm" fw={500}>{version?.featureCount?.toLocaleString()}</Text>
          </Group>
        </Stack>
      </Card>

      {/* Changes summary */}
      {diff && (
        <Card withBorder padding="md" bg="var(--mantine-color-gray-0)">
          <Text fw={500} mb="sm">Changes to Apply</Text>
          <Group gap="xl">
            <Group gap="xs">
              <Text size="sm" c="green" fw={500}>+{diff.stats.addedCount}</Text>
              <Text size="sm">added</Text>
            </Group>
            <Group gap="xs">
              <Text size="sm" c="blue" fw={500}>{diff.stats.updatedCount}</Text>
              <Text size="sm">updated</Text>
            </Group>
            <Group gap="xs">
              <Text size="sm" c="orange" fw={500}>{diff.stats.deactivatedCount}</Text>
              <Text size="sm">deactivated</Text>
            </Group>
          </Group>
        </Card>
      )}

      {/* Deactivation warning */}
      {diff && diff.stats.deactivatedCount > 0 && (
        <Alert icon={<IconInfoCircle size={16} />} color="orange" variant="light">
          <strong>{diff.stats.deactivatedCount} roads</strong> in the import file area
          will be marked as inactive because they are not in the import file.
        </Alert>
      )}

      {/* Confirmation checkbox */}
      <Checkbox
        label={`I understand that this will update roads in the ${scopeDisplay?.label || 'selected area'}`}
        checked={confirmed}
        onChange={(e) => setConfirmed(e.currentTarget.checked)}
      />

      {/* Publish button */}
      <Button
        leftSection={<IconRocket size={16} />}
        onClick={handlePublish}
        disabled={!confirmed}
        loading={publishMutation.isPending}
        fullWidth
        color="green"
      >
        Publish Import
      </Button>
    </Stack>
  );
}

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
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import {
  IconRocket,
  IconCheck,
  IconAlertTriangle,
  IconX,
  IconInfoCircle,
} from '@tabler/icons-react';
import {
  useImportVersion,
  useDiffPreview,
  usePublishVersion,
  useImportJobPolling,
  type ImportJob,
} from '../../../hooks/useImportVersions';
import { useUIStore } from '../../../stores/uiStore';

export function PublishStep() {
  const { currentImportVersionId, closeImportWizard } = useUIStore();
  const queryClient = useQueryClient();

  const [confirmed, setConfirmed] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<Record<string, unknown> | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Queries
  const { data: versionData } = useImportVersion(currentImportVersionId);
  const { data: diffData } = useDiffPreview(currentImportVersionId);

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

  const version = versionData?.data;
  const diff = diffData?.data;
  const job = jobData?.data;

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
              <Text size="sm" fw={500}>{result.scope || diff?.scope}</Text>
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
    return (
      <Stack align="center" justify="center" mih={300} gap="md">
        <Loader size="lg" />
        <Text fw={500}>Publishing changes...</Text>
        <Progress
          value={job?.progress ?? 0}
          size="xl"
          w="80%"
          animated
        />
        <Text size="sm" c="dimmed">
          {job?.progress ?? 0}% complete
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
      <Alert icon={<IconAlertTriangle size={16} />} color="orange" variant="light">
        You are about to publish this import. This will update the road database.
        A snapshot will be created for rollback support.
      </Alert>

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
            <Text size="sm" fw={500}>{diff?.scope}</Text>
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
          <strong>{diff.stats.deactivatedCount} roads</strong> in scope "{diff.scope}"
          will be marked as inactive because they are not in the import file.
        </Alert>
      )}

      {/* Confirmation checkbox */}
      <Checkbox
        label={`I understand that this will update roads in scope "${diff?.scope || 'full'}"`}
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

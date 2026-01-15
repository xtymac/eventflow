/**
 * Validation Step Component
 *
 * Displays validation progress and results with fix hints.
 */

import { useState, useEffect } from 'react';
import {
  Stack,
  Text,
  Group,
  Button,
  Card,
  Progress,
  Accordion,
  Badge,
  Alert,
  Loader,
  ThemeIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconArrowRight,
  IconRefresh,
} from '@tabler/icons-react';
import {
  useImportJobPolling,
  useValidationResults,
  useTriggerValidation,
  type ImportJob,
  type ValidationError,
  type ValidationWarning,
} from '../../../hooks/useImportVersions';
import { useUIStore } from '../../../stores/uiStore';

export function ValidationStep() {
  const { currentImportVersionId, setImportWizardStep } = useUIStore();
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  // Get validation results (cached if available)
  const { data: validationData, isLoading: isLoadingValidation, refetch } = useValidationResults(
    currentImportVersionId,
    { enabled: !currentJobId } // Don't fetch while job is running
  );

  // Poll job status
  const { data: jobData, isLoading: isPolling } = useImportJobPolling(currentJobId, {
    onComplete: (job: ImportJob) => {
      setCurrentJobId(null);
      refetch();
      if (job.resultSummary && (job.resultSummary as { valid?: boolean }).valid) {
        notifications.show({
          title: 'Validation complete',
          message: 'No errors found',
          color: 'green',
        });
      }
    },
    onError: (job: ImportJob) => {
      setCurrentJobId(null);
      notifications.show({
        title: 'Validation failed',
        message: job.errorMessage || 'Unknown error',
        color: 'red',
      });
    },
  });

  const triggerValidationMutation = useTriggerValidation();

  const handleRevalidate = async () => {
    if (!currentImportVersionId) return;

    try {
      const job = await triggerValidationMutation.mutateAsync(currentImportVersionId);
      setCurrentJobId(job.id);
    } catch (error) {
      notifications.show({
        title: 'Revalidation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    }
  };

  const handleContinue = () => {
    setImportWizardStep('preview');
  };

  const validation = validationData?.data;
  const job = jobData?.data;

  // Show loading while job is running
  if (currentJobId && isPolling) {
    return (
      <Stack align="center" justify="center" mih={200} gap="md">
        <Loader size="lg" />
        <Text fw={500}>Validating import file...</Text>
        <Progress
          value={job?.progress ?? 0}
          size="xl"
          w="80%"
          animated
        />
        <Text size="sm" c="dimmed">
          {job?.progress ?? 0}% complete
        </Text>
      </Stack>
    );
  }

  // Show loading while fetching cached results
  if (isLoadingValidation) {
    return (
      <Stack align="center" justify="center" mih={200}>
        <Loader />
        <Text c="dimmed">Loading validation results...</Text>
      </Stack>
    );
  }

  // No validation results yet
  if (!validation) {
    return (
      <Stack align="center" justify="center" mih={200} gap="md">
        <Text c="dimmed">No validation results available</Text>
        <Button onClick={handleRevalidate} loading={triggerValidationMutation.isPending}>
          Run Validation
        </Button>
      </Stack>
    );
  }

  const hasErrors = validation.errors.length > 0;
  const hasWarnings = validation.warnings.length > 0;

  return (
    <Stack gap="md">
      {/* Summary card */}
      <Card withBorder padding="md">
        <Group justify="space-between" mb="md">
          <Group gap="sm">
            <ThemeIcon
              size="lg"
              radius="xl"
              color={hasErrors ? 'red' : 'green'}
            >
              {hasErrors ? <IconX size={18} /> : <IconCheck size={18} />}
            </ThemeIcon>
            <div>
              <Text fw={500}>
                {hasErrors ? 'Validation Failed' : 'Validation Passed'}
              </Text>
              <Text size="sm" c="dimmed">
                {validation.featureCount.toLocaleString()} features checked
              </Text>
            </div>
          </Group>
          <Button
            variant="light"
            size="xs"
            leftSection={<IconRefresh size={14} />}
            onClick={handleRevalidate}
            loading={triggerValidationMutation.isPending}
          >
            Revalidate
          </Button>
        </Group>

        <Group gap="xl">
          <Group gap="xs">
            <Badge color="red" size="lg">{validation.errors.length}</Badge>
            <Text size="sm">Errors</Text>
          </Group>
          <Group gap="xs">
            <Badge color="yellow" size="lg">{validation.warnings.length}</Badge>
            <Text size="sm">Warnings</Text>
          </Group>
          <Group gap="xs">
            <Badge color="gray" size="lg">{validation.missingIdCount}</Badge>
            <Text size="sm">Missing IDs</Text>
          </Group>
          <Group gap="xs">
            <Badge color="blue" size="lg">{validation.missingDataSourceCount}</Badge>
            <Text size="sm">Missing dataSource</Text>
          </Group>
        </Group>
      </Card>

      {/* Missing ID warning */}
      {validation.missingIdCount > 0 && (
        <Alert
          icon={<IconX size={16} />}
          title="Missing IDs"
          color="red"
          variant="filled"
        >
          {validation.missingIdCount} features are missing the required 'id' field.
          Incremental updates require each feature to have a unique ID.
          Please add IDs to your source file.
        </Alert>
      )}

      {/* Missing dataSource info */}
      {validation.missingDataSourceCount > 0 && !hasErrors && (
        <Alert
          icon={<IconAlertTriangle size={16} />}
          title="Missing dataSource"
          color="blue"
          variant="light"
        >
          {validation.missingDataSourceCount} features are missing the 'dataSource' field.
          The default data source you selected will be applied.
        </Alert>
      )}

      {/* Errors accordion */}
      {hasErrors && (
        <div>
          <Text fw={500} mb="xs" c="red">
            Errors ({validation.errors.length})
          </Text>
          <Accordion variant="separated">
            {validation.errors.slice(0, 50).map((error: ValidationError, index: number) => (
              <Accordion.Item key={index} value={`error-${index}`}>
                <Accordion.Control>
                  <Group gap="sm">
                    <Badge color="red" size="sm">Error</Badge>
                    <Text size="sm">
                      Feature {error.featureIndex + 1}
                      {error.featureId && ` (${error.featureId})`}
                      : {error.field}
                    </Text>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="xs">
                    <Text size="sm" fw={500}>{error.error}</Text>
                    <Text size="sm" c="dimmed">
                      How to fix: {error.hint}
                    </Text>
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
            {validation.errors.length > 50 && (
              <Text size="sm" c="dimmed" ta="center" mt="sm">
                Showing first 50 of {validation.errors.length} errors
              </Text>
            )}
          </Accordion>
        </div>
      )}

      {/* Warnings accordion */}
      {hasWarnings && (
        <div>
          <Text fw={500} mb="xs" c="yellow.8">
            Warnings ({validation.warnings.length})
          </Text>
          <Accordion variant="separated">
            {validation.warnings.slice(0, 50).map((warning: ValidationWarning, index: number) => (
              <Accordion.Item key={index} value={`warning-${index}`}>
                <Accordion.Control>
                  <Group gap="sm">
                    <Badge color="yellow" size="sm">Warning</Badge>
                    <Text size="sm">
                      Feature {warning.featureIndex + 1}
                      {warning.featureId && ` (${warning.featureId})`}
                    </Text>
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <Text size="sm">{warning.message}</Text>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
            {validation.warnings.length > 50 && (
              <Text size="sm" c="dimmed" ta="center" mt="sm">
                Showing first 50 of {validation.warnings.length} warnings
              </Text>
            )}
          </Accordion>
        </div>
      )}

      {/* Continue button */}
      <Button
        rightSection={<IconArrowRight size={16} />}
        onClick={handleContinue}
        disabled={hasErrors}
        fullWidth
      >
        {hasErrors ? 'Fix Errors to Continue' : 'Preview Changes'}
      </Button>
    </Stack>
  );
}

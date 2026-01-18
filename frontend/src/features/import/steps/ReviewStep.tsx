/**
 * Review Step Component
 *
 * Merged validation + preview step with improved UI.
 * Shows validation status, change summary, and feature details.
 */

import { useState } from 'react';
import {
  Stack,
  Text,
  Group,
  Button,
  Card,
  Tabs,
  Table,
  Badge,
  Loader,
  Alert,
  ScrollArea,
  ThemeIcon,
  Accordion,
  Anchor,
  Paper,
  Progress,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconX,
  IconArrowRight,
  IconRefresh,
  IconPlus,
  IconPencil,
  IconArchive,
  IconInfoCircle,
  IconMap,
  IconAlertCircle,
  IconAlertTriangle,
} from '@tabler/icons-react';
import {
  useImportJobPolling,
  useValidationResults,
  useTriggerValidation,
  useDiffPreview,
  type ImportJob,
  type ValidationError,
  type ValidationWarning,
} from '../../../hooks/useImportVersions';
import { useUIStore } from '../../../stores/uiStore';
import { useMapStore } from '../../../stores/mapStore';
import type { Feature } from 'geojson';

interface FeatureProperties {
  id?: string;
  name?: string;
  roadType?: string;
  ward?: string;
  [key: string]: unknown;
}

interface FeatureTableProps {
  features: Feature[];
  emptyMessage: string;
  onFeatureClick?: (feature: Feature) => void;
}

function FeatureTable({ features, emptyMessage, onFeatureClick }: FeatureTableProps) {
  if (features.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="lg">
        {emptyMessage}
      </Text>
    );
  }

  return (
    <ScrollArea h={250}>
      <Table striped highlightOnHover withTableBorder fz="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>ID</Table.Th>
            <Table.Th>Name</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Ward</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {features.slice(0, 100).map((feature, index) => {
            const props = feature.properties as FeatureProperties | null;
            const hasGeometry = !!feature.geometry;
            return (
              <Table.Tr
                key={props?.id || index}
                onClick={() => hasGeometry && onFeatureClick?.(feature)}
                style={{
                  cursor: hasGeometry && onFeatureClick ? 'pointer' : 'default',
                }}
              >
                <Table.Td>
                  <Text size="xs" ff="monospace">
                    {props?.id || '-'}
                  </Text>
                </Table.Td>
                <Table.Td>{props?.name || 'Unnamed'}</Table.Td>
                <Table.Td>
                  <Badge size="xs" variant="light">
                    {props?.roadType || '-'}
                  </Badge>
                </Table.Td>
                <Table.Td>{props?.ward || '-'}</Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
      {features.length > 100 && (
        <Text size="xs" c="dimmed" ta="center" mt="sm">
          Showing first 100 of {features.length} features · Click row to view on map
        </Text>
      )}
    </ScrollArea>
  );
}

interface ChangeCountBadgeProps {
  icon: React.ReactNode;
  count: number;
  label: string;
  color: string;
}

function ChangeCountBadge({ icon, count, label, color }: ChangeCountBadgeProps) {
  return (
    <Stack align="center" gap={4}>
      <Paper
        withBorder
        p="sm"
        radius="md"
        style={{
          borderColor: `var(--mantine-color-${color}-5)`,
          minWidth: 72,
          textAlign: 'center',
        }}
      >
        <Group justify="center" gap={4}>
          {icon}
          <Text fw={700} size="lg" ff="monospace">
            {count.toLocaleString()}
          </Text>
        </Group>
      </Paper>
      <Text size="xs" c="dimmed">{label}</Text>
    </Stack>
  );
}

export function ReviewStep() {
  const { currentImportVersionId, setImportWizardStep, startImportPreview } = useUIStore();
  const setImportAreaHighlight = useMapStore((s) => s.setImportAreaHighlight);

  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('updated');
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  // Get validation results (cached if available)
  const { data: validationData, isLoading: isLoadingValidation, refetch } = useValidationResults(
    currentImportVersionId,
    { enabled: !currentJobId }
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

  // Pre-fetch diff preview when validation passes (no errors)
  const validationPassed = validationData?.data && validationData.data.errors.length === 0;
  const { data: diffData, isLoading: isLoadingDiff } = useDiffPreview(
    currentImportVersionId,
    { enabled: !!validationPassed && !currentJobId }
  );

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

  const handlePublish = () => {
    setImportWizardStep('publish');
  };

  // Collect all modified features with geometry for preview
  const getAllModifiedFeatures = (): Feature[] => {
    if (!diff) return [];
    const allFeatures: Feature[] = [];
    // Add in order: updated, added, deactivated
    for (const f of diff.updated) {
      if (f.geometry) allFeatures.push(f);
    }
    for (const f of diff.added) {
      if (f.geometry) allFeatures.push(f);
    }
    for (const f of diff.deactivated) {
      if (f.geometry) allFeatures.push(f);
    }
    return allFeatures;
  };

  const handleFeatureClick = (feature: Feature) => {
    if (!feature.geometry) return;
    const allFeatures = getAllModifiedFeatures();
    const featureIndex = allFeatures.findIndex(
      (f) => f.properties?.id === feature.properties?.id
    );
    const props = feature.properties as FeatureProperties | null;
    const label = props?.name || props?.id || 'Unnamed Road';
    // Highlight the road on the map
    setImportAreaHighlight({
      geometry: feature.geometry,
      label,
    });
    // Start preview mode with all features, starting at clicked feature's index
    startImportPreview(allFeatures, featureIndex >= 0 ? featureIndex : 0);
  };

  const handleViewOnMap = () => {
    const allFeatures = getAllModifiedFeatures();
    if (allFeatures.length === 0) {
      notifications.show({
        title: 'No changes to preview',
        message: 'No roads will be modified by this import',
        color: 'yellow',
      });
      return;
    }
    // Start preview from the first modified feature
    const firstFeature = allFeatures[0];
    const props = firstFeature.properties as FeatureProperties | null;
    const label = props?.name || props?.id || 'Unnamed Road';
    setImportAreaHighlight({
      geometry: firstFeature.geometry!,
      label,
    });
    startImportPreview(allFeatures, 0);
  };

  const validation = validationData?.data;
  const diff = diffData?.data;
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
  const isValid = !hasErrors;
  const hasChanges = diff && (diff.added.length > 0 || diff.updated.length > 0 || diff.deactivated.length > 0);

  // Dynamic card styling based on status
  const validationCardStyle = {
    borderColor: hasErrors ? 'var(--mantine-color-red-5)' :
                 hasWarnings ? 'var(--mantine-color-yellow-5)' :
                 'var(--mantine-color-green-5)',
    borderWidth: 2,
  };

  return (
    <Stack gap="md">
      {/* Validation Summary Card */}
      <Card withBorder style={validationCardStyle} padding="md">
        <Group justify="space-between" align="flex-start">
          <Group gap="sm">
            <ThemeIcon
              size="lg"
              radius="xl"
              color={hasErrors ? 'red' : hasWarnings ? 'yellow' : 'green'}
            >
              {hasErrors ? <IconX size={18} /> : <IconCheck size={18} />}
            </ThemeIcon>
            <div>
              <Text fw={600}>
                {hasErrors ? 'Validation Failed' : 'Validation Passed'}
              </Text>
              <Text size="sm" c="dimmed">
                {validation.featureCount.toLocaleString()} features checked
                {isValid && !hasWarnings && ' · No issues found'}
              </Text>
            </div>
          </Group>

          <Button
            variant="light"
            size="xs"
            onClick={handleRevalidate}
            loading={triggerValidationMutation.isPending}
            leftSection={!triggerValidationMutation.isPending && <IconRefresh size={14} />}
          >
            Revalidate
          </Button>
        </Group>

        {/* Error/Warning counts - only show if issues exist */}
        {(hasErrors || hasWarnings) && (
          <Group gap="md" mt="sm">
            {hasErrors && (
              <Badge color="red" size="lg" leftSection={<IconAlertCircle size={14} />}>
                {validation.errors.length} Errors
              </Badge>
            )}
            {hasWarnings && (
              <Badge color="yellow" size="lg" leftSection={<IconAlertTriangle size={14} />}>
                {validation.warnings.length} Warnings
              </Badge>
            )}
            {validation.missingIdCount > 0 && (
              <Badge color="red" size="lg">
                {validation.missingIdCount} Missing IDs
              </Badge>
            )}

            <Anchor size="sm" onClick={() => setShowErrorDetails(!showErrorDetails)}>
              {showErrorDetails ? 'Hide details' : 'View details'}
            </Anchor>
          </Group>
        )}

        {/* Missing dataSource info - only show when valid and no errors */}
        {validation.missingDataSourceCount > 0 && isValid && (
          <Text size="xs" c="blue" mt="sm">
            {validation.missingDataSourceCount} features missing dataSource will use default value
          </Text>
        )}
      </Card>

      {/* Error/Warning Accordions - only when expanded */}
      {showErrorDetails && hasErrors && (
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
      )}

      {showErrorDetails && hasWarnings && (
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
      )}

      {/* Change Preview - only when valid */}
      {isValid && (
        <Card withBorder padding="md">
          <Text fw={600} mb="sm">Changes to Apply</Text>

          {isLoadingDiff ? (
            <Group gap="sm" justify="center" py="md">
              <Loader size="sm" />
              <Text size="sm" c="dimmed">Calculating changes...</Text>
            </Group>
          ) : diff ? (
            <>
              <Group gap="lg" justify="center">
                <ChangeCountBadge
                  icon={<IconPlus size={16} color="var(--mantine-color-green-6)" />}
                  count={diff.stats.addedCount}
                  label="Added"
                  color="green"
                />
                <ChangeCountBadge
                  icon={<IconPencil size={16} color="var(--mantine-color-blue-6)" />}
                  count={diff.stats.updatedCount}
                  label="Updated"
                  color="blue"
                />
                <Tooltip
                  label={diff.regionalRefresh
                    ? "These roads will be deactivated when published"
                    : "Preview only - these roads will NOT be removed (Regional Refresh is OFF)"}
                  multiline
                  w={250}
                  withArrow
                >
                  <div>
                    <ChangeCountBadge
                      icon={<IconArchive size={16} color={diff.regionalRefresh ? "var(--mantine-color-orange-6)" : "var(--mantine-color-gray-5)"} />}
                      count={diff.stats.deactivatedCount}
                      label={diff.regionalRefresh ? "Removed" : "Removed (preview)"}
                      color={diff.regionalRefresh ? "orange" : "gray"}
                    />
                  </div>
                </Tooltip>
              </Group>

              <Group justify="center" mt="md">
                <Text size="sm" c="dimmed">
                  <Text span ff="monospace">{diff.unchanged.toLocaleString()}</Text>
                  {' '}roads unchanged
                  <Tooltip
                    label="These roads exist in both import file and database with no changes. They will not be modified or trigger any notifications."
                    multiline
                    w={280}
                    withArrow
                  >
                    <IconInfoCircle
                      size={14}
                      style={{ marginLeft: 4, cursor: 'help', verticalAlign: 'middle', color: 'var(--mantine-color-dimmed)' }}
                    />
                  </Tooltip>
                </Text>
              </Group>

              {/* Comparison mode indicator */}
              {diff.comparisonMode === 'precise' && (
                <Alert color="green" variant="light" icon={<IconCheck size={16} />} mt="sm" p="xs">
                  <Text size="xs">
                    <Text span fw={500}>Precise comparison:</Text> Comparing against original export
                    {diff.sourceExportId && <Text span c="dimmed"> ({diff.sourceExportId})</Text>}
                  </Text>
                </Alert>
              )}

              {/* Scope info - only show when bbox mode or when regional refresh is on */}
              {(diff.comparisonMode === 'bbox' || diff.regionalRefresh) && (
                <Text size="xs" c="dimmed" ta="center" mt="sm">
                  {diff.comparisonMode === 'bbox' && diff.scope !== 'full' && `Scope: ${diff.scope}`}
                  {diff.regionalRefresh && (
                    <Text span c="orange" fw={500}>
                      {diff.comparisonMode === 'bbox' && diff.scope !== 'full' ? ' · ' : ''}Regional Refresh ON
                    </Text>
                  )}
                </Text>
              )}
            </>
          ) : (
            <Text size="sm" c="dimmed" ta="center">Unable to load change preview</Text>
          )}
        </Card>
      )}

      {/* Feature Tabs - only when valid and diff loaded */}
      {isValid && diff && (
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab
              value="added"
              leftSection={<IconPlus size={14} />}
              rightSection={
                <Badge size="xs" color="green">{diff.added.length}</Badge>
              }
            >
              Added
            </Tabs.Tab>
            <Tabs.Tab
              value="updated"
              leftSection={<IconPencil size={14} />}
              rightSection={
                <Badge size="xs" color="blue">{diff.updated.length}</Badge>
              }
            >
              Updated
            </Tabs.Tab>
            <Tabs.Tab
              value="deactivated"
              leftSection={<IconArchive size={14} />}
              rightSection={
                <Badge size="xs" color={diff.regionalRefresh ? 'orange' : 'gray'}>
                  {diff.deactivated.length}
                </Badge>
              }
            >
              Removed
              {!diff.regionalRefresh && diff.deactivated.length > 0 && (
                <Text span size="xs" c="dimmed" ml={4}>(preview)</Text>
              )}
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="added" pt="xs">
            <FeatureTable
              features={diff.added}
              emptyMessage="No new roads will be added"
              onFeatureClick={handleFeatureClick}
            />
          </Tabs.Panel>

          <Tabs.Panel value="updated" pt="xs">
            <FeatureTable
              features={diff.updated}
              emptyMessage="No existing roads will be updated"
              onFeatureClick={handleFeatureClick}
            />
          </Tabs.Panel>

          <Tabs.Panel value="deactivated" pt="xs">
            {/* Warning when removed count seems unusually high */}
            {diff.deactivated.length > diff.stats.importCount * 5 && (
              <Alert
                color={diff.regionalRefresh ? 'red' : 'yellow'}
                variant="light"
                icon={<IconAlertTriangle size={16} />}
                mb="sm"
              >
                <Text size="sm" fw={500}>
                  {diff.regionalRefresh
                    ? `Warning: ${diff.deactivated.length.toLocaleString()} roads will be REMOVED when published!`
                    : `Note: ${diff.deactivated.length.toLocaleString()} roads in database are not in your import file.`
                  }
                </Text>
                <Text size="sm" mt={4}>
                  This may indicate that your import file doesn't cover the full area you intended,
                  or there are roads in the database outside your import area.
                </Text>
              </Alert>
            )}
            {!diff.regionalRefresh && diff.deactivated.length > 0 && diff.deactivated.length <= diff.stats.importCount * 5 && (
              <Alert
                color="blue"
                variant="light"
                icon={<IconInfoCircle size={16} />}
                mb="sm"
              >
                <Text size="sm">
                  These {diff.deactivated.length.toLocaleString()} roads exist in database but not in import file.
                  They will <Text span fw={600}>NOT</Text> be removed because Regional Refresh is OFF.
                </Text>
              </Alert>
            )}
            <FeatureTable
              features={diff.deactivated}
              emptyMessage={
                diff.regionalRefresh
                  ? "No roads will be deactivated"
                  : "No roads in database are missing from import file"
              }
              onFeatureClick={handleFeatureClick}
            />
          </Tabs.Panel>
        </Tabs>
      )}

      {/* Error blocking message */}
      {hasErrors && (
        <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
          Please resolve all errors before publishing
        </Alert>
      )}

      {/* Action Buttons */}
      <Group gap="sm">
        <Button
          variant="light"
          leftSection={<IconMap size={16} />}
          onClick={handleViewOnMap}
          disabled={!hasChanges}
        >
          Preview on Map
        </Button>
        <Button
          rightSection={<IconArrowRight size={16} />}
          onClick={handlePublish}
          disabled={!isValid}
          style={{ flex: 1 }}
        >
          Publish Changes
        </Button>
      </Group>
    </Stack>
  );
}

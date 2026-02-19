/**
 * Review Step Component
 *
 * Merged validation + preview step with improved UI.
 * Shows validation status, change summary, and feature details.
 */

import { useState } from 'react';
import { Stack, Text, Group, Paper, Loader } from '@/components/shims';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { showNotification } from '@/lib/toast';
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

/**
 * Format scope string for user-friendly display
 */
function formatScopeLabel(scope: string): string {
  if (scope === 'full') return 'Full City';
  if (scope.startsWith('ward:')) return `${scope.substring(5)} Ward`;
  if (scope.startsWith('bbox:')) return 'Import file area';
  return scope;
}

interface FeatureTableProps {
  features: Feature[];
  emptyMessage: string;
  onFeatureClick?: (feature: Feature) => void;
  highlightIds?: Set<string>;
  highlightColor?: string;
}

function FeatureTable({ features, emptyMessage, onFeatureClick, highlightIds, highlightColor = 'blue' }: FeatureTableProps) {
  if (features.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="lg">
        {emptyMessage}
      </Text>
    );
  }

  const colorClassMap: Record<string, string> = {
    blue: 'bg-blue-50 outline outline-2 outline-blue-400',
    teal: 'bg-teal-50 outline outline-2 outline-teal-400',
  };

  return (
    <ScrollArea className="h-[250px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Ward</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {features.slice(0, 100).map((feature, index) => {
            const props = feature.properties as FeatureProperties | null;
            const hasGeometry = !!feature.geometry;
            const isHighlighted = highlightIds && props?.id && highlightIds.has(props.id);
            return (
              <TableRow
                key={props?.id || index}
                onClick={() => hasGeometry && onFeatureClick?.(feature)}
                className={`${hasGeometry && onFeatureClick ? 'cursor-pointer' : ''} ${isHighlighted ? colorClassMap[highlightColor] || '' : ''}`}
              >
                <TableCell>
                  <Text size="xs" className="font-mono">
                    {props?.id || '-'}
                  </Text>
                </TableCell>
                <TableCell>{props?.name || 'Unnamed'}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">
                    {props?.roadType || '-'}
                  </Badge>
                </TableCell>
                <TableCell>{props?.ward || '-'}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {features.length > 100 && (
        <Text size="xs" c="dimmed" ta="center" mt="sm">
          Showing first 100 of {features.length} features -- Click row to view on map
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
  onClick?: () => void;
  disabled?: boolean;
}

function ChangeCountBadge({ icon, count, label, color, onClick, disabled }: ChangeCountBadgeProps) {
  const isClickable = onClick && count > 0 && !disabled;
  const colorMap: Record<string, string> = {
    green: 'border-green-500',
    blue: 'border-blue-500',
    orange: 'border-orange-500',
    gray: 'border-gray-400',
  };
  return (
    <Stack align="center" gap="xs">
      <Paper
        withBorder
        p="sm"
        radius="md"
        onClick={isClickable ? onClick : undefined}
        style={{
          borderColor: undefined,
          minWidth: 72,
          textAlign: 'center',
          cursor: isClickable ? 'pointer' : 'default',
          transition: 'transform 0.1s, box-shadow 0.1s',
        }}
        className={colorMap[color] || ''}
      >
        <Group justify="center" gap="xs">
          {icon}
          <Text fw={700} size="lg" className="font-mono">
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
  const [activeTab, setActiveTab] = useState<string>('updated');
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [highlightFeatureIds, setHighlightFeatureIds] = useState<Set<string> | undefined>(undefined);
  const [highlightColor, setHighlightColor] = useState<string>('blue');

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
        showNotification({
          title: 'Validation complete',
          message: 'No errors found',
          color: 'green',
        });
      }
    },
    onError: (job: ImportJob) => {
      setCurrentJobId(null);
      showNotification({
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
      showNotification({
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
    return allFeatures;
  };

  // Get features by change type for preview
  const getFeaturesByChangeType = (changeType: 'added' | 'updated' | 'removed'): Feature[] => {
    if (!diff) return [];
    const sourceArray = changeType === 'added' ? diff.added :
                        changeType === 'updated' ? diff.updated :
                        diff.deactivated;
    return sourceArray
      .filter((f) => f.geometry)
      .map((f) => ({
        ...f,
        properties: { ...f.properties, _changeType: changeType },
      }));
  };

  // Handle clicking on a change count badge
  const handleChangeTypePreview = (changeType: 'added' | 'updated' | 'removed') => {
    const features = getFeaturesByChangeType(changeType);
    if (features.length === 0) {
      showNotification({
        title: 'No features to preview',
        message: `No ${changeType} roads with geometry`,
        color: 'yellow',
      });
      return;
    }
    const firstFeature = features[0];
    const props = firstFeature.properties as FeatureProperties | null;
    const label = props?.name || props?.id || 'Unnamed Road';
    setImportAreaHighlight({
      geometry: firstFeature.geometry!,
      label,
      isHover: false,
    });
    const allFeatures = getAllModifiedFeatures();
    const startIndex = allFeatures.findIndex(
      (f) => f.properties?._changeType === changeType
    );
    startImportPreview(allFeatures, startIndex >= 0 ? startIndex : 0);
  };

  const handleFeatureClick = (feature: Feature) => {
    if (!feature.geometry) return;
    const allFeatures = getAllModifiedFeatures();
    const featureIndex = allFeatures.findIndex(
      (f) => f.properties?.id === feature.properties?.id
    );
    const props = feature.properties as FeatureProperties | null;
    const label = props?.name || props?.id || 'Unnamed Road';
    setImportAreaHighlight({
      geometry: feature.geometry,
      label,
      isHover: false,
    });
    startImportPreview(allFeatures, featureIndex >= 0 ? featureIndex : 0);
  };

  const handleViewOnMap = () => {
    const allFeatures = getAllModifiedFeatures();
    if (allFeatures.length === 0) {
      showNotification({
        title: 'No changes to preview',
        message: 'No roads will be modified by this import',
        color: 'yellow',
      });
      return;
    }
    const firstFeature = allFeatures[0];
    const props = firstFeature.properties as FeatureProperties | null;
    const label = props?.name || props?.id || 'Unnamed Road';
    setImportAreaHighlight({
      geometry: firstFeature.geometry!,
      label,
      isHover: false,
    });
    startImportPreview(allFeatures, 0);
  };

  const validation = validationData?.data;
  const diff = diffData?.data;
  const job = jobData?.data;

  // Show loading while job is running
  if (currentJobId && isPolling) {
    return (
      <Stack align="center" justify="center" style={{ minHeight: 200 }} gap="md">
        <Loader size="lg" />
        <Text fw={500}>Validating import file...</Text>
        <Progress value={job?.progress ?? 0} className="w-4/5 h-3" />
        <Text size="sm" c="dimmed">
          {job?.progress ?? 0}% complete
        </Text>
      </Stack>
    );
  }

  // Show loading while fetching cached results
  if (isLoadingValidation) {
    return (
      <Stack align="center" justify="center" style={{ minHeight: 200 }}>
        <Loader />
        <Text c="dimmed">Loading validation results...</Text>
      </Stack>
    );
  }

  // No validation results yet
  if (!validation) {
    return (
      <Stack align="center" justify="center" style={{ minHeight: 200 }} gap="md">
        <Text c="dimmed">No validation results available</Text>
        <Button onClick={handleRevalidate} disabled={triggerValidationMutation.isPending}>
          {triggerValidationMutation.isPending ? 'Validating...' : 'Run Validation'}
        </Button>
      </Stack>
    );
  }

  const hasErrors = validation.errors.length > 0;
  const hasWarnings = validation.warnings.length > 0;
  const featureWarnings = validation.warnings.filter((w: ValidationWarning) => w.featureIndex >= 0);
  const isValid = !hasErrors;
  const hasChanges = diff && (diff.added.length > 0 || diff.updated.length > 0 || diff.deactivated.length > 0);

  const missingDataSourceInDiff = diff
    ? [...diff.added, ...diff.updated].filter((f) => !f.properties?.dataSource).length
    : 0;

  // Dynamic card styling based on status
  const validationBorderClass = hasErrors ? 'border-red-500 border-2' :
                 hasWarnings ? 'border-yellow-500 border-2' :
                 'border-green-500 border-2';

  return (
    <Stack gap="md">
      {/* Validation Summary Card */}
      <div className={`border rounded-md p-4 ${validationBorderClass}`}>
        <Group justify="space-between" align="start">
          <Group gap="sm">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full ${hasErrors ? 'bg-red-100 text-red-600' : hasWarnings ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600'}`}>
              {hasErrors ? <IconX size={18} /> : <IconCheck size={18} />}
            </div>
            <div>
              <Text fw={600}>
                {hasErrors ? 'Validation Failed' : 'Validation Passed'}
              </Text>
              <Text size="sm" c="dimmed">
                {validation.featureCount.toLocaleString()} features checked
                {isValid && !hasWarnings && ' -- No issues found'}
              </Text>
            </div>
          </Group>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRevalidate}
            disabled={triggerValidationMutation.isPending}
          >
            {!triggerValidationMutation.isPending && <IconRefresh size={14} className="mr-1" />}
            {triggerValidationMutation.isPending ? 'Validating...' : 'Revalidate'}
          </Button>
        </Group>

        {/* Error/Warning counts - only show if issues exist */}
        {(hasErrors || hasWarnings) && (
          <Group gap="md" mt="sm">
            {hasErrors && (
              <Badge variant="destructive">
                <IconAlertCircle size={14} className="mr-1" />
                {validation.errors.length} Errors
              </Badge>
            )}
            {featureWarnings.length > 0 && (
              <Badge className="bg-yellow-100 text-yellow-800">
                <IconAlertTriangle size={14} className="mr-1" />
                {featureWarnings.length} Warnings
              </Badge>
            )}
            {validation.missingIdCount > 0 && (
              <Badge
                className="cursor-pointer"
                onClick={() => {
                  if (!diff) return;
                  const autoIds = new Set(
                    diff.added
                      .filter((f) => f.properties?._autoGeneratedId)
                      .map((f) => f.properties?.id as string)
                      .filter(Boolean)
                  );
                  setActiveTab('added');
                  setHighlightColor('blue');
                  setHighlightFeatureIds(autoIds.size > 0 ? autoIds : undefined);
                }}
              >
                {validation.missingIdCount} Auto-generated IDs
              </Badge>
            )}

            {(hasErrors || featureWarnings.length > 0) && (
              <button
                className="text-sm text-primary hover:underline"
                onClick={() => setShowErrorDetails(!showErrorDetails)}
              >
                {showErrorDetails ? 'Hide details' : 'View details'}
              </button>
            )}
          </Group>
        )}

        {/* Missing dataSource info */}
        {missingDataSourceInDiff > 0 && isValid && (
          <button
            className="text-xs text-blue-600 hover:underline mt-2 block"
            onClick={() => {
              if (!diff) return;
              const missingIds = new Set(
                [...diff.added, ...diff.updated]
                  .filter((f) => !f.properties?.dataSource)
                  .map((f) => f.properties?.id as string)
                  .filter(Boolean)
              );
              if (missingIds.size === 0) return;
              const inAdded = diff.added.some((f) => !f.properties?.dataSource);
              setActiveTab(inAdded ? 'added' : 'updated');
              setHighlightColor('teal');
              setHighlightFeatureIds(missingIds);
            }}
          >
            {missingDataSourceInDiff} features missing dataSource will use default value
          </button>
        )}
      </div>

      {/* Error/Warning Details */}
      {showErrorDetails && hasErrors && (
        <div className="space-y-2">
          {validation.errors.slice(0, 50).map((error: ValidationError, index: number) => (
            <details key={index} className="border rounded-md">
              <summary className="p-3 cursor-pointer flex items-center gap-2">
                <Badge variant="destructive" className="text-xs">Error</Badge>
                <Text size="sm">
                  Feature {error.featureIndex + 1}
                  {error.featureId && ` (${error.featureId})`}
                  : {error.field}
                </Text>
              </summary>
              <div className="px-3 pb-3">
                <Stack gap="xs">
                  <Text size="sm" fw={500}>{error.error}</Text>
                  <Text size="sm" c="dimmed">
                    How to fix: {error.hint}
                  </Text>
                </Stack>
              </div>
            </details>
          ))}
          {validation.errors.length > 50 && (
            <Text size="sm" c="dimmed" ta="center" mt="sm">
              Showing first 50 of {validation.errors.length} errors
            </Text>
          )}
        </div>
      )}

      {showErrorDetails && featureWarnings.length > 0 && (
        <div className="space-y-2">
          {featureWarnings.slice(0, 50).map((warning: ValidationWarning, index: number) => (
            <details key={index} className="border rounded-md">
              <summary className="p-3 cursor-pointer flex items-center gap-2">
                <Badge className="bg-yellow-100 text-yellow-800 text-xs">Warning</Badge>
                <Text size="sm">
                  Feature {warning.featureIndex + 1}
                  {warning.featureId && ` (${warning.featureId})`}
                </Text>
              </summary>
              <div className="px-3 pb-3">
                <Text size="sm">{warning.message}</Text>
              </div>
            </details>
          ))}
          {featureWarnings.length > 50 && (
            <Text size="sm" c="dimmed" ta="center" mt="sm">
              Showing first 50 of {featureWarnings.length} warnings
            </Text>
          )}
        </div>
      )}

      {/* Change Preview - only when valid */}
      {isValid && (
        <div className="border rounded-md p-4">
          <Text fw={600} mb="sm">Changes to Apply</Text>

          {isLoadingDiff ? (
            <Stack align="center" gap="xs" py="md">
              <Group gap="sm" justify="center">
                <Loader size="sm" />
                <Text size="sm" c="dimmed">Calculating changes...</Text>
              </Group>
              {validation && validation.featureCount > 10000 && (
                <Text size="xs" c="dimmed">
                  Comparing {validation.featureCount.toLocaleString()} features against database, please wait...
                </Text>
              )}
            </Stack>
          ) : diff ? (
            <>
              <Group gap="lg" justify="center">
                <ChangeCountBadge
                  icon={<IconPlus size={16} className="text-green-600" />}
                  count={diff.stats.addedCount}
                  label="Added"
                  color="green"
                  onClick={() => handleChangeTypePreview('added')}
                />
                <ChangeCountBadge
                  icon={<IconPencil size={16} className="text-blue-600" />}
                  count={diff.stats.updatedCount}
                  label="Updated"
                  color="blue"
                  onClick={() => handleChangeTypePreview('updated')}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <ChangeCountBadge
                        icon={<IconArchive size={16} className={diff.regionalRefresh ? "text-orange-600" : "text-gray-500"} />}
                        count={diff.stats.deactivatedCount}
                        label={diff.regionalRefresh ? "Removed" : "Removed (preview)"}
                        color={diff.regionalRefresh ? "orange" : "gray"}
                        onClick={() => handleChangeTypePreview('removed')}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[250px]">
                    {diff.regionalRefresh
                      ? "These roads will be deactivated when published"
                      : "Preview only - these roads will NOT be removed (Regional Refresh is OFF)"}
                  </TooltipContent>
                </Tooltip>
              </Group>

              <Group justify="center" mt="md">
                <Text size="sm" c="dimmed">
                  <Text span className="font-mono">{diff.unchanged.toLocaleString()}</Text>
                  {' '}roads unchanged
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <IconInfoCircle
                        size={14}
                        className="ml-1 cursor-help align-middle text-muted-foreground inline"
                      />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[280px]">
                      These roads exist in both import file and database with no changes. They will not be modified or trigger any notifications.
                    </TooltipContent>
                  </Tooltip>
                </Text>
              </Group>

              {/* Comparison mode indicator */}
              {diff.comparisonMode === 'precise' && (
                <Alert className="mt-3">
                  <IconCheck size={16} />
                  <AlertDescription>
                    <span className="font-medium">Precise comparison:</span> Comparing against original export
                    {diff.sourceExportId && <span className="text-muted-foreground"> ({diff.sourceExportId})</span>}
                  </AlertDescription>
                </Alert>
              )}

              {/* Scope info */}
              {(diff.comparisonMode === 'bbox' || diff.regionalRefresh) && (
                <Text size="xs" c="dimmed" ta="center" mt="sm">
                  {diff.comparisonMode === 'bbox' && diff.scope !== 'full' && `Scope: ${formatScopeLabel(diff.scope)}`}
                  {diff.regionalRefresh && (
                    <Text span className="text-orange-600 font-medium">
                      {diff.comparisonMode === 'bbox' && diff.scope !== 'full' ? ' -- ' : ''}Regional Refresh ON
                    </Text>
                  )}
                </Text>
              )}
            </>
          ) : (
            <Text size="sm" c="dimmed" ta="center">Unable to load change preview</Text>
          )}
        </div>
      )}

      {/* Feature Tabs - only when valid and diff loaded */}
      {isValid && diff && (
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setHighlightFeatureIds(undefined); }}>
          <TabsList>
            <TabsTrigger value="added">
              <IconPlus size={14} className="mr-1" />
              Added
              <Badge className="ml-1 bg-green-100 text-green-800">{diff.added.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="updated">
              <IconPencil size={14} className="mr-1" />
              Updated
              <Badge className="ml-1 bg-blue-100 text-blue-800">{diff.updated.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="deactivated">
              <IconArchive size={14} className="mr-1" />
              Removed
              <Badge className={`ml-1 ${diff.regionalRefresh ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'}`}>
                {diff.deactivated.length}
              </Badge>
              {!diff.regionalRefresh && diff.deactivated.length > 0 && (
                <Text span size="xs" c="dimmed" className="ml-1">(preview)</Text>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="added">
            <FeatureTable
              features={diff.added}
              emptyMessage="No new roads will be added"
              onFeatureClick={handleFeatureClick}
              highlightIds={highlightFeatureIds}
              highlightColor={highlightColor}
            />
          </TabsContent>

          <TabsContent value="updated">
            <FeatureTable
              features={diff.updated}
              emptyMessage="No existing roads will be updated"
              onFeatureClick={handleFeatureClick}
              highlightIds={highlightFeatureIds}
              highlightColor={highlightColor}
            />
          </TabsContent>

          <TabsContent value="deactivated">
            {/* Warning when removed count seems unusually high */}
            {diff.deactivated.length > diff.stats.importCount * 5 && (
              <Alert variant={diff.regionalRefresh ? 'destructive' : undefined} className="mb-3">
                <IconAlertTriangle size={16} />
                <AlertDescription>
                  <Text size="sm" fw={500}>
                    {diff.regionalRefresh
                      ? `Warning: ${diff.deactivated.length.toLocaleString()} roads will be REMOVED when published!`
                      : `Note: ${diff.deactivated.length.toLocaleString()} roads in database are not in your import file.`
                    }
                  </Text>
                  <Text size="sm" mt="xs">
                    This may indicate that your import file doesn't cover the full area you intended,
                    or there are roads in the database outside your import area.
                  </Text>
                </AlertDescription>
              </Alert>
            )}
            {!diff.regionalRefresh && diff.deactivated.length > 0 && diff.deactivated.length <= diff.stats.importCount * 5 && (
              <Alert className="mb-3">
                <IconInfoCircle size={16} />
                <AlertDescription>
                  These {diff.deactivated.length.toLocaleString()} roads exist in database but not in import file.
                  They will <span className="font-semibold">NOT</span> be removed because Regional Refresh is OFF.
                </AlertDescription>
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
          </TabsContent>
        </Tabs>
      )}

      {/* Error blocking message */}
      {hasErrors && (
        <Alert variant="destructive">
          <IconAlertCircle size={16} />
          <AlertDescription>Please resolve all errors before publishing</AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      <Group gap="sm">
        <Button
          variant="outline"
          onClick={handleViewOnMap}
          disabled={!hasChanges}
        >
          <IconMap size={16} className="mr-1" />
          Preview on Map
        </Button>
        <Button
          onClick={handlePublish}
          disabled={!isValid}
          style={{ flex: 1 }}
        >
          Publish Changes
          <IconArrowRight size={16} className="ml-1" />
        </Button>
      </Group>
    </Stack>
  );
}

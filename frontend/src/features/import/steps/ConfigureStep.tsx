/**
 * Configure Step Component
 *
 * Configure import options: layer selection, CRS, and default dataSource.
 * Import scope is auto-calculated from the file's bounding box.
 */

import { useState, useEffect } from 'react';
import { Stack, Text, Group, Loader } from '@/components/shims';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { showNotification } from '@/lib/toast';
import { IconInfoCircle, IconArrowRight, IconAlertTriangle } from '@tabler/icons-react';
import {
  useImportVersion,
  useImportVersionLayers,
  useConfigureImport,
  useTriggerValidation,
} from '../../../hooks/useImportVersions';
import { useUIStore } from '../../../stores/uiStore';

const CRS_OPTIONS = [
  { value: 'EPSG:4326', label: 'EPSG:4326 (WGS84 - Default)' },
  { value: 'EPSG:6668', label: 'EPSG:6668 (JGD2011)' },
  { value: 'EPSG:6669', label: 'EPSG:6669 (JGD2011 Zone 1)' },
  { value: 'EPSG:6670', label: 'EPSG:6670 (JGD2011 Zone 2)' },
  { value: 'EPSG:6671', label: 'EPSG:6671 (JGD2011 Zone 3)' },
  { value: 'EPSG:6672', label: 'EPSG:6672 (JGD2011 Zone 4)' },
  { value: 'EPSG:6673', label: 'EPSG:6673 (JGD2011 Zone 5)' },
  { value: 'EPSG:6674', label: 'EPSG:6674 (JGD2011 Zone 6)' },
  { value: 'EPSG:6675', label: 'EPSG:6675 (JGD2011 Zone 7)' },
  { value: 'EPSG:6676', label: 'EPSG:6676 (JGD2011 Zone 8)' },
];

const DATA_SOURCE_OPTIONS = [
  { value: 'official_ledger', label: 'Official Ledger (Recommended for GIS exports)' },
  { value: 'manual', label: 'Manual Entry' },
  { value: 'osm_test', label: 'OSM Test Data' },
];

export function ConfigureStep() {
  const { currentImportVersionId, setImportWizardStep, setImportHasReviewStep } = useUIStore();

  // Form state
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  const [sourceCRS, setSourceCRS] = useState<string>('EPSG:4326');
  const [defaultDataSource, setDefaultDataSource] = useState<string>('official_ledger');
  const [regionalRefresh, setRegionalRefresh] = useState<boolean>(false);

  // Queries
  const { data: versionData, isLoading: isLoadingVersion } = useImportVersion(currentImportVersionId);
  const { data: layersData, isLoading: isLoadingLayers } = useImportVersionLayers(
    versionData?.data?.fileType === 'geopackage' ? currentImportVersionId : null
  );

  // Mutations
  const configureMutation = useConfigureImport();
  const triggerValidationMutation = useTriggerValidation();

  // Auto-select first layer for single-layer GeoPackage
  useEffect(() => {
    if (layersData?.data && layersData.data.length === 1) {
      setSelectedLayer(layersData.data[0].name);
    }
  }, [layersData]);

  const handleConfigure = async () => {
    if (!currentImportVersionId) return;

    // Validate form
    if (versionData?.data?.fileType === 'geopackage' && !selectedLayer) {
      showNotification({
        title: 'Layer required',
        message: 'Please select a layer from the GeoPackage file',
        color: 'red',
      });
      return;
    }

    try {
      // Configure version (importScope is auto-calculated from file bounding box by backend)
      const result = await configureMutation.mutateAsync({
        id: currentImportVersionId,
        config: {
          layerName: selectedLayer || undefined,
          sourceCRS,
          defaultDataSource: defaultDataSource as 'osm_test' | 'official_ledger' | 'manual',
          regionalRefresh,
        },
      });

      // Trigger validation (runs in background)
      await triggerValidationMutation.mutateAsync(currentImportVersionId);

      // Navigate based on whether file was exported from our system
      if (result.sourceExportId) {
        setImportHasReviewStep(true);
        setImportWizardStep('review');
      } else {
        setImportHasReviewStep(false);
        setImportWizardStep('publish');
      }

      showNotification({
        title: 'Configuration saved',
        message: result.sourceExportId ? 'Starting validation...' : 'Validating...',
        color: 'blue',
      });
    } catch (error) {
      setImportHasReviewStep(true);
      showNotification({
        title: 'Configuration failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    }
  };

  if (isLoadingVersion) {
    return (
      <Stack align="center" justify="center" style={{ minHeight: 200 }}>
        <Loader />
        <Text c="dimmed">Loading version details...</Text>
      </Stack>
    );
  }

  const version = versionData?.data;
  const isGeoPackage = version?.fileType === 'geopackage';

  return (
    <Stack gap="md">
      <Alert>
        <IconInfoCircle size={16} />
        <AlertDescription>
          Configure import settings. By default, only new and updated roads will be added.
          Enable "Regional Refresh" to also deactivate roads not in the import file.
        </AlertDescription>
      </Alert>

      {/* File info */}
      <div className="border rounded-md p-3">
        <Group justify="space-between">
          <Text size="sm" fw={500}>File:</Text>
          <Text size="sm">{version?.fileName}</Text>
        </Group>
        <Group justify="space-between" mt="xs">
          <Text size="sm" fw={500}>Type:</Text>
          <Text size="sm">{version?.fileType?.toUpperCase()}</Text>
        </Group>
        {!!version?.featureCount && (
          <Group justify="space-between" mt="xs">
            <Text size="sm" fw={500}>Features:</Text>
            <Text size="sm">{version.featureCount.toLocaleString()}</Text>
          </Group>
        )}
      </div>

      {/* Layer selection (GeoPackage only) */}
      {isGeoPackage && (
        <div>
          <Label className="mb-1 block">Layer *</Label>
          <p className="text-xs text-muted-foreground mb-1">Select the layer containing road data</p>
          <Select value={selectedLayer || ''} onValueChange={setSelectedLayer} disabled={isLoadingLayers}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={isLoadingLayers ? 'Loading layers...' : 'Select a layer'} />
            </SelectTrigger>
            <SelectContent>
              {layersData?.data?.map((l) => (
                <SelectItem key={l.name} value={l.name}>
                  {l.name}
                </SelectItem>
              )) ?? []}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Source CRS */}
      <div>
        <Label className="mb-1 block">Source Coordinate System</Label>
        <p className="text-xs text-muted-foreground mb-1">Select the CRS of the import file. Will be transformed to EPSG:4326.</p>
        <Select value={sourceCRS} onValueChange={(v) => setSourceCRS(v || 'EPSG:4326')}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CRS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Default Data Source */}
      <div>
        <div className="flex items-center gap-1 mb-1">
          <Label>Default Data Source</Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <IconInfoCircle size={14} className="text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[300px]">
              <div className="mb-2">Applied to features missing the dataSource property:</div>
              <div><strong>official_ledger</strong> - Official GIS data from government</div>
              <div><strong>manual</strong> - Data manually entered by users</div>
              <div><strong>osm_test</strong> - OpenStreetMap test data</div>
            </TooltipContent>
          </Tooltip>
        </div>
        <p className="text-xs text-muted-foreground mb-1">Applied to features missing the dataSource property</p>
        <Select value={defaultDataSource} onValueChange={(v) => setDefaultDataSource(v || 'official_ledger')}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATA_SOURCE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Regional Refresh Toggle */}
      <div className="border rounded-md p-4">
        <Group justify="space-between" align="start">
          <div style={{ flex: 1 }}>
            <Text size="sm" fw={500}>Regional Refresh Mode</Text>
            <Text size="xs" c="dimmed" mt="xs">
              Enable this only when your import file represents the complete source of truth
              for the geographic area it covers.
            </Text>
          </div>
          <Switch
            checked={regionalRefresh}
            onCheckedChange={setRegionalRefresh}
          />
        </Group>

        {regionalRefresh ? (
          <Alert variant="destructive" className="mt-3">
            <IconAlertTriangle size={16} />
            <AlertTitle>Warning: Roads deleted from your import file will be REMOVED from database!</AlertTitle>
            <AlertDescription>
              Any roads within the file's geographic area that are NOT in your import file will be
              marked as inactive. Make sure your import file contains ALL roads you want to keep.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="mt-3">
            <IconInfoCircle size={16} />
            <AlertDescription>
              <span className="font-medium">OFF:</span> Only add new roads and update existing ones.
              Roads deleted from your import file will remain in database.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Continue button */}
      <Button
        onClick={handleConfigure}
        disabled={configureMutation.isPending || triggerValidationMutation.isPending}
        className="w-full"
      >
        {configureMutation.isPending || triggerValidationMutation.isPending ? 'Configuring...' : 'Validate Import'}
        <IconArrowRight size={16} className="ml-1" />
      </Button>
    </Stack>
  );
}

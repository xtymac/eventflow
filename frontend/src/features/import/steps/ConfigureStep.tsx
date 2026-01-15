/**
 * Configure Step Component
 *
 * Configure import options: layer selection, CRS, scope, and default dataSource.
 */

import { useState, useEffect } from 'react';
import {
  Stack,
  Text,
  Select,
  Radio,
  Group,
  Button,
  Card,
  Loader,
  Alert,
  TextInput,
  Switch,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconInfoCircle, IconArrowRight, IconAlertTriangle } from '@tabler/icons-react';
import {
  useImportVersion,
  useImportVersionLayers,
  useConfigureImport,
  useTriggerValidation,
} from '../../../hooks/useImportVersions';
import { useWards } from '../../../hooks/useApi';
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

type ScopeType = 'full' | 'ward' | 'bbox';

export function ConfigureStep() {
  const { currentImportVersionId, setImportWizardStep } = useUIStore();

  // Form state
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  const [sourceCRS, setSourceCRS] = useState<string>('EPSG:4326');
  const [scopeType, setScopeType] = useState<ScopeType>('full');
  const [selectedWard, setSelectedWard] = useState<string | null>(null);
  const [bboxInput, setBboxInput] = useState<string>('');
  const [defaultDataSource, setDefaultDataSource] = useState<string>('official_ledger');
  const [regionalRefresh, setRegionalRefresh] = useState<boolean>(false);

  // Queries
  const { data: versionData, isLoading: isLoadingVersion } = useImportVersion(currentImportVersionId);
  const { data: layersData, isLoading: isLoadingLayers } = useImportVersionLayers(
    versionData?.data?.fileType === 'geopackage' ? currentImportVersionId : null
  );
  const { data: wardsData } = useWards();

  // Mutations
  const configureMutation = useConfigureImport();
  const triggerValidationMutation = useTriggerValidation();

  // Auto-select first layer for single-layer GeoPackage
  useEffect(() => {
    if (layersData?.data && layersData.data.length === 1) {
      setSelectedLayer(layersData.data[0].name);
    }
  }, [layersData]);

  // Compute import scope string
  const getImportScope = (): string => {
    switch (scopeType) {
      case 'full':
        return 'full';
      case 'ward':
        return selectedWard ? `ward:${selectedWard}` : 'full';
      case 'bbox':
        return bboxInput.trim() ? `bbox:${bboxInput.trim()}` : 'full';
      default:
        return 'full';
    }
  };

  const handleConfigure = async () => {
    if (!currentImportVersionId) return;

    // Validate form
    if (versionData?.data?.fileType === 'geopackage' && !selectedLayer) {
      notifications.show({
        title: 'Layer required',
        message: 'Please select a layer from the GeoPackage file',
        color: 'red',
      });
      return;
    }

    if (scopeType === 'ward' && !selectedWard) {
      notifications.show({
        title: 'Ward required',
        message: 'Please select a ward for the import scope',
        color: 'red',
      });
      return;
    }

    if (scopeType === 'bbox' && !bboxInput.trim()) {
      notifications.show({
        title: 'Bounding box required',
        message: 'Please enter a bounding box for the import scope',
        color: 'red',
      });
      return;
    }

    try {
      // Configure version
      await configureMutation.mutateAsync({
        id: currentImportVersionId,
        config: {
          layerName: selectedLayer || undefined,
          sourceCRS,
          importScope: getImportScope(),
          defaultDataSource: defaultDataSource as 'osm_test' | 'official_ledger' | 'manual',
          regionalRefresh,
        },
      });

      // Trigger validation
      await triggerValidationMutation.mutateAsync(currentImportVersionId);

      // Proceed to validation step
      setImportWizardStep('validation');

      notifications.show({
        title: 'Configuration saved',
        message: 'Starting validation...',
        color: 'blue',
      });
    } catch (error) {
      notifications.show({
        title: 'Configuration failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    }
  };

  if (isLoadingVersion) {
    return (
      <Stack align="center" justify="center" mih={200}>
        <Loader />
        <Text c="dimmed">Loading version details...</Text>
      </Stack>
    );
  }

  const version = versionData?.data;
  const isGeoPackage = version?.fileType === 'geopackage';

  return (
    <Stack gap="md">
      <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
        Configure import settings. By default, only new and updated roads will be added.
        Enable "Regional Refresh" to also deactivate roads not in the import file.
      </Alert>

      {/* File info */}
      <Card withBorder padding="sm">
        <Group justify="space-between">
          <Text size="sm" fw={500}>File:</Text>
          <Text size="sm">{version?.fileName}</Text>
        </Group>
        <Group justify="space-between" mt="xs">
          <Text size="sm" fw={500}>Type:</Text>
          <Text size="sm">{version?.fileType?.toUpperCase()}</Text>
        </Group>
        <Group justify="space-between" mt="xs">
          <Text size="sm" fw={500}>Features:</Text>
          <Text size="sm">{version?.featureCount?.toLocaleString()}</Text>
        </Group>
      </Card>

      {/* Layer selection (GeoPackage only) */}
      {isGeoPackage && (
        <Select
          label="Layer"
          placeholder={isLoadingLayers ? 'Loading layers...' : 'Select a layer'}
          data={
            layersData?.data?.map((l) => ({
              value: l.name,
              label: `${l.name} (${l.featureCount} features, ${l.geometryType})`,
            })) ?? []
          }
          value={selectedLayer}
          onChange={setSelectedLayer}
          disabled={isLoadingLayers}
          required
        />
      )}

      {/* Source CRS */}
      <Select
        label="Source Coordinate System"
        description="Select the CRS of the import file. Will be transformed to EPSG:4326."
        data={CRS_OPTIONS}
        value={sourceCRS}
        onChange={(v) => setSourceCRS(v || 'EPSG:4326')}
      />

      {/* Import Scope */}
      <div>
        <Text size="sm" fw={500} mb="xs">
          Import Scope
        </Text>
        <Text size="xs" c="dimmed" mb="sm">
          Defines the geographic area for this import. If Regional Refresh is enabled,
          only roads within this scope will be affected.
        </Text>
        <Radio.Group value={scopeType} onChange={(v) => setScopeType(v as ScopeType)}>
          <Stack gap="xs">
            <Radio
              value="full"
              label="Full City"
              description="Apply to all roads city-wide"
            />
            <Radio
              value="ward"
              label="By Ward"
              description="Apply only to roads in a specific ward"
            />
            <Radio
              value="bbox"
              label="By Bounding Box"
              description="Apply only to roads in a geographic area"
            />
          </Stack>
        </Radio.Group>

        {scopeType === 'ward' && (
          <Select
            mt="sm"
            placeholder="Select ward..."
            data={wardsData?.data?.map((w) => ({ value: w, label: w })) ?? []}
            value={selectedWard}
            onChange={setSelectedWard}
            clearable
            searchable
          />
        )}

        {scopeType === 'bbox' && (
          <TextInput
            mt="sm"
            placeholder="minLng,minLat,maxLng,maxLat (e.g., 136.9,35.1,137.0,35.2)"
            value={bboxInput}
            onChange={(e) => setBboxInput(e.target.value)}
          />
        )}
      </div>

      {/* Default Data Source */}
      <Select
        label="Default Data Source"
        description="Applied to features missing the dataSource property"
        data={DATA_SOURCE_OPTIONS}
        value={defaultDataSource}
        onChange={(v) => setDefaultDataSource(v || 'official_ledger')}
      />

      {/* Regional Refresh Toggle */}
      <Card withBorder padding="md">
        <Group justify="space-between" align="flex-start">
          <div style={{ flex: 1 }}>
            <Text size="sm" fw={500}>Regional Refresh Mode</Text>
            <Text size="xs" c="dimmed" mt={4}>
              When enabled, roads within the import scope that are NOT in the import file
              will be marked as inactive. Use only for complete regional data updates.
            </Text>
          </div>
          <Switch
            checked={regionalRefresh}
            onChange={(e) => setRegionalRefresh(e.currentTarget.checked)}
            size="md"
          />
        </Group>

        {regionalRefresh && (
          <Alert
            icon={<IconAlertTriangle size={16} />}
            color="orange"
            variant="light"
            mt="sm"
          >
            <Text size="xs">
              Roads in scope but not in the import file will be deactivated.
              Make sure your import file contains ALL active roads for the selected scope.
            </Text>
          </Alert>
        )}
      </Card>

      {/* Continue button */}
      <Button
        rightSection={<IconArrowRight size={16} />}
        onClick={handleConfigure}
        loading={configureMutation.isPending || triggerValidationMutation.isPending}
        fullWidth
      >
        Validate Import
      </Button>
    </Stack>
  );
}

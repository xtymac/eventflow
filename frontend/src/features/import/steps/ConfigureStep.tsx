/**
 * Configure Step Component
 *
 * Configure import options: layer selection, CRS, and default dataSource.
 * Import scope is auto-calculated from the file's bounding box.
 */

import { useState, useEffect } from 'react';
import {
  Stack,
  Text,
  Select,
  Group,
  Button,
  Card,
  Loader,
  Alert,
  Switch,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
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
  const { currentImportVersionId, setImportWizardStep } = useUIStore();

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
      notifications.show({
        title: 'Layer required',
        message: 'Please select a layer from the GeoPackage file',
        color: 'red',
      });
      return;
    }

    try {
      // Configure version (importScope is auto-calculated from file bounding box by backend)
      await configureMutation.mutateAsync({
        id: currentImportVersionId,
        config: {
          layerName: selectedLayer || undefined,
          sourceCRS,
          defaultDataSource: defaultDataSource as 'osm_test' | 'official_ledger' | 'manual',
          regionalRefresh,
        },
      });

      // Trigger validation
      await triggerValidationMutation.mutateAsync(currentImportVersionId);

      // Proceed to validation step
      setImportWizardStep('review');

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
          description="Select the layer containing road data"
          placeholder={isLoadingLayers ? 'Loading layers...' : 'Select a layer'}
          data={
            layersData?.data?.map((l) => ({
              value: l.name,
              label: l.name,
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

      {/* Default Data Source */}
      <Select
        label={
          <Group gap={4}>
            <Text size="sm" fw={500}>Default Data Source</Text>
            <Tooltip
              label={
                <>
                  <div style={{ marginBottom: 8 }}>
                    Applied to features missing the dataSource property:
                  </div>
                  <div><strong>official_ledger</strong> - Official GIS data from government</div>
                  <div><strong>manual</strong> - Data manually entered by users</div>
                  <div><strong>osm_test</strong> - OpenStreetMap test data</div>
                </>
              }
              multiline
              w={300}
              withArrow
            >
              <IconInfoCircle size={14} style={{ color: 'var(--mantine-color-dimmed)', cursor: 'help' }} />
            </Tooltip>
          </Group>
        }
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
              Enable this only when your import file represents the complete source of truth
              for the geographic area it covers.
            </Text>
          </div>
          <Switch
            checked={regionalRefresh}
            onChange={(e) => setRegionalRefresh(e.currentTarget.checked)}
            size="md"
          />
        </Group>

        {regionalRefresh ? (
          <Alert
            icon={<IconAlertTriangle size={16} />}
            color="red"
            variant="light"
            mt="sm"
          >
            <Text size="xs" fw={500}>
              Warning: Roads deleted from your import file will be REMOVED from database!
            </Text>
            <Text size="xs" mt={4}>
              Any roads within the file's geographic area that are NOT in your import file will be
              marked as inactive. Make sure your import file contains ALL roads you want to keep.
            </Text>
          </Alert>
        ) : (
          <Alert
            icon={<IconInfoCircle size={16} />}
            color="gray"
            variant="light"
            mt="sm"
          >
            <Text size="xs">
              <Text span fw={500}>OFF:</Text> Only add new roads and update existing ones.
              Roads deleted from your import file will remain in database.
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

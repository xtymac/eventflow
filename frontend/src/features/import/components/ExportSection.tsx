/**
 * Export Section Component
 *
 * Allows users to export road assets with format and scope selection.
 */

import { useState } from 'react';
import {
  Stack,
  Radio,
  Group,
  Select,
  Button,
  Text,
  ActionIcon,
} from '@mantine/core';
import { IconDownload, IconMap, IconX } from '@tabler/icons-react';
import { useWards } from '../../../hooks/useApi';
import { useUIStore } from '../../../stores/uiStore';

type ExportFormat = 'geojson' | 'geopackage';

export function ExportSection() {
  const [format, setFormat] = useState<ExportFormat>('geojson');
  const [selectedWard, setSelectedWard] = useState<string | null>(null);

  // Use API base URL from env
  const API_BASE = import.meta.env.VITE_API_URL || '';

  const { data: wardsData } = useWards();

  // Get scope type and bbox from store (persisted across sidebar open/close)
  const scopeType = useUIStore((s) => s.exportScopeType);
  const setExportScopeType = useUIStore((s) => s.setExportScopeType);
  const exportBbox = useUIStore((s) => s.exportBbox);
  const startExportBboxConfirmation = useUIStore((s) => s.startExportBboxConfirmation);
  const clearExportBbox = useUIStore((s) => s.clearExportBbox);

  // Validate download is allowed
  const canDownload =
    scopeType === 'full' ||
    (scopeType === 'ward' && selectedWard) ||
    (scopeType === 'bbox' && exportBbox);

  const handleDownload = () => {
    if (!canDownload) return;

    let url = `${API_BASE}/export/${format}?type=assets`;
    if (scopeType === 'ward' && selectedWard) {
      url += `&ward=${encodeURIComponent(selectedWard)}`;
    } else if (scopeType === 'bbox' && exportBbox) {
      url += `&bbox=${encodeURIComponent(exportBbox)}`;
    }
    window.open(url, '_blank');
  };

  // Transform ward data for Mantine Select (string[] -> {value, label}[])
  const wardOptions =
    wardsData?.data?.map((w: string) => ({ value: w, label: w })) || [];

  return (
    <Stack gap="md">
      {/* Format selection with descriptions */}
      <Radio.Group
        value={format}
        onChange={(v) => setFormat(v as ExportFormat)}
        label="Format"
      >
        <Stack gap="xs" mt="xs">
          <Radio
            value="geojson"
            label="GeoJSON"
            description="Recommended for web use. Smaller files, easy to inspect and edit."
          />
          <Radio
            value="geopackage"
            label="GeoPackage"
            description="Recommended for GIS software (QGIS). Supports large datasets with full attributes."
          />
        </Stack>
      </Radio.Group>

      {/* Scope selection */}
      <Text size="sm" fw={500}>
        Scope
      </Text>
      <Radio.Group
        value={scopeType}
        onChange={(v) => setExportScopeType(v as 'full' | 'ward' | 'bbox')}
      >
        <Stack gap="xs">
          <Radio value="full" label="All Roads" />
          <Group>
            <Radio value="ward" label="By Ward" />
            {scopeType === 'ward' && (
              <Select
                data={wardOptions}
                value={selectedWard}
                onChange={setSelectedWard}
                placeholder="Select ward"
                size="xs"
                style={{ width: 150 }}
              />
            )}
          </Group>
          <Radio value="bbox" label="By Map Extent" />
        </Stack>
      </Radio.Group>

      {/* Bbox selection UI - only show when scope is bbox */}
      {scopeType === 'bbox' && (
        <Stack gap="xs" pl="md">
          <Button
            size="xs"
            variant="light"
            onClick={startExportBboxConfirmation}
            leftSection={<IconMap size={14} />}
          >
            Use Map View
          </Button>
          {exportBbox && (
            <Group gap="xs">
              <Text size="xs" c="dimmed">
                {exportBbox.substring(0, 35)}...
              </Text>
              <ActionIcon size="xs" variant="subtle" onClick={clearExportBbox}>
                <IconX size={12} />
              </ActionIcon>
            </Group>
          )}
        </Stack>
      )}

      <Button
        onClick={handleDownload}
        leftSection={<IconDownload size={16} />}
        disabled={!canDownload}
      >
        Download Export
      </Button>
    </Stack>
  );
}

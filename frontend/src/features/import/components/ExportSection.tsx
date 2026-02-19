/**
 * Export Section Component
 *
 * Allows users to export road assets with format and scope selection.
 */

import { useState } from 'react';
import { Stack, Text, Group } from '@/components/shims';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { showNotification } from '@/lib/toast';
import { IconDownload, IconMap, IconX } from '@tabler/icons-react';
import { useWards } from '../../../hooks/useApi';
import { useUIStore } from '../../../stores/uiStore';

type ExportFormat = 'geojson' | 'geopackage';

export function ExportSection() {
  const [format, setFormat] = useState<ExportFormat>('geopackage');
  const [selectedWard, setSelectedWard] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Use API base URL from env, default to /api for production
  const API_BASE = import.meta.env.VITE_API_URL || '/api';

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

  const handleDownload = async () => {
    if (!canDownload) return;

    setIsDownloading(true);
    try {
      const endpoint = format === 'geopackage' ? '/export/geopackage' : '/export/geojson';
      let url = `${API_BASE}${endpoint}?type=assets`;
      if (scopeType === 'ward' && selectedWard) {
        url += `&ward=${encodeURIComponent(selectedWard)}`;
      } else if (scopeType === 'bbox' && exportBbox) {
        url += `&bbox=${encodeURIComponent(exportBbox)}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      // Get filename from Content-Disposition header
      const disposition = response.headers.get('Content-Disposition');
      const filename = disposition?.match(/filename="([^"]+)"/)?.[1]
        || `road-assets.${format === 'geopackage' ? 'gpkg' : 'geojson'}`;

      // Trigger download
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(downloadUrl);

      showNotification({
        title: 'Export successful',
        message: `Downloaded ${filename} (${(blob.size / 1024).toFixed(1)} KB)`,
        color: 'green',
      });
    } catch (error) {
      showNotification({
        title: 'Export failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // Transform ward data for Select
  const wardOptions =
    wardsData?.data?.map((w: string) => ({ value: w, label: w })) || [];

  return (
    <Stack gap="md">
      {/* Format selection with descriptions */}
      <div>
        <Label className="mb-2 block">Format</Label>
        <RadioGroup value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
          <Stack gap="xs">
            <div className="flex items-start gap-2">
              <RadioGroupItem value="geojson" id="format-geojson" className="mt-1" />
              <div>
                <Label htmlFor="format-geojson" className="cursor-pointer">GeoJSON</Label>
                <p className="text-xs text-muted-foreground">Recommended for web use. Smaller files, easy to inspect and edit.</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <RadioGroupItem value="geopackage" id="format-geopackage" className="mt-1" />
              <div>
                <Label htmlFor="format-geopackage" className="cursor-pointer">GeoPackage</Label>
                <p className="text-xs text-muted-foreground">Recommended for GIS software (QGIS). Supports large datasets with full attributes.</p>
              </div>
            </div>
          </Stack>
        </RadioGroup>
      </div>

      {/* Scope selection */}
      <Text size="sm" fw={500}>
        Scope
      </Text>
      <RadioGroup
        value={scopeType}
        onValueChange={(v) => setExportScopeType(v as 'full' | 'ward' | 'bbox')}
      >
        <Stack gap="xs">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="full" id="scope-full" />
            <Label htmlFor="scope-full" className="cursor-pointer">All Roads</Label>
          </div>
          <Group>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="ward" id="scope-ward" />
              <Label htmlFor="scope-ward" className="cursor-pointer">By Ward</Label>
            </div>
            {scopeType === 'ward' && (
              <Select
                value={selectedWard || ''}
                onValueChange={setSelectedWard}
              >
                <SelectTrigger className="w-[150px] h-8 text-xs">
                  <SelectValue placeholder="Select ward" />
                </SelectTrigger>
                <SelectContent>
                  {wardOptions.map((opt: { value: string; label: string }) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Group>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="bbox" id="scope-bbox" />
            <Label htmlFor="scope-bbox" className="cursor-pointer">By Map Extent</Label>
          </div>
        </Stack>
      </RadioGroup>

      {/* Bbox selection UI - only show when scope is bbox */}
      {scopeType === 'bbox' && (
        <Stack gap="xs" style={{ paddingLeft: 16 }}>
          <Button
            size="sm"
            variant="outline"
            onClick={startExportBboxConfirmation}
          >
            <IconMap size={14} className="mr-1" />
            Use Map View
          </Button>
          {exportBbox && (
            <Group gap="xs">
              <Text size="xs" c="dimmed">
                {exportBbox.substring(0, 35)}...
              </Text>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={clearExportBbox}>
                <IconX size={12} />
              </Button>
            </Group>
          )}
        </Stack>
      )}

      <Button
        onClick={handleDownload}
        disabled={!canDownload || isDownloading}
      >
        <IconDownload size={16} className="mr-1" />
        {isDownloading ? 'Downloading...' : 'Download Export'}
      </Button>
    </Stack>
  );
}

import { useState } from 'react';
import { Drawer, Stack, Divider, Group, Text, Card, Select, Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconFileImport, IconDownload } from '@tabler/icons-react';
import { useUIStore } from '../stores/uiStore';
import { ImportVersionList } from '../features/import/ImportVersionList';
import { useExportAssets, type ExportFormat } from '../hooks/useApi';

// Export section component for downloading road assets
function ExportSection() {
  const [format, setFormat] = useState<ExportFormat>('gpkg');
  const exportMutation = useExportAssets();

  const handleExport = () => {
    exportMutation.mutate(format, {
      onSuccess: ({ filename, size }) => {
        notifications.show({
          title: 'Export successful',
          message: `Downloaded ${filename} (${(size / 1024).toFixed(1)} KB)`,
          color: 'green',
        });
      },
      onError: (error) => {
        notifications.show({
          title: 'Export failed',
          message: error instanceof Error ? error.message : 'Unknown error',
          color: 'red',
        });
      },
    });
  };

  return (
    <Card withBorder p="md">
      <Stack gap="sm">
        <Text fw={600}>Export Road Assets</Text>

        <Select
          label="Format"
          data={[
            { value: 'gpkg', label: 'GeoPackage (.gpkg)' },
            { value: 'geojson', label: 'GeoJSON (.geojson)' },
          ]}
          value={format}
          onChange={(v) => setFormat((v as ExportFormat) || 'gpkg')}
          description={format === 'gpkg'
            ? 'Best for ArcGIS and large files'
            : 'For small datasets or debugging'}
        />

        <Button
          leftSection={<IconDownload size={16} />}
          onClick={handleExport}
          loading={exportMutation.isPending}
        >
          Export Road Assets
        </Button>
      </Stack>
    </Card>
  );
}

export function ImportExportSidebar() {
  const { isImportExportSidebarOpen, closeImportExportSidebar } = useUIStore();

  return (
    <Drawer
      opened={isImportExportSidebarOpen}
      onClose={closeImportExportSidebar}
      position="right"
      title={
        <Group gap="xs">
          <IconFileImport size={20} />
          <Text fw={600}>Import / Export</Text>
        </Group>
      }
      size="md"
    >
      <Stack gap="md">
        <ExportSection />
        <Divider />
        <ImportVersionList />
      </Stack>
    </Drawer>
  );
}

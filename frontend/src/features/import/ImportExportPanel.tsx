/**
 * Import/Export Panel Component
 *
 * Main panel for the Import/Export tab containing
 * export scope selection and import version history.
 */

import { Stack, Title, Divider } from '@mantine/core';
import { ExportSection } from './components/ExportSection';
import { ImportSection } from './components/ImportSection';

export function ImportExportPanel() {
  return (
    <Stack gap="lg" p="md">
      <Title order={4}>Import / Export</Title>

      {/* Export Section */}
      <ExportSection />

      <Divider />

      {/* Import Section */}
      <ImportSection />
    </Stack>
  );
}

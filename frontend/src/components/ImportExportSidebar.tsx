/**
 * Import/Export Sidebar Component
 *
 * Right sidebar with tabbed interface for Import and Export functionality.
 * Supports resizable width with localStorage persistence.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Drawer, Stack, Title, Group, ActionIcon, Tabs, Box } from '@mantine/core';
import { IconX, IconUpload, IconDownload } from '@tabler/icons-react';
import { useUIStore } from '../stores/uiStore';
import { ExportSection } from '../features/import/components/ExportSection';
import { ImportSection } from '../features/import/components/ImportSection';

const IMPORT_EXPORT_WIDTH_KEY = 'eventflow-import-export-width';
const DEFAULT_WIDTH = 400;
const MIN_WIDTH = 320;
const MAX_WIDTH = 700;

export function ImportExportSidebar() {
  const isOpen = useUIStore((s) => s.isImportExportSidebarOpen);
  const close = useUIStore((s) => s.closeImportExportSidebar);

  // Resize state
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem(IMPORT_EXPORT_WIDTH_KEY);
    return saved ? Math.min(Math.max(parseInt(saved, 10), MIN_WIDTH), MAX_WIDTH) : DEFAULT_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeRef.current = { startX: e.clientX, startWidth: width };
  }, [width]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      // For right sidebar, drag left increases width
      const delta = resizeRef.current.startX - e.clientX;
      const newWidth = Math.min(Math.max(resizeRef.current.startWidth + delta, MIN_WIDTH), MAX_WIDTH);
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      localStorage.setItem(IMPORT_EXPORT_WIDTH_KEY, String(width));
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, width]);

  return (
    <Drawer
      opened={isOpen}
      onClose={close}
      position="right"
      size={width}
      withCloseButton={false}
      padding="md"
      overlayProps={{ backgroundOpacity: 0.3 }}
      styles={{
        content: { height: '100%', display: 'flex', flexDirection: 'column' },
        body: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
      }}
    >
      {/* Resize Handle - left edge */}
      <Box
        className={`sidebar-resize-handle ${isResizing ? 'active' : ''}`}
        onMouseDown={handleResizeStart}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 6,
          height: '100%',
          cursor: 'col-resize',
          background: isResizing ? 'var(--mantine-color-blue-5)' : 'transparent',
          transition: isResizing ? 'none' : 'background 0.2s',
          zIndex: 10,
        }}
      />
      <Stack gap="md" h="100%">
        <Group justify="space-between">
          <Title order={4}>Import / Export</Title>
          <ActionIcon variant="subtle" color="gray" onClick={close}>
            <IconX size={18} />
          </ActionIcon>
        </Group>

        <Tabs defaultValue="export" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Tabs.List>
            <Tabs.Tab value="export" leftSection={<IconDownload size={16} />}>
              Export
            </Tabs.Tab>
            <Tabs.Tab value="import" leftSection={<IconUpload size={16} />}>
              Import
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="export" pt="md" style={{ flex: 1, overflow: 'auto' }}>
            <ExportSection />
          </Tabs.Panel>

          <Tabs.Panel value="import" pt="md" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <ImportSection />
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Drawer>
  );
}

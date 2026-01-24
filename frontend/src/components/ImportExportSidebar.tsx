/**
 * Import/Export Sidebar Component
 *
 * Right sidebar with tabbed interface for Import and Export functionality.
 * Supports resizable width with localStorage persistence.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Drawer, Stack, Title, Group, ActionIcon, Tabs, Box, Text, Progress, useMantineColorScheme } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { IconX, IconUpload, IconDownload } from '@tabler/icons-react';
import { useUIStore } from '../stores/uiStore';
import { ExportSection } from '../features/import/components/ExportSection';
import { ImportSection } from '../features/import/components/ImportSection';
import { useUploadImport } from '../hooks/useImportVersions';

const IMPORT_EXPORT_WIDTH_KEY = 'eventflow-import-export-width';
const DEFAULT_WIDTH = 400;
const MIN_WIDTH = 320;
const MAX_WIDTH = 700;
const MAX_SIZE = 100 * 1024 * 1024; // 100MB
const VALID_EXTENSIONS = ['.gpkg', '.geojson', '.json'];

export function ImportExportSidebar() {
  const isOpen = useUIStore((s) => s.isImportExportSidebarOpen);
  const close = useUIStore((s) => s.closeImportExportSidebar);
  const activeTab = useUIStore((s) => s.importExportActiveTab);
  const setActiveTab = useUIStore((s) => s.setImportExportActiveTab);
  const setImportWizardStep = useUIStore((s) => s.setImportWizardStep);
  const setCurrentImportVersionId = useUIStore((s) => s.setCurrentImportVersionId);
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const uploadMutation = useUploadImport();

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

  const handleFileValidation = useCallback((file: File): boolean => {
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!VALID_EXTENSIONS.includes(ext)) {
      notifications.show({
        title: 'Invalid file',
        message: `Invalid file type: ${ext}. Please use .gpkg, .geojson, or .json`,
        color: 'red',
      });
      return false;
    }
    if (file.size > MAX_SIZE) {
      notifications.show({
        title: 'File too large',
        message: 'Maximum file size is 100MB',
        color: 'red',
      });
      return false;
    }
    return true;
  }, []);

  const handleDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file || !handleFileValidation(file)) return;

    setIsUploading(true);
    setUploadProgress(0);

    // Simulate progress for UX
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 10, 90));
    }, 200);

    try {
      const result = await uploadMutation.mutateAsync(file);
      clearInterval(progressInterval);
      setUploadProgress(100);

      // Close sidebar, set version ID and skip to configure step
      close();
      setCurrentImportVersionId(result.data.id);
      setImportWizardStep('configure');

      // Open the wizard
      useUIStore.setState({ importWizardOpen: true });

      notifications.show({
        title: 'Upload successful',
        message: `${file.name} uploaded successfully`,
        color: 'green',
      });
    } catch (error) {
      clearInterval(progressInterval);
      setUploadProgress(0);
      notifications.show({
        title: 'Upload failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    } finally {
      setIsUploading(false);
    }
  }, [handleFileValidation, uploadMutation, close, setCurrentImportVersionId, setImportWizardStep]);

  const handleReject = useCallback((rejections: FileRejection[]) => {
    const rejection = rejections[0];
    if (rejection) {
      notifications.show({
        title: 'Invalid file',
        message: rejection.errors[0]?.message || 'Please upload a .gpkg, .geojson, or .json file (max 100MB)',
        color: 'red',
      });
    }
  }, []);

  // Custom validator for file extension
  const fileValidator = useCallback((file: File) => {
    if (!file?.name) return null;
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!VALID_EXTENSIONS.includes(ext)) {
      return {
        code: 'invalid-extension',
        message: `Invalid file type: ${ext}. Please use .gpkg, .geojson, or .json`,
      };
    }
    return null;
  }, []);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop: handleDrop,
    onDropRejected: handleReject,
    maxSize: MAX_SIZE,
    multiple: false,
    noClick: true, // Don't trigger file dialog on click (button handles that)
    validator: fileValidator,
  });

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

        <Tabs
          value={activeTab}
          onChange={(value) => setActiveTab(value as 'import' | 'export')}
          style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
        >
          <Tabs.List>
            <Tabs.Tab value="export" leftSection={<IconDownload size={16} />}>
              Export
            </Tabs.Tab>
            <Tabs.Tab value="import" leftSection={<IconUpload size={16} />}>
              Import
            </Tabs.Tab>
          </Tabs.List>

          <div
            {...getRootProps()}
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              borderRadius: 8,
              border: isDragActive
                ? `2px dashed ${isDragReject ? 'var(--mantine-color-red-5)' : 'var(--mantine-color-blue-5)'}`
                : '2px dashed transparent',
              backgroundColor: isDragActive
                ? isDragReject
                  ? 'var(--mantine-color-red-0)'
                  : isDark
                    ? 'rgba(34, 139, 230, 0.1)'
                    : 'var(--mantine-color-blue-0)'
                : 'transparent',
              transition: 'border-color 0.2s, background-color 0.2s',
            }}
          >
            <input {...getInputProps()} />

            {/* Drag overlay */}
            {isDragActive && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10,
                  pointerEvents: 'none',
                  backgroundColor: isDark
                    ? 'rgba(26, 27, 30, 0.9)'
                    : 'rgba(255, 255, 255, 0.9)',
                  borderRadius: 6,
                }}
              >
                <IconUpload
                  size={48}
                  style={{
                    color: isDragReject
                      ? 'var(--mantine-color-red-5)'
                      : 'var(--mantine-color-blue-5)',
                    marginBottom: 12,
                  }}
                />
                <Text
                  size="lg"
                  fw={600}
                  c={isDragReject ? 'red' : 'blue'}
                >
                  {isDragReject ? 'Invalid file type' : 'Drop file to import'}
                </Text>
                <Text size="sm" c="dimmed" mt={4}>
                  .gpkg, .geojson, or .json files only
                </Text>
              </div>
            )}

            {/* Upload progress overlay */}
            {isUploading && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10,
                  backgroundColor: isDark
                    ? 'rgba(26, 27, 30, 0.9)'
                    : 'rgba(255, 255, 255, 0.9)',
                  borderRadius: 6,
                  padding: 24,
                }}
              >
                <Text size="sm" mb={12}>Uploading...</Text>
                <Progress value={uploadProgress} size="sm" w="80%" animated />
              </div>
            )}

            <Tabs.Panel value="export" pt="md" style={{ flex: 1, overflow: 'auto' }}>
              <ExportSection />
            </Tabs.Panel>

            <Tabs.Panel value="import" pt="md" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <ImportSection />
            </Tabs.Panel>
          </div>
        </Tabs>
      </Stack>
    </Drawer>
  );
}

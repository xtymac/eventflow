/**
 * Import/Export Sidebar Component
 *
 * Right sidebar with tabbed interface for Import and Export functionality.
 * Supports resizable width with localStorage persistence.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Text } from '@/components/shims';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { showNotification } from '@/lib/toast';
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
      showNotification({
        title: 'Invalid file',
        message: `Invalid file type: ${ext}. Please use .gpkg, .geojson, or .json`,
        color: 'red',
      });
      return false;
    }
    if (file.size > MAX_SIZE) {
      showNotification({
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

      showNotification({
        title: 'Upload successful',
        message: `${file.name} uploaded successfully`,
        color: 'green',
      });
    } catch (error) {
      clearInterval(progressInterval);
      setUploadProgress(0);
      showNotification({
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
      showNotification({
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
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) close(); }}>
      <SheetContent
        side="right"
        className="p-0"
        style={{ width, maxWidth: MAX_WIDTH, minWidth: MIN_WIDTH }}
      >
        {/* Resize Handle - left edge */}
        <div
          className={`absolute left-0 top-0 h-full w-1.5 cursor-col-resize z-10 transition-colors ${isResizing ? 'bg-primary' : 'hover:bg-primary/30'}`}
          onMouseDown={handleResizeStart}
        />

        <div className="flex h-full flex-col gap-4 p-4 pl-5">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold">Import / Export</h4>
            <Button variant="ghost" size="icon" onClick={close}>
              <IconX size={18} />
            </Button>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as 'import' | 'export')}
            className="flex flex-1 flex-col"
          >
            <TabsList className="w-full">
              <TabsTrigger value="export" className="flex-1">
                <IconDownload size={16} className="mr-2" />
                Export
              </TabsTrigger>
              <TabsTrigger value="import" className="flex-1">
                <IconUpload size={16} className="mr-2" />
                Import
              </TabsTrigger>
            </TabsList>

            <div
              {...getRootProps()}
              className="relative flex min-h-0 flex-1 flex-col rounded-lg transition-colors"
              style={{
                border: isDragActive
                  ? `2px dashed ${isDragReject ? '#ef4444' : '#3b82f6'}`
                  : '2px dashed transparent',
                backgroundColor: isDragActive
                  ? isDragReject
                    ? 'rgba(239, 68, 68, 0.05)'
                    : 'rgba(59, 130, 246, 0.05)'
                  : 'transparent',
              }}
            >
              <input {...getInputProps()} />

              {/* Drag overlay */}
              {isDragActive && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-md bg-background/90 pointer-events-none">
                  <IconUpload
                    size={48}
                    className={isDragReject ? 'text-red-500 mb-3' : 'text-blue-500 mb-3'}
                  />
                  <Text size="lg" fw={600} c={isDragReject ? 'red' : 'blue'}>
                    {isDragReject ? 'Invalid file type' : 'Drop file to import'}
                  </Text>
                  <Text size="sm" c="dimmed" className="mt-1">
                    .gpkg, .geojson, or .json files only
                  </Text>
                </div>
              )}

              {/* Upload progress overlay */}
              {isUploading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-md bg-background/90 p-6">
                  <p className="mb-3 text-sm">Uploading...</p>
                  <Progress value={uploadProgress} className="w-4/5" />
                </div>
              )}

              <TabsContent value="export" className="mt-4 flex-1 overflow-auto">
                <ExportSection />
              </TabsContent>

              <TabsContent value="import" className="mt-4 flex flex-1 flex-col overflow-hidden">
                <ImportSection />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

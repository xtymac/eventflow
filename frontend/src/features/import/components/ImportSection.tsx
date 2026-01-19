/**
 * Import Section Component
 *
 * Wrapper for ImportVersionList with compact display.
 * Supports drag-and-drop file import to trigger import wizard.
 */

import { useState, useCallback } from 'react';
import { Text, Progress, useMantineColorScheme } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { IconUpload } from '@tabler/icons-react';
import { ImportVersionList } from '../ImportVersionList';
import { useUploadImport } from '../../../hooks/useImportVersions';
import { useUIStore } from '../../../stores/uiStore';

const MAX_SIZE = 100 * 1024 * 1024; // 100MB
const VALID_EXTENSIONS = ['.gpkg', '.geojson', '.json'];

export function ImportSection() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const uploadMutation = useUploadImport();
  const {
    closeImportExportSidebar,
    setImportWizardStep,
    setCurrentImportVersionId,
  } = useUIStore();

  const handleFileValidation = useCallback((file: File): boolean => {
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!VALID_EXTENSIONS.includes(ext)) {
      notifications.show({
        title: 'Invalid file',
        message: `Invalid file type: ${ext}. Please use .gpkg or .geojson`,
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
      closeImportExportSidebar();
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
  }, [handleFileValidation, uploadMutation, closeImportExportSidebar, setCurrentImportVersionId, setImportWizardStep]);

  const handleReject = useCallback((rejections: FileRejection[]) => {
    const rejection = rejections[0];
    if (rejection) {
      notifications.show({
        title: 'Invalid file',
        message: rejection.errors[0]?.message || 'Please upload a .gpkg or .geojson file (max 100MB)',
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
        message: `Invalid file type: ${ext}. Please use .gpkg or .geojson`,
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
    <div
      {...getRootProps()}
      style={{
        height: '100%',
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
            .gpkg or .geojson files only
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

      <ImportVersionList compact />
    </div>
  );
}

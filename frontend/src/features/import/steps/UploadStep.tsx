/**
 * Upload Step Component
 *
 * Dropzone for uploading GeoPackage or GeoJSON files.
 */

import { useState } from 'react';
import { Stack, Text, Group, rem, Progress, Alert } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { notifications } from '@mantine/notifications';
import { IconUpload, IconFile, IconX, IconInfoCircle } from '@tabler/icons-react';
import { useUploadImport } from '../../../hooks/useImportVersions';
import { useUIStore } from '../../../stores/uiStore';

const MAX_SIZE = 100 * 1024 * 1024; // 100MB

export function UploadStep() {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const uploadMutation = useUploadImport();
  const { setImportWizardStep, setCurrentImportVersionId } = useUIStore();

  const handleDrop = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);

    // Simulate progress for UX (actual upload doesn't have progress events easily)
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 10, 90));
    }, 200);

    try {
      const result = await uploadMutation.mutateAsync(file);
      clearInterval(progressInterval);
      setUploadProgress(100);

      setCurrentImportVersionId(result.data.id);
      setImportWizardStep('configure');

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
  };

  const handleReject = () => {
    notifications.show({
      title: 'Invalid file',
      message: 'Please upload a .gpkg or .geojson file (max 100MB)',
      color: 'red',
    });
  };

  return (
    <Stack gap="md">
      <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
        Upload a GeoPackage (.gpkg) or GeoJSON (.geojson) file containing road data.
        Maximum file size: 100MB.
      </Alert>

      <Dropzone
        onDrop={handleDrop}
        onReject={handleReject}
        maxSize={MAX_SIZE}
        accept={{
          'application/geopackage+sqlite3': ['.gpkg'],
          'application/geo+json': ['.geojson'],
          'application/json': ['.json'],
        }}
        multiple={false}
        loading={isUploading}
        disabled={isUploading}
      >
        <Group justify="center" gap="xl" mih={180} style={{ pointerEvents: 'none' }}>
          <Dropzone.Accept>
            <IconUpload
              style={{ width: rem(52), height: rem(52), color: 'var(--mantine-color-blue-6)' }}
              stroke={1.5}
            />
          </Dropzone.Accept>
          <Dropzone.Reject>
            <IconX
              style={{ width: rem(52), height: rem(52), color: 'var(--mantine-color-red-6)' }}
              stroke={1.5}
            />
          </Dropzone.Reject>
          <Dropzone.Idle>
            <IconFile
              style={{ width: rem(52), height: rem(52), color: 'var(--mantine-color-dimmed)' }}
              stroke={1.5}
            />
          </Dropzone.Idle>

          <div>
            <Text size="xl" inline>
              Drag file here or click to browse
            </Text>
            <Text size="sm" c="dimmed" inline mt={7}>
              Accepts .gpkg and .geojson files up to 100MB
            </Text>
          </div>
        </Group>
      </Dropzone>

      {isUploading && (
        <Progress value={uploadProgress} size="sm" animated />
      )}
    </Stack>
  );
}

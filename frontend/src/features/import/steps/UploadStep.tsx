/**
 * Upload Step Component
 *
 * Aceternity-style animated dropzone for uploading GeoPackage or GeoJSON files.
 */

import { useRef, useState } from 'react';
import { Stack, Text } from '@/components/shims';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { showNotification } from '@/lib/toast';
import { IconUpload, IconInfoCircle } from '@tabler/icons-react';
import { motion } from 'motion/react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { useUploadImport } from '../../../hooks/useImportVersions';
import { useUIStore } from '../../../stores/uiStore';

const MAX_SIZE = 100 * 1024 * 1024; // 100MB
const VALID_EXTENSIONS = ['.gpkg', '.geojson', '.json'];

// Animation variants
const mainVariant = {
  initial: { x: 0, y: 0 },
  animate: { x: 20, y: -20, opacity: 0.9 },
};

const secondaryVariant = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
};

// Grid pattern background component
function GridPattern() {
  const isDark = false;

  const columns = 41;
  const rows = 11;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '1px',
        transform: 'scale(1.05)',
        backgroundColor: isDark ? 'hsl(var(--muted))' : 'hsl(var(--muted) / 0.5)',
      }}
    >
      {Array.from({ length: rows }).map((_, row) =>
        Array.from({ length: columns }).map((_, col) => {
          const index = row * columns + col;
          return (
            <div
              key={`${col}-${row}`}
              style={{
                width: 10,
                height: 10,
                flexShrink: 0,
                borderRadius: 2,
                backgroundColor: isDark ? 'hsl(var(--background))' : 'hsl(var(--card))',
                boxShadow: index % 2 === 0
                  ? 'none'
                  : isDark
                    ? 'inset 0px 0px 1px 3px rgba(0,0,0,1)'
                    : 'inset 0px 0px 1px 3px rgba(255,255,255,1)',
              }}
            />
          );
        })
      )}
    </div>
  );
}

export function UploadStep() {
  const isDark = false;

  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useUploadImport();
  const { setImportWizardStep, setCurrentImportVersionId } = useUIStore();

  const handleFileValidation = (file: File): boolean => {
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!VALID_EXTENSIONS.includes(ext)) {
      showNotification({
        title: 'Invalid file',
        message: `Invalid file type: ${ext}. Please use .gpkg or .geojson`,
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
  };

  const handleDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file || !handleFileValidation(file)) return;

    setSelectedFile(file);
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

      setCurrentImportVersionId(result.data.id);
      setImportWizardStep('configure');

      showNotification({
        title: 'Upload successful',
        message: `${file.name} uploaded successfully`,
        color: 'green',
      });
    } catch (error) {
      clearInterval(progressInterval);
      setUploadProgress(0);
      setSelectedFile(null);
      showNotification({
        title: 'Upload failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleReject = (rejections: FileRejection[]) => {
    const rejection = rejections[0];
    if (rejection) {
      showNotification({
        title: 'Invalid file',
        message: rejection.errors[0]?.message || 'Please upload a .gpkg or .geojson file (max 100MB)',
        color: 'red',
      });
    }
  };

  const handleClick = () => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  };

  // Custom validator for file extension (MIME types unreliable for .gpkg)
  // Note: During drag, file.name may not be available (DataTransferItem), so skip validation
  const fileValidator = (file: File) => {
    // During drag events, file.name might not be available - accept and validate on drop
    if (!file?.name) {
      return null;
    }
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!VALID_EXTENSIONS.includes(ext)) {
      return {
        code: 'invalid-extension',
        message: `Invalid file type: ${ext}. Please use .gpkg or .geojson`,
      };
    }
    return null;
  };

  const { getRootProps, isDragActive, isDragReject } = useDropzone({
    onDrop: handleDrop,
    onDropRejected: handleReject,
    maxSize: MAX_SIZE,
    multiple: false,
    noClick: true,
    validator: fileValidator,
  });

  return (
    <Stack gap="md">
      <Alert>
        <IconInfoCircle size={16} />
        <AlertDescription>
          Upload a GeoPackage (.gpkg) or GeoJSON (.geojson) file containing road data.
          Maximum file size: 100MB.
        </AlertDescription>
      </Alert>

      <div {...getRootProps()} style={{ width: '100%' }}>
        <motion.div
          onClick={handleClick}
          whileHover={!isUploading ? 'animate' : undefined}
          style={{
            padding: 40,
            display: 'block',
            borderRadius: 8,
            cursor: isUploading ? 'wait' : 'pointer',
            width: '100%',
            position: 'relative',
            overflow: 'hidden',
            border: `2px dashed ${
              isDragReject
                ? 'hsl(var(--destructive))'
                : isDragActive
                  ? 'hsl(var(--primary))'
                  : 'hsl(var(--border))'
            }`,
            backgroundColor: isDragReject
              ? 'hsl(var(--destructive) / 0.05)'
              : isDragActive
                ? 'hsl(var(--primary) / 0.05)'
                : 'transparent',
            transition: 'border-color 0.2s, background-color 0.2s',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".gpkg,.geojson,.json,application/octet-stream"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (files.length > 0) handleDrop(files);
              e.target.value = '';
            }}
            style={{ display: 'none' }}
          />

          {/* Grid pattern background */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              maskImage: 'radial-gradient(ellipse at center, white, transparent)',
              WebkitMaskImage: 'radial-gradient(ellipse at center, white, transparent)',
            }}
          >
            <GridPattern />
          </div>

          {/* Content */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              fw={700}
              size="lg"
              className="text-gray-600"
              style={{ position: 'relative', zIndex: 20 }}
            >
              Upload file
            </Text>
            <Text
              size="sm"
              c="dimmed"
              mt="sm"
              style={{ position: 'relative', zIndex: 20 }}
            >
              Drag or drop your file here or click to upload
            </Text>

            {/* Animated upload box */}
            <div style={{ position: 'relative', width: '100%', marginTop: 40, maxWidth: 400, margin: '40px auto 0' }}>
              {/* Show selected file info */}
              {selectedFile ? (
                <motion.div
                  layoutId="file-upload"
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    zIndex: 40,
                    backgroundColor: isDark ? 'hsl(var(--card))' : 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    justifyContent: 'flex-start',
                    padding: 16,
                    marginTop: 16,
                    width: '100%',
                    borderRadius: 8,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', gap: 16 }}>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: 'hsl(var(--foreground))',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 200,
                        margin: 0,
                      }}
                    >
                      {selectedFile.name}
                    </motion.p>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{
                        borderRadius: 8,
                        padding: '4px 8px',
                        fontSize: 12,
                        color: 'hsl(var(--muted-foreground))',
                        backgroundColor: 'hsl(var(--muted))',
                        margin: 0,
                        flexShrink: 0,
                      }}
                    >
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </motion.p>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      width: '100%',
                      marginTop: 8,
                      justifyContent: 'space-between',
                      fontSize: 12,
                      color: 'hsl(var(--muted-foreground))',
                    }}
                  >
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{
                        padding: '2px 6px',
                        borderRadius: 4,
                        backgroundColor: 'hsl(var(--muted))',
                        margin: 0,
                      }}
                    >
                      {selectedFile.name.split('.').pop()?.toUpperCase()}
                    </motion.p>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{ margin: 0 }}
                    >
                      modified {new Date(selectedFile.lastModified).toLocaleDateString()}
                    </motion.p>
                  </div>
                </motion.div>
              ) : (
                <>
                  {/* Animated icon box */}
                  <motion.div
                    layoutId="file-upload"
                    variants={mainVariant}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    style={{
                      position: 'relative',
                      zIndex: 40,
                      backgroundColor: isDark ? 'hsl(var(--card))' : 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: 128,
                      marginTop: 16,
                      width: '100%',
                      maxWidth: 128,
                      margin: '16px auto 0',
                      borderRadius: 8,
                      boxShadow: '0px 10px 50px rgba(0,0,0,0.1)',
                    }}
                  >
                    {isDragActive ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          color: isDragReject
                            ? 'hsl(var(--destructive))'
                            : 'hsl(var(--primary))',
                        }}
                      >
                        <Text size="sm" fw={500}>
                          {isDragReject ? 'Invalid' : 'Drop it'}
                        </Text>
                        <IconUpload size={16} style={{ marginTop: 4 }} />
                      </motion.div>
                    ) : (
                      <IconUpload
                        size={16}
                        style={{ color: 'hsl(var(--muted-foreground))' }}
                      />
                    )}
                  </motion.div>

                  {/* Dashed border shadow */}
                  <motion.div
                    variants={secondaryVariant}
                    style={{
                      position: 'absolute',
                      opacity: 0,
                      border: '1px dashed hsl(var(--primary) / 0.5)',
                      inset: 0,
                      zIndex: 30,
                      backgroundColor: 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: 128,
                      marginTop: 16,
                      width: '100%',
                      maxWidth: 128,
                      margin: '16px auto 0',
                      borderRadius: 8,
                      left: '50%',
                      transform: 'translateX(-50%)',
                    }}
                  />
                </>
              )}
            </div>

            {/* File type hint */}
            <Text size="xs" c="dimmed" mt="lg" style={{ position: 'relative', zIndex: 20 }}>
              Accepts .gpkg and .geojson files up to 100MB
            </Text>
          </div>
        </motion.div>
      </div>

      {isUploading && (
        <Progress value={uploadProgress} className="h-2" />
      )}
    </Stack>
  );
}

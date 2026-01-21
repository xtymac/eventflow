/**
 * Import Versions React Query Hooks
 *
 * Provides hooks for GeoPackage/GeoJSON import with versioning,
 * validation, preview, publish, and rollback capabilities.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useCallback } from 'react';
import type { Feature } from 'geojson';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(errorBody.error || errorBody.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Types
export interface ImportVersion {
  id: string;
  versionNumber: number;
  status: 'draft' | 'published' | 'archived' | 'rolled_back';
  fileName: string;
  fileType: 'geojson' | 'geopackage';
  filePath: string;
  layerName: string | null;
  sourceCRS: string | null;
  importScope: string;
  regionalRefresh: boolean;  // If true, deactivate roads in scope not in import
  defaultDataSource: string;
  fileSizeMB: string | null;
  featureCount: number;
  uploadedBy: string | null;
  uploadedAt: string;
  publishedAt: string | null;
  publishedBy: string | null;
  archivedAt: string | null;
  rolledBackAt: string | null;  // When this version was rolled back (soft deleted)
  snapshotPath: string | null;
  diffPath: string | null;
  notes: string | null;
  sourceExportId: string | null;  // Links to export_records for precise comparison
  // Stats for timeline display (populated at publish time)
  addedCount: number | null;
  updatedCount: number | null;
  deactivatedCount: number | null;
}

export interface ImportJob {
  id: string;
  versionId: string;
  jobType: 'validation' | 'publish' | 'rollback';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  resultSummary: Record<string, unknown> | null;
}

export interface LayerInfo {
  name: string;
  featureCount: number;
  geometryType: string;
}

export interface ValidationError {
  featureIndex: number;
  featureId?: string;
  field: string;
  error: string;
  hint: string;
}

export interface ValidationWarning {
  featureIndex: number;
  featureId?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  featureCount: number;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  geometryTypes: string[];
  missingIdCount: number;
  missingDataSourceCount: number;
}

export interface DiffStats {
  scopeCurrentCount: number;
  importCount: number;
  addedCount: number;
  updatedCount: number;
  deactivatedCount: number;
}

export interface DiffResult {
  scope: string;
  regionalRefresh: boolean;  // Whether regional refresh mode is enabled
  comparisonMode: 'precise' | 'bbox';  // 'precise' when using export record, 'bbox' otherwise
  sourceExportId?: string;  // Export record ID when using precise comparison
  added: Feature[];
  updated: Feature[];
  deactivated: Feature[];
  unchanged: number;
  stats: DiffStats;
}

export interface ConfigureRequest {
  layerName?: string;
  sourceCRS?: string;
  // importScope is auto-calculated from file bounding box by backend
  defaultDataSource: 'osm_test' | 'official_ledger' | 'manual';
  regionalRefresh?: boolean;  // If true, deactivate roads in scope not in import
}

// ============================================
// Query Hooks
// ============================================

/**
 * List import versions with optional filtering
 */
export function useImportVersions(options?: {
  status?: string;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}) {
  const params = new URLSearchParams();
  if (options?.status) params.append('status', options.status);
  if (options?.limit) params.append('limit', String(options.limit));
  if (options?.offset) params.append('offset', String(options.offset));
  const queryString = params.toString() ? `?${params.toString()}` : '';

  return useQuery({
    queryKey: ['import-versions', options?.status, options?.limit, options?.offset],
    queryFn: () =>
      fetchApi<{ data: ImportVersion[]; total: number }>(`/import/versions${queryString}`),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Get a single import version by ID
 */
export function useImportVersion(id: string | null) {
  return useQuery({
    queryKey: ['import-version', id],
    queryFn: () => fetchApi<{ data: ImportVersion }>(`/import/versions/${id}`),
    enabled: !!id,
  });
}

/**
 * Get layers from a GeoPackage file
 */
export function useImportVersionLayers(id: string | null) {
  return useQuery({
    queryKey: ['import-version-layers', id],
    queryFn: () => fetchApi<{ data: LayerInfo[] }>(`/import/versions/${id}/layers`),
    enabled: !!id,
  });
}

/**
 * Get validation results for a version
 */
export function useValidationResults(versionId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['import-validation', versionId],
    queryFn: () => fetchApi<{ data: ValidationResult }>(`/import/versions/${versionId}/validation`),
    enabled: (options?.enabled ?? true) && !!versionId,
  });
}

/**
 * Get diff preview for a version
 */
export function useDiffPreview(versionId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['import-preview', versionId],
    queryFn: () => fetchApi<{ data: DiffResult }>(`/import/versions/${versionId}/preview`),
    enabled: (options?.enabled ?? true) && !!versionId,
  });
}

/**
 * Get historical diff for a published version
 * Returns the changes that were made when this version was published.
 */
export function useHistoricalDiff(versionId: string | null) {
  return useQuery({
    queryKey: ['import-history', versionId],
    queryFn: () => fetchApi<{ data: DiffResult }>(`/import/versions/${versionId}/history`),
    enabled: !!versionId,
    staleTime: Infinity, // Diff is immutable, no need to refetch
    retry: false, // Don't retry on 404 (old versions without history)
  });
}

/**
 * Get a job by ID (for manual polling)
 */
export function useImportJob(jobId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['import-job', jobId],
    queryFn: () => fetchApi<{ data: ImportJob }>(`/import/versions/jobs/${jobId}`),
    enabled: (options?.enabled ?? true) && !!jobId,
  });
}

/**
 * Poll a job until completion
 */
export function useImportJobPolling(
  jobId: string | null,
  options?: {
    onComplete?: (job: ImportJob) => void;
    onError?: (job: ImportJob) => void;
    pollingInterval?: number;
  }
) {
  const onCompleteRef = useRef(options?.onComplete);
  const onErrorRef = useRef(options?.onError);
  onCompleteRef.current = options?.onComplete;
  onErrorRef.current = options?.onError;

  const query = useQuery({
    queryKey: ['import-job-polling', jobId],
    queryFn: () => fetchApi<{ data: ImportJob }>(`/import/versions/jobs/${jobId}`),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const job = query.state.data?.data;
      // Stop polling when job is complete or failed
      if (job?.status === 'completed' || job?.status === 'failed') {
        return false;
      }
      return options?.pollingInterval ?? 1000; // Poll every second by default
    },
  });

  // Handle completion/error callbacks
  useEffect(() => {
    const job = query.data?.data;
    if (!job) return;

    if (job.status === 'completed' && onCompleteRef.current) {
      onCompleteRef.current(job);
    } else if (job.status === 'failed' && onErrorRef.current) {
      onErrorRef.current(job);
    }
  }, [query.data?.data?.status]);

  return query;
}

// ============================================
// Mutation Hooks
// ============================================

/**
 * Upload a GeoPackage or GeoJSON file
 */
export function useUploadImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE}/import/versions/upload`, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type - browser will set it with boundary
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorBody.error || errorBody.message || `HTTP ${response.status}`);
      }

      return response.json() as Promise<{ data: ImportVersion }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-versions'] });
    },
  });
}

/**
 * Configure an import version (layer, CRS, dataSource)
 * Import scope is auto-calculated from file bounding box.
 */
export function useConfigureImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, config }: { id: string; config: ConfigureRequest }) => {
      const result = await fetchApi<{ data: ImportVersion }>(`/import/versions/${id}/configure`, {
        method: 'POST',
        body: JSON.stringify(config),
      });
      return result.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['import-versions'] });
      queryClient.invalidateQueries({ queryKey: ['import-version', variables.id] });
    },
  });
}

/**
 * Trigger validation for a version (async job)
 */
export function useTriggerValidation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (versionId: string) => {
      const result = await fetchApi<{ data: ImportJob }>(`/import/versions/${versionId}/validate`, {
        method: 'POST',
        body: JSON.stringify({}), // Empty body to satisfy Content-Type: application/json
      });
      return result.data;
    },
    onSuccess: (_, versionId) => {
      // Invalidate validation cache so next fetch gets fresh results
      queryClient.invalidateQueries({ queryKey: ['import-validation', versionId] });
    },
  });
}

/**
 * Publish a version (async job)
 */
export function usePublishVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (versionId: string) => {
      const result = await fetchApi<{ data: ImportJob }>(`/import/versions/${versionId}/publish`, {
        method: 'POST',
        body: JSON.stringify({}), // Empty body to satisfy Content-Type: application/json
      });
      return result.data;
    },
    onSuccess: () => {
      // Only invalidate import-versions here, NOT assets
      // Assets will be invalidated after the job completes in the component
      queryClient.invalidateQueries({ queryKey: ['import-versions'] });
    },
  });
}

/**
 * Rollback to a version (async job)
 */
export function useRollbackVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (versionId: string) => {
      const result = await fetchApi<{ data: ImportJob }>(`/import/versions/${versionId}/rollback`, {
        method: 'POST',
        body: JSON.stringify({}), // Empty body to satisfy Content-Type: application/json
      });
      return result.data;
    },
    onSuccess: () => {
      // Only invalidate import-versions here, NOT assets
      // Assets will be invalidated after the job completes in the component
      queryClient.invalidateQueries({ queryKey: ['import-versions'] });
    },
  });
}

/**
 * Delete a draft version
 */
export function useDeleteImportVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await fetchApi<{ success: boolean }>(`/import/versions/${id}`, {
        method: 'DELETE',
      });
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-versions'] });
    },
  });
}

// ============================================
// Utility Hooks
// ============================================

/**
 * Combined hook for managing the full import workflow
 */
export function useImportWorkflow() {
  const queryClient = useQueryClient();
  const uploadMutation = useUploadImport();
  const configureMutation = useConfigureImport();
  const triggerValidationMutation = useTriggerValidation();
  const publishMutation = usePublishVersion();
  const rollbackMutation = useRollbackVersion();
  const deleteMutation = useDeleteImportVersion();

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['import-versions'] });
    queryClient.invalidateQueries({ queryKey: ['assets'] });
  }, [queryClient]);

  return {
    upload: uploadMutation,
    configure: configureMutation,
    triggerValidation: triggerValidationMutation,
    publish: publishMutation,
    rollback: rollbackMutation,
    delete: deleteMutation,
    invalidateAll,
    isLoading:
      uploadMutation.isPending ||
      configureMutation.isPending ||
      triggerValidationMutation.isPending ||
      publishMutation.isPending ||
      rollbackMutation.isPending ||
      deleteMutation.isPending,
  };
}

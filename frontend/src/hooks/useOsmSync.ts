/**
 * OSM Sync React Query Hooks
 *
 * Provides hooks for interacting with the OSM sync API.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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
export interface BBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export interface SyncResult {
  logId: string;
  status: 'completed' | 'failed' | 'partial';
  osmRoadsFetched: number;
  roadsCreated: number;
  roadsUpdated: number;
  roadsMarkedInactive: number;
  roadsSkipped: number;
  errors: string[];
}

export interface SyncLog {
  id: string;
  syncType: string;
  bboxParam: string | null;
  wardParam: string | null;
  status: string;
  startedAt: string;
  completedAt: string | null;
  osmRoadsFetched: number | null;
  roadsCreated: number | null;
  roadsUpdated: number | null;
  roadsMarkedInactive: number | null;
  roadsSkipped: number | null;
  errorMessage: string | null;
  triggeredBy: string | null;
  createdAt: string | null;
}

export interface SyncStatus {
  runningSyncs: number;
  lastSyncAt: string | null;
  totalRoadsWithOsmId: number;
}

/**
 * Sync roads in a specific bbox
 */
export function useOsmSyncBbox() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bbox: BBox) => {
      const result = await fetchApi<{ data: SyncResult }>('/osm-sync/bbox', {
        method: 'POST',
        body: JSON.stringify({ bbox, triggeredBy: 'frontend-user' }),
      });
      return result.data;
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['osm-sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['osm-sync-logs'] });
    },
  });
}

/**
 * Sync roads for a specific ward
 */
export function useOsmSyncWard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (wardName: string) => {
      const result = await fetchApi<{ data: SyncResult }>(`/osm-sync/ward/${encodeURIComponent(wardName)}`, {
        method: 'POST',
      });
      return result.data;
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['osm-sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['osm-sync-logs'] });
    },
  });
}

/**
 * Get OSM sync status
 */
export function useOsmSyncStatus(options?: { enabled?: boolean; refetchInterval?: number }) {
  return useQuery({
    queryKey: ['osm-sync-status'],
    queryFn: async () => {
      const result = await fetchApi<{ data: SyncStatus }>('/osm-sync/status');
      return result.data;
    },
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval ?? 10000, // Refresh every 10 seconds
  });
}

/**
 * Get OSM sync logs with pagination
 */
export function useOsmSyncLogs(limit = 20, offset = 0, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['osm-sync-logs', limit, offset],
    queryFn: async () => {
      const result = await fetchApi<{
        data: SyncLog[];
        meta: { total: number; limit: number; offset: number };
      }>(`/osm-sync/logs?limit=${limit}&offset=${offset}`);
      return result;
    },
    enabled: options?.enabled ?? true,
  });
}

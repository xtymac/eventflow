import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ConstructionEvent,
  RoadAsset,
  InspectionRecord,
  EventFilters,
  AssetFilters,
  CreateEventRequest,
  UpdateEventRequest,
} from '@nagoya/shared';

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
    // Backend returns { error: '...' }, fallback to message or HTTP status
    throw new Error(errorBody.error || errorBody.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Events hooks
export function useEvents(filters?: EventFilters, options?: { enabled?: boolean }) {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        // Convert boolean to string for URL params
        params.append(key, typeof value === 'boolean' ? String(value) : value);
      }
    });
  }
  const queryString = params.toString() ? `?${params.toString()}` : '';

  return useQuery({
    queryKey: ['events', filters],
    queryFn: () => fetchApi<{ data: ConstructionEvent[]; meta: { total: number; archivedCount: number } }>(`/events${queryString}`),
    enabled: options?.enabled ?? true,
  });
}

export function useEvent(id: string | null) {
  return useQuery({
    queryKey: ['event', id],
    queryFn: () => fetchApi<{ data: ConstructionEvent }>(`/events/${id}`),
    enabled: !!id,
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateEventRequest) =>
      fetchApi<{ data: ConstructionEvent }>('/events', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEventRequest }) =>
      fetchApi<{ data: ConstructionEvent }>(`/events/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event', variables.id] });
    },
  });
}

export function useChangeEventStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'ended' }) =>
      fetchApi<{ data: ConstructionEvent }>(`/events/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event', variables.id] });
    },
  });
}

export function useSetPostEndDecision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'no-change' | 'permanent-change' }) =>
      fetchApi<{ data: ConstructionEvent }>(`/events/${id}/decision`, {
        method: 'PATCH',
        body: JSON.stringify({ decision }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event', variables.id] });
    },
  });
}

export function useCancelEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      fetchApi<{ data: ConstructionEvent }>(`/events/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event', id] });
    },
  });
}

export function useArchiveEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      fetchApi<{ data: ConstructionEvent }>(`/events/${id}/archive`, {
        method: 'PATCH',
        body: JSON.stringify({}), // Empty body required for Content-Type: application/json
      }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event', id] });
    },
  });
}

export function useUnarchiveEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      fetchApi<{ data: ConstructionEvent }>(`/events/${id}/unarchive`, {
        method: 'PATCH',
        body: JSON.stringify({}), // Empty body required for Content-Type: application/json
      }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event', id] });
    },
  });
}

export function useEventIntersectingAssets(eventId: string | null) {
  return useQuery({
    queryKey: ['event-intersecting-assets', eventId],
    queryFn: () => fetchApi<{ data: RoadAsset[] }>(`/events/${eventId}/intersecting-assets`),
    enabled: !!eventId,
  });
}

// Assets hooks
export function useWards() {
  return useQuery({
    queryKey: ['wards'],
    queryFn: () => fetchApi<{ data: string[] }>('/assets/wards'),
  });
}

export function useAssets(
  filters?: AssetFilters,
  options?: { enabled?: boolean }
) {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
  }
  const queryString = params.toString() ? `?${params.toString()}` : '';

  return useQuery({
    // Include ALL filter params in queryKey to avoid cache conflicts
    queryKey: [
      'assets',
      filters?.status,
      // Normalize roadType to string (array -> comma-separated) for stable cache key
      Array.isArray(filters?.roadType) ? filters.roadType.join(',') : filters?.roadType,
      filters?.ward,
      filters?.ownerDepartment,
      filters?.q,
      filters?.bbox,
      filters?.unnamed,
      filters?.limit,
      filters?.offset,
      filters?.includeTotal,
    ],
    queryFn: () =>
      fetchApi<{
        data: RoadAsset[];
        meta: { total: number | null; limit?: number; offset?: number };
      }>(`/assets${queryString}`),
    enabled: options?.enabled ?? true,
  });
}

export function useAsset(id: string | null) {
  return useQuery({
    queryKey: ['asset', id],
    queryFn: () => fetchApi<{ data: RoadAsset }>(`/assets/${id}`),
    enabled: !!id,
  });
}

export function useCreateAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<RoadAsset> & { eventId?: string }) =>
      fetchApi<{ data: RoadAsset }>('/assets', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });
}

export function useUpdateAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<RoadAsset> & { eventId?: string } }) =>
      fetchApi<{ data: RoadAsset }>(`/assets/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset', variables.id] });
    },
  });
}

export function useRetireAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, eventId, replacedBy }: { id: string; eventId: string; replacedBy?: string }) =>
      fetchApi<{ data: RoadAsset }>(`/assets/${id}/retire`, {
        method: 'PATCH',
        body: JSON.stringify({ eventId, replacedBy }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset', variables.id] });
    },
  });
}

// Inspections hooks
export function useInspections(eventId?: string, roadAssetId?: string) {
  const params = new URLSearchParams();
  if (eventId) params.append('eventId', eventId);
  if (roadAssetId) params.append('roadAssetId', roadAssetId);
  const queryString = params.toString() ? `?${params.toString()}` : '';

  return useQuery({
    queryKey: ['inspections', eventId, roadAssetId],
    queryFn: () => fetchApi<{ data: InspectionRecord[]; meta: { total: number } }>(`/inspections${queryString}`),
  });
}

export function useCreateInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<InspectionRecord>) =>
      fetchApi<{ data: InspectionRecord }>('/inspections', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
    },
  });
}

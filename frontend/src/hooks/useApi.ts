import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import * as turf from '@turf/turf';
import type {
  ConstructionEvent,
  RoadAsset,
  RiverAsset,
  GreenSpaceAsset,
  StreetLightAsset,
  InspectionRecord,
  EventFilters,
  AssetFilters,
  RiverFilters,
  GreenSpaceFilters,
  StreetLightFilters,
  CreateEventRequest,
  UpdateEventRequest,
} from '@nagoya/shared';
import type { FeatureCollection, Geometry, Point } from 'geojson';

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

// Maximum bbox area in square meters for streetlights (matches backend limit)
const STREETLIGHTS_MAX_BBOX_AREA_M2 = 2_000_000;

// Calculate bbox area in square meters from "west,south,east,north" string
function calculateBboxAreaM2(bbox: string): number | null {
  const parts = bbox.split(',').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return null;

  const [west, south, east, north] = parts;
  const polygon = turf.bboxPolygon([west, south, east, north]);
  return turf.area(polygon);
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
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'pending_review' | 'closed' }) =>
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

export function useCancelEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      fetchApi<{ data: ConstructionEvent }>(`/events/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({}), // Empty body required for Content-Type: application/json
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
    // Keep previous data while fetching new data to prevent UI flickering
    placeholderData: keepPreviousData,
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

// Export types
export type ExportFormat = 'gpkg' | 'geojson';

export interface ExportResult {
  filename: string;
  size: number;
}

// Export road assets as GeoPackage or GeoJSON
export function useExportAssets() {
  return useMutation({
    mutationFn: async (format: ExportFormat = 'gpkg'): Promise<ExportResult> => {
      const endpoint = format === 'gpkg' ? '/export/geopackage' : '/export/geojson';
      const response = await fetch(`${API_BASE}${endpoint}?type=assets`);

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorBody.error || `Export failed: HTTP ${response.status}`);
      }

      // Get filename from Content-Disposition header
      const disposition = response.headers.get('Content-Disposition');
      const filenameMatch = disposition?.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] || `road-assets.${format}`;

      // Trigger download
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return { filename, size: blob.size };
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

export function useInspection(id: string | null) {
  return useQuery({
    queryKey: ['inspection', id],
    queryFn: () => fetchApi<{ data: InspectionRecord }>(`/inspections/${id}`),
    enabled: !!id,
  });
}

export function useUpdateInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InspectionRecord> }) =>
      fetchApi<{ data: InspectionRecord }>(`/inspections/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      queryClient.invalidateQueries({ queryKey: ['inspection', variables.id] });
    },
  });
}

export function useDeleteInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      fetchApi<void>(`/inspections/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
    },
  });
}

// Recent edits types and hooks
export interface RecentEdit {
  id: string;
  roadAssetId: string;
  editType: 'create' | 'update' | 'delete';
  roadName: string | null;
  roadDisplayName: string | null;
  roadWard: string | null;
  roadType: string | null;
  centroid: { type: 'Point'; coordinates: [number, number] };
  bbox: [number, number, number, number];
  editSource: string | null;
  editedAt: string;
}

export function useRecentEdits(options?: { limit?: number }) {
  const limit = options?.limit ?? 10;

  return useQuery({
    queryKey: ['recent-edits', limit],
    queryFn: () =>
      fetchApi<{
        data: RecentEdit[];
        meta: { total: number; hasMore: boolean };
      }>(`/assets/recent-edits?limit=${limit}`),
    refetchInterval: 30000, // Fallback: auto-refresh every 30 seconds (SSE is primary)
  });
}

// SSE hook for real-time road edit notifications
export function useRoadEditSSE(options?: { onEdit?: (edit: { id: string; roadAssetId: string; editType: string; roadName: string | null; roadDisplayName: string | null }) => void }) {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Use ref for callback to avoid infinite loop (options object changes every render)
  const onEditRef = useRef(options?.onEdit);
  onEditRef.current = options?.onEdit;

  useEffect(() => {
    const connect = () => {
      // Clean up existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const sseUrl = `${API_BASE}/sse/road-edits`;
      const eventSource = new EventSource(sseUrl);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('SSE connected for road edit notifications');
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Skip connection/heartbeat messages
          if (data.type === 'connected') {
            return;
          }

          // Debounce invalidation to prevent flood during bulk operations (e.g., import publish)
          // Only invalidate once after 500ms of no new messages
          if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
          }
          debounceTimeoutRef.current = setTimeout(() => {
            // Road edit received - invalidate query to refresh data
            queryClient.invalidateQueries({ queryKey: ['recent-edits'] });
            // Also invalidate assets query since a road was edited
            queryClient.invalidateQueries({ queryKey: ['assets'] });
            debounceTimeoutRef.current = null;
          }, 500);

          // Call optional callback via ref (not debounced)
          if (onEditRef.current && data.id) {
            onEditRef.current(data);
          }
        } catch (err) {
          console.error('Failed to parse SSE message:', err);
        }
      };

      eventSource.onerror = () => {
        console.warn('SSE connection error, will reconnect...');
        eventSource.close();
        eventSourceRef.current = null;

        // Reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 5000);
      };
    };

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
    };
  }, [queryClient]); // Only depend on queryClient, not options

  return {
    isConnected: !!eventSourceRef.current,
  };
}

// ============================================
// Rivers hooks
// ============================================

export function useRiversInBbox(
  bbox: string | null,
  filters?: Omit<RiverFilters, 'bbox'>,
  options?: { enabled?: boolean; zoom?: number }
) {
  const params = new URLSearchParams();
  if (bbox) params.append('bbox', bbox);
  if (options?.zoom) params.append('zoom', String(Math.floor(options.zoom)));
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
  }
  const queryString = params.toString() ? `?${params.toString()}` : '';

  return useQuery({
    queryKey: ['rivers', bbox, options?.zoom, filters?.waterwayType, filters?.geometryType, filters?.ward, filters?.dataSource],
    queryFn: () =>
      fetchApi<FeatureCollection<Geometry, RiverAsset>>(`/rivers${queryString}`),
    enabled: (options?.enabled ?? true) && !!bbox,
    staleTime: 60000, // 1 minute
    placeholderData: keepPreviousData,
  });
}

export function useRiver(id: string | null) {
  return useQuery({
    queryKey: ['river', id],
    queryFn: () =>
      fetchApi<{ type: 'Feature'; properties: RiverAsset; geometry: Geometry }>(`/rivers/${id}`),
    enabled: !!id,
  });
}

export function useRiverWards() {
  return useQuery({
    queryKey: ['river-wards'],
    queryFn: () => fetchApi<{ data: string[] }>('/rivers/wards'),
  });
}

// ============================================
// Green Spaces hooks
// ============================================

export function useGreenSpacesInBbox(
  bbox: string | null,
  filters?: Omit<GreenSpaceFilters, 'bbox'>,
  options?: { enabled?: boolean; zoom?: number }
) {
  const params = new URLSearchParams();
  if (bbox) params.append('bbox', bbox);
  if (options?.zoom) params.append('zoom', String(Math.floor(options.zoom)));
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
  }
  const queryString = params.toString() ? `?${params.toString()}` : '';

  return useQuery({
    queryKey: ['greenspaces', bbox, options?.zoom, filters?.greenSpaceType, filters?.ward, filters?.dataSource, filters?.minArea],
    queryFn: () =>
      fetchApi<FeatureCollection<Geometry, GreenSpaceAsset>>(`/greenspaces${queryString}`),
    enabled: (options?.enabled ?? true) && !!bbox,
    staleTime: 60000,
    placeholderData: keepPreviousData,
  });
}

export function useGreenSpace(id: string | null) {
  return useQuery({
    queryKey: ['greenspace', id],
    queryFn: () =>
      fetchApi<{ type: 'Feature'; properties: GreenSpaceAsset; geometry: Geometry }>(`/greenspaces/${id}`),
    enabled: !!id,
  });
}

export function useGreenSpaceWards() {
  return useQuery({
    queryKey: ['greenspace-wards'],
    queryFn: () => fetchApi<{ data: string[] }>('/greenspaces/wards'),
  });
}

// ============================================
// Street Lights hooks
// ============================================

export function useStreetLightsInBbox(
  bbox: string | null,
  filters?: Omit<StreetLightFilters, 'bbox'>,
  options?: { enabled?: boolean }
) {
  const params = new URLSearchParams();
  if (bbox) params.append('bbox', bbox);
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
  }
  const queryString = params.toString() ? `?${params.toString()}` : '';

  // Check if bbox area is within limit to avoid 400 errors
  const bboxArea = bbox ? calculateBboxAreaM2(bbox) : null;
  const isAreaWithinLimit = bboxArea !== null && bboxArea <= STREETLIGHTS_MAX_BBOX_AREA_M2;

  return useQuery({
    queryKey: ['streetlights', bbox, filters?.lampType, filters?.lampStatus, filters?.ward, filters?.dataSource],
    queryFn: () =>
      fetchApi<FeatureCollection<Point, StreetLightAsset>>(`/streetlights${queryString}`),
    enabled: (options?.enabled ?? true) && !!bbox && isAreaWithinLimit,
    staleTime: 60000,
    placeholderData: keepPreviousData,
  });
}

export function useStreetLight(id: string | null) {
  return useQuery({
    queryKey: ['streetlight', id],
    queryFn: () =>
      fetchApi<{ type: 'Feature'; properties: StreetLightAsset; geometry: Point }>(`/streetlights/${id}`),
    enabled: !!id,
  });
}

export function useStreetLightWards() {
  return useQuery({
    queryKey: ['streetlight-wards'],
    queryFn: () => fetchApi<{ data: string[] }>('/streetlights/wards'),
  });
}

// ============================================
// Street Trees hooks
// ============================================

import type {
  StreetTreeAsset,
  StreetTreeFilters,
  ParkFacilityAsset,
  ParkFacilityFilters,
  PavementSectionAsset,
  PavementSectionFilters,
  PumpStationAsset,
  PumpStationFilters,
  LifecyclePlan,
  LifecyclePlanFilters,
} from '@nagoya/shared';

export function useStreetTreesInBbox(
  bbox: string | null,
  filters?: Omit<StreetTreeFilters, 'bbox'>,
  options?: { enabled?: boolean }
) {
  const params = new URLSearchParams();
  if (bbox) params.append('bbox', bbox);
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
  }
  const queryString = params.toString() ? `?${params.toString()}` : '';

  return useQuery({
    queryKey: ['street-trees', bbox, filters?.category, filters?.healthStatus, filters?.conditionGrade, filters?.ward],
    queryFn: () =>
      fetchApi<FeatureCollection<Point, StreetTreeAsset>>(`/street-trees${queryString}`),
    enabled: (options?.enabled ?? true) && !!bbox,
    staleTime: 60000,
    placeholderData: keepPreviousData,
  });
}

export function useStreetTree(id: string | null) {
  return useQuery({
    queryKey: ['street-tree', id],
    queryFn: () =>
      fetchApi<{ type: 'Feature'; properties: StreetTreeAsset; geometry: Point }>(`/street-trees/${id}`),
    enabled: !!id,
  });
}

// ============================================
// Park Facilities hooks
// ============================================

export function useParkFacilitiesInBbox(
  bbox: string | null,
  filters?: Omit<ParkFacilityFilters, 'bbox'>,
  options?: { enabled?: boolean }
) {
  const params = new URLSearchParams();
  if (bbox) params.append('bbox', bbox);
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
  }
  const queryString = params.toString() ? `?${params.toString()}` : '';

  return useQuery({
    queryKey: ['park-facilities', bbox, filters?.category, filters?.conditionGrade, filters?.greenSpaceRef, filters?.ward],
    queryFn: () =>
      fetchApi<FeatureCollection<Geometry, ParkFacilityAsset>>(`/park-facilities${queryString}`),
    enabled: (options?.enabled ?? true) && !!bbox,
    staleTime: 60000,
    placeholderData: keepPreviousData,
  });
}

export function useParkFacility(id: string | null) {
  return useQuery({
    queryKey: ['park-facility', id],
    queryFn: () =>
      fetchApi<{ type: 'Feature'; properties: ParkFacilityAsset; geometry: Geometry }>(`/park-facilities/${id}`),
    enabled: !!id,
  });
}

// ============================================
// Pavement Sections hooks
// ============================================

export function usePavementSectionsInBbox(
  bbox: string | null,
  filters?: Omit<PavementSectionFilters, 'bbox'>,
  options?: { enabled?: boolean; zoom?: number }
) {
  const params = new URLSearchParams();
  if (bbox) params.append('bbox', bbox);
  if (options?.zoom) params.append('zoom', String(Math.floor(options.zoom)));
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
  }
  const queryString = params.toString() ? `?${params.toString()}` : '';

  return useQuery({
    queryKey: ['pavement-sections', bbox, options?.zoom, filters?.pavementType, filters?.priorityRank, filters?.roadRef, filters?.ward],
    queryFn: () =>
      fetchApi<FeatureCollection<Geometry, PavementSectionAsset>>(`/pavement-sections${queryString}`),
    enabled: (options?.enabled ?? true) && !!bbox,
    staleTime: 60000,
    placeholderData: keepPreviousData,
  });
}

export function usePavementSection(id: string | null) {
  return useQuery({
    queryKey: ['pavement-section', id],
    queryFn: () =>
      fetchApi<{ type: 'Feature'; properties: PavementSectionAsset; geometry: Geometry }>(`/pavement-sections/${id}`),
    enabled: !!id,
  });
}

// ============================================
// Pump Stations hooks
// ============================================

export function usePumpStationsInBbox(
  bbox: string | null,
  filters?: Omit<PumpStationFilters, 'bbox'>,
  options?: { enabled?: boolean }
) {
  const params = new URLSearchParams();
  if (bbox) params.append('bbox', bbox);
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
  }
  const queryString = params.toString() ? `?${params.toString()}` : '';

  return useQuery({
    queryKey: ['pump-stations', bbox, filters?.category, filters?.equipmentStatus, filters?.conditionGrade, filters?.ward],
    queryFn: () =>
      fetchApi<FeatureCollection<Geometry, PumpStationAsset>>(`/pump-stations${queryString}`),
    enabled: (options?.enabled ?? true) && !!bbox,
    staleTime: 60000,
    placeholderData: keepPreviousData,
  });
}

export function usePumpStation(id: string | null) {
  return useQuery({
    queryKey: ['pump-station', id],
    queryFn: () =>
      fetchApi<{ type: 'Feature'; properties: PumpStationAsset; geometry: Geometry }>(`/pump-stations/${id}`),
    enabled: !!id,
  });
}

// ============================================
// Lifecycle Plans hooks (no bbox)
// ============================================

export function useLifecyclePlans(filters?: LifecyclePlanFilters) {
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
    queryKey: ['lifecycle-plans', filters?.assetType, filters?.planStatus, filters?.assetRef],
    queryFn: () =>
      fetchApi<{ data: LifecyclePlan[]; meta: { total: number | null; limit: number; offset: number } }>(`/lifecycle-plans${queryString}`),
    staleTime: 60000,
  });
}

export function useLifecyclePlan(id: string | null) {
  return useQuery({
    queryKey: ['lifecycle-plan', id],
    queryFn: () =>
      fetchApi<{ data: LifecyclePlan }>(`/lifecycle-plans/${id}`),
    enabled: !!id,
  });
}

// ============================================
// WorkOrders hooks (Phase 1)
// ============================================

import type { WorkOrder, Evidence, CloseEventRequest } from '@nagoya/shared';

export function useWorkOrders(eventId?: string) {
  const params = new URLSearchParams();
  if (eventId) params.append('eventId', eventId);
  const queryString = params.toString() ? `?${params.toString()}` : '';

  return useQuery({
    queryKey: ['workorders', eventId],
    queryFn: () => fetchApi<{ data: WorkOrder[]; meta: { total: number } }>(`/workorders${queryString}`),
  });
}

export function useWorkOrder(id: string | null) {
  return useQuery({
    queryKey: ['workorder', id],
    queryFn: () => fetchApi<{ data: WorkOrder }>(`/workorders/${id}`),
    enabled: !!id,
  });
}

export function useCreateWorkOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<WorkOrder>) =>
      fetchApi<{ data: WorkOrder }>('/workorders', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workorders'] });
      if (variables.eventId) {
        queryClient.invalidateQueries({ queryKey: ['workorders', variables.eventId] });
      }
    },
  });
}

export function useUpdateWorkOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetchApi<{ data: WorkOrder }>(`/workorders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workorders'] });
      queryClient.invalidateQueries({ queryKey: ['workorder', variables.id] });
    },
  });
}

// WorkOrder locations GeoJSON for map layer
export function useWorkOrderLocationsGeoJSON(eventId?: string) {
  const params = new URLSearchParams();
  if (eventId) params.append('eventId', eventId);
  const queryString = params.toString() ? `?${params.toString()}` : '';

  return useQuery({
    queryKey: ['workorder-locations-geojson', eventId],
    queryFn: () => fetchApi<FeatureCollection<Point>>(`/workorders/locations/geojson${queryString}`),
    staleTime: 30000, // 30 seconds
  });
}

// ============================================
// Evidence hooks (Phase 1)
// ============================================

export function useEvidence(workOrderId: string | null) {
  return useQuery({
    queryKey: ['evidence', workOrderId],
    queryFn: () => fetchApi<{ data: Evidence[] }>(`/workorders/${workOrderId}/evidence`),
    enabled: !!workOrderId,
  });
}

export function useUploadEvidence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workOrderId, formData }: { workOrderId: string; formData: FormData }) => {
      const response = await fetch(`${API_BASE}/workorders/${workOrderId}/evidence`, {
        method: 'POST',
        body: formData, // Don't set Content-Type - browser will set it with boundary
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorBody.error || errorBody.message || `HTTP ${response.status}`);
      }

      return response.json() as Promise<{ data: Evidence }>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['evidence', variables.workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['workorder', variables.workOrderId] });
    },
  });
}

export function useDeleteEvidence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ evidenceId }: { evidenceId: string }) =>
      fetchApi<void>(`/evidence/${evidenceId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
      queryClient.invalidateQueries({ queryKey: ['workorders'] });
    },
  });
}

// Make government decision on evidence (final verification)
export function useMakeEvidenceDecision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      evidenceId,
      decision,
      decisionNotes,
      userRole,
    }: {
      evidenceId: string;
      decision: 'accepted_by_authority' | 'rejected';
      decisionNotes?: string;
      userRole: string;
    }) =>
      fetchApi<{ data: Evidence }>(`/workorders/evidence/${evidenceId}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision, decisionNotes }),
        headers: {
          'X-User-Role': userRole,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence'] });
      queryClient.invalidateQueries({ queryKey: ['workorders'] });
      queryClient.invalidateQueries({ queryKey: ['workorder'] });
    },
  });
}

// ============================================
// Event Close hook (Phase 1 - Gov only)
// ============================================

export function useCloseEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data, userRole }: { id: string; data: CloseEventRequest; userRole: string }) =>
      fetchApi<{ data: ConstructionEvent }>(`/events/${id}/close`, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'X-User-Role': userRole,
        },
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event', variables.id] });
    },
  });
}

// ============================================
// List-page hooks (non-map, Nagoya-wide bbox)
// ============================================

const NAGOYA_BBOX = '136.7,35.0,137.2,35.4';

export function useAllGreenSpaces(filters?: Omit<GreenSpaceFilters, 'bbox'>) {
  return useGreenSpacesInBbox(NAGOYA_BBOX, { ...filters, limit: 5000 } as Omit<GreenSpaceFilters, 'bbox'>, { enabled: true });
}

export function useAllParkFacilities(filters?: Omit<ParkFacilityFilters, 'bbox'>) {
  return useParkFacilitiesInBbox(NAGOYA_BBOX, { ...filters, limit: 1000 } as Omit<ParkFacilityFilters, 'bbox'>, { enabled: true });
}

export function useParkFacilitiesByPark(greenSpaceId: string | null) {
  return useParkFacilitiesInBbox(
    greenSpaceId ? NAGOYA_BBOX : null,
    greenSpaceId ? { greenSpaceRef: greenSpaceId } : undefined,
    { enabled: !!greenSpaceId }
  );
}

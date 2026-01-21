import { useInfiniteQuery } from '@tanstack/react-query';
import type { RoadAsset } from '@nagoya/shared';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const LIMIT = 100;

interface UseInfiniteAssetsParams {
  ward?: string;
  roadType?: string;
  q?: string;
  bbox?: string;
  enabled?: boolean;
}

interface AssetsResponse {
  data: RoadAsset[];
  meta: {
    total: number | null;
    limit: number;
    offset: number;
  };
}

async function fetchAssets(params: {
  status?: string;
  ward?: string;
  roadType?: string;
  q?: string;
  bbox?: string;
  offset: number;
  limit: number;
  includeTotal: boolean;
}): Promise<AssetsResponse> {
  const searchParams = new URLSearchParams();

  if (params.status) searchParams.append('status', params.status);
  if (params.ward) searchParams.append('ward', params.ward);
  if (params.roadType) searchParams.append('roadType', params.roadType);
  if (params.q) searchParams.append('q', params.q);
  if (params.bbox) searchParams.append('bbox', params.bbox);
  searchParams.append('offset', String(params.offset));
  searchParams.append('limit', String(params.limit));
  searchParams.append('includeTotal', String(params.includeTotal));

  const response = await fetch(`${API_BASE}/assets?${searchParams.toString()}`, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export function useInfiniteAssets(params: UseInfiniteAssetsParams) {
  const { ward, roadType, q, bbox, enabled = true } = params;

  return useInfiniteQuery({
    // queryKey includes all filter params - any change triggers a fresh request
    queryKey: ['infinite-assets', { ward, roadType, q, bbox }],
    queryFn: async ({ pageParam }) => {
      const response = await fetchAssets({
        status: 'active', // Always filter to active assets only
        ward: ward || undefined,
        roadType: roadType || undefined,
        q: q || undefined,
        bbox: bbox || undefined,
        offset: pageParam,
        limit: LIMIT,
        includeTotal: true, // Always request total for correct pagination
      });
      return response;
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.flatMap((p) => p.data).length;
      const total = lastPage.meta.total;
      // total is always present because includeTotal: true
      if (total === null || loaded >= total) return undefined;
      return loaded; // Return the next offset
    },
    initialPageParam: 0,
    enabled,
  });
}

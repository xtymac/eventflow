import { useQuery } from '@tanstack/react-query';
import { useDebounce } from 'use-debounce';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export interface ParkSearchResult {
  id: string;
  name: string;
  address: string | null;
  coordinates: [number, number] | null;
  areaSqm: number;
  status: string;
  geometry: GeoJSON.Geometry;
}

export interface FacilitySearchResult {
  id: string;
  name: string;
  assetCategory: string;
  parkId: string;
  parkName: string | null;
  coordinates: [number, number] | null;
  status: string;
  conditionScore: string | null;
  lastInspectionAt: string | null;
  facilityId: string | null;
  ward: string | null;
  geometry: GeoJSON.Geometry;
}

interface SearchResponse {
  success: boolean;
  data: {
    query: string;
    parks: ParkSearchResult[];
    facilities: FacilitySearchResult[];
  };
}

interface SuggestionsResponse {
  success: boolean;
  data: {
    parks: ParkSearchResult[];
    facilities: FacilitySearchResult[];
  };
}

async function fetchParkSearch(query: string, limit = 10): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const res = await fetch(`${API_BASE}/park-search/search?${params}`);
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  return res.json();
}

async function fetchSuggestions(limit = 4): Promise<SuggestionsResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  const res = await fetch(`${API_BASE}/park-search/suggestions?${params}`);
  if (!res.ok) throw new Error(`Suggestions failed: ${res.status}`);
  return res.json();
}

export function useParkSearch(query: string, options?: { enabled?: boolean; debounceMs?: number }) {
  const { enabled = true, debounceMs = 150 } = options ?? {};
  const [debouncedQuery] = useDebounce(query, debounceMs);
  const trimmed = debouncedQuery.trim();
  const shouldSearch = enabled && trimmed.length >= 1;

  return useQuery({
    queryKey: ['park-search', trimmed],
    queryFn: () => fetchParkSearch(trimmed),
    enabled: shouldSearch,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
    retry: 1,
  });
}

export function useParkSuggestions(options?: { enabled?: boolean }) {
  const { enabled = true } = options ?? {};

  return useQuery({
    queryKey: ['park-search-suggestions'],
    queryFn: () => fetchSuggestions(4),
    enabled,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

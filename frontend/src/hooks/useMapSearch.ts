import { useQuery } from '@tanstack/react-query';
import { useDebouncedValue } from '@mantine/hooks';
import type { SearchResponse } from '@nagoya/shared';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function fetchSearch(query: string): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query.trim() });
  const response = await fetch(`${API_BASE}/search/geocode?${params}`);

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: 'Search failed' }));
    throw new Error(errorBody.error || errorBody.message || `HTTP ${response.status}`);
  }

  return response.json();
}

interface UseMapSearchOptions {
  enabled?: boolean;
  debounceMs?: number;
  minQueryLength?: number;
}

/**
 * Hook for unified map search (places, events, assets)
 * Debounces the query and caches results
 */
export function useMapSearch(query: string, options?: UseMapSearchOptions) {
  const {
    enabled = true,
    debounceMs = 300,
    minQueryLength = 2,
  } = options || {};

  const [debouncedQuery] = useDebouncedValue(query, debounceMs);

  const shouldFetch = enabled && debouncedQuery.trim().length >= minQueryLength;

  return useQuery({
    queryKey: ['map-search', debouncedQuery],
    queryFn: () => fetchSearch(debouncedQuery),
    enabled: shouldFetch,
    staleTime: 60000, // Cache for 1 minute
    placeholderData: (previousData) => previousData, // Keep previous data while loading
    retry: 1, // Only retry once on failure
  });
}

// Re-export types for convenience
export type { SearchResponse, SearchResult, SearchResultType } from '@nagoya/shared';

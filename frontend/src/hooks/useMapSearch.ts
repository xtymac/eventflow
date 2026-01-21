import { useQuery } from '@tanstack/react-query';
import { useDebouncedValue } from '@mantine/hooks';
import type { SearchResponse } from '@nagoya/shared';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface SearchContext {
  bbox?: string;
  mapCenter?: [number, number];
  mapZoom?: number;
  view?: 'events' | 'assets' | 'inspections';
  limit?: number;
  locale?: string;
}

async function fetchSearch(query: string, context?: SearchContext): Promise<SearchResponse> {
  const payload = {
    query: query.trim(),
    ...context,
  };
  const response = await fetch(`${API_BASE}/search/nl`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

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
export function useMapSearch(query: string, options?: UseMapSearchOptions & { context?: SearchContext }) {
  const {
    enabled = true,
    debounceMs = 300,
    minQueryLength = 2,
    context,
  } = options || {};

  const [debouncedQuery] = useDebouncedValue(query, debounceMs);

  const shouldFetch = enabled && debouncedQuery.trim().length >= minQueryLength;

  return useQuery({
    queryKey: [
      'map-search',
      debouncedQuery,
      context?.bbox,
      context?.mapCenter?.[0],
      context?.mapCenter?.[1],
      context?.mapZoom,
      context?.view,
      context?.limit,
      context?.locale,
    ],
    queryFn: () => fetchSearch(debouncedQuery, context),
    enabled: shouldFetch,
    staleTime: 60000, // Cache for 1 minute
    placeholderData: (previousData) => previousData, // Keep previous data while loading
    retry: 1, // Only retry once on failure
  });
}

// Re-export types for convenience
export type { SearchResponse, SearchResult, SearchResultType } from '@nagoya/shared';

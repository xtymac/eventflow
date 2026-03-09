import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SearchResult } from '@nagoya/shared';

export type SearchHistoryResult = Pick<
  SearchResult,
  'id' | 'type' | 'name' | 'subtitle' | 'coordinates' | 'geometry' | 'sourceId' | 'metadata'
>;

export interface SearchHistoryEntry {
  key: string; // `${type}:${sourceId ?? id}`
  result: SearchHistoryResult;
  timestamp: number;
}

const MAX_HISTORY = 10;

interface SearchState {
  // Search input state
  query: string;
  isOpen: boolean;

  // Search results center (for coordinate search)
  searchCenter: [number, number] | null;

  // Selected result ID (for highlighting)
  selectedResultId: string | null;

  // Persisted search history
  searchHistory: SearchHistoryEntry[];

  // Actions
  setQuery: (query: string) => void;
  setIsOpen: (isOpen: boolean) => void;
  setSearchCenter: (center: [number, number] | null) => void;
  selectResult: (id: string | null) => void;
  clearSearch: () => void;
  addToHistory: (result: SearchHistoryResult) => void;
  clearHistory: () => void;
}

export const useSearchStore = create<SearchState>()(
  persist(
    (set) => ({
      query: '',
      isOpen: false,
      searchCenter: null,
      selectedResultId: null,
      searchHistory: [],

      setQuery: (query) => set({ query }),
      setIsOpen: (isOpen) => set({ isOpen }),
      setSearchCenter: (center) => set({ searchCenter: center }),
      selectResult: (id) => set({ selectedResultId: id }),
      clearSearch: () => set({
        query: '',
        isOpen: false,
        searchCenter: null,
        selectedResultId: null,
      }),
      addToHistory: (result) => set((state) => {
        const key = `${result.type}:${result.sourceId ?? result.id}`;
        const filtered = state.searchHistory.filter((entry) => entry.key !== key);
        return {
          searchHistory: [{ key, result, timestamp: Date.now() }, ...filtered].slice(0, MAX_HISTORY),
        };
      }),
      clearHistory: () => set({ searchHistory: [] }),
    }),
    {
      name: 'map-search-history',
      partialize: (state) => ({ searchHistory: state.searchHistory }),
    },
  ),
);

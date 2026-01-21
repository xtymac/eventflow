import { create } from 'zustand';

interface SearchState {
  // Search input state
  query: string;
  isOpen: boolean;

  // Search results center (for coordinate search)
  searchCenter: [number, number] | null;

  // Selected result ID (for highlighting)
  selectedResultId: string | null;

  // Actions
  setQuery: (query: string) => void;
  setIsOpen: (isOpen: boolean) => void;
  setSearchCenter: (center: [number, number] | null) => void;
  selectResult: (id: string | null) => void;
  clearSearch: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  isOpen: false,
  searchCenter: null,
  selectedResultId: null,

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
}));

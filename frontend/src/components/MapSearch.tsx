import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { Group, Loader, Text } from '@/components/shims';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import {
  IconX,
  IconMapPin,
  IconMap2,
  IconCalendar,
  IconTree,
  IconBulb,
  IconAlertTriangle,
  IconSearch,
  IconClock,
} from '@tabler/icons-react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useMapSearch } from '../hooks/useMapSearch';
import { useParkSearch, useParkSuggestions } from '../hooks/useParkSearch';
import type { ParkSearchResult, FacilitySearchResult } from '../hooks/useParkSearch';
import { useSearchStore } from '../stores/searchStore';
import type { SearchHistoryResult, SearchHistoryEntry } from '../stores/searchStore';
import { useUIStore } from '../stores/uiStore';
import { useMapStore } from '../stores/mapStore';
import { FacilityPlaceholderImage } from './facility/FacilityPlaceholderImage';
import { CURATED_PARKS } from '../data/curatedParks';
import { FACILITY_CATEGORY_LABELS, DUMMY_FACILITIES } from '../data/dummyFacilities';
import { PARK_CENTERS, makeApproxPolygon } from '../pages/parks/ParkPreviewPanel';
import type { SearchResult } from '@nagoya/shared';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Fetch greenspace geometry by ID (for local results that lack geometry)
async function fetchGreenSpaceGeometry(id: string): Promise<GeoJSON.Geometry | null> {
  try {
    const res = await fetch(`${API_BASE}/greenspaces/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.geometry ?? null;
  } catch {
    return null;
  }
}

// Build a lookup map from park id → curated park data
const curatedParkMap = new Map(CURATED_PARKS.map((p) => [p.id, p]));

// Client-side search for curated parks (supplements API results)
function searchLocalParks(query: string, limit = 5): SearchResult[] {
  if (!query) return [];
  const q = query.toLowerCase();
  return CURATED_PARKS
    .filter((p) =>
      p.displayName.toLowerCase().includes(q) ||
      p.ward.toLowerCase().includes(q) ||
      p.address.toLowerCase().includes(q) ||
      p.planNumber.toLowerCase().includes(q)
    )
    .slice(0, limit)
    .map((p) => {
      const info = PARK_CENTERS[p.id];
      return {
        id: `greenspace:${p.id}`,
        type: 'greenspace' as const,
        name: p.displayName,
        subtitle: `${p.planNumber}・${p.ward}${p.address}`,
        sourceId: p.id,
        coordinates: info?.center,
        geometry: info
          ? makeApproxPolygon(info.center, info.areaM2)
          : undefined,
      };
    });
}

// Client-side search for dummy facilities (supplements API results)
function searchLocalFacilities(query: string, limit = 5): SearchResult[] {
  if (!query) return [];
  const q = query.toLowerCase();
  return DUMMY_FACILITIES
    .filter((f) =>
      f.name.toLowerCase().includes(q) ||
      f.facilityId.toLowerCase().includes(q) ||
      (f.category && FACILITY_CATEGORY_LABELS[f.category]?.toLowerCase().includes(q))
    )
    .slice(0, limit)
    .map((f) => ({
      id: `park-facility:${f.id}`,
      type: 'park-facility' as const,
      name: f.name,
      subtitle: `${f.facilityId} ・${FACILITY_CATEGORY_LABELS[f.category] ?? f.category}`,
      sourceId: f.id,
      metadata: {
        facilityId: f.facilityId,
        category: f.category,
        greenSpaceRef: f.greenSpaceRef,
        ward: f.ward,
      },
    }));
}


function buildParkSubtitle(result: SearchHistoryResult | SearchResult): string | undefined {
  if (result.type !== 'greenspace') return result.subtitle ?? undefined;
  const sourceId = result.sourceId ?? result.id;
  const park = curatedParkMap.get(sourceId);
  if (park) return `${park.planNumber}・${park.ward}${park.address}`;
  return result.subtitle ?? undefined;
}

function buildFacilitySubtitle(result: SearchHistoryResult | SearchResult): string | undefined {
  if (result.type !== 'park-facility') return result.subtitle ?? undefined;
  const meta = result.metadata as Record<string, unknown> | undefined;
  const facilityId = meta?.facilityId as string | undefined;
  const category = meta?.category as string | undefined;
  const localizedCategory = category ? FACILITY_CATEGORY_LABELS[category] : undefined;
  if (facilityId && localizedCategory) return `${facilityId} ・${localizedCategory}`;
  if (facilityId) return facilityId;
  if (localizedCategory) return localizedCategory;
  return result.subtitle ?? undefined;
}

const typeLabels: Record<SearchResult['type'], string> = {
  place: '場所',
  coordinate: '座標',
  event: 'イベント',
  greenspace: '緑地',
  streetlight: '街灯',
  river: '河川',
  'street-tree': '街路樹',
  'park-facility': '公園施設',
  'pavement-section': '舗装',
  'pump-station': 'ポンプ場',
};

function getTypeIcon(type: SearchResult['type']) {
  switch (type) {
    case 'event':
      return <IconCalendar size={16} />;
    case 'greenspace':
      return <IconTree size={16} />;
    case 'streetlight':
      return <IconBulb size={16} />;
    case 'river':
      return <IconMap2 size={16} />;
    case 'street-tree':
      return <IconTree size={16} />;
    case 'park-facility':
    case 'pavement-section':
    case 'pump-station':
      return <IconMapPin size={16} />;
    case 'coordinate':
    case 'place':
    default:
      return <IconMapPin size={16} />;
  }
}

// Desktop dropdown width: wider than the input (matches Figma wireframe)
const DROPDOWN_WIDTH_DESKTOP = 420;
// Breakpoint matching Tailwind `sm:`
const SM_BREAKPOINT = 640;

export function MapSearch() {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{
    top: number; left: number; width: number; maxHeight: number;
  } | null>(null);

  const {
    query,
    setQuery,
    isOpen,
    setIsOpen,
    selectedResultId,
    selectResult,
    setSearchCenter,
    clearSearch,
    searchHistory,
    addToHistory,
  } = useSearchStore();

  const {
    setFlyToGeometry,
    selectEvent,
    openEventDetailModal,
    selectAsset,
    setCurrentView,
    mapBbox,
    mapCenter,
    mapZoom,
    currentView,
  } = useUIStore();

  const {
    showEvents,
    showGreenSpaces,
    showStreetLights,
    showRivers,
    showStreetTrees,
    showParkFacilities,
    showPavementSections,
    showPumpStations,
    toggleEvents,
    toggleGreenSpaces,
    toggleStreetLights,
    toggleRivers,
    toggleStreetTrees,
    toggleParkFacilities,
    togglePavementSections,
    togglePumpStations,
    setHighlightedFeature,
  } = useMapStore();

  const { data, isLoading, isFetching, error } = useMapSearch(query, {
    enabled: isOpen && query.length >= 2,
    context: {
      bbox: mapBbox ?? undefined,
      mapCenter: mapCenter ?? undefined,
      mapZoom,
      view: currentView,
      locale: navigator.language,
    },
  });

  // Park-specific DB search (starts at 1 char, 150ms debounce)
  const normalizedQuery = query.trim();
  const isSearchMode = normalizedQuery.length >= 1;
  const { data: parkSearchData, isLoading: parkSearchLoading } = useParkSearch(normalizedQuery, {
    enabled: isOpen && isSearchMode,
    debounceMs: 150,
  });

  // Empty-state suggestions (when focused with no query)
  const { data: suggestionsData } = useParkSuggestions({
    enabled: isOpen && !isSearchMode,
  });

  // Derived state
  const hasFreshResults = data?.meta?.query === normalizedQuery;
  const liveResults = normalizedQuery.length >= 2 && hasFreshResults ? (data?.data?.results ?? []) : [];
  const isCoordinateSearch = data?.data?.isCoordinateSearch;
  const hasError = data?.meta?.error;
  const isOutOfBounds = hasError === 'OUTSIDE_BOUNDS';

  // Loading state: only in search mode
  const showLoading = isSearchMode && (isLoading || isFetching || parkSearchLoading);

  // History: always show all entries (unfiltered) so the section stays visible
  const visibleHistory = searchHistory;

  // Convert park search API results to SearchResult format
  const parkSearchResults = useMemo(() => {
    if (!isSearchMode || !parkSearchData?.data) return { dbParks: [] as SearchResult[], dbFacilities: [] as SearchResult[] };

    const dbParks: SearchResult[] = (parkSearchData.data.parks ?? []).map((p: ParkSearchResult) => ({
      id: `greenspace:${p.id}`,
      type: 'greenspace' as const,
      name: p.name,
      subtitle: p.address ?? undefined,
      sourceId: p.id,
      coordinates: p.coordinates ?? undefined,
      geometry: p.geometry,
    }));

    const dbFacilities: SearchResult[] = (parkSearchData.data.facilities ?? []).map((f: FacilitySearchResult) => ({
      id: `park-facility:${f.id}`,
      type: 'park-facility' as const,
      name: f.name,
      subtitle: `${f.facilityId ?? f.id} ・${FACILITY_CATEGORY_LABELS[f.assetCategory] ?? f.assetCategory}`,
      sourceId: f.id,
      coordinates: f.coordinates ?? undefined,
      geometry: f.geometry,
      metadata: {
        facilityId: f.facilityId,
        category: f.assetCategory,
        greenSpaceRef: f.parkId,
        ward: f.ward,
      },
    }));

    return { dbParks, dbFacilities };
  }, [isSearchMode, parkSearchData]);

  // Convert suggestions to SearchResult format
  const suggestions = useMemo(() => {
    if (isSearchMode || !suggestionsData?.data) return { suggestedParks: [] as SearchResult[], suggestedFacilities: [] as SearchResult[] };

    const suggestedParks: SearchResult[] = (suggestionsData.data.parks ?? []).map((p: ParkSearchResult) => ({
      id: `greenspace:${p.id}`,
      type: 'greenspace' as const,
      name: p.name,
      subtitle: p.address ?? undefined,
      sourceId: p.id,
      coordinates: p.coordinates ?? undefined,
      geometry: p.geometry,
    }));

    const suggestedFacilities: SearchResult[] = (suggestionsData.data.facilities ?? []).map((f: FacilitySearchResult) => ({
      id: `park-facility:${f.id}`,
      type: 'park-facility' as const,
      name: f.name,
      subtitle: `${f.facilityId ?? f.id} ・${FACILITY_CATEGORY_LABELS[f.assetCategory] ?? f.assetCategory}`,
      sourceId: f.id,
      coordinates: f.coordinates ?? undefined,
      geometry: f.geometry,
      metadata: {
        facilityId: f.facilityId,
        category: f.assetCategory,
        greenSpaceRef: f.parkId,
        ward: f.ward,
      },
    }));

    return { suggestedParks, suggestedFacilities };
  }, [isSearchMode, suggestionsData]);

  // Group live results + supplement with local + DB data
  const { parks, facilities, other } = useMemo(() => {
    const p: SearchResult[] = [];
    const f: SearchResult[] = [];
    const o: SearchResult[] = [];
    for (const r of liveResults) {
      if (r.type === 'greenspace') p.push(r);
      else if (r.type === 'park-facility') f.push(r);
      else o.push(r);
    }

    // Merge DB park search results (dedupe by id)
    if (isSearchMode) {
      const parkIds = new Set(p.map((r) => r.id));
      for (const dbPark of parkSearchResults.dbParks) {
        if (!parkIds.has(dbPark.id)) { p.push(dbPark); parkIds.add(dbPark.id); }
      }
      const facilityIds = new Set(f.map((r) => r.id));
      for (const dbFac of parkSearchResults.dbFacilities) {
        if (!facilityIds.has(dbFac.id)) { f.push(dbFac); facilityIds.add(dbFac.id); }
      }

      // Also supplement with local curated data
      for (const local of searchLocalParks(normalizedQuery)) {
        if (!parkIds.has(local.id)) p.push(local);
      }
      for (const local of searchLocalFacilities(normalizedQuery)) {
        if (!facilityIds.has(local.id)) f.push(local);
      }

      // When parks match, also include facilities belonging to those parks
      if (p.length > 0) {
        const matchedParkSourceIds = new Set(
          p.map((r) => r.sourceId ?? r.id.replace(/^greenspace:/, ''))
        );
        for (const df of DUMMY_FACILITIES) {
          const fId = `park-facility:${df.id}`;
          if (matchedParkSourceIds.has(df.greenSpaceRef) && !facilityIds.has(fId)) {
            f.push({
              id: fId,
              type: 'park-facility' as const,
              name: df.name,
              subtitle: `${df.facilityId} ・${FACILITY_CATEGORY_LABELS[df.category] ?? df.category}`,
              sourceId: df.id,
              metadata: {
                facilityId: df.facilityId,
                category: df.category,
                greenSpaceRef: df.greenSpaceRef,
                ward: df.ward,
              },
            });
            facilityIds.add(fId);
          }
        }
      }
    }

    return { parks: p, facilities: f, other: o };
  }, [liveResults, isSearchMode, normalizedQuery, parkSearchResults]);

  const hasAnyGroupContent = visibleHistory.length > 0 || parks.length > 0 || facilities.length > 0 || other.length > 0;
  const hasSuggestions = suggestions.suggestedParks.length > 0 || suggestions.suggestedFacilities.length > 0;

  // Resolved lists for display: search results or suggestions
  const displayParks = isSearchMode ? parks : suggestions.suggestedParks;
  const displayFacilities = isSearchMode ? facilities : suggestions.suggestedFacilities;

  // Dropdown visibility — also show on empty focus for suggestions/history
  const shouldShowDropdown =
    isOpen &&
    !isCoordinateSearch &&
    (isSearchMode || visibleHistory.length > 0 || hasSuggestions);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        inputRef.current && !inputRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setIsOpen]);

  // Compute fixed position for the dropdown so it escapes overflow:hidden parents.
  // Mobile: full-width with horizontal margins. Desktop: wider than input (420px).
  useEffect(() => {
    if (!shouldShowDropdown || !inputRef.current) {
      setDropdownPos(null);
      return;
    }
    const update = () => {
      const rect = inputRef.current!.getBoundingClientRect();
      const vw = window.innerWidth;
      const isMobile = vw < SM_BREAKPOINT;
      const margin = 8; // horizontal margin on mobile
      setDropdownPos({
        top: rect.bottom + 4,
        left: isMobile ? margin : rect.left,
        width: isMobile ? vw - margin * 2 : DROPDOWN_WIDTH_DESKTOP,
        maxHeight: window.innerHeight - rect.bottom - 16,
      });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [shouldShowDropdown]);

  // Update search center when coordinate search is performed
  useEffect(() => {
    if (data?.data?.searchCenter) {
      setSearchCenter(data.data.searchCenter);
      if (data.data.isCoordinateSearch && !data.meta?.error) {
        const geometry = {
          type: 'Point' as const,
          coordinates: data.data.searchCenter,
        };
        setFlyToGeometry(geometry, true);
        setIsOpen(false);
      }
    }
  }, [data, setSearchCenter, setFlyToGeometry, setIsOpen]);

  // Keyboard shortcuts
  useHotkeys('mod+k', (e) => {
    e.preventDefault();
    setIsOpen(true);
    inputRef.current?.focus();
  });

  useHotkeys('Escape', () => {
    if (isOpen) {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  });

  // Shared selection logic for both live results and history
  const executeSelection = useCallback((result: SearchHistoryResult | SearchResult) => {
    selectResult(result.id);

    const geometry = result.geometry
      ?? (result.coordinates
        ? { type: 'Point' as const, coordinates: result.coordinates }
        : null);
    const sourceId = result.sourceId ?? result.id;

    // Persist the map highlight so the feature stays highlighted after dropdown closes
    setHighlightedFeature(sourceId);

    if (result.type === 'place' || result.type === 'coordinate') {
      if (result.coordinates) {
        setSearchCenter(result.coordinates);
        setFlyToGeometry({ type: 'Point', coordinates: result.coordinates }, true);
      }
    } else if (result.type === 'event') {
      if (!showEvents) toggleEvents();
      selectEvent(sourceId);
      openEventDetailModal(sourceId);
      setCurrentView('events');
      if (geometry) setFlyToGeometry(geometry, false);
    } else if (result.type === 'greenspace') {
      if (!showGreenSpaces) toggleGreenSpaces();
      // Use only the green highlightedFeature layer (set above) — no selectAsset
      // to avoid the redundant orange selected-asset glow.
      setCurrentView('assets');
      if (geometry) {
        setFlyToGeometry(geometry, false);
      } else {
        // Local result without geometry — fetch it from API
        fetchGreenSpaceGeometry(sourceId).then((geo) => {
          if (geo) {
            setFlyToGeometry(geo, false);
          }
        });
      }
    } else if (result.type === 'streetlight') {
      if (!showStreetLights) toggleStreetLights();
      setCurrentView('assets');
      if (geometry) setFlyToGeometry(geometry, true);
    } else if (result.type === 'river') {
      if (!showRivers) toggleRivers();
      if (geometry) setFlyToGeometry(geometry, true);
    } else if (result.type === 'street-tree') {
      if (!showStreetTrees) toggleStreetTrees();
      setCurrentView('assets');
      if (geometry) setFlyToGeometry(geometry, true);
    } else if (result.type === 'park-facility') {
      if (!showParkFacilities) toggleParkFacilities();
      setCurrentView('assets');
      if (geometry) setFlyToGeometry(geometry, true);
    } else if (result.type === 'pavement-section') {
      if (!showPavementSections) togglePavementSections();
      setCurrentView('assets');
      if (geometry) setFlyToGeometry(geometry, true);
    } else if (result.type === 'pump-station') {
      if (!showPumpStations) togglePumpStations();
      setCurrentView('assets');
      if (geometry) setFlyToGeometry(geometry, true);
    }

    setIsOpen(false);
  }, [selectResult, setSearchCenter, setFlyToGeometry, showEvents, toggleEvents, selectEvent, openEventDetailModal, setCurrentView, selectAsset, showGreenSpaces, toggleGreenSpaces, showStreetLights, toggleStreetLights, showRivers, toggleRivers, showStreetTrees, toggleStreetTrees, showParkFacilities, toggleParkFacilities, showPavementSections, togglePavementSections, showPumpStations, togglePumpStations, setIsOpen]);

  // Hover handlers for highlighting markers on the map
  const handleResultHover = useCallback((result: SearchResult | SearchHistoryResult) => {
    const sourceId = result.sourceId ?? result.id;
    setHighlightedFeature(sourceId);
  }, [setHighlightedFeature]);

  const handleResultLeave = useCallback(() => {
    setHighlightedFeature(null);
  }, [setHighlightedFeature]);

  const handleSelectLive = useCallback((result: SearchResult) => {
    addToHistory({
      id: result.id,
      type: result.type,
      name: result.name,
      subtitle: result.subtitle,
      coordinates: result.coordinates,
      geometry: result.geometry,
      sourceId: result.sourceId,
      metadata: result.metadata,
    });
    executeSelection(result);
  }, [addToHistory, executeSelection]);

  const handleSelectHistory = useCallback((entry: SearchHistoryEntry) => {
    addToHistory(entry.result); // bump recency
    executeSelection(entry.result);
  }, [addToHistory, executeSelection]);

  const handleClear = () => {
    setQuery('');
    clearSearch();
    inputRef.current?.focus();
  };

  return (
    <div className="w-full sm:max-w-[360px]" style={{ position: 'relative' }}>
      <div className="relative">
        <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder="検索"
          className="pl-9 pr-10"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) {
              setIsOpen(true);
            }
          }}
          onFocus={() => {
            setIsOpen(true);
          }}
        />
        {query && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleClear}
              aria-label="Clear search"
            >
              <IconX size={14} />
            </Button>
          </div>
        )}
      </div>

      <Collapsible open={shouldShowDropdown && !!dropdownPos}>
        <CollapsibleContent>
          <div
            ref={dropdownRef}
            className="fixed z-[1000] overflow-hidden rounded-lg border bg-background p-2 shadow-md"
            style={{
              top: dropdownPos?.top,
              left: dropdownPos?.left,
              width: dropdownPos?.width,
              maxHeight: dropdownPos?.maxHeight,
            }}
            onMouseDown={(e) => {
              // Prevent input blur when clicking dropdown items.
              e.preventDefault();
            }}
          >
            {(hasAnyGroupContent || hasSuggestions) ? (
              <ScrollArea className="max-h-full">
                <div className="flex flex-col">
                  {/* 検索履歴 */}
                  {visibleHistory.length > 0 && (
                    <>
                      <div className="px-2 py-1.5">
                        <p className="text-xs font-medium text-muted-foreground">検索履歴</p>
                      </div>
                      {visibleHistory.map((entry) => (
                        <div
                          key={entry.key}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
                          style={{
                            backgroundColor: selectedResultId === entry.result.id ? 'hsl(var(--accent))' : undefined,
                          }}
                          onMouseDown={() => handleSelectHistory(entry)}
                          onMouseEnter={() => handleResultHover(entry.result)}
                          onMouseLeave={handleResultLeave}
                        >
                          <IconClock size={16} className="shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm">{entry.result.name}</p>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  {/* 公園 */}
                  {displayParks.length > 0 && (
                    <>
                      {visibleHistory.length > 0 && <Separator className="my-1" />}
                      <div className="px-2 py-1.5">
                        <p className="text-xs font-medium text-muted-foreground">公園</p>
                      </div>
                      {displayParks.map((result) => (
                        <div
                          key={result.id}
                          className="flex cursor-pointer flex-col rounded-md px-2 py-1.5 hover:bg-accent"
                          style={{
                            backgroundColor: selectedResultId === result.id ? 'hsl(var(--accent))' : undefined,
                          }}
                          onMouseDown={() => handleSelectLive(result)}
                          onMouseEnter={() => handleResultHover(result)}
                          onMouseLeave={handleResultLeave}
                        >
                          <p className="truncate text-sm font-medium">{result.name}</p>
                          {buildParkSubtitle(result) && (
                            <p className="truncate text-sm text-muted-foreground">
                              {buildParkSubtitle(result)}
                            </p>
                          )}
                        </div>
                      ))}
                    </>
                  )}

                  {/* 施設 */}
                  {displayFacilities.length > 0 && (
                    <>
                      {(visibleHistory.length > 0 || displayParks.length > 0) && <Separator className="my-1" />}
                      <div className="px-2 py-1.5">
                        <p className="text-xs font-medium text-muted-foreground">施設</p>
                      </div>
                      {displayFacilities.map((result) => {
                        const meta = result.metadata as Record<string, unknown> | undefined;
                        const category = meta?.category as string | undefined;
                        return (
                          <div
                            key={result.id}
                            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
                            style={{
                              backgroundColor: selectedResultId === result.id ? 'hsl(var(--accent))' : undefined,
                            }}
                            onMouseDown={() => handleSelectLive(result)}
                            onMouseEnter={() => handleResultHover(result)}
                            onMouseLeave={handleResultLeave}
                          >
                            <FacilityPlaceholderImage category={category ?? undefined} size={40} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm">{result.name}</p>
                              {buildFacilitySubtitle(result) && (
                                <p className="truncate text-sm text-muted-foreground">
                                  {buildFacilitySubtitle(result)}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}

                  {/* その他 */}
                  {other.length > 0 && (
                    <>
                      {(visibleHistory.length > 0 || displayParks.length > 0 || displayFacilities.length > 0) && <Separator className="my-1" />}
                      <div className="px-2 py-1.5">
                        <p className="text-xs font-medium text-muted-foreground">その他</p>
                      </div>
                      {other.map((result) => (
                        <div
                          key={result.id}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
                          style={{
                            backgroundColor: selectedResultId === result.id ? 'hsl(var(--accent))' : undefined,
                          }}
                          onMouseDown={() => handleSelectLive(result)}
                          onMouseEnter={() => handleResultHover(result)}
                          onMouseLeave={handleResultLeave}
                        >
                          <div className="shrink-0 text-muted-foreground">
                            {getTypeIcon(result.type)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm">{result.name}</p>
                            {(result.subtitle || typeLabels[result.type]) && (
                              <p className="truncate text-xs text-muted-foreground">
                                {result.subtitle || typeLabels[result.type]}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </ScrollArea>
            ) : isSearchMode && showLoading ? (
              <Group justify="center" className="py-4">
                <Loader size="sm" />
                <Text size="sm" c="dimmed">検索中...</Text>
              </Group>
            ) : isSearchMode && error ? (
              <p className="py-4 text-center text-sm text-red-600">
                検索エラーが発生しました
              </p>
            ) : isSearchMode && isOutOfBounds ? (
              <Alert variant="default" className="border-yellow-300 bg-yellow-50">
                <IconAlertTriangle size={16} />
                <AlertDescription>
                  {data?.meta?.errorMessage || '指定された座標は名古屋市の範囲外です'}
                </AlertDescription>
              </Alert>
            ) : isSearchMode ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                「{query}」の検索結果がありません
              </p>
            ) : null}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

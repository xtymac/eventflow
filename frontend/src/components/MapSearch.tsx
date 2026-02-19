import { useRef, useEffect, useCallback } from 'react';
import { Stack, Text, Group, Loader } from '@/components/shims';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import {
  IconX,
  IconMapPin,
  IconCalendar,
  IconRoad,
  IconTree,
  IconBulb,
  IconAlertTriangle,
  IconMap2,
} from '@tabler/icons-react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useMapSearch } from '../hooks/useMapSearch';
import { useSearchStore } from '../stores/searchStore';
import { useUIStore } from '../stores/uiStore';
import { useMapStore } from '../stores/mapStore';
import type { SearchResult } from '@nagoya/shared';

export function MapSearch() {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    query,
    setQuery,
    isOpen,
    setIsOpen,
    selectedResultId,
    selectResult,
    setSearchCenter,
    clearSearch,
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
    showAssets,
    showGreenSpaces,
    showStreetLights,
    showRivers,
    showStreetTrees,
    showParkFacilities,
    showPavementSections,
    showPumpStations,
    toggleEvents,
    toggleAssets,
    toggleGreenSpaces,
    toggleStreetLights,
    toggleRivers,
    toggleStreetTrees,
    toggleParkFacilities,
    togglePavementSections,
    togglePumpStations,
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

  // Show loading when:
  // 1. Actually fetching (isLoading or isFetching)
  // 2. Query is valid but we don't have matching results yet (debounce delay)
  const isValidQuery = query.trim().length >= 2;
  const hasMatchingResults = data?.meta?.query === query.trim();
  const showLoading = isLoading || isFetching || (isValidQuery && !hasMatchingResults && !error);

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

  // Update search center when coordinate search is performed
  useEffect(() => {
    if (data?.data?.searchCenter) {
      setSearchCenter(data.data.searchCenter);
      // If coordinate search, immediately fly to the location
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

  const handleSelect = useCallback((result: SearchResult) => {
    selectResult(result.id);

    const geometry = result.geometry
      ?? (result.coordinates
        ? { type: 'Point' as const, coordinates: result.coordinates }
        : null);
    const sourceId = result.sourceId ?? result.id;

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
    } else if (result.type === 'road') {
      if (!showAssets) toggleAssets();
      selectAsset(sourceId, null, geometry ?? null);
      setCurrentView('assets');
      if (geometry) setFlyToGeometry(geometry, true);
    } else if (result.type === 'greenspace') {
      if (!showGreenSpaces) toggleGreenSpaces();
      selectAsset(sourceId, 'green-space', geometry ?? null);
      setCurrentView('assets');
      if (geometry) setFlyToGeometry(geometry, true);
    } else if (result.type === 'streetlight') {
      if (!showStreetLights) toggleStreetLights();
      setCurrentView('assets');
      if (geometry) setFlyToGeometry(geometry, true);
    } else if (result.type === 'river') {
      if (!showRivers) toggleRivers();
      if (geometry) setFlyToGeometry(geometry, true);
    } else if (result.type === 'street-tree') {
      if (!showStreetTrees) toggleStreetTrees();
      selectAsset(sourceId, 'street-tree', geometry ?? null);
      setCurrentView('assets');
      if (geometry) setFlyToGeometry(geometry, true);
    } else if (result.type === 'park-facility') {
      if (!showParkFacilities) toggleParkFacilities();
      selectAsset(sourceId, 'park-facility', geometry ?? null);
      setCurrentView('assets');
      if (geometry) setFlyToGeometry(geometry, true);
    } else if (result.type === 'pavement-section') {
      if (!showPavementSections) togglePavementSections();
      selectAsset(sourceId, 'pavement-section', geometry ?? null);
      setCurrentView('assets');
      if (geometry) setFlyToGeometry(geometry, true);
    } else if (result.type === 'pump-station') {
      if (!showPumpStations) togglePumpStations();
      selectAsset(sourceId, 'pump-station', geometry ?? null);
      setCurrentView('assets');
      if (geometry) setFlyToGeometry(geometry, true);
    }

    // Close dropdown
    setIsOpen(false);
  }, [selectResult, setSearchCenter, setFlyToGeometry, showEvents, toggleEvents, selectEvent, openEventDetailModal, setCurrentView, showAssets, toggleAssets, selectAsset, showGreenSpaces, toggleGreenSpaces, showStreetLights, toggleStreetLights, showRivers, toggleRivers, showStreetTrees, toggleStreetTrees, showParkFacilities, toggleParkFacilities, showPavementSections, togglePavementSections, showPumpStations, togglePumpStations, setIsOpen]);

  const handleClear = () => {
    setQuery('');
    clearSearch();
    inputRef.current?.focus();
  };

  const results = data?.data?.results || [];
  const hasError = data?.meta?.error;
  const isOutOfBounds = hasError === 'OUTSIDE_BOUNDS';
  const isCoordinateSearch = data?.data?.isCoordinateSearch;
  const typeLabels: Record<SearchResult['type'], string> = {
    place: '場所',
    coordinate: '座標',
    event: 'イベント',
    road: '道路',
    greenspace: '緑地',
    streetlight: '街灯',
    river: '河川',
    'street-tree': '街路樹',
    'park-facility': '公園施設',
    'pavement-section': '舗装',
    'pump-station': 'ポンプ場',
  };
  const getTypeIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'event':
        return <IconCalendar size={16} />;
      case 'road':
        return <IconRoad size={16} />;
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
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%', maxWidth: 360 }}>
      <div className="relative">
        <IconMap2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder="場所を検索 / 座標入力... ⌘K"
          className="rounded-full pl-9 pr-10"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen && e.target.value.length > 0) {
              setIsOpen(true);
            }
          }}
          onFocus={() => {
            if (query.length >= 2) {
              setIsOpen(true);
            }
          }}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {query ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleClear}
              aria-label="Clear search"
            >
              <IconX size={14} />
            </Button>
          ) : (
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              K
            </kbd>
          )}
        </div>
      </div>

      <Collapsible open={isOpen && query.length >= 2 && !isCoordinateSearch}>
        <CollapsibleContent>
          <div
            className="absolute left-0 right-0 z-[1000] mt-1 rounded-lg border bg-background p-3 shadow-md"
            style={{ maxHeight: 350 }}
          >
            {showLoading ? (
              <Group justify="center" className="py-4">
                <Loader size="sm" />
                <Text size="sm" c="dimmed">検索中...</Text>
              </Group>
            ) : error ? (
              <p className="py-4 text-center text-sm text-red-600">
                検索エラーが発生しました
              </p>
            ) : isOutOfBounds ? (
              <Alert variant="default" className="border-yellow-300 bg-yellow-50">
                <IconAlertTriangle size={16} />
                <AlertDescription>
                  {data?.meta?.errorMessage || '指定された座標は名古屋市の範囲外です'}
                </AlertDescription>
              </Alert>
            ) : results.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                「{query}」の検索結果がありません
              </p>
            ) : (
              <ScrollArea className="max-h-[300px]">
                <Stack gap="xs">
                  {results.map((result) => (
                    <div
                      key={result.id}
                      className="cursor-pointer rounded-md border p-2 hover:bg-accent"
                      style={{
                        backgroundColor: selectedResultId === result.id ? 'hsl(var(--accent))' : undefined,
                        borderColor: selectedResultId === result.id ? 'hsl(var(--primary))' : undefined,
                      }}
                      onClick={() => handleSelect(result)}
                    >
                      <Group gap="xs" className="flex-nowrap">
                        <div className="shrink-0 text-primary">
                          {getTypeIcon(result.type)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {result.name}
                          </p>
                          {(result.subtitle || typeLabels[result.type]) && (
                            <p className="truncate text-xs text-muted-foreground">
                              {result.subtitle || typeLabels[result.type]}
                            </p>
                          )}
                        </div>
                      </Group>
                    </div>
                  ))}
                </Stack>
              </ScrollArea>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

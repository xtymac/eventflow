import { useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Stack,
  Group,
  Text,
  Box,
  Loader,
} from '@/components/shims';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useDebounce } from 'use-debounce';
import { IconSearch, IconX, IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useInfiniteAssets } from '../../hooks/useInfiniteAssets';
import { useWards } from '../../hooks/useApi';
import { useUIStore } from '../../stores/uiStore';
import { getRoadAssetLabel, isRoadAssetUnnamed } from '../../utils/roadAssetLabel';
import type { RoadAsset } from '@nagoya/shared';
import { useState } from 'react';

const ROW_HEIGHT = 48;

const ROAD_TYPE_OPTIONS = [
  { value: 'arterial', label: 'Arterial' },
  { value: 'collector', label: 'Collector' },
  { value: 'local', label: 'Local' },
];

interface AdvancedRoadAssetSelectorProps {
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  required?: boolean;
  error?: string;
  initialWard?: string | null;
  isLoadingIntersecting?: boolean;
  onClearAll?: () => void; // Optional: comprehensive clear that clears geometry/preview/cache too
}

const formatAssetLabel = (asset: RoadAsset): string => {
  const label = getRoadAssetLabel(asset);
  const wardLabel = asset.ward || 'No ward';
  if (isRoadAssetUnnamed(asset)) {
    return `${label} (${wardLabel})`;
  }
  return `${label} (${wardLabel}) - ${asset.id}`;
};

export function AdvancedRoadAssetSelector({
  value,
  onChange,
  label = 'Road Assets',
  required = false,
  error,
  initialWard = null,
  isLoadingIntersecting = false,
  onClearAll,
}: AdvancedRoadAssetSelectorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedExpanded, setSelectedExpanded] = useState(true);
  const [hoveredBadgeId, setHoveredBadgeId] = useState<string | null>(null);

  // Store state
  const {
    assetSelectorFilters,
    setAssetSelectorFilter,
    selectedAssetDetailsCache,
    cacheAssetDetails,
    setHoveredAsset,
    setFlyToGeometry,
  } = useUIStore();

  const { ward, roadType, search } = assetSelectorFilters;

  // Debounced search
  const [debouncedSearch] = useDebounce(search, 300);

  // Wards data
  const { data: wardsData, isLoading: wardsLoading } = useWards();

  // Initial ward setup
  const [hasSetInitialWard, setHasSetInitialWard] = useState(false);
  useEffect(() => {
    if (initialWard && !hasSetInitialWard) {
      setAssetSelectorFilter('ward', initialWard);
      setHasSetInitialWard(true);
    }
  }, [initialWard, hasSetInitialWard, setAssetSelectorFilter]);

  // Infinite assets query
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isFetching,
  } = useInfiniteAssets({
    ward: ward || undefined,
    roadType: roadType || undefined,
    q: debouncedSearch || undefined,
  });

  // Flatten all loaded assets
  const allAssets = useMemo(() => {
    return data?.pages.flatMap((p) => p.data) ?? [];
  }, [data]);

  // Selected assets set for quick lookup
  const selectedSet = useMemo(() => new Set(value), [value]);

  // Virtual list setup
  const virtualizer = useVirtualizer({
    count: hasNextPage ? allAssets.length + 1 : allAssets.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  // Auto-fetch next page when scrolling near bottom
  useEffect(() => {
    const virtualItems = virtualizer.getVirtualItems();
    const lastItem = virtualItems[virtualItems.length - 1];

    if (
      lastItem &&
      lastItem.index >= allAssets.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [virtualizer.getVirtualItems(), hasNextPage, isFetchingNextPage, allAssets.length, fetchNextPage]);

  // Cache asset details when selecting and fly to on map
  const handleToggleAsset = useCallback(
    (asset: RoadAsset) => {
      const isSelected = selectedSet.has(asset.id);
      let newValue: string[];

      if (isSelected) {
        newValue = value.filter((id) => id !== asset.id);
      } else {
        newValue = [...value, asset.id];
        // Cache the asset details including geometry for flyTo
        cacheAssetDetails([
          {
            id: asset.id,
            label: formatAssetLabel(asset),
            ward: asset.ward,
            roadType: asset.roadType,
            geometry: asset.geometry,
          },
        ]);
      }

      // Always fly to asset on click (both selecting and deselecting)
      if (asset.geometry) {
        setFlyToGeometry(asset.geometry);
      }

      onChange(newValue);
    },
    [selectedSet, value, onChange, cacheAssetDetails, setFlyToGeometry]
  );

  // Remove from selection
  const handleRemoveSelected = useCallback(
    (id: string) => {
      onChange(value.filter((v) => v !== id));
    },
    [value, onChange]
  );

  // Clear all selected - uses comprehensive clear if provided, otherwise just clears selection
  const handleClearAll = useCallback(() => {
    if (onClearAll) {
      onClearAll(); // Use parent's comprehensive clear (geometry + roads + preview + cache)
    } else {
      onChange([]); // Fallback: just clear selection
    }
  }, [onChange, onClearAll]);

  // Fly to asset on map
  const handleFlyToAsset = useCallback(
    (id: string) => {
      // Try to get geometry from cache first
      const cached = selectedAssetDetailsCache[id];
      if (cached?.geometry) {
        setFlyToGeometry(cached.geometry);
        return;
      }

      // Fallback to loaded assets
      const loaded = allAssets.find((a) => a.id === id);
      if (loaded?.geometry) {
        setFlyToGeometry(loaded.geometry);
      }
    },
    [selectedAssetDetailsCache, allAssets, setFlyToGeometry]
  );

  // Get display label for selected asset
  const getSelectedLabel = (id: string): string => {
    // First check cache
    const cached = selectedAssetDetailsCache[id];
    if (cached) return cached.label;

    // Then check loaded assets
    const loaded = allAssets.find((a) => a.id === id);
    if (loaded) return formatAssetLabel(loaded);

    // Fallback to ID
    return id;
  };

  const wardOptions = useMemo(
    () =>
      wardsData?.data.map((w) => ({
        value: w,
        label: w,
      })) ?? [],
    [wardsData]
  );

  if (isLoading || wardsLoading) {
    return (
      <Stack gap="xs">
        <Text size="sm" fw={500}>
          {label}
          {required && <span style={{ color: 'red' }}> *</span>}
        </Text>
        <div className="flex items-center justify-center py-4">
          <Loader size="sm" />
        </div>
      </Stack>
    );
  }

  return (
    <Stack gap="xs">
      {/* Selected Assets Section */}
      <Box>
        <Group justify="space-between" mb="xs">
          <Group gap="xs">
            <Text size="sm" fw={500}>
              {label}
              {required && <span style={{ color: 'red' }}> *</span>}
            </Text>
            {isLoadingIntersecting && (
              <Group gap={4}>
                <Loader size="xs" />
                <Text size="xs" c="dimmed">
                  Loading intersecting roads...
                </Text>
              </Group>
            )}
          </Group>
          {value.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700 h-6 px-1.5 text-xs"
              onClick={handleClearAll}
            >
              Clear all
            </Button>
          )}
        </Group>

        {value.length > 0 && (
          <>
            <button
              className="flex items-center gap-1 cursor-pointer mb-1"
              onClick={() => setSelectedExpanded((v) => !v)}
              type="button"
            >
              {selectedExpanded ? (
                <IconChevronUp size={14} />
              ) : (
                <IconChevronDown size={14} />
              )}
              <Text size="xs" c="dimmed">
                {selectedExpanded ? 'Hide' : 'Show'} selected
              </Text>
            </button>
            <Collapsible open={selectedExpanded}>
              <CollapsibleContent>
                <Group gap="xs" className="flex-wrap mb-1.5 p-1 -m-1">
                  {value.map((id) => (
                    <Badge
                      key={id}
                      variant="secondary"
                      className="cursor-pointer pr-1 transition-all"
                      style={{
                        transform: hoveredBadgeId === id ? 'scale(1.03)' : 'scale(1)',
                        boxShadow: hoveredBadgeId === id ? '0 2px 8px rgba(37, 99, 235, 0.5)' : 'none',
                      }}
                      onClick={() => handleFlyToAsset(id)}
                      onMouseEnter={() => {
                        setHoveredBadgeId(id);
                        setHoveredAsset(id);
                      }}
                      onMouseLeave={() => {
                        setHoveredBadgeId(null);
                        setHoveredAsset(null);
                      }}
                    >
                      {getSelectedLabel(id)}
                      <button
                        className="ml-1 p-0 bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveSelected(id);
                        }}
                        type="button"
                      >
                        <IconX size={12} />
                      </button>
                    </Badge>
                  ))}
                </Group>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </Box>

      {/* Filter Panel */}
      <Group grow gap="xs">
        <div className="flex flex-col gap-0.5">
          <Select
            value={ward || undefined}
            onValueChange={(v) => setAssetSelectorFilter('ward', v || null)}
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue placeholder="All wards" />
            </SelectTrigger>
            <SelectContent>
              {wardOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-0.5">
          <Select
            value={roadType || undefined}
            onValueChange={(v) => setAssetSelectorFilter('roadType', v || null)}
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              {ROAD_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Group>

      {/* Search Input */}
      <div className="relative">
        <IconSearch size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or ID..."
          className="h-8 text-xs pl-7 pr-7"
          value={search}
          onChange={(e) => setAssetSelectorFilter('search', e.currentTarget.value)}
        />
        {search && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer"
            onClick={() => setAssetSelectorFilter('search', '')}
            type="button"
          >
            <IconX size={12} />
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <Text size="xs" c="red">
          {error}
        </Text>
      )}

      {/* Virtual List */}
      <ScrollArea
        className="h-[250px] border rounded"
      >
        <div ref={scrollRef} className="h-full overflow-auto">
          <div
            style={{
              height: virtualizer.getTotalSize(),
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const isLoaderRow = virtualRow.index >= allAssets.length;

              if (isLoaderRow) {
                return (
                  <div
                    key="loader"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: ROW_HEIGHT,
                      transform: `translateY(${virtualRow.start}px)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Loader size="xs" />
                  </div>
                );
              }

              const asset = allAssets[virtualRow.index];
              const isSelected = selectedSet.has(asset.id);

              return (
                <div
                  key={asset.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: ROW_HEIGHT,
                    transform: `translateY(${virtualRow.start}px)`,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 8px',
                    cursor: 'pointer',
                    backgroundColor: isSelected
                      ? 'hsl(var(--accent))'
                      : 'transparent',
                  }}
                  onClick={() => handleToggleAsset(asset)}
                  onMouseEnter={() => setHoveredAsset(asset.id)}
                  onMouseLeave={() => setHoveredAsset(null)}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => {}}
                    className="mr-2 pointer-events-none"
                  />
                  <div className="flex-1 overflow-hidden">
                    <p
                      className="text-sm whitespace-nowrap overflow-hidden text-ellipsis"
                    >
                      {getRoadAssetLabel(asset)}
                    </p>
                    <p
                      className="text-xs text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis"
                    >
                      {asset.ward || 'No ward'} &middot; {asset.roadType}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </ScrollArea>

      {/* Loading indicator */}
      {isFetching && !isFetchingNextPage && (
        <Group justify="center">
          <Loader size="xs" />
        </Group>
      )}
    </Stack>
  );
}

import { useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Stack,
  Group,
  Text,
  TextInput,
  Select,
  Checkbox,
  Badge,
  ActionIcon,
  Loader,
  Box,
  ScrollArea,
  Collapse,
  Button,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
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
}: AdvancedRoadAssetSelectorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedExpanded, setSelectedExpanded] = useState(true);

  // Store state
  const {
    assetSelectorFilters,
    setAssetSelectorFilter,
    selectedAssetDetailsCache,
    cacheAssetDetails,
    mapBbox,
    setHoveredAsset,
  } = useUIStore();

  const { ward, roadType, search, filterByMapView } = assetSelectorFilters;

  // Debounced search
  const [debouncedSearch] = useDebouncedValue(search, 300);

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
    bbox: filterByMapView ? mapBbox || undefined : undefined,
  });

  // Flatten all loaded assets
  const allAssets = useMemo(() => {
    return data?.pages.flatMap((p) => p.data) ?? [];
  }, [data]);

  // Total count
  const total = data?.pages[0]?.meta.total ?? 0;

  // Selected assets set for quick lookup
  const selectedSet = useMemo(() => new Set(value), [value]);

  // Get loaded asset IDs for checking if asset is in current filter results
  const loadedAssetIds = useMemo(() => new Set(allAssets.map((a) => a.id)), [allAssets]);

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

  // Cache asset details when selecting
  const handleToggleAsset = useCallback(
    (asset: RoadAsset) => {
      const isSelected = selectedSet.has(asset.id);
      let newValue: string[];

      if (isSelected) {
        newValue = value.filter((id) => id !== asset.id);
      } else {
        newValue = [...value, asset.id];
        // Cache the asset details
        cacheAssetDetails([
          {
            id: asset.id,
            label: formatAssetLabel(asset),
            ward: asset.ward,
            roadType: asset.roadType,
          },
        ]);
      }

      onChange(newValue);
    },
    [selectedSet, value, onChange, cacheAssetDetails]
  );

  // Remove from selection
  const handleRemoveSelected = useCallback(
    (id: string) => {
      onChange(value.filter((v) => v !== id));
    },
    [value, onChange]
  );

  // Clear all selected
  const handleClearAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

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

  // Check if selected asset is in current filter results
  const isInCurrentFilter = (id: string): boolean => {
    return loadedAssetIds.has(id);
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
        <Group justify="center" py="md">
          <Loader size="sm" />
        </Group>
      </Stack>
    );
  }

  return (
    <Stack gap="xs">
      {/* Selected Assets Section */}
      <Box>
        <Group justify="space-between" mb={4}>
          <Group gap="xs">
            <Text size="sm" fw={500}>
              {label}
              {required && <span style={{ color: 'red' }}> *</span>}
            </Text>
            {isLoadingIntersecting && (
              <Group gap={4}>
                <Loader size={12} />
                <Text size="xs" c="dimmed">
                  Loading intersecting roads...
                </Text>
              </Group>
            )}
          </Group>
          <Group gap="xs">
            <Text size="xs" c="dimmed">
              Selected {value.length} / {total} results
            </Text>
            {value.length > 0 && (
              <Button
                variant="subtle"
                size="compact-xs"
                c="red"
                onClick={handleClearAll}
              >
                Clear all
              </Button>
            )}
          </Group>
        </Group>

        {value.length > 0 && (
          <>
            <Group
              gap={4}
              style={{ cursor: 'pointer' }}
              onClick={() => setSelectedExpanded((v) => !v)}
              mb={4}
            >
              {selectedExpanded ? (
                <IconChevronUp size={14} />
              ) : (
                <IconChevronDown size={14} />
              )}
              <Text size="xs" c="dimmed">
                {selectedExpanded ? 'Hide' : 'Show'} selected
              </Text>
            </Group>
            <Collapse in={selectedExpanded}>
              <Group gap={4} wrap="wrap" mb="xs">
                {value.map((id) => {
                  const inFilter = isInCurrentFilter(id);
                  return (
                    <Badge
                      key={id}
                      variant="light"
                      color={inFilter ? 'blue' : 'gray'}
                      size="sm"
                      rightSection={
                        <ActionIcon
                          size="xs"
                          variant="transparent"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveSelected(id);
                          }}
                        >
                          <IconX size={12} />
                        </ActionIcon>
                      }
                      style={{ paddingRight: 4 }}
                    >
                      {getSelectedLabel(id)}
                      {!inFilter && ' (not in filter)'}
                    </Badge>
                  );
                })}
              </Group>
            </Collapse>
          </>
        )}
      </Box>

      {/* Filter Panel */}
      <Group grow gap="xs">
        <Select
          placeholder="All wards"
          data={wardOptions}
          value={ward}
          onChange={(v) => setAssetSelectorFilter('ward', v)}
          clearable
          size="xs"
          leftSection={<Text size="xs" c="dimmed">Ward:</Text>}
          leftSectionWidth={45}
        />
        <Select
          placeholder="All types"
          data={ROAD_TYPE_OPTIONS}
          value={roadType}
          onChange={(v) => setAssetSelectorFilter('roadType', v)}
          clearable
          size="xs"
          leftSection={<Text size="xs" c="dimmed">Type:</Text>}
          leftSectionWidth={40}
        />
        <Checkbox
          label="Map view"
          size="xs"
          checked={filterByMapView}
          onChange={(e) =>
            setAssetSelectorFilter('filterByMapView', e.currentTarget.checked)
          }
        />
      </Group>

      {/* Search Input */}
      <TextInput
        placeholder="Search by name or ID..."
        size="xs"
        leftSection={<IconSearch size={14} />}
        value={search}
        onChange={(e) => setAssetSelectorFilter('search', e.currentTarget.value)}
        rightSection={
          search ? (
            <ActionIcon
              size="xs"
              variant="transparent"
              onClick={() => setAssetSelectorFilter('search', '')}
            >
              <IconX size={12} />
            </ActionIcon>
          ) : null
        }
      />

      {/* Error message */}
      {error && (
        <Text size="xs" c="red">
          {error}
        </Text>
      )}

      {/* Virtual List */}
      <ScrollArea
        h={250}
        viewportRef={scrollRef}
        type="auto"
        style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 4 }}
      >
        <Box
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
                <Box
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
                </Box>
              );
            }

            const asset = allAssets[virtualRow.index];
            const isSelected = selectedSet.has(asset.id);

            return (
              <Box
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
                    ? 'var(--mantine-color-blue-0)'
                    : 'transparent',
                }}
                onClick={() => handleToggleAsset(asset)}
                onMouseEnter={() => setHoveredAsset(asset.id)}
                onMouseLeave={() => setHoveredAsset(null)}
              >
                <Checkbox
                  checked={isSelected}
                  onChange={() => {}}
                  size="xs"
                  mr="xs"
                  style={{ pointerEvents: 'none' }}
                />
                <Box style={{ flex: 1, overflow: 'hidden' }}>
                  <Text
                    size="sm"
                    style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {getRoadAssetLabel(asset)}
                  </Text>
                  <Text
                    size="xs"
                    c="dimmed"
                    style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {asset.ward || 'No ward'} · {asset.roadType}
                  </Text>
                </Box>
              </Box>
            );
          })}
        </Box>
      </ScrollArea>

      {/* Loading indicator */}
      {isFetching && !isFetchingNextPage && (
        <Group justify="center">
          <Loader size="xs" />
        </Group>
      )}

      {/* Tip */}
      <Text size="xs" c="dimmed">
        Tip: click road lines on the map to add or remove assets.
      </Text>
    </Stack>
  );
}

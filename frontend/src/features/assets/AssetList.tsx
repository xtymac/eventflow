import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Stack,
  TextInput,
  Card,
  Text,
  Badge,
  Group,
  Loader,
  Center,
  Chip,
  Button,
  Collapse,
  UnstyledButton,
  ActionIcon,
  Tabs,
  Box,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconSearch, IconFilter, IconChevronDown, IconChevronLeft, IconChevronRight, IconCheck, IconMapPin, IconRoad, IconTree, IconBulb } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import * as turf from '@turf/turf';
import { useQueryClient } from '@tanstack/react-query';
import { useAssets, useAsset, useWards, useGreenSpacesInBbox, useStreetLightsInBbox } from '../../hooks/useApi';
import { useUIStore } from '../../stores/uiStore';
import { getRoadAssetLabel, isRoadAssetUnnamed } from '../../utils/roadAssetLabel';
import type { RoadAsset, RoadType, AssetStatus, GreenSpaceAsset, StreetLightAsset } from '@nagoya/shared';

const LIMIT = 200;

const ROAD_TYPE_COLORS: Record<RoadType, string> = {
  arterial: 'violet',
  collector: 'cyan',
  local: 'lime',
};

const ROAD_TYPE_LABELS: Record<RoadType, string> = {
  arterial: 'Arterial',
  collector: 'Collector',
  local: 'Local',
};

const GREENSPACE_TYPE_COLORS: Record<string, string> = {
  park: 'green',
  garden: 'teal',
  playground: 'orange',
  forest: 'lime',
  other: 'gray',
};

const GREENSPACE_TYPE_LABELS: Record<string, string> = {
  park: 'Park',
  garden: 'Garden',
  playground: 'Playground',
  forest: 'Forest',
  other: 'Other',
};

export function AssetList() {
  // Local UI state
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const tabsScrollRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [loadedAssets, setLoadedAssets] = useState<RoadAsset[]>([]);

  // Tab scroll state
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Inline edit state for manual naming
  const [editName, setEditName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);

  // Persisted filter state from store (including filtersOpen)
  const { selectedAssetId, selectAsset, assetFilters, setAssetFilter, mapBbox, mapCenter, mapZoom, setHoveredAsset, setHoveredGreenspace, setHoveredStreetlight, setSidebarAssets, filtersOpen, setFiltersOpen, setFlyToGeometry } = useUIStore();
  const { roadType: roadTypeFilter, status: statusFilter, ward: wardFilter, search: searchInput, unnamed: unnamedFilter } = assetFilters;
  const [debouncedSearch] = useDebouncedValue(searchInput, 300);

  const queryClient = useQueryClient();
  const { data: wardsData } = useWards();
  const { data, isLoading, error, isFetching } = useAssets({
    roadType: roadTypeFilter as RoadType | undefined,
    status: (statusFilter as AssetStatus | undefined) || 'active',  // Default to active
    ward: wardFilter || undefined,
    q: debouncedSearch || undefined,
    unnamed: unnamedFilter || undefined,
    // Always use bbox - filters narrow down results within current viewport
    bbox: mapBbox ?? undefined,
    limit: LIMIT,
    offset: offset,
    includeTotal: true,
  });

  // Always fetch selected asset individually to pin it at top until deselected
  const { data: selectedAssetData } = useAsset(selectedAssetId);

  // Fetch greenspaces and streetlights for their tabs
  const { data: greenSpacesData, isLoading: isLoadingGreenspaces } = useGreenSpacesInBbox(
    mapBbox,
    undefined,
    { enabled: !!mapBbox, zoom: mapZoom }
  );
  const { data: streetLightsData, isLoading: isLoadingStreetlights } = useStreetLightsInBbox(
    mapBbox,
    undefined,
    { enabled: !!mapBbox && mapZoom >= 14 }
  );

  // Sort greenspaces by distance from map center
  const sortedGreenspaces = useMemo(() => {
    if (!greenSpacesData?.features || !mapCenter) return greenSpacesData?.features ?? [];
    return [...greenSpacesData.features].sort((a, b) => {
      try {
        const centerPoint = turf.point(mapCenter);
        const centerA = turf.center(a);
        const centerB = turf.center(b);
        return turf.distance(centerPoint, centerA) - turf.distance(centerPoint, centerB);
      } catch {
        return 0;
      }
    });
  }, [greenSpacesData?.features, mapCenter]);

  // Sort streetlights by distance from map center
  const sortedStreetlights = useMemo(() => {
    if (!streetLightsData?.features || !mapCenter) return streetLightsData?.features ?? [];
    return [...streetLightsData.features].sort((a, b) => {
      try {
        const centerPoint = turf.point(mapCenter);
        return turf.distance(centerPoint, a) - turf.distance(centerPoint, b);
      } catch {
        return 0;
      }
    });
  }, [streetLightsData?.features, mapCenter]);

  // Compute active filter count (include unnamed toggle)
  const activeFilterCount = [roadTypeFilter, statusFilter, wardFilter, unnamedFilter].filter(Boolean).length;

  // Toggle handler
  const handleToggleFilters = () => {
    setFiltersOpen(!filtersOpen);
  };

  // Reset offset when filters change
  useEffect(() => {
    setOffset(0);
  }, [debouncedSearch, roadTypeFilter, statusFilter, wardFilter, unnamedFilter]);

  // Populate loadedAssets when data arrives
  // Include filter deps to handle cache hits (same data reference)
  useEffect(() => {
    if (!data?.data) {
      setLoadedAssets([]);
      return;
    }

    if (offset === 0) {
      // Replace all when offset is 0 (initial load or after filter change)
      setLoadedAssets(data.data);
    } else {
      // For pagination, append with dedup
      setLoadedAssets((prev) => {
        const existingIds = new Set(prev.map((a) => a.id));
        const newAssets = data.data.filter((a) => !existingIds.has(a.id));
        return [...prev, ...newAssets];
      });
    }
  }, [data, offset, debouncedSearch, roadTypeFilter, statusFilter, wardFilter, unnamedFilter]);

  // hasNextPage logic (handles total=null)
  const hasNextPage =
    data?.meta?.total != null
      ? loadedAssets.length < data.meta.total
      : data?.data?.length === LIMIT;

  // Compute display list: sort by distance from map center, include selected asset if not in list
  const displayList = useMemo(() => {
    const selectedAsset = selectedAssetData?.data;

    // Check if selected asset matches current filters
    const selectedAssetMatchesFilters = (asset: typeof selectedAsset): boolean => {
      if (!asset) return false;
      if (statusFilter && asset.status !== statusFilter) return false;
      if (roadTypeFilter && asset.roadType !== roadTypeFilter) return false;
      if (wardFilter && asset.ward !== wardFilter) return false;
      if (unnamedFilter && asset.name) return false;
      return true;
    };

    // Merge selected asset into list only if it matches current filters
    let assets = [...loadedAssets];
    if (selectedAsset && !assets.some((a) => a.id === selectedAsset.id) && selectedAssetMatchesFilters(selectedAsset)) {
      assets.push(selectedAsset);
    }

    return assets.sort((a, b) => {
      if (!mapCenter) return 0;
      try {
        const centerPoint = turf.point(mapCenter);
        const centerA = turf.center(a.geometry);
        const centerB = turf.center(b.geometry);
        return turf.distance(centerPoint, centerA) - turf.distance(centerPoint, centerB);
      } catch {
        return 0;
      }
    });
  }, [loadedAssets, mapCenter, selectedAssetData?.data, statusFilter, roadTypeFilter, wardFilter, unnamedFilter]);

  // Sync sidebar assets to store for map markers
  useEffect(() => {
    setSidebarAssets(displayList.map((a) => ({ id: a.id, name: a.name ?? null, geometry: a.geometry })));
  }, [displayList, setSidebarAssets]);

  // Track scroll state to avoid duplicate scrolls
  const hasScrolledToAssetRef = useRef<string | null>(null);

  // Scroll to selected asset when it becomes available in the list
  useEffect(() => {
    if (!selectedAssetId) {
      hasScrolledToAssetRef.current = null;
      return;
    }

    // Already scrolled to this asset
    if (hasScrolledToAssetRef.current === selectedAssetId) return;

    // Small delay to ensure card is rendered after state update
    const scrollToCard = () => {
      const card = cardRefs.current.get(selectedAssetId);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        hasScrolledToAssetRef.current = selectedAssetId;
      }
      // If card not found, don't mark as scrolled - will retry when selectedAssetData loads
    };

    const timer = setTimeout(scrollToCard, 150);
    return () => clearTimeout(timer);
  }, [selectedAssetId]);

  // Pre-populate edit state with current name when selection changes
  useEffect(() => {
    const asset = selectedAssetData?.data;
    if (asset) {
      // Pre-fill with current display name if exists
      setEditName(asset.displayName || asset.name || '');
    } else {
      setEditName('');
    }
  }, [selectedAssetId, selectedAssetData?.data]);

  // Handle manual naming save
  const handleSaveName = async (assetId: string) => {
    const trimmedName = editName.trim();
    if (!trimmedName) {
      notifications.show({
        title: 'Error',
        message: 'Name cannot be empty',
        color: 'red',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/assets/${assetId}/name`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: trimmedName }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update name');
      }

      await response.json();

      // Invalidate queries to refresh list and map
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset', assetId] });

      setEditName('');
      notifications.show({
        title: 'Success',
        message: `Road renamed to "${trimmedName}"`,
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to save name',
        color: 'red',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Google Maps name lookup
  const handleGoogleLookup = async (assetId: string) => {
    setIsLookingUp(true);
    try {
      const response = await fetch(`/api/assets/${assetId}/lookup-google-name`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to lookup name');
      }

      const result = await response.json();

      if (result.data.roadName) {
        setEditName(result.data.roadName);
        notifications.show({
          title: 'Google Maps',
          message: `Found: ${result.data.roadName}`,
          color: 'blue',
        });
      } else {
        notifications.show({
          title: 'Google Maps',
          message: 'No road name found at this location',
          color: 'yellow',
        });
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to lookup name',
        color: 'red',
      });
    } finally {
      setIsLookingUp(false);
    }
  };

  if (isLoading) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }

  if (error) {
    return (
      <Center py="xl">
        <Text c="red">Failed to load assets</Text>
      </Center>
    );
  }

  // Tab scroll detection
  const updateScrollState = () => {
    const container = tabsScrollRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
  };

  // Check scroll state on mount and when data changes
  useEffect(() => {
    updateScrollState();
    // Also check after a short delay to ensure layout is complete
    const timer = setTimeout(updateScrollState, 100);
    return () => clearTimeout(timer);
  }, [data, sortedGreenspaces.length, sortedStreetlights.length]);

  // Tab scroll handlers
  const handleScrollLeft = () => {
    const container = tabsScrollRef.current;
    if (container) {
      container.scrollBy({ left: -120, behavior: 'smooth' });
    }
  };

  const handleScrollRight = () => {
    const container = tabsScrollRef.current;
    if (container) {
      container.scrollBy({ left: 120, behavior: 'smooth' });
    }
  };

  // Tab auto-scroll handler
  const handleTabClick = (tabValue: string) => {
    const tabElement = tabRefs.current[tabValue];
    if (tabElement) {
      tabElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  };

  return (
    <Tabs defaultValue="list">
      <Group gap={4} mb="md" wrap="nowrap" align="center">
        {canScrollLeft && (
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={handleScrollLeft}
            style={{ flexShrink: 0 }}
            aria-label="Scroll tabs left"
          >
            <IconChevronLeft size={16} />
          </ActionIcon>
        )}
        <Box
          ref={tabsScrollRef}
          className="tabs-scroll-container"
          style={{
            flex: 1,
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollbarWidth: 'none', // Firefox
          }}
          onScroll={updateScrollState}
        >
          <Tabs.List style={{ flexWrap: 'nowrap', minWidth: 'max-content' }}>
            <Tabs.Tab
              value="list"
              leftSection={<IconRoad size={14} />}
              ref={(el) => { tabRefs.current['list'] = el; }}
              onClick={() => handleTabClick('list')}
            >
              Roads ({data?.meta?.total ?? loadedAssets.length})
            </Tabs.Tab>
            <Tabs.Tab
              value="greenspaces"
              leftSection={<IconTree size={14} />}
              ref={(el) => { tabRefs.current['greenspaces'] = el; }}
              onClick={() => handleTabClick('greenspaces')}
            >
              Green ({sortedGreenspaces.length})
            </Tabs.Tab>
            <Tabs.Tab
              value="streetlights"
              leftSection={<IconBulb size={14} />}
              ref={(el) => { tabRefs.current['streetlights'] = el; }}
              onClick={() => handleTabClick('streetlights')}
            >
              Lights ({sortedStreetlights.length})
            </Tabs.Tab>
          </Tabs.List>
        </Box>
        {canScrollRight && (
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={handleScrollRight}
            style={{ flexShrink: 0 }}
            aria-label="Scroll tabs right"
          >
            <IconChevronRight size={16} />
          </ActionIcon>
        )}
      </Group>

      <Tabs.Panel value="list">
        <Stack gap="sm">
          <TextInput
            placeholder="Search by name or ID..."
            leftSection={<IconSearch size={16} />}
            value={searchInput}
            onChange={(e) => setAssetFilter('search', e.target.value)}
          />

          <UnstyledButton
            onClick={handleToggleFilters}
            aria-expanded={filtersOpen}
            aria-controls="asset-filters"
            style={{ width: '100%', textAlign: 'left' }}
          >
            <Group justify="space-between">
              <Group gap="xs">
                <IconFilter size={14} />
                <Text size="sm" fw={500}>Filters</Text>
                {activeFilterCount > 0 && (
                  <Badge size="xs" radius="xl">{activeFilterCount}</Badge>
                )}
              </Group>
              <IconChevronDown
                size={14}
                style={{
                  transform: filtersOpen ? 'rotate(180deg)' : undefined,
                  transition: 'transform 200ms',
                }}
              />
            </Group>
          </UnstyledButton>

          <Collapse in={filtersOpen} id="asset-filters">
            <Stack gap="sm">
              <div>
                <Text size="xs" c="dimmed" fw={600} mb={4}>Road Type</Text>
                <Chip.Group
                  multiple
                  value={roadTypeFilter ? [roadTypeFilter] : []}
                  onChange={(val) => {
                    if (val.length === 0) {
                      setAssetFilter('roadType', null);
                    } else {
                      const newValue = val.find((v) => v !== roadTypeFilter);
                      setAssetFilter('roadType', newValue || val[0]);
                    }
                  }}
                >
                  <Group gap="xs">
                    <Chip value="arterial">Arterial</Chip>
                    <Chip value="collector">Collector</Chip>
                    <Chip value="local">Local</Chip>
                  </Group>
                </Chip.Group>
              </div>

              <div>
                <Text size="xs" c="dimmed" fw={600} mb={4}>Status</Text>
                <Chip.Group
                  multiple
                  value={statusFilter ? [statusFilter] : []}
                  onChange={(val) => {
                    if (val.length === 0) {
                      setAssetFilter('status', null);
                    } else {
                      const newValue = val.find((v) => v !== statusFilter);
                      setAssetFilter('status', newValue || val[0]);
                    }
                  }}
                >
                  <Group gap="xs">
                    <Chip value="active">Active</Chip>
                    <Chip value="inactive">Inactive</Chip>
                  </Group>
                </Chip.Group>
              </div>

              {wardsData && wardsData.data.length > 0 && (
                <div>
                  <Text size="xs" c="dimmed" fw={600} mb={4}>Ward</Text>
                  <Chip.Group
                    multiple
                    value={wardFilter ? [wardFilter] : []}
                    onChange={(val) => {
                      if (val.length === 0) {
                        setAssetFilter('ward', null);
                      } else {
                        const newValue = val.find((v) => v !== wardFilter);
                        setAssetFilter('ward', newValue || val[0]);
                      }
                    }}
                  >
                    <Group gap="xs">
                      {wardsData.data.map((ward) => (
                        <Chip key={ward} value={ward} size="xs">
                          {ward}
                        </Chip>
                      ))}
                    </Group>
                  </Chip.Group>
                </div>
              )}

              <div>
                <Text size="xs" c="dimmed" fw={600} mb={4}>Special</Text>
                <Chip.Group
                  multiple
                  value={unnamedFilter ? ['unnamed'] : []}
                  onChange={(val) => setAssetFilter('unnamed', val.includes('unnamed'))}
                >
                  <Group gap="xs">
                    <Chip value="unnamed" size="xs">Unnamed Only</Chip>
                  </Group>
                </Chip.Group>
              </div>
            </Stack>
          </Collapse>

          <Stack gap="xs">
        {displayList.map((asset: RoadAsset) => {
          const displayText = getRoadAssetLabel(asset);
          const isUnnamed = isRoadAssetUnnamed(asset);
          // For generic names like "道路", add more disambiguation
          const isGenericName = displayText === '道路' || displayText === 'Unnamed Road';
          const locationLabel = asset.sublocality || asset.ward;
          const shortId = asset.id.replace(/^RA-/, '').replace(/^[A-Z]+-/, '');  // e.g. "RA-ATSU-1890" -> "1890"

          return (
            <Card
              key={asset.id}
              ref={(el) => {
                if (el) cardRefs.current.set(asset.id, el);
              }}
              padding="sm"
              radius="sm"
              withBorder
              style={{
                cursor: 'pointer',
                borderColor: selectedAssetId === asset.id ? 'var(--mantine-color-blue-5)' : undefined,
                backgroundColor: selectedAssetId === asset.id ? 'var(--mantine-color-blue-0)' : undefined,
                transition: 'background-color 0.15s ease, box-shadow 0.15s ease',
              }}
              className="asset-card-hover"
              onClick={() => selectAsset(asset.id, asset.geometry)}
              onMouseEnter={() => setHoveredAsset(asset.id)}
              onMouseLeave={() => setHoveredAsset(null)}
            >
              <Group gap="sm" wrap="nowrap" align="center">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Group justify="space-between" wrap="nowrap" gap="xs">
                    <Text fw={500} size="sm" lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
                      {isGenericName
                        ? `${displayText}${locationLabel ? ` · ${locationLabel}` : ''}${shortId ? ` · #${shortId}` : ''}`
                        : `${displayText}${asset.ward ? ` · ${asset.ward}` : ''}`
                      }
                    </Text>
                    <Badge color={ROAD_TYPE_COLORS[asset.roadType]} size="sm" style={{ flexShrink: 0 }}>
                      {ROAD_TYPE_LABELS[asset.roadType]}
                    </Badge>
                  </Group>

                  <Group gap="xs" mt={4}>
                    <Badge
                      variant="outline"
                      size="xs"
                      color={asset.status === 'active' ? 'green' : 'gray'}
                    >
                      {asset.status}
                    </Badge>
                    <Badge variant="outline" size="xs" color="gray">
                      {asset.lanes} lanes
                    </Badge>
                    {!isUnnamed && asset.nameSource && (
                      <Badge
                        variant="light"
                        size="xs"
                        color={asset.nameSource === 'osm' ? 'blue' : asset.nameSource === 'google' ? 'red' : 'teal'}
                        title="Name source"
                      >
                        {asset.nameSource === 'osm' ? 'OSM名' : asset.nameSource === 'google' ? 'Google名' : '手動名'}
                      </Badge>
                    )}
                  </Group>

                  {asset.landmark && (
                    <Text size="xs" c="dimmed" mt={4}>
                      Near: {asset.landmark}
                    </Text>
                  )}

                  <Text
                    size="xs"
                    c={isUnnamed ? 'dark' : 'dimmed'}
                    fw={isUnnamed ? 500 : undefined}
                    ff="monospace"
                    mt={4}
                  >
                    ID: {asset.id}
                  </Text>

                  {/* Inline edit for selected roads */}
                  {selectedAssetId === asset.id && (
                    <Group mt="xs" gap="xs" onClick={(e) => e.stopPropagation()}>
                      <TextInput
                        size="xs"
                        placeholder="Road name..."
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveName(asset.id);
                        }}
                        style={{ flex: 1 }}
                        disabled={isSaving || isLookingUp}
                      />
                      <ActionIcon
                        variant="light"
                        color="blue"
                        size="sm"
                        onClick={() => handleGoogleLookup(asset.id)}
                        loading={isLookingUp}
                        disabled={isSaving}
                        title="Lookup from Google Maps"
                      >
                        <IconMapPin size={14} />
                      </ActionIcon>
                      <ActionIcon
                        variant="filled"
                        color="green"
                        size="sm"
                        onClick={() => handleSaveName(asset.id)}
                        loading={isSaving}
                        disabled={!editName.trim() || isLookingUp}
                      >
                        <IconCheck size={14} />
                      </ActionIcon>
                    </Group>
                  )}
                </div>
              </Group>
            </Card>
          );
        })}

        {displayList.length === 0 && !isLoading && !isFetching && (!data?.data || data.data.length === 0) && (
          <Text c="dimmed" ta="center" py="lg">
            No assets found
          </Text>
        )}

        {hasNextPage && (
          <Button
            variant="subtle"
            onClick={() => setOffset((prev) => prev + LIMIT)}
            loading={isFetching}
            fullWidth
          >
            {data?.meta?.total != null
              ? `Load more (${loadedAssets.length} of ${data.meta.total})`
              : 'Load more...'}
          </Button>
        )}
          </Stack>
        </Stack>
      </Tabs.Panel>

      <Tabs.Panel value="greenspaces">
        <Stack gap="xs">
          {isLoadingGreenspaces ? (
            <Center py="xl">
              <Loader />
            </Center>
          ) : sortedGreenspaces.length === 0 ? (
            <Text c="dimmed" ta="center" py="lg">
              {mapZoom < 12 ? 'Zoom in to see green spaces' : 'No green spaces in current view'}
            </Text>
          ) : (
            sortedGreenspaces.map((feature) => {
              const gs = feature.properties as GreenSpaceAsset;
              const displayName = gs.displayName || gs.nameJa || gs.name || 'Unnamed Green Space';
              const gsType = gs.greenSpaceType || 'other';
              const areaM2 = gs.areaM2 || 0;
              const areaDisplay = areaM2 >= 10000
                ? `${(areaM2 / 10000).toFixed(1)} ha`
                : `${Math.round(areaM2)} m²`;

              return (
                <Card
                  key={gs.id}
                  padding="sm"
                  radius="sm"
                  withBorder
                  style={{
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease, box-shadow 0.15s ease',
                  }}
                  className="asset-card-hover"
                  onClick={() => {
                    console.log('[AssetList] Greenspace clicked:', gs.id, 'geometry type:', feature.geometry?.type);
                    if (feature.geometry) {
                      setFlyToGeometry(feature.geometry, true);
                    } else {
                      console.error('[AssetList] Greenspace geometry is undefined for:', gs.id);
                    }
                  }}
                  onMouseEnter={() => setHoveredGreenspace(gs.id)}
                  onMouseLeave={() => setHoveredGreenspace(null)}
                >
                  <Group gap="sm" wrap="nowrap" align="center">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Group justify="space-between" wrap="nowrap" gap="xs">
                        <Text fw={500} size="sm" lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
                          {displayName}
                        </Text>
                        <Badge color={GREENSPACE_TYPE_COLORS[gsType] || 'gray'} size="sm" style={{ flexShrink: 0 }}>
                          {GREENSPACE_TYPE_LABELS[gsType] || gsType}
                        </Badge>
                      </Group>

                      <Group gap="xs" mt={4}>
                        <Badge variant="outline" size="xs" color="gray">
                          {areaDisplay}
                        </Badge>
                        {gs.ward && (
                          <Badge variant="outline" size="xs" color="blue">
                            {gs.ward}
                          </Badge>
                        )}
                      </Group>

                      <Text size="xs" c="dimmed" ff="monospace" mt={4}>
                        ID: {gs.id}
                      </Text>
                    </div>
                  </Group>
                </Card>
              );
            })
          )}
        </Stack>
      </Tabs.Panel>

      <Tabs.Panel value="streetlights">
        <Stack gap="xs">
          {mapZoom < 14 ? (
            <Text c="dimmed" ta="center" py="lg">
              Zoom in to see street lights (zoom level 14+)
            </Text>
          ) : isLoadingStreetlights ? (
            <Center py="xl">
              <Loader />
            </Center>
          ) : sortedStreetlights.length === 0 ? (
            <Text c="dimmed" ta="center" py="lg">
              No street lights in current view
            </Text>
          ) : (
            sortedStreetlights.map((feature) => {
              const sl = feature.properties as StreetLightAsset;
              const displayName = sl.displayName || sl.lampId || 'Street Light';
              const lampType = sl.lampType || 'unknown';
              const wattage = sl.wattage;

              return (
                <Card
                  key={sl.id}
                  padding="sm"
                  radius="sm"
                  withBorder
                  style={{
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease, box-shadow 0.15s ease',
                  }}
                  className="asset-card-hover"
                  onClick={() => {
                    console.log('[AssetList] Streetlight clicked:', sl.id, 'geometry type:', feature.geometry?.type);
                    if (feature.geometry) {
                      setFlyToGeometry(feature.geometry, true);
                    } else {
                      console.error('[AssetList] Streetlight geometry is undefined for:', sl.id);
                    }
                  }}
                  onMouseEnter={() => setHoveredStreetlight(sl.id)}
                  onMouseLeave={() => setHoveredStreetlight(null)}
                >
                  <Group gap="sm" wrap="nowrap" align="center">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Group justify="space-between" wrap="nowrap" gap="xs">
                        <Text fw={500} size="sm" lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
                          {displayName}
                        </Text>
                        <Badge color="yellow" size="sm" style={{ flexShrink: 0 }}>
                          {lampType}
                        </Badge>
                      </Group>

                      <Group gap="xs" mt={4}>
                        {wattage && (
                          <Badge variant="outline" size="xs" color="orange">
                            {wattage}W
                          </Badge>
                        )}
                        {sl.ward && (
                          <Badge variant="outline" size="xs" color="blue">
                            {sl.ward}
                          </Badge>
                        )}
                        {sl.lampStatus && (
                          <Badge
                            variant="outline"
                            size="xs"
                            color={sl.lampStatus === 'operational' ? 'green' : sl.lampStatus === 'damaged' ? 'red' : 'gray'}
                          >
                            {sl.lampStatus}
                          </Badge>
                        )}
                      </Group>

                      <Text size="xs" c="dimmed" ff="monospace" mt={4}>
                        ID: {sl.id}
                      </Text>
                    </div>
                  </Group>
                </Card>
              );
            })
          )}
        </Stack>
      </Tabs.Panel>
    </Tabs>
  );
}

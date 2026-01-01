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
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconSearch, IconFilter, IconChevronDown, IconCheck, IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useAssets, useAsset, useWards } from '../../hooks/useApi';
import { useUIStore } from '../../stores/uiStore';
import type { RoadAsset, RoadType, AssetStatus } from '@nagoya/shared';

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

export function AssetList() {
  // Local UI state
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [offset, setOffset] = useState(0);
  const [loadedAssets, setLoadedAssets] = useState<RoadAsset[]>([]);

  // Inline edit state for manual naming
  const [editName, setEditName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Persisted filter state from store (including filtersOpen)
  const { selectedAssetId, selectAsset, assetFilters, setAssetFilter, mapBbox, setHoveredAsset, filtersOpen, setFiltersOpen } = useUIStore();
  const { roadType: roadTypeFilter, status: statusFilter, ward: wardFilter, search: searchInput, unnamed: unnamedFilter, filterByMapView } = assetFilters;
  const [debouncedSearch] = useDebouncedValue(searchInput, 300);

  const { data: wardsData } = useWards();
  const { data, isLoading, error, isFetching } = useAssets({
    roadType: roadTypeFilter as RoadType | undefined,
    status: statusFilter as AssetStatus | undefined,
    ward: wardFilter || undefined,
    q: debouncedSearch || undefined,
    unnamed: unnamedFilter || undefined,
    bbox: filterByMapView ? mapBbox ?? undefined : undefined,  // Filter by visible area when enabled
    filterByMapView: filterByMapView || undefined,
    limit: LIMIT,
    offset: offset,
    includeTotal: true,
  });

  // Always fetch selected asset individually to pin it at top until deselected
  const { data: selectedAssetData } = useAsset(selectedAssetId);

  // Compute active filter count (include unnamed and filterByMapView toggles)
  const activeFilterCount = [roadTypeFilter, statusFilter, wardFilter, unnamedFilter, filterByMapView].filter(Boolean).length;

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

  // Compute display list: always pin selected asset at top until deselected
  const displayList = useMemo(() => {
    const selectedAsset = selectedAssetData?.data;
    if (selectedAsset) {
      // Remove from natural position (if present) and prepend to top
      const filtered = loadedAssets.filter((a) => a.id !== selectedAsset.id);
      return [selectedAsset, ...filtered];
    }
    return loadedAssets;
  }, [loadedAssets, selectedAssetData?.data]);

  // Track previous selectedAssetId to detect actual selection changes
  const prevSelectedAssetIdRef = useRef<string | null>(null);

  // Scroll to selected asset only when selection changes (not on zoom/pan)
  useEffect(() => {
    if (!selectedAssetId) {
      prevSelectedAssetIdRef.current = null;
      return;
    }

    // Only scroll if this is a new selection
    if (prevSelectedAssetIdRef.current === selectedAssetId) return;
    prevSelectedAssetIdRef.current = selectedAssetId;

    // Small delay to ensure card is rendered after state update
    const scrollToCard = () => {
      const card = cardRefs.current.get(selectedAssetId);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    const timer = setTimeout(scrollToCard, 100);
    return () => clearTimeout(timer);
  }, [selectedAssetId, selectedAssetData?.data]);

  // Reset edit state when selection changes
  useEffect(() => {
    setEditName('');
  }, [selectedAssetId]);

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

      const result = await response.json();

      // Update local state with new name
      setLoadedAssets((prev) =>
        prev.map((a) =>
          a.id === assetId
            ? { ...a, displayName: result.data.displayName, nameSource: 'manual' }
            : a
        )
      );

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

  return (
    <Stack gap="sm">
      <Text fw={600}>Road Assets ({data?.meta?.total ?? loadedAssets.length})</Text>

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

          <div>
            <Text size="xs" c="dimmed" fw={600} mb={4}>Map</Text>
            <Chip.Group
              multiple
              value={filterByMapView ? ['mapView'] : []}
              onChange={(val) => setAssetFilter('filterByMapView', val.includes('mapView'))}
            >
              <Group gap="xs">
                <Chip value="mapView" size="xs">Visible Area Only</Chip>
              </Group>
            </Chip.Group>
          </div>
        </Stack>
      </Collapse>

      <Stack gap="xs">
        {displayList.map((asset: RoadAsset) => {
          // Use displayName from API (already has fallback chain: name || nameJa || ref || localRef)
          // 'Unnamed Road' appears ONLY in UI when displayName is also null
          const displayText = asset.displayName || 'Unnamed Road';
          // Check if road is truly unnamed (no name, nameJa, ref, or localRef)
          const isUnnamed = !asset.displayName;

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
              }}
              onClick={() => selectAsset(asset.id, asset.geometry)}
              onMouseEnter={() => setHoveredAsset(asset.id)}
              onMouseLeave={() => setHoveredAsset(null)}
            >
              <Group justify="space-between" mb={4}>
                <Text fw={500} size="sm" lineClamp={1}>
                  {displayText}{asset.ward ? ` · ${asset.ward}` : ''}
                </Text>
                <Badge color={ROAD_TYPE_COLORS[asset.roadType]} size="sm">
                  {ROAD_TYPE_LABELS[asset.roadType]}
                </Badge>
              </Group>

              <Group gap="xs" mb={4}>
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
                    color={asset.nameSource === 'osm' ? 'blue' : 'teal'}
                  >
                    {asset.nameSource === 'osm' ? 'OSM' : '手動'}
                  </Badge>
                )}
              </Group>

              {asset.landmark && (
                <Text size="xs" c="dimmed">
                  Near: {asset.landmark}
                </Text>
              )}

              <Text
                size="xs"
                c={isUnnamed ? 'dark' : 'dimmed'}
                fw={isUnnamed ? 500 : undefined}
                ff="monospace"
              >
                ID: {asset.id}
              </Text>

              {/* Inline edit for selected unnamed roads */}
              {selectedAssetId === asset.id && isUnnamed && (
                <Group mt="xs" gap="xs" onClick={(e) => e.stopPropagation()}>
                  <TextInput
                    size="xs"
                    placeholder="Enter road name..."
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName(asset.id);
                      if (e.key === 'Escape') setEditName('');
                    }}
                    style={{ flex: 1 }}
                    disabled={isSaving}
                  />
                  <ActionIcon
                    variant="filled"
                    color="green"
                    size="sm"
                    onClick={() => handleSaveName(asset.id)}
                    loading={isSaving}
                    disabled={!editName.trim()}
                  >
                    <IconCheck size={14} />
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    onClick={() => setEditName('')}
                    disabled={isSaving}
                  >
                    <IconX size={14} />
                  </ActionIcon>
                </Group>
              )}
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
  );
}

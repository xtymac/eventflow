import { useState, useEffect, useRef } from 'react';
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
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconSearch, IconFilter, IconChevronDown } from '@tabler/icons-react';
import { useAssets, useWards } from '../../hooks/useApi';
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
  // UI-only state (not persisted)
  const [filtersOpen, setFiltersOpen] = useState(false);
  const wasManuallyClosedRef = useRef(false);
  const prevFilterCountRef = useRef(0);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [offset, setOffset] = useState(0);
  const [loadedAssets, setLoadedAssets] = useState<RoadAsset[]>([]);

  // Persisted filter state from store
  const { selectedAssetId, selectAsset, assetFilters, setAssetFilter, mapBbox, setHoveredAsset } = useUIStore();
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

  // Compute active filter count (include unnamed and filterByMapView toggles)
  const activeFilterCount = [roadTypeFilter, statusFilter, wardFilter, unnamedFilter, filterByMapView].filter(Boolean).length;

  // Auto-expand filters when going from 0 → >0 (respect user intent)
  useEffect(() => {
    if (prevFilterCountRef.current === 0 && activeFilterCount > 0 && !wasManuallyClosedRef.current) {
      setFiltersOpen(true);
    }
    if (activeFilterCount === 0) {
      wasManuallyClosedRef.current = false;
    }
    prevFilterCountRef.current = activeFilterCount;
  }, [activeFilterCount]);

  // Toggle handler (sets manual-close flag)
  const handleToggleFilters = () => {
    const nextOpen = !filtersOpen;
    setFiltersOpen(nextOpen);
    if (!nextOpen) {
      wasManuallyClosedRef.current = true;
    }
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

  // Scroll to selected asset when it changes
  useEffect(() => {
    if (selectedAssetId) {
      const card = cardRefs.current.get(selectedAssetId);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedAssetId]);

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
        {loadedAssets.map((asset: RoadAsset) => {
          // Compute display values (match backend unnamed logic)
          const trimmedName = asset.name?.trim() || '';
          const isUnnamed = trimmedName === '' || trimmedName.toLowerCase() === 'unnamed road';
          const displayName = isUnnamed ? 'Unnamed Road' : asset.name;

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
                  {displayName}{asset.ward ? ` · ${asset.ward}` : ''}
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
            </Card>
          );
        })}

        {loadedAssets.length === 0 && !isLoading && !isFetching && (!data?.data || data.data.length === 0) && (
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

import { useState, useEffect } from 'react';
import { MultiSelect, Select, Text, Stack, Loader, Group, Button } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useAssets, useWards } from '../../hooks/useApi';
import type { RoadAsset } from '@nagoya/shared';

const LIMIT = 100;

const formatAssetLabel = (asset: RoadAsset) =>
  `${asset.name} (${asset.ward || 'No ward'}) - ${asset.id}`;

interface RoadAssetSelectorProps {
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  required?: boolean;
  error?: string;
}

export function RoadAssetSelector({
  value,
  onChange,
  label = 'Road Assets',
  required = false,
  error,
}: RoadAssetSelectorProps) {
  const [wardFilter, setWardFilter] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchValue, 300);
  const [offset, setOffset] = useState(0);
  const [loadedOptions, setLoadedOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);

  const { data: wardsData, isLoading: wardsLoading } = useWards();
  const { data, isLoading, isFetching } = useAssets({
    status: 'active',
    ward: wardFilter || undefined,
    q: debouncedSearch || undefined,
    limit: LIMIT,
    offset: offset,
    includeTotal: true,
  });

  // Reset offset when search/ward changes
  useEffect(() => {
    setOffset(0);
  }, [debouncedSearch, wardFilter]);

  // Populate options when data arrives
  // Include filter deps to handle cache hits (same data reference)
  useEffect(() => {
    if (!data?.data) {
      setLoadedOptions([]);
      return;
    }

    const newOptions = data.data.map((asset) => ({
      value: asset.id,
      label: formatAssetLabel(asset),
    }));

    if (offset === 0) {
      // Replace all when offset is 0 (initial load or after filter change)
      setLoadedOptions(newOptions);
    } else {
      // For pagination, append with dedup
      setLoadedOptions((prev) => {
        const existingIds = new Set(prev.map((o) => o.value));
        const uniqueNew = newOptions.filter((o) => !existingIds.has(o.value));
        return [...prev, ...uniqueNew];
      });
    }
  }, [data, offset, debouncedSearch, wardFilter]);

  // hasNextPage logic (handles total=null)
  const hasNextPage =
    data?.meta?.total != null
      ? loadedOptions.length < data.meta.total
      : data?.data?.length === LIMIT;

  const wardOptions =
    wardsData?.data.map((ward) => ({
      value: ward,
      label: ward,
    })) ?? [];

  if (isLoading || wardsLoading) {
    return (
      <Stack gap="xs">
        <Text size="sm" fw={500}>
          {label}
          {required && <span style={{ color: 'red' }}> *</span>}
        </Text>
        <Loader size="sm" />
      </Stack>
    );
  }

  return (
    <Stack gap="xs">
      <Group grow>
        <Select
          label="Filter by Ward"
          placeholder="All wards"
          data={wardOptions}
          value={wardFilter}
          onChange={setWardFilter}
          clearable
          size="sm"
        />
      </Group>
      <MultiSelect
        label={label}
        placeholder="Search and select road assets..."
        data={loadedOptions}
        value={value}
        onChange={onChange}
        searchable
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        // Disable local filtering since we use server-side search
        filter={({ options }) => options}
        clearable
        required={required}
        error={error}
        maxDropdownHeight={200}
        nothingFoundMessage={
          wardFilter
            ? `No road assets found in ${wardFilter}`
            : 'No road assets found'
        }
      />
      {hasNextPage && (
        <Button
          variant="subtle"
          size="xs"
          onClick={() => setOffset((prev) => prev + LIMIT)}
          loading={isFetching}
        >
          Load more assets...
        </Button>
      )}
    </Stack>
  );
}

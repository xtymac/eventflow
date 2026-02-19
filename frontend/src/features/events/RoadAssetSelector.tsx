import { useState, useEffect } from 'react';
import { Stack, Group, Text, Loader } from '@/components/shims';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useDebounce } from 'use-debounce';
import { useAssets, useWards } from '../../hooks/useApi';
import { getRoadAssetLabel, isRoadAssetUnnamed } from '../../utils/roadAssetLabel';
import type { RoadAsset } from '@nagoya/shared';

const LIMIT = 100;

const formatAssetLabel = (asset: RoadAsset) => {
  const label = getRoadAssetLabel(asset);
  const wardLabel = asset.ward || 'No ward';
  if (isRoadAssetUnnamed(asset)) {
    return `${label} (${wardLabel})`;
  }
  return `${label} (${wardLabel}) - ${asset.id}`;
};

interface RoadAssetSelectorProps {
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  required?: boolean;
  error?: string;
  initialWard?: string | null;
  isLoadingIntersecting?: boolean;
}

export function RoadAssetSelector({
  value,
  onChange,
  label = 'Road Assets',
  required = false,
  error,
  initialWard = null,
  isLoadingIntersecting = false,
}: RoadAssetSelectorProps) {
  const [wardFilter, setWardFilter] = useState<string | null>(initialWard);
  const [hasSetInitialWard, setHasSetInitialWard] = useState(false);

  // Set initial ward filter when prop changes (only once)
  useEffect(() => {
    if (initialWard && !hasSetInitialWard) {
      setWardFilter(initialWard);
      setHasSetInitialWard(true);
    }
  }, [initialWard, hasSetInitialWard]);
  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch] = useDebounce(searchValue, 300);
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

  const selectedSet = new Set(value);

  const handleToggle = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  const handleRemove = (id: string) => {
    onChange(value.filter((v) => v !== id));
  };

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
        <div className="flex flex-col gap-1">
          <Label className="text-sm">Filter by Ward</Label>
          <Select
            value={wardFilter || undefined}
            onValueChange={(val) => setWardFilter(val || null)}
          >
            <SelectTrigger className="w-full">
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
      </Group>

      {/* Label with loading indicator */}
      <div className="flex items-center gap-1.5">
        <Label className="text-sm">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        {isLoadingIntersecting && (
          <Group gap={4}>
            <Loader size="xs" />
            <Text size="xs" c="dimmed">Loading intersecting roads...</Text>
          </Group>
        )}
      </div>

      {/* Selected items as badges */}
      {value.length > 0 && (
        <Group gap="xs" className="flex-wrap">
          {value.map((id) => {
            const opt = loadedOptions.find((o) => o.value === id);
            return (
              <Badge
                key={id}
                variant="secondary"
                className="cursor-pointer pr-1"
                onClick={() => handleRemove(id)}
              >
                {opt?.label || id}
                <span className="ml-1 text-muted-foreground hover:text-foreground">&times;</span>
              </Badge>
            );
          })}
        </Group>
      )}

      {/* Search input */}
      <Input
        placeholder="Search and select road assets..."
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        className="h-8 text-sm"
      />

      {/* Scrollable options list */}
      <div className="border rounded max-h-[200px] overflow-y-auto">
        {loadedOptions.length === 0 ? (
          <div className="p-3 text-center text-sm text-muted-foreground">
            {wardFilter
              ? `No road assets found in ${wardFilter}`
              : 'No road assets found'}
          </div>
        ) : (
          loadedOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`w-full text-left px-2 py-1.5 text-sm hover:bg-accent transition-colors ${
                selectedSet.has(opt.value) ? 'bg-accent' : ''
              }`}
              onClick={() => handleToggle(opt.value)}
            >
              {opt.label}
            </button>
          ))
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {hasNextPage && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOffset((prev) => prev + LIMIT)}
          disabled={isFetching}
          type="button"
        >
          Load more assets...
        </Button>
      )}
    </Stack>
  );
}

import { useRef, useEffect } from 'react';
import {
  TextInput,
  Paper,
  Stack,
  Text,
  Group,
  Loader,
  ActionIcon,
  Collapse,
  ScrollArea,
  Kbd,
  Alert,
} from '@mantine/core';
import { useHotkeys, useClickOutside } from '@mantine/hooks';
import {
  IconX,
  IconMapPin,
  IconAlertTriangle,
  IconMap2,
} from '@tabler/icons-react';
import { useMapSearch } from '../hooks/useMapSearch';
import { useSearchStore } from '../stores/searchStore';
import { useUIStore } from '../stores/uiStore';
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

  const { setFlyToGeometry } = useUIStore();

  const { data, isLoading, isFetching, error } = useMapSearch(query, {
    enabled: isOpen && query.length >= 2,
  });

  // Show loading when:
  // 1. Actually fetching (isLoading or isFetching)
  // 2. Query is valid but we don't have matching results yet (debounce delay)
  const isValidQuery = query.trim().length >= 2;
  const hasMatchingResults = data?.meta?.query === query.trim();
  const showLoading = isLoading || isFetching || (isValidQuery && !hasMatchingResults && !error);

  // Click outside to close dropdown
  useClickOutside(() => setIsOpen(false), null, [dropdownRef.current, inputRef.current].filter(Boolean) as HTMLElement[]);

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
  useHotkeys([
    ['mod+k', (e) => {
      e.preventDefault();
      setIsOpen(true);
      inputRef.current?.focus();
    }],
    ['Escape', () => {
      if (isOpen) {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    }],
  ]);

  const handleSelect = (result: SearchResult) => {
    selectResult(result.id);

    // Set search center to show pin marker on map
    setSearchCenter(result.coordinates);

    // Fly to result location
    const geometry = {
      type: 'Point' as const,
      coordinates: result.coordinates,
    };
    setFlyToGeometry(geometry, true);

    // Close dropdown
    setIsOpen(false);
  };

  const handleClear = () => {
    setQuery('');
    clearSearch();
    inputRef.current?.focus();
  };

  const places = data?.data?.places || [];
  const hasError = data?.meta?.error;
  const isOutOfBounds = hasError === 'OUTSIDE_BOUNDS';
  const isCoordinateSearch = data?.data?.isCoordinateSearch;

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%', maxWidth: 360 }}>
      <TextInput
        ref={inputRef}
        placeholder="場所を検索 / 座標入力... ⌘K"
        leftSection={<IconMap2 size={16} />}
        rightSection={
          query ? (
            <ActionIcon
              size="sm"
              variant="subtle"
              onClick={handleClear}
              aria-label="Clear search"
            >
              <IconX size={14} />
            </ActionIcon>
          ) : (
            <Kbd size="xs">K</Kbd>
          )
        }
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
        radius="xl"
        styles={{
          input: {
            backgroundColor: 'var(--mantine-color-body)',
            transition: 'border-color 0.2s ease',
            '&:focus': {
              borderColor: 'var(--mantine-color-blue-5)',
            },
          },
        }}
      />

      <Collapse in={isOpen && query.length >= 2 && !isCoordinateSearch}>
        <Paper
          shadow="md"
          p="sm"
          withBorder
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 1000,
            maxHeight: 350,
          }}
        >
          {showLoading ? (
            <Group justify="center" py="md">
              <Loader size="sm" />
              <Text size="sm" c="dimmed">検索中...</Text>
            </Group>
          ) : error ? (
            <Text size="sm" c="red" ta="center" py="md">
              検索エラーが発生しました
            </Text>
          ) : isOutOfBounds ? (
            <Alert color="yellow" icon={<IconAlertTriangle size={16} />} py="xs">
              <Text size="sm">
                {data?.meta?.errorMessage || '指定された座標は名古屋市の範囲外です'}
              </Text>
            </Alert>
          ) : places.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="md">
              「{query}」の検索結果がありません
            </Text>
          ) : (
            <ScrollArea.Autosize mah={300}>
              <Stack gap="xs">
                {places.map((result) => (
                  <Paper
                    key={result.id}
                    p="xs"
                    withBorder
                    style={{
                      cursor: 'pointer',
                      backgroundColor: selectedResultId === result.id ? 'var(--mantine-color-blue-0)' : undefined,
                      borderColor: selectedResultId === result.id ? 'var(--mantine-color-blue-5)' : undefined,
                    }}
                    onClick={() => handleSelect(result)}
                  >
                    <Group gap="xs" wrap="nowrap">
                      <IconMapPin size={16} style={{ flexShrink: 0, color: 'var(--mantine-color-blue-6)' }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <Text size="sm" fw={500} lineClamp={1}>
                          {result.name}
                        </Text>
                        {result.address && (
                          <Text size="xs" c="dimmed" lineClamp={1}>
                            {result.address}
                          </Text>
                        )}
                      </div>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </ScrollArea.Autosize>
          )}
        </Paper>
      </Collapse>
    </div>
  );
}

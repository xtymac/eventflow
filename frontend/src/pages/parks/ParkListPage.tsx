import { useState, useMemo } from 'react';
import { Box, TextInput, Text, Group, Stack, ScrollArea } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useAllGreenSpaces } from '../../hooks/useApi';
import { PageState } from '../../components/PageState';

// Dummy data for demo when API returns no results
const DUMMY_PARKS = [
  { id: 'park-0001', displayName: '鶴舞公園', ward: '昭和区', greenSpaceType: 'park', areaM2: 23800, status: 'active' },
  { id: 'park-0002', displayName: '名城公園', ward: '北区', greenSpaceType: 'park', areaM2: 801000, status: 'active' },
  { id: 'park-0003', displayName: '東山公園', ward: '千種区', greenSpaceType: 'park', areaM2: 598000, status: 'active' },
  { id: 'park-0004', displayName: '白川公園', ward: '中区', greenSpaceType: 'park', areaM2: 36200, status: 'active' },
  { id: 'park-0005', displayName: '庄内緑地公園', ward: '西区', greenSpaceType: 'park', areaM2: 441000, status: 'active' },
  { id: 'park-0006', displayName: '大高緑地', ward: '緑区', greenSpaceType: 'forest', areaM2: 1216000, status: 'active' },
  { id: 'park-0007', displayName: '荒子川公園', ward: '港区', greenSpaceType: 'park', areaM2: 291000, status: 'active' },
  { id: 'park-0008', displayName: '戸田川緑地', ward: '港区', greenSpaceType: 'park', areaM2: 375000, status: 'active' },
  { id: 'park-0009', displayName: '久屋大通公園', ward: '中区', greenSpaceType: 'park', areaM2: 56100, status: 'active' },
  { id: 'park-0010', displayName: '徳川園', ward: '東区', greenSpaceType: 'garden', areaM2: 25500, status: 'active' },
  { id: 'park-0011', displayName: '猪高緑地', ward: '名東区', greenSpaceType: 'forest', areaM2: 660000, status: 'active' },
  { id: 'park-0012', displayName: '相生山緑地', ward: '天白区', greenSpaceType: 'forest', areaM2: 520000, status: 'active' },
  { id: 'park-0013', displayName: '牧野ヶ池緑地', ward: '名東区', greenSpaceType: 'park', areaM2: 1478000, status: 'active' },
  { id: 'park-0014', displayName: '小幡緑地', ward: '守山区', greenSpaceType: 'park', areaM2: 1520000, status: 'active' },
  { id: 'park-0015', displayName: '笠寺公園', ward: '南区', greenSpaceType: 'park', areaM2: 48500, status: 'active' },
  { id: 'park-0016', displayName: '志賀公園', ward: '北区', greenSpaceType: 'park', areaM2: 37800, status: 'inactive' },
  { id: 'park-0017', displayName: '瑞穂公園', ward: '瑞穂区', greenSpaceType: 'park', areaM2: 342000, status: 'active' },
  { id: 'park-0018', displayName: '熱田神宮公園', ward: '熱田区', greenSpaceType: 'park', areaM2: 195000, status: 'active' },
  { id: 'park-0019', displayName: '中川公園', ward: '中川区', greenSpaceType: 'park', areaM2: 28900, status: 'under_construction' },
  { id: 'park-0020', displayName: '千種公園', ward: '千種区', greenSpaceType: 'park', areaM2: 52000, status: 'active' },
].map((p) => ({ type: 'Feature' as const, geometry: { type: 'Polygon' as const, coordinates: [] }, properties: p }));

export function ParkListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data, isLoading, isError } = useAllGreenSpaces();

  // Use API data if available, otherwise fall back to dummy data for demo
  const usingDummy = !data?.features?.length;
  const features = usingDummy ? DUMMY_PARKS : data.features;

  const parks = useMemo(() => {
    const filtered = features.filter((f: any) => {
      if (!search) return true;
      const s = search.toLowerCase();
      const p = f.properties;
      return (
        p.name?.toLowerCase().includes(s) ||
        p.nameJa?.toLowerCase().includes(s) ||
        p.displayName?.toLowerCase().includes(s) ||
        p.id?.toLowerCase().includes(s) ||
        p.ward?.toLowerCase().includes(s)
      );
    });
    return filtered.sort((a: any, b: any) => (a.properties.displayName || a.properties.name || '').localeCompare(b.properties.displayName || b.properties.name || '', 'ja'));
  }, [features, search]);

  return (
    <Box p="lg" h="100%">
      <TextInput
        placeholder="Search (ID, Name, 市区町村)"
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        mb="lg"
      />

      <Text size="lg" fw={600} mb="sm">公園 List</Text>

      <PageState loading={!usingDummy && isLoading} error={!usingDummy && isError} empty={parks.length === 0} emptyMessage="公園データがありません">
        <ScrollArea h="calc(100vh - 240px)">
          <Stack gap={0}>
            {parks.map((f: any) => {
              const p = f.properties;
              return (
                <Box
                  key={p.id}
                  py="md"
                  px="lg"
                  onClick={() => navigate(`/park-mgmt/parks/${p.id}`)}
                  style={{
                    backgroundColor: '#f1f3f5',
                    marginBottom: 4,
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  <Group justify="space-between">
                    <Text fw={500} size="sm">{p.displayName || p.nameJa || p.name || '（無名）'}</Text>
                    <Text size="xs" c="dimmed">{p.ward || ''}</Text>
                  </Group>
                </Box>
              );
            })}
          </Stack>
        </ScrollArea>
      </PageState>
    </Box>
  );
}

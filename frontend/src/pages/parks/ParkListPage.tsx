import { useState, useMemo } from 'react';
import { Box, TextInput, Text, Group, Stack, ScrollArea } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useAllGreenSpaces } from '../../hooks/useApi';
import { PageState } from '../../components/PageState';

/** Map English ward names (from DB) to Japanese */
const WARD_JA: Record<string, string> = {
  'Atsuta-ku': '熱田区', 'Chikusa-ku': '千種区', 'Higashi-ku': '東区',
  'Kita-ku': '北区', 'Meito-ku': '名東区', 'Midori-ku': '緑区',
  'Minami-ku': '南区', 'Minato-ku': '港区', 'Mizuho-ku': '瑞穂区',
  'Moriyama-ku': '守山区', 'Naka-ku': '中区', 'Nakagawa-ku': '中川区',
  'Nakamura-ku': '中村区', 'Nishi-ku': '西区', 'Showa-ku': '昭和区',
  'Tempaku-ku': '天白区',
};

// Dummy data for demo when API returns no results
// IDs match real DB records (greenspace_assets) so detail pages can fetch actual polygon geometry
const DUMMY_PARKS = [
  { id: 'GS-zxpnkee2', displayName: '鶴舞公園', ward: '昭和区', greenSpaceType: 'park', areaM2: 236537, status: 'active' },
  { id: 'GS-nliigh01', displayName: '名城公園', ward: '北区', greenSpaceType: 'park', areaM2: 205208, status: 'active' },
  { id: 'GS-4g77l6x7', displayName: '東山動植物園', ward: '千種区', greenSpaceType: 'park', areaM2: 894903, status: 'active' },
  { id: 'GS-es1u7z8r', displayName: '白川公園', ward: '中区', greenSpaceType: 'park', areaM2: 89299, status: 'active' },
  { id: 'GS-9ego0pvp', displayName: '庄内緑地公園', ward: '西区', greenSpaceType: 'park', areaM2: 426621, status: 'active' },
  { id: 'GS-auy42b1p', displayName: '大高緑地公園', ward: '緑区', greenSpaceType: 'park', areaM2: 1102426, status: 'active' },
  { id: 'GS-gs3xyhbw', displayName: '荒子川公園', ward: '港区', greenSpaceType: 'park', areaM2: 237208, status: 'active' },
  { id: 'GS-3d67hwf5', displayName: '戸田川緑地', ward: '中川区', greenSpaceType: 'park', areaM2: 364075, status: 'active' },
  { id: 'GS-byrogagk', displayName: '久屋大通公園', ward: '中区', greenSpaceType: 'park', areaM2: 105736, status: 'active' },
  { id: 'GS-ful7d9lw', displayName: '徳川園', ward: '東区', greenSpaceType: 'garden', areaM2: 55029, status: 'active' },
  { id: 'GS-7f2voyoy', displayName: '猪高緑地', ward: '名東区', greenSpaceType: 'park', areaM2: 631296, status: 'active' },
  { id: 'GS-x1q5e2te', displayName: '牧野ヶ池緑地', ward: '名東区', greenSpaceType: 'park', areaM2: 1351901, status: 'active' },
  { id: 'GS-ldnfwyur', displayName: '小幡緑地公園', ward: '守山区', greenSpaceType: 'park', areaM2: 131662, status: 'active' },
  { id: 'GS-9exy95g1', displayName: '笠寺公園', ward: '南区', greenSpaceType: 'park', areaM2: 65235, status: 'active' },
  { id: 'GS-xk4kyf2q', displayName: '志賀公園', ward: '北区', greenSpaceType: 'park', areaM2: 51705, status: 'active' },
  { id: 'GS-cfam78i3', displayName: '瑞穂公園', ward: '瑞穂区', greenSpaceType: 'park', areaM2: 239836, status: 'active' },
  { id: 'GS-gul3d3ul', displayName: '熱田神宮公園', ward: '熱田区', greenSpaceType: 'park', areaM2: 78109, status: 'active' },
  { id: 'GS-rtljov09', displayName: '千種公園', ward: '千種区', greenSpaceType: 'park', areaM2: 58659, status: 'active' },
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
                    <Text size="xs" c="dimmed">{WARD_JA[p.ward] || p.ward || ''}</Text>
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

import { Box, Breadcrumbs, Anchor, Text, Group, Paper, SimpleGrid, Badge, ActionIcon, ScrollArea, Stack } from '@mantine/core';
import { IconPencil } from '@tabler/icons-react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useGreenSpace, useParkFacilitiesByPark } from '../../hooks/useApi';
import { PageState } from '../../components/PageState';
import { MiniMap } from '../../components/MiniMap';

const GREEN_SPACE_TYPE_LABELS: Record<string, string> = {
  park: '公園', garden: '庭園', forest: '森林', meadow: '草地',
  nature_reserve: '自然保護区', recreation_ground: 'レクリエーション',
};

// Dummy data for demo when API is unavailable
// center: [lng, lat] approximate coordinates for map display
const DUMMY_PARKS: Record<string, any> = {
  'park-0001': { id: 'park-0001', displayName: '鶴舞公園', ward: '昭和区', greenSpaceType: 'park', areaM2: 23800, status: 'active', operator: '名古屋市', vegetationType: '混合林', center: [136.9213, 35.1575] },
  'park-0002': { id: 'park-0002', displayName: '名城公園', ward: '北区', greenSpaceType: 'park', areaM2: 801000, status: 'active', operator: '名古屋市', vegetationType: '混合林', center: [136.9050, 35.1860] },
  'park-0003': { id: 'park-0003', displayName: '東山公園', ward: '千種区', greenSpaceType: 'park', areaM2: 598000, status: 'active', operator: '名古屋市', vegetationType: '広葉樹', center: [136.9740, 35.1570] },
  'park-0004': { id: 'park-0004', displayName: '白川公園', ward: '中区', greenSpaceType: 'park', areaM2: 36200, status: 'active', operator: '名古屋市', vegetationType: '混合林', center: [136.8980, 35.1650] },
  'park-0005': { id: 'park-0005', displayName: '庄内緑地公園', ward: '西区', greenSpaceType: 'park', areaM2: 441000, status: 'active', operator: '名古屋市', vegetationType: '混合林', center: [136.8780, 35.2010] },
  'park-0006': { id: 'park-0006', displayName: '大高緑地', ward: '緑区', greenSpaceType: 'forest', areaM2: 1216000, status: 'active', operator: '愛知県', vegetationType: '広葉樹', center: [136.9410, 35.0780] },
  'park-0007': { id: 'park-0007', displayName: '荒子川公園', ward: '港区', greenSpaceType: 'park', areaM2: 291000, status: 'active', operator: '名古屋市', vegetationType: '混合林', center: [136.8640, 35.1170] },
  'park-0008': { id: 'park-0008', displayName: '戸田川緑地', ward: '港区', greenSpaceType: 'park', areaM2: 375000, status: 'active', operator: '名古屋市', vegetationType: '混合林', center: [136.8350, 35.0970] },
  'park-0009': { id: 'park-0009', displayName: '久屋大通公園', ward: '中区', greenSpaceType: 'park', areaM2: 56100, status: 'active', operator: '名古屋市', vegetationType: '混合林', center: [136.9110, 35.1720] },
  'park-0010': { id: 'park-0010', displayName: '徳川園', ward: '東区', greenSpaceType: 'garden', areaM2: 25500, status: 'active', operator: '名古屋市', vegetationType: '日本庭園', center: [136.9340, 35.1870] },
  'park-0011': { id: 'park-0011', displayName: '猪高緑地', ward: '名東区', greenSpaceType: 'forest', areaM2: 660000, status: 'active', operator: '名古屋市', vegetationType: '広葉樹', center: [137.0100, 35.1780] },
  'park-0012': { id: 'park-0012', displayName: '相生山緑地', ward: '天白区', greenSpaceType: 'forest', areaM2: 520000, status: 'active', operator: '名古屋市', vegetationType: '広葉樹', center: [136.9700, 35.1170] },
  'park-0013': { id: 'park-0013', displayName: '牧野ヶ池緑地', ward: '名東区', greenSpaceType: 'park', areaM2: 1478000, status: 'active', operator: '名古屋市', vegetationType: '混合林', center: [137.0200, 35.1650] },
  'park-0014': { id: 'park-0014', displayName: '小幡緑地', ward: '守山区', greenSpaceType: 'park', areaM2: 1520000, status: 'active', operator: '名古屋市', vegetationType: '混合林', center: [136.9780, 35.2050] },
  'park-0015': { id: 'park-0015', displayName: '笠寺公園', ward: '南区', greenSpaceType: 'park', areaM2: 48500, status: 'active', operator: '名古屋市', vegetationType: '混合林', center: [136.9370, 35.1060] },
  'park-0016': { id: 'park-0016', displayName: '志賀公園', ward: '北区', greenSpaceType: 'park', areaM2: 37800, status: 'inactive', operator: '名古屋市', vegetationType: '混合林', center: [136.9100, 35.2020] },
  'park-0017': { id: 'park-0017', displayName: '瑞穂公園', ward: '瑞穂区', greenSpaceType: 'park', areaM2: 342000, status: 'active', operator: '名古屋市', vegetationType: '混合林', center: [136.9370, 35.1350] },
  'park-0018': { id: 'park-0018', displayName: '熱田神宮公園', ward: '熱田区', greenSpaceType: 'park', areaM2: 195000, status: 'active', operator: '名古屋市', vegetationType: '混合林', center: [136.9080, 35.1280] },
  'park-0019': { id: 'park-0019', displayName: '中川公園', ward: '中川区', greenSpaceType: 'park', areaM2: 28900, status: 'under_construction', operator: '名古屋市', vegetationType: '混合林', center: [136.8540, 35.1530] },
  'park-0020': { id: 'park-0020', displayName: '千種公園', ward: '千種区', greenSpaceType: 'park', areaM2: 52000, status: 'active', operator: '名古屋市', vegetationType: '混合林', center: [136.9430, 35.1710] },
};

const DUMMY_FACILITIES: Record<string, any[]> = {
  'park-0001': [
    { id: 'fac-001', name: '鶴舞公園 トイレA', category: 'toilet', status: 'active' },
    { id: 'fac-002', name: '鶴舞公園 遊具広場', category: 'playground', status: 'active' },
    { id: 'fac-003', name: '鶴舞公園 ベンチ群A', category: 'bench', status: 'active' },
    { id: 'fac-004', name: '鶴舞公園 東屋', category: 'shelter', status: 'active' },
    { id: 'fac-005', name: '鶴舞公園 照明設備A', category: 'lighting', status: 'active' },
  ],
  'park-0002': [
    { id: 'fac-011', name: '名城公園 トイレA', category: 'toilet', status: 'active' },
    { id: 'fac-012', name: '名城公園 遊具広場', category: 'playground', status: 'active' },
    { id: 'fac-013', name: '名城公園 フェンスA', category: 'fence', status: 'active' },
    { id: 'fac-014', name: '名城公園 水飲み場', category: 'waterFountain', status: 'active' },
  ],
  'park-0003': [
    { id: 'fac-021', name: '東山公園 トイレA', category: 'toilet', status: 'active' },
    { id: 'fac-022', name: '東山公園 ベンチ群A', category: 'bench', status: 'active' },
    { id: 'fac-023', name: '東山公園 案内板', category: 'signBoard', status: 'active' },
  ],
};

/** Generate an approximate polygon from center [lng, lat] and area in m². */
function makeApproxPolygon(center: [number, number], areaM2: number) {
  const side = Math.sqrt(areaM2);
  const latDeg = (side / 2) / 111000;
  const lngDeg = (side / 2) / (111000 * Math.cos((center[1] * Math.PI) / 180));
  const [lng, lat] = center;
  return {
    type: 'Polygon' as const,
    coordinates: [[
      [lng - lngDeg, lat - latDeg],
      [lng + lngDeg, lat - latDeg],
      [lng + lngDeg, lat + latDeg],
      [lng - lngDeg, lat + latDeg],
      [lng - lngDeg, lat - latDeg],
    ]],
  };
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <Group gap="xs" py={4}>
      <Text size="sm" c="dimmed" w={120} style={{ flexShrink: 0 }}>{label}</Text>
      <Text size="sm">{value}</Text>
    </Group>
  );
}

export function ParkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: parkData, isLoading, isError } = useGreenSpace(id ?? null);
  const { data: facilitiesData, isLoading: facilitiesLoading } = useParkFacilitiesByPark(id ?? null);

  // Use API data if available, otherwise fall back to dummy data for demo
  const apiPark = parkData?.properties;
  const dummyPark = id ? DUMMY_PARKS[id] : null;
  const park = apiPark || dummyPark;
  const usingDummy = !apiPark && !!dummyPark;
  const geometry = parkData?.geometry
    || (usingDummy && dummyPark?.center && dummyPark?.areaM2
      ? makeApproxPolygon(dummyPark.center, dummyPark.areaM2)
      : undefined);

  const apiFacilities = facilitiesData?.features || [];
  const dummyFacilities = id && DUMMY_FACILITIES[id] ? DUMMY_FACILITIES[id].map((f) => ({ properties: f })) : [];
  const facilities = apiFacilities.length > 0 ? apiFacilities : dummyFacilities;

  return (
    <ScrollArea h="calc(100vh - 60px)">
      <Box p="lg">
        {/* Breadcrumb */}
        <Breadcrumbs mb="md">
          <Anchor component={Link} to="/park-mgmt/parks" size="sm">公園</Anchor>
          <Text size="sm">{park?.displayName || park?.nameJa || park?.name || '読み込み中...'}</Text>
        </Breadcrumbs>

        <PageState loading={!usingDummy && isLoading} error={!usingDummy && isError} empty={!park} emptyMessage="公園が見つかりません">
          {park && (
            <Stack gap="lg">
              {/* 公園マップ */}
              {geometry ? (
                <MiniMap geometry={geometry} height={250} fillColor="#22C55E" />
              ) : park.center ? (
                <MiniMap
                  center={park.center as [number, number]}
                  markers={[{ lng: park.center[0], lat: park.center[1], color: '#22C55E' }]}
                  zoom={15}
                  height={250}
                />
              ) : null}

              {/* 公園情報 */}
              <Paper withBorder p="md" radius="md">
                <Group justify="space-between">
                  <Text fw={600}>公園情報</Text>
                  <ActionIcon variant="subtle" color="gray" size="sm">
                    <IconPencil size={16} />
                  </ActionIcon>
                </Group>
                <SimpleGrid cols={{ base: 1, md: 2 }} mt="sm">
                  <div>
                    <InfoRow label="名称" value={park.displayName || park.nameJa || park.name} />
                    <InfoRow label="種別" value={GREEN_SPACE_TYPE_LABELS[park.greenSpaceType] || park.greenSpaceType} />
                    <InfoRow label="面積" value={park.areaM2 ? `${Math.round(park.areaM2).toLocaleString()} m²` : null} />
                    <InfoRow label="植生" value={park.vegetationType} />
                  </div>
                  <div>
                    <InfoRow label="管理者" value={park.operator} />
                    <InfoRow label="区" value={park.ward} />
                    <InfoRow
                      label="状態"
                      value={<Badge color={park.status === 'active' ? 'green' : 'gray'} variant="light" size="sm">{park.status}</Badge>}
                    />
                    <InfoRow
                      label="リスク"
                      value={park.riskLevel ? <Badge color={park.riskLevel === 'high' ? 'red' : park.riskLevel === 'medium' ? 'yellow' : 'green'} variant="light" size="sm">{park.riskLevel}</Badge> : null}
                    />
                  </div>
                </SimpleGrid>
              </Paper>

              {/* 施設 List */}
              <Paper withBorder p="md" radius="md">
                <Group justify="space-between" mb="sm">
                  <Text fw={600}>施設 List</Text>
                  <Badge variant="light">{facilities.length} 件</Badge>
                </Group>

                <PageState loading={!usingDummy && facilitiesLoading} empty={facilities.length === 0} emptyMessage="この公園に施設はありません">
                  <Stack gap={0}>
                    {facilities.map((f: any) => {
                      const p = f.properties;
                      return (
                        <Box
                          key={p.id}
                          py="sm"
                          px="md"
                          onClick={() => navigate(`/park-mgmt/facilities/${p.id}`)}
                          style={{
                            backgroundColor: '#f1f3f5',
                            marginBottom: 4,
                            borderRadius: 4,
                            cursor: 'pointer',
                          }}
                        >
                          <Text size="sm" fw={500}>{p.name}</Text>
                        </Box>
                      );
                    })}
                  </Stack>
                </PageState>
              </Paper>

              {/* 公園内建ぺい率 */}
              <Paper withBorder p="md" radius="md">
                <Text fw={600} mb="sm">公園内建ぺい率</Text>
                <Text c="dimmed" size="sm" ta="center" py="xl">
                  公園内建ぺい率
                </Text>
              </Paper>
            </Stack>
          )}
        </PageState>
      </Box>
    </ScrollArea>
  );
}

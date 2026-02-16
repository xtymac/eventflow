import { useState } from 'react';
import { Box, Breadcrumbs, Anchor, Text, Group, Paper, SimpleGrid, Badge, ActionIcon, ScrollArea, Stack } from '@mantine/core';
import { IconPencil } from '@tabler/icons-react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import * as turf from '@turf/turf';
import { useGreenSpace, useParkFacilitiesByPark } from '../../hooks/useApi';
import { PageState } from '../../components/PageState';
import { MiniMap } from '../../components/MiniMap';
import { getDummyFacilitiesByPark } from '../../data/dummyFacilities';

const GREEN_SPACE_TYPE_LABELS: Record<string, string> = {
  park: '公園', garden: '庭園', forest: '森林', meadow: '草地',
  nature_reserve: '自然保護区', recreation_ground: 'レクリエーション',
};

/** Map English ward names (from DB) to Japanese */
const WARD_JA: Record<string, string> = {
  'Atsuta-ku': '熱田区', 'Chikusa-ku': '千種区', 'Higashi-ku': '東区',
  'Kita-ku': '北区', 'Meito-ku': '名東区', 'Midori-ku': '緑区',
  'Minami-ku': '南区', 'Minato-ku': '港区', 'Mizuho-ku': '瑞穂区',
  'Moriyama-ku': '守山区', 'Naka-ku': '中区', 'Nakagawa-ku': '中川区',
  'Nakamura-ku': '中村区', 'Nishi-ku': '西区', 'Showa-ku': '昭和区',
  'Tempaku-ku': '天白区',
};

// Dummy data for demo when API is unavailable
// IDs match real DB records (greenspace_assets) so API can fetch actual polygon geometry
const DUMMY_PARKS: Record<string, any> = {
  'GS-zxpnkee2': { id: 'GS-zxpnkee2', displayName: '鶴舞公園', ward: '昭和区', greenSpaceType: 'park', areaM2: 236537, status: 'active', operator: '名古屋市', vegetationType: '混合林', center: [136.9213, 35.1575] },
  'GS-nliigh01': { id: 'GS-nliigh01', displayName: '名城公園', ward: '北区', greenSpaceType: 'park', areaM2: 205208, status: 'active', operator: '名古屋市', vegetationType: '混合林', center: [136.9050, 35.1860] },
  'GS-4g77l6x7': { id: 'GS-4g77l6x7', displayName: '東山動植物園', ward: '千種区', greenSpaceType: 'park', areaM2: 894903, status: 'active', operator: '名古屋市', vegetationType: '広葉樹', center: [136.9740, 35.1570] },
  'GS-es1u7z8r': { id: 'GS-es1u7z8r', displayName: '白川公園', ward: '中区', greenSpaceType: 'park', areaM2: 89299, status: 'active', operator: '名古屋市', vegetationType: '混合林', center: [136.8980, 35.1650] },
  'GS-9ego0pvp': { id: 'GS-9ego0pvp', displayName: '庄内緑地公園', ward: '西区', greenSpaceType: 'park', areaM2: 426621, status: 'active', operator: '名古屋市', vegetationType: '混合林', center: [136.8780, 35.2010] },
  'GS-auy42b1p': { id: 'GS-auy42b1p', displayName: '大高緑地公園', ward: '緑区', greenSpaceType: 'park', areaM2: 1102426, status: 'active', operator: '愛知県', vegetationType: '広葉樹', center: [136.9410, 35.0780] },
  'GS-gs3xyhbw': { id: 'GS-gs3xyhbw', displayName: '荒子川公園', ward: '港区', greenSpaceType: 'park', areaM2: 237208, status: 'active', operator: '名古屋市', vegetationType: '混合林', center: [136.8640, 35.1170] },
  'GS-3d67hwf5': { id: 'GS-3d67hwf5', displayName: '戸田川緑地', ward: '中川区', greenSpaceType: 'park', areaM2: 364075, status: 'active', operator: '名古屋市', vegetationType: '混合林', center: [136.8350, 35.0970] },
  'GS-byrogagk': { id: 'GS-byrogagk', displayName: '久屋大通公園', ward: '中区', greenSpaceType: 'park', areaM2: 105736, status: 'active', operator: '名古屋市', vegetationType: '混合林', center: [136.9110, 35.1720] },
  'GS-ful7d9lw': { id: 'GS-ful7d9lw', displayName: '徳川園', ward: '東区', greenSpaceType: 'garden', areaM2: 55029, status: 'active', operator: '名古屋市', vegetationType: '日本庭園', center: [136.9340, 35.1870] },
  'GS-7f2voyoy': { id: 'GS-7f2voyoy', displayName: '猪高緑地', ward: '名東区', greenSpaceType: 'park', areaM2: 631296, status: 'active', operator: '名古屋市', vegetationType: '広葉樹', center: [137.0100, 35.1780] },
  'GS-x1q5e2te': { id: 'GS-x1q5e2te', displayName: '牧野ヶ池緑地', ward: '名東区', greenSpaceType: 'park', areaM2: 1351901, status: 'active', operator: '名古屋市', vegetationType: '混合林', center: [137.0200, 35.1650] },
  'GS-ldnfwyur': { id: 'GS-ldnfwyur', displayName: '小幡緑地公園', ward: '守山区', greenSpaceType: 'park', areaM2: 131662, status: 'active', operator: '名古屋市', vegetationType: '混合林', center: [136.9780, 35.2050] },
  'GS-9exy95g1': { id: 'GS-9exy95g1', displayName: '笠寺公園', ward: '南区', greenSpaceType: 'park', areaM2: 65235, status: 'active', operator: '名古屋市', vegetationType: '混合林', center: [136.9370, 35.1060] },
  'GS-xk4kyf2q': { id: 'GS-xk4kyf2q', displayName: '志賀公園', ward: '北区', greenSpaceType: 'park', areaM2: 51705, status: 'active', operator: '名古屋市', vegetationType: '混合林', center: [136.9100, 35.2020] },
  'GS-cfam78i3': { id: 'GS-cfam78i3', displayName: '瑞穂公園', ward: '瑞穂区', greenSpaceType: 'park', areaM2: 239836, status: 'active', operator: '名古屋市', vegetationType: '混合林', center: [136.9370, 35.1350] },
  'GS-gul3d3ul': { id: 'GS-gul3d3ul', displayName: '熱田神宮公園', ward: '熱田区', greenSpaceType: 'park', areaM2: 78109, status: 'active', operator: '名古屋市', vegetationType: '混合林', center: [136.9080, 35.1280] },
  'GS-rtljov09': { id: 'GS-rtljov09', displayName: '千種公園', ward: '千種区', greenSpaceType: 'park', areaM2: 58659, status: 'active', operator: '名古屋市', vegetationType: '混合林', center: [136.9430, 35.1710] },
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
  // Only fall back to approximate polygon after API has finished (not while loading)
  const geometry = parkData?.geometry
    || (!isLoading && usingDummy && dummyPark?.center && dummyPark?.areaM2
      ? makeApproxPolygon(dummyPark.center, dummyPark.areaM2)
      : undefined);

  const apiFacilities = facilitiesData?.features || [];
  const dummyFacilities = id ? getDummyFacilitiesByPark(id).map((f) => ({ properties: f, geometry: { type: 'Point' as const, coordinates: dummyPark?.center || [136.9, 35.15] } })) : [];
  const facilities = apiFacilities.length > 0 ? apiFacilities : dummyFacilities;
  const parkName = park?.displayName || park?.nameJa || park?.name || '読み込み中...';
  const parkBackTo = id ? `/park-mgmt/parks/${id}` : '/park-mgmt/parks';

  // Compute real polygon centroid so dummy facilities can be repositioned
  const centroid = geometry
    ? turf.centroid({ type: 'Feature', properties: {}, geometry } as turf.helpers.Feature).geometry.coordinates
    : null;

  // Small deterministic offsets for dummy facility markers (~30-50m spread)
  const MARKER_OFFSETS: Array<[number, number]> = [
    [0.0003, 0.0002], [-0.0002, 0.0003], [0.0002, -0.0002],
    [-0.0003, -0.0002], [0.0004, 0.0001], [-0.0001, 0.0004],
    [0.0003, -0.0003], [-0.0004, 0.0003],
  ];

  const [hoveredFacilityIndex, setHoveredFacilityIndex] = useState<number | null>(null);

  // Build markers from facility point geometries for MiniMap
  // Also build a map from facility list index -> marker array index for hover highlight
  const facilityMarkers: Array<{ lng: number; lat: number; color: string }> = [];
  const facilityToMarkerIdx = new Map<number, number>();
  facilities.forEach((f: any, listIdx: number) => {
    if (f.geometry?.type !== 'Point') return;
    const markerIdx = facilityMarkers.length;
    const isDummy = f.properties.id?.startsWith('PF-demo-');
    if (isDummy && centroid) {
      const offset = MARKER_OFFSETS[markerIdx % MARKER_OFFSETS.length];
      facilityMarkers.push({ lng: centroid[0] + offset[0], lat: centroid[1] + offset[1], color: '#e03131' });
    } else {
      facilityMarkers.push({ lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], color: '#e03131' });
    }
    facilityToMarkerIdx.set(listIdx, markerIdx);
  });

  return (
    <ScrollArea h="calc(100vh - 60px)">
      <Box p="lg">
        {/* Breadcrumb */}
        <Breadcrumbs mb="md">
          <Anchor component={Link} to="/park-mgmt/parks" size="sm">公園</Anchor>
          <Text size="sm">{parkName}</Text>
        </Breadcrumbs>

        <PageState loading={!usingDummy && isLoading} error={!usingDummy && isError} empty={!park} emptyMessage="公園が見つかりません">
          {park && (
            <Stack gap="lg">
              {/* 公園マップ */}
              {geometry ? (
                <MiniMap key={`${id}-${usingDummy ? 'dummy' : 'api'}-${facilityMarkers.length}`} geometry={geometry} markers={facilityMarkers} height={250} fillColor="#22C55E" highlightedMarkerIndex={hoveredFacilityIndex != null ? facilityToMarkerIdx.get(hoveredFacilityIndex) ?? null : null} />
              ) : park.center ? (
                <MiniMap
                  center={park.center as [number, number]}
                  markers={[{ lng: park.center[0], lat: park.center[1], color: '#22C55E' }, ...facilityMarkers]}
                  zoom={15}
                  height={250}
                  highlightedMarkerIndex={hoveredFacilityIndex != null ? (facilityToMarkerIdx.get(hoveredFacilityIndex) ?? -1) + 1 : null}
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
                    <InfoRow label="区" value={WARD_JA[park.ward] || park.ward} />
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
                    {facilities.map((f: any, i: number) => {
                      const p = f.properties;
                      return (
                        <Box
                          key={p.id}
                          py="sm"
                          px="md"
                          onClick={() => navigate(`/park-mgmt/facilities/${p.id}`, {
                            state: {
                              breadcrumbFrom: {
                                to: parkBackTo,
                                label: parkName,
                              },
                            },
                          })}
                          onMouseEnter={() => setHoveredFacilityIndex(i)}
                          onMouseLeave={() => setHoveredFacilityIndex(null)}
                          style={{
                            backgroundColor: hoveredFacilityIndex === i ? '#dbe4ff' : '#f1f3f5',
                            marginBottom: 4,
                            borderRadius: 4,
                            cursor: 'pointer',
                            transition: 'background-color 0.15s ease',
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

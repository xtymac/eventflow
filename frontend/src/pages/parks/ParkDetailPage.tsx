import { useState } from 'react';
import { Box, Text, Group, Paper, SimpleGrid, Stack } from '@/components/shims';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { IconPencil } from '@tabler/icons-react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import * as turf from '@turf/turf';
import { useGreenSpace, useParkFacilitiesByPark } from '../../hooks/useApi';
import { PageState } from '../../components/PageState';
import { MiniMap } from '../../components/MiniMap';
import { getDummyFacilitiesByPark } from '../../data/dummyFacilities';

const GREEN_SPACE_TYPE_LABELS: Record<string, string> = {
  park: '\u516C\u5712', garden: '\u5EAD\u5712', forest: '\u68EE\u6797', meadow: '\u8349\u5730',
  nature_reserve: '\u81EA\u7136\u4FDD\u8B77\u533A', recreation_ground: '\u30EC\u30AF\u30EA\u30A8\u30FC\u30B7\u30E7\u30F3',
};

/** Map English ward names (from DB) to Japanese */
const WARD_JA: Record<string, string> = {
  'Atsuta-ku': '\u71B1\u7530\u533A', 'Chikusa-ku': '\u5343\u7A2E\u533A', 'Higashi-ku': '\u6771\u533A',
  'Kita-ku': '\u5317\u533A', 'Meito-ku': '\u540D\u6771\u533A', 'Midori-ku': '\u7DD1\u533A',
  'Minami-ku': '\u5357\u533A', 'Minato-ku': '\u6E2F\u533A', 'Mizuho-ku': '\u7A02\u7A42\u533A',
  'Moriyama-ku': '\u5B88\u5C71\u533A', 'Naka-ku': '\u4E2D\u533A', 'Nakagawa-ku': '\u4E2D\u5DDD\u533A',
  'Nakamura-ku': '\u4E2D\u6751\u533A', 'Nishi-ku': '\u897F\u533A', 'Showa-ku': '\u662D\u548C\u533A',
  'Tempaku-ku': '\u5929\u767D\u533A',
};

// Dummy data for demo when API is unavailable
const DUMMY_PARKS: Record<string, any> = {
  'GS-zxpnkee2': { id: 'GS-zxpnkee2', displayName: '\u9DB4\u821E\u516C\u5712', ward: '\u662D\u548C\u533A', greenSpaceType: 'park', areaM2: 236537, status: 'active', operator: '\u540D\u53E4\u5C4B\u5E02', vegetationType: '\u6DF7\u5408\u6797', center: [136.9213, 35.1575] },
  'GS-nliigh01': { id: 'GS-nliigh01', displayName: '\u540D\u57CE\u516C\u5712', ward: '\u5317\u533A', greenSpaceType: 'park', areaM2: 205208, status: 'active', operator: '\u540D\u53E4\u5C4B\u5E02', vegetationType: '\u6DF7\u5408\u6797', center: [136.9050, 35.1860] },
  'GS-4g77l6x7': { id: 'GS-4g77l6x7', displayName: '\u6771\u5C71\u52D5\u690D\u7269\u5712', ward: '\u5343\u7A2E\u533A', greenSpaceType: 'park', areaM2: 894903, status: 'active', operator: '\u540D\u53E4\u5C4B\u5E02', vegetationType: '\u5E83\u8449\u6A39', center: [136.9740, 35.1570] },
  'GS-es1u7z8r': { id: 'GS-es1u7z8r', displayName: '\u767D\u5DDD\u516C\u5712', ward: '\u4E2D\u533A', greenSpaceType: 'park', areaM2: 89299, status: 'active', operator: '\u540D\u53E4\u5C4B\u5E02', vegetationType: '\u6DF7\u5408\u6797', center: [136.8980, 35.1650] },
  'GS-9ego0pvp': { id: 'GS-9ego0pvp', displayName: '\u5E84\u5185\u7DD1\u5730\u516C\u5712', ward: '\u897F\u533A', greenSpaceType: 'park', areaM2: 426621, status: 'active', operator: '\u540D\u53E4\u5C4B\u5E02', vegetationType: '\u6DF7\u5408\u6797', center: [136.8780, 35.2010] },
  'GS-auy42b1p': { id: 'GS-auy42b1p', displayName: '\u5927\u9AD8\u7DD1\u5730\u516C\u5712', ward: '\u7DD1\u533A', greenSpaceType: 'park', areaM2: 1102426, status: 'active', operator: '\u611B\u77E5\u770C', vegetationType: '\u5E83\u8449\u6A39', center: [136.9410, 35.0780] },
  'GS-gs3xyhbw': { id: 'GS-gs3xyhbw', displayName: '\u8352\u5B50\u5DDD\u516C\u5712', ward: '\u6E2F\u533A', greenSpaceType: 'park', areaM2: 237208, status: 'active', operator: '\u540D\u53E4\u5C4B\u5E02', vegetationType: '\u6DF7\u5408\u6797', center: [136.8640, 35.1170] },
  'GS-3d67hwf5': { id: 'GS-3d67hwf5', displayName: '\u6238\u7530\u5DDD\u7DD1\u5730', ward: '\u4E2D\u5DDD\u533A', greenSpaceType: 'park', areaM2: 364075, status: 'active', operator: '\u540D\u53E4\u5C4B\u5E02', vegetationType: '\u6DF7\u5408\u6797', center: [136.8350, 35.0970] },
  'GS-byrogagk': { id: 'GS-byrogagk', displayName: '\u4E45\u5C4B\u5927\u901A\u516C\u5712', ward: '\u4E2D\u533A', greenSpaceType: 'park', areaM2: 105736, status: 'active', operator: '\u540D\u53E4\u5C4B\u5E02', vegetationType: '\u6DF7\u5408\u6797', center: [136.9110, 35.1720] },
  'GS-ful7d9lw': { id: 'GS-ful7d9lw', displayName: '\u5FB3\u5DDD\u5712', ward: '\u6771\u533A', greenSpaceType: 'garden', areaM2: 55029, status: 'active', operator: '\u540D\u53E4\u5C4B\u5E02', vegetationType: '\u65E5\u672C\u5EAD\u5712', center: [136.9340, 35.1870] },
  'GS-7f2voyoy': { id: 'GS-7f2voyoy', displayName: '\u732A\u9AD8\u7DD1\u5730', ward: '\u540D\u6771\u533A', greenSpaceType: 'park', areaM2: 631296, status: 'active', operator: '\u540D\u53E4\u5C4B\u5E02', vegetationType: '\u5E83\u8449\u6A39', center: [137.0100, 35.1780] },
  'GS-x1q5e2te': { id: 'GS-x1q5e2te', displayName: '\u7267\u91CE\u30F6\u6C60\u7DD1\u5730', ward: '\u540D\u6771\u533A', greenSpaceType: 'park', areaM2: 1351901, status: 'active', operator: '\u540D\u53E4\u5C4B\u5E02', vegetationType: '\u6DF7\u5408\u6797', center: [137.0200, 35.1650] },
  'GS-ldnfwyur': { id: 'GS-ldnfwyur', displayName: '\u5C0F\u5E61\u7DD1\u5730\u516C\u5712', ward: '\u5B88\u5C71\u533A', greenSpaceType: 'park', areaM2: 131662, status: 'active', operator: '\u540D\u53E4\u5C4B\u5E02', vegetationType: '\u6DF7\u5408\u6797', center: [136.9780, 35.2050] },
  'GS-9exy95g1': { id: 'GS-9exy95g1', displayName: '\u7B20\u5BFA\u516C\u5712', ward: '\u5357\u533A', greenSpaceType: 'park', areaM2: 65235, status: 'active', operator: '\u540D\u53E4\u5C4B\u5E02', vegetationType: '\u6DF7\u5408\u6797', center: [136.9370, 35.1060] },
  'GS-xk4kyf2q': { id: 'GS-xk4kyf2q', displayName: '\u5FD7\u8CC0\u516C\u5712', ward: '\u5317\u533A', greenSpaceType: 'park', areaM2: 51705, status: 'active', operator: '\u540D\u53E4\u5C4B\u5E02', vegetationType: '\u6DF7\u5408\u6797', center: [136.9100, 35.2020] },
  'GS-cfam78i3': { id: 'GS-cfam78i3', displayName: '\u7A02\u7A42\u516C\u5712', ward: '\u7A02\u7A42\u533A', greenSpaceType: 'park', areaM2: 239836, status: 'active', operator: '\u540D\u53E4\u5C4B\u5E02', vegetationType: '\u6DF7\u5408\u6797', center: [136.9370, 35.1350] },
  'GS-gul3d3ul': { id: 'GS-gul3d3ul', displayName: '\u71B1\u7530\u795E\u5BAE\u516C\u5712', ward: '\u71B1\u7530\u533A', greenSpaceType: 'park', areaM2: 78109, status: 'active', operator: '\u540D\u53E4\u5C4B\u5E02', vegetationType: '\u6DF7\u5408\u6797', center: [136.9080, 35.1280] },
  'GS-rtljov09': { id: 'GS-rtljov09', displayName: '\u5343\u7A2E\u516C\u5712', ward: '\u5343\u7A2E\u533A', greenSpaceType: 'park', areaM2: 58659, status: 'active', operator: '\u540D\u53E4\u5C4B\u5E02', vegetationType: '\u6DF7\u5408\u6797', center: [136.9430, 35.1710] },
};

/** Generate an approximate polygon from center [lng, lat] and area in m2. */
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
      <Text size="sm" c="dimmed" className="w-[120px] shrink-0">{label}</Text>
      <Text size="sm">{value}</Text>
    </Group>
  );
}

export function ParkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: parkData, isLoading, isError } = useGreenSpace(id ?? null);
  const { data: facilitiesData, isLoading: facilitiesLoading } = useParkFacilitiesByPark(id ?? null);

  const apiPark = parkData?.properties;
  const dummyPark = id ? DUMMY_PARKS[id] : null;
  const park = apiPark || dummyPark;
  const usingDummy = !apiPark && !!dummyPark;
  const geometry = parkData?.geometry
    || (!isLoading && usingDummy && dummyPark?.center && dummyPark?.areaM2
      ? makeApproxPolygon(dummyPark.center, dummyPark.areaM2)
      : undefined);

  const apiFacilities = facilitiesData?.features || [];
  const dummyFacilities = id ? getDummyFacilitiesByPark(id).map((f) => ({ properties: f, geometry: { type: 'Point' as const, coordinates: dummyPark?.center || [136.9, 35.15] } })) : [];
  const facilities = apiFacilities.length > 0 ? apiFacilities : dummyFacilities;
  const parkName = park?.displayName || park?.nameJa || park?.name || '\u8AAD\u307F\u8FBC\u307F\u4E2D...';
  const parkBackTo = id ? `/assets/parks/${id}` : '/assets/parks';

  const centroid = geometry
    ? turf.centroid({ type: 'Feature', properties: {}, geometry } as any).geometry.coordinates
    : null;

  const MARKER_OFFSETS: Array<[number, number]> = [
    [0.0003, 0.0002], [-0.0002, 0.0003], [0.0002, -0.0002],
    [-0.0003, -0.0002], [0.0004, 0.0001], [-0.0001, 0.0004],
    [0.0003, -0.0003], [-0.0004, 0.0003],
  ];

  const [hoveredFacilityIndex, setHoveredFacilityIndex] = useState<number | null>(null);

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
    <ScrollArea style={{ height: 'calc(100vh - 60px)' }}>
      <Box p="lg">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/assets/parks">公園</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{parkName}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <PageState loading={!usingDummy && isLoading} error={!usingDummy && isError} empty={!park} emptyMessage="公園が見つかりません">
          {park && (
            <Stack gap="lg">
              {/* Map */}
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

              {/* Park Info */}
              <Paper withBorder p="md" className="rounded-md">
                <Group justify="space-between">
                  <Text fw={600}>公園情報</Text>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <IconPencil size={16} />
                  </Button>
                </Group>
                <SimpleGrid cols={{ base: 1, md: 2 }} className="mt-2">
                  <div>
                    <InfoRow label="名称" value={park.displayName || park.nameJa || park.name} />
                    <InfoRow label="種別" value={GREEN_SPACE_TYPE_LABELS[park.greenSpaceType] || park.greenSpaceType} />
                    <InfoRow label="面積" value={park.areaM2 ? `${Math.round(park.areaM2).toLocaleString()} m\u00B2` : null} />
                    <InfoRow label="植生" value={park.vegetationType} />
                  </div>
                  <div>
                    <InfoRow label="管理者" value={park.operator} />
                    <InfoRow label="区" value={WARD_JA[park.ward] || park.ward} />
                    <InfoRow
                      label="状態"
                      value={<Badge variant="secondary" className={park.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>{park.status}</Badge>}
                    />
                    <InfoRow
                      label="リスク"
                      value={park.riskLevel ? <Badge variant="secondary" className={park.riskLevel === 'high' ? 'bg-red-100 text-red-800' : park.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}>{park.riskLevel}</Badge> : null}
                    />
                  </div>
                </SimpleGrid>
              </Paper>

              {/* Facilities */}
              <Paper withBorder p="md" className="rounded-md">
                <Group justify="space-between" mb="sm">
                  <Text fw={600}>施設 List</Text>
                  <Badge variant="secondary">{facilities.length} 件</Badge>
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
                          className="cursor-pointer rounded mb-1 transition-colors"
                          onClick={() => navigate(`/assets/facilities/${p.id}`, {
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
                          }}
                        >
                          <Text size="sm" fw={500}>{p.name}</Text>
                        </Box>
                      );
                    })}
                  </Stack>
                </PageState>
              </Paper>

              {/* Coverage */}
              <Paper withBorder p="md" className="rounded-md">
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

import { useMemo } from 'react';
import { Box, Breadcrumbs, Anchor, Text, Group, Paper, SimpleGrid, Badge, Table, ActionIcon, Tooltip, ScrollArea, Collapse, Stack } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconChevronDown, IconChevronRight, IconEdit, IconMapPin } from '@tabler/icons-react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useGreenSpace, useParkFacilitiesByPark } from '../../hooks/useApi';
import { useAuth } from '../../contexts/AuthContext';
import { PageState } from '../../components/PageState';
import { MiniMap } from '../../components/MiniMap';

const GREEN_SPACE_TYPE_LABELS: Record<string, string> = {
  park: '公園', garden: '庭園', forest: '森林', meadow: '草地',
  nature_reserve: '自然保護区', recreation_ground: 'レクリエーション',
};

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
  const { hasRole } = useAuth();
  const [infoOpen, { toggle: toggleInfo }] = useDisclosure(true);

  const { data: parkData, isLoading, isError } = useGreenSpace(id ?? null);
  const { data: facilitiesData, isLoading: facilitiesLoading } = useParkFacilitiesByPark(id ?? null);

  const park = parkData?.properties;
  const geometry = parkData?.geometry;

  const facilityMarkers = useMemo(() => {
    if (!facilitiesData?.features) return [];
    return facilitiesData.features
      .filter((f) => f.geometry?.type === 'Point')
      .map((f) => ({
        lng: (f.geometry as GeoJSON.Point).coordinates[0],
        lat: (f.geometry as GeoJSON.Point).coordinates[1],
        color: '#e03131',
      }));
  }, [facilitiesData]);

  const facilities = facilitiesData?.features || [];

  return (
    <ScrollArea h="calc(100vh - 60px)">
      <Box p="lg">
        {/* Breadcrumb */}
        <Breadcrumbs mb="md">
          <Anchor component={Link} to="/park-mgmt/parks" size="sm">公園</Anchor>
          <Text size="sm">{park?.displayName || park?.nameJa || park?.name || '読み込み中...'}</Text>
        </Breadcrumbs>

        <PageState loading={isLoading} error={isError} empty={!park} emptyMessage="公園が見つかりません">
          {park && (
            <Stack gap="lg">
              {/* Map Preview */}
              <Paper withBorder radius="md" style={{ overflow: 'hidden', position: 'relative' }}>
                <MiniMap geometry={geometry} markers={facilityMarkers} height={350} />
                {hasRole(['admin']) && (
                  <Tooltip label="ジオメトリ編集">
                    <ActionIcon
                      variant="filled"
                      color="blue"
                      size="lg"
                      radius="xl"
                      style={{ position: 'absolute', top: 12, left: 12, zIndex: 10 }}
                      onClick={() => navigate(`/park-mgmt/parks/${id}/geometry`)}
                    >
                      <IconEdit size={18} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Paper>

              {/* 公園情報 */}
              <Paper withBorder p="md" radius="md">
                <Group
                  justify="space-between"
                  onClick={toggleInfo}
                  style={{ cursor: 'pointer' }}
                >
                  <Text fw={600}>公園情報</Text>
                  {infoOpen ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
                </Group>
                <Collapse in={infoOpen}>
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
                </Collapse>
              </Paper>

              {/* 施設 List */}
              <Paper withBorder p="md" radius="md">
                <Group justify="space-between" mb="sm">
                  <Text fw={600}>施設一覧</Text>
                  <Badge variant="light">{facilities.length} 件</Badge>
                </Group>

                <PageState loading={facilitiesLoading} empty={facilities.length === 0} emptyMessage="この公園に施設はありません">
                  <Table striped highlightOnHover withTableBorder>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>名称</Table.Th>
                        <Table.Th w={120}>種別</Table.Th>
                        <Table.Th w={100}>状態</Table.Th>
                        <Table.Th w={120}>最終点検</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {facilities.map((f) => {
                        const p = f.properties;
                        return (
                          <Table.Tr
                            key={p.id}
                            onClick={() => navigate(`/park-mgmt/facilities/${p.id}`)}
                            style={{ cursor: 'pointer' }}
                          >
                            <Table.Td>
                              <Group gap="xs">
                                <IconMapPin size={14} color="var(--mantine-color-red-6)" />
                                <Text size="sm" fw={500}>{p.name}</Text>
                              </Group>
                            </Table.Td>
                            <Table.Td>
                              <Badge variant="light" size="sm">{p.category}</Badge>
                            </Table.Td>
                            <Table.Td>
                              <Badge
                                color={p.status === 'active' ? 'green' : 'gray'}
                                variant="light"
                                size="sm"
                              >
                                {p.status}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs" c="dimmed">
                                {p.lastInspectionDate ? new Date(p.lastInspectionDate).toLocaleDateString('ja-JP') : '—'}
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </PageState>
              </Paper>

              {/* 公園内建ぺい率 */}
              <Paper withBorder p="md" radius="md">
                <Text fw={600} mb="sm">公園内建ぺい率</Text>
                <Text c="dimmed" size="sm" ta="center" py="xl">
                  建ぺい率データは準備中です
                </Text>
              </Paper>
            </Stack>
          )}
        </PageState>
      </Box>
    </ScrollArea>
  );
}

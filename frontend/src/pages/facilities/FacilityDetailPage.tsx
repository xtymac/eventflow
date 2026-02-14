import { Box, Breadcrumbs, Anchor, Text, Group, Paper, SimpleGrid, Badge, Table, ScrollArea, Collapse, Stack } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconChevronDown, IconChevronRight, IconPhoto } from '@tabler/icons-react';
import { useParams, Link } from 'react-router-dom';
import { useParkFacility, useLifecyclePlans } from '../../hooks/useApi';
import { PageState } from '../../components/PageState';
import { MiniMap } from '../../components/MiniMap';

const CATEGORY_LABELS: Record<string, string> = {
  playground: '遊具', bench: 'ベンチ', shelter: '東屋', toilet: 'トイレ',
  fence: 'フェンス', lighting: '照明', water_feature: '水景', sports: 'スポーツ',
  other: 'その他',
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <Group gap="xs" py={4}>
      <Text size="sm" c="dimmed" w={140} style={{ flexShrink: 0 }}>{label}</Text>
      <Text size="sm">{value}</Text>
    </Group>
  );
}

function SectionHeader({ title, opened, toggle }: { title: string; opened: boolean; toggle: () => void }) {
  return (
    <Group justify="space-between" onClick={toggle} style={{ cursor: 'pointer' }}>
      <Text fw={600}>{title}</Text>
      {opened ? <IconChevronDown size={18} /> : <IconChevronRight size={18} />}
    </Group>
  );
}

export function FacilityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [infoOpen, { toggle: toggleInfo }] = useDisclosure(true);
  const [repairOpen, { toggle: toggleRepair }] = useDisclosure(true);
  const [inspectionOpen, { toggle: toggleInspection }] = useDisclosure(true);
  const [lifecycleOpen, { toggle: toggleLifecycle }] = useDisclosure(true);

  const { data, isLoading, isError } = useParkFacility(id ?? null);
  const { data: lifecycleData } = useLifecyclePlans({ assetRef: id ?? undefined });

  const facility = data?.properties;
  const geometry = data?.geometry;

  const markers = geometry?.type === 'Point' ? [{
    lng: (geometry as GeoJSON.Point).coordinates[0],
    lat: (geometry as GeoJSON.Point).coordinates[1],
  }] : [];

  return (
    <ScrollArea h="calc(100vh - 60px)">
      <Box p="lg">
        {/* Breadcrumb */}
        <Breadcrumbs mb="md">
          <Anchor component={Link} to="/park-mgmt/facilities" size="sm">施設</Anchor>
          <Text size="sm">{facility?.name || '読み込み中...'}</Text>
        </Breadcrumbs>

        <PageState loading={isLoading} error={isError} empty={!facility} emptyMessage="施設が見つかりません">
          {facility && (
            <Stack gap="lg">
              {/* Photo / Map Section */}
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                <Paper withBorder radius="md" p="md" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 250 }}>
                  <Stack align="center" gap="xs">
                    <IconPhoto size={48} color="var(--mantine-color-gray-4)" />
                    <Text c="dimmed" size="sm">写真なし</Text>
                  </Stack>
                </Paper>
                <MiniMap geometry={geometry} markers={markers} height={250} />
              </SimpleGrid>

              {/* Basic Info */}
              <Paper withBorder p="md" radius="md">
                <SectionHeader title="基本情報" opened={infoOpen} toggle={toggleInfo} />
                <Collapse in={infoOpen}>
                  <SimpleGrid cols={{ base: 1, md: 2 }} mt="sm">
                    <div>
                      <InfoRow label="名称" value={facility.name} />
                      <InfoRow label="管理番号" value={facility.facilityId} />
                      <InfoRow label="種別" value={CATEGORY_LABELS[facility.category] || facility.category} />
                      <InfoRow label="副種別" value={facility.subCategory} />
                      <InfoRow label="説明" value={facility.description} />
                    </div>
                    <div>
                      <InfoRow label="材質" value={facility.material} />
                      <InfoRow label="数量" value={facility.quantity} />
                      <InfoRow label="設置日" value={facility.dateInstalled ? new Date(facility.dateInstalled).toLocaleDateString('ja-JP') : null} />
                      <InfoRow label="設計供用年数" value={facility.designLife ? `${facility.designLife} 年` : null} />
                      <InfoRow label="製造者" value={facility.manufacturer} />
                      <InfoRow
                        label="評価"
                        value={facility.conditionGrade ? (
                          <Badge
                            color={facility.conditionGrade === 'A' ? 'green' : facility.conditionGrade === 'B' ? 'yellow' : 'red'}
                            variant="filled"
                            size="sm"
                          >
                            {facility.conditionGrade}
                          </Badge>
                        ) : null}
                      />
                      <InfoRow
                        label="安全懸念"
                        value={facility.safetyConcern !== undefined ? (
                          <Badge color={facility.safetyConcern ? 'red' : 'green'} variant="light" size="sm">
                            {facility.safetyConcern ? 'あり' : 'なし'}
                          </Badge>
                        ) : null}
                      />
                    </div>
                  </SimpleGrid>
                </Collapse>
              </Paper>

              {/* 補修履歴 */}
              <Paper withBorder p="md" radius="md">
                <SectionHeader title="補修履歴" opened={repairOpen} toggle={toggleRepair} />
                <Collapse in={repairOpen}>
                  <Text c="dimmed" size="sm" ta="center" py="xl">
                    補修履歴データは準備中です
                  </Text>
                </Collapse>
              </Paper>

              {/* 点検履歴 */}
              <Paper withBorder p="md" radius="md">
                <SectionHeader title="点検履歴" opened={inspectionOpen} toggle={toggleInspection} />
                <Collapse in={inspectionOpen}>
                  <SimpleGrid cols={2} mt="sm">
                    <InfoRow label="最終点検" value={facility.lastInspectionDate ? new Date(facility.lastInspectionDate).toLocaleDateString('ja-JP') : '未実施'} />
                    <InfoRow label="次回点検" value={facility.nextInspectionDate ? new Date(facility.nextInspectionDate).toLocaleDateString('ja-JP') : '未定'} />
                  </SimpleGrid>
                  <Text c="dimmed" size="sm" ta="center" py="md">
                    詳細な点検履歴は準備中です
                  </Text>
                </Collapse>
              </Paper>

              {/* 長寿命化計画 */}
              <Paper withBorder p="md" radius="md">
                <SectionHeader title="長寿命化計画" opened={lifecycleOpen} toggle={toggleLifecycle} />
                <Collapse in={lifecycleOpen}>
                  {lifecycleData?.data && lifecycleData.data.length > 0 ? (
                    <Table striped withTableBorder mt="sm">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>計画名</Table.Th>
                          <Table.Th w={80}>状態</Table.Th>
                          <Table.Th w={120}>計画期間</Table.Th>
                          <Table.Th w={120}>年間コスト</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {lifecycleData.data.map((plan) => (
                          <Table.Tr key={plan.id}>
                            <Table.Td>{plan.title}</Table.Td>
                            <Table.Td>
                              <Badge variant="light" size="sm">{plan.planStatus}</Badge>
                            </Table.Td>
                            <Table.Td>
                              {plan.planStartYear}〜{plan.planEndYear}
                            </Table.Td>
                            <Table.Td>
                              {plan.annualAverageCostJpy
                                ? `¥${Math.round(plan.annualAverageCostJpy).toLocaleString()}`
                                : '—'}
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  ) : (
                    <Text c="dimmed" size="sm" ta="center" py="xl">
                      長寿命化計画データはありません
                    </Text>
                  )}
                </Collapse>
              </Paper>
            </Stack>
          )}
        </PageState>
      </Box>
    </ScrollArea>
  );
}

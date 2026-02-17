import { Box, Breadcrumbs, Anchor, Text, Group, Paper, SimpleGrid, Badge, Table, ScrollArea, Collapse, Stack, ActionIcon, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconChevronDown, IconChevronRight, IconPhoto, IconPencil } from '@tabler/icons-react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import * as turf from '@turf/turf';
import { useParkFacility, useGreenSpace, useLifecyclePlans, useInspectionsByAsset, useRepairsByAsset } from '../../hooks/useApi';
import { PageState } from '../../components/PageState';
import { MiniMap } from '../../components/MiniMap';
import { getDummyFacility } from '../../data/dummyFacilities';

const CATEGORY_LABELS: Record<string, string> = {
  playground: '遊具', bench: 'ベンチ', shelter: '東屋', toilet: 'トイレ',
  fence: 'フェンス', gate: '門', lighting: '照明', drainage: '排水設備',
  waterFountain: '水飲み場', signBoard: '案内板', pavement: '園路',
  sportsFacility: 'スポーツ施設', building: '建物', other: 'その他',
};

const INSPECTION_TYPE_LABELS: Record<string, string> = {
  routine: '定期', detailed: '詳細', emergency: '緊急', diagnostic: '診断',
};

const CONDITION_COLORS: Record<string, string> = {
  A: 'green', B: 'yellow', C: 'orange', D: 'red', S: 'red',
};

type FacilityDetailLocationState = {
  breadcrumbFrom?: {
    to?: string;
    label?: string;
  };
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
  const location = useLocation();
  const navigate = useNavigate();
  const [infoOpen, { toggle: toggleInfo }] = useDisclosure(true);
  const [repairOpen, { toggle: toggleRepair }] = useDisclosure(true);
  const [inspectionOpen, { toggle: toggleInspection }] = useDisclosure(true);
  const [lifecycleOpen, { toggle: toggleLifecycle }] = useDisclosure(true);

  const { data, isLoading, isError } = useParkFacility(id ?? null);
  const apiFacility = data?.properties;
  const dummyFacility = id ? getDummyFacility(id) : null;
  const facility = apiFacility || dummyFacility;
  const usingDummy = !apiFacility && !!dummyFacility;
  const facilityGeometry = data?.geometry;

  // Fetch parent park geometry for polygon display on MiniMap
  const { data: parkData } = useGreenSpace(facility?.greenSpaceRef ?? null);
  const parkGeometry = parkData?.geometry;

  const { data: lifecycleData } = useLifecyclePlans({ assetRef: id ?? undefined });
  const { data: inspectionData } = useInspectionsByAsset('park-facility', id ?? null);
  const { data: repairData } = useRepairsByAsset('park-facility', id ?? null);

  // Show park polygon as geometry, facility point as marker
  const miniMapGeometry = parkGeometry || facilityGeometry;
  const isDummyFacility = id?.startsWith('PF-demo-') ?? false;
  // For dummy facilities, place marker at park polygon centroid instead of hardcoded coords
  const markers = (() => {
    if (isDummyFacility && parkGeometry) {
      const c = turf.centroid({ type: 'Feature', properties: {}, geometry: parkGeometry } as turf.helpers.Feature).geometry.coordinates;
      return [{ lng: c[0], lat: c[1], color: '#e03131' }];
    }
    if (facilityGeometry?.type === 'Point') {
      return [{
        lng: (facilityGeometry as GeoJSON.Point).coordinates[0],
        lat: (facilityGeometry as GeoJSON.Point).coordinates[1],
        color: '#e03131',
      }];
    }
    return [];
  })();

  const inspections = inspectionData?.data ?? [];
  const repairs = repairData?.data ?? [];
  const locationState = location.state as FacilityDetailLocationState | null;
  const breadcrumbTo = locationState?.breadcrumbFrom?.to || '/park-mgmt/facilities';
  const breadcrumbLabel = locationState?.breadcrumbFrom?.label || '施設';

  return (
    <ScrollArea h="calc(100vh - 60px)">
      <Box p="lg">
        {/* Breadcrumb */}
        <Breadcrumbs mb="md">
          <Anchor
            size="sm"
            onClick={() => {
              if (location.key !== 'default') {
                navigate(-1);
              } else {
                navigate(breadcrumbTo);
              }
            }}
            style={{ cursor: 'pointer' }}
          >
            {breadcrumbLabel}
          </Anchor>
          <Text size="sm">{facility?.name || '読み込み中...'}</Text>
        </Breadcrumbs>

        <PageState loading={!usingDummy && isLoading} error={!usingDummy && isError} empty={!facility} emptyMessage="施設が見つかりません">
          {facility && (
            <Stack gap="lg">
              {/* Map / Photo Section */}
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                <Box pos="relative">
                  <MiniMap key={`${id}-${parkGeometry ? 'park' : 'fac'}`} geometry={miniMapGeometry} markers={markers} height={250} fillColor="#22C55E" focusOnMarkers={markers.length > 0} />
                  <Tooltip label="編集機能は今後実装予定" position="left">
                    <ActionIcon
                      variant="white"
                      size="md"
                      disabled
                      style={{ position: 'absolute', top: 8, right: 8, cursor: 'not-allowed' }}
                    >
                      <IconPencil size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Box>
                <Paper withBorder radius="md" p="md" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 250 }}>
                  <Stack align="center" gap="xs">
                    <IconPhoto size={48} color="var(--mantine-color-gray-4)" />
                    <Text c="dimmed" size="sm">写真なし</Text>
                  </Stack>
                </Paper>
              </SimpleGrid>

              {/* Basic Info */}
              <Paper withBorder p="md" radius="md">
                <Group justify="space-between">
                  <SectionHeader title="基本情報" opened={infoOpen} toggle={toggleInfo} />
                  <Tooltip label="編集機能は今後実装予定">
                    <ActionIcon variant="subtle" color="gray" size="sm" disabled style={{ cursor: 'not-allowed' }}>
                      <IconPencil size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
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
                            color={CONDITION_COLORS[facility.conditionGrade] || 'gray'}
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
                  {repairs.length > 0 ? (
                    <Table striped withTableBorder mt="sm">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>補修日</Table.Th>
                          <Table.Th>種別</Table.Th>
                          <Table.Th>内容</Table.Th>
                          <Table.Th w={80}>状態</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {repairs.map((r) => (
                          <Table.Tr
                            key={r.id}
                            onClick={r.caseId ? () => navigate(`/cases/${r.caseId}`) : undefined}
                            style={r.caseId ? { cursor: 'pointer' } : undefined}
                          >
                            <Table.Td>{new Date(r.date).toLocaleDateString('ja-JP')}</Table.Td>
                            <Table.Td>{r.type}</Table.Td>
                            <Table.Td>{r.description}</Table.Td>
                            <Table.Td><Badge variant="light" size="sm">{r.status}</Badge></Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  ) : (
                    <Text c="dimmed" size="sm" ta="center" py="xl">
                      補修履歴データはありません
                    </Text>
                  )}
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
                  {inspections.length > 0 ? (
                    <>
                      <Table striped withTableBorder mt="sm">
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>点検日</Table.Th>
                            <Table.Th>種別</Table.Th>
                            <Table.Th>結果</Table.Th>
                            <Table.Th w={60}>評価</Table.Th>
                            <Table.Th>点検者</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {inspections.map((insp) => (
                            <Table.Tr
                              key={insp.id}
                              onClick={() => navigate(`/inspections/${insp.id}`)}
                              style={{ cursor: 'pointer' }}
                            >
                              <Table.Td>{new Date(insp.inspectionDate).toLocaleDateString('ja-JP')}</Table.Td>
                              <Table.Td>{insp.inspectionType ? (INSPECTION_TYPE_LABELS[insp.inspectionType] || insp.inspectionType) : '—'}</Table.Td>
                              <Table.Td>{insp.result}</Table.Td>
                              <Table.Td>
                                {insp.conditionGrade ? (
                                  <Badge color={CONDITION_COLORS[insp.conditionGrade] || 'gray'} variant="filled" size="sm">
                                    {insp.conditionGrade}
                                  </Badge>
                                ) : '—'}
                              </Table.Td>
                              <Table.Td>{insp.inspector || '—'}</Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                      {inspectionData?.meta && inspectionData.meta.total > inspections.length && (
                        <Text c="blue" size="sm" ta="center" py="xs" style={{ cursor: 'pointer' }}>
                          もっと見る（全{inspectionData.meta.total}件）
                        </Text>
                      )}
                    </>
                  ) : (
                    <Text c="dimmed" size="sm" ta="center" py="md">
                      点検履歴データはありません
                    </Text>
                  )}
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

import { useEffect } from 'react';
import { Box, Text, Group, Paper, SimpleGrid, Stack } from '@/components/shims';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useDisclosure } from '@/hooks/useDisclosure';
import { IconChevronDown, IconChevronRight, IconPhoto, IconPencil } from '@tabler/icons-react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import * as turf from '@turf/turf';
import { useParkFacility, useGreenSpace, useLifecyclePlans, useInspectionsByAsset, useRepairsByAsset } from '../../hooks/useApi';
import { recordVisit } from '../../hooks/useRecentVisits';
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
  A: 'bg-green-600 text-white', B: 'bg-yellow-500 text-white', C: 'bg-orange-500 text-white', D: 'bg-red-600 text-white', S: 'bg-red-600 text-white',
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
      const c = turf.centroid({ type: 'Feature', properties: {}, geometry: parkGeometry } as any).geometry.coordinates;
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
  const breadcrumbTo = locationState?.breadcrumbFrom?.to || '/assets/facilities';
  const breadcrumbLabel = locationState?.breadcrumbFrom?.label || '施設';

  // Record this facility visit in recent visits
  useEffect(() => {
    if (id && facility) {
      const name = facility.name;
      if (name) recordVisit(`/assets/facilities/${id}`, name);
    }
  }, [id, facility]);

  return (
    <ScrollArea style={{ height: 'calc(100vh - 60px)' }}>
      <Box p="lg">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                onClick={() => {
                  if (location.key !== 'default') {
                    navigate(-1);
                  } else {
                    navigate(breadcrumbTo);
                  }
                }}
                className="cursor-pointer"
              >
                {breadcrumbLabel}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{facility?.name || '読み込み中...'}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <PageState loading={!usingDummy && isLoading} error={!usingDummy && isError} empty={!facility} emptyMessage="施設が見つかりません">
          {facility && (
            <Stack gap="lg">
              {/* Map / Photo Section */}
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                <Box style={{ position: 'relative' }}>
                  <MiniMap key={`${id}-${parkGeometry ? 'park' : 'fac'}`} geometry={miniMapGeometry} markers={markers} height={250} fillColor="#22C55E" focusOnMarkers={markers.length > 0} />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled
                          className="absolute top-2 right-2 bg-white cursor-not-allowed"
                        >
                          <IconPencil size={16} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>編集機能は今後実装予定</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Box>
                <Paper className="flex items-center justify-center" style={{ minHeight: 250 }}>
                  <Stack gap="xs" style={{ alignItems: 'center' }}>
                    <IconPhoto size={48} color="#adb5bd" />
                    <Text c="dimmed" size="sm">写真なし</Text>
                  </Stack>
                </Paper>
              </SimpleGrid>

              {/* Basic Info */}
              <Paper>
                <Group justify="space-between">
                  <SectionHeader title="基本情報" opened={infoOpen} toggle={toggleInfo} />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" disabled className="cursor-not-allowed">
                          <IconPencil size={16} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>編集機能は今後実装予定</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Group>
                <Collapsible open={infoOpen}>
                  <CollapsibleContent>
                    <SimpleGrid cols={{ base: 1, md: 2 }} className="mt-2">
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
                              variant="secondary"
                              className={CONDITION_COLORS[facility.conditionGrade] || 'bg-gray-100 text-gray-800'}
                            >
                              {facility.conditionGrade}
                            </Badge>
                          ) : null}
                        />
                        <InfoRow
                          label="安全懸念"
                          value={facility.safetyConcern !== undefined ? (
                            <Badge
                              variant="secondary"
                              className={facility.safetyConcern ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}
                            >
                              {facility.safetyConcern ? 'あり' : 'なし'}
                            </Badge>
                          ) : null}
                        />
                      </div>
                    </SimpleGrid>
                  </CollapsibleContent>
                </Collapsible>
              </Paper>

              {/* 補修履歴 */}
              <Paper>
                <SectionHeader title="補修履歴" opened={repairOpen} toggle={toggleRepair} />
                <Collapsible open={repairOpen}>
                  <CollapsibleContent>
                    {repairs.length > 0 ? (
                      <Table className="mt-2">
                        <TableHeader>
                          <TableRow>
                            <TableHead>補修日</TableHead>
                            <TableHead>種別</TableHead>
                            <TableHead>内容</TableHead>
                            <TableHead style={{ width: 80 }}>状態</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {repairs.map((r) => (
                            <TableRow
                              key={r.id}
                              onClick={r.caseId ? () => navigate(`/cases/${r.caseId}`, {
                                state: { breadcrumbFrom: { to: location.pathname, label: facility?.name || '施設' } },
                              }) : undefined}
                              style={r.caseId ? { cursor: 'pointer' } : undefined}
                            >
                              <TableCell>{new Date(r.date).toLocaleDateString('ja-JP')}</TableCell>
                              <TableCell>{r.type}</TableCell>
                              <TableCell>{r.description}</TableCell>
                              <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <Text c="dimmed" size="sm" ta="center" className="py-6">
                        補修履歴データはありません
                      </Text>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </Paper>

              {/* 点検履歴 */}
              <Paper>
                <SectionHeader title="点検履歴" opened={inspectionOpen} toggle={toggleInspection} />
                <Collapsible open={inspectionOpen}>
                  <CollapsibleContent>
                    <SimpleGrid cols={2} className="mt-2">
                      <InfoRow label="最終点検" value={facility.lastInspectionDate ? new Date(facility.lastInspectionDate).toLocaleDateString('ja-JP') : '未実施'} />
                      <InfoRow label="次回点検" value={facility.nextInspectionDate ? new Date(facility.nextInspectionDate).toLocaleDateString('ja-JP') : '未定'} />
                    </SimpleGrid>
                    {inspections.length > 0 ? (
                      <>
                        <Table className="mt-2">
                          <TableHeader>
                            <TableRow>
                              <TableHead>点検日</TableHead>
                              <TableHead>種別</TableHead>
                              <TableHead>結果</TableHead>
                              <TableHead style={{ width: 60 }}>評価</TableHead>
                              <TableHead>点検者</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {inspections.map((insp) => (
                              <TableRow
                                key={insp.id}
                                onClick={() => navigate(`/inspections/${insp.id}`)}
                                style={{ cursor: 'pointer' }}
                              >
                                <TableCell>{new Date(insp.inspectionDate).toLocaleDateString('ja-JP')}</TableCell>
                                <TableCell>{insp.inspectionType ? (INSPECTION_TYPE_LABELS[insp.inspectionType] || insp.inspectionType) : '—'}</TableCell>
                                <TableCell>{insp.result}</TableCell>
                                <TableCell>
                                  {insp.conditionGrade ? (
                                    <Badge
                                      variant="secondary"
                                      className={CONDITION_COLORS[insp.conditionGrade] || 'bg-gray-100 text-gray-800'}
                                    >
                                      {insp.conditionGrade}
                                    </Badge>
                                  ) : '—'}
                                </TableCell>
                                <TableCell>{insp.inspector || '—'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {inspectionData?.meta && inspectionData.meta.total > inspections.length && (
                          <Text c="blue" size="sm" ta="center" className="py-2 cursor-pointer">
                            もっと見る（全{inspectionData.meta.total}件）
                          </Text>
                        )}
                      </>
                    ) : (
                      <Text c="dimmed" size="sm" ta="center" className="py-4">
                        点検履歴データはありません
                      </Text>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </Paper>

              {/* 長寿命化計画 */}
              <Paper>
                <SectionHeader title="長寿命化計画" opened={lifecycleOpen} toggle={toggleLifecycle} />
                <Collapsible open={lifecycleOpen}>
                  <CollapsibleContent>
                    {lifecycleData?.data && lifecycleData.data.length > 0 ? (
                      <Table className="mt-2">
                        <TableHeader>
                          <TableRow>
                            <TableHead>計画名</TableHead>
                            <TableHead style={{ width: 80 }}>状態</TableHead>
                            <TableHead style={{ width: 120 }}>計画期間</TableHead>
                            <TableHead style={{ width: 120 }}>年間コスト</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lifecycleData.data.map((plan) => (
                            <TableRow key={plan.id}>
                              <TableCell>{plan.title}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{plan.planStatus}</Badge>
                              </TableCell>
                              <TableCell>
                                {plan.planStartYear}〜{plan.planEndYear}
                              </TableCell>
                              <TableCell>
                                {plan.annualAverageCostJpy
                                  ? `¥${Math.round(plan.annualAverageCostJpy).toLocaleString()}`
                                  : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <Text c="dimmed" size="sm" ta="center" className="py-6">
                        長寿命化計画データはありません
                      </Text>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </Paper>
            </Stack>
          )}
        </PageState>
      </Box>
    </ScrollArea>
  );
}

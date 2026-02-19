import { useMemo } from 'react';
import { Box, Text, Group, Paper, SimpleGrid, Stack } from '@/components/shims';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { IconPhoto, IconCheck, IconArrowBack, IconAlertCircle, IconCircleCheck } from '@tabler/icons-react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import * as turf from '@turf/turf';
import { useEvent, useEvents, useInspections, useGreenSpace } from '../../hooks/useApi';
import { useAuth } from '../../contexts/AuthContext';
import { PageState } from '../../components/PageState';
import { MiniMap } from '../../components/MiniMap';
import { getDummyEventParkId } from '../../data/dummyEvents';

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  pending_review: { label: '提出済', className: 'bg-blue-100 text-blue-800' },
  planned: { label: '差戻', className: 'bg-orange-100 text-orange-800' },
  active: { label: '対応中', className: 'bg-cyan-100 text-cyan-800' },
  closed: { label: '確認済', className: 'bg-green-100 text-green-800' },
  archived: { label: 'アーカイブ', className: 'bg-gray-100 text-gray-800' },
  cancelled: { label: 'キャンセル', className: 'bg-red-100 text-red-800' },
};

const INSPECTION_TYPE_LABELS: Record<string, string> = {
  routine: '定期', detailed: '詳細', emergency: '緊急', diagnostic: '診断',
};

const CONDITION_COLORS: Record<string, string> = {
  A: 'bg-green-600 text-white', B: 'bg-yellow-500 text-white', C: 'bg-orange-500 text-white', D: 'bg-red-600 text-white', S: 'bg-red-600 text-white',
};

const RESULT_LABELS: Record<string, string> = {
  pass: '合格', fail: '不合格', minor: '軽微', needsRepair: '要補修', critical: '重大',
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

type CaseDetailLocationState = {
  breadcrumbFrom?: {
    to?: string;
    label?: string;
  };
};

export function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as CaseDetailLocationState | null;
  const breadcrumbTo = locationState?.breadcrumbFrom?.to || '/cases';
  const breadcrumbLabel = locationState?.breadcrumbFrom?.label || '案件管理';

  const { data: eventData, isLoading, isError } = useEvent(id ?? null);
  const { data: inspectionsData } = useInspections(id ?? undefined);
  const { data: allData } = useEvents(undefined, { enabled: true });

  const counts = useMemo(() => {
    const events = allData?.data || [];
    return {
      pending_review: events.filter((e) => e.status === 'pending_review').length,
      planned: events.filter((e) => e.status === 'planned').length,
      closed: events.filter((e) => e.status === 'closed').length,
    };
  }, [allData]);

  const event = eventData?.data;
  const statusInfo = event ? STATUS_MAP[event.status] || { label: event.status, className: 'bg-gray-100 text-gray-800' } : null;
  const inspections = inspectionsData?.data || [];

  // Fetch parent park polygon for MiniMap (same approach as FacilityDetailPage)
  const parkId = id ? getDummyEventParkId(id) : null;
  const { data: parkData } = useGreenSpace(parkId);
  const parkGeometry = parkData?.geometry ?? null;

  // Single marker at park centroid (same as FacilityDetailPage for dummy facilities)
  const facilityMarker = (() => {
    if (parkGeometry) {
      const c = turf.centroid({ type: 'Feature', properties: {}, geometry: parkGeometry } as any).geometry.coordinates;
      return [{ lng: c[0], lat: c[1], color: '#e03131' }];
    }
    if (event?.geometry?.type === 'Point') {
      const [lng, lat] = (event.geometry as { type: 'Point'; coordinates: [number, number] }).coordinates;
      return [{ lng, lat, color: '#e03131' }];
    }
    return [];
  })();

  // Collect all photos from all inspections
  const allPhotos = inspections.flatMap((insp) => insp.mediaUrls || []);

  return (
    <Box style={{ display: 'flex', height: '100%' }}>
      <Box
        style={{ width: 220, borderRight: '1px solid #dee2e6', flexShrink: 0 }}
        p="sm"
      >
        <Stack gap={2}>
          <Button
            variant="ghost"
            className="justify-start w-full"
            onClick={() => navigate('/cases')}
          >
            <IconAlertCircle size={16} className="mr-2" />
            未確認 ({counts.pending_review})
          </Button>
          <Button
            variant="ghost"
            className="justify-start w-full"
            onClick={() => navigate('/cases')}
          >
            <IconArrowBack size={16} className="mr-2" />
            差戻 ({counts.planned})
          </Button>
          <Button
            variant="ghost"
            className="justify-start w-full"
            onClick={() => navigate('/cases')}
          >
            <IconCircleCheck size={16} className="mr-2" />
            確認済 ({counts.closed})
          </Button>
        </Stack>
      </Box>
      <ScrollArea style={{ flex: 1, height: 'calc(100vh - 60px)' }}>
      <Box p="lg" style={{ maxWidth: 1200, marginLeft: 'auto', marginRight: 'auto' }}>
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
              <BreadcrumbPage>{event?.name || id?.slice(0, 8) || '読み込み中...'}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <PageState loading={isLoading} error={isError} empty={!event} emptyMessage="案件が見つかりません">
          {event && statusInfo && (
            <Stack gap="lg">
              {/* 施設情報 - 3 column layout */}
              <Paper>
                <Text fw={600} mb="sm">施設情報</Text>
                <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
                  {/* Col 1: Map */}
                  <div>
                    <MiniMap
                      key={`${id}-${parkGeometry ? 'park' : 'evt'}`}
                      geometry={parkGeometry ?? event.geometry}
                      markers={facilityMarker}
                      height={250}
                      fillColor="#22C55E"
                      focusOnMarkers={facilityMarker.length > 0}
                    />
                  </div>

                  {/* Col 2: Info fields */}
                  <div>
                    <InfoRow label="案件名" value={event.name} />
                    <InfoRow
                      label="ステータス"
                      value={
                        <Badge variant="secondary" className={statusInfo.className}>
                          {statusInfo.label}
                        </Badge>
                      }
                    />
                    <InfoRow label="制限種別" value={event.restrictionType} />
                    <InfoRow label="区" value={event.ward} />
                    <InfoRow label="部署" value={event.department} />
                    <InfoRow label="作成者" value={event.createdBy} />
                    <InfoRow
                      label="開始日"
                      value={event.startDate ? new Date(event.startDate).toLocaleDateString('ja-JP') : null}
                    />
                    <InfoRow
                      label="終了日"
                      value={event.endDate ? new Date(event.endDate).toLocaleDateString('ja-JP') : null}
                    />
                  </div>

                  {/* Col 3: Action buttons */}
                  <Stack gap="sm" style={{ justifyContent: 'flex-start' }}>
                    {hasRole(['admin']) && event.status === 'pending_review' && (
                      <>
                        <Button
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => {/* placeholder */}}
                        >
                          <IconCheck size={16} className="mr-2" />
                          確認
                        </Button>
                        <Button
                          variant="outline"
                          className="border-orange-400 text-orange-600 hover:bg-orange-50"
                          onClick={() => {/* placeholder */}}
                        >
                          <IconArrowBack size={16} className="mr-2" />
                          差戻
                        </Button>
                      </>
                    )}
                    <Button variant="outline" disabled>Action</Button>
                    <Button variant="outline" disabled>Action</Button>
                  </Stack>
                </SimpleGrid>
              </Paper>

              {/* 点検情報 - Table layout */}
              <Paper>
                <Group justify="space-between" mb="sm">
                  <Text fw={600}>点検情報</Text>
                  <Badge variant="outline">{inspections.length} 件</Badge>
                </Group>

                {inspections.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead style={{ width: 120 }}>点検日</TableHead>
                        <TableHead style={{ width: 80 }}>種別</TableHead>
                        <TableHead style={{ width: 80 }}>結果</TableHead>
                        <TableHead style={{ width: 60 }}>評価</TableHead>
                        <TableHead>点検者</TableHead>
                        <TableHead>所見</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inspections.map((insp) => (
                        <TableRow
                          key={insp.id}
                          onClick={() => navigate(`/inspections/${insp.id}`)}
                          style={{ cursor: 'pointer' }}
                        >
                          <TableCell>
                            {insp.inspectionDate
                              ? new Date(insp.inspectionDate).toLocaleDateString('ja-JP')
                              : '—'}
                          </TableCell>
                          <TableCell>
                            {insp.inspectionType
                              ? INSPECTION_TYPE_LABELS[insp.inspectionType] || insp.inspectionType
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={
                                insp.result === 'pass' ? 'bg-green-100 text-green-800' :
                                insp.result === 'fail' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }
                            >
                              {RESULT_LABELS[insp.result] || insp.result || '—'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {insp.conditionGrade ? (
                              <Badge
                                variant="secondary"
                                className={CONDITION_COLORS[insp.conditionGrade] || 'bg-gray-100 text-gray-800'}
                              >
                                {insp.conditionGrade}
                              </Badge>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell>{insp.inspector || '—'}</TableCell>
                          <TableCell>
                            <Text size="xs" className="line-clamp-1">
                              {insp.notes || insp.findings || '—'}
                            </Text>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Text c="dimmed" size="sm" ta="center" className="py-6">
                    点検データはありません
                  </Text>
                )}
              </Paper>

              {/* 写真 */}
              <Paper>
                <Text fw={600} mb="sm">写真</Text>
                {allPhotos.length > 0 ? (
                  <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="sm">
                    {allPhotos.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        className="rounded-md object-cover"
                        style={{ height: 150, width: '100%' }}
                        alt=""
                      />
                    ))}
                  </SimpleGrid>
                ) : (
                  <Group gap="md" className="py-6" justify="center">
                    <Paper className="text-center p-6">
                      <IconPhoto size={48} color="#adb5bd" />
                      <Text c="dimmed" size="sm" className="mt-2">写真なし</Text>
                    </Paper>
                  </Group>
                )}
              </Paper>
            </Stack>
          )}
        </PageState>
      </Box>
    </ScrollArea>
    </Box>
  );
}

import {
  Box,
  Breadcrumbs,
  Anchor,
  Text,
  Group,
  Paper,
  SimpleGrid,
  Badge,
  Button,
  ScrollArea,
  Stack,
  Table,
  Image,
} from '@mantine/core';
import { IconPhoto, IconCheck, IconArrowBack } from '@tabler/icons-react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import * as turf from '@turf/turf';
import { useEvent, useInspections, useGreenSpace } from '../../hooks/useApi';
import { useAuth } from '../../contexts/AuthContext';
import { PageState } from '../../components/PageState';
import { MiniMap } from '../../components/MiniMap';
import { getDummyEventParkId } from '../../data/dummyEvents';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending_review: { label: '提出済', color: 'blue' },
  planned: { label: '差戻', color: 'orange' },
  active: { label: '対応中', color: 'cyan' },
  closed: { label: '確認済', color: 'green' },
  archived: { label: 'アーカイブ', color: 'gray' },
  cancelled: { label: 'キャンセル', color: 'red' },
};

const INSPECTION_TYPE_LABELS: Record<string, string> = {
  routine: '定期', detailed: '詳細', emergency: '緊急', diagnostic: '診断',
};

const CONDITION_COLORS: Record<string, string> = {
  A: 'green', B: 'yellow', C: 'orange', D: 'red', S: 'red',
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

export function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasRole } = useAuth();
  const navigate = useNavigate();

  const { data: eventData, isLoading, isError } = useEvent(id ?? null);
  const { data: inspectionsData } = useInspections(id ?? undefined);

  const event = eventData?.data;
  const statusInfo = event ? STATUS_MAP[event.status] || { label: event.status, color: 'gray' } : null;
  const inspections = inspectionsData?.data || [];

  // Fetch parent park polygon for MiniMap (same approach as FacilityDetailPage)
  const parkId = id ? getDummyEventParkId(id) : null;
  const { data: parkData } = useGreenSpace(parkId);
  const parkGeometry = parkData?.geometry ?? null;

  // Single marker at park centroid (same as FacilityDetailPage for dummy facilities)
  const facilityMarker = (() => {
    if (parkGeometry) {
      const c = turf.centroid({ type: 'Feature', properties: {}, geometry: parkGeometry } as turf.helpers.Feature).geometry.coordinates;
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
    <ScrollArea h="calc(100vh - 60px)">
      <Box p="lg" maw={1200} mx="auto">
        {/* Breadcrumb */}
        <Breadcrumbs mb="md">
          <Anchor component={Link} to="/cases" size="sm">案件管理</Anchor>
          <Text size="sm">{event?.name || id?.slice(0, 8) || '読み込み中...'}</Text>
        </Breadcrumbs>

        <PageState loading={isLoading} error={isError} empty={!event} emptyMessage="案件が見つかりません">
          {event && statusInfo && (
            <Stack gap="lg">
              {/* 施設情報 - 3 column layout */}
              <Paper withBorder p="md" radius="md">
                <Text fw={600} mb="sm">施設情報</Text>
                <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
                  {/* Col 1: Map — park polygon + facility marker (same as FacilityDetailPage) */}
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
                        <Badge color={statusInfo.color} variant="light" size="sm">
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
                  <Stack gap="sm" justify="flex-start">
                    {hasRole(['admin']) && event.status === 'pending_review' && (
                      <>
                        <Button
                          color="green"
                          leftSection={<IconCheck size={16} />}
                          variant="filled"
                          onClick={() => {/* placeholder */}}
                        >
                          確認
                        </Button>
                        <Button
                          color="orange"
                          leftSection={<IconArrowBack size={16} />}
                          variant="light"
                          onClick={() => {/* placeholder */}}
                        >
                          差戻
                        </Button>
                      </>
                    )}
                    <Button variant="default" disabled>Action</Button>
                    <Button variant="default" disabled>Action</Button>
                  </Stack>
                </SimpleGrid>
              </Paper>

              {/* 点検情報 - Table layout */}
              <Paper withBorder p="md" radius="md">
                <Group justify="space-between" mb="sm">
                  <Text fw={600}>点検情報</Text>
                  <Badge variant="light">{inspections.length} 件</Badge>
                </Group>

                {inspections.length > 0 ? (
                  <Table striped highlightOnHover withTableBorder>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th w={120}>点検日</Table.Th>
                        <Table.Th w={80}>種別</Table.Th>
                        <Table.Th w={80}>結果</Table.Th>
                        <Table.Th w={60}>評価</Table.Th>
                        <Table.Th>点検者</Table.Th>
                        <Table.Th>所見</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {inspections.map((insp) => (
                        <Table.Tr
                          key={insp.id}
                          onClick={() => navigate(`/inspections/${insp.id}`)}
                          style={{ cursor: 'pointer' }}
                        >
                          <Table.Td>
                            {insp.inspectionDate
                              ? new Date(insp.inspectionDate).toLocaleDateString('ja-JP')
                              : '—'}
                          </Table.Td>
                          <Table.Td>
                            {insp.inspectionType
                              ? INSPECTION_TYPE_LABELS[insp.inspectionType] || insp.inspectionType
                              : '—'}
                          </Table.Td>
                          <Table.Td>
                            <Badge
                              color={insp.result === 'pass' ? 'green' : insp.result === 'fail' ? 'red' : 'gray'}
                              variant="light"
                              size="sm"
                            >
                              {RESULT_LABELS[insp.result] || insp.result || '—'}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            {insp.conditionGrade ? (
                              <Badge
                                color={CONDITION_COLORS[insp.conditionGrade] || 'gray'}
                                variant="filled"
                                size="sm"
                              >
                                {insp.conditionGrade}
                              </Badge>
                            ) : (
                              '—'
                            )}
                          </Table.Td>
                          <Table.Td>{insp.inspector || '—'}</Table.Td>
                          <Table.Td>
                            <Text size="xs" lineClamp={1}>
                              {insp.notes || insp.findings || '—'}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                ) : (
                  <Text c="dimmed" size="sm" ta="center" py="xl">
                    点検データはありません
                  </Text>
                )}
              </Paper>

              {/* 写真 */}
              <Paper withBorder p="md" radius="md">
                <Text fw={600} mb="sm">写真</Text>
                {allPhotos.length > 0 ? (
                  <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="sm">
                    {allPhotos.map((url, i) => (
                      <Image key={i} src={url} radius="md" h={150} fit="cover" />
                    ))}
                  </SimpleGrid>
                ) : (
                  <Group gap="md" py="xl" justify="center">
                    <Paper withBorder p="xl" radius="md" style={{ textAlign: 'center' }}>
                      <IconPhoto size={48} color="var(--mantine-color-gray-4)" />
                      <Text c="dimmed" size="sm" mt="xs">写真なし</Text>
                    </Paper>
                  </Group>
                )}
              </Paper>
            </Stack>
          )}
        </PageState>
      </Box>
    </ScrollArea>
  );
}

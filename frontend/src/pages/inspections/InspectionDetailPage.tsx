import { Box, Text, Group, Paper, SimpleGrid, Stack } from '@/components/shims';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { IconPhoto } from '@tabler/icons-react';
import { useParams, Link } from 'react-router-dom';
import { useInspection, useEvent } from '../../hooks/useApi';
import { PageState } from '../../components/PageState';
import { MiniMap } from '../../components/MiniMap';

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

export function InspectionDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: inspData, isLoading, isError } = useInspection(id ?? null);
  const insp = inspData?.data;

  const { data: eventData } = useEvent(insp?.eventId ?? null);
  const parentEvent = eventData?.data;

  const photos = insp?.mediaUrls || [];

  return (
    <ScrollArea style={{ height: 'calc(100vh - 60px)' }}>
      <Box p="lg" style={{ maxWidth: 1000, marginLeft: 'auto', marginRight: 'auto' }}>
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/inspections">点検一覧</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>
                {insp?.inspectionDate
                  ? new Date(insp.inspectionDate).toLocaleDateString('ja-JP')
                  : id?.slice(0, 8) || '...'}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <PageState loading={isLoading} error={isError} empty={!insp} emptyMessage="点検が見つかりません">
          {insp && (
            <Stack gap="lg">
              {/* 点検情報 */}
              <Paper>
                <Text fw={600} mb="sm">点検情報</Text>
                <SimpleGrid cols={{ base: 1, md: 2 }}>
                  <div>
                    {insp.geometry && <MiniMap geometry={insp.geometry} height={250} />}
                  </div>
                  <div>
                    <InfoRow
                      label="点検日"
                      value={new Date(insp.inspectionDate).toLocaleDateString('ja-JP')}
                    />
                    <InfoRow
                      label="種別"
                      value={
                        insp.inspectionType
                          ? INSPECTION_TYPE_LABELS[insp.inspectionType] || insp.inspectionType
                          : null
                      }
                    />
                    <InfoRow
                      label="結果"
                      value={
                        <Badge
                          variant="secondary"
                          className={
                            insp.result === 'pass' ? 'bg-green-100 text-green-800' :
                            insp.result === 'fail' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }
                        >
                          {RESULT_LABELS[insp.result] || insp.result}
                        </Badge>
                      }
                    />
                    <InfoRow
                      label="評価"
                      value={
                        insp.conditionGrade ? (
                          <Badge
                            variant="secondary"
                            className={CONDITION_COLORS[insp.conditionGrade] || 'bg-gray-100 text-gray-800'}
                          >
                            {insp.conditionGrade}
                          </Badge>
                        ) : null
                      }
                    />
                    <InfoRow label="点検者" value={insp.inspector} />
                    <InfoRow label="所属" value={insp.inspectorOrganization} />
                    <InfoRow
                      label="関連案件"
                      value={
                        parentEvent ? (
                          <Link to={`/cases/${parentEvent.id}`} className="text-sm text-blue-600 hover:underline">
                            {parentEvent.name}
                          </Link>
                        ) : insp.eventId
                          ? insp.eventId.slice(0, 8) + '...'
                          : null
                      }
                    />
                    <InfoRow label="所見" value={insp.findings} />
                    <InfoRow label="備考" value={insp.notes} />
                  </div>
                </SimpleGrid>
              </Paper>

              {/* 写真 */}
              <Paper>
                <Text fw={600} mb="sm">写真</Text>
                {photos.length > 0 ? (
                  <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="sm">
                    {photos.map((url, i) => (
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
  );
}

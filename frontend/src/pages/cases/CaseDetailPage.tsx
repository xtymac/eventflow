import { Box, Breadcrumbs, Anchor, Text, Group, Paper, SimpleGrid, Badge, Button, ScrollArea, Stack } from '@mantine/core';
import { IconPhoto, IconCheck, IconArrowBack } from '@tabler/icons-react';
import { useParams, Link } from 'react-router-dom';
import { useEvent, useInspections } from '../../hooks/useApi';
import { useAuth } from '../../contexts/AuthContext';
import { PageState } from '../../components/PageState';
import { MiniMap } from '../../components/MiniMap';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending_review: { label: '提出済', color: 'blue' },
  planned: { label: '差戻', color: 'orange' },
  active: { label: '対応中', color: 'cyan' },
  closed: { label: '確認済', color: 'green' },
  archived: { label: 'アーカイブ', color: 'gray' },
  cancelled: { label: 'キャンセル', color: 'red' },
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

  const { data: eventData, isLoading, isError } = useEvent(id ?? null);
  const { data: inspectionsData } = useInspections(id ?? undefined);

  const event = eventData?.data;
  const statusInfo = event ? STATUS_MAP[event.status] || { label: event.status, color: 'gray' } : null;
  const inspections = inspectionsData?.data || [];

  return (
    <ScrollArea h="calc(100vh - 60px)">
      <Box p="lg" maw={1000} mx="auto">
        {/* Breadcrumb */}
        <Breadcrumbs mb="md">
          <Anchor component={Link} to="/cases" size="sm">案件管理</Anchor>
          <Text size="sm">{event?.name || id?.slice(0, 8) || '読み込み中...'}</Text>
        </Breadcrumbs>

        <PageState loading={isLoading} error={isError} empty={!event} emptyMessage="案件が見つかりません">
          {event && statusInfo && (
            <Stack gap="lg">
              {/* Header with Actions */}
              <Group justify="space-between">
                <Group gap="sm">
                  <Text size="xl" fw={700}>{event.name}</Text>
                  <Badge color={statusInfo.color} size="lg" variant="light">
                    {statusInfo.label}
                  </Badge>
                </Group>

                {hasRole(['admin']) && event.status === 'pending_review' && (
                  <Group gap="sm">
                    <Button
                      color="green"
                      leftSection={<IconCheck size={16} />}
                      variant="filled"
                      onClick={() => {/* mock action */}}
                    >
                      確認
                    </Button>
                    <Button
                      color="orange"
                      leftSection={<IconArrowBack size={16} />}
                      variant="light"
                      onClick={() => {/* mock action */}}
                    >
                      差戻
                    </Button>
                  </Group>
                )}
              </Group>

              {/* 施設情報 */}
              <Paper withBorder p="md" radius="md">
                <Text fw={600} mb="sm">施設情報</Text>
                <SimpleGrid cols={{ base: 1, md: 2 }}>
                  <div>
                    {event.geometry && (
                      <MiniMap geometry={event.geometry} height={200} />
                    )}
                  </div>
                  <div>
                    <InfoRow label="案件名" value={event.name} />
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
                </SimpleGrid>
              </Paper>

              {/* 点検情報 */}
              <Paper withBorder p="md" radius="md">
                <Group justify="space-between" mb="sm">
                  <Text fw={600}>点検情報</Text>
                  <Badge variant="light">{inspections.length} 件</Badge>
                </Group>

                {inspections.length > 0 ? (
                  <Stack gap="sm">
                    {inspections.map((insp) => (
                      <Paper key={insp.id} withBorder p="sm" radius="sm">
                        <Group justify="space-between">
                          <Group gap="xs">
                            <Text size="sm" fw={500}>
                              {insp.inspectionDate ? new Date(insp.inspectionDate).toLocaleDateString('ja-JP') : '日付なし'}
                            </Text>
                            <Badge
                              color={insp.result === 'pass' ? 'green' : insp.result === 'fail' ? 'red' : 'gray'}
                              variant="light"
                              size="sm"
                            >
                              {insp.result === 'pass' ? '合格' : insp.result === 'fail' ? '不合格' : insp.result || '—'}
                            </Badge>
                          </Group>
                        </Group>
                        {insp.notes && <Text size="xs" c="dimmed" mt="xs">{insp.notes}</Text>}
                      </Paper>
                    ))}
                  </Stack>
                ) : (
                  <Text c="dimmed" size="sm" ta="center" py="xl">
                    点検データはありません
                  </Text>
                )}
              </Paper>

              {/* Photos */}
              <Paper withBorder p="md" radius="md">
                <Text fw={600} mb="sm">写真</Text>
                <Group gap="md" py="xl" justify="center">
                  <Paper withBorder p="xl" radius="md" style={{ textAlign: 'center' }}>
                    <IconPhoto size={48} color="var(--mantine-color-gray-4)" />
                    <Text c="dimmed" size="sm" mt="xs">写真なし</Text>
                  </Paper>
                </Group>
              </Paper>
            </Stack>
          )}
        </PageState>
      </Box>
    </ScrollArea>
  );
}

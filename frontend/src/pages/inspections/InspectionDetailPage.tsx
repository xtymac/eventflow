import {
  Box,
  Breadcrumbs,
  Anchor,
  Text,
  Group,
  Paper,
  SimpleGrid,
  Badge,
  ScrollArea,
  Stack,
  Image,
} from '@mantine/core';
import { IconPhoto } from '@tabler/icons-react';
import { useParams, Link } from 'react-router-dom';
import { useInspection, useEvent } from '../../hooks/useApi';
import { PageState } from '../../components/PageState';
import { MiniMap } from '../../components/MiniMap';

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

export function InspectionDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: inspData, isLoading, isError } = useInspection(id ?? null);
  const insp = inspData?.data;

  const { data: eventData } = useEvent(insp?.eventId ?? null);
  const parentEvent = eventData?.data;

  const photos = insp?.mediaUrls || [];

  return (
    <ScrollArea h="calc(100vh - 60px)">
      <Box p="lg" maw={1000} mx="auto">
        <Breadcrumbs mb="md">
          <Anchor component={Link} to="/inspections" size="sm">点検一覧</Anchor>
          <Text size="sm">
            {insp?.inspectionDate
              ? new Date(insp.inspectionDate).toLocaleDateString('ja-JP')
              : id?.slice(0, 8) || '...'}
          </Text>
        </Breadcrumbs>

        <PageState loading={isLoading} error={isError} empty={!insp} emptyMessage="点検が見つかりません">
          {insp && (
            <Stack gap="lg">
              {/* 点検情報 */}
              <Paper withBorder p="md" radius="md">
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
                          color={insp.result === 'pass' ? 'green' : insp.result === 'fail' ? 'red' : 'gray'}
                          variant="light"
                          size="sm"
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
                            color={CONDITION_COLORS[insp.conditionGrade] || 'gray'}
                            variant="filled"
                            size="sm"
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
                          <Anchor component={Link} to={`/cases/${parentEvent.id}`} size="sm">
                            {parentEvent.name}
                          </Anchor>
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
              <Paper withBorder p="md" radius="md">
                <Text fw={600} mb="sm">写真</Text>
                {photos.length > 0 ? (
                  <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="sm">
                    {photos.map((url, i) => (
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

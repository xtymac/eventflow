import { useState, useMemo } from 'react';
import { Box, TextInput, Table, Badge, Text, Group, NavLink as MantineNavLink, ScrollArea, Stack } from '@mantine/core';
import { IconSearch, IconAlertCircle, IconArrowBack, IconCircleCheck } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useEvents } from '../../hooks/useApi';
import { PageState } from '../../components/PageState';

type StatusFilter = 'all' | 'pending_review' | 'planned' | 'closed';

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending_review: { label: '提出済', color: 'blue', icon: null },
  planned: { label: '差戻', color: 'orange', icon: null },
  active: { label: '対応中', color: 'cyan', icon: null },
  closed: { label: '確認済', color: 'green', icon: null },
  archived: { label: 'アーカイブ', color: 'gray', icon: null },
  cancelled: { label: 'キャンセル', color: 'red', icon: null },
};

const SIDEBAR_WIDTH = 220;

export function CaseListPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const { data: allData } = useEvents(undefined, { enabled: true });
  const { data, isLoading, isError } = useEvents(
    statusFilter !== 'all' ? { status: statusFilter } : undefined,
    { enabled: true }
  );

  // Count by status
  const counts = useMemo(() => {
    const events = allData?.data || [];
    return {
      all: events.length,
      pending_review: events.filter((e) => e.status === 'pending_review').length,
      planned: events.filter((e) => e.status === 'planned').length,
      closed: events.filter((e) => e.status === 'closed').length,
    };
  }, [allData]);

  const cases = useMemo(() => {
    if (!data?.data) return [];
    if (!search) return data.data;
    const s = search.toLowerCase();
    return data.data.filter((e) =>
      e.name?.toLowerCase().includes(s) ||
      e.id?.toLowerCase().includes(s) ||
      e.department?.toLowerCase().includes(s)
    );
  }, [data, search]);

  return (
    <Box style={{ display: 'flex', height: '100%' }}>
      {/* Left Sidebar - Status Filters */}
      <Box
        w={SIDEBAR_WIDTH}
        style={{
          borderRight: '1px solid var(--mantine-color-gray-3)',
          flexShrink: 0,
        }}
        p="sm"
      >
        <Text fw={600} mb="sm" size="sm">ステータス</Text>
        <Stack gap={2}>
          <MantineNavLink
            label={`すべて (${counts.all})`}
            active={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
            variant="filled"
          />
          <MantineNavLink
            label={`未確認 (${counts.pending_review})`}
            leftSection={<IconAlertCircle size={16} />}
            active={statusFilter === 'pending_review'}
            onClick={() => setStatusFilter('pending_review')}
            variant="filled"
            color="blue"
          />
          <MantineNavLink
            label={`差戻 (${counts.planned})`}
            leftSection={<IconArrowBack size={16} />}
            active={statusFilter === 'planned'}
            onClick={() => setStatusFilter('planned')}
            variant="filled"
            color="orange"
          />
          <MantineNavLink
            label={`確認済 (${counts.closed})`}
            leftSection={<IconCircleCheck size={16} />}
            active={statusFilter === 'closed'}
            onClick={() => setStatusFilter('closed')}
            variant="filled"
            color="green"
          />
        </Stack>
      </Box>

      {/* Main Area */}
      <Box style={{ flex: 1, overflow: 'hidden' }} p="lg">
        <Group justify="space-between" mb="md">
          <Text size="xl" fw={700}>案件管理</Text>
          <Badge size="lg" variant="light">{cases.length} 件</Badge>
        </Group>

        <Group mb="md">
          <TextInput
            placeholder="ID・名称・部署で検索..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ flex: 1, maxWidth: 500 }}
          />
        </Group>

        <PageState loading={isLoading} error={isError} empty={cases.length === 0} emptyMessage="案件データがありません">
          <ScrollArea h="calc(100vh - 240px)">
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={100}>ID</Table.Th>
                  <Table.Th>案件名</Table.Th>
                  <Table.Th w={100}>部署</Table.Th>
                  <Table.Th w={100}>区</Table.Th>
                  <Table.Th w={120}>開始日</Table.Th>
                  <Table.Th w={100}>状態</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {cases.map((c) => {
                  const statusInfo = STATUS_MAP[c.status] || { label: c.status, color: 'gray' };
                  return (
                    <Table.Tr
                      key={c.id}
                      onClick={() => navigate(`/cases/${c.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <Table.Td>
                        <Text size="xs" c="dimmed" truncate>{c.id.slice(0, 8)}...</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={500} size="sm">{c.name}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">{c.department || '—'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">{c.ward || '—'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">
                          {c.startDate ? new Date(c.startDate).toLocaleDateString('ja-JP') : '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={statusInfo.color} variant="light" size="sm">
                          {statusInfo.label}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </PageState>
      </Box>
    </Box>
  );
}

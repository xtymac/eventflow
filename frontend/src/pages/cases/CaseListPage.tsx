import { useState, useMemo } from 'react';
import { Box, TextInput, Badge, Text, Group, NavLink as MantineNavLink, ScrollArea, Stack, Select } from '@mantine/core';
import { IconSearch, IconAlertCircle, IconArrowBack, IconCircleCheck } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useEvents } from '../../hooks/useApi';
import { PageState } from '../../components/PageState';

type StatusFilter = 'all' | 'pending_review' | 'planned' | 'closed';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending_review: { label: '提出済', color: 'blue' },
  planned: { label: '差戻', color: 'orange' },
  active: { label: '対応中', color: 'cyan' },
  closed: { label: '確認済', color: 'green' },
  archived: { label: 'アーカイブ', color: 'gray' },
  cancelled: { label: 'キャンセル', color: 'red' },
};

const RESTRICTION_TYPE_LABELS: Record<string, string> = {
  full: '全面通行止め',
  partial: '片側通行',
  workzone: '工事区間',
};

const RESTRICTION_TYPE_OPTIONS = Object.entries(RESTRICTION_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const SIDEBAR_WIDTH = 220;

export function CaseListPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
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
    let filtered = data.data;
    if (typeFilter) {
      filtered = filtered.filter((e) => e.restrictionType === typeFilter);
    }
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.name?.toLowerCase().includes(s) ||
          e.id?.toLowerCase().includes(s) ||
          e.department?.toLowerCase().includes(s) ||
          e.ward?.toLowerCase().includes(s) ||
          e.restrictionType?.toLowerCase().includes(s),
      );
    }
    return filtered;
  }, [data, search, typeFilter]);

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
        <Stack gap={2}>
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
        <Group mb="md" gap="sm">
          <Select
            placeholder="種別"
            data={RESTRICTION_TYPE_OPTIONS}
            value={typeFilter}
            onChange={setTypeFilter}
            clearable
            w={180}
            label="種別"
          />
          <TextInput
            placeholder="検索（ID, ParkName, type, 市区町村）"
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ flex: 1 }}
            mt={24}
          />
        </Group>

        <PageState loading={isLoading} error={isError} empty={cases.length === 0} emptyMessage="案件データがありません">
          <ScrollArea h="calc(100vh - 200px)">
            <Stack gap="xs">
              {cases.map((c) => {
                const statusInfo = STATUS_MAP[c.status] || { label: c.status, color: 'gray' };
                return (
                  <Group
                    key={c.id}
                    onClick={() => navigate(`/cases/${c.id}`)}
                    justify="space-between"
                    p="md"
                    style={{
                      cursor: 'pointer',
                      backgroundColor: 'var(--mantine-color-gray-1)',
                      borderRadius: 'var(--mantine-radius-sm)',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text fw={500} size="sm" truncate>{c.name}</Text>
                      <Group gap="xs" mt={4}>
                        <Text size="xs" c="dimmed">{c.id.slice(0, 8)}...</Text>
                        {c.ward && <Text size="xs" c="dimmed">{c.ward}</Text>}
                        {c.department && <Text size="xs" c="dimmed">{c.department}</Text>}
                        {c.startDate && (
                          <Text size="xs" c="dimmed">
                            {new Date(c.startDate).toLocaleDateString('ja-JP')}
                          </Text>
                        )}
                      </Group>
                    </div>
                    <Badge color={statusInfo.color} variant="light" size="sm">
                      {statusInfo.label}
                    </Badge>
                  </Group>
                );
              })}
            </Stack>
          </ScrollArea>
        </PageState>
      </Box>
    </Box>
  );
}

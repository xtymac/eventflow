import { useState, useMemo } from 'react';
import { Box, TextInput, Select, Table, Badge, Text, Group, Alert, ScrollArea } from '@mantine/core';
import { IconSearch, IconInfoCircle } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useAllGreenSpaces, useGreenSpaceWards } from '../../hooks/useApi';
import { PageState } from '../../components/PageState';

const GREEN_SPACE_TYPE_LABELS: Record<string, string> = {
  park: '公園',
  garden: '庭園',
  forest: '森林',
  meadow: '草地',
  nature_reserve: '自然保護区',
  recreation_ground: 'レクリエーション',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'green',
  inactive: 'gray',
  under_construction: 'yellow',
  planned: 'blue',
};

const LIST_LIMIT = 5000;

export function ParkListPage() {
  const [search, setSearch] = useState('');
  const [wardFilter, setWardFilter] = useState<string | null>(null);
  const navigate = useNavigate();

  const { data, isLoading, isError } = useAllGreenSpaces(
    wardFilter ? { ward: wardFilter } : undefined
  );
  const { data: wardsData } = useGreenSpaceWards();

  const parks = useMemo(() => {
    if (!data?.features) return [];
    const filtered = data.features.filter((f) => {
      if (!search) return true;
      const s = search.toLowerCase();
      const p = f.properties;
      return (
        p.name?.toLowerCase().includes(s) ||
        p.nameJa?.toLowerCase().includes(s) ||
        p.displayName?.toLowerCase().includes(s) ||
        p.id?.toLowerCase().includes(s)
      );
    });
    return filtered.sort((a, b) => (a.properties.displayName || a.properties.name || '').localeCompare(b.properties.displayName || b.properties.name || '', 'ja'));
  }, [data, search]);

  const wardOptions = useMemo(() => {
    if (!wardsData?.data) return [];
    return wardsData.data.map((w: string) => ({ label: w, value: w }));
  }, [wardsData]);

  return (
    <Box p="lg" h="100%">
      <Group justify="space-between" mb="md">
        <Text size="xl" fw={700}>公園一覧</Text>
        <Badge size="lg" variant="light">{parks.length} 件</Badge>
      </Group>

      <Group mb="md" gap="sm">
        <TextInput
          placeholder="名称・IDで検索..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          style={{ flex: 1, maxWidth: 400 }}
        />
        <Select
          placeholder="区で絞り込み"
          data={wardOptions}
          value={wardFilter}
          onChange={setWardFilter}
          clearable
          w={200}
        />
      </Group>

      {parks.length >= LIST_LIMIT && (
        <Alert color="yellow" variant="light" icon={<IconInfoCircle size={18} />} mb="md">
          表示件数が上限（{LIST_LIMIT}件）に達しています。検索条件を絞り込んでください。
        </Alert>
      )}

      <PageState loading={isLoading} error={isError} empty={parks.length === 0} emptyMessage="公園データがありません">
        <ScrollArea h="calc(100vh - 260px)">
          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={100}>ID</Table.Th>
                <Table.Th>名称</Table.Th>
                <Table.Th w={100}>区</Table.Th>
                <Table.Th w={120}>種別</Table.Th>
                <Table.Th w={100}>面積(m²)</Table.Th>
                <Table.Th w={80}>状態</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {parks.map((f) => {
                const p = f.properties;
                return (
                  <Table.Tr
                    key={p.id}
                    onClick={() => navigate(`/park-mgmt/parks/${p.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <Table.Td>
                      <Text size="xs" c="dimmed" truncate>{p.id.slice(0, 8)}...</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={500}>{p.displayName || p.nameJa || p.name || '（無名）'}</Text>
                    </Table.Td>
                    <Table.Td>{p.ward || '—'}</Table.Td>
                    <Table.Td>
                      <Badge variant="light" size="sm">
                        {GREEN_SPACE_TYPE_LABELS[p.greenSpaceType] || p.greenSpaceType}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {p.areaM2 ? Math.round(p.areaM2).toLocaleString() : '—'}
                    </Table.Td>
                    <Table.Td>
                      <Badge color={STATUS_COLORS[p.status] || 'gray'} variant="light" size="sm">
                        {p.status}
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
  );
}

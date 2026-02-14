import { useState, useMemo } from 'react';
import { Box, TextInput, Select, Table, Badge, Text, Group, Alert, ScrollArea } from '@mantine/core';
import { IconSearch, IconInfoCircle } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useAllParkFacilities } from '../../hooks/useApi';
import { PageState } from '../../components/PageState';
import type { ParkFacilityCategory } from '@nagoya/shared';

const CATEGORY_LABELS: Record<string, string> = {
  playground: '遊具', bench: 'ベンチ', shelter: '東屋', toilet: 'トイレ',
  fence: 'フェンス', lighting: '照明', waterFountain: '水飲み場', sportsFacility: 'スポーツ施設',
  building: '建物', signBoard: '案内板', pavement: '舗装', drainage: '排水',
  gate: '門', other: 'その他',
};

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));

const LIST_LIMIT = 1000;

export function FacilityListPage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const navigate = useNavigate();

  const { data, isLoading, isError } = useAllParkFacilities(
    categoryFilter ? { category: categoryFilter as ParkFacilityCategory } : undefined
  );

  const facilities = useMemo(() => {
    if (!data?.features) return [];
    return data.features
      .filter((f) => {
        if (!search) return true;
        const s = search.toLowerCase();
        const p = f.properties;
        return (
          p.name?.toLowerCase().includes(s) ||
          p.description?.toLowerCase().includes(s) ||
          p.id?.toLowerCase().includes(s) ||
          p.facilityId?.toLowerCase().includes(s)
        );
      })
      .sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'ja'));
  }, [data, search]);

  return (
    <Box p="lg" h="100%">
      <Group justify="space-between" mb="md">
        <Text size="xl" fw={700}>施設一覧</Text>
        <Badge size="lg" variant="light">{facilities.length} 件</Badge>
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
          placeholder="種別で絞り込み"
          data={CATEGORY_OPTIONS}
          value={categoryFilter}
          onChange={setCategoryFilter}
          clearable
          w={200}
        />
      </Group>

      {facilities.length >= LIST_LIMIT && (
        <Alert color="yellow" variant="light" icon={<IconInfoCircle size={18} />} mb="md">
          表示件数が上限（{LIST_LIMIT}件）に達しています。検索条件を絞り込んでください。
        </Alert>
      )}

      <PageState loading={isLoading} error={isError} empty={facilities.length === 0} emptyMessage="施設データがありません">
        <ScrollArea h="calc(100vh - 260px)">
          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={80}>管理番号</Table.Th>
                <Table.Th>名称</Table.Th>
                <Table.Th w={100}>種別</Table.Th>
                <Table.Th w={100}>状態</Table.Th>
                <Table.Th w={80}>評価</Table.Th>
                <Table.Th w={120}>最終点検</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {facilities.map((f) => {
                const p = f.properties;
                return (
                  <Table.Tr
                    key={p.id}
                    onClick={() => navigate(`/park-mgmt/facilities/${p.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <Table.Td>
                      <Text size="xs" c="dimmed">{p.facilityId || '—'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={500} size="sm">{p.name}</Text>
                      {p.description && <Text size="xs" c="dimmed" lineClamp={1}>{p.description}</Text>}
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" size="sm">
                        {CATEGORY_LABELS[p.category] || p.category}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={p.status === 'active' ? 'green' : 'gray'}
                        variant="light"
                        size="sm"
                      >
                        {p.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {p.conditionGrade ? (
                        <Badge
                          color={p.conditionGrade === 'A' ? 'green' : p.conditionGrade === 'B' ? 'yellow' : 'red'}
                          variant="filled"
                          size="sm"
                        >
                          {p.conditionGrade}
                        </Badge>
                      ) : '—'}
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {p.lastInspectionDate ? new Date(p.lastInspectionDate).toLocaleDateString('ja-JP') : '—'}
                      </Text>
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

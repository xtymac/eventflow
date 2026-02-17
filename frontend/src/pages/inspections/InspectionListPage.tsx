import { useState, useMemo } from 'react';
import { Box, TextInput, Table, Badge, Text, Group, ScrollArea, Select } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useInspections } from '../../hooks/useApi';
import { PageState } from '../../components/PageState';

const INSPECTION_TYPE_LABELS: Record<string, string> = {
  routine: '定期', detailed: '詳細', emergency: '緊急', diagnostic: '診断',
};

const CONDITION_COLORS: Record<string, string> = {
  A: 'green', B: 'yellow', C: 'orange', D: 'red', S: 'red',
};

const RESULT_LABELS: Record<string, string> = {
  pass: '合格', fail: '不合格', minor: '軽微', needsRepair: '要補修', critical: '重大',
};

const TYPE_OPTIONS = Object.entries(INSPECTION_TYPE_LABELS).map(([value, label]) => ({ value, label }));

export function InspectionListPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const navigate = useNavigate();

  const { data, isLoading, isError } = useInspections();

  const inspections = useMemo(() => {
    if (!data?.data) return [];
    let filtered = data.data;
    if (typeFilter) filtered = filtered.filter((i) => i.inspectionType === typeFilter);
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.id?.toLowerCase().includes(s) ||
          i.inspector?.toLowerCase().includes(s) ||
          i.notes?.toLowerCase().includes(s) ||
          i.findings?.toLowerCase().includes(s),
      );
    }
    return filtered;
  }, [data, search, typeFilter]);

  return (
    <Box p="lg" h="100%">
      <Group justify="space-between" mb="md">
        <Text size="xl" fw={700}>点検一覧</Text>
        <Badge size="lg" variant="light">{inspections.length} 件</Badge>
      </Group>

      <Group mb="md" gap="sm">
        <TextInput
          placeholder="ID・点検者・所見で検索..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          style={{ flex: 1, maxWidth: 400 }}
        />
        <Select
          placeholder="種別で絞り込み"
          data={TYPE_OPTIONS}
          value={typeFilter}
          onChange={setTypeFilter}
          clearable
          w={180}
        />
      </Group>

      <PageState loading={isLoading} error={isError} empty={inspections.length === 0} emptyMessage="点検データがありません">
        <ScrollArea h="calc(100vh - 240px)">
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={100}>ID</Table.Th>
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
                    <Text size="xs" c="dimmed" truncate>
                      {insp.id.slice(0, 8)}...
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {new Date(insp.inspectionDate).toLocaleDateString('ja-JP')}
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
                      {RESULT_LABELS[insp.result] || insp.result}
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
        </ScrollArea>
      </PageState>
    </Box>
  );
}

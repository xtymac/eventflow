import { useState, useMemo } from 'react';
import { Box, Text, Group } from '@/components/shims';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { IconSearch } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useInspections } from '../../hooks/useApi';
import { PageState } from '../../components/PageState';

const INSPECTION_TYPE_LABELS: Record<string, string> = {
  routine: '定期', detailed: '詳細', emergency: '緊急', diagnostic: '診断',
};

const CONDITION_COLORS: Record<string, string> = {
  A: 'bg-green-600 text-white', B: 'bg-yellow-500 text-white', C: 'bg-orange-500 text-white', D: 'bg-red-600 text-white', S: 'bg-red-600 text-white',
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
    <Box p="lg" style={{ height: '100%' }}>
      <Group justify="space-between" mb="md">
        <Text size="xl" fw={700}>点検一覧</Text>
        <Badge variant="outline">{inspections.length} 件</Badge>
      </Group>

      <Group mb="md" gap="sm">
        <div className="relative" style={{ flex: 1, maxWidth: 400 }}>
          <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="ID・点検者・所見で検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div style={{ width: 180 }}>
          <Select
            value={typeFilter ?? ''}
            onValueChange={(v) => setTypeFilter(v || null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="種別で絞り込み" />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Group>

      <PageState loading={isLoading} error={isError} empty={inspections.length === 0} emptyMessage="点検データがありません">
        <ScrollArea style={{ height: 'calc(100vh - 240px)' }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: 100 }}>ID</TableHead>
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
                    <Text size="xs" c="dimmed" className="truncate">
                      {insp.id.slice(0, 8)}...
                    </Text>
                  </TableCell>
                  <TableCell>
                    {new Date(insp.inspectionDate).toLocaleDateString('ja-JP')}
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
                      {RESULT_LABELS[insp.result] || insp.result}
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
        </ScrollArea>
      </PageState>
    </Box>
  );
}

import { useState, useMemo } from 'react';
import { Box, Text, Group } from '@/components/shims';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { IconSearch, IconInfoCircle } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useAllParkFacilities } from '../../hooks/useApi';
import { PageState } from '../../components/PageState';
import { getAllDummyFacilities } from '../../data/dummyFacilities';
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

  // Use API data if available, otherwise fall back to dummy data for demo
  const usingDummy = !data?.features?.length;
  const dummyFeatures = useMemo(() => getAllDummyFacilities().map((f) => ({ properties: f })), []);

  const facilities = useMemo(() => {
    const features = usingDummy ? dummyFeatures : data!.features;
    return (features as any[])
      .filter((f: any) => {
        const p = f.properties;
        if (categoryFilter && p.category !== categoryFilter) return false;
        if (!search) return true;
        const s = search.toLowerCase();
        return (
          p.name?.toLowerCase().includes(s) ||
          p.description?.toLowerCase().includes(s) ||
          p.id?.toLowerCase().includes(s) ||
          p.facilityId?.toLowerCase().includes(s)
        );
      })
      .sort((a: any, b: any) => a.properties.name.localeCompare(b.properties.name, 'ja'));
  }, [data, dummyFeatures, usingDummy, search, categoryFilter]);

  return (
    <Box p="lg" style={{ height: '100%' }}>
      <Group justify="space-between" mb="md">
        <Text size="xl" fw={700}>施設一覧</Text>
        <Badge variant="outline">{facilities.length} 件</Badge>
      </Group>

      <Group mb="md" gap="sm">
        <div className="relative" style={{ flex: 1, maxWidth: 400 }}>
          <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="名称・IDで検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div style={{ width: 200 }}>
          <Select
            value={categoryFilter ?? ''}
            onValueChange={(v) => setCategoryFilter(v || null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="種別で絞り込み" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Group>

      {facilities.length >= LIST_LIMIT && (
        <Alert className="mb-4">
          <IconInfoCircle size={18} />
          <AlertDescription>
            表示件数が上限（{LIST_LIMIT}件）に達しています。検索条件を絞り込んでください。
          </AlertDescription>
        </Alert>
      )}

      <PageState loading={!usingDummy && isLoading} error={!usingDummy && isError} empty={facilities.length === 0} emptyMessage="施設データがありません">
        <ScrollArea style={{ height: 'calc(100vh - 260px)' }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: 80 }}>管理番号</TableHead>
                <TableHead>名称</TableHead>
                <TableHead style={{ width: 100 }}>種別</TableHead>
                <TableHead style={{ width: 100 }}>状態</TableHead>
                <TableHead style={{ width: 80 }}>評価</TableHead>
                <TableHead style={{ width: 120 }}>最終点検</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {facilities.map((f) => {
                const p = f.properties;
                return (
                  <TableRow
                    key={p.id}
                    onClick={() => navigate(`/assets/facilities/${p.id}`, {
                      state: {
                        breadcrumbFrom: {
                          to: '/assets/facilities',
                          label: '施設',
                        },
                      },
                    })}
                    style={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      <Text size="xs" c="dimmed">{p.facilityId || '—'}</Text>
                    </TableCell>
                    <TableCell>
                      <Text fw={500} size="sm">{p.name}</Text>
                      {p.description && <Text size="xs" c="dimmed" className="line-clamp-1">{p.description}</Text>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {CATEGORY_LABELS[p.category] || p.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={p.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}
                      >
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {p.conditionGrade ? (
                        <Badge
                          variant="secondary"
                          className={
                            p.conditionGrade === 'A' ? 'bg-green-600 text-white' :
                            p.conditionGrade === 'B' ? 'bg-yellow-500 text-white' :
                            'bg-red-600 text-white'
                          }
                        >
                          {p.conditionGrade}
                        </Badge>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <Text size="xs" c="dimmed">
                        {p.lastInspectionDate ? new Date(p.lastInspectionDate).toLocaleDateString('ja-JP') : '—'}
                      </Text>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </PageState>
    </Box>
  );
}

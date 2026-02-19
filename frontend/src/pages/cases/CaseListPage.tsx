import { useState, useMemo } from 'react';
import { Box, Text, Group, Stack } from '@/components/shims';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { IconSearch, IconAlertCircle, IconArrowBack, IconCircleCheck } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useEvents } from '../../hooks/useApi';
import { PageState } from '../../components/PageState';

type StatusFilter = 'all' | 'pending_review' | 'planned' | 'closed';

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  pending_review: { label: '提出済', className: 'bg-blue-100 text-blue-800' },
  planned: { label: '差戻', className: 'bg-orange-100 text-orange-800' },
  active: { label: '対応中', className: 'bg-cyan-100 text-cyan-800' },
  closed: { label: '確認済', className: 'bg-green-100 text-green-800' },
  archived: { label: 'アーカイブ', className: 'bg-gray-100 text-gray-800' },
  cancelled: { label: 'キャンセル', className: 'bg-red-100 text-red-800' },
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
        style={{
          width: SIDEBAR_WIDTH,
          borderRight: '1px solid #dee2e6',
          flexShrink: 0,
        }}
        p="sm"
      >
        <Stack gap={2}>
          <Button
            variant={statusFilter === 'pending_review' ? 'default' : 'ghost'}
            className="justify-start w-full"
            onClick={() => setStatusFilter('pending_review')}
          >
            <IconAlertCircle size={16} className="mr-2" />
            未確認 ({counts.pending_review})
          </Button>
          <Button
            variant={statusFilter === 'planned' ? 'default' : 'ghost'}
            className="justify-start w-full"
            onClick={() => setStatusFilter('planned')}
          >
            <IconArrowBack size={16} className="mr-2" />
            差戻 ({counts.planned})
          </Button>
          <Button
            variant={statusFilter === 'closed' ? 'default' : 'ghost'}
            className="justify-start w-full"
            onClick={() => setStatusFilter('closed')}
          >
            <IconCircleCheck size={16} className="mr-2" />
            確認済 ({counts.closed})
          </Button>
        </Stack>
      </Box>

      {/* Main Area */}
      <Box style={{ flex: 1, overflow: 'hidden' }} p="lg">
        <Group mb="md" gap="sm">
          <div style={{ width: 180 }}>
            <Label className="mb-1.5 block text-sm font-medium">種別</Label>
            <Select
              value={typeFilter ?? ''}
              onValueChange={(v) => setTypeFilter(v || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="種別" />
              </SelectTrigger>
              <SelectContent>
                {RESTRICTION_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="relative flex-1" style={{ marginTop: 24 }}>
            <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="検索（ID, ParkName, type, 市区町村）"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </Group>

        <PageState loading={isLoading} error={isError} empty={cases.length === 0} emptyMessage="案件データがありません">
          <ScrollArea style={{ height: 'calc(100vh - 200px)' }}>
            <Stack gap="xs">
              {cases.map((c) => {
                const statusInfo = STATUS_MAP[c.status] || { label: c.status, className: 'bg-gray-100 text-gray-800' };
                return (
                  <Group
                    key={c.id}
                    onClick={() => navigate(`/cases/${c.id}`)}
                    justify="space-between"
                    p="md"
                    style={{
                      cursor: 'pointer',
                      backgroundColor: '#f1f3f5',
                      borderRadius: '0.25rem',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text fw={500} size="sm" className="truncate">{c.name}</Text>
                      <Group gap="xs" className="mt-1">
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
                    <Badge variant="secondary" className={statusInfo.className}>
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

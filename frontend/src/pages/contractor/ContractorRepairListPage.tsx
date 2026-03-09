/**
 * Contractor repair list page — reuses CaseListPage patterns but with
 * repair-specific columns and filters matching the Figma design.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Search, Pencil, CircleArrowRight, RotateCcw } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';


import { DUMMY_CASES } from '../../data/dummyCases';
import { DUMMY_REPAIRS, type DummyRepair } from '../../data/dummyRepairs';
import {
  DUMMY_FACILITIES,
  type DummyFacility,
  FACILITY_CLASSIFICATION_LABELS,
  PARK_NAME_LOOKUP,
} from '../../data/dummyFacilities';
import { DUMMY_PARK_FACILITIES } from '../../data/dummyParkFacilities';
import { FacilityPlaceholderImage } from '@/components/facility/FacilityPlaceholderImage';
import { RankBadge } from '@/components/facility/RankBadge';
import { useScrollRestore } from '../../hooks/useScrollRestore';
import { useRepairs, useUpdateRepair } from '../../hooks/useApi';
import { showNotification } from '../../lib/toast';
import { ContractorRepairForm } from './ContractorRepairForm';

/* ── Merged row type ── */
export interface ContractorRepairRow {
  id: number;
  status: 'pending' | 'confirmed' | 'draft' | 'returned';
  parkName: string;
  parkRef: string;
  facilityName: string;
  facilityId: string;
  facilityRef: string;
  createdDate: string;
  createdAt: string;  // ISO 8601 timestamp for accurate sorting
  repairDate: string;
  designDocNumber: string;
  repairContent: string;
  mainReplacementParts: string;
  repairNotes: string;
}

/* ── Build data by merging cases + repairs ── */
function buildContractorRepairRows(): ContractorRepairRow[] {
  const facilityLookup = new Map<string, DummyFacility>(
    DUMMY_FACILITIES.map((f) => [f.id, f]),
  );
  const repairByCaseId = new Map<string, DummyRepair>(
    DUMMY_REPAIRS.filter((r) => r.caseId).map((r) => [r.caseId!, r]),
  );

  const rows: ContractorRepairRow[] = [];
  let idx = 0;

  // Repair-type cases → rows
  const repairCases = DUMMY_CASES.filter((c) => c.type === 'repair');
  for (const c of repairCases) {
    const rep = repairByCaseId.get(String(c.id));

    rows.push({
      id: c.id,
      status: c.status === 'confirmed' ? 'confirmed' : c.status === 'returned' ? 'returned' : 'pending',
      parkName: c.parkName,
      parkRef: c.parkRef,
      facilityName: c.facilityName,
      facilityId: c.facilityId,
      facilityRef: c.facilityRef,
      createdDate: c.createdDate,
      createdAt: c.createdDate.replace(/\//g, '-') + 'T00:00:00Z',
      repairDate: rep?.date
        ? rep.date.replace(/-/g, '/')
        : c.createdDate,
      designDocNumber: rep?.designDocNumber || '-',
      repairContent: rep?.description || rep?.type || '消耗部材交換',
      mainReplacementParts: rep?.mainReplacementParts || '主な交換部材',
      repairNotes: rep?.repairNotes || '-',
    });
    idx++;
  }

  // Add extra rows from repairs that have no linked case
  const usedCaseIds = new Set(repairCases.map((c) => String(c.id)));
  for (const rep of DUMMY_REPAIRS) {
    if (rep.caseId && usedCaseIds.has(rep.caseId)) continue;
    const fac = facilityLookup.get(rep.facilityId);
    if (!fac) continue;
    const parkName = PARK_NAME_LOOKUP[fac.greenSpaceRef] || '-';

    rows.push({
      id: parseInt(rep.id.replace(/\D/g, ''), 10) + 50000,
      status: idx % 3 === 0 ? 'confirmed' : 'pending',
      parkName,
      parkRef: fac.greenSpaceRef,
      facilityName: fac.name,
      facilityId: fac.facilityId,
      facilityRef: fac.id,
      createdDate: rep.date.replace(/-/g, '/'),
      createdAt: rep.date + 'T00:00:00Z',
      repairDate: rep.date.replace(/-/g, '/'),
      designDocNumber: rep.designDocNumber || '-',
      repairContent: rep.description || rep.type,
      mainReplacementParts: rep.mainReplacementParts || '主な交換部材',
      repairNotes: rep.repairNotes || '-',
    });
    idx++;
  }

  // Draft entries now come from real API records with status='draft'

  return rows;
}

// NOTE: computed inside component via useMemo so newly added records appear after navigation

/* ── Style tokens ── */
const stickyRightStyle: import('react').CSSProperties = {
  position: 'sticky',
  right: 0,
  backgroundColor: 'white',
  boxShadow: '-4px 0 8px -4px rgba(0,0,0,0.08)',
};

const headerCls = 'h-10 px-2 text-xs font-medium text-muted-foreground border-b border-[#f5f5f5]';
const cellCls = 'px-2 text-sm max-w-0 truncate';

/* ── Facility lookup for popover ── */
const FACILITY_LOOKUP = new Map<string, DummyFacility>(
  DUMMY_FACILITIES.map((f) => [f.id, f]),
);

/* ── Status config ── */
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending:   { label: '未確認', className: 'bg-[#f5f5f5] text-[#404040] border border-[#d4d4d4]' },
  confirmed: { label: '確認済', className: 'bg-[#D1FAE5] text-[#065F46] border border-[#10B981]' },
  draft:     { label: '下書き', className: 'bg-white text-[#737373] border border-[#d4d4d4]' },
  returned:  { label: '差戻', className: 'bg-[#FFE2E2] text-[#DC2626] border border-[#DC2626]' },
};

/* ── Status badge ── */
function RepairStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${config.className}`}>
      {config.label}
    </span>
  );
}

/* ── Facility popover ── */
function FacilityInfoPopover({
  facilityRef,
  facilityName,
  facilityId,
  children,
}: {
  facilityRef: string;
  facilityName: string;
  facilityId: string;
  children: React.ReactNode;
}) {
  const facility = FACILITY_LOOKUP.get(facilityRef);

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="w-[244px] rounded-lg border border-[#e5e5e5] p-0 shadow-lg"
      >
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#0a0a0a]">{facilityName}</span>
            {facility?.status && (
              <span className="inline-block rounded-full bg-[#D1FAE5] px-2 py-0.5 text-[10px] font-semibold text-[#065F46]">
                使用中
              </span>
            )}
          </div>
        </div>

        {facility && (
          <div className="px-3 pb-2">
            <div className="overflow-hidden rounded-md">
              <FacilityPlaceholderImage category={facility.category} size={220} />
            </div>
          </div>
        )}

        <div className="space-y-3 px-3 pb-3">
          <div className="flex gap-6">
            <div>
              <p className="text-[11px] text-[#737373]">施設ID</p>
              <p className="text-xs text-[#0a0a0a]">{facilityId}</p>
            </div>
            <div>
              <p className="text-[11px] text-[#737373]">施設分類</p>
              <p className="text-xs text-[#0a0a0a]">
                {facility?.facilityClassification
                  ? FACILITY_CLASSIFICATION_LABELS[facility.facilityClassification] || '-'
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[#737373]">数量</p>
              <p className="text-xs text-[#0a0a0a]">
                {facility?.quantity ? `${facility.quantity} 基` : '-'}
              </p>
            </div>
          </div>

          <div className="flex gap-6">
            <div>
              <p className="text-[11px] text-[#737373]">構造ランク</p>
              <div className="mt-1">
                <RankBadge rank={facility?.structureRank} />
              </div>
            </div>
            <div>
              <p className="text-[11px] text-[#737373]">消耗ランク</p>
              <div className="mt-1">
                <RankBadge rank={facility?.wearRank} />
              </div>
            </div>
          </div>

          <div className="space-y-0 border-t border-[#f5f5f5] pt-2">
            <div className="flex items-center justify-between py-1">
              <span className="text-[11px] text-[#737373]">設置年</span>
              <span className="text-xs text-[#0a0a0a]">
                {facility?.dateInstalled?.replace(/-/g, '/') || '-'}
              </span>
            </div>
            <div className="border-t border-[#f5f5f5]" />
            <div className="flex items-center justify-between py-1">
              <span className="text-[11px] text-[#737373]">詳細・規格</span>
              <span className="text-xs text-[#0a0a0a]">
                {facility?.subItem || '-'}
              </span>
            </div>
            <div className="border-t border-[#f5f5f5]" />
            <div className="flex items-center justify-between py-1">
              <span className="text-[11px] text-[#737373]">主要部材</span>
              <span className="text-xs text-[#0a0a0a]">
                {facility?.mainMaterial || '-'}
              </span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ── Status tabs ── */
type StatusTab = 'all' | 'pending' | 'confirmed' | 'draft' | 'returned';

function StatusTabs({
  active,
  counts,
  onChange,
}: {
  active: StatusTab;
  counts: { all: number; pending: number; confirmed: number; draft: number; returned: number };
  onChange: (tab: StatusTab) => void;
}) {
  const tabs: { key: StatusTab; label: string; count: number }[] = [
    { key: 'all', label: 'すべて', count: counts.all },
    { key: 'pending', label: '未確認', count: counts.pending },
    { key: 'confirmed', label: '確認済', count: counts.confirmed },
    { key: 'draft', label: '下書き', count: counts.draft },
    { key: 'returned', label: '差戻', count: counts.returned },
  ];

  return (
    <div className="flex items-center gap-1" data-testid="repair-status-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          data-testid={`repair-tab-${tab.key}`}
          onClick={() => onChange(tab.key)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors border-0 cursor-pointer ${
            active === tab.key
              ? 'bg-[#215042] text-white'
              : 'bg-transparent text-[#404040] hover:bg-[#f5f5f5]'
          }`}
        >
          {tab.label}
          <span
            className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${
              active === tab.key
                ? 'bg-white/20 text-white'
                : 'bg-[#f5f5f5] text-[#404040]'
            }`}
          >
            {tab.count}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ── Main page component ── */
export function ContractorRepairListPage() {
  /* ── Edit modal state ── */
  const [editRow, setEditRow] = useState<ContractorRepairRow | null>(null);

  /* ── Quick-submit for draft records ── */
  const updateRepair = useUpdateRepair();
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const handleQuickSubmit = async (row: ContractorRepairRow) => {
    setSubmittingId(null);
    try {
      await updateRepair.mutateAsync({
        id: String(row.id),
        data: { status: 'submitted' },
      });
      showNotification({
        title: '修理記録を提出しました',
        message: `${row.facilityName} — ${row.repairDate}`,
        color: 'green',
      });
    } catch {
      showNotification({
        title: '提出に失敗しました',
        message: 'サーバーへの送信に失敗しました。',
        color: 'red',
      });
    }
  };

  /* ── Filter state ── */
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [globalFilter, setGlobalFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'createdAt', desc: true },
  ]);

  // Fetch real repairs from API (EC2 database)
  const { data: apiRepairData, isLoading: isLoadingRepairs } = useRepairs();
  const apiRepairs = apiRepairData?.data;

  const baseData = useMemo(() => {
    if (isLoadingRepairs) return [] as ContractorRepairRow[];
    const rows = buildContractorRepairRows();
    const dummyRowCount = rows.length;

    if (apiRepairs) {
      const facilityLookup = new Map<string, DummyFacility>(
        DUMMY_FACILITIES.map((f) => [f.id, f]),
      );
      for (const rec of apiRepairs) {
        const assetId = rec.assetId ?? undefined;
        if (!assetId) continue;
        const dateStr = rec.repairDate?.replace(/-/g, '/');
        // Only deduplicate against dummy rows
        const isDuplicate = rows.slice(0, dummyRowCount).some(
          (r) => r.facilityRef === assetId && r.repairDate === dateStr,
        );
        if (isDuplicate) continue;

        const fac = facilityLookup.get(assetId);
        const parkFac = !fac
          ? DUMMY_PARK_FACILITIES.find((f) => f.properties.id === assetId)?.properties
          : null;
        const resolved = fac ?? parkFac;
        const greenSpaceRef = resolved?.greenSpaceRef ?? '';
        const parkName = greenSpaceRef ? PARK_NAME_LOOKUP[greenSpaceRef] || '-' : '-';

        rows.push({
          id: rec.id as unknown as number,
          status: rec.status === 'draft' ? 'draft' : rec.status === 'returned' ? 'returned' : 'pending',
          parkName,
          parkRef: greenSpaceRef,
          facilityName: resolved?.name || assetId,
          facilityId: fac?.facilityId || (parkFac as { facilityId?: string } | null)?.facilityId || '',
          facilityRef: assetId,
          createdDate: rec.createdAt ? new Date(rec.createdAt).toISOString().split('T')[0].replace(/-/g, '/') : dateStr,
          createdAt: rec.createdAt || dateStr.replace(/\//g, '-') + 'T00:00:00Z',
          repairDate: dateStr,
          designDocNumber: rec.designDocNumber || '-',
          repairContent: rec.description || rec.repairType || '消耗部材交換',
          mainReplacementParts: rec.mainReplacementParts || '-',
          repairNotes: rec.repairNotes || '-',
        });
      }
    }

    return rows;
  }, [apiRepairs, isLoadingRepairs]);

  /* ── Counts ── */
  const counts = useMemo(() => ({
    all: baseData.length,
    pending: baseData.filter((r) => r.status === 'pending').length,
    confirmed: baseData.filter((r) => r.status === 'confirmed').length,
    draft: baseData.filter((r) => r.status === 'draft').length,
    returned: baseData.filter((r) => r.status === 'returned').length,
  }), [baseData]);

  /* ── Filtered data ── */
  const filteredData = useMemo(() => {
    let data = baseData;
    if (statusTab !== 'all') {
      data = data.filter((r) => r.status === statusTab);
    }
    if (dateFilter) {
      const target = dateFilter.replace(/-/g, '/');
      data = data.filter((r) => r.repairDate === target);
    }
    return data;
  }, [statusTab, dateFilter, baseData]);

  /* ── Columns ── */
  const columns = useMemo<ColumnDef<ContractorRepairRow>[]>(
    () => [
      {
        id: 'status',
        accessorKey: 'status',
        header: '状態',
        size: 88,
        cell: ({ row }) => <RepairStatusBadge status={row.original.status} />,
        meta: { className: 'px-2 text-center', headerClassName: `${headerCls} text-center` },
      },
      {
        accessorKey: 'id',
        header: 'ID',
        size: 70,
        cell: ({ row }) => <span className="text-sm text-[#0a0a0a]">{row.original.id}</span>,
        meta: { className: cellCls, headerClassName: headerCls },
      },
      {
        id: 'parkName',
        header: '公園名称',
        size: 144,
        accessorFn: (row) => row.parkName,
        cell: ({ row }) => (
          <span className="text-sm text-primary underline decoration-primary/40 cursor-default truncate max-w-full">
            {row.original.parkName}
          </span>
        ),
        meta: { className: cellCls, headerClassName: headerCls },
      },
      {
        id: 'facility',
        header: '施設',
        size: 166,
        accessorFn: (row) => `${row.facilityName}, ${row.facilityId}`,
        cell: ({ row }) => (
          <FacilityInfoPopover
            facilityRef={row.original.facilityRef}
            facilityName={row.original.facilityName}
            facilityId={row.original.facilityId}
          >
            <button
              type="button"
              className="text-sm text-primary underline decoration-primary/40 hover:decoration-primary bg-transparent border-0 cursor-pointer p-0 text-left truncate max-w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {row.original.facilityName}, {row.original.facilityId}
            </button>
          </FacilityInfoPopover>
        ),
        meta: { className: cellCls, headerClassName: headerCls },
      },
      {
        id: 'repairDate',
        header: '補修年月日',
        size: 120,
        accessorFn: (row) => row.repairDate,
        cell: ({ row }) => (
          <span className="text-sm text-[#a3a3a3]">{row.original.repairDate}</span>
        ),
        meta: { className: cellCls, headerClassName: headerCls },
      },
      {
        id: 'createdAt',
        header: '作成日',
        size: 120,
        accessorFn: (row) => row.createdAt,
        cell: ({ row }) => (
          <span className="text-sm text-[#a3a3a3]">{row.original.createdDate}</span>
        ),
        meta: { className: cellCls, headerClassName: headerCls },
      },
      {
        id: 'designDocNumber',
        header: '設計書番号',
        size: 146,
        accessorFn: (row) => row.designDocNumber,
        cell: ({ row }) => (
          <span className="text-sm text-[#a3a3a3]">{row.original.designDocNumber}</span>
        ),
        meta: { className: cellCls, headerClassName: headerCls },
      },
      {
        id: 'repairContent',
        header: '補修内容',
        size: 154,
        accessorFn: (row) => row.repairContent,
        cell: ({ row }) => (
          <span className="text-sm text-[#0a0a0a]">{row.original.repairContent}</span>
        ),
        meta: { className: cellCls, headerClassName: headerCls },
      },
      {
        id: 'mainReplacementParts',
        header: '主な交換部材',
        size: 130,
        accessorFn: (row) => row.mainReplacementParts,
        cell: ({ row }) => (
          <span className="text-sm text-[#a3a3a3]">{row.original.mainReplacementParts}</span>
        ),
        meta: { className: cellCls, headerClassName: headerCls },
      },
      {
        id: 'repairNotes',
        header: '補修備考',
        size: 180,
        accessorFn: (row) => row.repairNotes,
        cell: ({ row }) => (
          <span className="text-sm text-[#a3a3a3]">{row.original.repairNotes}</span>
        ),
        meta: { className: cellCls, headerClassName: headerCls },
      },
      {
        id: 'actions',
        size: 72,
        header: '',
        cell: ({ row }) => {
          const isDraft = row.original.status === 'draft';
          return (
            <div className="flex items-center justify-center gap-2">
              <Pencil
                className="size-4 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditRow(row.original);
                }}
              />
              {isDraft && (
                <Popover
                  open={submittingId === row.original.id}
                  onOpenChange={(open) => setSubmittingId(open ? row.original.id : null)}
                >
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center bg-transparent border-0 p-0 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`repair-quick-submit-${row.original.id}`}
                    >
                      <CircleArrowRight className="size-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    side="bottom"
                    className="w-auto rounded-lg border border-[#e5e5e5] p-3 shadow-lg"
                  >
                    <p className="text-sm font-medium text-[#0a0a0a] mb-3">提出してもよろしいですか？</p>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSubmittingId(null)}
                      >
                        キャンセル
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleQuickSubmit(row.original)}
                        data-testid={`repair-quick-submit-confirm-${row.original.id}`}
                      >
                        はい
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          );
        },
        enableHiding: false,
        meta: { className: 'h-10 px-2 text-center', headerClassName: `${headerCls} text-center` },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [submittingId],
  );

  /* ── Table instance ── */
  const table = useReactTable({
    data: filteredData,
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const s = filterValue.toLowerCase();
      const r = row.original;
      return (
        String(r.id).includes(s) ||
        r.parkName.toLowerCase().includes(s) ||
        r.facilityName.toLowerCase().includes(s) ||
        r.facilityId.toLowerCase().includes(s) ||
        r.repairContent.toLowerCase().includes(s) ||
        r.designDocNumber.toLowerCase().includes(s) ||
        r.mainReplacementParts.toLowerCase().includes(s) ||
        r.repairNotes.toLowerCase().includes(s)
      );
    },
  });

  /* ── Filter helpers ── */
  const hasFilters = !!dateFilter || !!globalFilter || statusTab !== 'all';

  function clearAllFilters() {
    setGlobalFilter('');
    setDateFilter('');
    setStatusTab('all');
  }

  /* ── Scrollbar auto-hide ── */
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollRestore(scrollRef as RefObject<HTMLElement>);
  const scrollTimer = useRef<ReturnType<typeof setTimeout>>();
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.classList.add('is-scrolling');
    clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => el.classList.remove('is-scrolling'), 800);
  }, []);

  /* ── Lazy row reveal ── */
  const TABLE_ROW_H = 40;
  const TABLE_HEADER_H = 41;
  const [visibleRowCount, setVisibleRowCount] = useState(30);
  const [batchSize, setBatchSize] = useState(20);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const rows = Math.max(1, Math.floor((entry.contentRect.height - TABLE_HEADER_H) / TABLE_ROW_H));
      setBatchSize(rows);
      setVisibleRowCount((prev) => Math.max(prev, rows));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const allRows = table.getRowModel().rows;
  const visibleRows = allRows.slice(0, visibleRowCount);
  const hasMoreRows = visibleRowCount < allRows.length;

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleRowCount((prev) => Math.min(prev + batchSize, allRows.length));
        }
      },
      { root, rootMargin: '0px 0px 240px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [batchSize, allRows.length]);

  const totalWidth = table.getVisibleLeafColumns().reduce((sum, c) => sum + (c.getSize() ?? 100), 0);
  return (
    <div
      className="flex min-h-0 flex-col overflow-hidden"
      style={{ margin: 16, padding: '0 24px 16px', height: 'calc(100% - 32px)' }}
      data-testid="contractor-repair-list"
    >
      {/* Title bar */}
      <div className="flex items-center justify-between" style={{ margin: '4px 0 20px' }}>
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-semibold leading-none tracking-tight" data-testid="contractor-repair-title">
            補修
          </h1>
          <StatusTabs active={statusTab} counts={counts} onChange={setStatusTab} />
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3" style={{ marginBottom: 16 }}>
        {/* Search */}
        <div
          className="flex h-9 w-full sm:w-[340px] items-center gap-3 rounded-lg border border-[#e5e5e5] bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.00)]"
          style={{ padding: '0 16px' }}
        >
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            placeholder="ID, 公園名称, 施設名称, 補修内容, 設計書番号"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            data-testid="repair-search-input"
            className="h-auto min-h-0 flex-1 border-0 p-0 shadow-none focus-visible:ring-0 focus-visible:border-0"
          />
        </div>

        {/* 補修年月日 */}
        <div
          className="flex h-9 w-full sm:w-[180px] items-center gap-2 rounded-lg border border-[#e5e5e5] bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.00)]"
          style={{ padding: '0 12px' }}
        >
          <Input
            type="date"
            placeholder="補修年月日"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            data-testid="repair-date-filter"
            className="h-auto min-h-0 flex-1 border-0 p-0 shadow-none focus-visible:ring-0 focus-visible:border-0 text-sm text-muted-foreground [&::-webkit-calendar-picker-indicator]:opacity-50"
          />
        </div>

        <TooltipProvider>
          <div className="ml-auto flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon-sm"
                  onClick={clearAllFilters}
                  disabled={!hasFilters}
                  className="size-9 border border-[#e5e5e5] bg-[#f5f5f5] text-[#595959] hover:bg-[#ececec] disabled:opacity-40"
                  data-testid="repair-clear-filters"
                >
                  <RotateCcw className="size-4" />
                  <span className="sr-only">フィルターリセット</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>フィルターリセット</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      {/* Table container */}
      <div
        className="relative flex min-h-0 flex-1 overflow-hidden rounded-lg"
        style={{
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.10), 0 1px 2px -1px rgba(0, 0, 0, 0.10)',
        }}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            data-testid="repair-table-scroll"
            className="scrollbar-auto-hide min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain [&_[data-slot=table-container]]:overflow-visible"
          >
            <Table style={{ minWidth: totalWidth }}>
              <TableHeader className="sticky top-0 z-10 bg-white">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="hover:bg-transparent">
                    {headerGroup.headers.map((header) => {
                      const meta = header.column.columnDef.meta as
                        | { headerClassName?: string }
                        | undefined;
                      return (
                        <TableHead
                          key={header.id}
                          className={meta?.headerClassName}
                          style={{
                            width: header.getSize(),
                            minWidth: header.getSize(),
                            ...(header.column.id === 'actions' ? { ...stickyRightStyle, zIndex: 20 } : {}),
                          }}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody data-testid="repair-table-body">
                {visibleRows.length ? (
                  visibleRows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-testid="repair-table-row"
                      className="cursor-pointer hover:bg-[#f5f5f5] transition-colors"
                    >
                      {row.getVisibleCells().map((cell) => {
                        const meta = cell.column.columnDef.meta as
                          | { className?: string }
                          | undefined;
                        return (
                          <TableCell
                            key={cell.id}
                            className={meta?.className}
                            style={{
                              width: cell.column.getSize(),
                              minWidth: cell.column.getSize(),
                              ...(cell.column.id === 'actions' ? stickyRightStyle : {}),
                            }}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={table.getVisibleLeafColumns().length}
                      className="h-24 text-center text-muted-foreground"
                    >
                      該当する補修記録がありません
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {hasMoreRows && <div ref={sentinelRef} className="h-1" />}
          </div>
        </div>
      </div>

      {/* Edit repair modal */}
      {editRow && (
        <ContractorRepairForm
          key={String(editRow.id)}
          facilityId={editRow.facilityRef}
          open
          recordId={editRow.id}
          initialData={{
            inspectionDate: editRow.repairDate?.replace(/\//g, '-'),
            mainMaterial: editRow.mainReplacementParts !== '-' ? editRow.mainReplacementParts : '',
            repairContent: editRow.repairContent !== '消耗部材交換' ? editRow.repairContent : '',
            repairNotes: editRow.repairNotes !== '-' ? editRow.repairNotes : '',
            designDocNumber: editRow.designDocNumber !== '-' ? editRow.designDocNumber : '',
          }}
          onClose={() => setEditRow(null)}
          onSubmitted={() => setEditRow(null)}
        />
      )}
    </div>
  );
}

/**
 * Contractor inspection list page — reuses CaseListPage patterns but with
 * inspection-specific columns and filters matching the Figma design.
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  DUMMY_INSPECTIONS,
  type DummyInspection,
} from '../../data/dummyInspections';
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
import { useInspections, useUpdateInspection } from '../../hooks/useApi';
import { showNotification } from '../../lib/toast';
import { ContractorInspectionForm } from './ContractorInspectionForm';
import type { InspectionRecord } from '@nagoya/shared';

/* ── Merged row type ── */
export interface ContractorInspectionRow {
  id: string | number;
  status: 'pending' | 'confirmed' | 'draft' | 'returned';
  parkName: string;
  parkRef: string;
  facilityName: string;
  facilityId: string;
  facilityRef: string;
  date: string;
  createdDate: string;
  createdAt: string;  // ISO 8601 timestamp for accurate sorting
  inspector?: string;
  structureRank?: string;
  structureMaterialNotes?: string;
  wearRank?: string;
  wearMaterialNotes?: string;
}

/* ── Build data by merging cases + inspections + API records ── */
function buildContractorInspectionRows(apiInspections?: InspectionRecord[]): ContractorInspectionRow[] {
  const facilityLookup = new Map<string, DummyFacility>(
    DUMMY_FACILITIES.map((f) => [f.id, f]),
  );
  const inspectionByCaseId = new Map<string, DummyInspection>(
    DUMMY_INSPECTIONS.filter((i) => i.eventId).map((i) => [i.eventId!, i]),
  );

  const rows: ContractorInspectionRow[] = [];
  const seenAssetIds = new Set<string>(); // Track which assetIds already have rows

  // Inspection-type cases → rows
  const inspCases = DUMMY_CASES.filter((c) => c.type === 'inspection');
  for (const c of inspCases) {
    const insp = inspectionByCaseId.get(String(c.id));
    const fac = facilityLookup.get(c.facilityRef);

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
      date: insp?.date
        ? insp.date.replace(/-/g, '/')
        : c.createdDate,
      inspector: c.vendor,
      structureRank: insp?.structureRank ?? fac?.structureRank,
      structureMaterialNotes: insp?.structureMaterialNotes,
      wearRank: insp?.wearRank ?? fac?.wearRank,
      wearMaterialNotes: insp?.wearMaterialNotes,
    });
    if (c.facilityRef) seenAssetIds.add(c.facilityRef);
  }

  // API inspection records from DB — add rows for records not already covered by dummy cases
  const dummyRowCount = rows.length; // snapshot before adding API rows
  if (apiInspections) {
    for (const rec of apiInspections) {
      const assetId = rec.assetId ?? undefined;
      if (!assetId) continue;
      // Skip only if a DUMMY case row already covers this assetId + date
      const dateStr = rec.inspectionDate?.replace(/-/g, '/');
      const isDuplicate = rows.slice(0, dummyRowCount).some(
        (r) => r.facilityRef === assetId && r.date === dateStr,
      );
      if (isDuplicate) continue;

      // Look up facility info from curated facilities or park facilities
      const fac = facilityLookup.get(assetId);
      const parkFac = !fac
        ? DUMMY_PARK_FACILITIES.find((f) => f.properties.id === assetId)?.properties
        : null;
      const resolved = fac ?? parkFac;
      const greenSpaceRef = resolved?.greenSpaceRef ?? '';
      const parkName = greenSpaceRef ? PARK_NAME_LOOKUP[greenSpaceRef] || '-' : '-';
      const m = rec.measurements as Record<string, unknown> | null | undefined;

      const updatedDateStr = rec.updatedAt ? new Date(rec.updatedAt).toISOString().split('T')[0].replace(/-/g, '/') : (dateStr || '');
      rows.push({
        id: rec.id,
        status: rec.status === 'draft' ? 'draft' : rec.status === 'returned' ? 'returned' : 'pending',
        parkName,
        parkRef: greenSpaceRef,
        facilityName: resolved?.name || assetId,
        facilityId: fac?.facilityId || (parkFac as { facilityId?: string } | null)?.facilityId || '',
        facilityRef: assetId,
        createdDate: updatedDateStr,
        createdAt: rec.createdAt || (dateStr || '').replace(/\//g, '-') + 'T00:00:00Z',
        date: dateStr || '',
        inspector: rec.inspector ?? undefined,
        structureRank: (m?.structureRank as string) ?? rec.conditionGrade ?? undefined,
        structureMaterialNotes: (m?.structureMaterialNotes as string) ?? rec.findings ?? undefined,
        wearRank: (m?.wearRank as string) ?? undefined,
        wearMaterialNotes: (m?.wearMaterialNotes as string) ?? rec.notes ?? undefined,
      });
    }
  }

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
function InspectionStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${config.className}`}>
      {config.label}
    </span>
  );
}

/* ── Circle rank badge (matching Figma design) ── */
const rankColors: Record<string, string> = {
  A: 'bg-[#22C55E] text-white',
  B: 'bg-[#FACC15] text-[#713F12]',
  C: 'bg-[#F87171] text-white',
  D: 'bg-[#6B7280] text-white',
};

function CircleRankBadge({ rank }: { rank?: string }) {
  if (!rank) return <span className="text-sm text-[#a3a3a3]">-</span>;
  return (
    <span className={`inline-flex items-center justify-center size-7 rounded-full text-xs font-bold ${rankColors[rank] || 'bg-gray-200 text-gray-700'}`}>
      {rank}
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
    <div className="flex items-center gap-1" data-testid="inspection-status-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          data-testid={`inspection-tab-${tab.key}`}
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
export function ContractorInspectionListPage() {
  /* ── Edit modal state ── */
  const [editRow, setEditRow] = useState<ContractorInspectionRow | null>(null);

  /* ── Quick-submit for draft records ── */
  const updateInspection = useUpdateInspection();
  const [submittingId, setSubmittingId] = useState<string | number | null>(null);
  const handleQuickSubmit = async (row: ContractorInspectionRow) => {
    setSubmittingId(null);
    try {
      await updateInspection.mutateAsync({
        id: String(row.id),
        data: { status: 'submitted' },
      });
      showNotification({
        title: '点検記録を提出しました',
        message: `${row.facilityName} — ${row.date}`,
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
  const [structureRankFilter, setStructureRankFilter] = useState<string | undefined>(undefined);
  const [wearRankFilter, setWearRankFilter] = useState<string | undefined>(undefined);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }, { id: 'id', desc: true }]);

  // Fetch real inspections from API (EC2 database)
  const { data: apiInspectionData, isLoading: isLoadingInspections } = useInspections();
  const apiInspections = apiInspectionData?.data;

  const baseData = useMemo(
    () => isLoadingInspections ? [] : buildContractorInspectionRows(apiInspections),
    [apiInspections, isLoadingInspections],
  );

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
      data = data.filter((r) => r.date === target);
    }
    if (structureRankFilter) {
      data = data.filter((r) => r.structureRank === structureRankFilter);
    }
    if (wearRankFilter) {
      data = data.filter((r) => r.wearRank === wearRankFilter);
    }
    return data;
  }, [statusTab, dateFilter, structureRankFilter, wearRankFilter, baseData]);

  /* ── Columns ── */
  const columns = useMemo<ColumnDef<ContractorInspectionRow>[]>(
    () => [
      {
        id: 'status',
        accessorKey: 'status',
        header: '状態',
        size: 88,
        cell: ({ row }) => <InspectionStatusBadge status={row.original.status} />,
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
        size: 130,
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
        id: 'date',
        header: '点検年月日',
        size: 120,
        accessorFn: (row) => row.date,
        cell: ({ row }) => (
          <span className="text-sm text-[#a3a3a3]">{row.original.date}</span>
        ),
        meta: { className: cellCls, headerClassName: headerCls },
      },
      {
        id: 'createdAt',
        header: '最終状態変更日',
        size: 120,
        accessorFn: (row) => row.createdAt,
        cell: ({ row }) => (
          <span className="text-sm text-[#a3a3a3]">{row.original.createdDate}</span>
        ),
        meta: { className: cellCls, headerClassName: headerCls },
      },
      {
        id: 'structureRank',
        header: '構造ランク',
        size: 90,
        accessorFn: (row) => row.structureRank,
        cell: ({ row }) => <CircleRankBadge rank={row.original.structureRank} />,
        meta: { className: 'px-2 text-center', headerClassName: `${headerCls} text-center` },
      },
      {
        id: 'structureMaterialNotes',
        header: '構造部材備考',
        size: 130,
        accessorFn: (row) => row.structureMaterialNotes,
        cell: ({ row }) => (
          <span className="text-sm text-[#a3a3a3]">{row.original.structureMaterialNotes || '-'}</span>
        ),
        meta: { className: cellCls, headerClassName: headerCls },
      },
      {
        id: 'wearRank',
        header: '消耗ランク',
        size: 90,
        accessorFn: (row) => row.wearRank,
        cell: ({ row }) => <CircleRankBadge rank={row.original.wearRank} />,
        meta: { className: 'px-2 text-center', headerClassName: `${headerCls} text-center` },
      },
      {
        id: 'wearMaterialNotes',
        header: '消耗部材備考',
        size: 130,
        accessorFn: (row) => row.wearMaterialNotes,
        cell: ({ row }) => (
          <span className="text-sm text-[#a3a3a3]">{row.original.wearMaterialNotes || '-'}</span>
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
                      data-testid={`inspection-quick-submit-${row.original.id}`}
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
                        data-testid={`inspection-quick-submit-confirm-${row.original.id}`}
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
        (r.structureMaterialNotes?.toLowerCase().includes(s) ?? false) ||
        (r.wearMaterialNotes?.toLowerCase().includes(s) ?? false)
      );
    },
  });

  /* ── Filter helpers ── */
  const hasFilters = !!structureRankFilter || !!wearRankFilter || !!dateFilter || !!globalFilter || statusTab !== 'all';

  function clearAllFilters() {
    setGlobalFilter('');
    setDateFilter('');
    setStructureRankFilter(undefined);
    setWearRankFilter(undefined);
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
  const toolbarSelectCls = 'h-9 w-full sm:w-[160px] rounded-lg border-[#e5e5e5] bg-white text-muted-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.00)]';

  return (
    <div
      className="flex min-h-0 flex-col overflow-hidden"
      style={{ margin: 16, padding: '0 24px 16px', height: 'calc(100% - 32px)' }}
      data-testid="contractor-inspection-list"
    >
      {/* Title bar */}
      <div className="flex items-center justify-between" style={{ margin: '4px 0 20px' }}>
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-semibold leading-none tracking-tight" data-testid="contractor-inspection-title">
            点検
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
            placeholder="ID, 公園名称, 施設名称, 備考"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            data-testid="inspection-search-input"
            className="h-auto min-h-0 flex-1 border-0 p-0 shadow-none focus-visible:ring-0 focus-visible:border-0"
          />
        </div>

        {/* 点検年月日 */}
        <div
          className="flex h-9 w-full sm:w-[180px] items-center gap-2 rounded-lg border border-[#e5e5e5] bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.00)]"
          style={{ padding: '0 12px' }}
        >
          <Input
            type="date"
            placeholder="点検年月日"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            data-testid="inspection-date-filter"
            className="h-auto min-h-0 flex-1 border-0 p-0 shadow-none focus-visible:ring-0 focus-visible:border-0 text-sm text-muted-foreground [&::-webkit-calendar-picker-indicator]:opacity-50"
          />
        </div>

        {/* 構造ランク */}
        <Select
          value={structureRankFilter ?? '__all__'}
          onValueChange={(v) => setStructureRankFilter(v === '__all__' ? undefined : v)}
        >
          <SelectTrigger className={toolbarSelectCls} style={{ paddingLeft: 16 }} data-testid="inspection-structure-rank-filter">
            <SelectValue placeholder="構造ランク" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">構造ランク</SelectItem>
            <SelectItem value="A">A</SelectItem>
            <SelectItem value="B">B</SelectItem>
            <SelectItem value="C">C</SelectItem>
            <SelectItem value="D">D</SelectItem>
          </SelectContent>
        </Select>

        {/* 消耗ランク */}
        <Select
          value={wearRankFilter ?? '__all__'}
          onValueChange={(v) => setWearRankFilter(v === '__all__' ? undefined : v)}
        >
          <SelectTrigger className={toolbarSelectCls} style={{ paddingLeft: 16 }} data-testid="inspection-wear-rank-filter">
            <SelectValue placeholder="消耗ランク" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">消耗ランク</SelectItem>
            <SelectItem value="A">A</SelectItem>
            <SelectItem value="B">B</SelectItem>
            <SelectItem value="C">C</SelectItem>
            <SelectItem value="D">D</SelectItem>
          </SelectContent>
        </Select>

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
                  data-testid="inspection-clear-filters"
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
            data-testid="inspection-table-scroll"
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
              <TableBody data-testid="inspection-table-body">
                {visibleRows.length ? (
                  visibleRows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-testid="inspection-table-row"
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
                      該当する点検記録がありません
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {hasMoreRows && <div ref={sentinelRef} className="h-1" />}
          </div>
        </div>
      </div>

      {/* Edit inspection modal */}
      {editRow && (
        <ContractorInspectionForm
          key={String(editRow.id)}
          facilityId={editRow.facilityRef}
          open
          recordId={editRow.id}
          initialData={{
            inspectionDate: editRow.date?.replace(/\//g, '-'),
            inspector: editRow.inspector,
            structureRank: editRow.structureRank,
            wearRank: editRow.wearRank,
            structureMaterialNotes: editRow.structureMaterialNotes,
            wearMaterialNotes: editRow.wearMaterialNotes,
          }}
          onClose={() => setEditRow(null)}
          onSubmitted={() => setEditRow(null)}
        />
      )}
    </div>
  );
}

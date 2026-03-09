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
import { Search, Ellipsis, CircleArrowRight, Plus, FileInput, Printer } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DataTableViewOptions, type FilterOption } from '@/components/ui/data-table-view-options';

import {
  DUMMY_CASES,
  CASE_STATUS_CONFIG,
  CASE_TYPE_LABELS,
  CASE_URGENCY_CONFIG,
  calculateUrgency,
  getCaseCounts,
  type DummyCase,
} from '../../data/dummyCases';
import { DUMMY_FACILITIES, type DummyFacility, FACILITY_CLASSIFICATION_LABELS, PARK_NAME_LOOKUP } from '../../data/dummyFacilities';
import { DUMMY_PARK_FACILITIES } from '../../data/dummyParkFacilities';
import { FacilityPlaceholderImage } from '@/components/facility/FacilityPlaceholderImage';
import { RankBadge } from '@/components/facility/RankBadge';
import { useScrollRestore } from '../../hooks/useScrollRestore';
import { CasePreviewPanel } from './CasePreviewPanel';
import { useInspections, useRepairs } from '../../hooks/useApi';
import type { InspectionRecord, RepairRecord } from '@nagoya/shared';

/* ── Style tokens ── */
const headerCls = 'h-10 px-2 text-xs font-medium text-muted-foreground border-b border-[#f5f5f5]';
const cellCls = 'px-2 text-sm max-w-0 truncate';
const modalSectionTitleCls = 'text-sm font-normal uppercase tracking-[1.5px] text-[#737373]';
const modalLabelCls = 'text-sm font-medium text-[#0a0a0a]';
const modalSelectTriggerCls = 'mt-1 h-9 w-full rounded-lg border-[#e5e5e5] bg-white px-3 text-sm shadow-[0_1px_2px_0_rgba(0,0,0,0)] data-[placeholder]:text-transparent focus-visible:ring-1 focus-visible:ring-ring';
const modalGridCls = 'grid grid-cols-3 gap-4';

/* ── Toolbar filter options ── */
const TOOLBAR_FILTER_OPTIONS: FilterOption[] = [
  { id: 'search', label: '検索' },
  { id: 'type', label: '種別' },
  { id: 'parkName', label: '公園名称' },
  { id: 'urgency', label: '緊急度' },
  { id: 'vendor', label: '業者' },
];

const DEFAULT_VISIBLE_FILTERS = ['search', 'type', 'parkName', 'urgency'];

/* ── Advanced filter icon ── */
function AdvancedSearchIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M14 2.16666C14.2761 2.16666 14.5 2.39052 14.5 2.66666C14.5 2.9428 14.2761 3.16666 14 3.16666H9.33333C9.05719 3.16666 8.83333 2.9428 8.83333 2.66666C8.83333 2.39052 9.05719 2.16666 9.33333 2.16666H14Z" fill="currentColor" />
      <path d="M6.66667 2.16666C6.94281 2.16666 7.16667 2.39052 7.16667 2.66666C7.16667 2.9428 6.94281 3.16666 6.66667 3.16666H2C1.72386 3.16666 1.5 2.9428 1.5 2.66666C1.5 2.39052 1.72386 2.16666 2 2.16666H6.66667Z" fill="currentColor" />
      <path d="M14 7.49999C14.2761 7.49999 14.5 7.72385 14.5 7.99999C14.5 8.27614 14.2761 8.49999 14 8.49999H8C7.72386 8.49999 7.5 8.27614 7.5 7.99999C7.5 7.72385 7.72386 7.49999 8 7.49999H14Z" fill="currentColor" />
      <path d="M5.33333 7.49999C5.60948 7.49999 5.83333 7.72385 5.83333 7.99999C5.83333 8.27614 5.60948 8.49999 5.33333 8.49999H2C1.72386 8.49999 1.5 8.27614 1.5 7.99999C1.5 7.72385 1.72386 7.49999 2 7.49999H5.33333Z" fill="currentColor" />
      <path d="M14 12.8333C14.2761 12.8333 14.5 13.0572 14.5 13.3333C14.5 13.6095 14.2761 13.8333 14 13.8333H10.6667C10.3905 13.8333 10.1667 13.6095 10.1667 13.3333C10.1667 13.0572 10.3905 12.8333 10.6667 12.8333H14Z" fill="currentColor" />
      <path d="M8 12.8333C8.27614 12.8333 8.5 13.0572 8.5 13.3333C8.5 13.6095 8.27614 13.8333 8 13.8333H2C1.72386 13.8333 1.5 13.6095 1.5 13.3333C1.5 13.0572 1.72386 12.8333 2 12.8333H8Z" fill="currentColor" />
      <path d="M8.83333 3.99999V1.33333C8.83333 1.05719 9.05719 0.833328 9.33333 0.833328C9.60948 0.833328 9.83333 1.05719 9.83333 1.33333V3.99999C9.83333 4.27614 9.60948 4.49999 9.33333 4.49999C9.05719 4.49999 8.83333 4.27614 8.83333 3.99999Z" fill="currentColor" />
      <path d="M4.83333 9.33333V6.66666C4.83333 6.39052 5.05719 6.16666 5.33333 6.16666C5.60948 6.16666 5.83333 6.39052 5.83333 6.66666V9.33333C5.83333 9.60947 5.60948 9.83333 5.33333 9.83333C5.05719 9.83333 4.83333 9.60947 4.83333 9.33333Z" fill="currentColor" />
      <path d="M10.1667 14.6667V12C10.1667 11.7239 10.3905 11.5 10.6667 11.5C10.9428 11.5 11.1667 11.7239 11.1667 12V14.6667C11.1667 14.9428 10.9428 15.1667 10.6667 15.1667C10.3905 15.1667 10.1667 14.9428 10.1667 14.6667Z" fill="currentColor" />
    </svg>
  );
}

/* ── CSV export helpers ── */
function escapeCsvCell(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatCaseColumnValue(row: DummyCase, columnId: string): string {
  switch (columnId) {
    case 'status': return CASE_STATUS_CONFIG[row.status]?.label ?? row.status;
    case 'id': return String(row.id);
    case 'type': return CASE_TYPE_LABELS[row.type] ?? row.type;
    case 'parkName': return row.parkName;
    case 'facility': return `${row.facilityName}, ${row.facilityId}`;
    case 'vendor': return row.vendor;
    case 'createdAt': return row.createdDate;
    case 'lastStatusChange': return row.lastStatusChange;
    case 'urgency': return CASE_URGENCY_CONFIG[row.urgency]?.label ?? row.urgency;
    default: return '';
  }
}

function downloadCsv(csvText: string, filename: string) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Facility lookup for popover ── */
const FACILITY_LOOKUP = new Map<string, DummyFacility>(
  DUMMY_FACILITIES.map((f) => [f.id, f]),
);

/* (park names now computed per-type inside the component) */

const stickyRightStyle: React.CSSProperties = {
  position: 'sticky',
  right: 0,
  backgroundColor: 'white',
  boxShadow: '-4px 0 8px -4px rgba(0,0,0,0.08)',
};

/* ── Status badge component ── */
function CaseStatusBadge({ status }: { status: string }) {
  const config = CASE_STATUS_CONFIG[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${config.className}`}>
      {config.label}
    </span>
  );
}

/* ── Urgency badge (pill) ── */
function CaseUrgencyBadge({ level }: { level: string }) {
  const c = CASE_URGENCY_CONFIG[level] || { label: level, cls: 'bg-gray-200 text-gray-700' };
  return (
    <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-normal ${c.cls}`}>
      {c.label}
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
        {/* Header */}
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

        {/* Photo */}
        {facility && (
          <div className="px-3 pb-2">
            <div className="overflow-hidden rounded-md">
              <FacilityPlaceholderImage category={facility.category} size={220} />
            </div>
          </div>
        )}

        {/* Details */}
        <div className="space-y-3 px-3 pb-3">
          {/* ID / Classification / Quantity row */}
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

          {/* Rank badges */}
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

          {/* Additional details */}
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

/* ── Tab component ── */
type StatusTab = 'all' | 'pending' | 'returned' | 'confirmed';

function StatusTabs({
  active,
  counts,
  onChange,
  hideReturned,
}: {
  active: StatusTab;
  counts: { all: number; pending: number; returned: number; confirmed: number };
  onChange: (tab: StatusTab) => void;
  hideReturned?: boolean;
}) {
  const tabs: { key: StatusTab; label: string; count: number }[] = [
    { key: 'all', label: 'すべて', count: counts.all },
    { key: 'pending', label: '未確認', count: counts.pending },
    ...(hideReturned ? [] : [{ key: 'returned' as StatusTab, label: '差戻', count: counts.returned }]),
    { key: 'confirmed', label: '確認済', count: counts.confirmed },
  ];

  return (
    <div className="flex items-center gap-1" data-testid="case-status-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          data-testid={`case-tab-${tab.key}`}
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
function CaseListPageInner({ caseType }: { caseType?: 'inspection' | 'repair' }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  /* ── Selected case for preview panel ── */
  const selectedCaseId = searchParams.get('selected');
  const setSelectedCaseId = useCallback(
    (id: number | null) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (id != null) next.set('selected', String(id));
        else next.delete('selected');
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  /* ── Filter state ── */
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [globalFilter, setGlobalFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [parkNameFilter, setParkNameFilter] = useState<string | undefined>(undefined);
  const [urgencyFilter, setUrgencyFilter] = useState<string | undefined>(undefined);
  const [vendorFilter, setVendorFilter] = useState<string | undefined>(undefined);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }, { id: 'id', desc: true }]);

  /* ── Visible toolbar filters ── */
  const [visibleFilters, setVisibleFilters] = useState<string[]>(DEFAULT_VISIBLE_FILTERS);

  /* ── Advanced search dialog ── */
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);
  const [draft, setDraft] = useState({
    search: '',
    type: undefined as string | undefined,
    parkName: undefined as string | undefined,
    urgency: undefined as string | undefined,
    vendor: undefined as string | undefined,
  });

  function openAdvancedSearch() {
    setDraft({
      search: globalFilter,
      type: typeFilter,
      parkName: parkNameFilter,
      urgency: urgencyFilter,
      vendor: vendorFilter,
    });
    setAdvancedSearchOpen(true);
  }

  function applyAdvancedSearch() {
    setGlobalFilter(draft.search);
    setTypeFilter(draft.type);
    setParkNameFilter(draft.parkName);
    setUrgencyFilter(draft.urgency);
    setVendorFilter(draft.vendor);
    setAdvancedSearchOpen(false);
  }

  function clearDraft() {
    setDraft({ search: '', type: undefined, parkName: undefined, urgency: undefined, vendor: undefined });
  }

  // Fetch real inspections and repairs from API (EC2 database)
  const { data: apiInspectionData } = useInspections();
  const apiInspections = apiInspectionData?.data;
  const { data: apiRepairData } = useRepairs();
  const apiRepairs = apiRepairData?.data;

  /* ── Base data filtered by case type, merged with API records ── */
  const baseData = useMemo(() => {
    const dummyCases = caseType ? DUMMY_CASES.filter((c) => c.type === caseType) : DUMMY_CASES;
    const facilityLookup = new Map(DUMMY_FACILITIES.map((f) => [f.id, f]));
    const existing = new Set(dummyCases.map((c) => `${c.facilityRef}|${c.createdDate}`));
    const merged: DummyCase[] = [...dummyCases];

    // Merge API inspection records as DummyCase entries
    if ((!caseType || caseType === 'inspection') && apiInspections) {
      const apiCases: DummyCase[] = apiInspections.map((rec: InspectionRecord) => {
        const assetId = rec.assetId ?? '';
        const fac = facilityLookup.get(assetId);
        const parkFac = !fac
          ? DUMMY_PARK_FACILITIES.find((f) => f.properties.id === assetId)?.properties
          : null;
        const resolved = fac ?? parkFac;
        const greenSpaceRef = resolved?.greenSpaceRef ?? '';
        const parkName = greenSpaceRef ? PARK_NAME_LOOKUP[greenSpaceRef] || '-' : '-';
        const dateStr = rec.inspectionDate?.replace(/-/g, '/') ?? '';
        const m = rec.measurements as Record<string, string | undefined> | null;
        const updatedDateStr = rec.updatedAt ? new Date(rec.updatedAt).toISOString().split('T')[0].replace(/-/g, '/') : dateStr;
        return {
          id: rec.id as unknown as number,
          status: (rec.status === 'confirmed' ? 'confirmed' : rec.status === 'returned' ? 'returned' : 'pending') as 'pending' | 'confirmed' | 'returned',
          type: 'inspection' as const,
          parkRef: greenSpaceRef,
          parkName,
          facilityRef: assetId,
          facilityName: resolved?.name || assetId,
          facilityId: fac?.facilityId || (parkFac as { facilityId?: string } | null)?.facilityId || '',
          vendor: rec.inspector ?? '',
          createdDate: dateStr,
          createdAt: rec.createdAt || dateStr.replace(/\//g, '-') + 'T00:00:00Z',
          lastStatusChange: updatedDateStr,
          urgency: calculateUrgency(m?.structureRank, m?.wearRank) ?? 'medium',
        };
      });
      const unique = apiCases.filter((c) => !existing.has(`${c.facilityRef}|${c.createdDate}`));
      merged.unshift(...unique);
    }

    // Merge API repair records as DummyCase entries
    if ((!caseType || caseType === 'repair') && apiRepairs) {
      const apiRepairCases: DummyCase[] = apiRepairs.map((rec: RepairRecord) => {
        const assetId = rec.assetId ?? '';
        const fac = facilityLookup.get(assetId);
        const parkFac = !fac
          ? DUMMY_PARK_FACILITIES.find((f) => f.properties.id === assetId)?.properties
          : null;
        const resolved = fac ?? parkFac;
        const greenSpaceRef = resolved?.greenSpaceRef ?? '';
        const parkName = greenSpaceRef ? PARK_NAME_LOOKUP[greenSpaceRef] || '-' : '-';
        const dateStr = rec.repairDate?.replace(/-/g, '/') ?? '';
        const m = rec.measurements as Record<string, string | undefined> | null;
        const updatedDateStr = rec.createdAt ? new Date(rec.createdAt).toISOString().split('T')[0].replace(/-/g, '/') : dateStr;
        return {
          id: rec.id as unknown as number,
          status: (rec.status === 'confirmed' ? 'confirmed' : rec.status === 'returned' ? 'returned' : 'pending') as 'pending' | 'confirmed' | 'returned',
          type: 'repair' as const,
          parkRef: greenSpaceRef,
          parkName,
          facilityRef: assetId,
          facilityName: resolved?.name || assetId,
          facilityId: fac?.facilityId || (parkFac as { facilityId?: string } | null)?.facilityId || '',
          vendor: rec.vendor ?? '',
          createdDate: dateStr,
          createdAt: rec.createdAt || dateStr.replace(/\//g, '-') + 'T00:00:00Z',
          lastStatusChange: updatedDateStr,
          urgency: calculateUrgency(m?.structureRank, m?.wearRank) ?? 'medium',
        };
      });
      const unique = apiRepairCases.filter((c) => !existing.has(`${c.facilityRef}|${c.createdDate}`));
      merged.unshift(...unique);
    }

    return merged;
  }, [caseType, apiInspections, apiRepairs]);

  const pageTitle = caseType === 'inspection' ? '点検' : caseType === 'repair' ? '補修' : '案件管理';

  /* ── Unique park names from filtered base data ── */
  const typedParkNameOptions = useMemo(
    () => [...new Set(baseData.map((c) => c.parkName))].sort((a, b) => a.localeCompare(b, 'ja')),
    [baseData],
  );

  /* ── Unique vendor names ── */
  const vendorOptions = useMemo(
    () => [...new Set(baseData.map((c) => c.vendor).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja')),
    [baseData],
  );

  /* ── Derived data ── */
  const counts = useMemo(() => getCaseCounts(baseData), [baseData]);

  const filteredData = useMemo(() => {
    let data = baseData;
    if (statusTab !== 'all') {
      data = data.filter((c) => c.status === statusTab);
    }
    if (!caseType && typeFilter) {
      data = data.filter((c) => c.type === typeFilter);
    }
    if (parkNameFilter) {
      data = data.filter((c) => c.parkName === parkNameFilter);
    }
    if (urgencyFilter) {
      data = data.filter((c) => c.urgency === urgencyFilter);
    }
    if (vendorFilter) {
      data = data.filter((c) => c.vendor === vendorFilter);
    }
    return data;
  }, [statusTab, typeFilter, parkNameFilter, urgencyFilter, vendorFilter, baseData, caseType]);

  /* ── Columns ── */
  const columns = useMemo<ColumnDef<DummyCase>[]>(
    () => [
      {
        id: 'status',
        accessorKey: 'status',
        header: '状態',
        size: 88,
        cell: ({ row }) => <CaseStatusBadge status={row.original.status} />,
        meta: { className: 'px-2 text-center', headerClassName: `${headerCls} text-center` },
      },
      {
        accessorKey: 'id',
        header: 'ID',
        size: 70,
        cell: ({ row }) => <span className="text-sm text-[#0a0a0a]">{row.original.id}</span>,
        meta: { className: cellCls, headerClassName: headerCls },
      },
      // Only show type column when not filtered by type
      ...(!caseType ? [{
        id: 'type',
        header: '種別',
        size: 102,
        accessorFn: (row: DummyCase) => row.type,
        cell: ({ row }: { row: { original: DummyCase } }) => (
          <span className="text-sm text-[#0a0a0a]">
            {CASE_TYPE_LABELS[row.original.type] || row.original.type}
          </span>
        ),
        meta: { className: cellCls, headerClassName: headerCls },
      } as ColumnDef<DummyCase>] : []),
      {
        id: 'parkName',
        header: '公園名称',
        size: 144,
        accessorFn: (row) => row.parkName,
        cell: ({ row }) => (
          <button
            type="button"
            className="text-sm text-primary underline decoration-primary/40 hover:decoration-primary bg-transparent border-0 cursor-pointer p-0 text-left truncate max-w-full"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/assets/parks/${row.original.parkRef}`);
            }}
          >
            {row.original.parkName}
          </button>
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
              data-testid="facility-popover-trigger"
              onClick={(e) => e.stopPropagation()}
            >
              {row.original.facilityName}, {row.original.facilityId}
            </button>
          </FacilityInfoPopover>
        ),
        meta: { className: cellCls, headerClassName: headerCls },
      },
      {
        accessorKey: 'vendor',
        header: '業者',
        size: 143,
        cell: ({ row }) => (
          <span className="text-sm text-[#a3a3a3]">{row.original.vendor}</span>
        ),
        meta: { className: cellCls, headerClassName: headerCls },
      },
      {
        id: 'createdAt',
        header: '点検年月日',
        size: 143,
        accessorFn: (row) => row.createdAt || row.createdDate.replace(/\//g, '-') + 'T00:00:00Z',
        cell: ({ row }) => (
          <span className="text-sm text-[#a3a3a3]">{row.original.createdDate}</span>
        ),
        meta: { className: cellCls, headerClassName: headerCls },
      },
      {
        accessorKey: 'lastStatusChange',
        header: '最終状態変更日',
        size: 172,
        cell: ({ row }) => (
          <span className="text-sm text-[#a3a3a3]">{row.original.lastStatusChange}</span>
        ),
        meta: { className: cellCls, headerClassName: headerCls },
      },
      {
        id: 'urgency',
        header: '緊急度',
        size: 81,
        accessorFn: (row) => row.urgency,
        cell: ({ row }) => <CaseUrgencyBadge level={row.original.urgency} />,
        meta: { className: 'px-2 text-center', headerClassName: `${headerCls} text-center` },
      },
      {
        id: 'actions',
        size: 82,
        header: '',
        cell: ({ row }) => (
          <div className="flex items-center justify-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="border-0 bg-transparent p-0 cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Ellipsis className="size-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                  案件操作
                </DropdownMenuLabel>
                <DropdownMenuItem>編集</DropdownMenuItem>
                <DropdownMenuItem>複製</DropdownMenuItem>
                <DropdownMenuItem className="text-red-600">削除</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <CircleArrowRight
              className="size-4 text-muted-foreground hover:text-foreground cursor-pointer"
              data-testid="case-detail-link"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/cases/${row.original.id}`);
              }}
            />
          </div>
        ),
        enableHiding: false,
        meta: { className: 'h-10 px-2 text-center', headerClassName: `${headerCls} text-center` },
      },
    ],
    [navigate, caseType],
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
      const c = row.original;
      return (
        String(c.id).includes(s) ||
        c.facilityName.toLowerCase().includes(s) ||
        c.facilityId.toLowerCase().includes(s) ||
        c.parkName.toLowerCase().includes(s) ||
        c.vendor.toLowerCase().includes(s)
      );
    },
  });

  /* ── Filter helpers ── */
  const hasFilters =
    (!caseType && !!typeFilter) || !!parkNameFilter || !!urgencyFilter || !!vendorFilter || !!globalFilter || statusTab !== 'all';

  const activeFilterCount = [
    globalFilter,
    !caseType && typeFilter,
    parkNameFilter,
    urgencyFilter,
    vendorFilter,
  ].filter(Boolean).length;

  function clearAllFilters() {
    setGlobalFilter('');
    setTypeFilter(undefined);
    setParkNameFilter(undefined);
    setUrgencyFilter(undefined);
    setVendorFilter(undefined);
    setStatusTab('all');
    setVisibleFilters(DEFAULT_VISIBLE_FILTERS);
  }

  /* ── CSV export ── */
  const getExportableColumns = useCallback(() => {
    return table.getVisibleLeafColumns()
      .filter(col => col.id !== 'actions')
      .map(col => ({
        id: col.id,
        header: typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id,
      }));
  }, [table]);

  const handleExportCsv = useCallback(() => {
    const cols = getExportableColumns();
    const rows = table.getRowModel().rows;
    const bom = '\uFEFF';
    const header = cols.map(c => escapeCsvCell(c.header)).join(',');
    const dataRows = rows.map(row =>
      cols.map(col => escapeCsvCell(formatCaseColumnValue(row.original, col.id))).join(',')
    );
    const csv = bom + [header, ...dataRows].join('\r\n');
    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    downloadCsv(csv, `cases_export_${ts}.csv`);
  }, [table, getExportableColumns]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  /* ── Scrollbar auto-hide ── */
  const scrollRef = useRef<HTMLDivElement>(null);
  const savedScrollTop = useScrollRestore(scrollRef as RefObject<HTMLElement>, { manualRestore: true });
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
  const [visibleRowCount, setVisibleRowCount] = useState(() =>
    savedScrollTop != null ? Math.ceil((savedScrollTop + 1000) / TABLE_ROW_H) : 20,
  );
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

  /* ── Scroll restoration for back/forward navigation ── */
  useEffect(() => {
    if (savedScrollTop == null) return;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: savedScrollTop });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset visible rows and scroll to top only on actual filter changes
  const prevFilteredData = useRef(filteredData);
  useEffect(() => {
    if (prevFilteredData.current === filteredData) return;
    prevFilteredData.current = filteredData;
    // Use 2× batchSize so content clearly overflows the container,
    // preventing the "can only scroll 9px" issue after filter changes.
    setVisibleRowCount(batchSize * 2);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [filteredData, batchSize]);

  /* Scroll containment is handled via CSS overscroll-behavior: contain
     on the scroll container, replacing the previous custom wheel handler
     that blocked native momentum scrolling and caused scroll failures. */

  const totalWidth = table.getVisibleLeafColumns().reduce((sum, c) => sum + (c.getSize() ?? 100), 0);
  const toolbarSelectCls = 'h-9 w-full sm:w-[229px] rounded-lg border-[#e5e5e5] bg-white text-muted-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.00)]';

  /* ── Selected case for preview panel ── */
  const selectedCase = useMemo(
    () => selectedCaseId ? baseData.find((c) => String(c.id) === selectedCaseId) ?? null : null,
    [selectedCaseId, baseData],
  );

  return (
    <div
      className="flex min-h-0 flex-col overflow-hidden"
      style={{ margin: 16, padding: '0 24px 16px', height: 'calc(100% - 32px)' }}
    >
      {/* Title bar */}
      <div className="flex items-center justify-between" style={{ margin: '4px 0 20px' }}>
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-semibold leading-none tracking-tight" data-testid="case-page-title">
            {pageTitle}
          </h1>
          <StatusTabs active={statusTab} counts={counts} onChange={setStatusTab} hideReturned={caseType === 'inspection'} />
        </div>
        <Button
          size="icon-sm"
          className="size-9 rounded-full border-0 bg-[#215042] hover:bg-[#2a6554]"
          data-testid="case-add-button"
        >
          <Plus className="size-4" />
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-start gap-3" style={{ marginBottom: 16 }}>
        <div className="flex min-w-[320px] flex-1 flex-wrap items-center gap-3">
          {/* Search */}
          {visibleFilters.includes('search') && (
            <div
              className="flex h-9 w-full sm:w-[229px] items-center gap-3 rounded-lg border border-[#e5e5e5] bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.00)]"
              style={{ padding: '0 16px' }}
            >
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <Input
                placeholder="ID, 施設名称, 施設ID"
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                data-testid="case-search-input"
                className="h-auto min-h-0 flex-1 border-0 p-0 shadow-none focus-visible:ring-0 focus-visible:border-0"
              />
            </div>
          )}

          {/* 種別 — only shown when not filtered by type */}
          {visibleFilters.includes('type') && !caseType && (
            <Select
              value={typeFilter ?? '__all__'}
              onValueChange={(v) => setTypeFilter(v === '__all__' ? undefined : v)}
            >
              <SelectTrigger className={toolbarSelectCls} style={{ paddingLeft: 16 }} data-testid="case-type-filter">
                <SelectValue placeholder="種別" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">種別</SelectItem>
                <SelectItem value="inspection">点検</SelectItem>
                <SelectItem value="repair">補修</SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* 公園名称 */}
          {visibleFilters.includes('parkName') && (
            <Select
              value={parkNameFilter ?? '__all__'}
              onValueChange={(v) => setParkNameFilter(v === '__all__' ? undefined : v)}
            >
              <SelectTrigger className={toolbarSelectCls} style={{ paddingLeft: 16 }} data-testid="case-park-filter">
                <SelectValue placeholder="公園名称" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">公園名称</SelectItem>
                {typedParkNameOptions.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* 緊急度 */}
          {visibleFilters.includes('urgency') && (
            <Select
              value={urgencyFilter ?? '__all__'}
              onValueChange={(v) => setUrgencyFilter(v === '__all__' ? undefined : v)}
            >
              <SelectTrigger className={toolbarSelectCls} style={{ paddingLeft: 16 }} data-testid="case-urgency-filter">
                <SelectValue placeholder="緊急度" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">緊急度</SelectItem>
                <SelectItem value="high">高</SelectItem>
                <SelectItem value="medium">中</SelectItem>
                <SelectItem value="low">低</SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* 業者 */}
          {visibleFilters.includes('vendor') && (
            <Select
              value={vendorFilter ?? '__all__'}
              onValueChange={(v) => setVendorFilter(v === '__all__' ? undefined : v)}
            >
              <SelectTrigger className={toolbarSelectCls} style={{ paddingLeft: 16 }}>
                <SelectValue placeholder="業者" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">業者</SelectItem>
                {vendorOptions.map((v) => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <TooltipProvider>
          <div className="flex shrink-0 items-center gap-2">
            {/* 詳細フィルター */}
            <div className="relative">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon-sm"
                    className="size-9 border border-[#e5e5e5] bg-[#f5f5f5] text-[#595959] hover:bg-[#ececec]"
                    onClick={openAdvancedSearch}
                  >
                    <AdvancedSearchIcon className="size-4" />
                    <span className="sr-only">詳細フィルター</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>詳細フィルター</TooltipContent>
              </Tooltip>
              {activeFilterCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex size-[18px] items-center justify-center rounded-full bg-[#215042] text-[10px] font-bold leading-none text-white">
                  {activeFilterCount}
                </span>
              )}
            </div>

            {/* テーブル設定 */}
            <DataTableViewOptions
              table={table}
              filterOptions={caseType ? TOOLBAR_FILTER_OPTIONS.filter(o => o.id !== 'type') : TOOLBAR_FILTER_OPTIONS}
              visibleFilters={visibleFilters}
              onVisibleFiltersChange={setVisibleFilters}
            />

            {/* テーブル操作 */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon-sm"
                        className="size-9 border border-[#e5e5e5] bg-[#f5f5f5] text-[#595959] hover:bg-[#ececec]"
                      >
                        <Ellipsis className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[200px]">
                      <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                        テーブル操作
                      </DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={handleExportCsv}
                        disabled={table.getRowModel().rows.length === 0}
                      >
                        <FileInput className="size-4" />
                        CSVエクスポート
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handlePrint}>
                        <Printer className="size-4" />
                        印刷
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TooltipTrigger>
              <TooltipContent>テーブル操作</TooltipContent>
            </Tooltip>

            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              disabled={!hasFilters}
              className="text-sm text-muted-foreground hover:text-foreground hover:bg-transparent disabled:opacity-40 ml-1 border-0 bg-transparent shadow-none"
              data-testid="case-clear-all"
            >
              すべてクリア
            </Button>
          </div>
        </TooltipProvider>
      </div>

      {/* Table container */}
      <div
        className="relative flex min-h-0 flex-1 overflow-hidden rounded-lg"
        style={{
          boxShadow:
            '0 1px 3px 0 rgba(0, 0, 0, 0.10), 0 1px 2px -1px rgba(0, 0, 0, 0.10)',
        }}
      >
        <div className={`flex min-h-0 min-w-0 flex-1 flex-col transition-[margin] duration-200 ${selectedCase ? 'mr-[494px]' : ''}`}>
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            data-testid="case-table-scroll"
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
                            ...(header.column.id === 'actions'
                              ? { ...stickyRightStyle, zIndex: 20 }
                              : {}),
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
              <TableBody data-testid="case-table-body">
                {visibleRows.length ? (
                  visibleRows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-testid="case-table-row"
                      className={`cursor-pointer hover:bg-[#f5f5f5] transition-colors ${selectedCaseId === String(row.original.id) ? 'bg-[#f0fdf4]' : ''}`}
                      onClick={() => setSelectedCaseId(row.original.id)}
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
                              ...(cell.column.id === 'actions'
                                ? stickyRightStyle
                                : {}),
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
                      該当する案件がありません
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {hasMoreRows && <div ref={sentinelRef} className="h-1" />}
          </div>
        </div>

        {/* Preview panel overlay */}
        {selectedCase && (
          <div
            className="absolute right-0 top-0 bottom-0 z-10 w-[494px] bg-white flex flex-col overflow-hidden"
            style={{
              boxShadow: '-10px 0 15px -3px rgba(0, 0, 0, 0.1), -4px 0 6px -4px rgba(0, 0, 0, 0.1)',
              borderTopRightRadius: 8,
              borderBottomRightRadius: 8,
            }}
            data-testid="case-preview-panel"
          >
            <CasePreviewPanel
              caseData={selectedCase}
              onClose={() => setSelectedCaseId(null)}
              onNavigateToDetail={() => navigate(`/cases/${selectedCase.id}`)}
            />
          </div>
        )}
      </div>

      {/* ── Advanced filter dialog ── */}
      <Dialog open={advancedSearchOpen} onOpenChange={setAdvancedSearchOpen}>
        <DialogContent
          className="flex flex-col w-[700px] max-w-[calc(100vw-32px)] sm:max-w-[700px] max-h-[calc(100vh-2rem)] gap-0 overflow-hidden rounded-xl border border-[#e5e5e5] bg-white p-0 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-4px_rgba(0,0,0,0.1)] [&_[data-slot=dialog-close]]:top-4 [&_[data-slot=dialog-close]]:right-4 [&_[data-slot=dialog-close]]:border-0 [&_[data-slot=dialog-close]]:bg-transparent [&_[data-slot=dialog-close]_svg]:size-6"
          showCloseButton
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader className="p-4 items-start self-stretch">
            <DialogTitle className="text-xl font-bold leading-6 tracking-normal text-[#0a0a0a]">詳細検索</DialogTitle>
            <DialogDescription className="sr-only">案件の詳細検索フィルター</DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            <div className="space-y-6">
              {/* 基本情報 */}
              <div className="space-y-3">
                <p className={modalSectionTitleCls}>基本情報</p>
                <div className="space-y-2">
                  <div>
                    <label className={modalLabelCls}>検索</label>
                    <div className="mt-1 flex h-9 items-center gap-2 rounded-lg border border-[#e5e5e5] bg-white px-3 shadow-[0_1px_2px_0_rgba(0,0,0,0)]">
                      <Search className="size-4 shrink-0 text-[#a3a3a3]" />
                      <Input
                        placeholder="ID, 施設名称, 施設ID"
                        value={draft.search}
                        onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
                        className="h-auto min-h-0 flex-1 border-0 p-0 text-sm shadow-none placeholder:text-[#a3a3a3] focus-visible:ring-0"
                      />
                    </div>
                  </div>
                  <div className={modalGridCls}>
                    {!caseType && (
                      <div>
                        <label className={modalLabelCls}>種別</label>
                        <Select value={draft.type ?? '__all__'} onValueChange={(v) => setDraft((d) => ({ ...d, type: v === '__all__' ? undefined : v }))}>
                          <SelectTrigger className={modalSelectTriggerCls}>
                            <SelectValue placeholder="" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__all__">すべて</SelectItem>
                            <SelectItem value="inspection">点検</SelectItem>
                            <SelectItem value="repair">補修</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div>
                      <label className={modalLabelCls}>公園名称</label>
                      <Select value={draft.parkName ?? '__all__'} onValueChange={(v) => setDraft((d) => ({ ...d, parkName: v === '__all__' ? undefined : v }))}>
                        <SelectTrigger className={modalSelectTriggerCls}>
                          <SelectValue placeholder="" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">すべて</SelectItem>
                          {typedParkNameOptions.map((name) => (
                            <SelectItem key={name} value={name}>{name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className={modalLabelCls}>緊急度</label>
                      <Select value={draft.urgency ?? '__all__'} onValueChange={(v) => setDraft((d) => ({ ...d, urgency: v === '__all__' ? undefined : v }))}>
                        <SelectTrigger className={modalSelectTriggerCls}>
                          <SelectValue placeholder="" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">すべて</SelectItem>
                          <SelectItem value="high">高</SelectItem>
                          <SelectItem value="medium">中</SelectItem>
                          <SelectItem value="low">低</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* 担当・業者 */}
              <div className="space-y-3">
                <p className={modalSectionTitleCls}>担当・業者</p>
                <div className={modalGridCls}>
                  <div>
                    <label className={modalLabelCls}>業者</label>
                    <Select value={draft.vendor ?? '__all__'} onValueChange={(v) => setDraft((d) => ({ ...d, vendor: v === '__all__' ? undefined : v }))}>
                      <SelectTrigger className={modalSelectTriggerCls}>
                        <SelectValue placeholder="" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">すべて</SelectItem>
                        {vendorOptions.map((v) => (
                          <SelectItem key={v} value={v}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between bg-[#f5f5f5] p-4">
            <button
              type="button"
              className="border-0 bg-transparent text-sm font-medium text-[#737373] hover:text-[#525252] cursor-pointer"
              onClick={clearDraft}
            >
              すべてクリア
            </button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setAdvancedSearchOpen(false)}
                className="h-9 rounded-lg border-[#d4d4d4] bg-white px-4 text-sm font-medium shadow-[0_1px_2px_0_rgba(0,0,0,0)] hover:bg-[#f5f5f5]"
              >
                Cancel
              </Button>
              <Button
                onClick={applyAdvancedSearch}
                className="h-9 rounded-lg bg-[#215042] px-4 text-sm font-medium text-white shadow-none hover:bg-[#1a4035]"
              >
                Apply
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Exported page components ── */
export function CaseListPage() {
  return <CaseListPageInner />;
}

export function InspectionCaseListPage() {
  return <CaseListPageInner caseType="inspection" />;
}

export function RepairCaseListPage() {
  return <CaseListPageInner caseType="repair" />;
}

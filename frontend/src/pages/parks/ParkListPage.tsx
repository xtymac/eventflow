import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type ColumnDef,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Search, Ellipsis, CircleArrowRight, Plus, CalendarIcon } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { DataTableViewOptions, type FilterOption } from '@/components/ui/data-table-view-options';
import { CURATED_PARKS, type CuratedPark } from '../../data/curatedParks';
import { ParkPreviewPanel } from './ParkPreviewPanel';

/* ── Style tokens ── */
const headerCls = 'h-10 px-2 text-xs font-medium text-muted-foreground border-b border-[#f5f5f5]';
const cellCls = 'h-10 px-2 text-sm max-w-0 truncate';
const numCellCls = `${cellCls} text-right`;
const modalSectionTitleCls = 'text-sm font-normal uppercase tracking-[1.5px] text-[#737373]';
const modalLabelCls = 'text-sm font-medium text-[#0a0a0a]';
const modalInputCls = 'mt-1 h-9 rounded-lg border-[#e5e5e5] bg-white px-3 text-sm shadow-[0_1px_2px_0_rgba(0,0,0,0)] placeholder:text-[#a3a3a3] focus-visible:ring-1 focus-visible:ring-ring';
const modalSelectTriggerCls = 'mt-1 h-9 w-full rounded-lg border-[#e5e5e5] bg-white px-3 text-sm shadow-[0_1px_2px_0_rgba(0,0,0,0)] data-[placeholder]:text-transparent focus-visible:ring-1 focus-visible:ring-ring';
const modalGridCls = 'grid grid-cols-3 gap-4';

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

const stickyRightStyle: React.CSSProperties = {
  position: 'sticky',
  right: 0,
  backgroundColor: 'white',
  boxShadow: '-4px 0 8px -4px rgba(0,0,0,0.08)',
};

type ColumnPreset = 'standard' | 'compact';

const ALL_COLUMN_IDS: readonly string[] = [
  'no',
  'displayName',
  'ward',
  'address',
  'areaHa',
  'openingYear',
  'establishedDate',
  'planNumber',
  'plannedAreaHa',
  'urbanPlanNumber',
  'planDecisionDate',
  'acquisitionMethod',
  'category',
  'schoolDistrict',
  'paidFacility',
  'disasterFacility',
  'managementOffice',
  'notes',
  'actions',
];

const COMPACT_COLUMN_IDS = new Set<string>([
  'no',
  'displayName',
  'ward',
  'address',
  'areaHa',
  'openingYear',
  'establishedDate',
  'planNumber',
  'plannedAreaHa',
  'urbanPlanNumber',
  'actions',
]);

function buildColumnVisibility(preset: ColumnPreset): VisibilityState {
  const next: VisibilityState = {};
  for (const id of ALL_COLUMN_IDS) {
    next[id] = preset === 'standard' ? true : COMPACT_COLUMN_IDS.has(id);
  }
  return next;
}

/* ── Toolbar filter options (for 表示するフィルター tab) ── */
const TOOLBAR_FILTER_OPTIONS: FilterOption[] = [
  { id: 'search', label: '検索' },
  { id: 'ward', label: '区' },
  { id: 'category', label: '種別' },
  { id: 'schoolDistrict', label: '学区名' },
  { id: 'managementOffice', label: '管理公所' },
  { id: 'areaHa', label: '面積, ha' },
  { id: 'openingYear', label: '開園年度' },
  { id: 'establishedDate', label: '設置年月日' },
  { id: 'planNumber', label: '計画番号' },
  { id: 'plannedAreaHa', label: '計画面積, ha' },
  { id: 'planDecisionDate', label: '計画決定日' },
  { id: 'acquisitionMethod', label: '取得方法' },
  { id: 'paidFacility', label: '有料施設' },
  { id: 'disasterFacility', label: '防災施設' },
];

const DEFAULT_VISIBLE_FILTERS = ['search', 'ward', 'category', 'acquisitionMethod'];

/* ── Filter options derived from data ── */
const wards = [...new Set(CURATED_PARKS.map((p) => p.ward))].sort();
const categories = [...new Set(CURATED_PARKS.map((p) => p.category))].sort();
const acquisitionMethods = [...new Set(CURATED_PARKS.map((p) => p.acquisitionMethod))].sort();
const managementOffices = [...new Set(CURATED_PARKS.map((p) => p.managementOffice))].sort();
const schoolDistricts = [...new Set(CURATED_PARKS.map((p) => p.schoolDistrict).filter(Boolean))].sort();
const paidFacilities = [...new Set(CURATED_PARKS.map((p) => p.paidFacility))].sort();
const disasterFacilities = [...new Set(CURATED_PARKS.map((p) => p.disasterFacility))].sort();

/* ── Pre-sorted source data ── */
const sortedData: CuratedPark[] = [...CURATED_PARKS].sort((a, b) => {
  const aNum = parseFloat(a.no.replace(/[^0-9.]/g, ''));
  const bNum = parseFloat(b.no.replace(/[^0-9.]/g, ''));
  return aNum - bNum;
});

export function ParkListPage() {
  const navigate = useNavigate();
  const [globalFilter, setGlobalFilter] = useState('');
  const [wardFilter, setWardFilter] = useState<string | undefined>(undefined);
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  const [acquisitionFilter, setAcquisitionFilter] = useState<string | undefined>(undefined);
  const [columnPreset, setColumnPreset] = useState<ColumnPreset>('standard');
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => buildColumnVisibility('standard'));
  const [visibleFilters, setVisibleFilters] = useState<string[]>(DEFAULT_VISIBLE_FILTERS);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedParkId = searchParams.get('selected');

  const setSelectedParkId = useCallback((id: string | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (id) {
        next.set('selected', id);
      } else {
        next.delete('selected');
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const selectedPark = useMemo(
    () => selectedParkId ? CURATED_PARKS.find(p => p.id === selectedParkId) ?? null : null,
    [selectedParkId],
  );

  const columns = useMemo<ColumnDef<CuratedPark>[]>(() => [
    {
      accessorKey: 'no',
      header: 'No',
      size: 72,
      meta: { className: cellCls, headerClassName: headerCls },
    },
    {
      accessorKey: 'displayName',
      header: '名称',
      size: 150,
      cell: ({ row }) => {
        const id = row.original.id;
        if (!id) return row.original.displayName;
        return (
          <Link
            to={`/assets/parks/${id}`}
            className="underline text-primary hover:text-primary/80"
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.displayName}
          </Link>
        );
      },
      meta: { className: cellCls, headerClassName: headerCls },
    },
    {
      accessorKey: 'ward',
      header: '区',
      size: 80,
      meta: { className: cellCls, headerClassName: headerCls },
    },
    {
      accessorKey: 'address',
      header: '所在地',
      size: 320,
      meta: { className: cellCls, headerClassName: headerCls },
    },
    {
      accessorKey: 'areaHa',
      header: '面積, ha',
      size: 90,
      cell: ({ getValue }) => (getValue<number>()).toFixed(2),
      meta: { className: numCellCls, headerClassName: `${headerCls} text-right` },
    },
    {
      accessorKey: 'openingYear',
      header: '開園年度',
      size: 86,
      meta: { className: cellCls, headerClassName: headerCls },
    },
    {
      accessorKey: 'establishedDate',
      header: '設置年月日',
      size: 110,
      meta: { className: cellCls, headerClassName: headerCls },
    },
    {
      accessorKey: 'planNumber',
      header: '計画番号',
      size: 80,
      cell: ({ getValue }) => getValue<string>() || '-',
      meta: { className: cellCls, headerClassName: headerCls },
    },
    {
      accessorKey: 'plannedAreaHa',
      header: '計画面積, ha',
      size: 110,
      cell: ({ getValue }) => (getValue<number>()).toFixed(2),
      meta: { className: numCellCls, headerClassName: `${headerCls} text-right` },
    },
    {
      accessorKey: 'urbanPlanNumber',
      header: '都市計画番号',
      size: 110,
      cell: ({ getValue }) => getValue<string>() || '-',
      meta: { className: cellCls, headerClassName: headerCls },
    },
    {
      accessorKey: 'planDecisionDate',
      header: '計画決定日',
      size: 100,
      meta: { className: cellCls, headerClassName: headerCls },
    },
    {
      accessorKey: 'acquisitionMethod',
      header: '取得方法',
      size: 80,
      meta: { className: cellCls, headerClassName: headerCls },
    },
    {
      accessorKey: 'category',
      header: '種別',
      size: 50,
      meta: { className: cellCls, headerClassName: headerCls },
    },
    {
      accessorKey: 'schoolDistrict',
      header: '学区名',
      size: 140,
      meta: { className: cellCls, headerClassName: headerCls },
    },
    {
      accessorKey: 'paidFacility',
      header: '有料施設',
      size: 60,
      meta: { className: cellCls, headerClassName: headerCls },
    },
    {
      accessorKey: 'disasterFacility',
      header: '防災施設',
      size: 140,
      meta: { className: cellCls, headerClassName: headerCls },
    },
    {
      accessorKey: 'managementOffice',
      header: '管理公所',
      size: 130,
      meta: { className: cellCls, headerClassName: headerCls },
    },
    {
      accessorKey: 'notes',
      header: '備考',
      size: 340,
      meta: { className: cellCls, headerClassName: headerCls },
    },
    {
      id: 'actions',
      size: 61,
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-3">
          <Ellipsis className="size-4 text-muted-foreground" />
          <CircleArrowRight
            className="size-4 text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/assets/parks/${row.original.id}`);
            }}
          />
        </div>
      ),
      enableHiding: false,
      meta: { className: 'h-10 px-2 text-center', headerClassName: `${headerCls} text-center` },
    },
  ], [navigate]);

  // Advanced search state
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);
  const [schoolDistrictFilter, setSchoolDistrictFilter] = useState('');
  const [managementOfficeFilter, setManagementOfficeFilter] = useState<string | undefined>(undefined);
  const [paidFacilityFilter, setPaidFacilityFilter] = useState<string | undefined>(undefined);
  const [disasterFacilityFilter, setDisasterFacilityFilter] = useState<string | undefined>(undefined);
  const [areaHaFilter, setAreaHaFilter] = useState('');
  const [planNumberFilter, setPlanNumberFilter] = useState('');
  const [plannedAreaHaFilter, setPlannedAreaHaFilter] = useState('');

  // Draft state for the advanced search dialog
  const [draft, setDraft] = useState({
    search: '',
    ward: undefined as string | undefined,
    category: undefined as string | undefined,
    schoolDistrict: '',
    managementOffice: undefined as string | undefined,
    areaHa: '',
    planNumber: '',
    plannedAreaHa: '',
    acquisitionMethod: undefined as string | undefined,
    paidFacility: undefined as string | undefined,
    disasterFacility: undefined as string | undefined,
  });

  function openAdvancedSearch() {
    setDraft({
      search: globalFilter,
      ward: wardFilter,
      category: categoryFilter,
      schoolDistrict: schoolDistrictFilter,
      managementOffice: managementOfficeFilter,
      areaHa: areaHaFilter,
      planNumber: planNumberFilter,
      plannedAreaHa: plannedAreaHaFilter,
      acquisitionMethod: acquisitionFilter,
      paidFacility: paidFacilityFilter,
      disasterFacility: disasterFacilityFilter,
    });
    setAdvancedSearchOpen(true);
  }

  function applyAdvancedSearch() {
    setGlobalFilter(draft.search);
    setWardFilter(draft.ward);
    setCategoryFilter(draft.category);
    setSchoolDistrictFilter(draft.schoolDistrict);
    setManagementOfficeFilter(draft.managementOffice);
    setAreaHaFilter(draft.areaHa);
    setPlanNumberFilter(draft.planNumber);
    setPlannedAreaHaFilter(draft.plannedAreaHa);
    setAcquisitionFilter(draft.acquisitionMethod);
    setPaidFacilityFilter(draft.paidFacility);
    setDisasterFacilityFilter(draft.disasterFacility);
    setAdvancedSearchOpen(false);
  }

  function clearDraft() {
    setDraft({
      search: '',
      ward: undefined,
      category: undefined,
      schoolDistrict: '',
      managementOffice: undefined,
      areaHa: '',
      planNumber: '',
      plannedAreaHa: '',
      acquisitionMethod: undefined,
      paidFacility: undefined,
      disasterFacility: undefined,
    });
  }

  const hasFilters =
    !!wardFilter || !!categoryFilter || !!acquisitionFilter || globalFilter !== '' ||
    !!schoolDistrictFilter || !!managementOfficeFilter || !!paidFacilityFilter ||
    !!disasterFacilityFilter || !!areaHaFilter || !!planNumberFilter || !!plannedAreaHaFilter;

  const filteredData = useMemo(() => {
    return sortedData.filter((p) => {
      if (wardFilter && p.ward !== wardFilter) return false;
      if (categoryFilter && p.category !== categoryFilter) return false;
      if (acquisitionFilter && p.acquisitionMethod !== acquisitionFilter) return false;
      if (schoolDistrictFilter && !p.schoolDistrict.includes(schoolDistrictFilter)) return false;
      if (managementOfficeFilter && p.managementOffice !== managementOfficeFilter) return false;
      if (paidFacilityFilter && p.paidFacility !== paidFacilityFilter) return false;
      if (disasterFacilityFilter && p.disasterFacility !== disasterFacilityFilter) return false;
      if (areaHaFilter) {
        const target = parseFloat(areaHaFilter);
        if (!isNaN(target) && p.areaHa !== target) return false;
      }
      if (planNumberFilter && !p.planNumber.includes(planNumberFilter)) return false;
      if (plannedAreaHaFilter) {
        const target = parseFloat(plannedAreaHaFilter);
        if (!isNaN(target) && p.plannedAreaHa !== target) return false;
      }
      return true;
    });
  }, [wardFilter, categoryFilter, acquisitionFilter, schoolDistrictFilter, managementOfficeFilter, paidFacilityFilter, disasterFacilityFilter, areaHaFilter, planNumberFilter, plannedAreaHaFilter]);

  // Lazy row reveal: show rows in viewport-sized batches
  const TABLE_ROW_H = 41; // h-10 (40px) + 1px border
  const TABLE_HEADER_H = 41;
  const [visibleRowCount, setVisibleRowCount] = useState(16);
  const [batchSize, setBatchSize] = useState(16);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const rows = Math.max(1, Math.floor((entry.contentRect.height - TABLE_HEADER_H) / TABLE_ROW_H));
      setBatchSize(rows);
      // Only grow visibleRowCount to fill a larger viewport; never shrink it
      setVisibleRowCount((prev) => Math.max(prev, rows));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { globalFilter, columnVisibility },
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const s = filterValue.toLowerCase();
      const v = row.original;
      return (
        v.displayName.toLowerCase().includes(s) ||
        v.no.toLowerCase().includes(s) ||
        v.ward.toLowerCase().includes(s) ||
        v.address.toLowerCase().includes(s)
      );
    },
  });

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

  // Reset visible rows and scroll position on filter changes
  useEffect(() => {
    setVisibleRowCount(batchSize);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [filteredData, batchSize]);

  // deltaMode normalization: consistent wheel behavior across browsers
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function onWheel(e: WheelEvent) {
      if (e.deltaY === 0) return;

      const EPSILON = 1;
      if (el!.scrollHeight <= el!.clientHeight + EPSILON) return;

      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 20;
      else if (e.deltaMode === 2) dy *= el!.clientHeight;

      const atBottom = el!.scrollTop + el!.clientHeight >= el!.scrollHeight - EPSILON;
      const atTop = el!.scrollTop <= EPSILON;

      if (dy > 0 && atBottom) return;
      if (dy < 0 && atTop) return;

      el!.scrollTop += dy;
      e.preventDefault();
    }

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const totalWidth = table.getVisibleLeafColumns().reduce((sum, c) => sum + (c.getSize() ?? 100), 0);

  // Auto-show scrollbar while scrolling, hide after idle
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTimer = useRef<ReturnType<typeof setTimeout>>();
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.classList.add('is-scrolling');
    clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => el.classList.remove('is-scrolling'), 800);
  }, []);

  function clearAllFilters() {
    setGlobalFilter('');
    setWardFilter(undefined);
    setCategoryFilter(undefined);
    setAcquisitionFilter(undefined);
    setSchoolDistrictFilter('');
    setManagementOfficeFilter(undefined);
    setPaidFacilityFilter(undefined);
    setDisasterFacilityFilter(undefined);
    setAreaHaFilter('');
    setPlanNumberFilter('');
    setPlannedAreaHaFilter('');
  }

  // Close preview panel when selected park is filtered out
  useEffect(() => {
    if (selectedParkId && !filteredData.some(p => p.id === selectedParkId)) {
      setSelectedParkId(null);
    }
  }, [filteredData, selectedParkId]);

  function applyColumnPreset(preset: ColumnPreset) {
    setColumnPreset(preset);
    setColumnVisibility(buildColumnVisibility(preset));
  }

  return (
    <div className="flex min-h-0 flex-col overflow-hidden" style={{ margin: 16, padding: '12px 24px 16px', height: 'calc(100% - 32px)' }} onClick={() => setSelectedParkId(null)}>
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <h1 className="text-3xl font-semibold leading-none tracking-tight">公園</h1>
        <Button size="icon-sm" className="size-9 rounded-full border-0 bg-[#215042] hover:bg-[#2a6554]">
          <Plus className="size-4" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3" style={{ marginBottom: 16 }}>
        {visibleFilters.includes('search') && (
          <div
            className="flex h-9 w-[316px] items-center gap-3 rounded-lg border border-[#e5e5e5] bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.00)]"
            style={{ padding: '0 16px' }}
          >
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <Input
              placeholder="No, 名称, 所在地"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="h-auto min-h-0 flex-1 border-0 p-0 shadow-none focus-visible:ring-0 focus-visible:border-0"
            />
          </div>
        )}

        {visibleFilters.includes('ward') && (
          <Select value={wardFilter ?? '__all__'} onValueChange={(v) => setWardFilter(v === '__all__' ? undefined : v)}>
            <SelectTrigger className="h-9 w-[200px] rounded-lg border-[#e5e5e5] bg-white text-muted-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.00)]" style={{ paddingLeft: 16 }}>
              <SelectValue placeholder="区" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">すべて</SelectItem>
              {wards.map((w) => (
                <SelectItem key={w} value={w}>{w}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {visibleFilters.includes('category') && (
          <Select value={categoryFilter ?? '__all__'} onValueChange={(v) => setCategoryFilter(v === '__all__' ? undefined : v)}>
            <SelectTrigger className="h-9 w-[200px] rounded-lg border-[#e5e5e5] bg-white text-muted-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.00)]" style={{ paddingLeft: 16 }}>
              <SelectValue placeholder="種別" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">すべて</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {visibleFilters.includes('schoolDistrict') && (
          <Select value={schoolDistrictFilter || '__all__'} onValueChange={(v) => setSchoolDistrictFilter(v === '__all__' ? '' : v)}>
            <SelectTrigger className="h-9 w-[200px] rounded-lg border-[#e5e5e5] bg-white text-muted-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.00)]" style={{ paddingLeft: 16 }}>
              <SelectValue placeholder="学区名" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">すべて</SelectItem>
              {schoolDistricts.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {visibleFilters.includes('managementOffice') && (
          <Select value={managementOfficeFilter ?? '__all__'} onValueChange={(v) => setManagementOfficeFilter(v === '__all__' ? undefined : v)}>
            <SelectTrigger className="h-9 w-[200px] rounded-lg border-[#e5e5e5] bg-white text-muted-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.00)]" style={{ paddingLeft: 16 }}>
              <SelectValue placeholder="管理公所" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">すべて</SelectItem>
              {managementOffices.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {visibleFilters.includes('acquisitionMethod') && (
          <Select value={acquisitionFilter ?? '__all__'} onValueChange={(v) => setAcquisitionFilter(v === '__all__' ? undefined : v)}>
            <SelectTrigger className="h-9 w-[200px] rounded-lg border-[#e5e5e5] bg-white text-muted-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.00)]" style={{ paddingLeft: 16 }}>
              <SelectValue placeholder="取得方法" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">すべて</SelectItem>
              {acquisitionMethods.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {visibleFilters.includes('paidFacility') && (
          <Select value={paidFacilityFilter ?? '__all__'} onValueChange={(v) => setPaidFacilityFilter(v === '__all__' ? undefined : v)}>
            <SelectTrigger className="h-9 w-[200px] rounded-lg border-[#e5e5e5] bg-white text-muted-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.00)]" style={{ paddingLeft: 16 }}>
              <SelectValue placeholder="有料施設" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">すべて</SelectItem>
              {paidFacilities.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {visibleFilters.includes('disasterFacility') && (
          <Select value={disasterFacilityFilter ?? '__all__'} onValueChange={(v) => setDisasterFacilityFilter(v === '__all__' ? undefined : v)}>
            <SelectTrigger className="h-9 w-[200px] rounded-lg border-[#e5e5e5] bg-white text-muted-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.00)]" style={{ paddingLeft: 16 }}>
              <SelectValue placeholder="防災施設" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">すべて</SelectItem>
              {disasterFacilities.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="icon-sm"
            className="size-9 border border-[#e5e5e5] bg-[#f5f5f5] text-[#595959] hover:bg-[#ececec]"
            onClick={openAdvancedSearch}
          >
            <AdvancedSearchIcon className="size-4" />
            <span className="sr-only">詳細検索</span>
          </Button>
          <DataTableViewOptions
            table={table}
            filterOptions={TOOLBAR_FILTER_OPTIONS}
            visibleFilters={visibleFilters}
            onVisibleFiltersChange={setVisibleFilters}
          />
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
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>表示プリセット</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={columnPreset}
                onValueChange={(value) => applyColumnPreset(value as ColumnPreset)}
              >
                <DropdownMenuRadioItem value="standard">標準</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="compact">コンパクト</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            disabled={!hasFilters}
            className="text-sm text-muted-foreground hover:text-foreground hover:bg-transparent disabled:opacity-40 ml-1 border-0 bg-transparent shadow-none"
          >
            すべてクリア
          </Button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-lg" style={{ boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.10), 0 1px 2px -1px rgba(0, 0, 0, 0.10)' }}>
        {/* Table side */}
        <div className={`flex min-h-0 min-w-0 flex-1 flex-col${selectedPark ? ' mr-[494px]' : ''}`}>
          <div ref={scrollRef} onScroll={handleScroll} data-testid="park-table-scroll" className="scrollbar-auto-hide min-h-0 flex-1 overflow-x-auto overflow-y-auto [&_[data-slot=table-container]]:overflow-visible">
            <Table style={{ minWidth: totalWidth }}>
              <TableHeader className="sticky top-0 z-10 bg-white">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="hover:bg-transparent">
                    {headerGroup.headers.map((header) => {
                      const meta = header.column.columnDef.meta as { headerClassName?: string } | undefined;
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
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody data-testid="park-table-body">
                {visibleRows.length ? (
                  visibleRows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-testid="park-table-row"
                      className={`cursor-pointer${row.original.id === selectedParkId ? ' bg-[#f0faf6]' : ''}`}
                      onClick={(e) => { e.stopPropagation(); setSelectedParkId(row.original.id); }}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const meta = cell.column.columnDef.meta as { className?: string } | undefined;
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
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
                      該当する公園がありません
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {hasMoreRows && <div ref={sentinelRef} className="h-1" />}
          </div>

        </div>

        {/* Preview panel */}
        {selectedPark && (
          <div className="absolute right-0 top-0 bottom-0 z-10 w-[494px] bg-white flex flex-col overflow-hidden shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-4px_rgba(0,0,0,0.1)]" data-testid="park-preview-panel" onClick={(e) => e.stopPropagation()}>
            <ParkPreviewPanel
              park={selectedPark}
              onClose={() => setSelectedParkId(null)}
              onNavigateToDetail={() => navigate(`/assets/parks/${selectedPark.id}`)}
            />
          </div>
        )}
      </div>

      <Dialog open={advancedSearchOpen} onOpenChange={setAdvancedSearchOpen}>
        <DialogContent
          className="flex flex-col w-[700px] max-w-[calc(100vw-32px)] sm:max-w-[700px] max-h-[calc(100vh-2rem)] gap-0 overflow-hidden rounded-xl border border-[#e5e5e5] bg-white p-0 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-4px_rgba(0,0,0,0.1)] [&_[data-slot=dialog-close]]:top-4 [&_[data-slot=dialog-close]]:right-4 [&_[data-slot=dialog-close]]:border-0 [&_[data-slot=dialog-close]]:bg-transparent [&_[data-slot=dialog-close]_svg]:size-6"
          showCloseButton
        >
          <DialogHeader className="p-4 items-start self-stretch">
            <DialogTitle className="text-xl font-bold leading-6 tracking-normal text-[#0a0a0a]">詳細検索</DialogTitle>
            <DialogDescription className="sr-only">公園の詳細検索フィルター</DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            <div className="space-y-6">
              {/* 基本属性・管理 */}
              <div className="space-y-3">
                <p className={modalSectionTitleCls}>基本属性・管理</p>
                <div className="space-y-2">
                  <div>
                    <label className={modalLabelCls}>検索</label>
                    <div className="mt-1 flex h-9 items-center gap-2 rounded-lg border border-[#e5e5e5] bg-white px-3 shadow-[0_1px_2px_0_rgba(0,0,0,0)]">
                      <Search className="size-4 shrink-0 text-[#a3a3a3]" />
                      <Input
                        placeholder="No, 名称, 所在地"
                        value={draft.search}
                        onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
                        className="h-auto min-h-0 flex-1 border-0 p-0 text-sm shadow-none placeholder:text-[#a3a3a3] focus-visible:ring-0"
                      />
                    </div>
                  </div>
                  <div className={modalGridCls}>
                    <div>
                      <label className={modalLabelCls}>区</label>
                      <Select value={draft.ward ?? '__all__'} onValueChange={(v) => setDraft((d) => ({ ...d, ward: v === '__all__' ? undefined : v }))}>
                        <SelectTrigger className={modalSelectTriggerCls}>
                          <SelectValue placeholder="" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">すべて</SelectItem>
                          {wards.map((w) => (
                            <SelectItem key={w} value={w}>{w}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className={modalLabelCls}>種別</label>
                      <Select value={draft.category ?? '__all__'} onValueChange={(v) => setDraft((d) => ({ ...d, category: v === '__all__' ? undefined : v }))}>
                        <SelectTrigger className={modalSelectTriggerCls}>
                          <SelectValue placeholder="" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">すべて</SelectItem>
                          {categories.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className={modalLabelCls}>学区名</label>
                      <Input
                        value={draft.schoolDistrict}
                        onChange={(e) => setDraft((d) => ({ ...d, schoolDistrict: e.target.value }))}
                        className={modalInputCls}
                      />
                    </div>
                  </div>
                  <div className={modalGridCls}>
                    <div>
                      <label className={modalLabelCls}>管理公所</label>
                      <Select value={draft.managementOffice ?? '__all__'} onValueChange={(v) => setDraft((d) => ({ ...d, managementOffice: v === '__all__' ? undefined : v }))}>
                        <SelectTrigger className={modalSelectTriggerCls}>
                          <SelectValue placeholder="" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">すべて</SelectItem>
                          {managementOffices.map((m) => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* 規模・供用履歴 */}
              <div className="space-y-3">
                <p className={modalSectionTitleCls}>規模・供用履歴</p>
                <div className={modalGridCls}>
                  <div>
                    <label className={modalLabelCls}>面積, ha</label>
                    <Input
                      value={draft.areaHa}
                      onChange={(e) => setDraft((d) => ({ ...d, areaHa: e.target.value }))}
                      className={modalInputCls}
                    />
                  </div>
                  <div>
                    <label className={modalLabelCls}>開園年度</label>
                    <div className="relative mt-1">
                      <Input
                        className={`${modalInputCls} pr-9`}
                      />
                      <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#737373]" />
                    </div>
                  </div>
                  <div>
                    <label className={modalLabelCls}>設置年月日</label>
                    <div className="relative mt-1">
                      <Input
                        className={`${modalInputCls} pr-9`}
                      />
                      <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#737373]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* 都市計画・権利 */}
              <div className="space-y-3">
                <p className={modalSectionTitleCls}>都市計画・権利</p>
                <div className="space-y-2">
                  <div className={modalGridCls}>
                    <div>
                      <label className={modalLabelCls}>計画番号</label>
                      <Input
                        value={draft.planNumber}
                        onChange={(e) => setDraft((d) => ({ ...d, planNumber: e.target.value }))}
                        className={modalInputCls}
                      />
                    </div>
                    <div>
                      <label className={modalLabelCls}>計画面積, ha</label>
                      <Input
                        value={draft.plannedAreaHa}
                        onChange={(e) => setDraft((d) => ({ ...d, plannedAreaHa: e.target.value }))}
                        className={modalInputCls}
                      />
                    </div>
                    <div>
                      <label className={modalLabelCls}>計画決定日</label>
                      <div className="relative mt-1">
                        <Input
                          className={`${modalInputCls} pr-9`}
                        />
                        <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#737373]" />
                      </div>
                    </div>
                  </div>
                  <div className={modalGridCls}>
                    <div>
                      <label className={modalLabelCls}>取得方法</label>
                      <Select value={draft.acquisitionMethod ?? '__all__'} onValueChange={(v) => setDraft((d) => ({ ...d, acquisitionMethod: v === '__all__' ? undefined : v }))}>
                        <SelectTrigger className={modalSelectTriggerCls}>
                          <SelectValue placeholder="" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">すべて</SelectItem>
                          {acquisitionMethods.map((m) => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* 施設・機能 */}
              <div className="space-y-3">
                <p className={modalSectionTitleCls}>施設・機能</p>
                <div className={modalGridCls}>
                  <div>
                    <label className={modalLabelCls}>有料施設</label>
                    <Select value={draft.paidFacility ?? '__all__'} onValueChange={(v) => setDraft((d) => ({ ...d, paidFacility: v === '__all__' ? undefined : v }))}>
                      <SelectTrigger className={modalSelectTriggerCls}>
                        <SelectValue placeholder="" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">すべて</SelectItem>
                        {paidFacilities.map((f) => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className={modalLabelCls}>防災施設</label>
                    <Select value={draft.disasterFacility ?? '__all__'} onValueChange={(v) => setDraft((d) => ({ ...d, disasterFacility: v === '__all__' ? undefined : v }))}>
                      <SelectTrigger className={modalSelectTriggerCls}>
                        <SelectValue placeholder="" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">すべて</SelectItem>
                        {disasterFacilities.map((f) => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
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

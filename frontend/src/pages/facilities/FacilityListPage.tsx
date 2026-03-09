import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  type ColumnDef,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Search, Ellipsis, CircleArrowRight, Plus, FileInput, Printer } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useScrollRestore } from '../../hooks/useScrollRestore';
import type { DateRange } from 'react-day-picker';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DataTableViewOptions, type FilterOption } from '@/components/ui/data-table-view-options';
import { DateRangePickerInput } from '@/components/ui/date-range-picker-input';

import {
  getAllDummyFacilities,
  FACILITY_CLASSIFICATION_LABELS,
  FACILITY_CATEGORY_LABELS,
  FACILITY_STATUS_CONFIG,
  type DummyFacility,
} from '../../data/dummyFacilities';
import { CURATED_PARKS, type CuratedPark } from '../../data/curatedParks';
import { FacilityPlaceholderImage } from '@/components/facility/FacilityPlaceholderImage';
import { StatusBadge } from '@/components/facility/StatusBadge';
import { RankBadge } from '@/components/facility/RankBadge';
import { UrgencyBadge } from '@/components/facility/UrgencyBadge';
import { ParkInfoPopover } from '@/components/facility/ParkInfoPopover';
import { toUTCMidnight } from '@/utils/japaneseEraDate';
import { FacilityPreviewPanel } from './FacilityPreviewPanel';

/* ── Style tokens ── */
const headerCls = 'h-10 px-2 text-xs font-medium text-muted-foreground border-b border-[#f5f5f5]';
const cellCls = 'px-2 text-sm max-w-0 truncate';
const dimCellCls = `${cellCls} text-[#a3a3a3]`;

/* ── Modal style tokens ── */
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

/* ── Park lookup ── */
const PARK_LOOKUP = new Map<string, CuratedPark>(CURATED_PARKS.map((p) => [p.id, p]));

/* ── Column presets ── */
type ColumnPreset = 'standard' | 'compact';

const ALL_COLUMN_IDS: readonly string[] = [
  'thumbnail', 'name', 'status', 'facilityId', 'classification',
  'parkName', 'subItem', 'subItemDetail', 'quantity', 'installDate',
  'elapsedYears', 'manufacturer', 'installer', 'mainMaterial',
  'designDoc', 'inspectionDate', 'structureRank', 'wearRank',
  'repairDate', 'managementType', 'urgency', 'countermeasure',
  'plannedYear', 'estimatedCost', 'notes', 'actions',
];

const COMPACT_COLUMN_IDS = new Set<string>([
  'thumbnail', 'name', 'status', 'facilityId', 'classification',
  'parkName', 'quantity', 'installDate', 'actions',
]);

function buildColumnVisibility(preset: ColumnPreset): VisibilityState {
  const next: VisibilityState = {};
  for (const id of ALL_COLUMN_IDS) {
    next[id] = preset === 'standard' ? true : COMPACT_COLUMN_IDS.has(id);
  }
  return next;
}

/* ── Toolbar filter options ── */
const TOOLBAR_FILTER_OPTIONS: FilterOption[] = [
  { id: 'search', label: '検索' },
  { id: 'classification', label: '施設分類' },
  { id: 'status', label: '状態' },
  { id: 'ward', label: '区' },
  { id: 'parkName', label: '公園名称' },
  { id: 'category', label: 'カテゴリ' },
  { id: 'structureRank', label: '構造ランク' },
  { id: 'wearRank', label: '消耗ランク' },
  { id: 'urgencyLevel', label: '緊急度' },
  { id: 'managementType', label: '管理種別' },
  { id: 'dateInstalled', label: '設置年月日' },
  { id: 'lastInspectionDate', label: '最近点検日' },
  { id: 'mainMaterial', label: '主要部材' },
  { id: 'manufacturer', label: 'メーカー' },
  { id: 'installer', label: '設置業者' },
  { id: 'quantity', label: '数量' },
];
const DEFAULT_VISIBLE_FILTERS = ['search', 'classification', 'status', 'ward'];

/* ── Pre-sorted source data ── */
const sortedData: DummyFacility[] = [...getAllDummyFacilities()].sort((a, b) =>
  a.name.localeCompare(b.name, 'ja'),
);

/* ── Dropdown options derived from data ── */
const classificationOptions = Object.entries(FACILITY_CLASSIFICATION_LABELS);
const statusOptions = Object.entries(FACILITY_STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.label }));
const wardOptions = [...new Set(sortedData.map((f) => f.ward))].sort();
const parkRefOptions = [...new Set(sortedData.map((f) => f.greenSpaceRef))]
  .map((ref) => ({ value: ref, label: PARK_LOOKUP.get(ref)?.displayName || ref }))
  .sort((a, b) => a.label.localeCompare(b.label, 'ja'));
const categoryOptions = [...new Set(sortedData.map((f) => f.category).filter(Boolean))]
  .map((c) => ({ value: c, label: FACILITY_CATEGORY_LABELS[c] || c }))
  .sort((a, b) => a.label.localeCompare(b.label, 'ja'));
const rankOptions = ['A', 'B', 'C', 'D'];
const urgencyLevelOptions = [
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
];
const managementTypeOptions = [...new Set(sortedData.map((f) => f.managementType).filter(Boolean) as string[])].sort();
const mainMaterialOptions = [...new Set(sortedData.map((f) => f.mainMaterial).filter(Boolean) as string[])].sort();
const manufacturerOptions = [...new Set(sortedData.map((f) => f.manufacturer).filter(Boolean) as string[])].sort();
const installerOptions = [...new Set(sortedData.map((f) => f.installer).filter(Boolean) as string[])].sort();

/* ── FilterState type + helpers ── */
interface FacilityFilterState {
  search: string;
  classification: string | undefined;
  status: string | undefined;
  ward: string | undefined;
  parkRef: string | undefined;
  category: string | undefined;
  structureRank: string | undefined;
  wearRank: string | undefined;
  urgencyLevel: string | undefined;
  managementType: string | undefined;
  dateInstalled: DateRange | undefined;
  lastInspectionDate: DateRange | undefined;
  mainMaterial: string | undefined;
  manufacturer: string | undefined;
  installer: string | undefined;
  quantityMin: string;
  quantityMax: string;
}

const EMPTY_FILTERS: FacilityFilterState = {
  search: '',
  classification: undefined,
  status: undefined,
  ward: undefined,
  parkRef: undefined,
  category: undefined,
  structureRank: undefined,
  wearRank: undefined,
  urgencyLevel: undefined,
  managementType: undefined,
  dateInstalled: undefined,
  lastInspectionDate: undefined,
  mainMaterial: undefined,
  manufacturer: undefined,
  installer: undefined,
  quantityMin: '',
  quantityMax: '',
};

function countActiveFilters(f: FacilityFilterState): number {
  return [
    f.search, f.classification, f.status, f.ward, f.parkRef,
    f.category, f.structureRank, f.wearRank, f.urgencyLevel,
    f.managementType, f.mainMaterial, f.manufacturer, f.installer,
    f.quantityMin || f.quantityMax ? 'set' : '',
    f.dateInstalled?.from || f.dateInstalled?.to ? 'set' : '',
    f.lastInspectionDate?.from || f.lastInspectionDate?.to ? 'set' : '',
  ].filter(Boolean).length;
}

/* ── CSV export helpers ── */
function escapeCsvCell(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
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

/* ── Select trigger class (shared across all toolbar Select filters) ── */
const toolbarSelectCls = 'h-9 w-full sm:w-[200px] rounded-lg border-[#e5e5e5] bg-white text-muted-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.00)]';

export function FacilityListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  /* ── Selected facility for preview panel ── */
  const selectedFacilityId = searchParams.get('selected');
  const setSelectedFacilityId = useCallback(
    (id: string | null) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (id != null) next.set('selected', id);
        else next.delete('selected');
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  /* ── Filter state ── */
  const [globalFilter, setGlobalFilter] = useState('');
  const [classificationFilter, setClassificationFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [wardFilter, setWardFilter] = useState<string | undefined>(undefined);
  const [parkRefFilter, setParkRefFilter] = useState<string | undefined>(undefined);
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  const [structureRankFilter, setStructureRankFilter] = useState<string | undefined>(undefined);
  const [wearRankFilter, setWearRankFilter] = useState<string | undefined>(undefined);
  const [urgencyLevelFilter, setUrgencyLevelFilter] = useState<string | undefined>(undefined);
  const [managementTypeFilter, setManagementTypeFilter] = useState<string | undefined>(undefined);
  const [dateInstalledRange, setDateInstalledRange] = useState<DateRange | undefined>();
  const [lastInspectionDateRange, setLastInspectionDateRange] = useState<DateRange | undefined>();
  const [mainMaterialFilter, setMainMaterialFilter] = useState<string | undefined>(undefined);
  const [manufacturerFilter, setManufacturerFilter] = useState<string | undefined>(undefined);
  const [installerFilter, setInstallerFilter] = useState<string | undefined>(undefined);
  const [quantityMin, setQuantityMin] = useState('');
  const [quantityMax, setQuantityMax] = useState('');

  /* ── Table state ── */
  const [columnPreset, setColumnPreset] = useState<ColumnPreset>('standard');
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => buildColumnVisibility('standard'));
  const [visibleFilters, setVisibleFilters] = useState<string[]>(DEFAULT_VISIBLE_FILTERS);

  /* ── Advanced search dialog ── */
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);
  const [draft, setDraft] = useState<FacilityFilterState>(EMPTY_FILTERS);

  const selectedFacility = useMemo(
    () => selectedFacilityId ? sortedData.find((f) => f.id === selectedFacilityId) ?? null : null,
    [selectedFacilityId],
  );

  function snapshotFilters(): FacilityFilterState {
    return {
      search: globalFilter,
      classification: classificationFilter,
      status: statusFilter,
      ward: wardFilter,
      parkRef: parkRefFilter,
      category: categoryFilter,
      structureRank: structureRankFilter,
      wearRank: wearRankFilter,
      urgencyLevel: urgencyLevelFilter,
      managementType: managementTypeFilter,
      dateInstalled: dateInstalledRange,
      lastInspectionDate: lastInspectionDateRange,
      mainMaterial: mainMaterialFilter,
      manufacturer: manufacturerFilter,
      installer: installerFilter,
      quantityMin,
      quantityMax,
    };
  }

  function openAdvancedSearch() {
    setDraft(snapshotFilters());
    setAdvancedSearchOpen(true);
  }

  function applyAdvancedSearch() {
    setGlobalFilter(draft.search);
    setClassificationFilter(draft.classification);
    setStatusFilter(draft.status);
    setWardFilter(draft.ward);
    setParkRefFilter(draft.parkRef);
    setCategoryFilter(draft.category);
    setStructureRankFilter(draft.structureRank);
    setWearRankFilter(draft.wearRank);
    setUrgencyLevelFilter(draft.urgencyLevel);
    setManagementTypeFilter(draft.managementType);
    setDateInstalledRange(draft.dateInstalled);
    setLastInspectionDateRange(draft.lastInspectionDate);
    setMainMaterialFilter(draft.mainMaterial);
    setManufacturerFilter(draft.manufacturer);
    setInstallerFilter(draft.installer);
    setQuantityMin(draft.quantityMin);
    setQuantityMax(draft.quantityMax);
    setAdvancedSearchOpen(false);
  }

  function clearDraft() {
    setDraft(EMPTY_FILTERS);
  }

  /* ── Derived filter state ── */
  const activeFilterCount = useMemo(() => countActiveFilters({
    search: globalFilter,
    classification: classificationFilter,
    status: statusFilter,
    ward: wardFilter,
    parkRef: parkRefFilter,
    category: categoryFilter,
    structureRank: structureRankFilter,
    wearRank: wearRankFilter,
    urgencyLevel: urgencyLevelFilter,
    managementType: managementTypeFilter,
    dateInstalled: dateInstalledRange,
    lastInspectionDate: lastInspectionDateRange,
    mainMaterial: mainMaterialFilter,
    manufacturer: manufacturerFilter,
    installer: installerFilter,
    quantityMin,
    quantityMax,
  }), [
    globalFilter, classificationFilter, statusFilter, wardFilter, parkRefFilter,
    categoryFilter, structureRankFilter, wearRankFilter, urgencyLevelFilter,
    managementTypeFilter, dateInstalledRange, lastInspectionDateRange,
    mainMaterialFilter, manufacturerFilter, installerFilter, quantityMin, quantityMax,
  ]);
  const hasColumnVisibilityChanges = Object.keys(columnVisibility).length > 0 &&
    Object.keys(columnVisibility).some((k) => columnVisibility[k] !== buildColumnVisibility('standard')[k]);
  const hasVisibleFilterChanges =
    visibleFilters.length !== DEFAULT_VISIBLE_FILTERS.length ||
    visibleFilters.some((f) => !DEFAULT_VISIBLE_FILTERS.includes(f));
  const hasFilters = activeFilterCount > 0 || hasColumnVisibilityChanges || hasVisibleFilterChanges;

  function clearAllFilters() {
    setGlobalFilter('');
    setClassificationFilter(undefined);
    setStatusFilter(undefined);
    setWardFilter(undefined);
    setParkRefFilter(undefined);
    setCategoryFilter(undefined);
    setStructureRankFilter(undefined);
    setWearRankFilter(undefined);
    setUrgencyLevelFilter(undefined);
    setManagementTypeFilter(undefined);
    setDateInstalledRange(undefined);
    setLastInspectionDateRange(undefined);
    setMainMaterialFilter(undefined);
    setManufacturerFilter(undefined);
    setInstallerFilter(undefined);
    setQuantityMin('');
    setQuantityMax('');
    setColumnVisibility(buildColumnVisibility('standard'));
    setColumnPreset('standard');
    setVisibleFilters(DEFAULT_VISIBLE_FILTERS);
  }

  /* ── Filtered data ── */
  const filteredData = useMemo(() => {
    return sortedData.filter((f) => {
      if (classificationFilter && f.facilityClassification !== classificationFilter) return false;
      if (statusFilter && f.status !== statusFilter) return false;
      if (wardFilter && f.ward !== wardFilter) return false;
      if (parkRefFilter && f.greenSpaceRef !== parkRefFilter) return false;
      if (categoryFilter && f.category !== categoryFilter) return false;
      if (structureRankFilter && f.structureRank !== structureRankFilter) return false;
      if (wearRankFilter && f.wearRank !== wearRankFilter) return false;
      if (urgencyLevelFilter && f.urgencyLevel !== urgencyLevelFilter) return false;
      if (managementTypeFilter && f.managementType !== managementTypeFilter) return false;
      if (mainMaterialFilter && f.mainMaterial !== mainMaterialFilter) return false;
      if (manufacturerFilter && f.manufacturer !== manufacturerFilter) return false;
      if (installerFilter && f.installer !== installerFilter) return false;
      if (quantityMin) {
        const min = parseInt(quantityMin);
        if (!isNaN(min) && (f.quantity == null || f.quantity < min)) return false;
      }
      if (quantityMax) {
        const max = parseInt(quantityMax);
        if (!isNaN(max) && (f.quantity == null || f.quantity > max)) return false;
      }
      if (dateInstalledRange?.from || dateInstalledRange?.to) {
        const d = f.dateInstalled ? new Date(f.dateInstalled) : null;
        if (!d) return false;
        if (dateInstalledRange.from && d < toUTCMidnight(dateInstalledRange.from)) return false;
        if (dateInstalledRange.to && d > toUTCMidnight(dateInstalledRange.to)) return false;
      }
      if (lastInspectionDateRange?.from || lastInspectionDateRange?.to) {
        const d = f.lastInspectionDate ? new Date(f.lastInspectionDate) : null;
        if (!d) return false;
        if (lastInspectionDateRange.from && d < toUTCMidnight(lastInspectionDateRange.from)) return false;
        if (lastInspectionDateRange.to && d > toUTCMidnight(lastInspectionDateRange.to)) return false;
      }
      return true;
    });
  }, [
    classificationFilter, statusFilter, wardFilter, parkRefFilter,
    categoryFilter, structureRankFilter, wearRankFilter, urgencyLevelFilter,
    managementTypeFilter, mainMaterialFilter, manufacturerFilter, installerFilter,
    quantityMin, quantityMax, dateInstalledRange, lastInspectionDateRange,
  ]);

  /* ── Columns ── */
  const columns = useMemo<ColumnDef<DummyFacility>[]>(() => [
    {
      id: 'thumbnail',
      size: 82,
      header: '',
      cell: ({ row }) => <FacilityPlaceholderImage category={row.original.category} size={64} />,
      enableHiding: false,
      meta: { className: 'p-2', headerClassName: headerCls },
    },
    {
      accessorKey: 'name',
      header: '名称',
      size: 120,
      cell: ({ row }) => <span className="text-sm font-medium text-[#0a0a0a]">{row.original.name}</span>,
      meta: { className: cellCls, headerClassName: headerCls },
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: '状態',
      size: 88,
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
      meta: { className: 'px-2 text-center', headerClassName: `${headerCls} text-center` },
    },
    {
      accessorKey: 'facilityId',
      header: '施設ID',
      size: 80,
      meta: { className: cellCls, headerClassName: headerCls },
    },
    {
      id: 'classification',
      header: '施設分類',
      size: 80,
      accessorFn: (row) => row.facilityClassification,
      cell: ({ row }) => FACILITY_CLASSIFICATION_LABELS[row.original.facilityClassification || ''] || '-',
      meta: { className: cellCls, headerClassName: headerCls },
    },
    {
      id: 'parkName',
      header: '公園名称',
      size: 120,
      accessorFn: (row) => PARK_LOOKUP.get(row.greenSpaceRef)?.displayName || '-',
      cell: ({ row }) => {
        const park = PARK_LOOKUP.get(row.original.greenSpaceRef);
        if (!park) return '-';
        return (
          <ParkInfoPopover park={park}>
            <button
              type="button"
              className="text-sm text-primary underline decoration-primary/40 hover:decoration-primary bg-transparent border-0 cursor-pointer p-0 text-left truncate max-w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {park.displayName}
            </button>
          </ParkInfoPopover>
        );
      },
      meta: { className: cellCls, headerClassName: headerCls },
    },
    {
      accessorKey: 'subItem',
      header: '細目',
      size: 80,
      cell: ({ getValue }) => getValue<string>() || '-',
      meta: { className: cellCls, headerClassName: headerCls },
    },
    {
      id: 'subItemDetail',
      accessorKey: 'subItemDetail',
      header: '細目補足',
      size: 80,
      cell: ({ getValue }) => getValue<string>() || '-',
      meta: { className: dimCellCls, headerClassName: headerCls },
    },
    {
      accessorKey: 'quantity',
      header: '数量',
      size: 60,
      cell: ({ getValue }) => {
        const v = getValue<number>();
        return v ? `${v}基` : '-';
      },
      meta: { className: `${cellCls} text-center`, headerClassName: `${headerCls} text-center` },
    },
    {
      id: 'installDate',
      header: '設置年',
      size: 100,
      accessorFn: (row) => row.dateInstalled,
      cell: ({ getValue }) => {
        const d = getValue<string>();
        return d ? d.replace(/-/g, '/') : '-';
      },
      meta: { className: cellCls, headerClassName: headerCls },
    },
    {
      id: 'elapsedYears',
      header: '経過年数',
      size: 72,
      accessorFn: (row) => row.designLife,
      cell: ({ getValue }) => getValue<number>() ?? '-',
      meta: { className: `${cellCls} text-center`, headerClassName: `${headerCls} text-center` },
    },
    {
      accessorKey: 'manufacturer',
      header: 'メーカー',
      size: 80,
      cell: ({ getValue }) => getValue<string>() || '-',
      meta: { className: dimCellCls, headerClassName: headerCls },
    },
    {
      accessorKey: 'installer',
      header: '設置業者',
      size: 80,
      cell: ({ getValue }) => getValue<string>() || '-',
      meta: { className: dimCellCls, headerClassName: headerCls },
    },
    {
      accessorKey: 'mainMaterial',
      header: '主要部材',
      size: 120,
      cell: ({ getValue }) => getValue<string>() || '-',
      meta: { className: cellCls, headerClassName: headerCls },
    },
    {
      id: 'designDoc',
      accessorKey: 'designDocNumber',
      header: '設計書番号',
      size: 80,
      cell: ({ getValue }) => getValue<string>() || '-',
      meta: { className: dimCellCls, headerClassName: headerCls },
    },
    {
      id: 'inspectionDate',
      header: '最近点検日',
      size: 92,
      accessorFn: (row) => row.lastInspectionDate,
      cell: ({ getValue }) => {
        const d = getValue<string>();
        return d ? d.replace(/-/g, '/') : '-';
      },
      meta: { className: cellCls, headerClassName: headerCls },
    },
    {
      id: 'structureRank',
      header: '構造ランク',
      size: 72,
      accessorFn: (row) => row.structureRank,
      cell: ({ row }) => <RankBadge rank={row.original.structureRank} />,
      meta: { className: 'px-2 text-center', headerClassName: `${headerCls} text-center` },
    },
    {
      id: 'wearRank',
      header: '消耗ランク',
      size: 72,
      accessorFn: (row) => row.wearRank,
      cell: ({ row }) => <RankBadge rank={row.original.wearRank} />,
      meta: { className: 'px-2 text-center', headerClassName: `${headerCls} text-center` },
    },
    {
      id: 'repairDate',
      header: '直近修理日',
      size: 92,
      accessorFn: (row) => row.lastRepairDate,
      cell: ({ getValue }) => getValue<string>() || '-',
      meta: { className: cellCls, headerClassName: headerCls },
    },
    {
      id: 'managementType',
      accessorKey: 'managementType',
      header: '管理種別',
      size: 72,
      cell: ({ getValue }) => getValue<string>() || '-',
      meta: { className: cellCls, headerClassName: headerCls },
    },
    {
      id: 'urgency',
      header: '緊急度判定',
      size: 72,
      accessorFn: (row) => row.urgencyLevel,
      cell: ({ row }) => <UrgencyBadge level={row.original.urgencyLevel} />,
      meta: { className: 'px-2 text-center', headerClassName: `${headerCls} text-center` },
    },
    {
      id: 'countermeasure',
      accessorKey: 'countermeasure',
      header: '対策内容',
      size: 72,
      cell: ({ getValue }) => getValue<string>() || '-',
      meta: { className: cellCls, headerClassName: headerCls },
    },
    {
      id: 'plannedYear',
      accessorKey: 'plannedYear',
      header: '実施予定年',
      size: 80,
      cell: ({ getValue }) => getValue<number>() || '-',
      meta: { className: cellCls, headerClassName: headerCls },
    },
    {
      id: 'estimatedCost',
      accessorKey: 'estimatedCost',
      header: '概算費用',
      size: 90,
      cell: ({ getValue }) => {
        const v = getValue<number>();
        return v ? `\u00A5${v.toLocaleString()}` : '-';
      },
      meta: { className: `${cellCls} text-right`, headerClassName: `${headerCls} text-right` },
    },
    {
      accessorKey: 'notes',
      header: '備考',
      size: 200,
      cell: ({ getValue }) => getValue<string>() || '-',
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
            data-testid="facility-detail-link"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/assets/facilities/${row.original.id}`, {
                state: { breadcrumbFrom: { to: '/assets/facilities', label: '施設' } },
              });
            }}
          />
        </div>
      ),
      enableHiding: false,
      meta: { className: 'h-10 px-2 text-center', headerClassName: `${headerCls} text-center` },
    },
  ], [navigate]);

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
      const f = row.original;
      return (
        (f.name?.toLowerCase().includes(s) ?? false) ||
        (f.facilityId?.toLowerCase().includes(s) ?? false) ||
        (f.notes?.toLowerCase().includes(s) ?? false)
      );
    },
  });

  /* ── CSV Export ── */
  function handleExportCsv() {
    const visibleCols = table.getVisibleLeafColumns().filter((c) => c.id !== 'thumbnail' && c.id !== 'actions');
    const headerRow = visibleCols.map((c) => {
      const h = c.columnDef.header;
      return escapeCsvCell(typeof h === 'string' ? h : c.id);
    });
    const dataRows = table.getRowModel().rows.map((row) =>
      visibleCols.map((col) => {
        const f = row.original;
        const id = col.id;
        let value = '';
        if (id === 'name') value = f.name;
        else if (id === 'status') value = FACILITY_STATUS_CONFIG[f.status]?.label ?? f.status;
        else if (id === 'facilityId') value = f.facilityId ?? '';
        else if (id === 'classification') value = FACILITY_CLASSIFICATION_LABELS[f.facilityClassification || ''] || '';
        else if (id === 'parkName') value = PARK_LOOKUP.get(f.greenSpaceRef)?.displayName || '';
        else if (id === 'subItem') value = f.subItem ?? '';
        else if (id === 'subItemDetail') value = f.subItemDetail ?? '';
        else if (id === 'quantity') value = f.quantity != null ? `${f.quantity}` : '';
        else if (id === 'installDate') value = f.dateInstalled ?? '';
        else if (id === 'elapsedYears') value = f.designLife != null ? `${f.designLife}` : '';
        else if (id === 'manufacturer') value = f.manufacturer ?? '';
        else if (id === 'installer') value = f.installer ?? '';
        else if (id === 'mainMaterial') value = f.mainMaterial ?? '';
        else if (id === 'designDoc') value = f.designDocNumber ?? '';
        else if (id === 'inspectionDate') value = f.lastInspectionDate ?? '';
        else if (id === 'structureRank') value = f.structureRank ?? '';
        else if (id === 'wearRank') value = f.wearRank ?? '';
        else if (id === 'repairDate') value = f.lastRepairDate ?? '';
        else if (id === 'managementType') value = f.managementType ?? '';
        else if (id === 'urgency') value = f.urgencyLevel ?? '';
        else if (id === 'countermeasure') value = f.countermeasure ?? '';
        else if (id === 'plannedYear') value = f.plannedYear != null ? `${f.plannedYear}` : '';
        else if (id === 'estimatedCost') value = f.estimatedCost != null ? `${f.estimatedCost}` : '';
        else if (id === 'notes') value = f.notes ?? '';
        return escapeCsvCell(value);
      }),
    );
    const csv = [headerRow.join(','), ...dataRows.map((r) => r.join(','))].join('\n');
    downloadCsv(csv, `施設一覧_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  /* ── Print ── */
  function handlePrint() {
    window.print();
  }

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
  const TABLE_ROW_H = 82;
  const TABLE_HEADER_H = 41;
  const [visibleRowCount, setVisibleRowCount] = useState(() =>
    savedScrollTop != null ? Math.ceil((savedScrollTop + 1000) / TABLE_ROW_H) : 12,
  );
  const [batchSize, setBatchSize] = useState(12);

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
    setVisibleRowCount(batchSize);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [filteredData, batchSize]);

  /* ── Wheel event normalization ── */
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

  function applyColumnPreset(preset: ColumnPreset) {
    setColumnPreset(preset);
    setColumnVisibility(buildColumnVisibility(preset));
  }

  /* ── Print columns (visible except thumbnail/actions) ── */
  const printCols = table.getVisibleLeafColumns().filter((c) => c.id !== 'thumbnail' && c.id !== 'actions');

  return (
    <div className="flex min-h-0 flex-col overflow-hidden" style={{ margin: 16, padding: '0 24px 16px', height: 'calc(100% - 32px)' }}>
      {/* Title bar */}
      <div className="flex items-center justify-between" style={{ margin: '4px 0 20px' }}>
        <h1 className="text-3xl font-semibold leading-none tracking-tight">施設</h1>
        <Button size="icon-sm" className="size-9 rounded-full border-0 bg-[#215042] hover:bg-[#2a6554]">
          <Plus className="size-4" />
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3" style={{ marginBottom: 16 }}>
        {visibleFilters.includes('search') && (
          <div
            className="flex h-9 w-full sm:w-[316px] items-center gap-3 rounded-lg border border-[#e5e5e5] bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.00)]"
            style={{ padding: '0 16px' }}
          >
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <Input
              placeholder="名称, 施設ID, 備考"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="h-auto min-h-0 flex-1 border-0 p-0 shadow-none focus-visible:ring-0 focus-visible:border-0"
            />
          </div>
        )}

        {visibleFilters.includes('classification') && (
          <Select value={classificationFilter ?? '__all__'} onValueChange={(v) => setClassificationFilter(v === '__all__' ? undefined : v)}>
            <SelectTrigger className={toolbarSelectCls} style={{ paddingLeft: 16 }}>
              <SelectValue placeholder="施設分類 (すべて)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">施設分類 (すべて)</SelectItem>
              {classificationOptions.map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {visibleFilters.includes('status') && (
          <Select value={statusFilter ?? '__all__'} onValueChange={(v) => setStatusFilter(v === '__all__' ? undefined : v)}>
            <SelectTrigger className={toolbarSelectCls} style={{ paddingLeft: 16 }}>
              <SelectValue placeholder="状態 (すべて)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">状態 (すべて)</SelectItem>
              {statusOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {visibleFilters.includes('ward') && (
          <Select value={wardFilter ?? '__all__'} onValueChange={(v) => setWardFilter(v === '__all__' ? undefined : v)}>
            <SelectTrigger className={toolbarSelectCls} style={{ paddingLeft: 16 }}>
              <SelectValue placeholder="区 (すべて)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">区 (すべて)</SelectItem>
              {wardOptions.map((w) => (
                <SelectItem key={w} value={w}>{w}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {visibleFilters.includes('parkName') && (
          <Select value={parkRefFilter ?? '__all__'} onValueChange={(v) => setParkRefFilter(v === '__all__' ? undefined : v)}>
            <SelectTrigger className={toolbarSelectCls} style={{ paddingLeft: 16 }}>
              <SelectValue placeholder="公園名称 (すべて)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">公園名称 (すべて)</SelectItem>
              {parkRefOptions.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {visibleFilters.includes('category') && (
          <Select value={categoryFilter ?? '__all__'} onValueChange={(v) => setCategoryFilter(v === '__all__' ? undefined : v)}>
            <SelectTrigger className={toolbarSelectCls} style={{ paddingLeft: 16 }}>
              <SelectValue placeholder="カテゴリ (すべて)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">カテゴリ (すべて)</SelectItem>
              {categoryOptions.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {visibleFilters.includes('structureRank') && (
          <Select value={structureRankFilter ?? '__all__'} onValueChange={(v) => setStructureRankFilter(v === '__all__' ? undefined : v)}>
            <SelectTrigger className={toolbarSelectCls} style={{ paddingLeft: 16 }}>
              <SelectValue placeholder="構造ランク (すべて)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">構造ランク (すべて)</SelectItem>
              {rankOptions.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {visibleFilters.includes('wearRank') && (
          <Select value={wearRankFilter ?? '__all__'} onValueChange={(v) => setWearRankFilter(v === '__all__' ? undefined : v)}>
            <SelectTrigger className={toolbarSelectCls} style={{ paddingLeft: 16 }}>
              <SelectValue placeholder="消耗ランク (すべて)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">消耗ランク (すべて)</SelectItem>
              {rankOptions.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {visibleFilters.includes('urgencyLevel') && (
          <Select value={urgencyLevelFilter ?? '__all__'} onValueChange={(v) => setUrgencyLevelFilter(v === '__all__' ? undefined : v)}>
            <SelectTrigger className={toolbarSelectCls} style={{ paddingLeft: 16 }}>
              <SelectValue placeholder="緊急度 (すべて)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">緊急度 (すべて)</SelectItem>
              {urgencyLevelOptions.map((u) => (
                <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {visibleFilters.includes('managementType') && (
          <Select value={managementTypeFilter ?? '__all__'} onValueChange={(v) => setManagementTypeFilter(v === '__all__' ? undefined : v)}>
            <SelectTrigger className={toolbarSelectCls} style={{ paddingLeft: 16 }}>
              <SelectValue placeholder="管理種別 (すべて)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">管理種別 (すべて)</SelectItem>
              {managementTypeOptions.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {visibleFilters.includes('dateInstalled') && (
          <DateRangePickerInput
            placeholder="設置年月日"
            value={dateInstalledRange}
            onChange={setDateInstalledRange}
            clearable
            className="h-9 w-full sm:w-[200px] rounded-lg border-[#e5e5e5] bg-white text-sm text-muted-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.00)]"
          />
        )}

        {visibleFilters.includes('lastInspectionDate') && (
          <DateRangePickerInput
            placeholder="最近点検日"
            value={lastInspectionDateRange}
            onChange={setLastInspectionDateRange}
            clearable
            className="h-9 w-full sm:w-[200px] rounded-lg border-[#e5e5e5] bg-white text-sm text-muted-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.00)]"
          />
        )}

        {visibleFilters.includes('mainMaterial') && (
          <Select value={mainMaterialFilter ?? '__all__'} onValueChange={(v) => setMainMaterialFilter(v === '__all__' ? undefined : v)}>
            <SelectTrigger className={toolbarSelectCls} style={{ paddingLeft: 16 }}>
              <SelectValue placeholder="主要部材 (すべて)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">主要部材 (すべて)</SelectItem>
              {mainMaterialOptions.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {visibleFilters.includes('manufacturer') && (
          <Select value={manufacturerFilter ?? '__all__'} onValueChange={(v) => setManufacturerFilter(v === '__all__' ? undefined : v)}>
            <SelectTrigger className={toolbarSelectCls} style={{ paddingLeft: 16 }}>
              <SelectValue placeholder="メーカー (すべて)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">メーカー (すべて)</SelectItem>
              {manufacturerOptions.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {visibleFilters.includes('installer') && (
          <Select value={installerFilter ?? '__all__'} onValueChange={(v) => setInstallerFilter(v === '__all__' ? undefined : v)}>
            <SelectTrigger className={toolbarSelectCls} style={{ paddingLeft: 16 }}>
              <SelectValue placeholder="設置業者 (すべて)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">設置業者 (すべて)</SelectItem>
              {installerOptions.map((i) => (
                <SelectItem key={i} value={i}>{i}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {visibleFilters.includes('quantity') && (
          <div
            className="flex h-9 w-full sm:w-[200px] items-center gap-1 rounded-lg border border-[#e5e5e5] bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.00)]"
            style={{ padding: '0 12px' }}
          >
            <span className="text-xs text-muted-foreground shrink-0">数量</span>
            <Input
              placeholder="≥"
              value={quantityMin}
              onChange={(e) => setQuantityMin(e.target.value)}
              className="h-auto min-h-0 w-14 flex-1 border-0 p-0 text-sm text-center shadow-none focus-visible:ring-0 focus-visible:border-0"
            />
            <span className="text-xs text-muted-foreground">~</span>
            <Input
              placeholder="≤"
              value={quantityMax}
              onChange={(e) => setQuantityMax(e.target.value)}
              className="h-auto min-h-0 w-14 flex-1 border-0 p-0 text-sm text-center shadow-none focus-visible:ring-0 focus-visible:border-0"
            />
          </div>
        )}

        <TooltipProvider>
        <div className="ml-auto flex items-center gap-2">
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
          <DataTableViewOptions
            table={table}
            filterOptions={TOOLBAR_FILTER_OPTIONS}
            visibleFilters={visibleFilters}
            onVisibleFiltersChange={setVisibleFilters}
          />
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
                      data-testid="csv-export-button"
                    >
                      <FileInput className="size-4" />
                      CSVエクスポート
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handlePrint}
                      data-testid="print-button"
                    >
                      <Printer className="size-4" />
                      印刷
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>表示プリセット</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={columnPreset}
                      onValueChange={(value) => applyColumnPreset(value as ColumnPreset)}
                    >
                      <DropdownMenuRadioItem value="standard">標準</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="compact">コンパクト</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
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
          >
            すべてクリア
          </Button>
        </div>
        </TooltipProvider>
      </div>

      {/* Table container */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-lg" style={{ boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.10), 0 1px 2px -1px rgba(0, 0, 0, 0.10)' }}>
        <div className={`flex min-h-0 min-w-0 flex-1 flex-col transition-[margin] duration-200 ${selectedFacility ? 'mr-[494px]' : ''}`}>
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            data-testid="facility-table-scroll"
            className="scrollbar-auto-hide min-h-0 flex-1 overflow-x-auto overflow-y-auto [&_[data-slot=table-container]]:overflow-visible"
          >
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
              <TableBody data-testid="facility-table-body">
                {visibleRows.length ? (
                  visibleRows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-testid="facility-table-row"
                      className={`cursor-pointer hover:bg-[#f5f5f5] transition-colors ${selectedFacilityId === row.original.id ? 'bg-[#f0fdf4]' : ''}`}
                      onClick={() => setSelectedFacilityId(row.original.id)}
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
                      該当する施設がありません
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {hasMoreRows && <div ref={sentinelRef} className="h-1" />}
          </div>
        </div>

        {/* Preview panel overlay */}
        {selectedFacility && (
          <div
            className="absolute right-0 top-0 bottom-0 z-10 w-[494px] bg-white flex flex-col overflow-hidden"
            style={{
              boxShadow: '-10px 0 15px -3px rgba(0, 0, 0, 0.1), -4px 0 6px -4px rgba(0, 0, 0, 0.1)',
              borderTopRightRadius: 8,
              borderBottomRightRadius: 8,
            }}
            data-testid="facility-preview-panel"
          >
            <FacilityPreviewPanel
              facility={selectedFacility}
              onClose={() => setSelectedFacilityId(null)}
              onNavigateToDetail={() => navigate(`/assets/facilities/${selectedFacility.id}`, {
                state: { breadcrumbFrom: { to: '/assets/facilities', label: '施設' } },
              })}
            />
          </div>
        )}
      </div>

      {/* ── Advanced search dialog ── */}
      <Dialog open={advancedSearchOpen} onOpenChange={setAdvancedSearchOpen}>
        <DialogContent
          className="flex flex-col w-[700px] max-w-[calc(100vw-32px)] sm:max-w-[700px] max-h-[calc(100vh-2rem)] gap-0 overflow-hidden rounded-xl border border-[#e5e5e5] bg-white p-0 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-4px_rgba(0,0,0,0.1)] [&_[data-slot=dialog-close]]:top-4 [&_[data-slot=dialog-close]]:right-4 [&_[data-slot=dialog-close]]:border-0 [&_[data-slot=dialog-close]]:bg-transparent [&_[data-slot=dialog-close]_svg]:size-6"
          showCloseButton
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader className="p-4 items-start self-stretch">
            <DialogTitle className="text-xl font-bold leading-6 tracking-normal text-[#0a0a0a]">詳細検索</DialogTitle>
            <DialogDescription className="sr-only">施設の詳細検索フィルター</DialogDescription>
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
                        placeholder="名称, 施設ID, 備考"
                        value={draft.search}
                        onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
                        className="h-auto min-h-0 flex-1 border-0 p-0 text-sm shadow-none placeholder:text-[#a3a3a3] focus-visible:ring-0"
                      />
                    </div>
                  </div>
                  <div className={modalGridCls}>
                    <div>
                      <label className={modalLabelCls}>施設分類</label>
                      <Select value={draft.classification ?? '__all__'} onValueChange={(v) => setDraft((d) => ({ ...d, classification: v === '__all__' ? undefined : v }))}>
                        <SelectTrigger className={modalSelectTriggerCls}>
                          <SelectValue placeholder="" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">すべて</SelectItem>
                          {classificationOptions.map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className={modalLabelCls}>カテゴリ</label>
                      <Select value={draft.category ?? '__all__'} onValueChange={(v) => setDraft((d) => ({ ...d, category: v === '__all__' ? undefined : v }))}>
                        <SelectTrigger className={modalSelectTriggerCls}>
                          <SelectValue placeholder="" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">すべて</SelectItem>
                          {categoryOptions.map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className={modalLabelCls}>状態</label>
                      <Select value={draft.status ?? '__all__'} onValueChange={(v) => setDraft((d) => ({ ...d, status: v === '__all__' ? undefined : v }))}>
                        <SelectTrigger className={modalSelectTriggerCls}>
                          <SelectValue placeholder="" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">すべて</SelectItem>
                          {statusOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                          {wardOptions.map((w) => (
                            <SelectItem key={w} value={w}>{w}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className={modalLabelCls}>公園名称</label>
                      <Select value={draft.parkRef ?? '__all__'} onValueChange={(v) => setDraft((d) => ({ ...d, parkRef: v === '__all__' ? undefined : v }))}>
                        <SelectTrigger className={modalSelectTriggerCls}>
                          <SelectValue placeholder="" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">すべて</SelectItem>
                          {parkRefOptions.map((p) => (
                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* 設置・部材 */}
              <div className="space-y-3">
                <p className={modalSectionTitleCls}>設置・部材</p>
                <div className={modalGridCls}>
                  <div>
                    <label className={modalLabelCls}>設置年月日</label>
                    <DateRangePickerInput
                      placeholder="期間を選択"
                      value={draft.dateInstalled}
                      onChange={(r) => setDraft((prev) => ({ ...prev, dateInstalled: r }))}
                      clearable
                      popoverProps={{ zIndex: 100 }}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className={modalLabelCls}>数量 (最小)</label>
                    <Input
                      value={draft.quantityMin}
                      onChange={(e) => setDraft((d) => ({ ...d, quantityMin: e.target.value }))}
                      placeholder="≥"
                      className={modalInputCls}
                    />
                  </div>
                  <div>
                    <label className={modalLabelCls}>数量 (最大)</label>
                    <Input
                      value={draft.quantityMax}
                      onChange={(e) => setDraft((d) => ({ ...d, quantityMax: e.target.value }))}
                      placeholder="≤"
                      className={modalInputCls}
                    />
                  </div>
                </div>
                <div className={modalGridCls}>
                  <div>
                    <label className={modalLabelCls}>メーカー</label>
                    <Select value={draft.manufacturer ?? '__all__'} onValueChange={(v) => setDraft((d) => ({ ...d, manufacturer: v === '__all__' ? undefined : v }))}>
                      <SelectTrigger className={modalSelectTriggerCls}>
                        <SelectValue placeholder="" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">すべて</SelectItem>
                        {manufacturerOptions.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className={modalLabelCls}>設置業者</label>
                    <Select value={draft.installer ?? '__all__'} onValueChange={(v) => setDraft((d) => ({ ...d, installer: v === '__all__' ? undefined : v }))}>
                      <SelectTrigger className={modalSelectTriggerCls}>
                        <SelectValue placeholder="" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">すべて</SelectItem>
                        {installerOptions.map((i) => (
                          <SelectItem key={i} value={i}>{i}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className={modalLabelCls}>主要部材</label>
                    <Select value={draft.mainMaterial ?? '__all__'} onValueChange={(v) => setDraft((d) => ({ ...d, mainMaterial: v === '__all__' ? undefined : v }))}>
                      <SelectTrigger className={modalSelectTriggerCls}>
                        <SelectValue placeholder="" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">すべて</SelectItem>
                        {mainMaterialOptions.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* 点検・評価 */}
              <div className="space-y-3">
                <p className={modalSectionTitleCls}>点検・評価</p>
                <div className={modalGridCls}>
                  <div>
                    <label className={modalLabelCls}>最近点検日</label>
                    <DateRangePickerInput
                      placeholder="期間を選択"
                      value={draft.lastInspectionDate}
                      onChange={(r) => setDraft((prev) => ({ ...prev, lastInspectionDate: r }))}
                      clearable
                      popoverProps={{ zIndex: 100 }}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className={modalLabelCls}>構造ランク</label>
                    <Select value={draft.structureRank ?? '__all__'} onValueChange={(v) => setDraft((d) => ({ ...d, structureRank: v === '__all__' ? undefined : v }))}>
                      <SelectTrigger className={modalSelectTriggerCls}>
                        <SelectValue placeholder="" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">すべて</SelectItem>
                        {rankOptions.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className={modalLabelCls}>消耗ランク</label>
                    <Select value={draft.wearRank ?? '__all__'} onValueChange={(v) => setDraft((d) => ({ ...d, wearRank: v === '__all__' ? undefined : v }))}>
                      <SelectTrigger className={modalSelectTriggerCls}>
                        <SelectValue placeholder="" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">すべて</SelectItem>
                        {rankOptions.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className={modalGridCls}>
                  <div>
                    <label className={modalLabelCls}>緊急度</label>
                    <Select value={draft.urgencyLevel ?? '__all__'} onValueChange={(v) => setDraft((d) => ({ ...d, urgencyLevel: v === '__all__' ? undefined : v }))}>
                      <SelectTrigger className={modalSelectTriggerCls}>
                        <SelectValue placeholder="" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">すべて</SelectItem>
                        {urgencyLevelOptions.map((u) => (
                          <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className={modalLabelCls}>管理種別</label>
                    <Select value={draft.managementType ?? '__all__'} onValueChange={(v) => setDraft((d) => ({ ...d, managementType: v === '__all__' ? undefined : v }))}>
                      <SelectTrigger className={modalSelectTriggerCls}>
                        <SelectValue placeholder="" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">すべて</SelectItem>
                        {managementTypeOptions.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
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

      {/* Print-only table — hidden on screen, visible in @media print */}
      {createPortal(
        <div className="print-table-container hidden">
          <div className="print-header">
            <h2>施設一覧</h2>
          </div>
          <table className="print-table">
            <thead>
              <tr>
                {printCols.map((col) => {
                  const h = col.columnDef.header;
                  return <th key={col.id}>{typeof h === 'string' ? h : col.id}</th>;
                })}
              </tr>
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {printCols.map((col) => {
                    const f = row.original;
                    const id = col.id;
                    let value = '';
                    if (id === 'name') value = f.name;
                    else if (id === 'status') value = FACILITY_STATUS_CONFIG[f.status]?.label ?? f.status;
                    else if (id === 'facilityId') value = f.facilityId ?? '';
                    else if (id === 'classification') value = FACILITY_CLASSIFICATION_LABELS[f.facilityClassification || ''] || '';
                    else if (id === 'parkName') value = PARK_LOOKUP.get(f.greenSpaceRef)?.displayName || '';
                    else if (id === 'subItem') value = f.subItem ?? '';
                    else if (id === 'subItemDetail') value = f.subItemDetail ?? '';
                    else if (id === 'quantity') value = f.quantity != null ? `${f.quantity}` : '';
                    else if (id === 'installDate') value = f.dateInstalled ?? '';
                    else if (id === 'elapsedYears') value = f.designLife != null ? `${f.designLife}` : '';
                    else if (id === 'manufacturer') value = f.manufacturer ?? '';
                    else if (id === 'installer') value = f.installer ?? '';
                    else if (id === 'mainMaterial') value = f.mainMaterial ?? '';
                    else if (id === 'designDoc') value = f.designDocNumber ?? '';
                    else if (id === 'inspectionDate') value = f.lastInspectionDate ?? '';
                    else if (id === 'structureRank') value = f.structureRank ?? '';
                    else if (id === 'wearRank') value = f.wearRank ?? '';
                    else if (id === 'repairDate') value = f.lastRepairDate ?? '';
                    else if (id === 'managementType') value = f.managementType ?? '';
                    else if (id === 'urgency') value = f.urgencyLevel ?? '';
                    else if (id === 'countermeasure') value = f.countermeasure ?? '';
                    else if (id === 'plannedYear') value = f.plannedYear != null ? `${f.plannedYear}` : '';
                    else if (id === 'estimatedCost') value = f.estimatedCost != null ? `¥${f.estimatedCost.toLocaleString()}` : '';
                    else if (id === 'notes') value = f.notes ?? '';
                    return <td key={id}>{value}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
        document.body,
      )}
    </div>
  );
}

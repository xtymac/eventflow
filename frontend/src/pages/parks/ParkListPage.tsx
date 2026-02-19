import { useMemo, useState } from 'react';
import {
  type ColumnDef,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Search, Ellipsis, CircleArrowRight, Plus, CalendarIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
import { DataTableNumberedPagination } from '@/components/ui/data-table-numbered-pagination';
import { DataTableViewOptions } from '@/components/ui/data-table-view-options';
import { CURATED_PARKS, type CuratedPark } from '../../data/curatedParks';

/* ── Style tokens ── */
const headerCls = 'h-10 px-2 text-xs font-medium text-muted-foreground border-b border-[#f5f5f5]';
const cellCls = 'h-10 px-2 text-sm max-w-0 truncate';
const numCellCls = `${cellCls} text-right`;
const modalSectionTitleCls = 'border-b border-[#d7d7d7] pb-3 text-[18px] font-medium text-[#6f6f6f] sm:text-[20px]';
const modalLabelCls = 'text-[18px] font-semibold text-[#222222] sm:text-[20px]';
const modalInputCls = 'mt-2 h-14 rounded-[14px] border-[#d2d2d2] bg-white px-4 text-[17px] shadow-none placeholder:text-[#7a7a7a] focus-visible:ring-[2px] focus-visible:ring-[#cfcfcf] sm:text-[18px]';
const modalSelectTriggerCls = 'mt-2 h-14 w-full rounded-[14px] border-[#d2d2d2] bg-white px-4 text-[17px] shadow-none data-[placeholder]:text-transparent focus-visible:ring-[2px] focus-visible:ring-[#cfcfcf] sm:text-[18px]';
const modalGridCls = 'grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8';

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

/* ── Filter options derived from data ── */
const wards = [...new Set(CURATED_PARKS.map((p) => p.ward))].sort();
const categories = [...new Set(CURATED_PARKS.map((p) => p.category))].sort();
const acquisitionMethods = [...new Set(CURATED_PARKS.map((p) => p.acquisitionMethod))].sort();
const managementOffices = [...new Set(CURATED_PARKS.map((p) => p.managementOffice))].sort();
const paidFacilities = [...new Set(CURATED_PARKS.map((p) => p.paidFacility))].sort();
const disasterFacilities = [...new Set(CURATED_PARKS.map((p) => p.disasterFacility))].sort();

/* ── Columns ── */
const columns: ColumnDef<CuratedPark>[] = [
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
    cell: () => (
      <div className="flex items-center justify-center gap-3">
        <Ellipsis className="size-4 text-muted-foreground" />
        <CircleArrowRight className="size-4 text-muted-foreground" />
      </div>
    ),
    enableHiding: false,
    meta: { className: 'h-10 px-2 text-center', headerClassName: `${headerCls} text-center` },
  },
];

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

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { globalFilter, columnVisibility },
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 16 } },
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

  const totalWidth = table.getVisibleLeafColumns().reduce((sum, c) => sum + (c.getSize() ?? 100), 0);

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

  function applyColumnPreset(preset: ColumnPreset) {
    setColumnPreset(preset);
    setColumnVisibility(buildColumnVisibility(preset));
  }

  return (
    <div className="flex min-h-0 flex-col overflow-hidden" style={{ margin: 16, padding: '24px 24px 16px', height: 'calc(100% - 32px)' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 32 }}>
        <h1 className="text-5xl font-semibold leading-none tracking-tight">公園</h1>
        <Button size="icon-lg" className="size-14 rounded-full border-0 bg-green-800 hover:bg-green-700">
          <Plus className="size-6" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3" style={{ marginBottom: 16 }}>
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

        <Select value={wardFilter ?? ''} onValueChange={(v) => setWardFilter(v || undefined)}>
          <SelectTrigger className="h-9 w-[200px] rounded-lg border-[#e5e5e5] bg-white text-muted-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.00)]" style={{ paddingLeft: 16 }}>
            <SelectValue placeholder="区" />
          </SelectTrigger>
          <SelectContent>
            {wards.map((w) => (
              <SelectItem key={w} value={w}>{w}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={categoryFilter ?? ''} onValueChange={(v) => setCategoryFilter(v || undefined)}>
          <SelectTrigger className="h-9 w-[200px] rounded-lg border-[#e5e5e5] bg-white text-muted-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.00)]" style={{ paddingLeft: 16 }}>
            <SelectValue placeholder="種別" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={acquisitionFilter ?? ''} onValueChange={(v) => setAcquisitionFilter(v || undefined)}>
          <SelectTrigger className="h-9 w-[200px] rounded-lg border-[#e5e5e5] bg-white text-muted-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.00)]" style={{ paddingLeft: 16 }}>
            <SelectValue placeholder="取得方法" />
          </SelectTrigger>
          <SelectContent>
            {acquisitionMethods.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="secondary"
            size="icon-sm"
            className="size-9 border border-[#e5e5e5] bg-[#f5f5f5] text-[#595959] hover:bg-[#ececec]"
            onClick={openAdvancedSearch}
          >
            <AdvancedSearchIcon className="size-4" />
            <span className="sr-only">詳細検索</span>
          </Button>
          <DataTableViewOptions table={table} />
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

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-auto [&_[data-slot=table-container]]:overflow-visible">
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
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/assets/parks/${row.original.id}`)}
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
        </div>

        <div className="flex items-center justify-end" style={{ marginTop: 16 }}>
          <DataTableNumberedPagination table={table} />
        </div>
      </div>

      <Dialog open={advancedSearchOpen} onOpenChange={setAdvancedSearchOpen}>
        <DialogContent
          className="w-[min(1200px,calc(100vw-32px))] max-w-none gap-0 overflow-hidden rounded-[20px] border border-[#d8d8d8] bg-[#f4f4f4] p-0 shadow-[0_28px_80px_rgba(0,0,0,0.28)] [&_[data-slot=dialog-close]]:top-6 [&_[data-slot=dialog-close]]:right-6 [&_[data-slot=dialog-close]]:opacity-70 [&_[data-slot=dialog-close]_svg]:size-6"
          showCloseButton
        >
          <DialogHeader className="px-6 pb-0 pt-6 sm:px-8 sm:pt-7">
            <DialogTitle className="text-[34px] font-bold leading-none tracking-tight text-[#191919] sm:text-[44px]">詳細検索</DialogTitle>
            <DialogDescription className="sr-only">公園の詳細検索フィルター</DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto px-6 pb-8 pt-6 sm:px-8 sm:pt-8" style={{ maxHeight: 'calc(100vh - 240px)' }}>
            <div className="space-y-10">
              {/* 基本属性・管理 */}
              <div className="space-y-5">
                <p className={modalSectionTitleCls}>基本属性・管理</p>
                <div className="space-y-6">
                  <div>
                    <label className={modalLabelCls}>検索</label>
                    <div className="mt-2 flex h-14 items-center gap-3 rounded-[14px] border border-[#d2d2d2] bg-white px-4 shadow-none">
                      <Search className="size-5 shrink-0 text-[#7a7a7a]" />
                      <Input
                        placeholder="No, 名称, 所在地"
                        value={draft.search}
                        onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
                        className="h-auto min-h-0 flex-1 border-0 p-0 text-[17px] shadow-none placeholder:text-[#7a7a7a] focus-visible:ring-0 sm:text-[18px]"
                      />
                    </div>
                  </div>
                  <div className={modalGridCls}>
                    <div>
                      <label className={modalLabelCls}>区</label>
                      <Select value={draft.ward ?? ''} onValueChange={(v) => setDraft((d) => ({ ...d, ward: v || undefined }))}>
                        <SelectTrigger className={modalSelectTriggerCls}>
                          <SelectValue placeholder="" />
                        </SelectTrigger>
                        <SelectContent>
                          {wards.map((w) => (
                            <SelectItem key={w} value={w}>{w}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className={modalLabelCls}>種別</label>
                      <Select value={draft.category ?? ''} onValueChange={(v) => setDraft((d) => ({ ...d, category: v || undefined }))}>
                        <SelectTrigger className={modalSelectTriggerCls}>
                          <SelectValue placeholder="" />
                        </SelectTrigger>
                        <SelectContent>
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
                      <Select value={draft.managementOffice ?? ''} onValueChange={(v) => setDraft((d) => ({ ...d, managementOffice: v || undefined }))}>
                        <SelectTrigger className={modalSelectTriggerCls}>
                          <SelectValue placeholder="" />
                        </SelectTrigger>
                        <SelectContent>
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
              <div className="space-y-5">
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
                    <div className="relative mt-2">
                      <Input
                        className={`${modalInputCls} pr-12`}
                      />
                      <CalendarIcon className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-[#646464]" />
                    </div>
                  </div>
                  <div>
                    <label className={modalLabelCls}>設置年月日</label>
                    <div className="relative mt-2">
                      <Input
                        className={`${modalInputCls} pr-12`}
                      />
                      <CalendarIcon className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-[#646464]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* 都市計画・権利 */}
              <div className="space-y-5">
                <p className={modalSectionTitleCls}>都市計画・権利</p>
                <div className="space-y-6">
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
                      <div className="relative mt-2">
                        <Input
                          className={`${modalInputCls} pr-12`}
                        />
                        <CalendarIcon className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-[#646464]" />
                      </div>
                    </div>
                  </div>
                  <div className={modalGridCls}>
                    <div>
                      <label className={modalLabelCls}>取得方法</label>
                      <Select value={draft.acquisitionMethod ?? ''} onValueChange={(v) => setDraft((d) => ({ ...d, acquisitionMethod: v || undefined }))}>
                        <SelectTrigger className={modalSelectTriggerCls}>
                          <SelectValue placeholder="" />
                        </SelectTrigger>
                        <SelectContent>
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
              <div className="space-y-5">
                <p className={modalSectionTitleCls}>施設・機能</p>
                <div className={modalGridCls}>
                  <div>
                    <label className={modalLabelCls}>有料施設</label>
                    <Select value={draft.paidFacility ?? ''} onValueChange={(v) => setDraft((d) => ({ ...d, paidFacility: v || undefined }))}>
                      <SelectTrigger className={modalSelectTriggerCls}>
                        <SelectValue placeholder="" />
                      </SelectTrigger>
                      <SelectContent>
                        {paidFacilities.map((f) => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className={modalLabelCls}>防災施設</label>
                    <Select value={draft.disasterFacility ?? ''} onValueChange={(v) => setDraft((d) => ({ ...d, disasterFacility: v || undefined }))}>
                      <SelectTrigger className={modalSelectTriggerCls}>
                        <SelectValue placeholder="" />
                      </SelectTrigger>
                      <SelectContent>
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

          <div className="flex items-center justify-between border-t border-[#d6d6d6] bg-[#e9e9e9] px-6 py-5 sm:px-8">
            <button
              type="button"
              className="text-[17px] font-semibold text-[#757575] hover:text-[#4c4c4c] sm:text-[18px]"
              onClick={clearDraft}
            >
              すべてクリア
            </button>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setAdvancedSearchOpen(false)}
                className="h-14 rounded-[14px] border-[#c7c7c7] bg-white px-8 text-[17px] text-[#2b2b2b] shadow-none hover:bg-[#f8f8f8] sm:text-[18px]"
              >
                Cancel
              </Button>
              <Button
                onClick={applyAdvancedSearch}
                className="h-14 rounded-[14px] bg-[#215042] px-8 text-[17px] text-white shadow-none hover:bg-[#1a4035] sm:text-[18px]"
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

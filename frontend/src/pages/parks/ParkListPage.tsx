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
import { Search, Ellipsis, CircleArrowRight, Plus, SlidersHorizontal } from 'lucide-react';
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

  const hasFilters =
    !!wardFilter || !!categoryFilter || !!acquisitionFilter || globalFilter !== '';

  const filteredData = useMemo(() => {
    return sortedData.filter((p) => {
      if (wardFilter && p.ward !== wardFilter) return false;
      if (categoryFilter && p.category !== categoryFilter) return false;
      if (acquisitionFilter && p.acquisitionMethod !== acquisitionFilter) return false;
      return true;
    });
  }, [wardFilter, categoryFilter, acquisitionFilter]);

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="icon-sm"
                className="size-9 border border-[#e5e5e5] bg-[#f5f5f5] text-[#595959] hover:bg-[#ececec]"
              >
                <SlidersHorizontal className="size-4" />
                <span className="sr-only">表示プリセット</span>
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
          <DataTableViewOptions table={table} />
          <Button
            variant="secondary"
            size="icon-sm"
            className="size-9 border border-[#e5e5e5] bg-[#f5f5f5] text-[#595959] hover:bg-[#ececec]"
          >
            <Ellipsis className="size-4" />
          </Button>
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
                        style={{ width: header.getSize(), minWidth: header.getSize() }}
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
                          style={{ width: cell.column.getSize(), minWidth: cell.column.getSize() }}
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
    </div>
  );
}

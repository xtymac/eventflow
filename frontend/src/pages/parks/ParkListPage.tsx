import { useState } from 'react';
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { IconSearch, IconDots, IconChevronUp, IconChevronDown, IconSelector } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

import { Box, Text } from '@/components/shims';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CURATED_PARKS, type CuratedPark } from '../../data/curatedParks';

/* ── Figma DS overrides (Style=Line) ── */
const headerCls = 'h-10 px-2 text-xs font-medium text-muted-foreground';
const cellCls = 'h-10 px-2 text-sm max-w-0 truncate';
const numHeaderCls = `${headerCls} text-right`;
const numCellCls = `${cellCls} text-right`;

function SortIcon({ isSorted }: { isSorted: false | 'asc' | 'desc' }) {
  if (isSorted === 'asc') return <IconChevronUp className="ml-1 inline size-3.5" />;
  if (isSorted === 'desc') return <IconChevronDown className="ml-1 inline size-3.5" />;
  return <IconSelector className="ml-1 inline size-3.5 opacity-30" />;
}

const columns: ColumnDef<CuratedPark>[] = [
  { accessorKey: 'no', header: 'No', size: 70, meta: { className: cellCls, headerClassName: headerCls } },
  { accessorKey: 'displayName', header: '名称', size: 130, meta: { className: cellCls, headerClassName: headerCls } },
  { accessorKey: 'ward', header: '区', size: 70, meta: { className: cellCls, headerClassName: headerCls } },
  { accessorKey: 'address', header: '所在地', size: 280, meta: { className: cellCls, headerClassName: headerCls } },
  {
    accessorKey: 'areaHa', header: '面積, ha', size: 90,
    cell: ({ getValue }) => (getValue<number>()).toFixed(2),
    meta: { className: numCellCls, headerClassName: numHeaderCls },
  },
  { accessorKey: 'openingYear', header: '開園年度', size: 80, meta: { className: cellCls, headerClassName: headerCls } },
  { accessorKey: 'establishedDate', header: '設置年月日', size: 110, meta: { className: cellCls, headerClassName: headerCls } },
  { accessorKey: 'planNumber', header: '計画番号', size: 80, meta: { className: cellCls, headerClassName: headerCls } },
  {
    accessorKey: 'plannedAreaHa', header: '計画面積, ha', size: 110,
    cell: ({ getValue }) => (getValue<number>()).toFixed(2),
    meta: { className: numCellCls, headerClassName: numHeaderCls },
  },
  { accessorKey: 'urbanPlanNumber', header: '都市計画番号', size: 110, meta: { className: cellCls, headerClassName: headerCls } },
  { accessorKey: 'planDecisionDate', header: '計画決定日', size: 100, meta: { className: cellCls, headerClassName: headerCls } },
  { accessorKey: 'acquisitionMethod', header: '取得方法', size: 80, meta: { className: cellCls, headerClassName: headerCls } },
  { accessorKey: 'category', header: '種別', size: 50, meta: { className: cellCls, headerClassName: headerCls } },
  { accessorKey: 'schoolDistrict', header: '学区名', size: 140, meta: { className: cellCls, headerClassName: headerCls } },
  { accessorKey: 'paidFacility', header: '有料施設', size: 60, meta: { className: cellCls, headerClassName: headerCls } },
  { accessorKey: 'disasterFacility', header: '防災施設', size: 140, meta: { className: cellCls, headerClassName: headerCls } },
  { accessorKey: 'managementOffice', header: '管理公所', size: 130, meta: { className: cellCls, headerClassName: headerCls } },
  {
    accessorKey: 'notes', header: '備考', size: 340,
    cell: ({ getValue }) => String(getValue<string>() ?? '').replace(/<br>/g, ' / '),
    meta: { className: cellCls, headerClassName: headerCls },
  },
  {
    id: 'actions',
    size: 36,
    header: () => null,
    cell: () => <IconDots size={20} className="mx-auto text-muted-foreground" />,
    enableSorting: false,
    meta: { className: 'h-10 w-9 px-1.5 text-center', headerClassName: 'h-10 w-9' },
  },
];

const data: CuratedPark[] = [...CURATED_PARKS].sort((a, b) => {
  const aNum = parseFloat(a.no.replace(/[^0-9.]/g, ''));
  const bNum = parseFloat(b.no.replace(/[^0-9.]/g, ''));
  return aNum - bNum;
});

export function ParkListPage() {
  const navigate = useNavigate();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const s = filterValue.toLowerCase();
      const v = row.original;
      return (
        v.displayName.toLowerCase().includes(s) ||
        v.id.toLowerCase().includes(s) ||
        v.ward.toLowerCase().includes(s) ||
        v.address.toLowerCase().includes(s)
      );
    },
  });

  const totalWidth = columns.reduce((sum, c) => sum + (c.size ?? 100), 0);

  return (
    <Box p="lg" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Search */}
      <div className="relative mb-4">
        <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search (ID, 名称, 区, 所在地)"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="pl-9"
        />
      </div>

      <Text size="lg" fw={600} mb="sm">公園台帳一覧</Text>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-md border">
        <Table style={{ minWidth: totalWidth }}>
          <TableHeader className="sticky top-0 z-10 bg-background">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta as { headerClassName?: string } | undefined;
                  return (
                    <TableHead
                      key={header.id}
                      className={meta?.headerClassName}
                      style={{ width: header.getSize(), minWidth: header.getSize() }}
                      onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                    >
                      {header.isPlaceholder ? null : (
                        <span className={header.column.getCanSort() ? 'cursor-pointer select-none inline-flex items-center' : ''}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && (
                            <SortIcon isSorted={header.column.getIsSorted()} />
                          )}
                        </span>
                      )}
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
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  該当する公園がありません
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between pt-3">
        <span className="text-xs text-muted-foreground">
          {table.getFilteredRowModel().rows.length} 件中{' '}
          {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–
          {Math.min(
            (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
            table.getFilteredRowModel().rows.length,
          )}{' '}
          件表示
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            前へ
          </Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            次へ
          </Button>
        </div>
      </div>
    </Box>
  );
}

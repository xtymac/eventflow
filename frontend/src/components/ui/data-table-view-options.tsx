"use client"

import { type Column, type Table } from "@tanstack/react-table"
import { Settings2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface DataTableViewOptionsProps<TData> {
  table: Table<TData>
}

function getColumnLabel<TData>(column: Column<TData, unknown>): string {
  const header = column.columnDef?.header
  if (typeof header === "string" && header.trim().length > 0) {
    return header
  }

  const accessorKey = (column.columnDef as { accessorKey?: unknown }).accessorKey
  if (typeof accessorKey === "string" && accessorKey.trim().length > 0) {
    return accessorKey
  }

  return column.id
}

export function DataTableViewOptions<TData>({
  table,
}: DataTableViewOptionsProps<TData>) {
  const columns = table
    .getAllColumns()
    .filter(
      (column) =>
        typeof column.accessorFn !== "undefined" && column.getCanHide()
    )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="icon-sm"
          className="size-9 border border-[#e5e5e5] bg-[#f5f5f5] text-[#595959] hover:bg-[#ececec]"
        >
          <Settings2 className="size-4" />
          <span className="sr-only">表示列</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[180px]">
        <DropdownMenuLabel>表示列</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={column.getIsVisible()}
            onCheckedChange={(value) => column.toggleVisibility(!!value)}
          >
            {getColumnLabel(column)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

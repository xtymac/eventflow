import { type Table } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface DataTablePaginationProps<TData> {
  table: Table<TData>
}

type PaginationItem =
  | { type: "page"; page: number }
  | { type: "ellipsis"; key: string }

function buildPaginationItems(
  currentPage: number,
  pageCount: number
): PaginationItem[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, page) => ({
      type: "page" as const,
      page,
    }))
  }

  const pages = new Set<number>([
    0,
    pageCount - 1,
    currentPage - 1,
    currentPage,
    currentPage + 1,
  ])
  const sortedPages = [...pages]
    .filter((page) => page >= 0 && page < pageCount)
    .sort((a, b) => a - b)

  const items: PaginationItem[] = []
  for (let i = 0; i < sortedPages.length; i += 1) {
    const page = sortedPages[i]
    const prev = sortedPages[i - 1]

    if (prev != null && page - prev > 1) {
      if (page - prev === 2) {
        items.push({ type: "page", page: prev + 1 })
      } else {
        items.push({ type: "ellipsis", key: `${prev}-${page}` })
      }
    }

    items.push({ type: "page", page })
  }

  return items
}

export function DataTablePagination<TData>({
  table,
}: DataTablePaginationProps<TData>) {
  const currentPage = table.getState().pagination.pageIndex
  const pageCount = table.getPageCount()
  const items = buildPaginationItems(currentPage, pageCount)

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        className="h-9 px-3 text-sm text-muted-foreground hover:text-foreground"
        onClick={() => table.previousPage()}
        disabled={!table.getCanPreviousPage()}
      >
        前へ
      </Button>

      <div className="flex items-center gap-1">
        {items.map((item) => {
          if (item.type === "ellipsis") {
            return (
              <span key={item.key} className="px-2 text-muted-foreground">
                ...
              </span>
            )
          }

          const isActive = item.page === currentPage
          return (
            <Button
              key={item.page}
              variant="ghost"
              className={cn(
                "size-9 rounded-md p-0 text-sm text-muted-foreground hover:text-foreground",
                isActive &&
                  "border border-[#d9d9d9] bg-white font-medium text-foreground hover:bg-white"
              )}
              onClick={() => table.setPageIndex(item.page)}
            >
              {item.page + 1}
            </Button>
          )
        })}
      </div>

      <Button
        variant="ghost"
        className="h-9 px-3 text-sm text-muted-foreground hover:text-foreground"
        onClick={() => table.nextPage()}
        disabled={!table.getCanNextPage()}
      >
        次へ
      </Button>
    </div>
  )
}

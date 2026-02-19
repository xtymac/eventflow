import { Table } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"

interface DataTableNumberedPaginationProps<TData> {
  table: Table<TData>
}

function getPageNumbers(currentPage: number, totalPages: number): (number | '...')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const pages: (number | '...')[] = [1]

  if (currentPage > 3) {
    pages.push('...')
  }

  const start = Math.max(2, currentPage - 1)
  const end = Math.min(totalPages - 1, currentPage + 1)
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  if (currentPage < totalPages - 2) {
    pages.push('...')
  }

  pages.push(totalPages)
  return pages
}

export function DataTableNumberedPagination<TData>({
  table,
}: DataTableNumberedPaginationProps<TData>) {
  const currentPage = table.getState().pagination.pageIndex + 1
  const totalPages = table.getPageCount()

  if (totalPages <= 1) return null

  const pageNumbers = getPageNumbers(currentPage, totalPages)

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => table.previousPage()}
        disabled={!table.getCanPreviousPage()}
        className="text-sm"
      >
        前へ
      </Button>

      {pageNumbers.map((page, i) =>
        page === '...' ? (
          <span key={`ellipsis-${i}`} className="px-2 text-sm text-muted-foreground">
            ...
          </span>
        ) : (
          <Button
            key={page}
            variant={page === currentPage ? 'outline' : 'ghost'}
            size="sm"
            onClick={() => table.setPageIndex(page - 1)}
            className="h-8 w-8 p-0 text-sm"
          >
            {page}
          </Button>
        )
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={() => table.nextPage()}
        disabled={!table.getCanNextPage()}
        className="text-sm"
      >
        次へ
      </Button>
    </div>
  )
}

import { Table } from "@tanstack/react-table"
import { MoreHorizontal } from "lucide-react"

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

const ghostBtn = "inline-flex items-center justify-center rounded-lg text-sm font-medium min-h-[36px] px-4 py-2 text-[#404040] hover:bg-[#f5f5f5] disabled:opacity-50 disabled:pointer-events-none"
const activeBtn = "inline-flex items-center justify-center rounded-lg text-sm font-medium min-h-[36px] min-w-[34px] px-4 py-2 border border-[#d4d4d4] bg-white text-[#0a0a0a] shadow-[0_1px_2px_0_rgba(0,0,0,0)]"
const inactiveBtn = "inline-flex items-center justify-center rounded-lg text-sm font-medium min-h-[36px] min-w-[34px] px-4 py-2 text-[#404040] hover:bg-[#f5f5f5]"

export function DataTableNumberedPagination<TData>({
  table,
}: DataTableNumberedPaginationProps<TData>) {
  const currentPage = table.getState().pagination.pageIndex + 1
  const totalPages = table.getPageCount()

  if (totalPages <= 1) return null

  const pageNumbers = getPageNumbers(currentPage, totalPages)

  return (
    <div className="flex items-center justify-end" style={{ gap: 8 }}>
      <button
        type="button"
        onClick={() => table.previousPage()}
        disabled={!table.getCanPreviousPage()}
        className={ghostBtn}
      >
        前へ
      </button>

      {pageNumbers.map((page, i) =>
        page === '...' ? (
          <span
            key={`ellipsis-${i}`}
            className="inline-flex items-center justify-center rounded-lg min-h-[36px] min-w-[36px]"
          >
            <MoreHorizontal className="size-5 text-[#404040]" />
          </span>
        ) : (
          <button
            key={page}
            type="button"
            onClick={() => table.setPageIndex(page - 1)}
            className={page === currentPage ? activeBtn : inactiveBtn}
          >
            {page}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => table.nextPage()}
        disabled={!table.getCanNextPage()}
        className={ghostBtn}
      >
        次へ
      </button>
    </div>
  )
}

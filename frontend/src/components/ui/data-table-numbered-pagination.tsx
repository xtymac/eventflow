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

export function DataTableNumberedPagination<TData>({
  table,
}: DataTableNumberedPaginationProps<TData>) {
  const currentPage = table.getState().pagination.pageIndex + 1
  const totalPages = table.getPageCount()

  if (totalPages <= 1) return null

  const pageNumbers = getPageNumbers(currentPage, totalPages)

  return (
    <nav data-pagination="" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
      <style>{`
        [data-pagination] button {
          all: unset;
          box-sizing: border-box;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          font-family: inherit;
          line-height: 20px;
          min-height: 36px;
          padding: 8px 16px;
          cursor: pointer;
          white-space: nowrap;
          color: #404040;
        }
        [data-pagination] button:hover:not(:disabled):not([data-active]) {
          background-color: #f5f5f5;
        }
        [data-pagination] button:disabled {
          opacity: 0.5;
          pointer-events: none;
          cursor: default;
        }
        [data-pagination] button[data-page] {
          min-width: 34px;
        }
        [data-pagination] button[data-active] {
          min-width: 34px;
          color: #0a0a0a;
          border: 1px solid #d4d4d4;
          background-color: #fff;
          box-shadow: 0 1px 2px 0 rgba(0,0,0,0);
          cursor: default;
        }
        [data-pagination] .pg-ellipsis {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          min-height: 36px;
          min-width: 36px;
        }
        [data-pagination] .pg-ellipsis svg {
          width: 20px;
          height: 20px;
          color: #404040;
        }
      `}</style>

      <button
        type="button"
        onClick={() => table.previousPage()}
        disabled={!table.getCanPreviousPage()}
      >
        前へ
      </button>

      {pageNumbers.map((page, i) =>
        page === '...' ? (
          <span key={`ellipsis-${i}`} className="pg-ellipsis">
            <MoreHorizontal />
          </span>
        ) : (
          <button
            key={page}
            type="button"
            data-page=""
            {...(page === currentPage ? { 'data-active': '' } : {})}
            onClick={() => table.setPageIndex(page - 1)}
          >
            {page}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => table.nextPage()}
        disabled={!table.getCanNextPage()}
      >
        次へ
      </button>
    </nav>
  )
}

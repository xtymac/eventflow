import { type Table } from "@tanstack/react-table"
import { MoreHorizontal } from "lucide-react"

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
    <nav data-pagination="" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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

      {items.map((item) => {
        if (item.type === "ellipsis") {
          return (
            <span key={item.key} className="pg-ellipsis">
              <MoreHorizontal />
            </span>
          )
        }

        const isActive = item.page === currentPage
        return (
          <button
            key={item.page}
            type="button"
            data-page=""
            {...(isActive ? { 'data-active': '' } : {})}
            onClick={() => table.setPageIndex(item.page)}
          >
            {item.page + 1}
          </button>
        )
      })}

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

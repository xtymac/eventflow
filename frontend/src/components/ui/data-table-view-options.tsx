"use client"

import { useState } from "react"
import { type Column, type Table } from "@tanstack/react-table"
import { GripVertical } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface FilterOption {
  id: string
  label: string
}

interface DataTableViewOptionsProps<TData> {
  table: Table<TData>
  filterOptions?: FilterOption[]
  visibleFilters?: string[]
  onVisibleFiltersChange?: (filters: string[]) => void
  maxFilters?: number
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
  filterOptions = [],
  visibleFilters = [],
  onVisibleFiltersChange,
  maxFilters = 4,
}: DataTableViewOptionsProps<TData>) {
  const [activeTab, setActiveTab] = useState<"columns" | "filters">("columns")

  const columns = table
    .getAllColumns()
    .filter(
      (column) =>
        typeof column.accessorFn !== "undefined" && column.getCanHide()
    )

  const hasFilterTab = filterOptions.length > 0

  function toggleFilter(filterId: string) {
    if (!onVisibleFiltersChange) return
    const isSelected = visibleFilters.includes(filterId)
    if (isSelected) {
      onVisibleFiltersChange(visibleFilters.filter((id) => id !== filterId))
    } else if (visibleFilters.length < maxFilters) {
      onVisibleFiltersChange([...visibleFilters, filterId])
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size="icon-sm"
          className="size-9 border border-[#e5e5e5] bg-[#f5f5f5] text-[#595959] hover:bg-[#ececec]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" className="size-4">
            <path d="M8.98003 2.66666C8.98003 2.44565 8.89217 2.23375 8.73589 2.07747C8.57962 1.92125 8.36767 1.83333 8.1467 1.83333H7.85373C7.63276 1.83333 7.42081 1.92125 7.26454 2.07747C7.10826 2.23375 7.0204 2.44565 7.0204 2.66666V2.7871C7.02007 3.10848 6.93508 3.4242 6.77431 3.70247C6.61364 3.98042 6.38229 4.21102 6.10438 4.37174L5.81792 4.53906L5.81662 4.53971C5.53797 4.70054 5.22169 4.78515 4.89996 4.78515C4.57823 4.78511 4.26192 4.70057 3.98329 4.53971L3.898 4.49479C3.89314 4.49219 3.88846 4.48908 3.88368 4.48632C3.69252 4.37608 3.46536 4.34603 3.25217 4.40299C3.03899 4.45999 2.85697 4.59945 2.74631 4.79036L2.59983 5.04361L2.59917 5.04296C2.48896 5.23414 2.45949 5.46193 2.51649 5.67512C2.56642 5.86164 2.6795 6.02424 2.83485 6.13606L2.90386 6.18098L2.93121 6.19726L3.03082 6.26367C3.29563 6.42277 3.51664 6.64603 3.67209 6.91341C3.8328 7.18992 3.91819 7.50374 3.92014 7.82356V8.16471L3.91688 8.2858C3.89941 8.56666 3.81737 8.84035 3.67665 9.08528C3.51568 9.36537 3.28325 9.59824 3.00347 9.75976L3.00282 9.75911L2.91102 9.8151L2.90386 9.81966L2.90321 9.819C2.71254 9.92965 2.5735 10.1119 2.51649 10.3249C2.45953 10.5379 2.48919 10.7653 2.59917 10.9564L2.74631 11.2096C2.85697 11.4005 3.03899 11.54 3.25217 11.597C3.46536 11.654 3.69252 11.6239 3.88368 11.5137L3.898 11.5052L3.98329 11.4603C4.26191 11.2994 4.57823 11.2149 4.89996 11.2148C5.22169 11.2148 5.53797 11.2995 5.81662 11.4603L5.81792 11.4609L6.10373 11.6269L6.20595 11.6907C6.43881 11.8465 6.63358 12.0541 6.77431 12.2975C6.93508 12.5758 7.02007 12.8915 7.0204 13.2129V13.3333C7.0204 13.5543 7.10826 13.7662 7.26454 13.9225C7.42081 14.0787 7.63276 14.1667 7.85373 14.1667H8.1467C8.36767 14.1667 8.57962 14.0787 8.73589 13.9225C8.89217 13.7662 8.98003 13.5543 8.98003 13.3333V13.2129C8.98036 12.8915 9.06535 12.5758 9.22613 12.2975C9.387 12.0192 9.61833 11.7877 9.8967 11.6269L10.1825 11.4609L10.1838 11.4603C10.4625 11.2995 10.7787 11.2148 11.1005 11.2148C11.4222 11.2149 11.7385 11.2994 12.0171 11.4603L12.1024 11.5052L12.1168 11.5137C12.3079 11.6239 12.5351 11.654 12.7483 11.597C12.9614 11.54 13.1435 11.4005 13.2541 11.2096L13.398 10.9544L13.4006 10.9499C13.5108 10.7587 13.5409 10.5315 13.4839 10.3184C13.4273 10.1067 13.2893 9.92596 13.1005 9.8151L13.0113 9.76757C13.0065 9.76501 13.0017 9.76248 12.997 9.75976C12.7172 9.59824 12.4848 9.36538 12.3238 9.08528C12.1629 8.80526 12.079 8.48765 12.0803 8.16471V7.83333C12.0794 7.51106 12.1632 7.19417 12.3238 6.91471C12.4646 6.66964 12.6601 6.46058 12.8941 6.30403L12.997 6.24023L13.0894 6.18489L13.0966 6.18033C13.2874 6.0697 13.4269 5.88817 13.4839 5.67512C13.541 5.46186 13.5109 5.23419 13.4006 5.04296L13.2541 4.79036C13.1435 4.59945 12.9614 4.45999 12.7483 4.40299C12.5351 4.34603 12.3079 4.37608 12.1168 4.48632C12.112 4.48908 12.1073 4.49219 12.1024 4.49479L12.0165 4.53906C11.7379 4.69991 11.4222 4.78511 11.1005 4.78515C10.7787 4.78515 10.4625 4.70054 10.1838 4.53971L10.1825 4.53906L9.8954 4.37239C9.61772 4.21168 9.3867 3.98026 9.22613 3.70247C9.06535 3.4242 8.98036 3.10848 8.98003 2.7871V2.66666ZM9.98003 2.78645L9.9872 2.89518C10.0015 3.00309 10.0372 3.10761 10.092 3.20247C10.1469 3.29739 10.2198 3.3803 10.3062 3.44661L10.3967 3.50716L10.398 3.50781L10.6838 3.67382L10.7815 3.722C10.8822 3.7637 10.9908 3.78515 11.1005 3.78515C11.2467 3.78511 11.3905 3.74692 11.5171 3.67382L11.5315 3.66536L11.6317 3.61197C12.0493 3.37615 12.543 3.31349 13.0067 3.43749C13.4759 3.56297 13.876 3.86948 14.1194 4.28971L14.2665 4.54296C14.5091 4.96361 14.5748 5.4638 14.4494 5.93294C14.3246 6.39968 14.0206 6.79788 13.6037 7.04166L13.5041 7.10221L13.497 7.10611C13.3698 7.17953 13.2641 7.28544 13.191 7.41275C13.1178 7.54007 13.0797 7.68453 13.0803 7.83137V8.16861C13.0797 8.31546 13.1178 8.45992 13.191 8.58723C13.2634 8.71324 13.3676 8.81795 13.4931 8.89127L13.5822 8.9388L13.5972 8.94726C14.0174 9.19063 14.3239 9.59085 14.4494 10.0599C14.5745 10.5275 14.5092 11.0255 14.2684 11.4453L14.1226 11.7057L14.1194 11.7109L14.1187 11.7103C13.8753 12.1304 13.4758 12.437 13.0067 12.5625C12.5429 12.6865 12.0494 12.6233 11.6317 12.3874L11.5315 12.3346C11.5266 12.332 11.5219 12.3289 11.5171 12.3262C11.3905 12.2531 11.2467 12.2149 11.1005 12.2148C10.9543 12.2148 10.8104 12.2531 10.6838 12.3262L10.398 12.4922L10.3967 12.4928C10.2702 12.5659 10.1651 12.6711 10.092 12.7975C10.0189 12.924 9.98024 13.0675 9.98003 13.2135V13.3333C9.98003 13.8196 9.78674 14.2857 9.44293 14.6296C9.09912 14.9733 8.63289 15.1667 8.1467 15.1667H7.85373C7.36754 15.1667 6.90132 14.9733 6.55751 14.6296C6.21369 14.2857 6.0204 13.8196 6.0204 13.3333V13.2135C6.0202 13.0675 5.9815 12.924 5.90842 12.7975C5.8353 12.6711 5.73024 12.5659 5.60373 12.4928L5.60243 12.4922L5.31662 12.3262C5.19001 12.2531 5.04613 12.2148 4.89996 12.2148C4.75377 12.2149 4.6099 12.2531 4.48329 12.3262C4.47849 12.3289 4.47386 12.332 4.46897 12.3346L4.36871 12.388L4.36806 12.3874C3.95048 12.6231 3.45738 12.6865 2.99371 12.5625C2.52457 12.437 2.12448 12.1305 1.88108 11.7103L1.73394 11.457C1.4913 11.0364 1.42559 10.5362 1.551 10.0671C1.67578 9.60038 1.97926 9.20146 2.39605 8.95768L2.49631 8.89778L2.50347 8.89387C2.63064 8.82046 2.73629 8.71454 2.80946 8.58723C2.88263 8.45992 2.92072 8.31546 2.92014 8.16861V7.82942C2.91922 7.68416 2.88049 7.54162 2.80751 7.41601C2.73442 7.2903 2.6294 7.18599 2.50347 7.11328C2.49417 7.10791 2.48506 7.10165 2.47613 7.0957L2.37652 7.02929C1.97024 6.78453 1.67373 6.39194 1.551 5.93294C1.42559 5.4638 1.4913 4.96426 1.73394 4.54361L1.88108 4.28971C2.12448 3.86948 2.52457 3.56297 2.99371 3.43749C3.45728 3.31354 3.95054 3.37638 4.36806 3.61197L4.46897 3.66536L4.48329 3.67382C4.6099 3.74692 4.75377 3.78511 4.89996 3.78515C5.04613 3.78515 5.19001 3.74686 5.31662 3.67382L5.60243 3.50781L5.60373 3.50716C5.73024 3.4341 5.8353 3.32893 5.90842 3.20247C5.96325 3.10761 5.99889 3.00309 6.01324 2.89518L6.0204 2.78645V2.66666C6.0204 2.18043 6.21369 1.71425 6.55751 1.37044C6.90132 1.02668 7.36754 0.833328 7.85373 0.833328H8.1467C8.63289 0.833328 9.09912 1.02668 9.44293 1.37044C9.78674 1.71425 9.98003 2.18043 9.98003 2.66666V2.78645Z" fill="currentColor" />
            <path d="M9.50022 7.99999C9.50022 7.17157 8.82864 6.49999 8.00022 6.49999C7.17179 6.49999 6.50022 7.17157 6.50022 7.99999C6.50022 8.82842 7.17179 9.49999 8.00022 9.49999C8.82864 9.49999 9.50022 8.82842 9.50022 7.99999ZM10.5002 7.99999C10.5002 9.38071 9.38093 10.5 8.00022 10.5C6.61951 10.5 5.50022 9.38071 5.50022 7.99999C5.50022 6.61928 6.61951 5.49999 8.00022 5.49999C9.38093 5.49999 10.5002 6.61928 10.5002 7.99999Z" fill="currentColor" />
          </svg>
          <span className="sr-only">表示する項目</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[240px] p-0.5">
        {/* Tabs header */}
        <div className="flex flex-col py-3">
          <div className="flex items-center gap-6 px-2.5">
            <button
              type="button"
              className={`flex flex-col items-center gap-3 text-xs font-medium leading-4 ${
                activeTab === "columns"
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
              onClick={() => setActiveTab("columns")}
            >
              <span>表示する項目</span>
              {activeTab === "columns" && (
                <div className="h-0.5 w-full rounded-full bg-foreground" />
              )}
            </button>
            {hasFilterTab && (
              <button
                type="button"
                className={`flex flex-col items-center gap-3 text-xs font-medium leading-4 ${
                  activeTab === "filters"
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}
                onClick={() => setActiveTab("filters")}
              >
                <span>表示するフィルター</span>
                {activeTab === "filters" && (
                  <div className="h-0.5 w-full rounded-full bg-foreground" />
                )}
              </button>
            )}
          </div>
          <div className="h-px w-full bg-border" />
        </div>

        {/* Columns tab content */}
        {activeTab === "columns" && (
          <div className="flex flex-col pb-1">
            {columns.map((column) => (
              <label
                key={column.id}
                className="flex min-h-8 cursor-pointer items-center gap-2 rounded-md px-2 py-[5.5px] hover:bg-accent"
              >
                <div className="flex items-center gap-1 p-0.5">
                  <GripVertical className="size-6 text-muted-foreground/50" />
                  <Checkbox
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  />
                </div>
                <span className="text-sm leading-5">
                  {getColumnLabel(column)}
                </span>
              </label>
            ))}
          </div>
        )}

        {/* Filters tab content */}
        {activeTab === "filters" && hasFilterTab && (
          <div className="flex flex-col pb-1">
            <div className="flex min-h-8 items-center px-2 py-[5.5px]">
              <p className="text-xs leading-4 text-muted-foreground">
                最大{maxFilters}件まで選択可能です
              </p>
            </div>
            {filterOptions.map((option) => {
              const isChecked = visibleFilters.includes(option.id)
              const isDisabled = !isChecked && visibleFilters.length >= maxFilters
              return (
                <label
                  key={option.id}
                  className={`flex min-h-8 items-center gap-2 rounded-md px-2 py-[5.5px] ${
                    isDisabled
                      ? "cursor-not-allowed opacity-50"
                      : "cursor-pointer hover:bg-accent"
                  }`}
                >
                  <div className="flex items-center gap-1 p-0.5">
                    <GripVertical className="size-6 text-muted-foreground/50" />
                    <Checkbox
                      checked={isChecked}
                      disabled={isDisabled}
                      onCheckedChange={() => toggleFilter(option.id)}
                    />
                  </div>
                  <span className="text-sm leading-5">
                    {option.label}
                  </span>
                </label>
              )
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

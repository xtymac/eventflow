# Calendar Date Range Filters Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add working calendar date-range pickers for 開園年度, 設置年月日, and 計画決定日 in the park 詳細検索 modal.

**Architecture:** Japanese era strings (S12, S12.03.28) are parsed to Gregorian via a shared utility. Precomputed Gregorian fields are derived once via useMemo. The existing DatePickerInput component is reused for 6 from/to controls. Filter logic uses inclusive bounds with year-only comparison for 開園年度 and date-only comparison for the other two.

**Tech Stack:** React, TypeScript, react-day-picker (already installed), date-fns (already installed), existing DatePickerInput component, ShadCN Popover.

**Design doc:** `docs/plans/2026-02-24-calendar-date-range-filters-design.md`

---

### Task 1: Create Japanese Era Date Parser

**Files:**
- Create: `frontend/src/utils/japaneseEraDate.ts`

**Step 1: Write the parser utility**

```ts
// frontend/src/utils/japaneseEraDate.ts

const ERA_OFFSETS: Record<string, number> = {
  M: 1867,
  T: 1911,
  S: 1925,
  H: 1988,
  R: 2018,
};

/**
 * Parse a Japanese era date string into a Gregorian year and optional Date.
 *
 * Accepted formats:
 *   "S12"        → { year: 1937, date: null }
 *   "S12.03.28"  → { year: 1937, date: Date(1937-03-28T00:00:00Z) }
 *   "S元"        → { year: 1926, date: null }
 *   "S元.12.25"  → { year: 1926, date: Date(1926-12-25T00:00:00Z) }
 *
 * Returns { year: NaN, date: null } for unparseable input.
 */
export function parseJapaneseEraDate(s: string): { year: number; date: Date | null } {
  const INVALID = { year: NaN, date: null };
  if (!s || typeof s !== 'string') return INVALID;

  const trimmed = s.trim().toUpperCase();

  // Match: era letter + (digits or 元) + optional .MM.DD
  const match = trimmed.match(/^([MTSHR])(\d+|元)(?:\.(\d{1,2})\.(\d{1,2}))?$/);
  if (!match) return INVALID;

  const eraLetter = match[1];
  const offset = ERA_OFFSETS[eraLetter];
  if (offset === undefined) return INVALID;

  const eraYear = match[2] === '元' ? 1 : parseInt(match[2], 10);
  if (isNaN(eraYear) || eraYear < 1) return INVALID;

  const gregorianYear = offset + eraYear;

  const monthStr = match[3];
  const dayStr = match[4];

  if (monthStr && dayStr) {
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return INVALID;
    // UTC midnight to avoid timezone drift
    const date = new Date(Date.UTC(gregorianYear, month - 1, day));
    // Validate the date didn't roll over (e.g. Feb 30 → Mar 2)
    if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return INVALID;
    return { year: gregorianYear, date };
  }

  return { year: gregorianYear, date: null };
}

/** Normalize a Date to UTC midnight for date-only comparison. */
export function toUTCMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}
```

**Step 2: Verify no TypeScript errors**

Run: `cd "/Users/mac/Business Dropbox/Dropbox/Project/Eukarya/Project/urban-infrastructure-dx-platform-system-demo/frontend" && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `japaneseEraDate.ts`

**Step 3: Commit**

```bash
git add frontend/src/utils/japaneseEraDate.ts
git commit -m "feat: add Japanese era date parser utility"
```

---

### Task 2: Add Date Filter State to ParkListPage

**Files:**
- Modify: `frontend/src/pages/parks/ParkListPage.tsx`

**Step 1: Add import for DatePickerInput and parser**

At the top of ParkListPage.tsx (after the existing imports around line 48), add:

```ts
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { parseJapaneseEraDate, toUTCMidnight } from '@/utils/japaneseEraDate';
```

**Step 2: Add committed filter state variables**

After line 349 (`const [plannedAreaHaFilter, setPlannedAreaHaFilter] = useState('');`), add:

```ts
const [openingYearFromFilter, setOpeningYearFromFilter] = useState<Date | null>(null);
const [openingYearToFilter, setOpeningYearToFilter] = useState<Date | null>(null);
const [establishedDateFromFilter, setEstablishedDateFromFilter] = useState<Date | null>(null);
const [establishedDateToFilter, setEstablishedDateToFilter] = useState<Date | null>(null);
const [planDecisionDateFromFilter, setPlanDecisionDateFromFilter] = useState<Date | null>(null);
const [planDecisionDateToFilter, setPlanDecisionDateToFilter] = useState<Date | null>(null);
```

**Step 3: Add date fields to draft state**

Extend the draft useState (around line 352-364) to include 6 new fields:

```ts
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
  openingYearFrom: null as Date | null,
  openingYearTo: null as Date | null,
  establishedDateFrom: null as Date | null,
  establishedDateTo: null as Date | null,
  planDecisionDateFrom: null as Date | null,
  planDecisionDateTo: null as Date | null,
});
```

**Step 4: Wire date fields into openAdvancedSearch**

In the `openAdvancedSearch` function (around line 366-381), add the 6 date fields:

```ts
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
    openingYearFrom: openingYearFromFilter,
    openingYearTo: openingYearToFilter,
    establishedDateFrom: establishedDateFromFilter,
    establishedDateTo: establishedDateToFilter,
    planDecisionDateFrom: planDecisionDateFromFilter,
    planDecisionDateTo: planDecisionDateToFilter,
  });
  setAdvancedSearchOpen(true);
}
```

**Step 5: Wire date fields into applyAdvancedSearch with auto-swap**

In the `applyAdvancedSearch` function (around line 383-396), add the date fields with auto-swap logic:

```ts
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

  // Auto-swap if from > to
  let oyFrom = draft.openingYearFrom;
  let oyTo = draft.openingYearTo;
  if (oyFrom && oyTo && oyFrom > oyTo) [oyFrom, oyTo] = [oyTo, oyFrom];
  setOpeningYearFromFilter(oyFrom);
  setOpeningYearToFilter(oyTo);

  let edFrom = draft.establishedDateFrom;
  let edTo = draft.establishedDateTo;
  if (edFrom && edTo && edFrom > edTo) [edFrom, edTo] = [edTo, edFrom];
  setEstablishedDateFromFilter(edFrom);
  setEstablishedDateToFilter(edTo);

  let pdFrom = draft.planDecisionDateFrom;
  let pdTo = draft.planDecisionDateTo;
  if (pdFrom && pdTo && pdFrom > pdTo) [pdFrom, pdTo] = [pdTo, pdFrom];
  setPlanDecisionDateFromFilter(pdFrom);
  setPlanDecisionDateToFilter(pdTo);

  setAdvancedSearchOpen(false);
}
```

**Step 6: Wire date fields into clearDraft**

In the `clearDraft` function (around line 398-412), add the 6 null resets:

```ts
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
    openingYearFrom: null,
    openingYearTo: null,
    establishedDateFrom: null,
    establishedDateTo: null,
    planDecisionDateFrom: null,
    planDecisionDateTo: null,
  });
}
```

**Step 7: Update hasFilters**

In the `hasFilters` const (around line 414-417), add date filter checks:

```ts
const hasFilters =
  !!wardFilter || !!categoryFilter || !!acquisitionFilter || globalFilter !== '' ||
  !!schoolDistrictFilter || !!managementOfficeFilter || !!paidFacilityFilter ||
  !!disasterFacilityFilter || !!areaHaFilter || !!planNumberFilter || !!plannedAreaHaFilter ||
  !!openingYearFromFilter || !!openingYearToFilter ||
  !!establishedDateFromFilter || !!establishedDateToFilter ||
  !!planDecisionDateFromFilter || !!planDecisionDateToFilter;
```

**Step 8: Verify no TypeScript errors**

Run: `cd "/Users/mac/Business Dropbox/Dropbox/Project/Eukarya/Project/urban-infrastructure-dx-platform-system-demo/frontend" && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new errors

**Step 9: Commit**

```bash
git add frontend/src/pages/parks/ParkListPage.tsx
git commit -m "feat: add date range filter state to park advanced search"
```

---

### Task 3: Add Precomputed Gregorian Fields and Filter Logic

**Files:**
- Modify: `frontend/src/pages/parks/ParkListPage.tsx`

**Step 1: Add precomputed Gregorian fields via useMemo**

Before the `filteredData` useMemo (around line 419), add:

```ts
// Precompute Gregorian dates from Japanese era strings once
const parksWithDates = useMemo(() => {
  return sortedData.map((p) => {
    const oy = parseJapaneseEraDate(p.openingYear);
    const ed = parseJapaneseEraDate(p.establishedDate);
    const pd = parseJapaneseEraDate(p.planDecisionDate);
    return {
      ...p,
      _openingGregorianYear: isNaN(oy.year) ? null : oy.year,
      _establishedGregorianDate: ed.date,
      _planDecisionGregorianDate: pd.date,
    };
  });
}, [sortedData]);
```

**Step 2: Update filteredData to use parksWithDates and add date filters**

Replace `sortedData.filter` with `parksWithDates.filter` and add date comparison logic at the end of the filter callback, before `return true`:

```ts
const filteredData = useMemo(() => {
  return parksWithDates.filter((p) => {
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

    // Opening year: compare integer years (inclusive bounds)
    if (openingYearFromFilter || openingYearToFilter) {
      const gy = p._openingGregorianYear;
      if (gy != null) {
        if (openingYearFromFilter && gy < openingYearFromFilter.getFullYear()) return false;
        if (openingYearToFilter && gy > openingYearToFilter.getFullYear()) return false;
      }
      // If gy is null (unparseable), pass through — don't exclude
    }

    // Established date: compare date-only (inclusive bounds, UTC midnight)
    if (establishedDateFromFilter || establishedDateToFilter) {
      const ed = p._establishedGregorianDate;
      if (ed != null) {
        if (establishedDateFromFilter && ed < toUTCMidnight(establishedDateFromFilter)) return false;
        if (establishedDateToFilter && ed > toUTCMidnight(establishedDateToFilter)) return false;
      }
    }

    // Plan decision date: compare date-only (inclusive bounds, UTC midnight)
    if (planDecisionDateFromFilter || planDecisionDateToFilter) {
      const pd = p._planDecisionGregorianDate;
      if (pd != null) {
        if (planDecisionDateFromFilter && pd < toUTCMidnight(planDecisionDateFromFilter)) return false;
        if (planDecisionDateToFilter && pd > toUTCMidnight(planDecisionDateToFilter)) return false;
      }
    }

    return true;
  });
}, [parksWithDates, wardFilter, categoryFilter, acquisitionFilter, schoolDistrictFilter, managementOfficeFilter, paidFacilityFilter, disasterFacilityFilter, areaHaFilter, planNumberFilter, plannedAreaHaFilter, openingYearFromFilter, openingYearToFilter, establishedDateFromFilter, establishedDateToFilter, planDecisionDateFromFilter, planDecisionDateToFilter]);
```

**Step 3: Verify no TypeScript errors**

Run: `cd "/Users/mac/Business Dropbox/Dropbox/Project/Eukarya/Project/urban-infrastructure-dx-platform-system-demo/frontend" && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new errors

**Step 4: Commit**

```bash
git add frontend/src/pages/parks/ParkListPage.tsx
git commit -m "feat: add precomputed Gregorian fields and date range filter logic"
```

---

### Task 4: Replace Placeholder Inputs with DatePickerInput Controls

**Files:**
- Modify: `frontend/src/pages/parks/ParkListPage.tsx`

**Step 1: Replace 開園年度 placeholder (around lines 932-939)**

Replace the current static `<Input>` + `<CalendarIcon>` block with a from/to DatePickerInput pair:

```tsx
<div>
  <label className={modalLabelCls}>開園年度</label>
  <div className="mt-1 flex items-center gap-1">
    <DatePickerInput
      placeholder="開始"
      value={draft.openingYearFrom}
      onChange={(d) => setDraft((prev) => ({ ...prev, openingYearFrom: d }))}
      clearable
      popoverProps={{ zIndex: 100 }}
    />
    <span className="shrink-0 text-xs text-[#737373]">〜</span>
    <DatePickerInput
      placeholder="終了"
      value={draft.openingYearTo}
      onChange={(d) => setDraft((prev) => ({ ...prev, openingYearTo: d }))}
      clearable
      popoverProps={{ zIndex: 100 }}
    />
  </div>
</div>
```

**Step 2: Replace 設置年月日 placeholder (around lines 941-948)**

Same pattern:

```tsx
<div>
  <label className={modalLabelCls}>設置年月日</label>
  <div className="mt-1 flex items-center gap-1">
    <DatePickerInput
      placeholder="開始"
      value={draft.establishedDateFrom}
      onChange={(d) => setDraft((prev) => ({ ...prev, establishedDateFrom: d }))}
      clearable
      popoverProps={{ zIndex: 100 }}
    />
    <span className="shrink-0 text-xs text-[#737373]">〜</span>
    <DatePickerInput
      placeholder="終了"
      value={draft.establishedDateTo}
      onChange={(d) => setDraft((prev) => ({ ...prev, establishedDateTo: d }))}
      clearable
      popoverProps={{ zIndex: 100 }}
    />
  </div>
</div>
```

**Step 3: Replace 計画決定日 placeholder (around lines 974-981)**

Same pattern:

```tsx
<div>
  <label className={modalLabelCls}>計画決定日</label>
  <div className="mt-1 flex items-center gap-1">
    <DatePickerInput
      placeholder="開始"
      value={draft.planDecisionDateFrom}
      onChange={(d) => setDraft((prev) => ({ ...prev, planDecisionDateFrom: d }))}
      clearable
      popoverProps={{ zIndex: 100 }}
    />
    <span className="shrink-0 text-xs text-[#737373]">〜</span>
    <DatePickerInput
      placeholder="終了"
      value={draft.planDecisionDateTo}
      onChange={(d) => setDraft((prev) => ({ ...prev, planDecisionDateTo: d }))}
      clearable
      popoverProps={{ zIndex: 100 }}
    />
  </div>
</div>
```

**Step 4: Remove unused CalendarIcon import if no longer used elsewhere in ParkListPage**

Check if `CalendarIcon` is still used after replacing the 3 date placeholders. If not, remove it from the lucide-react import on line 10.

**Step 5: Verify no TypeScript errors and the app compiles**

Run: `cd "/Users/mac/Business Dropbox/Dropbox/Project/Eukarya/Project/urban-infrastructure-dx-platform-system-demo/frontend" && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

**Step 6: Manual smoke test**

Run: `cd "/Users/mac/Business Dropbox/Dropbox/Project/Eukarya/Project/urban-infrastructure-dx-platform-system-demo/frontend" && npm run dev`

Verify:
1. Open park list page → click 詳細検索
2. 開園年度 row shows two date pickers with 〜 between them
3. 設置年月日 row shows two date pickers with 〜 between them
4. 計画決定日 row shows two date pickers with 〜 between them
5. Calendar popovers open above the modal (z-index works)
6. Selecting a date range and clicking 適用 filters the park list
7. クリア resets all date pickers to empty
8. Selecting from > to auto-swaps on apply

**Step 7: Commit**

```bash
git add frontend/src/pages/parks/ParkListPage.tsx
git commit -m "feat: replace date placeholders with DatePickerInput range controls"
```

---

### Task 5: Verify Popover Portal Rendering

**Files:**
- Possibly modify: `frontend/src/components/ui/date-picker-input.tsx`

**Step 1: Test calendar popover in the modal**

Open the 詳細検索 modal and click a date picker. Verify the calendar popover:
- Appears above/below the trigger (not clipped by the modal)
- Is clickable (not blocked by dialog overlay)
- Closes when a date is selected

**Step 2: If popover is clipped or blocked, add portal prop**

If the popover is clipped by the dialog's `overflow: hidden` or blocked by the overlay, modify `DatePickerInput` to use ShadCN's `PopoverPortal`:

In `date-picker-input.tsx`, import `PopoverPortal` from `@/components/ui/popover` and wrap `PopoverContent`:

```tsx
<PopoverPortal>
  <PopoverContent
    className="w-auto p-0"
    align="start"
    style={popoverProps?.zIndex ? { zIndex: popoverProps.zIndex } : undefined}
  >
    <DayPicker ... />
  </PopoverContent>
</PopoverPortal>
```

Note: Only make this change if Step 1 reveals an issue. The ShadCN Popover may already use a portal by default (Radix does).

**Step 3: Commit if changes were needed**

```bash
git add frontend/src/components/ui/date-picker-input.tsx
git commit -m "fix: use portal for date picker popover in modal context"
```

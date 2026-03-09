# Calendar Date Range Filters for Park Advanced Search

## Problem

The 詳細検索 modal in ParkListPage has three date fields (開園年度, 設置年月日, 計画決定日) that are currently non-functional placeholder inputs with calendar icons. They need working calendar pickers with date range filtering.

## Data Format

Park data uses Japanese era abbreviations with two patterns:

- **Year-only**: `openingYear` — `S12`, `T12`, `M42`, `H1`
- **Full date**: `establishedDate`, `planDecisionDate` — `S12.03.28`, `T12.10.01`

Era offsets (era year + offset = Gregorian year):

| Era | Kanji | Offset | Example |
|-----|-------|--------|---------|
| M   | 明治   | 1867   | M42 → 1909 |
| T   | 大正   | 1911   | T12 → 1923 |
| S   | 昭和   | 1925   | S12 → 1937 |
| H   | 平成   | 1988   | H1 → 1989  |
| R   | 令和   | 2018   | R1 → 2019  |

## Design

### Parser Utility

Create `parseJapaneseEraDate(s: string): { year: number; date: Date | null }` in a shared utility:

- Extract era letter + year number + optional month/day
- Support `元` as year 1
- Return `{ year, date }` where `date` is null for year-only strings
- Return `{ year: NaN, date: null }` for unparseable input
- Normalize dates to midnight UTC to avoid timezone drift

### Precomputed Fields

Compute Gregorian-derived fields once on the `curatedParks` array (or via a memoized transform), not on every filter run:

```ts
type ParkWithDerivedDates = CuratedPark & {
  _openingGregorianYear: number | null;
  _establishedGregorianDate: Date | null;
  _planDecisionGregorianDate: Date | null;
};
```

### UI Changes

Each date field becomes a from/to pair using the existing `DatePickerInput` component:

```
開園年度
[from 📅]  〜  [to 📅]

設置年月日
[from 📅]  〜  [to 📅]

計画決定日
[from 📅]  〜  [to 📅]
```

Each pair spans a full grid column. The `〜` separator sits between the two pickers. Popover renders via portal with high z-index to escape the modal stacking context.

### Draft State

Add 6 new fields to the draft object:

```ts
openingYearFrom: Date | null
openingYearTo: Date | null
establishedDateFrom: Date | null
establishedDateTo: Date | null
planDecisionDateFrom: Date | null
planDecisionDateTo: Date | null
```

Plus 6 corresponding committed filter state variables.

### Filter Logic

- **Inclusive bounds**: `>= from` and `<= to`
- **openingYear**: compare integer Gregorian years (not full Date objects)
- **establishedDate / planDecisionDate**: compare date-only (normalized to midnight UTC)
- **Auto-swap invalid ranges**: if from > to, swap them at apply time
- **Null handling**: if a park's date is unparseable, it passes through (not excluded)

### Files to Modify

1. **New**: `frontend/src/utils/japaneseEraDate.ts` — parser utility
2. **Modify**: `frontend/src/pages/parks/ParkListPage.tsx` — state, UI, filter logic

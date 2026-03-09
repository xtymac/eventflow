# Repair Detail Page Design

## Overview

Add a `RepairCaseDetailView` component to handle repair-type cases (`type === 'repair'`) in the case detail page, following the existing `InspectionCaseDetailView` pattern.

## Data Mapping

**One-to-one matching via `repairRef`:**
- Add optional `repairRef: string` field to `DummyCase` for repair-type cases
- `repairRef` links to `DummyRepair.id` (e.g., `'REP-014'`)
- Lookup: `DUMMY_REPAIRS.find(r => r.id === caseData.repairRef)`
- This avoids ambiguity from facility-based lookups where one facility has multiple repairs

**Terminology (strict):**
- `facilityRef` = internal reference ID (e.g., `PF-demo-011`) — used for data joins
- `facilityId` = display ID (e.g., `05-780`) — shown in UI
- `DummyRepair.facilityId` field actually stores facility refs (PF-demo-xxx)

## UI Layout (Figma-matched)

### Action Bar — State-dependent behavior

| Case Status | Banner | Buttons |
|-------------|--------|---------|
| `pending` | Info message about confirm/reject | 差戻し (red) + 確認 (green) |
| `returned` | Info message about re-confirmation | 確認 (green) only |
| `confirmed` | Hidden entirely | — |

### Confirmation Flow

Use existing `useConfirmDialog()` from `confirm-dialog.tsx` (already provided by `ConfirmDialogProvider` in `main.tsx`). No inline popover.

### Left Panel — 3 sections

1. **対象施設**: Status badge, case ID (formatted as `{YYYYMMDD}:{seqno}`), 最終状態変更日, 公園名称 (link → `/assets/parks/:parkRef`), 施設 (link → `/assets/facilities/:facilityRef`)
2. **補修実施・契約情報**: 補修年月日 (from repair.date), 補修業者 (repair.vendor), 設計書番号 (repair.designDocNumber)
3. **補修内容・詳細**: 補修内容 (repair.type/description), 主な交換部材 (repair.mainReplacementParts), 補修備考 (repair.repairNotes)

### Right Panel

- Photo carousel (placeholder — no photos in dummy data)
- MiniMap (park geometry with facility marker at centroid)

## E2E Tests

Lock to case **12357** (pending repair, 名城公園, テーブル 05-780).

Tests:
1. Repair detail page renders with correct breadcrumb
2. All 3 info sections visible with correct headings
3. Action bar shows 差戻し + 確認 for pending case
4. Park/facility links are clickable
5. Breadcrumb navigates back to case list
6. Confirmation dialog appears on 確認 click

## Files

| File | Action |
|------|--------|
| `frontend/src/data/dummyCases.ts` | Add optional `repairRef` to `DummyCase`, populate for repair cases |
| `frontend/src/pages/cases/CaseDetailPage.tsx` | Add `RepairCaseDetailView`, update dispatcher |
| `tests/repair-detail.spec.ts` | New e2e test file |

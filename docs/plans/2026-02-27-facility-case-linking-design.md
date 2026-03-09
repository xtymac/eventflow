# Facility ↔ Case Bidirectional Linking

## Goal

Connect inspection history (点検履歴) and repair history (補修履歴) in Facility detail to the Case Management module, enabling bidirectional navigation with the case module as single source of truth for workflow status.

## Data Model Changes

### 1. DummyInspection: add `eventId`

Aligns with `InspectionRecord.eventId` in `shared/types/index.ts`. In the dummy data layer, this maps to `DummyCase.id` for navigation to `/cases/:id`.

```typescript
export interface DummyInspection {
  // ... existing fields ...
  eventId?: string;  // In dummy data: String(DummyCase.id). Navigate to /cases/:eventId.
}
```

Populate for inspections that correspond to inspection-type cases (matched by facilityId + case type).

### 2. DummyRepair: remove `status`

`DummyRepair.status` duplicates case-side state. Remove it. At render time, derive status from the linked case via `caseId` → `getCaseById(caseId)?.status`.

### 3. DummyRepair.caseId: normalize to case route targets

Current data has `EVT-demo-*` values that don't resolve to `DummyCase` routes. Normalize these to either:
- Point to actual numeric `DummyCase.id` values, OR
- Leave as-is for API-backed cases (EventCaseDetailView handles these)

For demo consistency, repairs that should link to DummyCase entries get numeric IDs; others keep `EVT-demo-*` for API fallback.

### 4. Fix case 23563 park mismatch

Case 23563 references `parkName: '東山公園'` but inspection 23563 belongs to `PF-demo-011` which is in 名城公園. Fix the case data to say 名城公園 with parkRef `GS-nliigh01`.

### 5. Lookup helpers in dummyCases.ts

```typescript
export function getCasesByFacility(facilityRef: string): DummyCase[]
export function getCaseById(id: number | string): DummyCase | undefined
```

`getCaseById` compares `String(c.id) === String(id)`.

## UI Changes in FacilityDetailPage

### Inspection history table

Arrow action: if `insp.eventId` exists and maps to a DummyCase → navigate to `/cases/:eventId`. Otherwise fall back to existing `/inspections/:id`.

### Repair history table

- Add **案件状態** badge column: looked up via `getCaseById(rep.caseId)?.status`, rendered as `InspectionStatusPill`.
- Arrow already navigates to `/cases/:caseId` — no change needed there.
- Repairs without a valid case link show disabled arrow and no status badge (same as current).

Both tables remain read-only linked records. No status mutation from facility side.

## Files

| File | Change |
|------|--------|
| `frontend/src/data/dummyInspections.ts` | Add optional `eventId`, populate for linked inspections |
| `frontend/src/data/dummyRepairs.ts` | Remove `status` from interface + all records |
| `frontend/src/data/dummyCases.ts` | Fix case 23563 parkRef/parkName; add helper functions |
| `frontend/src/pages/facilities/FacilityDetailPage.tsx` | Inspection arrow → case; repair status badge from case |
| `tests/facility-detail.spec.ts` | Update assertions for new arrow behavior and status column |

# PoC Design Document: Same-DB Multi-Table Validation

> Asset / Event / Park / Decision / Audit — single PostgreSQL database

## 1. Background

EventFlow manages 8 asset types, construction events, work orders, and evidence in a single PostgreSQL + PostGIS database (25 tables). Two capabilities are missing:

- **Decision tracking** — currently embedded in `evidence.review_status` + `decision_by/at/notes` fields, and `construction_events.closedBy/closedAt`. No standalone decision records.
- **Unified audit logging** — fragmented across `road_asset_edit_logs`, `osm_sync_logs`, and `nagoya_sync_logs`. No "who did what to what, when" trail.

Additionally, **no transactions** wrap multi-step operations, and **no permission model** enforces role-based access beyond placeholder header checks.

This PoC validates whether the single-database approach can support these additions with acceptable latency, consistency, and access control.

## 2. New Tables

### 2.1 `decisions`

Standalone decision records, extracted from embedded fields.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | varchar(50) PK | NO | `DEC-{nanoid}` |
| entity_type | varchar(30) | NO | `event` \| `evidence` \| `work_order` \| `asset_condition` \| `inspection` |
| entity_id | varchar(50) | NO | Polymorphic ref to the decided entity |
| decision_type | varchar(50) | NO | `event_close` \| `evidence_accept` \| `evidence_reject` \| `condition_change` |
| outcome | varchar(30) | NO | `approved` \| `rejected` \| `deferred` \| `escalated` |
| rationale | text | YES | Free-text justification |
| conditions | text | YES | Conditions attached to approval |
| previous_status | varchar(30) | YES | Status before decision |
| new_status | varchar(30) | YES | Status after decision |
| decided_by | varchar(100) | NO | User/role identifier |
| decided_by_role | varchar(30) | NO | Role at time of decision |
| decided_at | timestamptz | NO | Default `now()` |
| created_at | timestamptz | NO | Default `now()` |
| updated_at | timestamptz | NO | Default `now()` |

**Indexes:** `(entity_type, entity_id)`, `entity_id`, `decision_type`, `outcome`, `decided_by`, `decided_at`

### 2.2 `audit_logs`

Unified, append-only audit trail.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | varchar(50) PK | NO | `AUD-{nanoid}` |
| entity_type | varchar(30) | NO | Any entity type |
| entity_id | varchar(50) | NO | Polymorphic ref |
| action | varchar(30) | NO | `create` \| `update` \| `status_change` \| `close` \| `decision` |
| description | text | YES | Human-readable summary |
| before_snapshot | jsonb | YES | State before (null for `create`) |
| after_snapshot | jsonb | YES | State after (null for `delete`) |
| changed_fields | jsonb | YES | `["status", "closedBy"]` |
| actor | varchar(100) | NO | Who |
| actor_role | varchar(30) | YES | Role at time |
| actor_partner_id | varchar(50) | YES | Partner ID if applicable |
| ip_address | varchar(45) | YES | IPv4/IPv6 |
| request_id | varchar(50) | YES | Correlation ID |
| decision_id | varchar(50) | YES | FK to decisions.id |
| created_at | timestamptz | NO | Default `now()` |

**Indexes:** `(entity_type, entity_id)`, `entity_id`, `action`, `actor`, `created_at`, `decision_id`, `(entity_type, created_at DESC)`

## 3. Benchmark Queries (12)

| # | Query | Join Depth | Threshold (p95) |
|---|-------|------------|-----------------|
| Q1 | Asset PK lookup + geometry | 0 | ≤ 5ms |
| Q2 | Event list with status filter + sort | 0 | ≤ 200ms |
| Q3 | Event detail + road assets | 2 joins | ≤ 20ms |
| Q4 | Event + WO + evidence count | 2 joins + GROUP BY | ≤ 50ms |
| Q5 | Full chain: Event → WO → Evidence → Decision | 3 joins | ≤ 100ms |
| Q6 | Spatial ST_DWithin | GIST | ≤ 200ms |
| Q7 | Inspection + decision (polymorphic) | 1 join | ≤ 50ms |
| Q8 | Audit trail with JSONB snapshots | 1 join | ≤ 100ms |
| Q9 | Dashboard aggregate | 3 LEFT JOINs + GROUP BY | ≤ 500ms |
| Q10 | Partner-filtered WO view | 3 joins + GROUP BY | ≤ 100ms |
| Q11 | Audit activity report (time range) | 0 + aggregate | ≤ 100ms |
| Q12 | Multi-asset spatial bbox (3 UNION ALL) | 0 × 3 GIST | ≤ 200ms |

## 4. Critical Transactions (3)

### TX1: Event Close

```
BEGIN REPEATABLE READ
  1. UPDATE construction_events SET status='closed' WHERE id=$1 AND status='pending_review'
  2. INSERT INTO decisions (event_close, approved)
  3. INSERT INTO audit_logs (close action)
COMMIT
```

### TX2: Evidence Accept

```
BEGIN REPEATABLE READ
  1. SELECT FROM evidence WHERE id=$1 AND review_status='approved' FOR UPDATE
  2. UPDATE evidence SET review_status='accepted_by_authority'
  3. INSERT INTO decisions (evidence_accept, approved)
  4. INSERT INTO audit_logs (decision action)
COMMIT
```

### TX3: WorkOrder Complete + Cascade

```
BEGIN
  1. UPDATE work_orders SET status='completed' WHERE id=$1 AND status='in_progress'
  2. SELECT COUNT(*) remaining WOs for same event
  3. IF remaining=0: UPDATE event SET status='pending_review'
  4. INSERT audit_logs for WO (and event if cascaded)
COMMIT
```

## 5. Permission Matrix

| Resource \ Role | gov_event_ops | gov_master_data | partner | public |
|----------------|:---:|:---:|:---:|:---:|
| Events: read | ✓ | ✓ | ✓ scoped | ✓ active-only |
| Events: write/close | ✓ | ✗ | ✗ | ✗ |
| Work Orders: read | ✓ | ✓ | ✓ scoped | ✗ |
| Work Orders: write | ✓ | ✗ | ✓ own-limited | ✗ |
| Evidence: read | ✓ | ✓ | ✓ own-WO | ✗ |
| Evidence: upload | ✓ | ✗ | ✓ assigned-WO | ✗ |
| Evidence: decide | ✓ | ✗ | ✗ | ✗ |
| Assets: read | ✓ | ✓ | ✓ | ✓ basic |
| Assets: write | ✗ | ✓ | ✗ | ✗ |
| Decisions: read | ✓ | ✓ | ✓ own-entity | ✗ |
| Decisions: create | ✓ event/ev | ✓ asset/insp | ✗ | ✗ |
| Audit Logs: read | ✓ | ✓ | ✓ own-actions | ✗ |

## 6. Acceptance Criteria

| Category | Metric | Threshold |
|----------|--------|-----------|
| Query latency | Core reads (Q1-Q8) p95 at 50K | ≤ 200ms |
| Query latency | Dashboard (Q9) p95 at 50K | ≤ 500ms |
| Query latency | Spatial (Q6, Q12) p95 at 50K | ≤ 200ms |
| Transaction | TX1-TX3 p95 | ≤ 100ms |
| Transaction | Partial commit rate | 0% |
| Transaction | Deadlock rate (10-concurrent) | < 0.1% |
| Permissions | Matrix coverage | 100% |
| Permissions | Unauthorized block rate | 100% |

### Go/No-Go

**GO** if all thresholds pass at 50K data tier.

**NO-GO** if any query p95 > 2× threshold, any partial commit, or any unauthorized access.

## 7. Data Tiers

| Tier | Assets | Events | WOs | Evidence | Decisions | Audits | Total |
|------|--------|--------|-----|----------|-----------|--------|-------|
| 1x | 500 | 100 | 200 | 300 | 200 | 500 | ~2.3K |
| 10x | 5K | 1K | 2K | 3K | 2K | 5K | ~23K |
| 50x | 25K | 5K | 10K | 15K | 10K | 25K | ~118K |

## 8. File Map

```
poc/
├── DESIGN.md                          ← This document
├── middleware/
│   ├── transaction-wrapper.ts         ← withTransaction() + retry
│   ├── audit-writer.ts               ← writeAuditLog() helper
│   └── permission-guard.ts           ← RBAC matrix + preHandler hook
├── routes/
│   ├── decisions.ts                   ← GET list/detail, POST create
│   └── audit-logs.ts                 ← GET list/detail, activity report
├── seed/
│   └── seed-poc.ts                   ← --scale 1|10|50, --clean
├── benchmark/
│   ├── runner.ts                     ← Query benchmark orchestrator
│   ├── queries.ts                    ← 12 query implementations
│   ├── transactions.ts               ← TX atomicity/concurrency/injection
│   ├── permissions.ts                ← HTTP permission matrix tests
│   └── reporter.ts                   ← Stats + console/JSON output
├── scripts/
│   ├── run-benchmark.sh              ← Full suite runner
│   └── run-permissions-test.sh       ← Permission test runner
└── reports/
    └── .gitkeep                      ← Generated reports go here

backend/
├── drizzle/
│   └── 0006_poc_decisions_audit.sql  ← Migration: 2 new tables
└── src/
    ├── db/schema.ts                  ← +decisions, +auditLogs defs
    └── index.ts                      ← Conditional PoC route registration
```

## 9. Running the PoC

```bash
# 1. Apply migration
psql $DATABASE_URL -f backend/drizzle/0006_poc_decisions_audit.sql

# 2. Seed data
npx tsx poc/seed/seed-poc.ts --scale 1

# 3. Start server with PoC routes
POC_ENABLED=true npx tsx backend/src/index.ts

# 4. Run query benchmarks
npx tsx poc/benchmark/runner.ts --output poc/reports/benchmark-local-1x.json

# 5. Run transaction tests
npx tsx poc/benchmark/transactions.ts

# 6. Run permission tests (server must be running)
npx tsx poc/benchmark/permissions.ts --verbose

# 7. Full suite
./poc/scripts/run-benchmark.sh

# 8. Clean up
npx tsx poc/seed/seed-poc.ts --clean
```

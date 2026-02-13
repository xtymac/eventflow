# MongoDB vs PostgreSQL Comparison Report

> Generated: 2026-02-09T04:25:46.961Z
> Data tier: 50x
> PG runs: 3, Mongo runs: 3

## Overall Verdict

| Metric | PostgreSQL | MongoDB |
|--------|-----------|---------|
| Threshold compliance | PASS | FAIL |
| Queries won | 10 | 0 |
| Ties | 2 | 2 |
| **Recommended** | **Winner** |  |

## Per-Query Comparison (median p95 across 3 runs)

| Query | Description | Threshold | PG p95 | Mongo p95 | Winner | Notes |
|-------|-------------|-----------|--------|-----------|--------|-------|
| Q1 | Asset PK lookup + geometry | 5ms | 0.2ms  | 0.9ms  | PG | PG 4.4x faster |
| Q2 | Event list + status filter + sort | 200ms | 1.9ms  | 3.0ms  | PG | PG 1.6x faster |
| Q3 | Event detail + road assets (2 joins) | 20ms | 0.3ms  | 0.7ms  | Tie | within 0.5ms |
| Q4 | Event + WO + evidence count (3 joins) | 50ms | 0.5ms  | 0.8ms  | Tie | within 0.5ms |
| Q5 | Full chain Event→WO→Evidence→Decision | 100ms | 0.5ms  | 1.0ms  | PG | PG 2.2x faster |
| Q6 | Spatial ST_DWithin (GIST) | 200ms | 1.0ms  | 17.0ms  | PG | PG 17.1x faster |
| Q7 | Inspection + decision (polymorphic) | 50ms | 0.3ms  | 0.8ms  | PG | PG 3.0x faster |
| Q8 | Audit trail + JSONB snapshots | 100ms | 0.3ms  | 0.9ms  | PG | PG 3.3x faster |
| Q9 | Dashboard aggregate (3 LEFT JOINs) | 500ms | 138.2ms  | 388.1ms  | PG | PG 2.8x faster |
| Q10 | Partner-filtered WO view | 100ms | 12.9ms  | 229.5ms FAIL | PG | Mongo FAIL (229.5ms > 100ms) |
| Q11 | Audit activity report (time range) | 100ms | 28.0ms  | 65.7ms  | PG | PG 2.3x faster |
| Q12 | Multi-asset spatial bbox (UNION ALL) | 200ms | 15.9ms  | 119.2ms  | PG | PG 7.5x faster |

## Category Analysis

### Simple Reads (Q1, Q2)
- **Q1** (Asset PK lookup + geometry): PG=0.2ms, Mongo=0.9ms → **PG**
- **Q2** (Event list + status filter + sort): PG=1.9ms, Mongo=3.0ms → **PG**

### Join-Heavy Reads (Q3-Q5, Q9-Q10)
- **Q3** (Event detail + road assets (2 joins)): PG=0.3ms, Mongo=0.7ms → **Tie**
- **Q4** (Event + WO + evidence count (3 joins)): PG=0.5ms, Mongo=0.8ms → **Tie**
- **Q5** (Full chain Event→WO→Evidence→Decision): PG=0.5ms, Mongo=1.0ms → **PG**
- **Q9** (Dashboard aggregate (3 LEFT JOINs)): PG=138.2ms, Mongo=388.1ms → **PG**
- **Q10** (Partner-filtered WO view): PG=12.9ms, Mongo=229.5ms → **PG**

### Spatial Queries (Q6, Q12)
- **Q6** (Spatial ST_DWithin (GIST)): PG=1.0ms, Mongo=17.0ms → **PG**
- **Q12** (Multi-asset spatial bbox (UNION ALL)): PG=15.9ms, Mongo=119.2ms → **PG**

### Polymorphic/Audit (Q7, Q8, Q11)
- **Q7** (Inspection + decision (polymorphic)): PG=0.3ms, Mongo=0.8ms → **PG**
- **Q8** (Audit trail + JSONB snapshots): PG=0.3ms, Mongo=0.9ms → **PG**
- **Q11** (Audit activity report (time range)): PG=28.0ms, Mongo=65.7ms → **PG**

## Recommendation

**PostgreSQL** wins 10/12 queries at the 50x data tier.

PostgreSQL's relational JOINs outperform MongoDB's \$lookup aggregation pipelines for the normalized data model used by EventFlow. The PostGIS GIST indexes also provide competitive spatial query performance.

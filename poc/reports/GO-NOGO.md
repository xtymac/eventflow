# Go/No-Go Recommendation

## Decision: **GO** — Continue with Same-DB Multi-Table Architecture

---

## Evaluation

| Criterion | Threshold | Result | Status |
|-----------|-----------|--------|--------|
| Core queries p95 at 50K (single-user) | ≤ 200ms | ≤ 1.7ms | **PASS** |
| Dashboard aggregate p95 at 50K | ≤ 500ms | 138ms | **PASS** |
| Spatial queries p95 at 50K | ≤ 200ms | 16ms | **PASS** |
| Transaction p95 | ≤ 100ms | 1.1ms | **PASS** |
| Partial commit rate | 0% | 0% | **PASS** |
| Concurrent conflict resolution | No duplicates | 5/5 correct | **PASS** |
| Failure injection rollback | Full rollback | Verified | **PASS** |
| Permission matrix coverage | 100% | 100% | **PASS** |
| Unauthorized block rate | 100% | 100% | **PASS** |
| 10-concurrent queries at 50K | All pass | 3 marginal | **CONDITIONAL** |

## Rationale

1. **Single-user performance is excellent.** All 12 queries under 2ms p95 except Q9 (138ms) and Q12 (16ms) — both well within thresholds. The 4-table join (Event→WO→Evidence→Decision) runs at 0.5ms. PostgreSQL handles this comfortably.

2. **Transactions are solid.** The `withTransaction()` + `FOR UPDATE` pattern provides correct atomicity, serialization conflict handling, and rollback. Zero partial commits across all tests.

3. **Permission model is clean and extensible.** The static RBAC matrix with `requirePermission()` preHandler hooks integrates cleanly with Fastify. Row-level scoping for partners works.

4. **10-concurrent marginal failures are solvable.** Three queries exceeded thresholds by small margins:
   - Q1 (PK lookup): Pool contention → increase connection pool size
   - Q9 (dashboard aggregate): 530ms vs 500ms → materialized view or summary cache
   - Q11 (audit time range): 175ms vs 100ms → BRIN index on `created_at`

## Optimization Roadmap (Post-PoC)

If adopting same-DB multi-table in production:

1. **Connection pool tuning**: Increase pg.Pool max connections from default 10 to 25-50
2. **BRIN index on audit_logs.created_at**: Better for append-only time-series than BTREE
3. **Dashboard summary table**: Pre-aggregate event status counts (triggered on status change)
4. **Audit log partitioning**: Monthly range partitioning on `created_at` when audit_logs exceeds 1M rows
5. **VACUUM/ANALYZE scheduling**: Ensure stats are fresh for the planner

## Split Trigger Conditions

Continue monitoring. Consider splitting only if:

| Trigger | Threshold |
|---------|-----------|
| Audit log volume | > 5M rows AND time-range queries > 500ms |
| Dashboard aggregate latency | > 1s p95 consistently |
| Transaction contention (deadlock rate) | > 1% under production load |
| Compliance requirement | Audit logs must be in separate isolated DB |

## Next Steps

1. Apply migration to EC2 production database
2. Run EC2 benchmarks (same scripts, `--env ec2`)
3. Integrate `withTransaction()` into existing event-close and evidence-accept routes
4. Add `writeAuditLog()` calls to key mutation endpoints
5. Remove `POC_ENABLED` gate once validated on EC2

# GIS Spatial Benchmark Report

> Generated: 2026-02-09T05:53:31.807Z
> Reports: 14 from poc/reports
> Tiers: L, M, S | Configs: A, B, C | Modes: single, concurrent, mixed

## 1. Decision Matrix (Config B: 2dsphere, Single-user)

| Query | Threshold | S | M | L | XL |
|-------|-----------|--------|--------|--------|--------|
| G1 | 50ms | PASS 1.7ms | PASS 2.6ms | PASS 2.3ms | - |
| G2 | 100ms | PASS 1.5ms | PASS 3.2ms | PASS 9.4ms | - |
| G3 | 200ms | PASS 1.6ms | PASS 2.6ms | PASS 4.0ms | - |
| G4 | 30ms | PASS 1.6ms | PASS 2.0ms | PASS 1.7ms | - |
| G5 | 100ms | PASS 2.8ms | PASS 23.7ms | PASS 83.5ms | - |
| G6 | 100ms | PASS 3.1ms | PASS 18.1ms | PASS 82.5ms | - |
| G7 | 200ms | PASS 2.0ms | PASS 7.5ms | PASS 17.0ms | - |
| G8 | 100ms | PASS 6.4ms | PASS 40.6ms | **FAIL** 161.2ms | - |
| G9 | 100ms | PASS 2.1ms | PASS 0.9ms | PASS 0.9ms | - |
| G10 | 50ms | PASS 3.1ms | PASS 8.4ms | PASS 21.4ms | - |
| G11 | 200ms | PASS 2.7ms | PASS 2.0ms | PASS 1.0ms | - |
| G12 | 500ms | PASS 3.4ms | PASS 1.9ms | PASS 1.7ms | - |

## 2. Index Configuration Comparison (Tier L, Single-user)

| Query | No Index (A) | 2dsphere (B) | Compound (C) |
|-------|-------------|-------------|-------------|
| G1 | SKIP | 2.3ms | 2.1ms |
| G2 | SKIP | 9.4ms | 10.3ms |
| G3 | SKIP | 4.0ms | 5.3ms |
| G4 | SKIP | 1.7ms | 2.2ms |
| G5 | 197.8ms | 83.5ms | 87.7ms |
| G6 | 211.6ms | 82.5ms | 82.7ms |
| G7 | 196.2ms | 17.0ms | 17.7ms |
| G8 | 160.3ms | 161.2ms | 164.1ms |
| G9 | 192.6ms | 0.9ms | 0.9ms |
| G10 | 227.5ms | 21.4ms | 22.0ms |
| G11 | 185.9ms | 1.0ms | 1.2ms |
| G12 | 509.3ms | 1.7ms | 1.6ms |

## 3. Concurrency Results

| Mode | Tier | G1 p95 | G5 p95 | G9 p95 |
|------|------|--------|--------|--------|
| Concurrent (10) | L | 97.0ms | 508.3ms | 84.2ms |
| Concurrent (30) | L | 390.2ms | 1464.6ms | 367.5ms |
| Concurrent (10) | M | 14.4ms | 122.7ms | 79.4ms |
| Concurrent (30) | M | 182.6ms | 302.6ms | 214.3ms |
| Concurrent (10) | S | 6.7ms | 11.1ms | 9.5ms |
| Mixed (R+W) | L | 84.2ms | 491.3ms | 82.7ms | Write p95: 73.6ms
| Mixed (R+W) | M | 77.7ms | 181.7ms | 88.2ms | Write p95: 96.2ms

## 4. PostGIS vs MongoDB (Config B)

| Query | MongoDB p95 | PostGIS p95 | Winner | Ratio |
|-------|------------|------------|--------|-------|
| Proximity 500m (G1/G1') | 2.3ms | 63.8ms | Mongo | Mongo 27.5x faster |
| Polygon intersection (G9/G9') | 0.9ms | 1.0ms | Tie | within 0.5ms |
| Buffer + intersect (G11/G11') | 2.0ms | 0.3ms | PG | PG 7.6x faster |

## 5. Go/No-Go Decision

### Decision Matrix Rules

| Condition | Action |
|-----------|--------|
| L all PASS | Maintain MongoDB, GIS not split |
| L 1 FAIL | Optimize indexes/queries, retest |
| L >= 2 FAIL | Trigger Condition C: introduce PostGIS |
| M FAIL | Immediate PostGIS introduction |

### Result: MARGINAL (1 failure)

L-tier failure: G8

**Recommendation: Optimize indexes/queries for the failing query and retest.**
Consider compound indexes or query restructuring before escalating to PostGIS.

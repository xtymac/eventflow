#!/bin/bash
# GIS Spatial Benchmark Suite — end-to-end orchestration.
#
# Usage:
#   ./poc-mongo/scripts/run-gis-benchmark.sh              # Full suite (all tiers, all configs)
#   ./poc-mongo/scripts/run-gis-benchmark.sh --tier M      # Single tier, all configs
#   ./poc-mongo/scripts/run-gis-benchmark.sh --quick       # S tier only, config B only
#   ./poc-mongo/scripts/run-gis-benchmark.sh --tier L --with-pg  # Include PostGIS comparison

set -euo pipefail
cd "$(dirname "$0")/../.."

# ---------------------------------------------------------------------------
# Parse args
# ---------------------------------------------------------------------------
TIERS="S M L XL"
CONFIGS="A B C"
QUICK=false
WITH_PG=""
ITERATIONS=100
WARMUP=20
CONCURRENCY_NORMAL=10
CONCURRENCY_PEAK=30

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tier)    TIERS="$2"; shift 2;;
    --quick)   QUICK=true; TIERS="S"; CONFIGS="B"; shift;;
    --with-pg) WITH_PG="--with-pg"; shift;;
    --iterations) ITERATIONS="$2"; shift 2;;
    *)         shift;;
  esac
done

if $QUICK; then
  ITERATIONS=20
  WARMUP=5
fi

echo "============================================"
echo " GIS Spatial Benchmark Suite"
echo "============================================"
echo "  Tiers:      $TIERS"
echo "  Configs:    $CONFIGS"
echo "  Iterations: $ITERATIONS (warmup: $WARMUP)"
echo "  PostGIS:    ${WITH_PG:-no}"
echo "  Quick:      $QUICK"
echo "============================================"
echo

# ---------------------------------------------------------------------------
# Check prerequisites
# ---------------------------------------------------------------------------
echo "[1/6] Checking prerequisites..."

# Check if mongo-bench container is running
if ! docker ps --format '{{.Names}}' | grep -q 'mongo-bench'; then
  echo "  Starting mongo-bench container..."
  docker compose -f docker-compose.poc-bench.yml up -d mongo-bench
  sleep 3
  # Initialize replica set
  docker exec mongo-bench mongosh --quiet --eval "
    try { rs.initiate() } catch(e) { /* already initialized */ }
  " 2>/dev/null || true
  sleep 2
fi
echo "  mongo-bench: OK"

# ---------------------------------------------------------------------------
# Run benchmarks
# ---------------------------------------------------------------------------
REPORT_COUNT=0

for TIER in $TIERS; do
  echo
  echo "============================================"
  echo " Tier: $TIER"
  echo "============================================"

  # Seed data
  echo "[2/6] Seeding GIS data (tier $TIER)..."
  npx tsx poc-mongo/benchmark/gis-seed.ts --tier "$TIER"

  # Run index configs
  for CONFIG in $CONFIGS; do
    echo
    echo "[3/6] Running single-user benchmark (tier=$TIER, config=$CONFIG)..."
    npx tsx poc-mongo/benchmark/gis-runner.ts \
      --tier "$TIER" \
      --index-config "$CONFIG" \
      --mode single \
      --iterations "$ITERATIONS" \
      --warmup "$WARMUP" \
      --output "poc/reports/gis-${TIER}-${CONFIG}-single.json" \
      $WITH_PG
    REPORT_COUNT=$((REPORT_COUNT + 1))
  done

  # Concurrency tests (only with config B)
  if ! $QUICK; then
    echo
    echo "[4/6] Running concurrent benchmark (tier=$TIER, normal=$CONCURRENCY_NORMAL)..."
    npx tsx poc-mongo/benchmark/gis-runner.ts \
      --tier "$TIER" \
      --index-config B \
      --mode concurrent \
      --concurrency "$CONCURRENCY_NORMAL" \
      --iterations "$ITERATIONS" \
      --warmup "$WARMUP" \
      --output "poc/reports/gis-${TIER}-B-concurrent-${CONCURRENCY_NORMAL}.json"
    REPORT_COUNT=$((REPORT_COUNT + 1))

    echo
    echo "[4/6] Running concurrent benchmark (tier=$TIER, peak=$CONCURRENCY_PEAK)..."
    npx tsx poc-mongo/benchmark/gis-runner.ts \
      --tier "$TIER" \
      --index-config B \
      --mode concurrent \
      --concurrency "$CONCURRENCY_PEAK" \
      --iterations "$ITERATIONS" \
      --warmup "$WARMUP" \
      --output "poc/reports/gis-${TIER}-B-concurrent-${CONCURRENCY_PEAK}.json"
    REPORT_COUNT=$((REPORT_COUNT + 1))

    echo
    echo "[5/6] Running mixed read+write benchmark (tier=$TIER)..."
    npx tsx poc-mongo/benchmark/gis-runner.ts \
      --tier "$TIER" \
      --index-config B \
      --mode mixed \
      --iterations "$ITERATIONS" \
      --warmup "$WARMUP" \
      --output "poc/reports/gis-${TIER}-B-mixed.json"
    REPORT_COUNT=$((REPORT_COUNT + 1))
  fi

  # Clean data between tiers
  echo
  echo "  Cleaning tier $TIER data..."
  npx tsx poc-mongo/benchmark/gis-seed.ts --clean
done

# ---------------------------------------------------------------------------
# Generate comparison report
# ---------------------------------------------------------------------------
echo
echo "[6/6] Generating comparison report..."
npx tsx poc-mongo/benchmark/gis-compare.ts \
  --reports-dir poc/reports \
  --output poc/reports/GIS-DECISION-REPORT.md

echo
echo "============================================"
echo " GIS Benchmark Complete"
echo "============================================"
echo "  Reports generated: $REPORT_COUNT"
echo "  Decision report:   poc/reports/GIS-DECISION-REPORT.md"
echo "============================================"

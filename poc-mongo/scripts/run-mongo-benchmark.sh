#!/bin/bash
# Full MongoDB benchmark suite runner
#
# Usage:
#   ./poc-mongo/scripts/run-mongo-benchmark.sh
#   ./poc-mongo/scripts/run-mongo-benchmark.sh --runs 3   # Multiple runs for comparison

set -euo pipefail
cd "$(dirname "$0")/../.."

RUNS="${1:-3}"
if [[ "${1:-}" == "--runs" ]]; then
  RUNS="${2:-3}"
fi

echo "================================================"
echo "  MongoDB Benchmark Suite"
echo "  Runs: ${RUNS}"
echo "================================================"
echo ""

# Verify mongo-bench is running
if ! docker exec nagoya-mongo-bench mongosh --quiet --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
  echo "ERROR: mongo-bench container not running."
  echo "Run: ./poc-mongo/scripts/setup-mongo-bench.sh"
  exit 1
fi

# 1. Query benchmarks (multiple runs)
echo "1. Query Benchmarks"
echo "-------------------"
for i in $(seq 1 "$RUNS"); do
  echo ""
  echo "  Run ${i}/${RUNS}..."
  npx tsx poc-mongo/benchmark/mongo-runner.ts \
    --output "poc/reports/benchmark-mongo-50x-run${i}.json"
done

# 2. Transaction tests
echo ""
echo "2. Transaction Tests"
echo "--------------------"
npx tsx poc-mongo/benchmark/mongo-transactions.ts

# 3. Permission tests (requires server with POC_MONGO_ENABLED=true)
echo ""
echo "3. Permission Tests"
echo "-------------------"
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
  npx tsx poc/benchmark/permissions.ts --base-path /poc-mongo --verbose
else
  echo "  SKIPPED: Server not running (start with POC_MONGO_ENABLED=true)"
fi

# 4. Concurrency benchmarks
echo ""
echo "4. Concurrency Benchmark (c=10)"
echo "--------------------------------"
npx tsx poc-mongo/benchmark/mongo-runner.ts \
  --concurrency 10 \
  --output "poc/reports/benchmark-mongo-50x-c10.json"

# 5. Generate comparison report
echo ""
echo "5. Generating Comparison Report"
echo "-------------------------------"
npx tsx poc-mongo/benchmark/compare-engines.ts

echo ""
echo "================================================"
echo "  Benchmark suite complete!"
echo "  Reports: poc/reports/"
echo "  Comparison: poc/reports/MONGO-VS-POSTGRES.md"
echo "================================================"

#!/bin/bash
# PoC Benchmark Suite Runner
#
# Usage:
#   ./poc/scripts/run-benchmark.sh           # Full suite (local, all tiers)
#   ./poc/scripts/run-benchmark.sh --tier 1   # Single tier
#   ./poc/scripts/run-benchmark.sh --ec2      # Run on EC2 (requires SSH)

set -euo pipefail
cd "$(dirname "$0")/../.."

TIER="${1:-all}"
EC2_MODE=false
if [[ "${1:-}" == "--ec2" ]]; then EC2_MODE=true; fi

echo "================================================"
echo "  PoC Benchmark Suite"
echo "  Mode: $([ "$EC2_MODE" = true ] && echo 'EC2' || echo 'Local')"
echo "  Tier: $TIER"
echo "================================================"

run_tier() {
  local scale=$1
  local env=$2
  echo ""
  echo "--- Tier ${scale}x (${env}) ---"

  # Seed data
  echo "Seeding data (scale=${scale})..."
  npx tsx poc/seed/seed-poc.ts --scale "$scale"

  # Hot cache benchmark
  echo "Running hot cache benchmark..."
  npx tsx poc/benchmark/runner.ts \
    --iterations 100 --warmup 20 \
    --env "$env" \
    --output "poc/reports/benchmark-${env}-${scale}x.json"

  # Concurrency test (10 workers)
  echo "Running concurrency test (10 workers)..."
  npx tsx poc/benchmark/runner.ts \
    --iterations 100 --concurrency 10 \
    --env "$env" \
    --output "poc/reports/benchmark-${env}-${scale}x-c10.json"
}

if [ "$EC2_MODE" = false ]; then
  # Local benchmarks
  if [ "$TIER" = "all" ] || [ "$TIER" = "1" ]; then run_tier 1 local; fi
  if [ "$TIER" = "all" ] || [ "$TIER" = "10" ]; then run_tier 10 local; fi
  if [ "$TIER" = "all" ] || [ "$TIER" = "50" ]; then run_tier 50 local; fi

  # Transaction tests
  echo ""
  echo "--- Transaction Tests ---"
  npx tsx poc/benchmark/transactions.ts

  # Clean up
  echo ""
  echo "Cleaning PoC data..."
  npx tsx poc/seed/seed-poc.ts --clean
else
  echo "EC2 mode: Run this script on the EC2 host after deploying poc/ directory"
  echo "  scp -r poc/ ubuntu@18.177.72.233:~/eventflow/poc/"
  echo "  ssh ubuntu@18.177.72.233 'cd ~/eventflow && ./poc/scripts/run-benchmark.sh'"
fi

echo ""
echo "================================================"
echo "  Benchmark complete!"
echo "  Reports in: poc/reports/"
echo "================================================"

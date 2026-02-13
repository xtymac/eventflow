#!/bin/bash
# PoC Permission Matrix Test Runner
#
# Usage:
#   ./poc/scripts/run-permissions-test.sh
#   ./poc/scripts/run-permissions-test.sh --verbose
#
# Prerequisites: Server running with POC_ENABLED=true
#   POC_ENABLED=true npx tsx backend/src/index.ts

set -euo pipefail
cd "$(dirname "$0")/../.."

echo "================================================"
echo "  PoC Permission Matrix Tests"
echo "================================================"
echo ""

# Check if server is running
if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
  echo "ERROR: Server not running at http://localhost:3000"
  echo "Start with: POC_ENABLED=true npx tsx backend/src/index.ts"
  exit 1
fi

# Seed minimal data for testing
echo "Seeding minimal test data..."
npx tsx poc/seed/seed-poc.ts --scale 1

# Run permission tests
echo ""
npx tsx poc/benchmark/permissions.ts "$@"

echo ""
echo "================================================"
echo "  Permission tests complete!"
echo "  Report: poc/reports/permission-report.json"
echo "================================================"

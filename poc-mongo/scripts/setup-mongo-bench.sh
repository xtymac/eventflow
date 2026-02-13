#!/bin/bash
# Setup MongoDB benchmark environment
#
# Usage:
#   ./poc-mongo/scripts/setup-mongo-bench.sh
#   ./poc-mongo/scripts/setup-mongo-bench.sh --clean   # Re-import from scratch

set -euo pipefail
cd "$(dirname "$0")/../.."

CLEAN_FLAG=""
if [[ "${1:-}" == "--clean" ]]; then
  CLEAN_FLAG="--clean"
fi

echo "================================================"
echo "  MongoDB Benchmark Environment Setup"
echo "================================================"
echo ""

# 1. Start mongo-bench container
echo "1. Starting mongo-bench container..."
docker compose -f docker-compose.yml -f docker-compose.poc-bench.yml up -d mongo-bench

# Wait for healthy
echo "   Waiting for container to be healthy..."
for i in $(seq 1 30); do
  if docker exec nagoya-mongo-bench mongosh --quiet --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    echo "   Container is ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "   ERROR: Container did not become healthy in 30s"
    exit 1
  fi
  sleep 1
done

# 2. Initialize replica set (idempotent)
echo ""
echo "2. Initializing replica set..."
docker exec nagoya-mongo-bench mongosh --quiet --eval "
  try {
    rs.status();
    print('Replica set already initialized.');
  } catch(e) {
    rs.initiate();
    print('Replica set initiated.');
  }
"

# Wait for PRIMARY
echo "   Waiting for PRIMARY state..."
for i in $(seq 1 30); do
  STATE=$(docker exec nagoya-mongo-bench mongosh --quiet --eval "rs.status().myState" 2>/dev/null || echo "0")
  if [ "$STATE" = "1" ]; then
    echo "   Replica set is PRIMARY."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "   ERROR: Replica set did not reach PRIMARY in 30s"
    exit 1
  fi
  sleep 1
done

# 3. Import data from PostgreSQL
echo ""
echo "3. Importing data from PostgreSQL..."
npx tsx poc-mongo/import/pg-to-mongo.ts $CLEAN_FLAG

# 4. Validate
echo ""
echo "4. Validating data..."
npx tsx poc-mongo/import/validate.ts

echo ""
echo "================================================"
echo "  Setup complete!"
echo "  MongoDB: mongodb://localhost:27019/nagoya_bench"
echo "================================================"

#!/bin/bash
# Deploy dual-stack: main (eventflow.uixai.org) + v1 (v1.eventflow.uixai.org)
# Run on EC2 after: 1) DNS configured, 2) v1 code frozen to separate directory
set -euo pipefail

MAIN_DIR="/home/ubuntu/eventflow"
V1_DIR="/home/ubuntu/eventflow-v1"

echo "=== EventFlow Dual-Stack Deployment ==="
echo ""

# 1. Create shared network (idempotent)
echo "[1/4] Creating shared Docker network..."
docker network create eventflow-net 2>/dev/null && echo "  Created eventflow-net" || echo "  eventflow-net already exists"

# 2. Start main stack
echo ""
echo "[2/4] Starting main stack..."
cd "$MAIN_DIR"
docker compose up -d --build
echo "  Main stack started"

# 3. Start v1 stack
echo ""
echo "[3/4] Starting v1 stack..."
cd "$V1_DIR"
docker compose -f docker-compose.v1.yml -p eventflow-v1 up -d --build
echo "  v1 stack started"

# 4. Wait and verify
echo ""
echo "[4/4] Waiting for services to stabilize..."
sleep 30

echo ""
echo "=== Container Status ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "=== Health Checks ==="
if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
    echo "  [main API] OK"
else
    echo "  [main API] FAIL"
fi

if docker exec nagoya-api-v1 wget -qO- http://127.0.0.1:3000/health > /dev/null 2>&1; then
    echo "  [v1 API]   OK"
else
    echo "  [v1 API]   FAIL"
fi

echo ""
echo "=== Resource Usage ==="
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"

echo ""
echo "=== Network Verification ==="
CADDY_NET=$(docker inspect nagoya-caddy --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}')
echo "  Caddy networks: $CADDY_NET"

V1_CONTAINERS=$(docker network inspect eventflow-net --format '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null || echo "N/A")
echo "  Containers on eventflow-net: $V1_CONTAINERS"

echo ""
echo "=== Deployment Complete ==="
echo "  Main: https://eventflow.uixai.org/"
echo "  v1:   https://v1.eventflow.uixai.org/"
echo ""
echo "If v1 DB is empty, run:"
echo "  docker exec nagoya-api-v1 npm run db:migrate"
echo "  docker exec nagoya-api-v1 npm run db:seed"

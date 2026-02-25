#!/bin/bash
# Deploy dual-stack: main (eventflow.uixai.org) + v1 (v1.eventflow.uixai.org)
# Defaults:
# - main stack deploys latest origin/main
# - optional MAIN_REF lets you deploy a specific commit/tag for rollback
set -euo pipefail

MAIN_DIR="${MAIN_DIR:-/home/ubuntu/eventflow}"
MAIN_BRANCH="${MAIN_BRANCH:-main}"
MAIN_REF="${MAIN_REF:-}"

V1_DIR="${V1_DIR:-/home/ubuntu/eventflow-v1}"
V1_BRANCH="${V1_BRANCH:-}"
V1_REF="${V1_REF:-}"

select_ref() {
    # Usage: select_ref <repo_dir> <default_branch> <explicit_ref>
    local repo_dir="$1"
    local default_branch="$2"
    local explicit_ref="$3"

    cd "$repo_dir"
    git fetch --all --tags --prune

    if [[ -n "$explicit_ref" ]]; then
        git checkout --detach "$explicit_ref"
        echo "  checked out ref: $explicit_ref"
        return
    fi

    git checkout "$default_branch"
    git pull --ff-only origin "$default_branch"
    echo "  checked out branch: $default_branch"
}

echo "=== EventFlow Dual-Stack Deployment ==="
echo "main dir: $MAIN_DIR"
if [[ -n "$MAIN_REF" ]]; then
    echo "main ref: $MAIN_REF"
else
    echo "main branch: $MAIN_BRANCH"
fi
echo "v1 dir:   $V1_DIR"
if [[ -n "$V1_REF" ]]; then
    echo "v1 ref:   $V1_REF"
elif [[ -n "$V1_BRANCH" ]]; then
    echo "v1 branch: $V1_BRANCH"
fi
echo ""

if [[ ! -d "$MAIN_DIR/.git" ]]; then
    echo "ERROR: main repo not found at $MAIN_DIR"
    exit 1
fi

if [[ ! -d "$V1_DIR" ]]; then
    echo "ERROR: v1 directory not found at $V1_DIR"
    exit 1
fi

# 1. Create shared network (idempotent)
echo "[1/4] Creating shared Docker network..."
docker network create eventflow-net 2>/dev/null && echo "  Created eventflow-net" || echo "  eventflow-net already exists"

# 2. Start main stack
echo ""
echo "[2/4] Starting main stack (eventflow.uixai.org)..."
select_ref "$MAIN_DIR" "$MAIN_BRANCH" "$MAIN_REF"
docker compose up -d --build
echo "  Main stack started"

# 3. Start v1 stack
echo ""
echo "[3/4] Starting v1 stack..."
cd "$V1_DIR"

if [[ -d .git ]]; then
    if [[ -n "$V1_REF" ]]; then
        select_ref "$V1_DIR" "${V1_BRANCH:-main}" "$V1_REF"
    elif [[ -n "$V1_BRANCH" ]]; then
        select_ref "$V1_DIR" "$V1_BRANCH" ""
    else
        git rev-parse --short HEAD >/dev/null
        echo "  using current v1 checkout: $(git rev-parse --short HEAD)"
    fi
else
    echo "  v1 directory is not a git repo, using existing files"
fi

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

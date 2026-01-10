#!/bin/bash
# EC2 Road Assets Watcher
# Automatically starts SSH tunnel and watches for database changes

SSH_KEY="$HOME/.ssh/eventflow-prod-key.pem"
EC2_HOST="ubuntu@18.177.72.233"
TUNNEL_PORT=15432

echo "=========================================="
echo "  EC2 Road Assets Watcher"
echo "=========================================="

# Check if tunnel already exists
if lsof -i :$TUNNEL_PORT > /dev/null 2>&1; then
    echo "[Setup] SSH tunnel already running on port $TUNNEL_PORT"
else
    echo "[Setup] Starting SSH tunnel..."
    ssh -i "$SSH_KEY" -L $TUNNEL_PORT:localhost:5433 "$EC2_HOST" -N -f
    sleep 2
    if lsof -i :$TUNNEL_PORT > /dev/null 2>&1; then
        echo "[Setup] SSH tunnel started successfully"
    else
        echo "[Setup] Failed to start SSH tunnel"
        exit 1
    fi
fi

echo "[Setup] Starting watcher..."
echo ""

# Run the watcher
npx tsx scripts/watch-road-assets.ts

# Cleanup on exit
cleanup() {
    echo ""
    echo "[Cleanup] Stopping SSH tunnel..."
    pkill -f "ssh.*$TUNNEL_PORT:localhost:5433"
    echo "[Cleanup] Done"
}

trap cleanup EXIT

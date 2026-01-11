#!/bin/bash
# SSH Tunnel Manager for EC2 Database Sync
# Uses autossh for persistent connections and control socket for clean management

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load environment variables
if [ -f "$PROJECT_DIR/.env.sync" ]; then
    source "$PROJECT_DIR/.env.sync"
else
    echo "[Error] .env.sync not found. Please create it first."
    exit 1
fi

CONTROL_SOCKET="/tmp/eventflow-ssh-tunnel.sock"

start_tunnels() {
    # Check if already running
    if [ -S "$CONTROL_SOCKET" ]; then
        echo "[Tunnel] Already running"
        status_tunnels
        return 0
    fi

    # Verify SSH key exists
    if [ ! -f "${SSH_KEY_PATH/#\$HOME/$HOME}" ]; then
        echo "[Error] SSH key not found: $SSH_KEY_PATH"
        exit 1
    fi

    # Check if autossh is installed
    if ! command -v autossh &> /dev/null; then
        echo "[Error] autossh not found. Install with: brew install autossh"
        exit 1
    fi

    echo "[Tunnel] Starting with autossh..."

    # Use autossh for persistent connection with control socket
    autossh -M 0 \
        -f -N \
        -o "ControlMaster=yes" \
        -o "ControlPath=$CONTROL_SOCKET" \
        -o "ControlPersist=yes" \
        -o "ServerAliveInterval=30" \
        -o "ServerAliveCountMax=3" \
        -o "ExitOnForwardFailure=yes" \
        -o "StrictHostKeyChecking=accept-new" \
        -i "${SSH_KEY_PATH/#\$HOME/$HOME}" \
        -L 15433:localhost:5433 \
        -L 27019:localhost:27017 \
        "$EC2_HOST"

    # Wait for tunnel to establish
    sleep 2

    if [ -S "$CONTROL_SOCKET" ]; then
        echo "[Tunnel] Started successfully"
        echo ""
        echo "  PostgreSQL: localhost:15433 -> EC2:5433"
        echo "  MongoDB:    localhost:27019 -> EC2:27017"
    else
        echo "[Error] Failed to start tunnel"
        exit 1
    fi
}

stop_tunnels() {
    if [ -S "$CONTROL_SOCKET" ]; then
        echo "[Tunnel] Stopping..."
        ssh -O exit -o "ControlPath=$CONTROL_SOCKET" "$EC2_HOST" 2>/dev/null || true
        rm -f "$CONTROL_SOCKET"
        echo "[Tunnel] Stopped"
    else
        echo "[Tunnel] Not running"
    fi
}

status_tunnels() {
    if [ -S "$CONTROL_SOCKET" ]; then
        echo "[Tunnel] ACTIVE"
        ssh -O check -o "ControlPath=$CONTROL_SOCKET" "$EC2_HOST" 2>&1 || true

        # Check if ports are actually forwarding
        echo ""
        echo "Port forwarding status:"
        if lsof -i :15433 > /dev/null 2>&1; then
            echo "  PostgreSQL (15433): OK"
        else
            echo "  PostgreSQL (15433): FAIL"
        fi
        if lsof -i :27019 > /dev/null 2>&1; then
            echo "  MongoDB (27019): OK"
        else
            echo "  MongoDB (27019): FAIL"
        fi
    else
        echo "[Tunnel] INACTIVE"
    fi
}

case "$1" in
    start)
        start_tunnels
        ;;
    stop)
        stop_tunnels
        ;;
    status)
        status_tunnels
        ;;
    restart)
        stop_tunnels
        sleep 1
        start_tunnels
        ;;
    *)
        echo "Usage: $0 {start|stop|status|restart}"
        echo ""
        echo "Commands:"
        echo "  start   - Start SSH tunnels to EC2"
        echo "  stop    - Stop SSH tunnels"
        echo "  status  - Check tunnel status"
        echo "  restart - Restart tunnels"
        exit 1
        ;;
esac

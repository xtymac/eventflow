#!/bin/bash
# EC2 Database Sync Manager
# Manages SSH tunnels, Docker containers, and PostgreSQL logical replication

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

log() { echo "[$(date '+%H:%M:%S')] $1"; }

cmd_start() {
    log "Starting EC2 database sync..."

    # 1. Start SSH tunnels
    log "Step 1/4: Starting SSH tunnels..."
    "$SCRIPT_DIR/ssh-tunnel.sh" start
    sleep 2

    # 2. Start local Docker containers
    log "Step 2/4: Starting local containers..."
    docker compose -f "$PROJECT_DIR/docker-compose.subscriber.yml" up -d db-subscriber mongo-subscriber

    # 3. Wait for PostgreSQL to be ready
    log "Step 3/4: Waiting for PostgreSQL..."
    local retries=30
    until docker exec nagoya-db-subscriber pg_isready -U postgres -d nagoya_construction > /dev/null 2>&1; do
        retries=$((retries - 1))
        if [ $retries -le 0 ]; then
            log "[Error] PostgreSQL did not become ready in time"
            exit 1
        fi
        sleep 2
    done
    log "PostgreSQL is ready"

    # 4. Check/Create PostgreSQL subscription
    log "Step 4/4: Setting up PostgreSQL subscription..."

    SUBSCRIPTION_EXISTS=$(docker exec nagoya-db-subscriber psql -U postgres -d nagoya_construction -tAc \
        "SELECT 1 FROM pg_subscription WHERE subname = 'eventflow_subscription'" 2>/dev/null || echo "0")

    if [ "$SUBSCRIPTION_EXISTS" != "1" ]; then
        log "Creating PostgreSQL subscription..."

        # First, check if we can connect to EC2 PostgreSQL
        if ! pg_isready -h localhost -p 15433 -U postgres > /dev/null 2>&1; then
            log "[Error] Cannot connect to EC2 PostgreSQL. Check SSH tunnel."
            exit 1
        fi

        # Import schema from EC2 (schema must exist before subscription)
        log "Importing schema from EC2..."
        PGPASSWORD=postgres pg_dump -h localhost -p 15433 -U postgres -d nagoya_construction \
            --schema-only --no-owner --no-privileges 2>/dev/null | \
            docker exec -i nagoya-db-subscriber psql -U postgres -d nagoya_construction > /dev/null 2>&1 || true

        # Create subscription
        docker exec nagoya-db-subscriber psql -U postgres -d nagoya_construction -c "
            CREATE SUBSCRIPTION eventflow_subscription
            CONNECTION 'host=host.docker.internal port=15433 dbname=nagoya_construction user=replication_user password=$REPLICATION_PASSWORD'
            PUBLICATION eventflow_publication
            WITH (copy_data = true, create_slot = true, synchronous_commit = off);" 2>/dev/null || {
            log "[Warning] Subscription creation failed. EC2 may need init-publisher.sql executed first."
        }

        log "Subscription created"
    else
        log "PostgreSQL subscription already exists"
    fi

    # Start remaining services (mongo-sync, orion, gateway)
    log "Starting sync services..."
    docker compose -f "$PROJECT_DIR/docker-compose.subscriber.yml" up -d

    log ""
    log "=========================================="
    log "  EC2 Sync Started Successfully!"
    log "=========================================="
    log ""
    log "Local endpoints:"
    log "  PostgreSQL: localhost:5434"
    log "  MongoDB:    localhost:27018"
    log "  Orion-LD:   localhost:1027 (read-only)"
    log ""

    cmd_status
}

cmd_stop() {
    log "Stopping EC2 sync..."

    # Stop Docker containers
    docker compose -f "$PROJECT_DIR/docker-compose.subscriber.yml" down 2>/dev/null || true

    # Stop SSH tunnels
    "$SCRIPT_DIR/ssh-tunnel.sh" stop

    log "Stopped"
}

cmd_status() {
    echo ""
    echo "=== SSH Tunnel ==="
    "$SCRIPT_DIR/ssh-tunnel.sh" status

    echo ""
    echo "=== Docker Containers ==="
    docker compose -f "$PROJECT_DIR/docker-compose.subscriber.yml" ps 2>/dev/null || echo "Not running"

    echo ""
    echo "=== PostgreSQL Subscription ==="
    docker exec nagoya-db-subscriber psql -U postgres -d nagoya_construction -c \
        "SELECT subname, subenabled, subconninfo FROM pg_subscription;" 2>/dev/null || echo "Not configured"

    echo ""
    echo "=== Replication Status ==="
    docker exec nagoya-db-subscriber psql -U postgres -d nagoya_construction -c \
        "SELECT pid, state, received_lsn, latest_end_lsn FROM pg_stat_subscription;" 2>/dev/null || echo "N/A"

    echo ""
    echo "=== MongoDB Sync Logs (last 5 lines) ==="
    docker logs --tail 5 nagoya-mongo-sync 2>/dev/null || echo "Not running"
}

cmd_init_mongo() {
    log "Running initial MongoDB sync..."
    docker exec nagoya-mongo-sync npx tsx scripts/mongo-change-sync.ts --init
    log "Initial MongoDB sync complete"
}

cmd_logs() {
    local service="${2:-all}"
    case "$service" in
        postgres)
            docker logs -f nagoya-db-subscriber
            ;;
        mongo)
            docker logs -f nagoya-mongo-sync
            ;;
        orion)
            docker logs -f nagoya-orion-ld-local
            ;;
        *)
            docker compose -f "$PROJECT_DIR/docker-compose.subscriber.yml" logs -f
            ;;
    esac
}

case "$1" in
    start)
        cmd_start
        ;;
    stop)
        cmd_stop
        ;;
    status)
        cmd_status
        ;;
    restart)
        cmd_stop
        sleep 2
        cmd_start
        ;;
    init-mongo)
        cmd_init_mongo
        ;;
    logs)
        cmd_logs "$@"
        ;;
    *)
        echo "Usage: $0 {start|stop|status|restart|init-mongo|logs [service]}"
        echo ""
        echo "Commands:"
        echo "  start      - Start EC2 sync (tunnels + containers + replication)"
        echo "  stop       - Stop all sync services"
        echo "  status     - Check sync status"
        echo "  restart    - Restart all services"
        echo "  init-mongo - Run initial MongoDB full sync"
        echo "  logs       - View logs (optional: postgres|mongo|orion)"
        exit 1
        ;;
esac

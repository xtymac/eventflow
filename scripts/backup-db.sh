#!/bin/bash
# ========================================
# Database Backup Script for Nagoya Construction Lifecycle
# ========================================
# This script backs up PostgreSQL and MongoDB databases to AWS S3
# Schedule: Run daily at 2:00 AM JST via cron
# Retention: 30 days (configurable via BACKUP_RETENTION_DAYS)
#
# Usage:
#   ./backup-db.sh
#
# Cron example (daily at 2 AM):
#   0 2 * * * /home/ubuntu/nagoya-construction-lifecycle/scripts/backup-db.sh >> /var/log/backups.log 2>&1

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"; }
log_error() { echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"; }

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.prod.yml"
ENV_FILE="$PROJECT_ROOT/.env.prod"

# Check if .env.prod exists
if [ ! -f "$ENV_FILE" ]; then
    log_error ".env.prod file not found at $ENV_FILE"
    exit 1
fi

# Load environment variables
set -a
source "$ENV_FILE"
set +a

# Backup configuration
BACKUP_DIR="${BACKUP_DIR:-/tmp/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
POSTGRES_BACKUP="postgres_${TIMESTAMP}.sql.gz"
MONGO_BACKUP="mongo_${TIMESTAMP}.archive.gz"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# ========================================
# Backup PostgreSQL
# ========================================
log_info "Starting PostgreSQL backup..."

DB_CONTAINER=$(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps -q db)
DB_HEALTH=$(docker inspect --format '{{.State.Health.Status}}' "$DB_CONTAINER" 2>/dev/null || echo "unknown")

if [ -n "$DB_CONTAINER" ] && [ "$DB_HEALTH" = "healthy" ]; then
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T db \
        pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" --clean --if-exists \
        | gzip > "$BACKUP_DIR/$POSTGRES_BACKUP"

    POSTGRES_SIZE=$(du -h "$BACKUP_DIR/$POSTGRES_BACKUP" | cut -f1)
    log_info "PostgreSQL backup completed: $POSTGRES_BACKUP ($POSTGRES_SIZE)"
else
    log_error "PostgreSQL container is not healthy. Skipping backup."
    exit 1
fi

# ========================================
# Backup MongoDB
# ========================================
log_info "Starting MongoDB backup..."

MONGO_CONTAINER=$(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps -q mongo)
MONGO_HEALTH=$(docker inspect --format '{{.State.Health.Status}}' "$MONGO_CONTAINER" 2>/dev/null || echo "unknown")

if [ -n "$MONGO_CONTAINER" ] && [ "$MONGO_HEALTH" = "healthy" ]; then
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T mongo \
        mongodump --quiet --archive --gzip --db orionld \
        > "$BACKUP_DIR/$MONGO_BACKUP"

    MONGO_SIZE=$(du -h "$BACKUP_DIR/$MONGO_BACKUP" | cut -f1)
    log_info "MongoDB backup completed: $MONGO_BACKUP ($MONGO_SIZE)"
else
    log_warn "MongoDB container is not healthy. Skipping MongoDB backup."
fi

# ========================================
# Upload to S3
# ========================================
log_info "Uploading backups to S3..."

# Check if AWS CLI is available
if ! command -v aws &> /dev/null; then
    log_error "AWS CLI is not installed. Install it with: sudo apt-get install -y awscli"
    exit 1
fi

# Upload PostgreSQL backup
if aws s3 cp "$BACKUP_DIR/$POSTGRES_BACKUP" \
    "s3://${BACKUP_S3_BUCKET}/postgres/$POSTGRES_BACKUP" \
    --region "$AWS_REGION" \
    --storage-class STANDARD_IA; then
    log_info "PostgreSQL backup uploaded to S3"
else
    log_error "Failed to upload PostgreSQL backup to S3"
    exit 1
fi

# Upload MongoDB backup (if exists)
if [ -f "$BACKUP_DIR/$MONGO_BACKUP" ]; then
    if aws s3 cp "$BACKUP_DIR/$MONGO_BACKUP" \
        "s3://${BACKUP_S3_BUCKET}/mongo/$MONGO_BACKUP" \
        --region "$AWS_REGION" \
        --storage-class STANDARD_IA; then
        log_info "MongoDB backup uploaded to S3"
    else
        log_warn "Failed to upload MongoDB backup to S3"
    fi
fi

# ========================================
# Clean up local backups
# ========================================
log_info "Cleaning up local backup files..."
rm -f "$BACKUP_DIR/$POSTGRES_BACKUP"
rm -f "$BACKUP_DIR/$MONGO_BACKUP"
log_info "Local backups removed"

# ========================================
# Clean up old S3 backups (retention policy)
# ========================================
log_info "Cleaning up old S3 backups (retention: ${RETENTION_DAYS} days)..."

CUTOFF_DATE=$(date -d "-${RETENTION_DAYS} days" +%Y%m%d 2>/dev/null || date -v-${RETENTION_DAYS}d +%Y%m%d)

# Clean PostgreSQL backups
DELETED_POSTGRES=0
while IFS= read -r file; do
    # Extract date from filename (format: postgres_YYYYMMDD_HHMMSS.sql.gz)
    FILE_DATE=$(echo "$file" | grep -oE '[0-9]{8}' | head -1)

    if [ -n "$FILE_DATE" ] && [ "$FILE_DATE" -lt "$CUTOFF_DATE" ]; then
        if aws s3 rm "s3://${BACKUP_S3_BUCKET}/postgres/$file" --region "$AWS_REGION"; then
            ((DELETED_POSTGRES++))
        fi
    fi
done < <(aws s3 ls "s3://${BACKUP_S3_BUCKET}/postgres/" --region "$AWS_REGION" | awk '{print $4}')

if [ "$DELETED_POSTGRES" -gt 0 ]; then
    log_info "Deleted $DELETED_POSTGRES old PostgreSQL backup(s) from S3"
fi

# Clean MongoDB backups
DELETED_MONGO=0
while IFS= read -r file; do
    FILE_DATE=$(echo "$file" | grep -oE '[0-9]{8}' | head -1)

    if [ -n "$FILE_DATE" ] && [ "$FILE_DATE" -lt "$CUTOFF_DATE" ]; then
        if aws s3 rm "s3://${BACKUP_S3_BUCKET}/mongo/$file" --region "$AWS_REGION"; then
            ((DELETED_MONGO++))
        fi
    fi
done < <(aws s3 ls "s3://${BACKUP_S3_BUCKET}/mongo/" --region "$AWS_REGION" | awk '{print $4}')

if [ "$DELETED_MONGO" -gt 0 ]; then
    log_info "Deleted $DELETED_MONGO old MongoDB backup(s) from S3"
fi

# ========================================
# Summary
# ========================================
log_info "========================================"
log_info "Backup Summary:"
log_info "  PostgreSQL: $POSTGRES_BACKUP ($POSTGRES_SIZE)"
if [ -f "$BACKUP_DIR/$MONGO_BACKUP" ]; then
    log_info "  MongoDB: $MONGO_BACKUP ($MONGO_SIZE)"
fi
log_info "  S3 Bucket: s3://${BACKUP_S3_BUCKET}"
log_info "  Region: $AWS_REGION"
log_info "  Retention: $RETENTION_DAYS days"
log_info "========================================"
log_info "Backup completed successfully!"

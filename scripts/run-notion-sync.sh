#!/bin/bash
# Notion to Markdown Sync Wrapper
# Designed for cron usage. Loads .env.sync and runs the TypeScript sync script.
#
# Usage:
#   ./scripts/run-notion-sync.sh
#
# Cron example (daily at 02:00 local time):
#   0 2 * * * /path/to/project/scripts/run-notion-sync.sh >> /path/to/logs/notion-sync.log 2>&1

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"; }

# Ensure Node is on PATH (cron has minimal PATH)
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
if [ -d "$HOME/.nvm" ]; then
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
fi

# Load environment variables
if [ -f "$PROJECT_DIR/.env.sync" ]; then
    set -a
    source "$PROJECT_DIR/.env.sync"
    set +a
else
    log "[Error] .env.sync not found at $PROJECT_DIR/.env.sync"
    exit 1
fi

# Verify required variables
if [ -z "$NOTION_TOKEN" ]; then
    log "[Error] NOTION_TOKEN not set in .env.sync"
    exit 1
fi

if [ -z "$NOTION_ROOT_PAGE_ID" ]; then
    log "[Error] NOTION_ROOT_PAGE_ID not set in .env.sync"
    exit 1
fi

log "Starting Notion sync..."

cd "$PROJECT_DIR"
npx tsx scripts/notion-sync.ts

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    log "Notion sync completed successfully"
else
    log "[Error] Notion sync failed with exit code $EXIT_CODE"
    exit $EXIT_CODE
fi

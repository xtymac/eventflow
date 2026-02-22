#!/usr/bin/env bash
#
# render-demo-video.sh — Convert Playwright .webm recording to 1080p MP4
#
# Usage:  bash scripts/render-demo-video.sh
#         npm run demo:render
#
# Env:
#   DEMO_OUTPUT_NAME  Output filename (default: eventflow-demo)
#   ARTIFACTS_DIR     Artifacts root  (default: artifacts/demo)

set -euo pipefail

ARTIFACTS_DIR="${ARTIFACTS_DIR:-artifacts/demo}"
OUTPUT_NAME="${DEMO_OUTPUT_NAME:-eventflow-demo}"
RAW_DIR="${ARTIFACTS_DIR}/raw"
OUTPUT="${ARTIFACTS_DIR}/${OUTPUT_NAME}.mp4"

# ── Check ffmpeg ──────────────────────────────────────────────────────────
if ! command -v ffmpeg &>/dev/null; then
  echo "ERROR: ffmpeg not found."
  echo "  macOS:  brew install ffmpeg"
  echo "  Ubuntu: sudo apt-get install ffmpeg"
  exit 1
fi

# ── Find latest .webm ────────────────────────────────────────────────────
SOURCE=$(find "${RAW_DIR}" -name "*.webm" -type f 2>/dev/null | head -1)

if [[ -z "${SOURCE}" ]]; then
  echo "ERROR: No .webm found in ${RAW_DIR}"
  echo "  Run first: npm run demo:record"
  exit 1
fi

echo "Source: ${SOURCE}"
echo "Output: ${OUTPUT}"

# ── Convert ───────────────────────────────────────────────────────────────
ffmpeg -y \
  -i "${SOURCE}" \
  -c:v libx264 \
  -preset medium \
  -crf 20 \
  -pix_fmt yuv420p \
  -movflags +faststart \
  -vf "fps=30" \
  -an \
  "${OUTPUT}"

# ── Report ────────────────────────────────────────────────────────────────
if [[ -f "${OUTPUT}" ]]; then
  SIZE=$(du -sh "${OUTPUT}" | cut -f1)
  DURATION=$(ffprobe -v error -show_entries format=duration \
    -of default=noprint_wrappers=1:nokey=1 "${OUTPUT}" 2>/dev/null \
    | xargs printf "%.0f" 2>/dev/null || echo "unknown")
  echo ""
  echo "Done: ${OUTPUT} (${SIZE}, ~${DURATION}s)"
else
  echo "ERROR: ffmpeg did not produce output"
  exit 1
fi

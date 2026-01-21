#!/bin/bash
#
# Generate PMTiles from Nagoya designated roads and building zones data
#
# Prerequisites:
#   - tippecanoe: brew install tippecanoe
#   - Backend server running on localhost:3000
#
# Usage:
#   ./scripts/generate-pmtiles.sh
#
# Output:
#   frontend/public/tiles/nagoya-data.pmtiles
#

set -e

# Configuration
API_BASE="${API_BASE:-http://localhost:3000}"
OUTPUT_DIR="frontend/public/tiles"
OUTPUT_FILE="nagoya-data.pmtiles"
TEMP_DIR=$(mktemp -d)

echo "=== Nagoya PMTiles Generator ==="
echo "API: $API_BASE"
echo "Output: $OUTPUT_DIR/$OUTPUT_FILE"
echo "Temp: $TEMP_DIR"
echo ""

# Check prerequisites
if ! command -v tippecanoe &> /dev/null; then
    echo "Error: tippecanoe not found. Install with: brew install tippecanoe"
    exit 1
fi

if ! command -v curl &> /dev/null; then
    echo "Error: curl not found"
    exit 1
fi

# Check API availability
echo "Checking API availability..."
if ! curl -s "$API_BASE/health" > /dev/null; then
    echo "Error: API not available at $API_BASE"
    echo "Make sure backend is running: cd backend && npm run dev"
    exit 1
fi

# Get export statistics
echo ""
echo "Fetching export statistics..."
STATS=$(curl -s "$API_BASE/pmtiles-export/stats")
echo "  Roads: $(echo $STATS | jq -r '.roads')"
echo "  Areas: $(echo $STATS | jq -r '.areas')"
echo "  Building zones: $(echo $STATS | jq -r '.buildingZones')"
echo "  Total features: $(echo $STATS | jq -r '.total')"

TOTAL=$(echo $STATS | jq -r '.total')
if [ "$TOTAL" -eq 0 ]; then
    echo ""
    echo "Warning: No data to export. Run sync first:"
    echo "  curl -X POST $API_BASE/nagoya-sync/start"
    echo "  curl -X POST $API_BASE/nagoya-building-sync/start"
    exit 1
fi

# Download NDJSON data
echo ""
echo "Downloading NDJSON data (this may take a while)..."
NDJSON_FILE="$TEMP_DIR/nagoya-all.ndjson"

curl -s "$API_BASE/pmtiles-export/all.ndjson" > "$NDJSON_FILE"
LINES=$(wc -l < "$NDJSON_FILE" | tr -d ' ')
echo "  Downloaded $LINES features"

if [ "$LINES" -eq 0 ]; then
    echo "Error: No features downloaded"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Generate PMTiles with tippecanoe
echo ""
echo "Generating PMTiles with tippecanoe..."
echo "  Min zoom: 8 (city overview)"
echo "  Max zoom: 16 (detailed view)"

# Create output directory if not exists
mkdir -p "$OUTPUT_DIR"

# Run tippecanoe
# Options:
#   -z16: max zoom 16
#   -Z8: min zoom 8 (allows low-zoom overview)
#   --simplify-only-low-zooms: only simplify at low zoom levels
#   --no-feature-limit: don't drop features at any zoom
#   --no-tile-size-limit: allow large tiles for dense areas
#   --detect-shared-borders: improve polygon rendering
#   --coalesce-densest-as-needed: merge features at low zoom when too dense
#   --extend-zooms-if-still-dropping: ensure all features visible somewhere
#   --force: overwrite existing file
#   -o: output file
#   -l: layer name (we use tippecanoe.layer from NDJSON instead)

tippecanoe \
    -z16 \
    -Z8 \
    --simplify-only-low-zooms \
    --no-feature-limit \
    --no-tile-size-limit \
    --detect-shared-borders \
    --coalesce-densest-as-needed \
    --extend-zooms-if-still-dropping \
    --force \
    --read-parallel \
    -o "$OUTPUT_DIR/$OUTPUT_FILE" \
    "$NDJSON_FILE"

# Cleanup
rm -rf "$TEMP_DIR"

# Verify output
if [ -f "$OUTPUT_DIR/$OUTPUT_FILE" ]; then
    SIZE=$(ls -lh "$OUTPUT_DIR/$OUTPUT_FILE" | awk '{print $5}')
    echo ""
    echo "=== Success ==="
    echo "Generated: $OUTPUT_DIR/$OUTPUT_FILE ($SIZE)"
    echo ""
    echo "Layers included:"
    echo "  - shiteidouro (designated roads)"
    echo "  - shiteidouro_area (designated road areas)"
    echo "  - kenchiku (building zones)"
    echo ""
    echo "Zoom levels: 8-16"
    echo ""
    echo "To serve PMTiles, ensure your web server supports HTTP Range requests."
    echo "For development, use: npx serve frontend/public -l 8080"
else
    echo "Error: PMTiles generation failed"
    exit 1
fi

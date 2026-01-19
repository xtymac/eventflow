# Road Name Enrichment

Fetch road names from Google Maps API for unnamed roads in the database.

## Usage

```
/enrich-roads [command] [options]
```

Commands:
- `status` - Check unnamed roads count and API configuration
- `events` - Enrich roads covered by Events
- `nearby [distance]` - Enrich roads within distance (meters) of Events (default: 100m)
- `batch [limit]` - Enrich a batch of central roads (default: 100)
- `single [road_id]` - Enrich a single road by ID

## Pricing (as of 2025.3.1)

- Free tier: **10,000 requests/month** (~$50 value)
- Over limit: $5 per 1,000 requests
- Volume discounts apply for high usage

## Instructions

When the user runs this skill:

### For `status`:
```bash
# Check overall stats
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 "docker exec nagoya-db psql -U postgres -d nagoya_construction -c \"
SELECT
  (SELECT COUNT(*) FROM road_assets) as total_roads,
  (SELECT COUNT(*) FROM road_assets WHERE name_source = 'google') as google_named,
  (SELECT COUNT(*) FROM road_assets WHERE display_name IS NOT NULL AND display_name != '') as with_names,
  (SELECT COUNT(*) FROM road_assets WHERE (display_name IS NULL OR display_name = '') AND (name IS NULL OR name = '')) as unnamed;
\""

# Check event-covered roads
curl -s "https://eventflow.uixai.org/api/events/enrich-road-names/status"

# Check nearby roads
curl -s "https://eventflow.uixai.org/api/events/enrich-nearby-roads/status?distance=100"
```

### For `events`:
```bash
# Check status first
curl -s "https://eventflow.uixai.org/api/events/enrich-road-names/status"

# Process (repeat until unnamedCount is 0)
curl -s -X POST "https://eventflow.uixai.org/api/events/enrich-road-names?limit=100"
```

### For `nearby [distance]`:
```bash
# Check count first (distance in meters, max 500)
curl -s "https://eventflow.uixai.org/api/events/enrich-nearby-roads/status?distance=DISTANCE"

# Process in batches (repeat until unnamedCount is 0)
curl -s -X POST "https://eventflow.uixai.org/api/events/enrich-nearby-roads?distance=DISTANCE&limit=100"
```
Default distance is 100 meters, max is 500 meters.

### For `batch [limit]`:
Process unnamed roads closest to city center (136.906, 35.170).

```bash
# First reset postgres password (often needed)
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 "docker exec nagoya-db psql -U postgres -c \"ALTER USER postgres WITH PASSWORD 'postgres';\""

# Get list of unnamed roads near center and process them
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 "docker exec nagoya-db psql -U postgres -d nagoya_construction -t -A -c \"
WITH center AS (
  SELECT ST_SetSRID(ST_MakePoint(136.906, 35.170), 4326) as point
)
SELECT ra.id
FROM road_assets ra, center
WHERE (ra.display_name IS NULL OR ra.display_name = '')
  AND (ra.name IS NULL OR ra.name = '')
  AND ra.name_source IS NULL
  AND ra.geometry IS NOT NULL
ORDER BY ST_Distance(ST_Centroid(ra.geometry)::geography, center.point::geography)
LIMIT LIMIT_VALUE;
\" | while read id; do
  echo \"Processing \$id...\"
  result=\$(curl -s -X POST \"http://localhost:3000/assets/\$id/apply-google-name\")
  name=\$(echo \"\$result\" | grep -o '\"displayName\":\"[^\"]*\"' | cut -d'\"' -f4)
  echo \"  -> \$name\"
  sleep 0.2
done"
```
Replace `LIMIT_VALUE` with the desired number (default 100).

### For `single [road_id]`:
```bash
# Reset postgres password first
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 "docker exec nagoya-db psql -U postgres -c \"ALTER USER postgres WITH PASSWORD 'postgres';\""

# Apply Google name to single road
curl -s -X POST "https://eventflow.uixai.org/api/assets/ROAD_ID/apply-google-name"
```
Replace `ROAD_ID` with the actual road ID (e.g., `RA-ATSU-0009`).

## Cost Estimates

| Scope | Estimated Roads | Cost |
|-------|-----------------|------|
| Event-covered | ~500 | Free |
| Nearby (100m) | ~600 | Free |
| Batch (1000) | 1,000 | Free (within monthly quota) |
| All unnamed | ~92,000 | ~$460 |

## Environment

- Production API: `https://eventflow.uixai.org`
- Internal API: `http://localhost:3000` (from EC2)
- EC2 host: `ubuntu@18.177.72.233`
- SSH key: `~/.ssh/eventflow-prod-key.pem`
- Database: `nagoya_construction` (user: `postgres`)

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/events/enrich-road-names/status` | GET | Event-covered unnamed roads count |
| `/events/enrich-road-names?limit=N` | POST | Enrich event-covered roads |
| `/events/enrich-nearby-roads/status?distance=M` | GET | Nearby unnamed roads count |
| `/events/enrich-nearby-roads?distance=M&limit=N` | POST | Enrich nearby roads |
| `/assets/:id/apply-google-name` | POST | Enrich single road |
| `/assets/:id/lookup-google-name` | POST | Lookup without saving |

## Troubleshooting

If API calls fail with password error:
```bash
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 "docker exec nagoya-db psql -U postgres -c \"ALTER USER postgres WITH PASSWORD 'postgres';\""
```

If containers are not running:
```bash
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 "cd ~/eventflow && docker compose up -d"
```

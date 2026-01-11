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
- `type [arterial|collector|local]` - Enrich roads by type
- `all [limit]` - Enrich all unnamed roads with limit

## Pricing (as of 2025.3.1)

- Free tier: **10,000 requests/month** (~$50 value)
- Over limit: $5 per 1,000 requests
- Volume discounts apply for high usage

## Instructions

When the user runs this skill:

### For `status`:
```bash
# Check event-covered roads
curl -s "https://eventflow.uixai.org/api/events/enrich-road-names/status" | jq .

# Check nearby roads (100m default)
curl -s "https://eventflow.uixai.org/api/events/enrich-nearby-roads/status" | jq .

# Check by road type
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 \
  "cd ~/eventflow && docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T db psql -U nagoya_prod -d nagoya_construction -c \"
SELECT
  road_type,
  COUNT(*) as total,
  COUNT(CASE WHEN display_name IS NULL OR display_name = '' THEN 1 END) as unnamed
FROM road_assets
GROUP BY road_type
ORDER BY unnamed DESC;
\""
```

### For `events`:
```bash
curl -s -X POST "https://eventflow.uixai.org/api/events/enrich-road-names?limit=100" | jq .
```
Repeat until `unnamedCount` is 0.

### For `nearby [distance]`:
```bash
# Check count first
curl -s "https://eventflow.uixai.org/api/events/enrich-nearby-roads/status?distance=DISTANCE" | jq .

# Process in batches
curl -s -X POST "https://eventflow.uixai.org/api/events/enrich-nearby-roads?distance=DISTANCE&limit=100" | jq .
```
Default distance is 100 meters. Repeat until `unnamedCount` is 0.

### For `type [arterial|collector|local]`:
```bash
# Get IDs of unnamed roads by type
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 \
  "cd ~/eventflow && docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T db psql -U nagoya_prod -d nagoya_construction -c \"
SELECT id FROM road_assets
WHERE road_type = 'TYPE'
AND (display_name IS NULL OR display_name = '');
\""

# For each ID, call apply-google-name
curl -s -X POST "https://eventflow.uixai.org/api/assets/ROAD_ID/apply-google-name" | jq .
```

### For `all [limit]`:
Not recommended due to cost. Suggest using `type` or `nearby` instead.

## Cost Estimates

| Scope | Unnamed Roads | Cost |
|-------|---------------|------|
| arterial | ~3 | Free |
| collector | ~10,055 | ~$0.28 (55 over free tier) |
| local | ~83,163 | ~$416 |
| All | ~93,221 | ~$466 |

## Environment

- Production API: `https://eventflow.uixai.org`
- EC2 host: `ubuntu@18.177.72.233`
- SSH key: `~/.ssh/eventflow-prod-key.pem`
- Database: `nagoya_construction` (user: `nagoya_prod`)

## API Endpoints

- `GET /events/enrich-road-names/status` - Event-covered unnamed roads count
- `POST /events/enrich-road-names?limit=N` - Enrich event-covered roads
- `GET /events/enrich-nearby-roads/status?distance=M` - Nearby unnamed roads count
- `POST /events/enrich-nearby-roads?distance=M&limit=N` - Enrich nearby roads
- `POST /assets/:id/apply-google-name` - Enrich single road
- `POST /assets/:id/lookup-google-name` - Lookup without saving

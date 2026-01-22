# Sync Assets Database to EC2

Sync green spaces and street lights data from local database to EC2.

## Prerequisites

- Local PostgreSQL database with data in `greenspace_assets` and `streetlight_assets` tables
- EC2 SSH access configured

## Steps

### 1. Export data from local database

Use PostgreSQL 17's pg_dump (required for compatibility):

```bash
/opt/homebrew/opt/postgresql@17/bin/pg_dump -h localhost -U mac -d nagoya_construction \
  -t greenspace_assets -t streetlight_assets \
  --data-only -F p -f /tmp/assets-backup.sql
```

Verify the export:
```bash
ls -la /tmp/assets-backup.sql
```

### 2. Transfer to EC2

```bash
scp -i ~/.ssh/eventflow-prod-key.pem /tmp/assets-backup.sql ubuntu@18.177.72.233:~
```

### 3. Import on EC2

SSH to EC2 and import:
```bash
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233

# On EC2:
docker exec -i nagoya-db psql -U postgres -d nagoya_construction < ~/assets-backup.sql
```

### 4. Verify import

```bash
docker exec nagoya-db psql -U postgres -d nagoya_construction -c "SELECT COUNT(*) FROM greenspace_assets;"
docker exec nagoya-db psql -U postgres -d nagoya_construction -c "SELECT COUNT(*) FROM streetlight_assets;"
```

## Troubleshooting

### Geometry type mismatch error
If you see `Geometry type (MultiPolygon) does not match column type (Polygon)`:

```bash
docker exec -i nagoya-db psql -U postgres -d nagoya_construction -c "
ALTER TABLE greenspace_assets
ALTER COLUMN geometry TYPE geometry(Geometry, 4326);
"
```

Then re-run the import.

### pg_dump version mismatch
Always use PostgreSQL 17's pg_dump:
```bash
/opt/homebrew/opt/postgresql@17/bin/pg_dump ...
```

## EC2 Configuration

- Host: `ubuntu@18.177.72.233`
- SSH Key: `~/.ssh/eventflow-prod-key.pem`
- Database container: `nagoya-db`
- Database: `nagoya_construction`
- User: `postgres`

## Fetching new data from OSM

To fetch fresh data from OpenStreetMap (run locally, takes time):

```bash
# Green spaces (16 wards, ~5 min each)
npx tsx scripts/osm/fetch-greenspaces.ts

# Street lights (16 wards, ~5 min each)
npx tsx scripts/osm/fetch-streetlights.ts

# Or fetch single ward for testing:
npx tsx scripts/osm/fetch-greenspaces.ts --ward=Naka-ku
```

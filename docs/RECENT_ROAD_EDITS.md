# Recent Road Edits Feature

Real-time notification system for QGIS road edits in EventFlow.

## Overview

When roads are edited in QGIS, a notification bar appears above the map showing the recently modified roads. Users can click on any road badge to:
- Fly to the road location
- Highlight/select the road on the map
- Remove the road from the notification list

## Features

| Feature | Description |
|---------|-------------|
| Real-time Push | Edits appear instantly via SSE (no page refresh needed) |
| Click to Navigate | Click a road badge to fly to and select the road |
| Auto-dismiss | Viewed roads are removed; bar hides when all viewed |
| Color Coding | Green = Created, Blue = Updated, Red = Deleted |
| Persistent History | All edit logs stored in database |

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│    QGIS     │────▶│   PostgreSQL     │────▶│    Backend      │
│  (Edit Road)│     │  (Trigger+NOTIFY)│     │  (LISTEN+SSE)   │
└─────────────┘     └──────────────────┘     └────────┬────────┘
                                                      │
                                                      ▼ SSE
                                            ┌─────────────────┐
                                            │    Frontend     │
                                            │ (EventSource)   │
                                            └────────┬────────┘
                                                      │
                                                      ▼
                                            ┌─────────────────┐
                                            │ RecentEditsBar  │
                                            │  (Notification) │
                                            └─────────────────┘
```

## Database Schema

### Table: `road_asset_edit_logs`

| Column | Type | Description |
|--------|------|-------------|
| id | varchar(50) | Primary key (REL-xxxxxxxx) |
| road_asset_id | varchar(50) | Reference to road_assets.id (no FK) |
| edit_type | varchar(20) | 'create', 'update', or 'delete' |
| road_name | varchar(255) | Road name at time of edit |
| road_display_name | varchar(255) | Display name at time of edit |
| road_ward | varchar(100) | Ward at time of edit |
| road_type | varchar(50) | Road type at time of edit |
| centroid | geometry(Point) | Center point for map navigation |
| bbox | jsonb | Bounding box [minLng, minLat, maxLng, maxLat] |
| edit_source | varchar(20) | Source of edit (default: 'manual') |
| edited_at | timestamptz | Timestamp of edit |

### Trigger: `trg_road_assets_log_edit`

- Fires on INSERT, UPDATE, DELETE of `road_assets`
- Only logs QGIS edits (`sync_source IN ('manual', 'initial', '')`)
- Skips if only `updated_at` changed (no meaningful edit)
- Sends `pg_notify('road_edit', ...)` for real-time push

## API Endpoints

### GET `/assets/recent-edits`

Returns recent road edits for notification display.

**Query Parameters:**
- `limit` (optional): Number of edits to return (default: 10)

**Response:**
```json
{
  "data": [
    {
      "id": "REL-abc12345",
      "roadAssetId": "RA-NISH-1520",
      "editType": "update",
      "roadName": "Example Road",
      "roadDisplayName": "Example Road Display",
      "roadWard": "Nishi-ku",
      "roadType": "municipal",
      "centroid": { "type": "Point", "coordinates": [136.9, 35.1] },
      "bbox": [136.89, 35.09, 136.91, 35.11],
      "editSource": "manual",
      "editedAt": "2026-01-10T12:00:00Z"
    }
  ],
  "meta": {
    "total": 42,
    "hasMore": true
  }
}
```

### GET `/sse/road-edits`

Server-Sent Events stream for real-time notifications.

**Events:**
```
data: {"type":"connected"}

data: {"id":"REL-abc12345","roadAssetId":"RA-NISH-1520","editType":"update","roadName":"Example Road","roadDisplayName":"Example Road Display"}
```

### GET `/sse/status`

Check SSE listener status.

**Response:**
```json
{
  "listening": true,
  "connectedClients": 2
}
```

## Frontend Components

### RecentEditsBar

Location: `frontend/src/components/RecentEditsBar.tsx`

Props:
- `visible: boolean` - Whether to show the bar
- `onDismiss: () => void` - Callback when user dismisses

Features:
- Tracks viewed edits in local state
- Fetches road geometry on click for accurate highlighting
- Auto-dismisses when all edits viewed
- Shows WiFi icon indicating real-time connection

### useRoadEditSSE Hook

Location: `frontend/src/hooks/useApi.ts`

```typescript
useRoadEditSSE({
  onEdit: (edit) => {
    // Called when new edit arrives
    console.log('New edit:', edit);
  }
});
```

Features:
- Auto-connects to SSE endpoint
- Auto-reconnects on error (5 second delay)
- Invalidates `recent-edits` and `assets` queries on new edit

## File Changes Summary

| File | Change |
|------|--------|
| `backend/drizzle/0012_road_edit_logs.sql` | New migration |
| `backend/src/routes/sse.ts` | New SSE endpoint |
| `backend/src/routes/assets.ts` | Added `/recent-edits` |
| `backend/src/index.ts` | Register SSE routes |
| `backend/src/db/schema.ts` | Add table definition |
| `frontend/src/hooks/useApi.ts` | Add hooks |
| `frontend/src/components/RecentEditsBar.tsx` | New component |
| `frontend/src/stores/uiStore.ts` | Add visibility state |
| `frontend/src/App.tsx` | Integrate component |

## Deployment

### Update PostgreSQL Trigger

```bash
# Connect to database container
docker exec -i nagoya-db psql -U postgres -d nagoya_construction -f - < backend/drizzle/0012_road_edit_logs.sql
```

### Restart Backend (for SSE)

```bash
cd ~/eventflow
docker compose build api && docker compose up -d api
```

### Deploy Frontend

```bash
cd ~/eventflow
docker compose build web && docker compose up -d web
```

## Troubleshooting

### SSE not connecting
1. Check SSE status: `curl http://localhost:3000/sse/status`
2. Verify PostgreSQL LISTEN is active
3. Check browser console for connection errors

### Edits not appearing
1. Verify trigger exists: Check `pg_trigger` for `trg_road_assets_log_edit`
2. Check `sync_source` value (must be 'manual', 'initial', '', or NULL)
3. Query `road_asset_edit_logs` table directly

### Permission denied in QGIS
```sql
GRANT ALL PRIVILEGES ON TABLE road_asset_edit_logs TO postgres;
GRANT INSERT, SELECT ON TABLE road_asset_edit_logs TO PUBLIC;
```

### Wrong road highlighted
- The component now fetches actual road geometry via API
- If road was deleted, geometry fetch will fail (falls back to bbox)

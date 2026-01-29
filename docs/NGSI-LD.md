# NGSI-LD Integration

This document describes the NGSI-LD integration for the Nagoya Construction Lifecycle project using FIWARE Orion-LD.

## Overview

NGSI-LD is an information model and API for context information management, standardized by ETSI. We use it to:
- Enable interoperability with other smart city systems
- Provide a standardized API for external consumers
- Support subscription-based notifications for status changes

## Principle Alignment: Asset vs Event Separation

This integration follows P1 (see `docs/architecture-principles.md`):

- **Event entities**: `ConstructionEvent`, `InspectionRecord` store time-bound operational records.
- **Asset entities**: `RoadAsset` stores authoritative, long-lived ledger data.
- **Linking**: Events reference assets via relationships (`affectedRoadAssets`, `relatedEvent`) without mixing lifecycle or workflow state.

### Architecture

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   PostgreSQL    │─────▶│   Backend API   │─────▶│   Orion-LD      │
│   (PostGIS)     │      │   (Fastify)     │      │   + MongoDB     │
│   Source of     │      │   ngsi-sync.ts  │      │   Context       │
│   Truth         │      │                 │      │   Broker        │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                                          │
                                                          ▼
                                                  ┌─────────────────┐
                                                  │   External      │
                                                  │   Systems       │
                                                  │   (Subscribers) │
                                                  └─────────────────┘
```

### Data Flow

- **One-way sync**: PostGIS → Orion-LD only
- **No writes back**: Entity data in Orion-LD is read-only from external systems
- **Subscription writes**: External systems can manage subscriptions via Orion-LD API

## Entity Schemas

### ConstructionEvent

The primary entity representing road construction events.

```json
{
  "id": "urn:ngsi-ld:ConstructionEvent:CE-001",
  "type": "ConstructionEvent",
  "@context": { ... },
  "name": {
    "type": "Property",
    "value": "Nagoya Station East Exit Road Expansion"
  },
  "status": {
    "type": "Property",
    "value": "active"
  },
  "startDate": {
    "type": "Property",
    "value": "2024-01-15T00:00:00Z"
  },
  "endDate": {
    "type": "Property",
    "value": "2024-06-30T00:00:00Z"
  },
  "restrictionType": {
    "type": "Property",
    "value": "lane-closure"
  },
  "location": {
    "type": "GeoProperty",
    "value": {
      "type": "Polygon",
      "coordinates": [[[136.881, 35.171], ...]]
    }
  },
  "postEndDecision": {
    "type": "Property",
    "value": "pending"
  },
  "department": {
    "type": "Property",
    "value": "Ryokuchi Seibi Kyoku"
  },
  "ward": {
    "type": "Property",
    "value": "Nakamura-ku"
  },
  "affectedRoadAssets": {
    "type": "Relationship",
    "object": ["urn:ngsi-ld:RoadAsset:RA-001", "urn:ngsi-ld:RoadAsset:RA-002"]
  },
  "modifiedAt": {
    "type": "Property",
    "value": "2024-01-15T09:30:00Z"
  }
}
```

#### Property Descriptions

| Property | Type | Description |
|----------|------|-------------|
| id | URI | Unique identifier in URN format |
| type | String | Always "ConstructionEvent" |
| name | Property | Human-readable event name |
| status | Property | "planned", "active", or "ended" |
| startDate | Property | ISO 8601 datetime |
| endDate | Property | ISO 8601 datetime |
| restrictionType | Property | Type of road restriction |
| location | GeoProperty | GeoJSON geometry (Polygon, LineString, etc.) |
| postEndDecision | Property | "pending", "no-change", or "permanent-change" |
| department | Property | Responsible department |
| ward | Property | Administrative ward (ku) |
| affectedRoadAssets | Relationship | Array of RoadAsset URIs |
| modifiedAt | Property | Last modification timestamp |

### RoadAsset (Phase 5)

```json
{
  "id": "urn:ngsi-ld:RoadAsset:RA-001",
  "type": "RoadAsset",
  "name": { "type": "Property", "value": "Nagoya Station East Exit Road" },
  "roadType": { "type": "Property", "value": "arterial" },
  "lanes": { "type": "Property", "value": 4 },
  "status": { "type": "Property", "value": "active" },
  "location": { "type": "GeoProperty", "value": { "type": "LineString", ... } }
}
```

### InspectionRecord (Phase 5)

```json
{
  "id": "urn:ngsi-ld:InspectionRecord:IR-001",
  "type": "InspectionRecord",
  "inspectionDate": { "type": "Property", "value": "2024-03-15" },
  "result": { "type": "Property", "value": "passed" },
  "notes": { "type": "Property", "value": "No issues found" },
  "relatedEvent": { "type": "Relationship", "object": "urn:ngsi-ld:ConstructionEvent:CE-001" },
  "location": { "type": "GeoProperty", "value": { "type": "Point", ... } }
}
```

## @context Definition

We use an inline @context to avoid external URL dependencies. The context maps our property names to standard vocabularies.

```javascript
const INLINE_CONTEXT = {
  'ngsi-ld': 'https://uri.etsi.org/ngsi-ld/',
  'fiware': 'https://uri.fiware.org/ns/data-models#',
  'schema': 'https://schema.org/',
  'ConstructionEvent': 'fiware:ConstructionEvent',
  'name': 'schema:name',
  'status': 'fiware:status',
  'startDate': 'schema:startDate',
  'endDate': 'schema:endDate',
  'restrictionType': 'fiware:restrictionType',
  'location': 'ngsi-ld:location',
  'postEndDecision': 'fiware:postEndDecision',
  'department': 'fiware:department',
  'ward': 'fiware:ward',
  'affectedRoadAssets': 'fiware:affectedRoadAssets',
  'modifiedAt': 'ngsi-ld:modifiedAt',
};
```

### Why Inline Context?

- No dependency on external context URL availability
- Faster entity creation (no context resolution delay)
- Works in air-gapped environments
- Simpler deployment

## Sync Service

The sync service (`backend/src/services/ngsi-sync.ts`) handles PostGIS to Orion-LD synchronization.

### Sync Triggers

| Operation | Trigger | Action |
|-----------|---------|--------|
| Create Event | POST /events | Create entity in Orion-LD |
| Update Event | PUT /events/:id | Update entity in Orion-LD |
| Change Status | PATCH /events/:id/status | Update entity in Orion-LD |
| Set Decision | PATCH /events/:id/decision | Update entity in Orion-LD |
| Delete Event | DELETE /events/:id | Delete entity from Orion-LD |

### Retry Mechanism

The sync service implements exponential backoff retry:

```javascript
async function syncWithRetry(operation, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      await sleep(delay);
    }
  }
}
```

### Error Handling

- Sync failures are logged but don't block the main operation
- Failed syncs can be manually reconciled (Phase 5 feature)
- PostGIS remains the source of truth

## API Endpoints

### Query Entities

```bash
# Get all ConstructionEvents
curl http://localhost:1026/ngsi-ld/v1/entities?type=ConstructionEvent

# Get specific entity
curl http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:ConstructionEvent:CE-001

# Filter by status
curl "http://localhost:1026/ngsi-ld/v1/entities?type=ConstructionEvent&q=status==%22active%22"

# Geo-query (within bounding box)
curl "http://localhost:1026/ngsi-ld/v1/entities?type=ConstructionEvent&georel=within&geometry=Polygon&coordinates=[[...]]"
```

### Subscriptions

External systems can subscribe to status changes:

```bash
# Create subscription for status changes
curl -X POST http://localhost:1026/ngsi-ld/v1/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "type": "Subscription",
    "entities": [{"type": "ConstructionEvent"}],
    "watchedAttributes": ["status"],
    "notification": {
      "endpoint": {
        "uri": "http://external-system/webhook",
        "accept": "application/json"
      }
    }
  }'

# List subscriptions
curl http://localhost:1026/ngsi-ld/v1/subscriptions

# Delete subscription
curl -X DELETE http://localhost:1026/ngsi-ld/v1/subscriptions/{id}
```

## Infrastructure

### Docker Services

```yaml
# docker-compose.yml
services:
  mongo:
    image: mongo:4.4  # Required for Orion-LD compatibility
    healthcheck:
      test: ["CMD", "mongo", "--eval", "db.adminCommand('ping')"]

  orion-ld:
    image: fiware/orion-ld:1.5.1
    platform: linux/amd64  # Required for Apple Silicon
    depends_on:
      mongo:
        condition: service_healthy
    environment:
      ORIONLD_MONGO_HOST: mongo
      ORIONLD_MONGO_DB: orionld
    healthcheck:
      test: ["CMD-SHELL", "wget -q --spider http://localhost:1026/version || exit 1"]
```

### Health Check

```bash
# Check Orion-LD status
curl http://localhost:1026/version

# Expected response
{
  "orionld version": "1.5.1",
  "based on orion": "1.15.0-next",
  ...
}
```

## Troubleshooting

### MongoDB Compatibility

**Problem**: Orion-LD crashes with "Unsupported OP_QUERY command"

**Cause**: MongoDB 6+ removed legacy wire protocol (OP_QUERY)

**Solution**: Use MongoDB 4.4

```yaml
mongo:
  image: mongo:4.4  # Not mongo:6 or mongo:latest
```

### Context Resolution Errors

**Problem**: "LdContextNotAvailable" error

**Cause**: External @context URL is unreachable

**Solution**: Use inline @context (already implemented)

### Entity Not Found After Create

**Problem**: Entity created but not queryable

**Cause**: Entity ID format incorrect

**Solution**: Ensure URN format: `urn:ngsi-ld:EntityType:id`

### Healthcheck Failures

**Problem**: Orion-LD healthcheck fails with "curl not found"

**Cause**: curl is not installed in orion-ld image

**Solution**: Use wget instead

```yaml
healthcheck:
  test: ["CMD-SHELL", "wget -q --spider http://localhost:1026/version || exit 1"]
```

### Sync Not Working

**Debug Steps**:

1. Check Orion-LD is running:
   ```bash
   curl http://localhost:1026/version
   ```

2. Check MongoDB connection:
   ```bash
   docker logs nagoya-orion-ld 2>&1 | grep -i mongo
   ```

3. Check sync logs in backend:
   ```bash
   docker logs nagoya-api 2>&1 | grep NGSI-LD
   ```

4. Manually verify entity exists:
   ```bash
   curl http://localhost:1026/ngsi-ld/v1/entities/urn:ngsi-ld:ConstructionEvent:CE-001
   ```

## Future Enhancements (Phase 5+)

- [ ] Dead letter queue for failed syncs
- [ ] Manual reconciliation UI
- [ ] Sync health monitoring dashboard
- [ ] RoadAsset entity sync
- [ ] InspectionRecord entity sync
- [ ] Batch sync for bulk operations

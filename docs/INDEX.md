# Documentation Index

This document provides an overview of all project documentation.

## Planning & Architecture

Documents related to project planning, migration strategies, and architectural decisions.

| Document | Description |
|----------|-------------|
| [project-plan.md](planning/project-plan.md) | Project execution plan with phased implementation details |
| [postgis-migration-plan.md](planning/postgis-migration-plan.md) | Database migration strategy from JSON to PostGIS geometry |
| [road-asset-alignment.md](planning/road-asset-alignment.md) | OSRM routing API integration and road matching |

## Integration & Middleware

Technical integration documentation for external systems.

| Document | Description |
|----------|-------------|
| [ngsi-ld.md](ngsi-ld.md) | NGSI-LD smart city standard integration with Orion-LD |
| [qgis-setup-guide.md](qgis-setup-guide.md) | QGIS desktop GIS tool setup and configuration (中文) |

## Features & Implementation

User-facing features and frontend implementation details.

| Document | Description |
|----------|-------------|
| [import-export.md](import-export.md) | Import/Export feature with versioning and rollback |
| [realtime-map-sync.md](realtime-map-sync.md) | Real-time map tile synchronization with Martin Tile Server |
| [recent-road-edits.md](recent-road-edits.md) | Road edit notification system using SSE |
| [map-implementation.md](map-implementation.md) | MapLibre GL JS frontend map implementation |

## Directory Structure

```
docs/
├── INDEX.md                    # This file
├── import-export.md            # Import/Export feature
├── ngsi-ld.md                  # NGSI-LD integration
├── qgis-setup-guide.md         # QGIS setup guide
├── realtime-map-sync.md        # Real-time sync
├── recent-road-edits.md        # Road edit notifications
├── map-implementation.md       # Map implementation
└── planning/
    ├── project-plan.md         # Project plan
    ├── postgis-migration-plan.md  # PostGIS migration
    └── road-asset-alignment.md    # Road alignment
```

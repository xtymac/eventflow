# Nagoya Construction Lifecycle

A GIS + workflow prototype for road construction lifecycle management, targeting local government road management staff in Nagoya.

## Tech Stack

- **Frontend**: React + TypeScript + Vite, Mantine UI, Zustand, React Query, MapLibre GL JS
- **Backend**: Node.js + TypeScript + Fastify, Drizzle ORM
- **Database**: PostgreSQL + PostGIS
- **NGSI-LD**: FIWARE Orion-LD context broker
- **DevOps**: Docker Compose

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- npm or pnpm

### Development Setup

1. **Start infrastructure services**:
   ```bash
   docker compose up -d db mongo orion-ld
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Generate database migrations**:
   ```bash
   cd backend
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   cd ..
   ```

4. **Start development servers**:
   ```bash
   npm run dev
   ```

   This starts:
   - Backend API at http://localhost:3000
   - Frontend at http://localhost:5173

### Full Docker Setup

Run everything in containers:

```bash
docker compose up -d
```

## Project Structure

```
nagoya-construction-lifecycle/
├── backend/                 # Fastify API server
│   ├── src/
│   │   ├── db/             # Database schema & migrations
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic
│   │   └── ngsi/           # NGSI-LD context files
│   └── drizzle/            # Migration files
├── frontend/               # React application
│   └── src/
│       ├── components/     # UI components
│       ├── features/       # Feature modules
│       ├── hooks/          # Custom hooks
│       └── stores/         # Zustand state
├── shared/                 # Shared TypeScript types
└── sample-data/            # Sample GeoJSON data
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/events` | GET, POST | List/Create events |
| `/events/:id` | GET, PUT | Get/Update event |
| `/events/:id/status` | PATCH | Change status |
| `/events/:id/decision` | PATCH | Set post-end decision |
| `/assets` | GET, POST | List/Create assets |
| `/assets/:id` | GET, PUT | Get/Update asset |
| `/assets/:id/retire` | PATCH | Retire asset |
| `/inspections` | GET, POST | List/Create inspections |
| `/import/geojson` | POST | Import GeoJSON |
| `/export/geojson` | GET | Export GeoJSON |

## Key Features

- **Construction Event Lifecycle**: Planned → Active → Ended
- **Map Visualization**: Events and road assets displayed on MapLibre GL JS
- **Post-End Decision**: Permanent change or archive after event ends
- **Road Asset Traceability**: All changes linked to source events
- **NGSI-LD Sync**: Real-time sync to Orion-LD context broker

## Environment Variables

### Backend
- `DATABASE_URL`: PostgreSQL connection string
- `ORION_LD_URL`: Orion-LD endpoint
- `PORT`: Server port (default: 3000)
- `TZ`: Timezone (default: Asia/Tokyo)

### Frontend
- `VITE_API_URL`: Backend API URL

## License

Private - Eukarya Inc.

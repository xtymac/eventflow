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

## EC2 Production Deployment

### Deployment Architecture

Three versions are deployed on the same EC2 server with isolated services:

| Domain | Version | Branch | Purpose | Container Prefix | Database |
|--------|---------|--------|---------|------------------|----------|
| **v1.eventflow.uixai.org** | V1 (Frozen) | `main` (tag: v1.0.0) | Stable production baseline | `nagoya-*-v1` | `nagoya_construction_v1` |
| **eventflow.uixai.org** | Current | `main` | Active development | `nagoya-*` | `nagoya_construction` |
| **demo.eventflow.uixai.org** | Auth Demo | `frontend` | Role-based access control demo | `nagoya-demo-*` | `nagoya_construction_demo` |

**Key Features by Version:**
- **V1**: Original feature set (frozen)
- **Current**: Latest features + bug fixes
- **Demo**: Showcase for department-scoped authentication system

### Server Details
- **Host**: EC2 (ubuntu@18.177.72.233)
- **SSH**: `ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233`
- **Reverse Proxy**: Caddy (handles all three domains)

### Deployment Commands

#### Deploy Main Application (eventflow.uixai.org)

```bash
# SSH to server
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233

# Navigate to project
cd ~/eventflow

# Update code
git pull origin main

# Rebuild and restart main services
docker compose up -d --build

# Restart Caddy to pick up config changes
docker restart nagoya-caddy
```

#### Deploy Demo (demo.eventflow.uixai.org)

See detailed guide: [docs/DEMO_DEPLOYMENT.md](docs/DEMO_DEPLOYMENT.md)

```bash
# SSH to server
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233
cd ~/eventflow

# Checkout demo branch
git fetch origin
git checkout frontend
git pull origin frontend

# Build and start demo services
docker compose -f docker-compose.demo.yml up -d --build

# Restart Caddy
docker restart nagoya-caddy
```

#### Deploy V1 (v1.eventflow.uixai.org)

V1 is frozen and should not be updated unless critical security fixes are needed.

```bash
# Use docker-compose.v1.yml if updates are necessary
docker compose -f docker-compose.v1.yml up -d --build
```

### Important Configuration Notes

1. **PostgreSQL Password Fix**: The database volume may have a different password than docker-compose.yml. A `docker-compose.override.yml` is configured to automatically reset the password via healthcheck:
   ```yaml
   services:
     db:
       healthcheck:
         test: ["CMD-SHELL", "pg_isready -U postgres && psql -U postgres -c \"ALTER USER postgres WITH PASSWORD 'postgres'\" > /dev/null 2>&1 || true"]
   ```

2. **Uploads Volume Mount**: The API container requires access to the uploads directory for import diffs and snapshots:
   ```yaml
   volumes:
     - ./backend/uploads:/app/uploads
   ```

3. **Services by Version**:

   **Main (eventflow.uixai.org)**:
   - `nagoya-api`: Backend API
   - `nagoya-web`: Frontend
   - `nagoya-db`: PostgreSQL + PostGIS
   - `nagoya-martin`: MVT tile server
   - `nagoya-mongo`: MongoDB for NGSI-LD
   - `nagoya-orion-ld`: FIWARE Orion-LD

   **V1 (v1.eventflow.uixai.org)**:
   - `nagoya-api-v1`: Backend API (frozen)
   - `nagoya-web-v1`: Frontend (frozen)
   - `nagoya-db-v1`: PostgreSQL + PostGIS
   - `nagoya-martin-v1`: MVT tile server

   **Demo (demo.eventflow.uixai.org)**:
   - `nagoya-demo-api`: Backend API
   - `nagoya-demo-web`: Frontend with auth system
   - `nagoya-demo-db`: PostgreSQL + PostGIS
   - `nagoya-demo-martin`: MVT tile server
   - `nagoya-demo-mongo`: MongoDB for NGSI-LD
   - `nagoya-demo-orion-ld`: FIWARE Orion-LD

   **Shared**:
   - `nagoya-caddy`: Reverse proxy with HTTPS (serves all three domains)

### Troubleshooting

```bash
# Check API logs
docker logs nagoya-api --tail 50

# Reset DB password manually if needed
docker exec nagoya-db psql -U postgres -c "ALTER USER postgres WITH PASSWORD 'postgres';"
docker restart nagoya-api nagoya-martin
```

## License

Private - Eukarya Inc.

# Demo Deployment Guide

This document describes how to deploy the Auth Role System Demo to `demo.eventflow.uixai.org`.

## Overview

The demo showcases department-scoped authentication and role-based access control for Nagoya City's park management system.

**Demo URL**: https://demo.eventflow.uixai.org/

**Features**:
- Login page with role selection (管理者 / 利用者)
- Section-based access control (park-mgmt, tree-mgmt)
- Department-scoped permissions
- Professional UI matching Figma design specs

## Architecture

### Three Deployed Versions

| Domain | Version | Purpose | Branch/Tag |
|--------|---------|---------|------------|
| `v1.eventflow.uixai.org` | V1 (Frozen) | Stable production | `main` (frozen) |
| `eventflow.uixai.org` | Current | Active development | `main` |
| `demo.eventflow.uixai.org` | Demo | Auth role system demo | `frontend` |

### Demo Services

All demo services use the `demo-` prefix to avoid conflicts:

- `demo-web`: Frontend (Vite + React + Mantine)
- `demo-api`: Backend (Fastify + Drizzle + PostGIS)
- `demo-db`: PostgreSQL 16 with PostGIS
- `demo-martin`: Vector tile server
- `demo-mongo`: MongoDB for NGSI-LD
- `demo-orion-ld`: FIWARE Orion-LD context broker

## Deployment Steps

### 1. SSH to EC2 Server

```bash
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233
cd ~/eventflow
```

### 2. Checkout Demo Branch

```bash
git fetch origin
git checkout frontend
git pull origin frontend
```

### 3. Build and Start Demo Services

```bash
# Build containers
docker compose -f docker-compose.demo.yml build

# Start demo services
docker compose -f docker-compose.demo.yml up -d

# Check service health
docker compose -f docker-compose.demo.yml ps
```

### 4. Initialize Demo Database

```bash
# Run migrations
docker exec -it nagoya-demo-api npm run db:migrate

# Seed demo data (optional)
docker exec -it nagoya-demo-api npm run db:seed
```

### 5. Restart Caddy

Caddy will automatically pick up the new `demo.eventflow.uixai.org` configuration:

```bash
docker restart nagoya-caddy
docker logs -f nagoya-caddy
```

### 6. Verify Deployment

Visit https://demo.eventflow.uixai.org/ and test:

1. **Login Page**
   - Should show professional login UI
   - Two role options: 管理者 / 利用者

2. **Admin Login** (管理者)
   - Username: any
   - Password: any
   - Role: 管理者（技術指導課）
   - Should see all navigation items

3. **User Login** (利用者)
   - Username: any
   - Password: any
   - Role: 利用者（緑地部／公園緑地課、各土木事務所）
   - Should only see 地図 and 案件管理

## Monitoring

### Check Service Logs

```bash
# All demo services
docker compose -f docker-compose.demo.yml logs -f

# Specific service
docker logs -f nagoya-demo-web
docker logs -f nagoya-demo-api
```

### Check Container Status

```bash
docker compose -f docker-compose.demo.yml ps
```

### Database Access

```bash
# Connect to demo database
docker exec -it nagoya-demo-db psql -U postgres -d nagoya_construction_demo
```

## Updating Demo

When the `frontend` branch is updated:

```bash
cd ~/eventflow
git pull origin frontend
docker compose -f docker-compose.demo.yml build
docker compose -f docker-compose.demo.yml up -d
```

## Syncing to Demo Repository

To push this demo to the separate repository:

```bash
# Add demo repository as remote
git remote add demo-repo https://github.com/eukarya-inc/urban-infrastructure-dx-platform-system-demo

# Push demo branch
git push demo-repo frontend:main
```

## Troubleshooting

### Demo Not Accessible

1. Check Caddy logs: `docker logs nagoya-caddy`
2. Verify DNS: `nslookup demo.eventflow.uixai.org`
3. Check service health: `docker compose -f docker-compose.demo.yml ps`

### 403 Forbidden Errors

- Clear browser localStorage
- Try incognito/private window
- Check browser console for errors

### Database Connection Issues

```bash
# Check database health
docker exec nagoya-demo-db pg_isready -U postgres -d nagoya_construction_demo

# Restart database
docker compose -f docker-compose.demo.yml restart demo-db
```

## Local Development

To run the demo locally:

```bash
# Frontend
cd frontend
npm run dev

# Backend
cd backend
npm run dev
```

The demo will use the auth role system from the `frontend` branch.

## Security Notes

- This is a demo with mock authentication (no real backend auth)
- Passwords are not validated
- Role selection is client-side only
- **Do not use in production without proper backend authentication**

## Related Documents

- [Router Design](https://www.notion.so/eukarya/Router-Design-30616e0fb165804d9b4ad21a366289a0)
- [Implementation Plan](/Users/mac/.claude/plans/stateless-watching-clover.md)
- Main README: [README.md](../README.md)

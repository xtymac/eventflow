# Deployment Summary - Three Version Architecture

## Overview

This project now supports **three separate deployments** on the same EC2 server, each with isolated services and databases.

## Architecture Summary

```
EC2 Server (18.177.72.233)
├── Caddy (Reverse Proxy)
│   ├── v1.eventflow.uixai.org    → nagoya-*-v1 containers
│   ├── eventflow.uixai.org       → nagoya-* containers
│   └── demo.eventflow.uixai.org  → nagoya-demo-* containers
│
├── V1 Stack (Frozen)
│   ├── nagoya-api-v1
│   ├── nagoya-web-v1
│   ├── nagoya-db-v1 (nagoya_construction_v1)
│   └── nagoya-martin-v1
│
├── Main Stack (Active Development)
│   ├── nagoya-api
│   ├── nagoya-web
│   ├── nagoya-db (nagoya_construction)
│   ├── nagoya-martin
│   ├── nagoya-mongo
│   └── nagoya-orion-ld
│
└── Demo Stack (Auth Role System)
    ├── nagoya-demo-api
    ├── nagoya-demo-web
    ├── nagoya-demo-db (nagoya_construction_demo)
    ├── nagoya-demo-martin
    ├── nagoya-demo-mongo
    └── nagoya-demo-orion-ld
```

## Version Details

| Aspect | V1 | Main | Demo |
|--------|-----|------|------|
| **Domain** | v1.eventflow.uixai.org | eventflow.uixai.org | demo.eventflow.uixai.org |
| **Branch** | `main` (tag: v1.0.0) | `main` | `frontend` |
| **Status** | Frozen ❄️ | Active 🔄 | Demo 🎭 |
| **Purpose** | Production baseline | Latest features | Auth showcase |
| **Docker Compose** | `docker-compose.v1.yml` | `docker-compose.yml` | `docker-compose.demo.yml` |
| **Container Prefix** | `nagoya-*-v1` | `nagoya-*` | `nagoya-demo-*` |
| **Database Name** | `nagoya_construction_v1` | `nagoya_construction` | `nagoya_construction_demo` |
| **Updates** | Critical fixes only | Regular updates | As needed for demo |

## Key Features by Version

### V1 (Frozen Production)
- Original EventFlow feature set
- Stable baseline for comparison
- No updates unless critical security fixes

### Main (Active Development)
- All latest features
- Bug fixes and improvements
- Regular deployments
- Full NGSI-LD integration

### Demo (Auth Role System)
- **Login page** with role selection (管理者/利用者)
- **Department-scoped permissions**:
  - Admin (技術指導課): Full access
  - User (緑地部): Limited access (map, cases only)
- **Section guards**: park-mgmt, tree-mgmt access control
- **Professional UI** matching Figma design specs
- Mock authentication (frontend-only, no backend auth)

## Current Branch Status

```bash
$ git branch -a
  feature/pmtiles-prerender
* frontend  ← YOU ARE HERE
  main
  remotes/origin/frontend
  remotes/origin/main
```

All demo-related commits are on `frontend` branch.

## Deployment Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Main application stack |
| `docker-compose.v1.yml` | V1 frozen stack |
| `docker-compose.demo.yml` | Demo auth system stack |
| `Caddyfile` | Reverse proxy config for all three domains |
| `docs/DEMO_DEPLOYMENT.md` | Detailed demo deployment guide |
| `README.md` | Updated with three-version architecture |

## Next Steps

### 1. Deploy Demo to EC2 (READY TO DEPLOY)

All code is committed and pushed. To deploy:

```bash
# SSH to EC2
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233

# Navigate to project
cd ~/eventflow

# Fetch and checkout demo branch
git fetch origin
git checkout frontend
git pull origin frontend

# Build and start demo services
docker compose -f docker-compose.demo.yml up -d --build

# Initialize demo database
docker exec -it nagoya-demo-api npm run db:migrate
docker exec -it nagoya-demo-api npm run db:seed

# Restart Caddy to pick up new config
docker restart nagoya-caddy

# Check logs
docker compose -f docker-compose.demo.yml logs -f
```

### 2. Verify Deployment

Visit https://demo.eventflow.uixai.org/ and test:

1. **Login Page**:
   - Should show professional UI with header/footer
   - Two role options: 管理者（技術指導課）/ 利用者（緑地部）

2. **As Admin**:
   - Login with any username/password, select 管理者
   - Should see all navigation: 公園管理, 地図, 案件管理, 業者管理
   - Red badge for role

3. **As User**:
   - Login with any username/password, select 利用者
   - Should only see: 地図, 案件管理
   - Blue badge for role
   - Accessing /park-mgmt directly should redirect to /403

### 3. Sync to Demo Repository (Optional)

If you want to push to the separate `urban-infrastructure-dx-platform-system-demo` repo:

```bash
# On local machine
cd ~/Business\ Dropbox/Dropbox/Project/Eukarya/Project/EventFlow/nagoya-construction-lifecycle

# Add demo repo as remote (if not already added)
git remote add demo-repo https://github.com/eukarya-inc/urban-infrastructure-dx-platform-system-demo

# Push demo branch to demo repo's main branch
git push demo-repo frontend:main
```

## Monitoring

### Check All Services

```bash
# Main services
docker compose ps

# V1 services
docker compose -f docker-compose.v1.yml ps

# Demo services
docker compose -f docker-compose.demo.yml ps
```

### View Logs

```bash
# All demo logs
docker compose -f docker-compose.demo.yml logs -f

# Specific demo service
docker logs -f nagoya-demo-web
docker logs -f nagoya-demo-api

# Caddy (handles all three domains)
docker logs -f nagoya-caddy
```

### Database Access

```bash
# Main database
docker exec -it nagoya-db psql -U postgres -d nagoya_construction

# V1 database
docker exec -it nagoya-db-v1 psql -U postgres -d nagoya_construction_v1

# Demo database
docker exec -it nagoya-demo-db psql -U postgres -d nagoya_construction_demo
```

## Summary of Changes

### Commits on `frontend`:

1. ✅ Auth system implementation (23 files, 2244+ insertions)
2. ✅ Caddyfile update for demo.eventflow.uixai.org
3. ✅ docker-compose.demo.yml creation
4. ✅ DEMO_DEPLOYMENT.md documentation
5. ✅ README.md architecture update

### Files Modified:

- `Caddyfile` - Added demo.eventflow.uixai.org config
- `docker-compose.demo.yml` - New file for demo stack
- `docs/DEMO_DEPLOYMENT.md` - New deployment guide
- `README.md` - Updated with three-version architecture
- `frontend/src/*` - Auth system components and pages

## Rollback Plan

If demo deployment fails, the main and v1 services are unaffected. Simply:

```bash
# Stop demo services
docker compose -f docker-compose.demo.yml down

# Revert Caddyfile (optional)
git checkout main -- Caddyfile
docker restart nagoya-caddy
```

## Support

- **Main Documentation**: [README.md](README.md)
- **Demo Guide**: [docs/DEMO_DEPLOYMENT.md](docs/DEMO_DEPLOYMENT.md)
- **Router Design**: [Notion - Router Design](https://www.notion.so/eukarya/Router-Design-30616e0fb165804d9b4ad21a366289a0)
- **Implementation Plan**: `/Users/mac/.claude/plans/stateless-watching-clover.md`

---

**Status**: ✅ Ready to deploy to EC2
**Branch**: `frontend`
**Last Updated**: 2026-02-14

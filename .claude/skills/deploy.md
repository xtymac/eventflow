# Deploy to EC2

Deploy the application to EC2 production server.

## EC2 Configuration

- Host: `ubuntu@18.177.72.233`
- SSH Key: `~/.ssh/eventflow-prod-key.pem`
- Project path: `~/eventflow`

## Three-Version Architecture

| Version | Domain | Containers | Database | Status |
|---------|--------|------------|----------|--------|
| **Main** | eventflow.uixai.org | `nagoya-*` | nagoya_construction | Active development |
| **V1** | v1.eventflow.uixai.org | `nagoya-*-v1` | nagoya_construction_v1 | Frozen baseline |
| **Demo** | demo.eventflow.uixai.org | `nagoya-demo-*` | nagoya_construction_demo | Auth showcase |

## Quick Deploy (Main Stack)

### 1. Build frontend locally (to catch TypeScript errors)
```bash
cd frontend && npm run build
```

### 2. Upload changed files to EC2
```bash
# Upload specific files (adjust paths as needed)
scp -i ~/.ssh/eventflow-prod-key.pem <local-file> ubuntu@18.177.72.233:~/eventflow/<remote-path>

# Or upload entire directory
scp -i ~/.ssh/eventflow-prod-key.pem -r frontend/src ubuntu@18.177.72.233:~/eventflow/frontend/
scp -i ~/.ssh/eventflow-prod-key.pem -r backend/src ubuntu@18.177.72.233:~/eventflow/backend/
```

### 3. Restart containers on EC2
```bash
# For frontend changes only
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 "docker restart nagoya-web"

# For backend changes
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 "docker restart nagoya-api"

# Full rebuild (if dependencies changed)
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 "cd ~/eventflow && docker compose up -d --build"
```

### 4. Verify deployment
```bash
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 "docker ps --format 'table {{.Names}}\t{{.Status}}' && curl -sf http://localhost:3000/health"
```

## Full Dual-Stack Deploy

For deploying both main and v1 stacks (e.g., after infrastructure changes):

```bash
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 "bash ~/eventflow/scripts/deploy-dual-stack.sh"
```

## Quick Deploy (Demo Stack)

Deploy from feature branch (e.g., frontend):

### 1. Upload changed files
```bash
# Upload key files
scp -i ~/.ssh/eventflow-prod-key.pem frontend/package.json ubuntu@18.177.72.233:~/eventflow/frontend/
scp -i ~/.ssh/eventflow-prod-key.pem frontend/vite.config.ts ubuntu@18.177.72.233:~/eventflow/frontend/
scp -i ~/.ssh/eventflow-prod-key.pem docker-compose.demo.yml ubuntu@18.177.72.233:~/eventflow/
scp -i ~/.ssh/eventflow-prod-key.pem Caddyfile ubuntu@18.177.72.233:~/eventflow/

# Upload source directories
scp -i ~/.ssh/eventflow-prod-key.pem -r frontend/src ubuntu@18.177.72.233:~/eventflow/frontend/
scp -i ~/.ssh/eventflow-prod-key.pem -r backend/src ubuntu@18.177.72.233:~/eventflow/backend/
scp -i ~/.ssh/eventflow-prod-key.pem -r shared ubuntu@18.177.72.233:~/eventflow/
```

### 2. Rebuild and restart demo services
```bash
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 "cd ~/eventflow && docker compose -f docker-compose.demo.yml build && docker compose -f docker-compose.demo.yml up -d"
```

### 3. Initialize database (first deployment only)
```bash
# Create nanoid function
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 "docker exec nagoya-demo-db psql -U postgres -d nagoya_construction_demo -c \"CREATE OR REPLACE FUNCTION nanoid() RETURNS text AS \\\$\\\$ SELECT substr(md5(random()::text), 1, 12) \\\$\\\$ LANGUAGE SQL VOLATILE;\""

# Run migrations and seed
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 "docker exec nagoya-demo-api npm run db:migrate && docker exec nagoya-demo-api npm run db:seed"
```

### 4. Restart Caddy and verify
```bash
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 "docker restart nagoya-caddy"
curl -I https://demo.eventflow.uixai.org/
curl https://demo.eventflow.uixai.org/api/health
```

## URLs

- Main: https://eventflow.uixai.org/
- V1 (frozen): https://v1.eventflow.uixai.org/
- Demo: https://demo.eventflow.uixai.org/

## Troubleshooting

### General
```bash
# Check container logs
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 "docker logs nagoya-web --tail 50"
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 "docker logs nagoya-api --tail 50"
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 "docker logs nagoya-caddy --tail 50"

# Check disk space
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 "df -h"

# Clean up Docker resources (frees ~10GB)
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 "docker system prune -af"

# Check resource usage
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 "docker stats --no-stream"
```

### Demo-Specific Issues

**503 Service Unavailable:**
```bash
# Check demo container status
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 "docker ps --filter 'name=nagoya-demo'"

# Check healthcheck status
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 "docker inspect nagoya-demo-api --format='{{json .State.Health}}' | jq"
```

**403 Forbidden on frontend:**
- Ensure `demo.eventflow.uixai.org` is in vite.config.ts allowedHosts
- Rebuild demo-web after vite.config.ts changes

**Module not found errors:**
- Check if frontend/package.json was uploaded
- Rebuild demo-web: `docker compose -f docker-compose.demo.yml build demo-web`

**Database migration errors:**
- Ensure nanoid() function exists in demo database
- Check shared directory is mounted at `/shared` (not `/app/shared`)

## Notes

- EC2 project is deployed via scp (not git)
- Always build locally first to catch TypeScript errors
- v1 stack is frozen - do not deploy to it unless intentionally unfreezing
- Caddy auto-reloads when Caddyfile changes are uploaded

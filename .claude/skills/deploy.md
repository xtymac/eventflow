# Deploy to EC2

Deploy the application to EC2 production server.

## EC2 Configuration

- Host: `ubuntu@18.177.72.233`
- SSH Key: `~/.ssh/eventflow-prod-key.pem`
- Main project path: `~/eventflow`
- v1 frozen project path: `~/eventflow-v1`
- Web container (main): `nagoya-web`
- Web container (v1): `nagoya-web-v1`

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

## URLs

- Main: https://eventflow.uixai.org/
- v1 (frozen): https://v1.eventflow.uixai.org/

## Troubleshooting

```bash
# Check container logs
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 "docker logs nagoya-web --tail 50"
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 "docker logs nagoya-api --tail 50"
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 "docker logs nagoya-caddy --tail 50"

# Check disk space
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 "df -h"

# Clean up Docker resources
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 "docker system prune -af"

# Check resource usage
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 "docker stats --no-stream"
```

## Notes

- EC2 project is deployed via scp (not git)
- Always build locally first to catch TypeScript errors
- v1 stack is frozen - do not deploy to it unless intentionally unfreezing
- Caddy auto-reloads when Caddyfile changes are uploaded

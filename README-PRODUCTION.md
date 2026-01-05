# Production Deployment Guide

This guide covers deploying the Nagoya Construction Lifecycle application to production using Docker Compose with automatic HTTPS via Caddy.

## Architecture

- **Reverse Proxy**: Caddy (automatic SSL with Let's Encrypt)
- **Frontend**: React/Vite → Nginx (static files)
- **Backend**: Fastify API (Node.js)
- **Databases**: PostgreSQL 16 + PostGIS, MongoDB 4.4
- **Context Broker**: FIWARE Orion-LD
- **Infrastructure**: AWS EC2 (Ubuntu 22.04, t3.medium recommended)

## Quick Start - Local Testing

### Prerequisites

- Docker and Docker Compose installed
- At least 4GB RAM available

### 1. Navigate to Project Directory

```bash
cd "/Users/mac/Maku Box Dropbox/Maku Box/Project/Eukarya/Project/EventFlow/nagoya-construction-lifecycle"
```

### 2. Build Production Images

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod.local build
```

### 3. Start All Services

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod.local up -d
```

### 4. Run Database Migrations

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod.local exec -T api node dist/db/migrate.js
```

### 5. Verify Deployment

```bash
# Check service health
docker compose -f docker-compose.prod.yml --env-file .env.prod.local ps

# Test API
curl -k https://localhost/api/health

# Test frontend (open in browser)
open https://localhost
```

## Service Management

### Check Service Status

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod.local ps
```

### View Logs

```bash
# All services
docker compose -f docker-compose.prod.yml --env-file .env.prod.local logs -f

# Specific service
docker compose -f docker-compose.prod.yml --env-file .env.prod.local logs -f api
docker compose -f docker-compose.prod.yml --env-file .env.prod.local logs -f web
docker compose -f docker-compose.prod.yml --env-file .env.prod.local logs -f caddy
```

### Stop Services

```bash
# Stop services (keep data)
docker compose -f docker-compose.prod.yml --env-file .env.prod.local down

# Stop and remove volumes (fresh start)
docker compose -f docker-compose.prod.yml --env-file .env.prod.local down -v
```

### Restart Services

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod.local restart
```

### Rebuild After Code Changes

```bash
# Rebuild specific service
docker compose -f docker-compose.prod.yml --env-file .env.prod.local build api
docker compose -f docker-compose.prod.yml --env-file .env.prod.local build web

# Rebuild and restart
docker compose -f docker-compose.prod.yml --env-file .env.prod.local up -d --build
```

## AWS EC2 Production Deployment

### Step 1: Launch EC2 Instance

1. **Instance Configuration**:
   - AMI: Ubuntu 22.04 LTS
   - Instance Type: t3.medium (2 vCPU, 4GB RAM)
   - Storage: 30GB GP3 SSD

2. **Security Group**:
   - SSH (22): Your IP only
   - HTTP (80): 0.0.0.0/0
   - HTTPS (443): 0.0.0.0/0

3. **Allocate Elastic IP** and attach to instance

### Step 2: Configure DNS

1. Create an A record in your DNS provider:
   ```
   your-domain.com → <elastic-ip>
   ```

2. Wait for DNS propagation (5-30 minutes)

3. Verify:
   ```bash
   nslookup your-domain.com
   ```

### Step 3: Setup EC2 Instance

```bash
# SSH to instance
ssh ubuntu@<elastic-ip>

# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo apt-get install -y docker-compose-plugin

# Log out and back in
exit
ssh ubuntu@<elastic-ip>

# Verify installation
docker --version
docker compose version

# Configure firewall
sudo apt-get install -y ufw
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# Setup swap (recommended)
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Step 4: Deploy Application

```bash
# Clone repository
cd ~
git clone https://github.com/your-org/nagoya-construction-lifecycle.git
cd nagoya-construction-lifecycle

# Create production environment file
cp .env.example .env.prod
nano .env.prod
```

**Edit `.env.prod`** with production values:

```bash
# Domain (your actual domain)
DOMAIN=your-domain.com

# PostgreSQL (generate strong passwords)
POSTGRES_DB=nagoya_construction
POSTGRES_USER=nagoya_prod
POSTGRES_PASSWORD=$(openssl rand -base64 32)

# Orion-LD / Mongo
ORIONLD_MONGO_DB=orionld

# App
TZ=Asia/Tokyo
LOG_LEVEL=info

# Optional - Google Maps API Key
GOOGLE_MAPS_API_KEY=your_api_key_here
```

```bash
# Secure environment file
chmod 600 .env.prod

# Build production images
docker compose -f docker-compose.prod.yml --env-file .env.prod build

# Start database services first
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d db mongo

# Wait for healthy status (check with 'docker compose ps')
sleep 20

# Run migrations
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T api node dist/db/migrate.js

# Start all services
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# Monitor startup
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f
```

### Step 5: Verify Deployment

```bash
# Check service health
docker compose -f docker-compose.prod.yml --env-file .env.prod ps

# Test API
curl https://your-domain.com/api/health

# Check Caddy SSL certificate
docker logs <caddy-container-name> | grep "certificate obtained"
```

Open browser: `https://your-domain.com`

## Database Backups

### Setup S3 Bucket

```bash
# Create S3 bucket
aws s3 mb s3://nagoya-production-backups --region ap-northeast-1

# Enable versioning
aws s3api put-bucket-versioning \
    --bucket nagoya-production-backups \
    --versioning-configuration Status=Enabled
```

### Configure Backup Script

Edit `.env.prod` to add:

```bash
# Backups
BACKUP_S3_BUCKET=nagoya-production-backups
AWS_REGION=ap-northeast-1
BACKUP_RETENTION_DAYS=30
```

### Test Backup

```bash
chmod +x scripts/backup-db.sh
./scripts/backup-db.sh
```

### Schedule Daily Backups

```bash
# Edit crontab
crontab -e

# Add (runs daily at 2 AM JST)
0 2 * * * /home/ubuntu/nagoya-construction-lifecycle/scripts/backup-db.sh >> /var/log/backups.log 2>&1
```

## Troubleshooting

### Services Not Starting

```bash
# Check service logs
docker compose -f docker-compose.prod.yml --env-file .env.prod.local logs db
docker compose -f docker-compose.prod.yml --env-file .env.prod.local logs api

# Check health status
docker inspect <container-name> | jq '.[0].State.Health'
```

### Database Connection Errors

```bash
# Verify environment variables
docker exec <api-container> env | grep DATABASE_URL

# Test database connection
docker exec <db-container> psql -U nagoya_prod -d nagoya_construction -c "SELECT version();"

# Check database users
docker exec <db-container> psql -U nagoya_prod -d nagoya_construction -c "\du"
```

### Caddy SSL Certificate Issues

```bash
# Check DNS resolution
nslookup your-domain.com

# Check Caddy logs
docker logs <caddy-container>

# Verify ports are open
sudo ufw status
netstat -tuln | grep -E ':(80|443)'
```

### Frontend Not Loading

```bash
# Check Nginx logs
docker exec <web-container> cat /var/log/nginx/error.log

# Verify static files built
docker exec <web-container> ls -lh /usr/share/nginx/html
```

### Migration Errors

```bash
# Check drizzle directory exists in container
docker exec <api-container> ls -la /app/backend/drizzle

# Check DATABASE_URL is set
docker exec <api-container> env | grep DATABASE_URL

# Run migrations manually
docker compose -f docker-compose.prod.yml --env-file .env.prod.local exec api node dist/db/migrate.js
```

### Out of Memory

```bash
# Check memory usage
free -h
docker stats

# Check swap
swapon --show

# Add swap if needed (see EC2 setup steps)
```

## Production Files

### Created Configuration Files

- `backend/Dockerfile.prod` - Production backend build
- `frontend/Dockerfile.prod` - Production frontend build
- `frontend/nginx.conf` - Nginx configuration for SPA
- `docker-compose.prod.yml` - Production orchestration
- `Caddyfile` - Reverse proxy + auto-SSL
- `.env.example` - Environment template
- `.env.prod.local` - Local testing environment
- `backend/.dockerignore` - Backend build optimization
- `frontend/.dockerignore` - Frontend build optimization
- `scripts/backup-db.sh` - Database backup automation

### Service URLs

**Local Testing**:
- Frontend: `https://localhost`
- API: `https://localhost/api/*`

**Production**:
- Frontend: `https://your-domain.com`
- API: `https://your-domain.com/api/*`

**Internal Services** (not exposed):
- PostgreSQL: `db:5432`
- MongoDB: `mongo:27017`
- Orion-LD: `orion-ld:1026`
- Backend: `api:3000`
- Frontend: `web:80`

## Security Checklist

- [x] Strong passwords (16+ chars, generated with `openssl rand -base64 32`)
- [x] `.env.prod` permissions (`chmod 600`)
- [x] Non-root containers (nodejs, nginx users)
- [x] Firewall (UFW: only 22/80/443)
- [x] Database isolation (backend network only)
- [x] HTTPS with valid certificate (Caddy auto-SSL)
- [x] EC2 Security Group (SSH restricted to your IP)
- [x] `.dockerignore` (exclude .env, node_modules, .git)

### Additional Hardening (Optional)

```bash
# Disable SSH password auth (use keys only)
sudo nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no
sudo systemctl restart sshd

# Install fail2ban for SSH protection
sudo apt-get install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Enable unattended security updates
sudo apt-get install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

## Monitoring

### Health Checks

All services have built-in Docker health checks:
- **Database**: `pg_isready` every 10s
- **MongoDB**: `ping` command every 10s
- **Orion-LD**: `/version` endpoint every 10s
- **API**: `/health` endpoint every 30s
- **Web**: Root path every 30s

### View Health Status

```bash
# All services
docker compose -f docker-compose.prod.yml --env-file .env.prod ps

# Specific service
docker inspect <container-name> --format='{{.State.Health.Status}}'
```

### Access Logs

```bash
# Caddy access logs
docker exec <caddy-container> cat /data/access.log

# Caddy live logs
docker logs -f <caddy-container>
```

## Updates and Maintenance

### Update Application Code

```bash
# Pull latest code
cd ~/nagoya-construction-lifecycle
git pull origin main

# Rebuild images
docker compose -f docker-compose.prod.yml --env-file .env.prod build

# Restart services
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# Run new migrations if any
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T api node dist/db/migrate.js

# Verify health
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
```

### Rollback

```bash
# Stop services
docker compose -f docker-compose.prod.yml --env-file .env.prod down

# Revert to previous version
git log --oneline
git checkout <previous-tag>

# Rebuild and start
docker compose -f docker-compose.prod.yml --env-file .env.prod build
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

### Restore Database Backup

```bash
# Download from S3
aws s3 cp s3://nagoya-production-backups/postgres/postgres_<timestamp>.sql.gz .

# Restore
gunzip postgres_<timestamp>.sql.gz
docker exec -i <db-container> psql -U nagoya_prod nagoya_construction < postgres_<timestamp>.sql
```

## Cost Estimate (AWS - Monthly)

- EC2 t3.medium: ~$30
- EBS 30GB GP3: ~$3
- S3 backups (30 days): ~$1
- Data transfer: ~$2
- **Total**: ~$35-40/month

## Support

For issues or questions:
- Check logs: `docker compose logs -f`
- Review health checks: `docker compose ps`
- Verify environment variables: `docker exec <container> env`
- Test connectivity: `curl https://localhost/api/health`

## License

See main README for license information.

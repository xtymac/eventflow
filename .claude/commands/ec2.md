# EC2 Server Management

Connect to and manage EC2 production server.

## Usage

```
/ec2 [command]
```

Commands:
- `status` - Check container status and health
- `logs [container]` - View logs (api|db|web|caddy|all)
- `restart [service]` - Restart service(s)
- `migrate` - Run pending database migrations
- `query <sql>` - Execute database query
- `test` - Test API endpoints
- `shell` - Open interactive SSH session

## Instructions

When the user runs this skill:

1. Parse the command argument (default to "status" if none provided)

2. Execute the appropriate action using SSH:

### For `status`:
```bash
ssh -i ~/.ssh/urban-infra-dx-key.pem ubuntu@52.69.59.156 "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep nagoya"
```

### For `logs [container]`:
Container can be: api, db, web, caddy, martin, mongo, orion-ld
```bash
ssh -i ~/.ssh/urban-infra-dx-key.pem ubuntu@52.69.59.156 "docker logs nagoya-[container] --tail 50 2>&1"
```
For "all", show API logs by default.

### For `restart [service]`:
```bash
ssh -i ~/.ssh/urban-infra-dx-key.pem ubuntu@52.69.59.156 "cd ~/urban-infra-dx && docker compose restart [service]"
```

### For `migrate`:
Apply all pending migration files from `backend/drizzle/` directory:
```bash
# For each migration file that hasn't been applied:
cat backend/drizzle/XXXX_migration.sql | ssh -i ~/.ssh/urban-infra-dx-key.pem ubuntu@52.69.59.156 "docker exec -i nagoya-db psql -U postgres -d nagoya_construction"
```

### For `query <sql>`:
```bash
ssh -i ~/.ssh/urban-infra-dx-key.pem ubuntu@52.69.59.156 "docker exec nagoya-db psql -U postgres -d nagoya_construction -c '<sql>'"
```

### For `test`:
```bash
ssh -i ~/.ssh/urban-infra-dx-key.pem ubuntu@52.69.59.156 "curl -s 'http://localhost:3000/health' && curl -s 'http://localhost:3000/assets?limit=1'"
```

### For `shell`:
```bash
ssh -i ~/.ssh/urban-infra-dx-key.pem ubuntu@52.69.59.156
```

3. Present the results to the user in a clear format.

## EC2 Configuration

- **Instance ID**: `i-01f2b178a34668c58`
- **Host**: `ubuntu@52.69.59.156` (no Elastic IP — resolve dynamically if connection fails)
- **SSH Key**: `~/.ssh/urban-infra-dx-key.pem`
- **Key Pair Name**: `urban-infra-dx-key`
- **Instance Type**: `t3.medium` (2 vCPU, 4 GB RAM)
- **Storage**: 50 GB gp3
- **Region**: `ap-northeast-1` (Tokyo)
- **Security Group**: `urban-infra-dx-sg` (`sg-0dc0589b7c4af3355`)
- **Project Directory**: `~/urban-infra-dx`
- **Database Container**: `nagoya-db`
- **API Container**: `nagoya-api`
- **Database**: `nagoya_construction`
- **Database User**: `postgres`

## Quick Reference

| Container | Service | Port |
|-----------|---------|------|
| nagoya-api | Backend API | 3000 |
| nagoya-web | Frontend | 5173 |
| nagoya-db | PostgreSQL | 5433 |
| nagoya-caddy | Reverse Proxy | 80, 443 |
| nagoya-martin | Vector Tiles | - |
| nagoya-mongo | MongoDB | 27017 |
| nagoya-orion-ld | NGSI-LD | 1026 |

## Troubleshooting

If connection fails:
1. Check SSH key exists: `ls ~/.ssh/urban-infra-dx-key.pem`
2. Check EC2 is reachable: `ssh -i ~/.ssh/urban-infra-dx-key.pem ubuntu@52.69.59.156 echo ok`
3. Check security group allows SSH (port 22)
4. Check instance is running: `aws ec2 describe-instance-status --instance-ids i-01f2b178a34668c58 --region ap-northeast-1`

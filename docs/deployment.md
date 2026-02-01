# Deployment Guide

本文档描述 EventFlow 系统的部署架构和操作流程。

## 1. 环境概览

| 环境 | URL | 用途 |
|------|-----|------|
| Main (Production) | https://eventflow.uixai.org/ | 主版本，持续演进 |
| v1 (Frozen) | https://v1.eventflow.uixai.org/ | 冻结版本，1/28 原型备份 |
| Local Dev | http://localhost:5173 | 本地开发 |

## 2. 架构图

```
                         ┌─────────────────────────────────────────────────────┐
                         │              EC2 (18.177.72.233)                    │
                         │              t3.medium / 4GB RAM                     │
                         │                                                      │
    eventflow.           │   ┌──────────┐      ┌────────────────────────────┐  │
    uixai.org ───────────┼──▶│          │      │       Main Stack           │  │
                         │   │  Caddy   │      │  ┌─────┐ ┌─────┐ ┌─────┐  │  │
                         │   │          │─────▶│  │ db  │ │mongo│ │orion│  │  │
  v1.eventflow.          │   │ :80/:443 │      │  └─────┘ └─────┘ └─────┘  │  │
    uixai.org ───────────┼──▶│          │      │  ┌─────┐ ┌─────┐ ┌──────┐ │  │
                         │   │eventflow-│      │  │ api │ │ web │ │martin│ │  │
                         │   │   net    │      │  └─────┘ └─────┘ └──────┘ │  │
                         │   │          │      └────────────────────────────┘  │
                         │   │          │      ┌────────────────────────────┐  │
                         │   │          │─────▶│       v1 Stack             │  │
                         │   │          │      │  ┌───────┐ ┌───────┐       │  │
                         │   └──────────┘      │  │ db-v1 │ │mongo-v1│ ...  │  │
                         │                     │  └───────┘ └───────┘       │  │
                         │                     └────────────────────────────┘  │
                         └─────────────────────────────────────────────────────┘
```

## 3. 容器清单

### Main Stack (7 containers)
| Container | Image | Port | 说明 |
|-----------|-------|------|------|
| nagoya-db | postgis/postgis:16-3.4 | 5433 | PostgreSQL + PostGIS |
| nagoya-mongo | mongo:4.4 | 27017 | MongoDB (Orion-LD 存储) |
| nagoya-orion-ld | fiware/orion-ld:1.5.1 | 1026 | NGSI-LD Context Broker |
| nagoya-api | eventflow-api | 3000 | Node.js/Fastify API |
| nagoya-web | eventflow-web | 5173 | Vite + React 前端 |
| nagoya-martin | martin:v0.14.2 | 3000 | Vector Tile Server |
| nagoya-caddy | caddy:2-alpine | 80/443 | 反向代理 + TLS |

### v1 Stack (6 containers)
| Container | Image | 说明 |
|-----------|-------|------|
| nagoya-db-v1 | postgis/postgis:16-3.4 | 独立 PostgreSQL |
| nagoya-mongo-v1 | mongo:4.4 | 独立 MongoDB |
| nagoya-orion-ld-v1 | fiware/orion-ld:1.5.1 | 独立 Orion-LD |
| nagoya-api-v1 | eventflow-v1-api | 独立 API |
| nagoya-web-v1 | eventflow-v1-web | 独立前端 |
| nagoya-martin-v1 | martin:v0.14.2 | 独立 Tile Server |

## 4. 数据隔离

| 资源类型 | Main | v1 |
|----------|------|-----|
| PostgreSQL DB | `nagoya_construction` | `nagoya_construction_v1` |
| MongoDB DB | `orionld` | `orionld_v1` |
| PG Volume | `eventflow_postgres_data` | `eventflow-v1_postgres_data_v1` |
| Mongo Volume | `eventflow_mongo_data` | `eventflow-v1_mongo_data_v1` |

## 5. EC2 目录结构

```
/home/ubuntu/
├── eventflow/                    # Main 代码 (可演进)
│   ├── docker-compose.yml
│   ├── Caddyfile
│   ├── scripts/
│   │   └── deploy-dual-stack.sh
│   ├── backend/
│   └── frontend/
│
└── eventflow-v1/                 # v1 代码 (已冻结)
    ├── docker-compose.v1.yml
    ├── backend/
    └── frontend/
```

## 6. 部署操作

### 6.1 SSH 连接
```bash
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233
```

### 6.2 查看状态
```bash
# 所有容器状态
docker ps --format 'table {{.Names}}\t{{.Status}}'

# 资源使用
docker stats --no-stream

# 磁盘空间
df -h
```

### 6.3 部署代码更新 (Main)
```bash
# 1. 本地构建检查
cd frontend && npm run build

# 2. 上传文件
scp -i ~/.ssh/eventflow-prod-key.pem -r frontend/src ubuntu@18.177.72.233:~/eventflow/frontend/
scp -i ~/.ssh/eventflow-prod-key.pem -r backend/src ubuntu@18.177.72.233:~/eventflow/backend/

# 3. 重启容器
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 "docker restart nagoya-web nagoya-api"
```

### 6.4 完整重建
```bash
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 \
  "cd ~/eventflow && docker compose up -d --build"
```

### 6.5 双栈部署 (首次/基础设施变更)
```bash
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 \
  "bash ~/eventflow/scripts/deploy-dual-stack.sh"
```

## 7. 日志查看

```bash
# API 日志
docker logs nagoya-api --tail 100 -f

# Caddy 日志 (路由/TLS)
docker logs nagoya-caddy --tail 50

# v1 API 日志
docker logs nagoya-api-v1 --tail 50
```

## 8. 数据库操作

### 8.1 进入 PostgreSQL
```bash
# Main
docker exec -it nagoya-db psql -U postgres -d nagoya_construction

# v1
docker exec -it nagoya-db-v1 psql -U postgres -d nagoya_construction_v1
```

### 8.2 数据备份
```bash
# Main 数据库备份
docker exec nagoya-db pg_dump -U postgres nagoya_construction > backup_$(date +%Y%m%d).sql

# 恢复
cat backup.sql | docker exec -i nagoya-db psql -U postgres -d nagoya_construction
```

### 8.3 数据同步 (Main → v1)
```bash
# 导出表
docker exec nagoya-db psql -U postgres -d nagoya_construction \
  -c "COPY road_assets TO '/tmp/road_assets.csv' WITH CSV HEADER"

# 复制文件
docker cp nagoya-db:/tmp/road_assets.csv /tmp/
docker cp /tmp/road_assets.csv nagoya-db-v1:/tmp/

# 导入到 v1
docker exec nagoya-db-v1 psql -U postgres -d nagoya_construction_v1 \
  -c "COPY road_assets FROM '/tmp/road_assets.csv' WITH CSV HEADER"
```

## 9. 故障排除

### 9.1 磁盘空间不足
```bash
# 清理 Docker 资源
docker system prune -af
docker volume prune -f
docker builder prune -af

# 删除旧备份
rm -f /home/ubuntu/*.sql /home/ubuntu/*.gz
```

### 9.2 容器无法启动
```bash
# 检查日志
docker logs nagoya-api 2>&1 | tail -50

# 检查健康状态
docker inspect nagoya-api --format '{{.State.Health.Status}}'

# 强制重建
docker compose up -d --build --force-recreate
```

### 9.3 网络问题
```bash
# 检查 eventflow-net 网络
docker network inspect eventflow-net

# 确认 Caddy 在网络中
docker inspect nagoya-caddy --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}'
```

### 9.4 TLS 证书问题
```bash
# 查看 Caddy 证书状态
docker logs nagoya-caddy | grep -i cert

# 强制重新申请
docker exec nagoya-caddy caddy reload --config /etc/caddy/Caddyfile
```

## 10. 本地开发

### 10.1 首次设置
```bash
# 创建 Docker 网络 (必需)
docker network create eventflow-net

# 启动服务
docker compose up -d
```

### 10.2 环境变量
```bash
# 复制示例配置
cp .env.example .env

# 必要变量
GOOGLE_MAPS_API_KEY=xxx
GEMINI_API_KEY=xxx
```

## 11. 关键文件

| 文件 | 用途 |
|------|------|
| `docker-compose.yml` | Main stack 配置 |
| `docker-compose.v1.yml` | v1 stack 配置 |
| `Caddyfile` | 反向代理路由 |
| `scripts/deploy-dual-stack.sh` | 一键部署脚本 |
| `.claude/skills/deploy.md` | Claude 部署技能 |

## 12. 更新历史

| 日期 | 变更 |
|------|------|
| 2026-02-01 | 实施双栈部署 (Main + v1) |
| 2026-01-28 | 原型版本冻结为 v1 |

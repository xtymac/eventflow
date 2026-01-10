# 实时地图同步 (Martin Tile Server)

> 本文档介绍 EventFlow 的实时地图同步功能，该功能允许 QGIS 中的道路编辑立即反映在网站地图上。

## 功能概述

当用户在 QGIS 中编辑道路数据并保存后，刷新 EventFlow 网站即可看到最新的道路位置，无需任何额外操作。

**关键特性：**
- 真正的实时更新（刷新即可见）
- 无需手动运行同步脚本
- 无需重启任何服务
- 支持多用户同时编辑

---

## 技术架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                           用户工作流                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌─────────────┐      ┌──────────────────┐      ┌──────────────┐  │
│   │   QGIS      │ ───▶ │  EC2 PostgreSQL  │ ◀─── │    Martin    │  │
│   │  (编辑器)   │      │    (数据库)      │      │  (瓦片服务)  │  │
│   └─────────────┘      └──────────────────┘      └──────────────┘  │
│         │                      │                       │           │
│         │                      │                       │           │
│         │                      ▼                       ▼           │
│         │              ┌──────────────────────────────────┐        │
│         │              │        Caddy (反向代理)          │        │
│         │              │    - /tiles/* → Martin           │        │
│         │              │    - /api/* → API Server         │        │
│         │              │    - /* → Web Frontend           │        │
│         │              └──────────────────────────────────┘        │
│         │                              │                           │
│         │                              ▼                           │
│         │              ┌──────────────────────────────────┐        │
│         └─────────────▶│      EventFlow 网站地图          │        │
│           刷新浏览器    │   https://eventflow.uixai.org    │        │
│                        └──────────────────────────────────┘        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 核心组件

### 1. Martin Tile Server

[Martin](https://github.com/maplibre/martin) 是一个用 Rust 编写的高性能矢量瓦片服务器，支持直接从 PostGIS 数据库生成瓦片。

**Docker 配置：**
```yaml
martin:
  image: ghcr.io/maplibre/martin:v0.14.2
  container_name: nagoya-martin
  restart: unless-stopped
  depends_on:
    db:
      condition: service_healthy
  ports:
    - "3001:3000"
  environment:
    DATABASE_URL: postgres://postgres:postgres@db:5432/nagoya_construction
  command: --auto-bounds calc --cache-size 0
```

**关键配置：**
| 参数 | 值 | 说明 |
|------|-----|------|
| `--cache-size 0` | 0 | 禁用瓦片缓存，确保每次请求都读取最新数据 |
| `--auto-bounds calc` | calc | 自动计算数据边界 |

### 2. Caddy 反向代理

Caddy 负责路由请求并添加防缓存头。

**Caddyfile 配置：**
```caddyfile
{$DOMAIN} {
  encode zstd gzip

  handle_path /tiles/* {
    header Cache-Control "no-cache, no-store, must-revalidate"
    header Pragma "no-cache"
    header Expires "0"
    reverse_proxy martin:3000
  }

  handle_path /api/* {
    reverse_proxy api:3000
  }

  handle {
    reverse_proxy web:5173
  }
}
```

**防缓存头说明：**
| 头部 | 值 | 作用 |
|------|-----|------|
| `Cache-Control` | no-cache, no-store, must-revalidate | 禁止浏览器和代理缓存 |
| `Pragma` | no-cache | HTTP/1.0 兼容 |
| `Expires` | 0 | 立即过期 |

### 3. 前端缓存破坏

前端在请求瓦片时添加时间戳参数，确保每次页面加载都获取新数据。

**MapView.tsx：**
```typescript
// 每次页面加载时生成新的时间戳
const cacheBuster = Date.now();
map.current.addSource('roads-preview', {
  type: 'vector',
  tiles: [`${window.location.origin}/tiles/road_assets/{z}/{x}/{y}?t=${cacheBuster}`],
});
```

---

## 数据流

```
1. QGIS 编辑道路
   ↓
2. QGIS 保存 (Ctrl+S)
   ↓
3. 数据写入 PostgreSQL (road_assets 表)
   ↓
4. 用户刷新浏览器 (F5)
   ↓
5. 前端请求瓦片: /tiles/road_assets/{z}/{x}/{y}?t=1736506xxx
   ↓
6. Caddy 转发到 Martin (添加 no-cache 头)
   ↓
7. Martin 查询 PostgreSQL 生成瓦片
   ↓
8. 瓦片返回给浏览器
   ↓
9. 地图显示最新道路位置
```

---

## API 端点

### 瓦片目录
```
GET https://eventflow.uixai.org/tiles/catalog
```

**响应示例：**
```json
{
  "tiles": {
    "road_assets": {
      "content_type": "application/x-protobuf",
      "description": "public.road_assets.geometry"
    },
    "construction_events": {
      "content_type": "application/x-protobuf",
      "description": "public.construction_events.geometry"
    }
  }
}
```

### 瓦片请求
```
GET https://eventflow.uixai.org/tiles/{source}/{z}/{x}/{y}
```

**示例：**
```
GET https://eventflow.uixai.org/tiles/road_assets/14/14423/6480
```

---

## 运维命令

### 查看服务状态
```bash
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 \
  "cd /home/ubuntu/eventflow && docker compose ps"
```

### 查看 Martin 日志
```bash
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 \
  "docker logs nagoya-martin --tail 50"
```

### 重启 Martin（如遇问题）
```bash
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 \
  "cd /home/ubuntu/eventflow && docker compose restart martin"
```

### 重启所有服务
```bash
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 \
  "cd /home/ubuntu/eventflow && docker compose restart"
```

---

## 与本地开发的区别

| 环境 | 瓦片来源 | 更新方式 | 配置 |
|------|---------|---------|------|
| **生产环境** | Martin 实时瓦片 | 刷新页面即可 | 自动检测 (hostname !== 'localhost') |
| **本地开发** | PMTiles 静态文件 | 运行 `npm run tiles:sync` | 默认 |

**本地开发更新瓦片：**
```bash
cd nagoya-construction-lifecycle
npm run tiles:sync
```

---

## 故障排除

### 问题：刷新后数据未更新

**检查步骤：**

1. **确认 QGIS 已保存**
   - 检查 QGIS 是否显示"已保存"
   - 查看图层是否有未保存标记

2. **强制刷新浏览器**
   ```
   Windows/Linux: Ctrl + Shift + R
   Mac: Cmd + Shift + R
   ```

3. **检查 Martin 状态**
   ```bash
   ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 \
     "docker compose ps martin"
   ```

4. **重启 Martin**
   ```bash
   ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 \
     "cd /home/ubuntu/eventflow && docker compose restart martin"
   ```

### 问题：瓦片加载失败 (404/500)

**检查 Martin 日志：**
```bash
ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 \
  "docker logs nagoya-martin --tail 100"
```

**常见原因：**
- 数据库连接失败
- PostgreSQL 容器未运行
- 网络问题

### 问题：地图显示空白

**检查瓦片端点：**
```bash
curl -I https://eventflow.uixai.org/tiles/road_assets/14/14423/6480
```

**预期响应：**
```
HTTP/2 200
content-type: application/x-protobuf
cache-control: no-cache, no-store, must-revalidate
```

---

## 性能考虑

### 当前配置（无缓存）

**优点：**
- 实时数据，无延迟
- 简单可靠

**缺点：**
- 每次请求都查询数据库
- 相同瓦片多次生成

### 未来优化（如需要）

如果遇到性能瓶颈，可以考虑：

1. **启用短期缓存**
   ```yaml
   command: --auto-bounds calc --cache-size 100
   ```
   配合前端 WebSocket 通知刷新

2. **使用 Redis 缓存**
   配置 Martin 使用 Redis 作为缓存后端

3. **增量更新**
   只更新变化区域的瓦片（需要自定义实现）

---

## 相关文档

- [QGIS 设置指南](./QGIS_SETUP_GUIDE.md) - QGIS 连接和编辑说明
- [Martin 官方文档](https://maplibre.org/martin/) - Martin 完整配置参考
- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) - 前端地图库文档

---

**文档版本**：1.0
**最后更新**：2026-01-10
**维护者**：EventFlow Team

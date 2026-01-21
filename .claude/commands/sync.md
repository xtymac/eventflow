# EC2 Database Sync

Manage real-time database synchronization between EC2 (primary) and local (replica).

## Usage

```
/sync [command]
```

Commands:
- `start` - Start sync services (SSH tunnels + Docker containers + replication)
- `stop` - Stop all sync services
- `status` - Check sync status
- `restart` - Restart sync services
- `logs [service]` - View logs (postgres|mongo|orion|all)

## Instructions

When the user runs this skill:

1. Parse the command argument (default to "status" if none provided)

2. Execute the appropriate action:

### For `start`:
```bash
cd "$PROJECT_ROOT" && ./scripts/sync-manager.sh start
```

### For `stop`:
```bash
cd "$PROJECT_ROOT" && ./scripts/sync-manager.sh stop
```

### For `status`:
```bash
cd "$PROJECT_ROOT" && ./scripts/sync-manager.sh status
```

### For `restart`:
```bash
cd "$PROJECT_ROOT" && ./scripts/sync-manager.sh restart
```

### For `logs`:
```bash
cd "$PROJECT_ROOT" && ./scripts/sync-manager.sh logs [service]
```

3. Present the results to the user in a clear format.

## Environment

- Project root: `/Users/mac/Maku Box Dropbox/Maku Box/Project/Eukarya/Project/EventFlow/nagoya-construction-lifecycle`
- SSH tunnel ports: PostgreSQL (15433), MongoDB (27019)
- Local endpoints: PostgreSQL (5434), MongoDB (27018), Orion-LD (1027)

## Troubleshooting

If sync fails:
1. Check SSH key exists: `~/.ssh/eventflow-prod-key.pem`
2. Check EC2 is reachable: `ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 echo ok`
3. Check Docker is running: `docker ps`
4. View logs: `./scripts/sync-manager.sh logs`

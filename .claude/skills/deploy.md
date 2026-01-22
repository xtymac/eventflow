# Deploy to EC2

Deploy the application to EC2 production server.

## Steps

1. **Build frontend locally** (to catch TypeScript errors)
   ```bash
   cd frontend && npm run build
   ```

2. **Upload changed files to EC2**
   ```bash
   # Upload specific files (adjust paths as needed)
   scp -i ~/.ssh/eventflow-prod-key.pem <local-file> ubuntu@18.177.72.233:~/nagoya-construction-lifecycle/<remote-path>

   # Or upload entire directory
   scp -i ~/.ssh/eventflow-prod-key.pem -r frontend/src ubuntu@18.177.72.233:~/nagoya-construction-lifecycle/frontend/
   ```

3. **Build and restart on EC2**
   ```bash
   ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 "cd ~/nagoya-construction-lifecycle/frontend && npm run build && docker restart nagoya-web"
   ```

4. **Verify deployment**
   ```bash
   ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 "docker ps | grep nagoya-web"
   ```

## EC2 Configuration

- Host: `ubuntu@18.177.72.233`
- SSH Key: `~/.ssh/eventflow-prod-key.pem`
- Project path: `~/nagoya-construction-lifecycle`
- Web container: `nagoya-web`

## Notes

- EC2 project is deployed via scp (not git)
- Always build locally first to catch TypeScript errors
- If build fails on EC2, check `docker logs nagoya-web` for errors

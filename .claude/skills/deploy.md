# Deploy to EC2

Deploy the application to EC2 production server.

## Steps

1. **Build frontend locally**
   ```bash
   cd frontend && npm run build
   ```

2. **Commit and push changes** (if there are uncommitted changes)
   ```bash
   git add -A
   git commit -m "Deploy: <summary of changes>"
   git push
   ```

3. **Deploy on EC2**
   SSH to EC2 and run deployment:
   ```bash
   ssh -i ~/.ssh/eventflow-prod-key.pem ubuntu@18.177.72.233 << 'ENDSSH'
   cd ~/nagoya-construction-lifecycle
   git pull
   cd frontend && npm install && npm run build
   docker restart nagoya-web
   ENDSSH
   ```

4. **Verify deployment**
   - Check that nagoya-web container is running: `docker ps | grep nagoya-web`
   - Test the application at the production URL

## EC2 Configuration

- Host: `ubuntu@18.177.72.233`
- SSH Key: `~/.ssh/eventflow-prod-key.pem`
- Project path: `~/nagoya-construction-lifecycle`
- Web container: `nagoya-web`

## Notes

- Always build locally first to catch TypeScript errors before pushing
- The EC2 deployment pulls from git, so all changes must be committed and pushed
- If build fails on EC2, check `docker logs nagoya-web` for errors

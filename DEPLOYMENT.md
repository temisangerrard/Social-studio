# Deployment Guide

This guide covers setting up continuous deployment to Fly.io with GitHub Actions.

---

## Prerequisites

- GitHub repository with admin access
- Fly.io account and app created
- Fly.io API token

---

## Step 1: Fix the Build (Already Done)

The Dockerfile has been updated to rebuild `node_modules` inside the Docker container, preventing the esbuild platform mismatch error.

**Key change:** We don't copy `node_modules` from macOS into the Docker image. Instead, `npm ci` runs on Linux to install the correct binaries.

---

## Step 2: Set Up Fly.io (Manual - One Time)

### If app already exists:
```bash
# Verify app is ready
flyctl status --app social-studio
```

### If app doesn't exist:
```bash
# Create new Fly.io app
flyctl launch --no-deploy --name social-studio

# Select region: lhr (London) or closest to your users
# Configure memory: 512MB
# Configure CPU: shared
```

---

## Step 3: Create GitHub Secrets

In GitHub: **Settings → Secrets and variables → Actions → New repository secret**

### Add these secrets:

**`FLY_API_TOKEN`**
- Get from Fly.io dashboard: https://fly.io/user/personal_access_tokens/
- Click "Create token"
- Paste into GitHub

### Optional environment variables (if using AI features):

**`FAL_KEY`** (for image generation)
- Get from https://www.fal.ai/
- Add to GitHub secrets

**`OPENAI_API_KEY`** (for LLM features)
- Get from https://platform.openai.com/api-keys
- Add to GitHub secrets

---

## Step 4: Enable GitHub Actions

The workflow file `.github/workflows/deploy.yml` is already created.

1. Push this repo to GitHub
2. Go to **Actions** tab in GitHub
3. Workflow should appear and run on next push

---

## Step 5: Understanding the CI/CD Pipeline

The workflow does three things:

### 1. **Test** (runs on every push)
```
✓ Type checking (TypeScript)
✓ Unit tests
✓ Lint (if configured)
```

### 2. **Deploy** (only on main branch)
```
✓ Builds Docker image
✓ Pushes to Fly.io registry
✓ Deploys to production
✓ Starts 1 machine (auto-scales if needed)
```

### 3. **Health Check** (after deployment)
```
✓ Waits 10 seconds for server to start
✓ Hits /api/brands endpoint
✓ Retries up to 30 times
✓ Alerts if deployment failed
```

---

## Step 6: Verify Deployment

After pushing to main branch:

1. Go to GitHub **Actions** tab
2. Watch the workflow run
3. Check Fly.io dashboard: https://fly.io/dashboard/social-studio
4. Visit app: https://social-studio.fly.dev/

---

## Step 7: View Logs

### From command line:
```bash
# Real-time logs
flyctl logs --app social-studio

# Last N lines
flyctl logs -n 100 --app social-studio
```

### From GitHub Actions:
- Go to **Actions** → workflow run
- Click "Deploy to Fly.io" step
- See full deployment logs

---

## Step 8: Rollback (if needed)

If deployment breaks:

```bash
# See previous deployments
flyctl releases --app social-studio

# Rollback to previous release
flyctl releases rollback VERSION_NUMBER --app social-studio
```

---

## Environment Variables in Fly.io

Set production environment variables:

```bash
# View current env vars
flyctl secrets list --app social-studio

# Add/update env var
flyctl secrets set NODE_ENV=production --app social-studio
flyctl secrets set FAL_KEY=your_key --app social-studio

# Remove env var
flyctl secrets unset FAL_KEY --app social-studio
```

---

## Monitoring & Alerts

### Check app status:
```bash
flyctl status --app social-studio
```

### Check resource usage:
```bash
flyctl metrics --app social-studio
```

### Scale up if needed:
```bash
# Increase memory
flyctl scale memory 1024 --app social-studio

# Increase CPU
flyctl scale count 2 --app social-studio
```

---

## Troubleshooting

### Build fails with "esbuild" error
- Already fixed in Dockerfile
- If issue persists: clear Docker cache and redeploy

### App won't start (connection refused)
- Check logs: `flyctl logs --app social-studio`
- Verify `package.json` has `"server"` script
- Ensure PORT 3000 is used

### Persistent storage lost
- Fly.io mounts volume at `/app/workspace`
- Data survives restarts but not app deletion
- Implement backup strategy if needed

### API endpoints timeout
- Check `/api/brands` endpoint
- View logs for errors
- Increase machine memory if needed

---

## Best Practices

1. **Always test locally first**
   ```bash
   npm run typecheck
   npm test
   npm run server
   ```

2. **Use feature branches**
   - Create PR for changes
   - Tests must pass before merge
   - Deploy only main branch to production

3. **Monitor deployments**
   - Watch GitHub Actions run
   - Check health check passes
   - Verify logs show no errors

4. **Keep secrets secure**
   - Never commit `.env` file
   - Use GitHub Secrets, not hardcoded values
   - Rotate API keys periodically

5. **Document changes**
   - Update API_INTEGRATION_GUIDE.md if endpoints change
   - Note breaking changes in commits
   - Keep deployment notes updated

---

## Advanced: Custom Domain

If you have a custom domain:

```bash
# Add custom domain
flyctl certs create my-domain.com --app social-studio

# Verify DNS configuration
flyctl certs check my-domain.com --app social-studio
```

Update DNS provider to point to Fly.io nameservers.

---

## Advanced: Multiple Environments

If you need staging + production:

1. Create two Fly.io apps:
   - `social-studio` (production)
   - `social-studio-staging` (staging)

2. Create separate GitHub workflow files:
   - `.github/workflows/deploy-prod.yml` (main branch)
   - `.github/workflows/deploy-staging.yml` (develop branch)

3. Set different secrets for each:
   - `FLY_API_TOKEN_PROD`
   - `FLY_API_TOKEN_STAGING`

---

## Support

- **Fly.io Docs:** https://fly.io/docs/
- **GitHub Actions:** https://docs.github.com/actions
- **Check app status:** `flyctl status --app social-studio`
- **View logs:** `flyctl logs --app social-studio`

---

**Last updated:** April 2024  
**Status:** Production Ready

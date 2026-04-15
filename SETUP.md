# Setup Guide: GitHub Actions → Fly.io Deployment

This guide walks you through the one-time setup needed to enable automatic deployments.

---

## ✅ What's Already Done

- ✅ Fixed Dockerfile (no more esbuild platform errors)
- ✅ Created GitHub Actions workflow (`.github/workflows/deploy.yml`)
- ✅ Added health checks to `fly.toml`
- ✅ Created environment variable template (`.env.example`)
- ✅ Created deployment documentation (`DEPLOYMENT.md`)

---

## 🚀 What You Need To Do

### 1. Get Your Fly.io API Token

1. Go to: https://fly.io/user/personal_access_tokens/
2. Click **"Create token"**
3. Give it a name: `github-actions-deploy`
4. **Copy the token immediately** (you won't see it again)
5. Keep it safe for next step

---

### 2. Add Secret to GitHub

1. Go to your GitHub repo
2. Click **Settings** (top right)
3. In left sidebar: **Secrets and variables** → **Actions**
4. Click **"New repository secret"** (green button)
5. Name: `FLY_API_TOKEN`
6. Paste the token you just copied
7. Click **"Add secret"**

✅ GitHub secret is now configured!

---

### 3. Push to GitHub

Make sure this repo is pushed to GitHub. The workflow will trigger automatically.

```bash
# If not already on GitHub:
git remote add origin https://github.com/YOUR_USERNAME/Social-studio.git
git branch -M main
git push -u origin main
```

---

### 4. Verify Deployment Works

1. Go to your repo on GitHub
2. Click **Actions** tab
3. You should see a workflow run starting
4. Click on the run to watch progress
5. Expect 3 stages:
   - ✅ **Test** (2-3 min)
   - ✅ **Deploy** (3-5 min)
   - ✅ **Health Check** (1-2 min)

---

## 🔐 Optional: Add API Keys for AI Features

If you want image generation or LLM features, add these secrets too:

### FAL.AI (Image Generation)

1. Go to: https://www.fal.ai/
2. Sign up / Log in
3. Go to **Settings** → **API Keys**
4. Copy your API key
5. Add to GitHub as secret:
   - Name: `FAL_KEY`
   - Value: [paste key]

### OpenAI (LLM Features)

1. Go to: https://platform.openai.com/api-keys
2. Click **"Create new secret key"**
3. Copy it immediately
4. Add to GitHub as secret:
   - Name: `OPENAI_API_KEY`
   - Value: [paste key]

---

## 🧪 Testing Locally Before Deploy

Before pushing, test locally:

```bash
# Install dependencies
npm install

# Type check
npm run typecheck

# Run tests
npm test

# Start server
npm run server
```

Visit: http://localhost:3000

---

## 📊 Monitoring Deployment

### From GitHub:
- Go to **Actions** tab
- Click latest workflow
- See real-time logs

### From Fly.io:
- Go to: https://fly.io/dashboard/social-studio
- See: resource usage, logs, deployments

### From Command Line:
```bash
# View logs
flyctl logs --app social-studio

# Check status
flyctl status --app social-studio

# View recent deployments
flyctl releases --app social-studio
```

---

## ❌ Troubleshooting

### "Deployment failed" in GitHub Actions

Check the error in GitHub Actions logs:

1. Go to **Actions** tab
2. Click failed workflow
3. Click **"Deploy to Fly.io"** step
4. Scroll to see error message

Common issues:

| Error | Fix |
|-------|-----|
| "FLY_API_TOKEN not found" | Add secret to GitHub (step 2 above) |
| "esbuild" error | Already fixed in Dockerfile |
| "Port 3000 not listening" | Check `src/server.ts` - should listen on 0.0.0.0 ✅ |
| "health check failed" | Wait longer, check logs with `flyctl logs` |

### "Connection refused" on app startup

1. Check Fly.io logs:
   ```bash
   flyctl logs --app social-studio
   ```

2. Common causes:
   - Server not starting (check logs)
   - PORT not set to 3000
   - Dependencies not installed (check Dockerfile)

### App deployed but endpoints timeout

1. Check if machine is running:
   ```bash
   flyctl status --app social-studio
   ```

2. View resource usage:
   ```bash
   flyctl metrics --app social-studio
   ```

3. If out of memory, scale up:
   ```bash
   flyctl scale memory 1024 --app social-studio
   ```

---

## 📝 After Setup

### Every time you push to main:
- ✅ Tests run automatically
- ✅ If tests pass, app deploys
- ✅ Health check verifies it's working

### To manually deploy:
```bash
flyctl deploy --remote-only --app social-studio
```

### To change environment variables:
```bash
flyctl secrets set NODE_ENV=production --app social-studio
flyctl secrets set FAL_KEY=your_key --app social-studio
```

### To check deployment status:
```bash
flyctl status --app social-studio
```

---

## 🎯 Next Steps

1. ✅ Complete step 1-4 above
2. 📂 Push this repo to GitHub
3. 👀 Watch deployment in GitHub Actions
4. 🌐 Visit https://social-studio.fly.dev/
5. ✅ Test API endpoints work:
   - https://social-studio.fly.dev/api/brands
   - https://social-studio.fly.dev/api/products

---

## 📚 Additional Resources

- **Fly.io Documentation:** https://fly.io/docs/
- **GitHub Actions Guide:** https://docs.github.com/actions
- **Deployment Guide:** See `DEPLOYMENT.md`
- **API Reference:** See `API_INTEGRATION_GUIDE.md`

---

**Status:** Setup Ready  
**Last Updated:** April 2024

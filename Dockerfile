# Use Playwright's official image — Chromium already installed, no apt rebuild per deploy
FROM mcr.microsoft.com/playwright:v1.49.0-noble

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV NODE_ENV=production

WORKDIR /app

# Dependencies layer — only re-runs when package.json changes
COPY package*.json ./

# Install dependencies in Docker Linux environment (not from macOS node_modules)
# This ensures esbuild binaries are built for linux-x64, not darwin-arm64
RUN npm ci --omit=dev

# Copy source code — .dockerignore excludes node_modules so no local binaries bleed in
COPY . .

# Create persistent data directories (volume mounted over workspace/ at runtime)
RUN mkdir -p workspace/uploads workspace/sessions workspace/boards workspace/outputs workspace/jobs workspace/brands

EXPOSE 3000

CMD ["node", "--import", "tsx/esm", "src/server.ts"]

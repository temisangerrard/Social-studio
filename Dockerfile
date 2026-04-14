FROM node:20-slim

# Install Chromium and dependencies for Playwright
RUN apt-get update && apt-get install -y \
  chromium \
  fonts-liberation \
  fonts-noto-color-emoji \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxkbcommon0 \
  libxrandr2 \
  xdg-utils \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# Tell Playwright to use the system Chromium
ENV PLAYWRIGHT_BROWSERS_PATH=0
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app

COPY package*.json ./

# Install dependencies in Docker Linux environment (not from macOS node_modules)
# This ensures esbuild binaries are built for linux-x64, not darwin-arm64
RUN npm ci --omit=dev

# Copy source code after dependencies are installed
COPY . .
# Remove any leftover node_modules from the source (just in case)
RUN rm -rf node_modules && npm ci --omit=dev

# Create persistent data directories
RUN mkdir -p workspace/uploads workspace/sessions workspace/boards outputs

EXPOSE 3000

CMD ["node", "--import", "tsx/esm", "src/server.ts"]

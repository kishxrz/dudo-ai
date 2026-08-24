FROM node:20-slim

# Install system dependencies for Chromium / Puppeteer & healthcheck curl
RUN apt-get update && apt-get install -y \
    chromium \
    curl \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer env vars (NOT NODE_ENV yet — keep it dev so npm ci installs devDependencies for TS build)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PORT=4000

WORKDIR /usr/src/app

COPY package*.json tsconfig.json ./

# Install ALL dependencies including devDependencies (@types/*) needed for TypeScript compilation
RUN npm ci

COPY src ./src

# Compile TypeScript
RUN npm run build

# Now set production env for runtime (after build is done)
ENV NODE_ENV=production

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

CMD ["npm", "start"]

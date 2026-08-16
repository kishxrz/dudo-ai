FROM node:20-slim

# Install system dependencies for Chromium / Puppeteer & healthcheck curl
RUN apt-get update && apt-get install -y \
    chromium \
    curl \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables for Puppeteer and Node production runtime
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PORT=4000 \
    NODE_ENV=production

WORKDIR /usr/src/app

COPY package*.json tsconfig.json ./

RUN npm ci

COPY src ./src

RUN npm run build

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

CMD ["npm", "start"]

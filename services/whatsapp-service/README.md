# Dudo WhatsApp Integration Microservice

Standalone multi-tenant persistent WhatsApp microservice for Dudo using `whatsapp-web.js`, Puppeteer/Chromium, and LocalAuth session storage.

Designed for production deployment on a **DigitalOcean Ubuntu VPS** (or any Docker host) with persistent local storage.

---

## 1. Architecture Overview

```
DigitalOcean VPS / Docker Host
    └─ Docker Container (dudo-whatsapp-service)
        └─ Node.js (TypeScript) + Express
            └─ whatsapp-web.js + Puppeteer (Chromium)
                └─ LocalAuth Session Persistence (/data/whatsapp-sessions)
```

- **Authentication**: Service endpoints are protected by `WHATSAPP_INTERNAL_SECRET` / `WHATSAPP_SERVICE_SECRET` and Firebase User ID tokens (`Bearer <idToken>`).
- **Session Persistence**: Sessions are saved under `/data/whatsapp-sessions/session-whatsapp-{workspaceId}` inside the container, mounted from host directory `/opt/dudo/whatsapp-sessions`.
- **Multi-Tenancy**: Every workspace gets an isolated `whatsapp-web.js` client, separate LocalAuth directory, and workspace-scoped webhook payload.
- **AI Processing Pipeline**: Incoming messages are forwarded via HTTP POST to `${DUDO_BASE_URL}/api/internal/whatsapp/message`. Dudo processes the message using **that workspace's BYOK AI provider, API key, model, Knowledge, Personality, and Skills**, then returns the reply string to be sent back via WhatsApp.

---

## 2. Environment Variables

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | Microservice HTTP server port | `4000` |
| `NODE_ENV` | Runtime environment | `production` |
| `WHATSAPP_SERVICE_SECRET` | Shared secret protecting service API endpoints | Required string |
| `WHATSAPP_INTERNAL_SECRET` | Secret token for server-to-server webhook requests | Must match Dudo's `WHATSAPP_INTERNAL_SECRET` |
| `WHATSAPP_SESSION_PATH` | Directory path inside container for session storage | `/data/whatsapp-sessions` |
| `DUDO_BASE_URL` | Production URL of the main Dudo Next.js application | `https://dudo.site` |
| `FIREBASE_ADMIN_PROJECT_ID` | Firebase Project ID for token verification and Firestore updates | e.g. `dudo-ai-prod` |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Firebase Service Account Client Email | e.g. `firebase-adminsdk@...` |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Firebase Service Account Private Key | `-----BEGIN PRIVATE KEY-----\n...` |
| `PUPPETEER_EXECUTABLE_PATH` | Path to installed Chromium binary in Docker container | `/usr/bin/chromium` |
| `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD` | Skip automatic Puppeteer Chromium download | `true` |

---

## 3. Endpoints

- `GET /health` — Health check endpoint (Returns `{ status: "healthy", activeClientsCount: N }`).
- `POST /v1/workspaces/:workspaceId/connect` — Initiates connection & returns QR code status.
- `GET /v1/workspaces/:workspaceId/status` — Checks current status (`disconnected`, `connecting`, `qr_ready`, `connected`).
- `GET /v1/workspaces/:workspaceId/qr` — Returns PNG QR image buffer.
- `POST /v1/workspaces/:workspaceId/disconnect` — Disconnects client and purges session directory.

---

## 4. DigitalOcean VPS Deployment Guide

### Prerequisites
1. Ubuntu 22.04 / 24.04 VPS (Minimum 2GB RAM / 1 vCPU; 4GB RAM recommended for multiple concurrent Chromium sessions).
2. Docker & Docker Compose installed.
3. Domain DNS pointed to VPS IP (e.g. `wa.dudo.site` -> `123.45.67.89`).

### Step 1: Create Host Storage Directory
On your DigitalOcean VPS host, create the persistent volume folder:
```bash
sudo mkdir -p /opt/dudo/whatsapp-sessions
sudo chmod -R 777 /opt/dudo/whatsapp-sessions
```

### Step 2: Clone & Configure Service
Clone repository or copy `services/whatsapp-service`:
```bash
cd /opt/dudo
git clone https://github.com/kishxrz/dudo-ai.git
cd dudo-ai/services/whatsapp-service
```

Create `.env` file:
```bash
cp .env.example .env
nano .env
```
Fill in `.env`:
```env
PORT=4000
NODE_ENV=production
WHATSAPP_SERVICE_SECRET=your_secure_service_secret
WHATSAPP_INTERNAL_SECRET=your_secure_internal_secret
WHATSAPP_SESSION_PATH=/data/whatsapp-sessions
DUDO_BASE_URL=https://dudo.site
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=your-client-email@...
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
```

### Step 3: Build & Start Docker Container
```bash
docker compose up -d --build
```

Verify status and logs:
```bash
docker compose ps
docker compose logs -f
```

Test healthcheck:
```bash
curl http://localhost:4000/health
# Expected output: {"status":"healthy","activeClientsCount":0}
```

---

## 5. Nginx Reverse Proxy & SSL Setup (HTTPS)

Install Nginx and Certbot on Ubuntu VPS:
```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

Create Nginx configuration `/etc/nginx/sites-available/wa.dudo.site`:
```nginx
server {
    server_name wa.dudo.site;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
    }
}
```

Enable site & obtain SSL certificate:
```bash
sudo ln -s /etc/nginx/sites-available/wa.dudo.site /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d wa.dudo.site
```

---

## 6. Dudo Main App Configuration

In your Dudo main application environment variables (Vercel / production `.env.local`):
```env
WHATSAPP_SERVICE_URL=https://wa.dudo.site
WHATSAPP_INTERNAL_SECRET=your_secure_internal_secret
WHATSAPP_SERVICE_SECRET=your_secure_service_secret
```

---

## 7. Operational Commands & Maintenance

- **View Container Logs**:
  ```bash
  docker logs -f dudo-whatsapp-service
  ```
- **Restart Container**:
  ```bash
  docker compose restart
  ```
- **Update & Rebuild**:
  ```bash
  git pull
  docker compose up -d --build
  ```
- **Inspect Session Files**:
  ```bash
  ls -la /opt/dudo/whatsapp-sessions
  ```

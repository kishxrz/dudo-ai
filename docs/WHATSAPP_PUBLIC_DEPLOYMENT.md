# Dudo Public WhatsApp Service — Generic Linux VM Production Deployment Guide

This guide provides step-by-step instructions to deploy the Dudo multi-tenant WhatsApp microservice on **any provider-agnostic Linux VM** (Ubuntu 22.04 / 24.04 LTS) using **Docker**, **Nginx Reverse Proxy**, and **Let's Encrypt SSL**.

---

## 1. Architecture Overview

```
Internet / Vercel (Main Dudo Next.js App)
        │
        │ HTTPS (WHATSAPP_SERVICE_URL=https://wa.dudo.site)
        ▼
Public Linux VM (Port 80 / 443)
        │
    Nginx Reverse Proxy (SSL Termination → http://127.0.0.1:4000)
        │
  Docker Container (dudo-whatsapp-service)
        │
  Node.js Express API (`GET /health`, `POST /connect`, `GET /qr`, `POST /disconnect`)
        │
  whatsapp-web.js + Puppeteer (Headless Chromium)
        │
  Persistent Session Volume (`whatsapp_sessions:/data/whatsapp-sessions`)
```

---

## 2. Prerequisites

1. Any Linux Server / VM (Ubuntu 22.04 or 24.04 LTS recommended). Minimum 2GB RAM / 1 vCPU; 4GB RAM recommended for high volume.
2. Root or sudo access via SSH.
3. Domain DNS record (`wa.dudo.site` pointing to `PUBLIC_SERVER_IP`).

---

## 3. Server Setup & Docker Installation

SSH into your Linux server:
```bash
ssh root@YOUR_PUBLIC_SERVER_IP
```

Install Docker & Docker Compose:
```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Docker via convenience script
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose plugin
sudo apt-get install -y docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

---

## 4. Clone Repository & Setup Environment

Create application directory:
```bash
mkdir -p /opt/dudo
cd /opt/dudo
git clone https://github.com/kishxrz/dudo-ai.git
cd dudo-ai/services/whatsapp-service
```

Create production `.env` file:
```bash
nano .env
```

Paste and customize environment variables:
```env
PORT=4000
NODE_ENV=production

# Shared Secrets (MUST match Dudo Next.js Vercel environment variables)
WHATSAPP_SERVICE_SECRET=YOUR_WHATSAPP_SERVICE_SECRET
WHATSAPP_INTERNAL_SECRET=YOUR_WHATSAPP_INTERNAL_SECRET

# Persistent Container Session Path
WHATSAPP_SESSION_PATH=/data/whatsapp-sessions

# Production Dudo Web App URL (For receiving AI webhook calls)
DUDO_BASE_URL=https://dudo.site

# Firebase Admin Credentials
FIREBASE_ADMIN_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxx@YOUR_FIREBASE_PROJECT_ID.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_FIREBASE_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"

# Puppeteer Chromium Settings inside Docker
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
```

---

## 5. Launch Docker Container

Start the WhatsApp service with Docker Compose:
```bash
docker compose up -d --build
```

Check container health & logs:
```bash
docker compose ps
docker compose logs -f
```

Test health check locally:
```bash
curl http://localhost:4000/health
# Expected output: {"status":"healthy","activeClientsCount":0}
```

---

## 6. Firewall Configuration

Configure UFW firewall rules:
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## 7. DNS Configuration

In your domain registrar / DNS management dashboard (Cloudflare, Namecheap, GoDaddy, etc.):

- **Type**: `A`
- **Host / Name**: `wa`
- **IPv4 Address / Value**: `YOUR_PUBLIC_SERVER_IP`
- **TTL**: 300s (5 minutes)

---

## 8. Nginx Reverse Proxy Setup

Install Nginx:
```bash
sudo apt update
sudo apt install -y nginx
```

Create Nginx site config `/etc/nginx/sites-available/wa.dudo.site`:
```bash
sudo nano /etc/nginx/sites-available/wa.dudo.site
```

Paste configuration:
```nginx
server {
    listen 80;
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

Enable site & test configuration:
```bash
sudo ln -s /etc/nginx/sites-available/wa.dudo.site /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 9. HTTPS SSL Setup (Certbot)

Install Certbot & obtain SSL certificate:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d wa.dudo.site
```

Test public HTTPS health endpoint from your local machine:
```bash
curl https://wa.dudo.site/health
# Output: {"status":"healthy","activeClientsCount":0}
```

---

## 10. Vercel Environment Variables Setup

In your Dudo main application project settings on **Vercel**:

- `WHATSAPP_SERVICE_URL` = `https://wa.dudo.site`
- `WHATSAPP_INTERNAL_SECRET` = `YOUR_WHATSAPP_INTERNAL_SECRET`
- `WHATSAPP_SERVICE_SECRET` = `YOUR_WHATSAPP_SERVICE_SECRET`

Redeploy the Next.js production build on Vercel after saving environment variables.

---

## 11. Maintenance & Operations

- **Restarting Microservice**:
  ```bash
  cd /opt/dudo/dudo-ai/services/whatsapp-service
  docker compose restart
  ```
- **Updating After GitHub Push**:
  ```bash
  cd /opt/dudo/dudo-ai/services/whatsapp-service
  git pull origin main
  docker compose up -d --build
  ```

---

## 12. Account Risk Notice

> [!WARNING]
> **UNOFFICIAL WHATSAPP INTEGRATION NOTICE**:
> The `whatsapp-web.js` browser-automation mechanism simulates a WhatsApp Web client session (`LocalAuth` + Headless Chromium). This is an **unofficial WhatsApp integration**. High-frequency automated spam or cold outreach on non-official WhatsApp Web clients carries a risk of account restriction/banning by Meta. Enterprise clients requiring official zero-ban guarantees should be migrated to Meta's official WhatsApp Business Cloud API.

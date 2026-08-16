# Dudo WhatsApp Service — DigitalOcean VPS Production Deployment Guide

This guide provides exact step-by-step instructions to deploy the Dudo multi-tenant WhatsApp microservice on a **DigitalOcean Ubuntu VPS** using **Docker**, **Nginx**, and **Certbot SSL**.

---

## Architecture Overview

```
Dudo Next.js Application (Vercel)
        │
        │ HTTPS (WHATSAPP_SERVICE_URL=https://wa.dudo.site)
        ▼
DigitalOcean Ubuntu VPS (IP: YOUR_DIGITALOCEAN_SERVER_IP)
        │
      Nginx Reverse Proxy (HTTPS 443 → HTTP 4000)
        │
      Docker Container (dudo-whatsapp-service)
        │
  whatsapp-web.js + Puppeteer (Chromium)
        │
  Persistent Session Mount (/opt/dudo/whatsapp-sessions ↔ /data/whatsapp-sessions)
```

---

## 1. Create DigitalOcean Droplet

1. Log into your [DigitalOcean Console](https://cloud.digitalocean.com).
2. Click **Create** → **Droplets**.
3. Choose OS: **Ubuntu 22.04 LTS** (or 24.04 LTS).
4. Choose Plan: **Basic** (Regular/Premium Intel or AMD CPU).
   - **Recommended Spec**: 2GB RAM / 1 vCPU minimum (4GB RAM / 2 vCPU recommended for high volume).
5. Choose Region: Pick the region closest to your users.
6. Authentication: Select **SSH Key** (or root password).
7. Click **Create Droplet** and note your Droplet IP address (`YOUR_DIGITALOCEAN_SERVER_IP`).

---

## 2. SSH into Server

Open your terminal and SSH into your new VPS:
```bash
ssh root@YOUR_DIGITALOCEAN_SERVER_IP
```

---

## 3. Install Docker

Run the official Docker convenience script:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

Verify Docker installation:
```bash
docker --version
```

---

## 4. Install Docker Compose Plugin

```bash
sudo apt-get update
sudo apt-get install -y docker-compose-plugin
docker compose version
```

---

## 5. Clone Dudo Repository

Create the application directory:
```bash
mkdir -p /opt/dudo
cd /opt/dudo
git clone https://github.com/kishxrz/dudo-ai.git
cd dudo-ai/services/whatsapp-service
```

---

## 6. Create WhatsApp Service `.env`

Create `.env` inside `services/whatsapp-service`:
```bash
nano .env
```

Paste and customize the following environment variables:
```env
PORT=4000
NODE_ENV=production

# Security & Shared Secrets (MUST match Dudo Next.js app Vercel env vars)
WHATSAPP_SERVICE_SECRET=YOUR_WHATSAPP_SERVICE_SECRET
WHATSAPP_INTERNAL_SECRET=YOUR_WHATSAPP_INTERNAL_SECRET

# Persistent Container Storage Path
WHATSAPP_SESSION_PATH=/data/whatsapp-sessions

# Production Dudo Next.js App Base URL (For receiving AI webhook calls)
DUDO_BASE_URL=https://dudo.site

# Firebase Admin Credentials
FIREBASE_ADMIN_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxx@YOUR_FIREBASE_PROJECT_ID.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_FIREBASE_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"

# Puppeteer Chromium Settings inside Docker
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
```

Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`).

---

## 7. Create Persistent Session Storage

Create the host directory for mounting persistent WhatsApp sessions:
```bash
sudo mkdir -p /opt/dudo/whatsapp-sessions
sudo chmod -R 775 /opt/dudo/whatsapp-sessions
```

---

## 8. Build & Start Docker Container

Run Docker Compose to build and launch the WhatsApp microservice in detached mode:
```bash
docker compose up -d --build
```

---

## 9. Check Container Status

Verify the container is running and healthy:
```bash
docker compose ps
```

---

## 10. Check Container Logs

Inspect live runtime logs:
```bash
docker compose logs -f
```

---

## 11. Test Health Endpoint Locally

Verify the HTTP server responds on port 4000:
```bash
curl http://localhost:4000/health
# Expected output: {"status":"healthy","activeClientsCount":0}
```

---

## 12. Configure UFW Firewall

Allow SSH, HTTP, and HTTPS traffic:
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## 13. Configure DNS Record (`wa.dudo.site`)

In your DNS provider (Cloudflare, Namecheap, GoDaddy, etc.):
- **Type**: `A`
- **Name / Host**: `wa`
- **IPv4 Address / Value**: `YOUR_DIGITALOCEAN_SERVER_IP`
- **TTL**: Auto / 300s

Wait 1-2 minutes for DNS propagation.

---

## 14. Install Nginx

```bash
sudo apt update
sudo apt install -y nginx
```

---

## 15. Configure Reverse Proxy (`wa.dudo.site`)

Create Nginx site configuration:
```bash
sudo nano /etc/nginx/sites-available/wa.dudo.site
```

Paste the following Nginx configuration:
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

Enable site and test configuration:
```bash
sudo ln -s /etc/nginx/sites-available/wa.dudo.site /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 16. Install Let's Encrypt SSL Certificate

Install Certbot:
```bash
sudo apt install -y certbot python3-certbot-nginx
```

Obtain and configure SSL certificate for `wa.dudo.site`:
```bash
sudo certbot --nginx -d wa.dudo.site
```

---

## 17. Test Public HTTPS Endpoint

Verify HTTPS connectivity from any external terminal:
```bash
curl https://wa.dudo.site/health
# Expected output: {"status":"healthy","activeClientsCount":0}
```

---

## 18. Restarting the Service

If you need to restart the microservice container:
```bash
cd /opt/dudo/dudo-ai/services/whatsapp-service
docker compose restart
```

---

## 19. Updating the Service After GitHub Push

When you push updates to GitHub, update the microservice on your VPS:
```bash
cd /opt/dudo/dudo-ai/services/whatsapp-service
git pull origin main
docker compose up -d --build
```

---

## Summary Checklist

- [x] Docker Container running on Port 4000 with `restart: unless-stopped`
- [x] Host directory `/opt/dudo/whatsapp-sessions` mounted to `/data/whatsapp-sessions`
- [x] Nginx reverse proxy routing `https://wa.dudo.site` → `http://127.0.0.1:4000`
- [x] SSL certificate active via Certbot
- [x] Vercel env var `WHATSAPP_SERVICE_URL=https://wa.dudo.site` configured

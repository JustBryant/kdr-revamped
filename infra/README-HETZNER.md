Hetzner VPS deployment quickstart
===============================

This document outlines a minimal, low-cost Hetzner deployment for running the KDR app with Postgres and Redis colocated to avoid cross-host egress.

Recommended Droplet
- Hetzner CX21 or CX31 (2 vCPU, 4GB-8GB RAM, NVMe) — inexpensive and reliable.

Steps
1) Provision a server in Hetzner Cloud (web UI or `hcloud` CLI). Use an Ubuntu 22.04 image.

2) Add SSH key, enable only SSH/HTTP/HTTPS in the control panel for the instance firewall.

3) Initial server setup (run as root or user with sudo):

```bash
# update and install basics
apt update && apt upgrade -y
apt install -y git curl ufw

# Add firewall rules
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Install Docker & Compose
curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh
apt install -y docker-compose-plugin

# Create deployment directory
mkdir -p /srv/kdr && cd /srv/kdr
git clone <your-repo-url> .
cp .env.production.example .env.production
```

4) Configure `.env.production` with your secrets (Postgres password, NEXTAUTH, JWT, etc.).

5) Build & run with Docker Compose (from `/srv/kdr`):

```bash
docker compose -f infra/docker-compose.hetzner.yml up -d --build
```

6) Migrate DB from Neon (see `infra/migrate_db.sh`).

7) Point your domain to the VPS IP or put Cloudflare in front. Enable Brotli/Gzip, set SSL (Cloudflare or use certbot on the VPS and mount certs into the Nginx container).

Notes & tuning
- If you want automatic certificate management via Let's Encrypt, run certbot on host and mount certs to `certs/` used by Nginx container, or use Cloudflare SSL.
- Monitor usage (`htop`, `docker stats`, `vnstat` for network) and scale VM size if needed.

#!/bin/sh
# deploy.sh - Automated deployment script for KDR Revamped on Hetzner
#
# 1. Pull latest code
# 2. Build/rebuild Docker images and containers
# 3. Run Prisma migrations and generate client
# 4. Build Next.js frontend
# 5. Restart all services

set -e

# Go to project root
dirname=$(dirname "$0")
cd "$dirname/.."

echo "[1/5] Pulling latest code..."
git pull

echo "[2/5] Building Docker images and containers..."
docker compose -f infra/docker-compose.hetzner.yml build

echo "[3/5] Running Prisma migrations and generating client..."
docker compose -f infra/docker-compose.hetzner.yml run --rm web npx prisma migrate deploy

echo "[4/5] Building Next.js frontend..."
docker compose -f infra/docker-compose.hetzner.yml run --rm web npm run build

echo "[5/5] Restarting all services..."
docker compose -f infra/docker-compose.hetzner.yml up -d

echo "Deployment complete!"

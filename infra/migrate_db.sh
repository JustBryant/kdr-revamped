#!/usr/bin/env bash
set -euo pipefail

# Usage examples:
# 1) Dump from Neon then scp to VPS and restore locally on VPS:
#    pg_dump -h neon.host -U neon_user -Fc neon_db > neon.dump
#    scp neon.dump root@your-vps:/root/
#    # on VPS
#    pg_restore -U kdr -d kdr -v /root/neon.dump

# 2) Direct pipe from Neon -> VPS (requires network access and creds):
#    pg_dump -h neon.host -U neon_user neon_db | ssh root@your-vps "pg_restore -U kdr -d kdr -v"

echo "This script contains example commands for migrating Postgres data from Neon to a self-hosted Postgres on your VPS."
echo "Replace neon host/user/db and your VPS hostname accordingly."

cat <<'INSTR'
Recommended flow (secure):
  - Create a temporary dump on your local machine: pg_dump -h <NEON_HOST> -U <NEON_USER> -Fc <NEON_DB> -f neon.dump
  - Secure copy to VPS: scp neon.dump root@<VPS_IP>:/root/
  - SSH to VPS, ensure Postgres service running and database created: sudo -u postgres psql -c "CREATE DATABASE kdr; CREATE USER kdr WITH PASSWORD 'changeme'; GRANT ALL PRIVILEGES ON DATABASE kdr TO kdr;"
  - Restore: pg_restore -U kdr -d kdr -v /root/neon.dump

Alternative (pipe over SSH):
  pg_dump -h <NEON_HOST> -U <NEON_USER> <NEON_DB> | ssh root@<VPS_IP> "pg_restore -U kdr -d kdr -v -"

After restore:
  - Update your `.env.production` with the new POSTGRES_URL (postgres://kdr:changeme@localhost:5432/kdr)
  - Restart docker-compose: docker compose -f infra/docker-compose.hetzner.yml up -d --build

INSTR

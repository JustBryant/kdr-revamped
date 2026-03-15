#!/usr/bin/env bash
set -euo pipefail

# Usage:
# PREREQS: run as root (ssh root@server)
# Example:
#   REPO_URL="https://github.com/<org>/<repo>.git" ALLOW_SSH_FROM="203.0.113.45/32" BRANCH="main" bash /root/setup-server.sh

: "${REPO_URL:?Need REPO_URL environment variable (git clone URL)}"
: "${ALLOW_SSH_FROM:?Need ALLOW_SSH_FROM environment variable (your IP/CIDR)}"
BRANCH="${BRANCH:-main}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"
COMPOSE_FILE="${COMPOSE_FILE:-infra/docker-compose.hetzner.yml}"
WORKDIR="/home/${DEPLOY_USER}/kdr"

echo "Bootstrap start: REPO_URL=${REPO_URL}, BRANCH=${BRANCH}, DEPLOY_USER=${DEPLOY_USER}, ALLOW_SSH_FROM=${ALLOW_SSH_FROM}"

# create deploy user if missing
if ! id "${DEPLOY_USER}" >/dev/null 2>&1; then
  echo "Creating user ${DEPLOY_USER}"
  adduser --gecos "" --disabled-password "${DEPLOY_USER}"
  usermod -aG sudo "${DEPLOY_USER}"
fi

mkdir -p "/home/${DEPLOY_USER}/.ssh"
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "/home/${DEPLOY_USER}/.ssh"
chmod 700 "/home/${DEPLOY_USER}/.ssh" || true

# Install Docker (official repo)
export DEBIAN_FRONTEND=noninteractive
apt update && apt upgrade -y
apt install -y ca-certificates curl gnupg lsb-release git

mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \"deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable\" \
  | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable --now docker

# Add deploy user to docker group
usermod -aG docker "${DEPLOY_USER}" || true

# UFW setup
apt install -y ufw
ufw --force reset || true
ufw default deny incoming
ufw default allow outgoing
ufw allow from ${ALLOW_SSH_FROM} to any port 22 proto tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Clone or update repo as deploy
if [ ! -d "${WORKDIR}" ]; then
  echo "Cloning ${REPO_URL} into ${WORKDIR}"
  sudo -u ${DEPLOY_USER} git clone -b "${BRANCH}" "${REPO_URL}" "${WORKDIR}"
else
  echo "Updating existing repo in ${WORKDIR}"
  cd "${WORKDIR}"
  sudo -u ${DEPLOY_USER} git fetch --all
  sudo -u ${DEPLOY_USER} git reset --hard origin/${BRANCH}
fi

# ensure .env.production exists
if [ ! -f "${WORKDIR}/infra/.env.production" ]; then
  echo "WARNING: ${WORKDIR}/infra/.env.production not found. Please create it with required env vars from infra/README-HETZNER.md"
  echo "Skipping docker-compose start. After you create .env.production, run:\n  cd ${WORKDIR}/infra && docker compose -f ${COMPOSE_FILE} up -d --build"
  exit 0
fi

# Start the infra compose
cd "${WORKDIR}/infra"

echo "Pulling and starting compose stack (file: ${COMPOSE_FILE})"
# run as deploy user so volumes are owned correctly
sudo -u ${DEPLOY_USER} docker compose -f "${COMPOSE_FILE}" pull || true
sudo -u ${DEPLOY_USER} docker compose -f "${COMPOSE_FILE}" up -d --build

echo "Bootstrap finished. Check 'docker compose -f ${COMPOSE_FILE} ps' and logs with 'docker compose -f ${COMPOSE_FILE} logs -f'"

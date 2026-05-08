#!/usr/bin/env bash
# First-time server setup on a fresh OVH Public Cloud instance (Ubuntu 22.04)
# Run once as root immediately after provisioning:
#   curl -sSL https://raw.githubusercontent.com/... | bash
#   or: bash infra/setup-server.sh

set -euo pipefail

log() { echo "[$(date '+%H:%M:%S')] $*"; }

# ── System update ──────────────────────────────────────────────────────────────

log "Updating system packages..."
apt-get update -q
apt-get upgrade -y -q

# ── Docker ────────────────────────────────────────────────────────────────────

log "Installing Docker..."
apt-get install -y -q ca-certificates curl gnupg

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update -q
apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-compose-plugin

systemctl enable docker
systemctl start docker

# ── Certbot ───────────────────────────────────────────────────────────────────

log "Installing Certbot..."
apt-get install -y -q certbot
mkdir -p /var/www/certbot

# ── App directory ──────────────────────────────────────────────────────────────

log "Creating /opt/swwarm ..."
mkdir -p /opt/swwarm
cd /opt/swwarm

# Placeholder for env file — operator must fill this in before deploying
if [[ ! -f .env.prod ]]; then
  cat > .env.prod << 'EOF'
# Fill in all REPLACE_ME values — see infra/.env.prod.example
PUBLIC_URL=https://app.swwarm.com
DOCKER_IMAGE=swwarm/app:latest
BETTER_AUTH_SECRET=REPLACE_ME
DATABASE_URL=REPLACE_ME
REDIS_URL=REPLACE_ME
VAULT_MASTER_KEY=REPLACE_ME
OPENROUTER_API_KEY=REPLACE_ME
FIRECRAWL_API_KEY=REPLACE_ME
INTERNAL_AUTH_TOKEN=REPLACE_ME
EOF
  log ".env.prod created — fill in values before running deploy.sh"
fi

# ── Firewall (ufw) ────────────────────────────────────────────────────────────

log "Configuring firewall..."
apt-get install -y -q ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

log ""
log "================================================================"
log " Server setup complete. Next steps:"
log ""
log " 1. Edit /opt/swwarm/.env.prod — fill in all REPLACE_ME values"
log ""
log " 2. Issue SSL certificate:"
log "    certbot certonly --standalone -d app.swwarm.com --email luc.boilly@gmail.com --agree-tos"
log ""
log " 3. Copy infra/ files to /opt/swwarm/infra/"
log "    (or git clone your repo to /opt/swwarm)"
log ""
log " 4. Run first deploy:"
log "    bash /opt/swwarm/infra/deploy.sh"
log "================================================================"

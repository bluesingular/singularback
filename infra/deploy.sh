#!/usr/bin/env bash
# OVH production deploy script
# Run from the server: bash /opt/swwarm/infra/deploy.sh
#
# What it does:
#   1. Pulls latest Docker image (or builds locally if IMAGE_TAG=local)
#   2. Runs database migrations
#   3. Restarts the app container with zero-downtime restart
#   4. Verifies health endpoint

set -euo pipefail

COMPOSE_FILE="/opt/swwarm/infra/docker-compose.prod.yml"
ENV_FILE="/opt/swwarm/.env.prod"
HEALTH_URL="https://app.swwarm.com/api/health"
MAX_HEALTH_RETRIES=15

log() { echo "[$(date '+%H:%M:%S')] $*"; }
fail() { echo "[$(date '+%H:%M:%S')] FAIL: $*" >&2; exit 1; }

# ── Preflight ──────────────────────────────────────────────────────────────────

[[ -f "$ENV_FILE" ]] || fail ".env.prod not found at $ENV_FILE"
[[ -f "$COMPOSE_FILE" ]] || fail "docker-compose.prod.yml not found"

# shellcheck source=/dev/null
source "$ENV_FILE"

log "Deploying image: ${DOCKER_IMAGE:-swwarm/app:latest}"

# ── Pull latest image ──────────────────────────────────────────────────────────

docker pull "${DOCKER_IMAGE:-swwarm/app:latest}" || fail "docker pull failed"

# ── Run migrations ─────────────────────────────────────────────────────────────

log "Running database migrations..."
docker run --rm \
  --env DATABASE_URL="$DATABASE_URL" \
  "${DOCKER_IMAGE:-swwarm/app:latest}" \
  sh -c "cd /app && pnpm --filter @paperclipai/db migrate" \
  || fail "Migrations failed — deploy aborted"

log "Migrations complete."

# ── Restart app container ──────────────────────────────────────────────────────

log "Restarting app container..."
docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  up -d --no-deps --force-recreate app

log "App container restarted."

# ── Health check ───────────────────────────────────────────────────────────────

log "Waiting for health check at $HEALTH_URL ..."
for i in $(seq 1 $MAX_HEALTH_RETRIES); do
  if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
    log "Health check passed after ${i}s."
    break
  fi
  if [[ $i -eq $MAX_HEALTH_RETRIES ]]; then
    fail "Health check failed after ${MAX_HEALTH_RETRIES}s — check logs: docker logs swwarm-app-1"
  fi
  sleep 2
done

log "Deploy complete."

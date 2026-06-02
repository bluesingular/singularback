# OPERATIONS.md — Swwarm Platform Runbook
**For:** Engineering team, first ops hire  
**Audience:** People who have shell access to production  
**Version:** 1.0 — matches platform v3 (22+ commits ahead of origin/main)

---

## 1. Environment variables reference

### Required (platform will not start without these)

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string with pgvector | `postgresql://swwarm:pass@db:5432/swwarm` |
| `REDIS_URL` | Redis/Valkey connection string | `redis://redis:6379` |
| `VAULT_MASTER_KEY` | AES-256 master key — 64 hex chars (32 bytes). **Never in the DB.** | `a3f8...` (64 chars) |
| `BETTER_AUTH_SECRET` | better-auth session signing secret — min 32 chars | `$(openssl rand -hex 32)` |
| `OPENROUTER_API_KEY` | LLM routing — all non-GDPR models | `sk-or-...` |

### Required for production features

| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | Billing — Stripe secret key (`sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification (`whsec_...`) |
| `STRIPE_GROWTH_PRICE_ID` | Growth plan monthly price ID |
| `STRIPE_PRO_PRICE_ID` | Pro plan monthly price ID |
| `RESEND_API_KEY` | Transactional email via Resend |
| `FROM_EMAIL` | Sender address for all platform emails |
| `OPENAI_API_KEY` | Whisper voice transcription (§16 voice-to-agent) |
| `VAPID_PUBLIC_KEY` | Web push notifications — generate with `web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | Web push notifications |
| `VAPID_SUBJECT` | Web push contact (`mailto:ops@singular.blue`) |

### Optional / defaults shown

| Variable | Default | Description |
|---|---|---|
| `VAULT_KEY_VERSION` | `1` | Current vault key version — increment on rotation |
| `PORT` | `3000` | HTTP listen port |
| `NODE_ENV` | `production` | Set to `production` in prod |
| `PLATFORM_VERSION` | `1.0.0` | Used for pack compatibility checks |
| `PAPERCLIP_DEPLOYMENT_MODE` | `authenticated` | `local_trusted` bypasses auth (dev only) |
| `PAPERCLIP_PUBLIC_URL` | — | Public URL of the app (used in emails, webhooks) |
| `PAPERCLIP_MIGRATION_AUTO_APPLY` | `false` | Set `true` to auto-run migrations on start |
| `FIRECRAWL_API_KEY` | — | Web search tool for agents |
| `HEARTBEAT_SCHEDULER_ENABLED` | `true` | BullMQ heartbeat cron |

### Generating secrets

```bash
# VAULT_MASTER_KEY — 64 hex chars
openssl rand -hex 32

# BETTER_AUTH_SECRET
openssl rand -hex 32

# VAPID keys
npx web-push generate-vapid-keys
```

---

## 2. First deploy checklist

```
□ PostgreSQL 15+ with pgvector extension installed
□ Redis 7+ running
□ All Required env vars set
□ DATABASE_URL points to an empty database
□ Run migrations: pnpm db:migrate
□ Bootstrap first admin: pnpm paperclipai auth bootstrap-ceo
□ Check health endpoint: curl https://your-domain/api/health
□ Verify BullMQ workers started (check logs for "worker started")
□ Verify morning intelligence sweep scheduled (logs: "intelligence sweep registered")
□ Verify fleet snapshot scheduled (logs: "fleet snapshot registered")
□ Install Pack P1 via admin portal → Catalogue
□ Confirm seed tasks fire within 10 minutes of installation
```

### Migrations

```bash
# Apply all pending migrations
pnpm db:migrate

# Check current migration state
pnpm db:status

# Current migration count: 97 files (0001 → 0096)
# pgvector extension must be installed before first migration:
#   CREATE EXTENSION IF NOT EXISTS vector;
```

---

## 3. BullMQ queues

Three queues run in the same Redis instance:

| Queue | Purpose | Workers |
|---|---|---|
| `agents` | Task execution, agent jobs | Agent worker, heartbeat worker |
| `background` | Non-urgent background tasks | Morning intelligence, cost reset |
| `system` | Platform cron jobs | Fleet snapshot (6h), intelligence sweep (8am UTC) |

### Checking queue health

```bash
# Queue depth (requires redis-cli)
redis-cli llen bull:agents:wait
redis-cli llen bull:background:wait
redis-cli llen bull:system:wait

# Stalled jobs
redis-cli llen bull:agents:failed
```

### Clearing a stuck queue (last resort)

```bash
# Only use this if jobs are genuinely stuck and you understand why
redis-cli del bull:agents:active
```

---

## 4. Vault key rotation

The vault uses AES-256-GCM with HKDF per-company key derivation. The master key lives only in the environment — never in the database.

**When to rotate:** Every 90 days or immediately after a suspected key compromise.

### Rotation procedure

```bash
# Step 1 — Generate new master key
NEW_KEY=$(openssl rand -hex 32)
echo "New key: $NEW_KEY"

# Step 2 — Set both old and new key in environment (during rotation window)
# Old key stays accessible as VAULT_MASTER_KEY_V{N}
# Example: if current VAULT_KEY_VERSION=1, set:
export VAULT_MASTER_KEY_V1=$OLD_KEY   # old key, still needed to decrypt
export VAULT_MASTER_KEY=$NEW_KEY       # new key for re-encryption
export VAULT_KEY_VERSION=2             # increment

# Step 3 — Run rotation script (re-encrypts all credentials with new key)
pnpm tsx scripts/rotate-vault-keys.ts

# Step 4 — Verify rotation succeeded
# Check logs: "vault rotation complete, N credentials re-encrypted"

# Step 5 — Remove old key from environment
unset VAULT_MASTER_KEY_V1

# Step 6 — Restart server with new VAULT_MASTER_KEY and VAULT_KEY_VERSION=2
```

**Critical:** If the rotation script fails mid-way, credentials are in a mixed state. The server will continue to work (it tries the current version first, then falls back to previous versions). Re-run the rotation script — it is idempotent.

---

## 5. SLA tiers and breach response

| Plan | Resolution SLA | Uptime target | History |
|---|---|---|---|
| Solo | 24h | 99.0% | 90 days |
| Growth | 8h | 99.5% | 365 days |
| Pro | 4h | 99.7% | 2 years |
| Enterprise | 1h | 99.9% | 5 years |

**Resolution time** = from platform detection to operator receiving a plain-language explanation + remediation. NOT from when the operator reports it.

**Breach compensation:** 1 credit day per hour over limit, capped at 10 days/month. Stored in `sla_events` table. Applied automatically at next billing cycle.

### Responding to a breach

```bash
# 1. Check sla_events for recent breaches
SELECT * FROM sla_events 
WHERE breached_at > NOW() - INTERVAL '24 hours'
ORDER BY breached_at DESC;

# 2. Identify affected companies
SELECT company_id, plan, breached_at, resolution_hours_sla, resolution_hours_actual 
FROM sla_events WHERE resolved = false;

# 3. Apply credit manually if auto-credit failed
INSERT INTO billing_credits (company_id, credit_days, reason, created_at)
VALUES ('...', 2, 'SLA breach compensation', NOW());

# 4. Mark resolved
UPDATE sla_events SET resolved = true, resolved_at = NOW()
WHERE id = '...';
```

---

## 6. Database backup

Backups are configured via environment variables:

```bash
PAPERCLIP_DB_BACKUP_ENABLED=true
PAPERCLIP_DB_BACKUP_DIR=/var/backups/swwarm
PAPERCLIP_DB_BACKUP_INTERVAL_MINUTES=360   # every 6 hours
PAPERCLIP_DB_BACKUP_RETENTION_DAYS=30
```

The platform runs `pg_dump` internally. For production, supplement with managed database snapshots (Supabase, Railway, RDS).

### Manual backup

```bash
pg_dump $DATABASE_URL --format=custom --file=swwarm_$(date +%Y%m%d_%H%M%S).dump
```

### Restore

```bash
pg_restore --dbname=$DATABASE_URL --clean swwarm_20260101_080000.dump
```

---

## 7. GDPR compliance procedures

### Right to erasure (Article 17)

```bash
# Operator-initiated via Settings → GDPR
# Admin-initiated via admin portal → GDPR
# Or directly:

POST /companies/:companyId/gdpr/contacts/:contactId/erase
# Anonymises: name, email, phone. Preserves: task outcomes, aggregated metrics.

POST /companies/:companyId/gdpr/users/:userId/erase  
# Removes user account. Company data retained per data processing agreement.
```

### Data export (Article 20)

```bash
# Operator self-service via Settings → Export
# Or API:
POST /companies/:companyId/export/full
# Returns JSON archive: tasks, missions, memory, contacts, costs
# Async — check status at GET /companies/:companyId/export/:jobId
```

### Audit log

```bash
# All actions are immutable — DB trigger prevents UPDATE/DELETE on audit_entries
# Export for compliance:
SELECT * FROM audit_entries 
WHERE company_id = '...'
ORDER BY created_at DESC;
```

---

## 8. LLM routing and GDPR rule

**RULE 1 is enforced in code:** `gdprRequired: true` → **Mistral EU only**.  
DeepSeek is blocked at the router level for any GDPR-flagged skill.

```
T0  = mistralai/ministral-3b         (micro tasks)
T1  = mistralai/mistral-small-3.2   (GDPR-safe, EU)  ← personal data always routes here
T2  = deepseek/deepseek-chat-v3-5   (non-personal, fast)
T2Q = mistralai/mistral-medium-3.1  (GDPR-safe quality)
T3  = anthropic/claude-sonnet-4-5   (frontier, EU-contractual)
```

If OpenRouter goes down, T1_FR falls back to itself (no non-EU fallback). Tasks queue and retry.

### Monitoring LLM costs

```bash
SELECT 
  DATE_TRUNC('day', created_at) as day,
  model,
  SUM(cost_eur) as cost_eur,
  SUM(input_tokens + output_tokens) as tokens
FROM cost_entries
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY 1, 2
ORDER BY 1 DESC, 3 DESC;
```

---

## 9. Health checks

```bash
# Platform health (Redis + Postgres)
GET /api/health
# → { redis: "ok"|"degraded", postgres: "ok"|"degraded" }

# Full BullMQ worker status (admin only)
GET /instance/admin/health
```

### Dispatcher health indicator

The top navigation shows a real-time dispatcher status:
- 🟢 All agents active
- 🟡 N integrations need attention
- 🔴 Agents stopped

If 🔴: check BullMQ worker logs, Redis connectivity, and the `platform_health_cache` table.

---

## 10. Common incidents

### Agents stopped processing tasks

```bash
# 1. Check Redis connection
redis-cli ping  # should return PONG

# 2. Check BullMQ worker logs
journalctl -u swwarm -n 100 | grep "worker"

# 3. Check active jobs that may be stuck
SELECT id, status, created_at, updated_at 
FROM tasks 
WHERE status = 'running' 
AND updated_at < NOW() - INTERVAL '1 hour';

# 4. Force-fail stale running tasks (they will retry)
UPDATE tasks SET status = 'failed', failure_reason = 'failed_permanent'
WHERE status = 'running' AND updated_at < NOW() - INTERVAL '2 hours';
```

### Pack install seed tasks not firing

```bash
# Check pending_jobs outbox (transactional outbox pattern)
SELECT * FROM pending_jobs WHERE sent_at IS NULL ORDER BY created_at;

# If rows are stuck, restart the outbox worker or manually enqueue:
# The outbox worker polls every 5s and enqueues to BullMQ
```

### Memory growing unbounded in Redis

```bash
# Check BullMQ job accumulation
redis-cli info memory | grep used_memory_human

# Cleanup completed jobs (platform does this automatically, but if misconfigured)
# Queue config: removeOnComplete: { count: 1000, age: 86400 }
# removeOnFail: { count: 500, age: 604800 }

# Force cleanup
redis-cli eval "return redis.call('del', unpack(redis.call('keys', 'bull:agents:completed:*')))" 0
```

### Invalid task state transition

```bash
# The C1 state machine trigger will raise an exception visible in logs:
# "Invalid task state transition: X → Y"

# To manually fix a corrupted task (use the valid_transitions map):
UPDATE tasks SET status = 'failed' WHERE id = '...' AND status = 'running';
```

---

## 11. Monitoring queries

```sql
-- Active tasks right now
SELECT t.id, t.title, t.status, a.display_name as agent, t.created_at
FROM tasks t
LEFT JOIN agents a ON a.id = t.assignee_agent_id
WHERE t.status IN ('running', 'pending_approval', 'awaiting_clarification')
ORDER BY t.created_at;

-- Tasks completed today per company
SELECT c.name, COUNT(*) as tasks_done
FROM tasks t
JOIN companies c ON c.id = t.company_id
WHERE t.status = 'done' AND t.completed_at > CURRENT_DATE
GROUP BY c.name ORDER BY 2 DESC;

-- Cost this month per company
SELECT c.name, c.plan, ROUND(SUM(ce.cost_eur)::numeric, 2) as cost_eur
FROM cost_entries ce
JOIN companies c ON c.id = ce.company_id
WHERE ce.created_at > DATE_TRUNC('month', NOW())
GROUP BY c.name, c.plan ORDER BY 3 DESC;

-- Security events (injection attempts)
SELECT event_type, severity, COUNT(*), MAX(created_at) as last_seen
FROM security_events
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY 1, 2 ORDER BY 3 DESC;

-- Agents near autonomous threshold (≥4.5 score)
SELECT a.display_name, a.slug, ts.score, ts.autonomy_level, ts.task_count
FROM trust_scores ts
JOIN agents a ON a.id = ts.agent_id
WHERE ts.score >= 4.5
ORDER BY ts.score DESC;
```

---

## 12. Re-embedding org memory

If `EMBEDDING_CONFIG.model` is ever changed (currently `mistral-embed`, 1024 dimensions), all existing embeddings must be regenerated before semantic search works correctly.

```bash
# WARNING: this touches every org_memory row
yarn tsx scripts/re-embed-all.ts --confirm

# This script:
# 1. Reads all non-archived memory_entries in batches of 100
# 2. Calls Mistral Embed API for new embeddings  
# 3. Updates the embedding column
# 4. Logs progress and errors
# Do NOT run during business hours — it will spike API costs
```

---

## 13. Scaling notes

| Threshold | Action |
|---|---|
| >500k org_memory rows per company | Switch pgvector index from HNSW to IVFFlat (see migration note in T2) |
| >10 concurrent companies | Scale Redis to cluster mode |
| >1000 req/min | Add a second server process behind load balancer (BullMQ workers are stateless) |
| >100 companies | Enable semantic caching (Gap F) to reduce OpenRouter spend by 30–40% |

### Horizontal scaling

BullMQ workers are stateless — you can run multiple server instances against the same Redis + Postgres. The queue ensures each job is processed exactly once. Session state is in the database (better-auth), not in-process.

```
[nginx/Cloudflare]
    ↓
[server-1] [server-2] [server-3]   ← all stateless, same Redis + Postgres
    ↓
[PostgreSQL + pgvector]  [Redis]
```

---

*Last updated: June 2026. Keep this file current when env vars or procedures change.*

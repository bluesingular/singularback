# TECHNICAL_SPEC_v2.md

Swwarm Technical Architecture — Implementation patterns, stack decisions, and deployment strategy.

---

## 1. Technology Stack

```
Frontend:
  React 18 + Vite (development server)
  TailwindCSS (styling)
  TypeScript (type safety)
  ShadcN/UI (component library)
  React Router (navigation)
  TanStack Query (server state)
  Zustand (client state)

Backend:
  Node.js 20+ (runtime)
  TypeScript (type safety)
  Express.js (HTTP server)
  Drizzle ORM (type-safe database queries)
  Zod (runtime schema validation)

Database:
  PostgreSQL 17 (primary data store)
  pgvector (vector embeddings for semantic search)
  UUID extension (distributed IDs)

Message Queue & Cache:
  Redis (in-memory store, BullMQ backing)
  BullMQ (job queue for async tasks)

LLM Providers:
  Mistral AI (primary — T0, T1_FR, T2_Q, T3 tiers)
  OpenRouter (fallback for specific models)
  Anthropic Claude (T3 tier for complex reasoning)

Search & Analytics:
  Meilisearch (optional — full-text search on org memory)
  PostHog (optional — product analytics)

Infrastructure:
  Hetzner (development/testing, €35/month)
  Scaleway (production, scales to €500+/month)
  CloudFlare (optional — CDN for static assets)

Version Control & CI/CD:
  GitHub (repository)
  GitHub Actions (CI/CD)
  Docker (containerization for deployment)
```

---

## 2. Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│ PRESENTATION LAYER (React)                              │
│  - CEO Console (operatives floor, board, intelligence) │
│  - Admin Portal (admin.swwarm.com)                      │
│  - Customer Portal (app.swwarm.com)                     │
│  - Auth pages (login, onboarding)                       │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API / WebSocket
                       ▼
┌─────────────────────────────────────────────────────────┐
│ API LAYER (Express.js)                                  │
│  - REST endpoints (/api/v1/...)                         │
│  - WebSocket handler (SSE for real-time updates)       │
│  - Authentication & authorization (JWT + RBAC)         │
│  - Request validation (Zod schemas)                     │
│  - Error handling & logging                            │
└──────────────────────┬──────────────────────────────────┘
                       │ Drizzle ORM
                       ▼
┌─────────────────────────────────────────────────────────┐
│ BUSINESS LOGIC LAYER                                    │
│  - Trust calibration (M9)                               │
│  - Memory assembly & retrieval (M2, M8)                 │
│  - LLM routing & context preparation (M3)              │
│  - Quality gates & damage control (M6)                  │
│  - Self-improvement pipelines (M10, WC-1)              │
│  - Skill execution orchestration                        │
│  - Goal tracking & proactive intelligence (WC-4)       │
└──────────────────────┬──────────────────────────────────┘
                       │ BullMQ / Redis
                       ▼
┌─────────────────────────────────────────────────────────┐
│ WORKER LAYER (Node.js processes)                        │
│  - Task execution workers (M0 core loop)               │
│  - Async background jobs                                │
│  - LLM API calls (with retry logic)                    │
│  - Integration webhooks                                 │
│  - Scheduled jobs (morning intelligence, analytics)    │
└──────────────────────┬──────────────────────────────────┘
                       │ Queries
                       ▼
┌─────────────────────────────────────────────────────────┐
│ DATA LAYER (PostgreSQL 17 + pgvector + Redis)          │
│  - Relational data (companies, users, agents, tasks)   │
│  - Vector embeddings (org memory semantic search)      │
│  - Session cache & real-time state (Redis)             │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Core Execution Flow

```
1. TASK CREATION (API endpoint POST /tasks)
   ├─ Validate input (Zod schema)
   ├─ Fetch Company DNA + Agent soul.md
   ├─ Fetch relevant org_memory (semantic search via pgvector)
   ├─ Assemble full context (§2 M2 Context Assembly)
   ├─ Pin skill_version (NEVER use latest — pin at creation)
   ├─ Create task record in DB
   └─ Enqueue to BullMQ: task_execute job

2. TASK EXECUTION (BullMQ worker)
   ├─ Fetch task + context
   ├─ Apply input guardrails (§9b Layer 1)
   ├─ Select LLM tier based on skill (§3 M3 LLM Router)
   ├─ Prepare prompt + context
   ├─ Call LLM API (with exponential backoff retry)
   ├─ Run LLM-as-Judge (§9b Layer 2) — every output scored
   ├─ Check Constitutional constraints (§9b Layer 3)
   ├─ Apply quality gates (§6 M6) — pass/fail/recycle
   ├─ Store output + execution trace
   ├─ Update task status → pending_approval
   └─ Notify operator via SSE + morning intelligence card

3. OPERATOR APPROVAL (CEO Console)
   ├─ Operator sees "Votre attention" column
   ├─ Views task output + judge score + confidence flag
   ├─ Options: approve / reject / inline edit / request clarification
   ├─ On approve: update task status → approved
   │  └─ Enqueue: execute_approved_action job
   ├─ On reject: create new version → back to execution step 2
   └─ On inline edit: create live_edit_example → approve edited version

4. ACTION EXECUTION (BullMQ worker)
   ├─ Check zero-tolerance actions (§33 Gap E)
   ├─ Check external action approval requirement (§15)
   ├─ Execute action (send email, create calendar, query CRM, etc.)
   ├─ Capture response + any errors
   ├─ On success: update task → completed
   │  └─ Trigger post-task jobs (WC-1 outcome analytics, M10 self-improvement)
   └─ On failure: create damage control notification (§15 M6)

5. BACKGROUND JOBS (scheduled or event-triggered)
   ├─ Morning intelligence generation (daily 8am)
   ├─ Goal checkpoint evaluation (weekly)
   ├─ Self-improvement processing (daily)
   ├─ Org memory cleanup + stale detection (daily)
   ├─ Behavioral anomaly detection (weekly)
   ├─ Model upgrade compatibility testing (on new model release)
   └─ Collective intelligence aggregation (daily)
```

---

## 4. Database Schema (Abridged)

See PLATFORM_FUNCTIONAL_SPEC_v8.md §25 for full schema. Key tables:

```sql
-- TENANCY & USERS
companies(id, name, plan, locale, timezone, created_at)
users(id, email, verified_at, is_partner, partner_certified_at)
company_members(id, company_id, user_id, role)

-- AGENTS & SKILLS
agents(id, company_id, slug, display_name, soul_md, status)
skills(id, company_id, agent_id, slug, tier, 
       source_company_id, source_skill_id, master_version)
skill_versions(id, skill_id, version, scope, content JSONB, 
               test_pass_rate, published_at)

-- TRUST
trust_scores(id, company_id, agent_id, skill_id, 
             composite, autonomy_level, updated_at)
trust_proposals(id, company_id, agent_id, skill_id, 
                proposed_level, status, decided_at)

-- MISSIONS & TASKS
missions(id, company_id, title, status, orchestrator_id)
tasks(id, company_id, mission_id, agent_id, skill_id, skill_version,
      status, output JSONB, created_at)
task_execution_events(id, task_id, event_type ENUM, payload JSONB)
task_checkpoints(id, task_id, step_number, execution_state JSONB)

-- MEMORY
org_memory(id, company_id, key, value JSONB, embedding VECTOR(1024),
           written_by, client_context_id, created_at)
company_dna(id, company_id, data JSONB)
company_narrative(id, company_id, narrative_md TEXT, 
                  momentum VARCHAR, created_at)

-- QUALITY & OUTCOMES
quality_gates(id, skill_id, field_name, min_threshold, max_threshold)
judge_results(id, company_id, task_id, output_version, 
              dimensions JSONB, overall_score, auto_recycled)
task_outcomes(id, company_id, mission_id, outcome_value VARCHAR,
              contributed_tasks JSONB[], created_at)

-- NOTIFICATIONS
notifications(id, company_id, recipient_user_id, type, 
              payload JSONB, read_at, created_at)

-- AUDIT
audit_entries(id, company_id, user_id, action, payload JSONB, 
              timestamp)
security_events(id, company_id, event_type, severity, 
                payload JSONB, created_at)
```

---

## 5. LLM Router (M3)

Decision tree for model selection:

```typescript
function selectLLMTier(task: Task): ModelTier {
  const skill = await getSkill(task.skillId)
  const trust = await getTrustScore(task.agentId, task.skillId)
  
  if (skill.gdprRequired && hasPersonalData(task.context)) {
    // GDPR invariant: personal data ONLY to Mistral EU
    return 'T1_FR'  // mistral-small-3.2 (GDPR-safe, EU-hosted)
  }
  
  if (skill.aiActRisk === 'high') {
    // High-risk decisions → best reasoning capability
    return 'T3'  // claude-sonnet-4-5 (reasoning, explainability)
  }
  
  if (skill.tier === 'T0') {
    // Routing + simple classification
    return 'T0'  // ministral-3b (fast, cheap)
  }
  
  if (skill.tier === 'T1') {
    // Drafting, analysis, standard output
    if (task.context.language === 'fr') return 'T1_FR'  // mistral-small
    if (task.context.language === 'en') return 'T1_EN'  // deepseek
    return 'T1_FR'
  }
  
  if (skill.tier === 'T2') {
    // Complex reasoning or large output
    if (task.outputSize > 2000) return 'T2_Q'  // mistral-medium (large context)
    return 'T2_S'  // gemini-flash (fast)
  }
  
  if (skill.tier === 'T3' || trust.autonomyLevel === 'full_autonomous') {
    // Complex agentic decisions
    return 'T3'  // claude-sonnet-4-5
  }
  
  // Default: safe middle ground
  return 'T2_S'
}
```

Model registry:
```typescript
const MODEL_REGISTRY = {
  T0:     'mistralai/ministral-3b',
  T1_FR:  'mistralai/mistral-small-3.2',
  T1_EN:  'deepseek/deepseek-chat-v3-5',
  T2_S:   'google/gemini-flash-1.5',
  T2_Q:   'mistralai/mistral-medium-3.1',
  T3:     'anthropic/claude-sonnet-4-5',
  JUDGE:  'mistralai/mistral-small-3.2',  // Always T1_FR for judges
} as const

const TOKEN_LIMITS = {
  T0:     2000,
  T1_FR:  6000,
  T1_EN:  8000,
  T2_S:   10000,
  T2_Q:   20000,
  T3:     16000,
} as const
```

---

## 6. BullMQ Job Queue

Job types and their schedules:

```typescript
interface BullQueue {
  // Immediate (user-triggered)
  task_execute: {
    payload: { taskId: string }
    maxAttempts: 3
    backoff: exponential
  }
  
  execute_approved_action: {
    payload: { taskId: string }
    priority: 'high'
  }
  
  // Scheduled background jobs
  morning_intelligence_generation: {
    cron: '0 8 * * *'  // 8am every day
    timezone: 'company.timezone'
  }
  
  goal_checkpoint_evaluation: {
    cron: '0 9 * * 1'  // Monday 9am
  }
  
  skill_self_improvement: {
    cron: '0 2 * * *'  // 2am (off-peak)
    batch: true        // process 100+ at once
  }
  
  behavioral_anomaly_detection: {
    cron: '0 3 * * 0'  // Sunday 3am
  }
  
  // Webhook processing
  integration_webhook: {
    payload: { webhookId: string, data: any }
    maxAttempts: 5
    retryDelay: 30s
  }
}
```

---

## 7. API Structure

```
GET    /api/v1/health                    # Health check
POST   /api/v1/auth/login                # Authentication
POST   /api/v1/auth/logout

GET    /api/v1/companies/:id             # Read company
PATCH  /api/v1/companies/:id             # Update settings
GET    /api/v1/companies/:id/usage       # Metrics

GET    /api/v1/agents                    # List agents
POST   /api/v1/agents                    # Create agent
GET    /api/v1/agents/:id
PATCH  /api/v1/agents/:id
POST   /api/v1/agents/:id/soul           # Update soul.md

POST   /api/v1/tasks                     # Create task (enqueues job)
GET    /api/v1/tasks/:id                 # Get task + output
PATCH  /api/v1/tasks/:id                 # Update status, approve, reject
POST   /api/v1/tasks/:id/steer           # Real-time steering (Gap A9)
GET    /api/v1/tasks                     # List tasks (paginated)

POST   /api/v1/missions                  # Create mission
GET    /api/v1/missions/:id
PATCH  /api/v1/missions/:id
POST   /api/v1/missions/:id/complete

GET    /api/v1/skills                    # List skills
GET    /api/v1/skills/:id
GET    /api/v1/skills/:id/performance    # Stats + golden dataset

POST   /api/v1/org_memory/search         # Semantic search
GET    /api/v1/org_memory/:id

GET    /api/v1/goals                     # List goals
POST   /api/v1/goals                     # Create goal
PATCH  /api/v1/goals/:id

GET    /api/v1/trust_scores              # Trust dashboard
POST   /api/v1/trust_proposals           # Propose autonomy change

POST   /api/v1/integrations              # Register integration
POST   /api/v1/integrations/:id/webhook  # Receive webhook events
GET    /api/v1/integrations/:id/status   # Connection status

WebSocket /ws/:sessionId                 # Real-time SSE updates
  - task.created
  - task.output_ready
  - task.approved
  - agent.status_changed
  - morning_intelligence.ready
  - notification.*
```

---

## 8. Security Architecture

**GDPR Routing Invariant:**

Personal data (contact names, emails, identifiable info) ALWAYS routed to T1_FR (Mistral EU):
```typescript
const hasPersonalData = (context: string): boolean => {
  return /email|phone|address|name|ssn|birth/i.test(context)
}

function selectTier(skill, context, gdprRequired) {
  if (hasPersonalData(context) || gdprRequired) {
    return 'T1_FR'  // Non-negotiable
  }
  return selectBySkillTier(skill)
}
```

**Audit Trail (§26):**

Every action logged:
```sql
INSERT INTO audit_entries (company_id, user_id, action, payload)
VALUES ($1, $2, 'task_executed', {
  taskId: '...',
  agentId: '...',
  output: '...',
  approved: true,
  approvedBy: '...',
  timestamp: now()
})
```

**Vault (M4):**

Credentials encrypted with AES-256-GCM:
```typescript
const vault = new Vault(process.env.VAULT_ENCRYPTION_KEY)
const encrypted = vault.encrypt(apiKey)
await saveToDatabase(encrypted)
const decrypted = vault.decrypt(encrypted)  // Only when needed
```

---

## 9. Deployment

**Development (local):**
```bash
npm run dev           # Starts Express + React dev server
npm run db:migrate    # Runs pending migrations
npm run worker        # Starts BullMQ worker locally
```

**Staging/Production (Docker):**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

**Infrastructure:**
- Early stage (≤50 customers): Single Hetzner VPS (€35–100/mo)
  - Node.js + PostgreSQL + Redis on one box
  - Backups to S3-compatible storage
  
- Growth stage (50–500 customers): Scaleway Kubernetes
  - Separate PostgreSQL managed instance
  - Separate Redis cluster
  - Auto-scaling Node.js pods
  - CDN for static assets

---

## 10. Monitoring & Observability

**Logging:**
- All requests: `pino` structured logger
- LLM calls: logged with model, tokens, latency
- Errors: captured with stack trace + context
- Sensitive data (emails, API keys): redacted

**Metrics:**
- BullMQ queue depth (Bull Board at /admin/bull)
- PostgreSQL connection pool
- Redis memory usage
- LLM token spend (by tier, by company)
- Task execution latency (p50, p95, p99)
- Error rates by type

**Alerting:**
- Queue stuck (> 1000 pending tasks)
- PostgreSQL CPU > 80%
- Redis memory > 80%
- LLM API errors > 5% of requests
- Zero-tolerance action attempted (security alert)

---

## 11. Development Workflow

**Local setup:**
1. Clone repo
2. `npm install`
3. `cp .env.example .env` → fill in values
4. `brew services start postgresql@17 redis`
5. `npm run db:migrate`
6. `npm run dev` (runs both API + React)
7. Open `http://localhost:5173` (Vite)

**Adding a feature:**
1. Define schema changes in `src/db/schema.ts`
2. Create migration: `npm run db:migration:create <name>`
3. Implement API endpoint in `src/routes/`
4. Implement React component in `src/components/`
5. Add tests
6. Run: `npm run test`
7. Commit → GitHub Actions runs tests + linting

**Before committing:**
```bash
npm run lint       # TypeScript + ESLint
npm run test       # Jest
npm run typecheck  # tsc --noEmit
```

---

## 12. Performance Targets

| Operation | Target | Notes |
|---|---|---|
| Task execution | <2s | LLM call is I/O bound |
| Context assembly | <500ms | Org memory search + rank |
| API response | <200ms | Excluding LLM I/O |
| Morning intelligence generation | <30s for 10 companies | Parallel |
| Self-improvement batch | <5m for 100 tasks | Off-peak, parallel |
| CEO Console load | <1.5s | React + API calls |
| Search (org memory) | <300ms | pgvector similarity search |

---

This spec is current as of the Swwarm platform state documented in PLATFORM_FUNCTIONAL_SPEC_v8.md and CLAUDE_v3.md.

# Technical Implementation Specification
## Platform — Paperclip MIT + BullMQ EDA
**Version:** 2.0  
**Base:** `paperclipai/paperclip` (MIT licence) — forked, owned entirely  
**Intended consumer:** Claude Code — use this as the authoritative implementation brief  
**Stack:** Node.js TypeScript · Drizzle ORM · PostgreSQL + pgvector · React · BullMQ (Redis) · Graphile Worker (fallback) · Firecrawl · OpenRouter  

---

## Architecture overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (React)                               │
│  Dashboard · CEO Console · Task threads · Reports · Settings        │
└───────────────────────┬─────────────────────────────────────────────┘
                        │ HTTP / SSE / WebSocket
┌───────────────────────▼─────────────────────────────────────────────┐
│                     API LAYER (Express / Hono)                       │
│  Auth · Multi-tenant routing · Rate limiting · Zod validation        │
└───────────────────────┬─────────────────────────────────────────────┘
                        │
       ┌────────────────┼────────────────────┐
       ▼                ▼                    ▼
┌──────────────┐  ┌────────────┐  ┌─────────────────┐
│  Job Queue   │  │  Services  │  │  Tool Executor  │
│  (BullMQ)    │  │  Layer     │  │  (server-side)  │
│              │  │            │  │                 │
│ agent-queue  │  │ AgentSvc   │  │ MCP Router      │
│ email-queue  │  │ TaskSvc    │  │ Web Browser     │
│ webhook-queue│  │ MemorySvc  │  │ API Caller      │
│ skill-queue  │  │ CostSvc    │  │ Webhook Ingress  │
└──────┬───────┘  └─────┬──────┘  └────────┬────────┘
       │                │                   │
       └────────────────▼───────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────────────┐
│                    DATA LAYER                                         │
│  PostgreSQL (primary) · pgvector (embeddings) · Redis (BullMQ state)│
└─────────────────────────────────────────────────────────────────────┘
```

---

## Coding conventions (all modules)

- TypeScript strict mode throughout — no `any` unless explicitly noted
- Drizzle ORM for all DB access — match patterns in existing Paperclip repo
- Zod schemas for all API inputs and queue job payloads
- BullMQ for all async work — never `setInterval`, never naked `setTimeout` for business logic
- Server-Sent Events for Console streaming and real-time dashboard updates
- All API routes: `/api/v1/{module}/` prefix
- All migrations: new numbered file, never alter existing ones
- All services: unit-tested; all routes: integration-tested
- Company ID is injected from auth middleware on every request — never trust client-supplied companyId
- Every job handler must be idempotent (safe to run twice)
- Every external call (MCP, API, web) goes through the Tool Executor — never directly from LLM

---

## Module 0 — Multi-tenancy foundation

**Must be implemented first. Every other module depends on this.**

### Overview

Paperclip is single-tenant by design. This module adds company-level data isolation, authentication, and the middleware that injects `companyId` into every request context. Nothing else can be built safely until this is in place.

### Database migrations

```sql
-- Migration: 0001_multi_tenancy_foundation.sql

-- Companies table (root of all data isolation)
CREATE TABLE companies (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  slug                TEXT NOT NULL UNIQUE,
  plan                TEXT NOT NULL DEFAULT 'growth'
                        CHECK (plan IN ('solo','growth','pro','enterprise')),
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','suspended','churned')),
  tasks_used_month    INTEGER NOT NULL DEFAULT 0,
  tasks_limit_month   INTEGER NOT NULL DEFAULT 2000,
  tokens_used_month   BIGINT NOT NULL DEFAULT 0,
  tokens_limit_month  BIGINT NOT NULL DEFAULT 20000000,
  billing_period_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now()),
  stripe_customer_id  TEXT,
  stripe_sub_id       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Users table
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT,                    -- null if OAuth only
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Company membership (user <-> company, with role)
CREATE TABLE company_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'manager'
                CHECK (role IN ('owner','admin','manager','viewer')),
  invited_by  UUID REFERENCES users(id),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id)
);

-- Sessions / JWT refresh tokens
CREATE TABLE sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add company_id FK to ALL existing Paperclip tables
-- Run in same migration, after creating companies:
ALTER TABLE agents         ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE tasks          ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE goals          ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE projects       ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE audit_logs     ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Indexes for multi-tenant queries
CREATE INDEX idx_agents_company    ON agents(company_id);
CREATE INDEX idx_tasks_company     ON tasks(company_id, status, created_at DESC);
CREATE INDEX idx_goals_company     ON goals(company_id);
CREATE INDEX idx_members_company   ON company_members(company_id);
CREATE INDEX idx_members_user      ON company_members(user_id);

-- Row-level security (belt + suspenders on top of app-level isolation)
ALTER TABLE agents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals          ENABLE ROW LEVEL SECURITY;
```

### Auth middleware (`src/middleware/auth.ts`)

```typescript
export interface RequestContext {
  userId:    string
  companyId: string
  role:      'owner' | 'admin' | 'manager' | 'viewer'
  plan:      'solo' | 'growth' | 'pro' | 'enterprise'
}

// Validates JWT, resolves company membership, injects into req.ctx
// Returns 401 if invalid, 403 if company membership not found
export const authMiddleware = async (req, res, next) => { ... }

// Use on all /api/v1/* routes except /api/v1/auth/*
```

### Company switcher API

```typescript
// GET  /api/v1/auth/me              — current user + list of their companies
// POST /api/v1/auth/switch          — switch active company, returns new JWT
// POST /api/v1/auth/login           — email/password login
// POST /api/v1/auth/logout          — invalidate session
// GET  /api/v1/auth/google          — OAuth2 initiation
// GET  /api/v1/auth/google/callback — OAuth2 callback
```

---

## Module 1 — EDA: Event-Driven Agent Execution (BullMQ)

**Replaces Paperclip's polling heartbeat scheduler entirely.**

### Why this must be done before any other module

Every other module emits or consumes events. Building on top of the polling scheduler creates technical debt from day one — the scheduler's assumptions (periodic lock, single-node, no priority) leak into every service that touches it. Replace it first, build everything else on the clean foundation.

### Architecture

```
Event Producers                    Queue (Redis/BullMQ)           Workers
──────────────────                 ────────────────────           ──────────────
Scheduler (cron)         ──────►  agent:heartbeat queue  ──────► HeartbeatWorker
Gmail webhook            ──────►  agent:email-received   ──────► EmailWorker
Slack webhook            ──────►  agent:slack-event      ──────► SlackWorker
Task approved (UI)       ──────►  agent:task-approved    ──────► TaskApprovedWorker
Inbound webhook          ──────►  agent:webhook-received ──────► WebhookWorker
Self-improvement trigger ──────►  skill:improvement      ──────► SkillImprovWorker
Memory extraction        ──────►  memory:extract         ──────► MemoryWorker
```

### Installation

```bash
yarn add bullmq ioredis
yarn add -D @types/ioredis
```

### Redis connection (`src/queue/redis.ts`)

```typescript
import { Redis } from 'ioredis'

export const redisConnection = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,   // required by BullMQ
  enableReadyCheck: false,
  tls: process.env.REDIS_URL?.startsWith('rediss://') ? {} : undefined,
})

// Separate connection for blocking operations (BullMQ requirement)
export const redisConnectionBlocking = redisConnection.duplicate()
```

### Job type registry (`src/queue/jobs.ts`)

```typescript
import { z } from 'zod'

// ── Agent execution jobs ──────────────────────────────────────────
export const HeartbeatJobSchema = z.object({
  agentId:   z.string().uuid(),
  companyId: z.string().uuid(),
  triggeredBy: z.enum(['scheduler','email','slack','webhook','approval','manual']),
})

export const EmailReceivedJobSchema = z.object({
  agentId:   z.string().uuid(),
  companyId: z.string().uuid(),
  emailId:   z.string(),
  threadId:  z.string(),
  from:      z.string(),
  subject:   z.string(),
  bodyPreview: z.string().max(500),
})

export const TaskApprovedJobSchema = z.object({
  taskId:    z.string().uuid(),
  agentId:   z.string().uuid(),
  companyId: z.string().uuid(),
  approvedBy: z.string().uuid(),
})

export const WebhookReceivedJobSchema = z.object({
  agentId:   z.string().uuid(),
  companyId: z.string().uuid(),
  source:    z.string(),           // 'indeed' | 'calendly' | 'custom' | etc.
  payload:   z.record(z.unknown()),
  receivedAt: z.string().datetime(),
})

// ── Background processing jobs ────────────────────────────────────
export const MemoryExtractionJobSchema = z.object({
  taskId:    z.string().uuid(),
  agentId:   z.string().uuid(),
  companyId: z.string().uuid(),
  output:    z.string(),
})

export const SkillImprovementJobSchema = z.object({
  agentId:   z.string().uuid(),
  companyId: z.string().uuid(),
  skillSlug: z.string(),
  triggerReason: z.enum(['quality_degradation','human_request','scheduled_review']),
})

export const CostResetJobSchema = z.object({
  companyId: z.string().uuid(),
})

export type HeartbeatJob       = z.infer<typeof HeartbeatJobSchema>
export type EmailReceivedJob   = z.infer<typeof EmailReceivedJobSchema>
export type TaskApprovedJob    = z.infer<typeof TaskApprovedJobSchema>
export type WebhookReceivedJob = z.infer<typeof WebhookReceivedJobSchema>
export type MemoryExtractionJob = z.infer<typeof MemoryExtractionJobSchema>
export type SkillImprovementJob = z.infer<typeof SkillImprovementJobSchema>
```

### Queue definitions (`src/queue/queues.ts`)

```typescript
import { Queue } from 'bullmq'
import { redisConnection } from './redis'

const defaultOpts = { connection: redisConnection }

// Agent execution queue — highest priority, most time-sensitive
export const agentQueue = new Queue('agents', {
  ...defaultOpts,
  defaultJobOptions: {
    removeOnComplete: { age: 86400, count: 1000 },  // keep 24h
    removeOnFail:     { age: 604800 },               // keep failed 7 days
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  },
})

// Background processing — lower priority
export const backgroundQueue = new Queue('background', {
  ...defaultOpts,
  defaultJobOptions: {
    removeOnComplete: { age: 3600 },
    removeOnFail:     { age: 604800 },
    attempts: 5,
    backoff: { type: 'exponential', delay: 10000 },
  },
})

// System jobs — billing reset, maintenance
export const systemQueue = new Queue('system', {
  ...defaultOpts,
  defaultJobOptions: {
    removeOnComplete: { age: 86400 },
    removeOnFail:     { age: 604800 },
    attempts: 3,
  },
})
```

### Event emitter — type-safe public API (`src/queue/emit.ts`)

All code outside the queue module uses only this API. Never import Queue directly.

```typescript
import { agentQueue, backgroundQueue, systemQueue } from './queues'
import type { HeartbeatJob, EmailReceivedJob, TaskApprovedJob,
              WebhookReceivedJob, MemoryExtractionJob, SkillImprovementJob } from './jobs'

export const emit = {
  // ── Agent triggers ──────────────────────────────────────────────

  heartbeat: async (data: HeartbeatJob, delayMs = 0) =>
    agentQueue.add('heartbeat', data, {
      delay: delayMs,
      // Deduplication: only one pending heartbeat per agent at a time
      jobId: `heartbeat:${data.agentId}`,
      // If a heartbeat is already pending, replace it (in case frequency changed)
    }),

  emailReceived: async (data: EmailReceivedJob) =>
    agentQueue.add('email.received', data, {
      priority: 10,    // higher priority than scheduled heartbeats
      jobId: `email:${data.emailId}`,  // deduplicate if webhook fires twice
    }),

  taskApproved: async (data: TaskApprovedJob) =>
    agentQueue.add('task.approved', data, {
      priority: 10,
      jobId: `approval:${data.taskId}`,
    }),

  webhookReceived: async (data: WebhookReceivedJob) =>
    agentQueue.add('webhook.received', data, {
      priority: 5,
    }),

  slackEvent: async (data: { agentId: string; companyId: string; event: unknown }) =>
    agentQueue.add('slack.event', data, { priority: 8 }),

  // ── Background jobs ─────────────────────────────────────────────

  extractMemory: async (data: MemoryExtractionJob) =>
    backgroundQueue.add('memory.extract', data),

  improveSkill: async (data: SkillImprovementJob) =>
    backgroundQueue.add('skill.improve', data, {
      // One active improvement job per skill at a time
      jobId: `skill-improve:${data.agentId}:${data.skillSlug}`,
    }),

  // ── System jobs ─────────────────────────────────────────────────

  scheduleMonthlyReset: async (companyId: string) =>
    systemQueue.add('cost.reset', { companyId }, {
      repeat: { cron: '0 0 1 * *' },    // 1st of every month at midnight
      jobId: `cost-reset:${companyId}`,
    }),
}
```

### Workers (`src/workers/`)

**Heartbeat worker — replaces Paperclip's polling loop:**

```typescript
// src/workers/heartbeat.worker.ts
import { Worker, Job } from 'bullmq'
import { redisConnectionBlocking } from '../queue/redis'
import { emit } from '../queue/emit'
import { executeAgentHeartbeat } from '../agents/execution'
import { db } from '../db'
import { agents } from '../db/schema'
import { eq, and } from 'drizzle-orm'

export const heartbeatWorker = new Worker(
  'agents',
  async (job: Job) => {
    if (job.name !== 'heartbeat') return  // handled by this worker only

    const { agentId, companyId } = job.data as HeartbeatJob

    // Idempotency check — prevents double-execution if job runs twice
    const agent = await db.query.agents.findFirst({
      where: and(eq(agents.id, agentId), eq(agents.companyId, companyId)),
    })

    if (!agent) return  // agent deleted — safe exit
    if (agent.status === 'paused') {
      // Don't reschedule — emit.heartbeat will be called when unpaused
      return
    }

    // Execute the heartbeat (core agent logic — unchanged from Paperclip)
    await executeAgentHeartbeat(agent)

    // Schedule the next heartbeat based on agent's configured frequency
    await emit.heartbeat(
      { agentId, companyId, triggeredBy: 'scheduler' },
      agent.heartbeatFrequencyMs,
    )
  },
  {
    connection: redisConnectionBlocking,
    concurrency: 20,
    // Process heartbeats before email/webhook events (lower priority number = lower priority)
    // BullMQ processes higher priority numbers first
  },
)

heartbeatWorker.on('failed', (job, err) => {
  console.error(`Heartbeat failed for agent ${job?.data?.agentId}:`, err)
  // Dead letter: BullMQ keeps failed jobs for 7 days — monitor via Bull Board
})
```

**Email received worker:**

```typescript
// src/workers/emailReceived.worker.ts
export const emailWorker = new Worker('agents', async (job: Job) => {
  if (job.name !== 'email.received') return

  const { agentId, companyId, emailId } = job.data as EmailReceivedJob

  // Fetch the full email from Gmail (via Integration Hub)
  const fullEmail = await integrationHub.gmail.fetchEmail(companyId, emailId)

  // Create a reactive task for the agent
  const task = await taskService.createReactiveTask({
    agentId,
    companyId,
    type:    'email.received',
    title:   `Reply to: ${fullEmail.subject}`,
    context: { emailId, threadId: fullEmail.threadId, from: fullEmail.from, body: fullEmail.body },
    priority: 'high',
  })

  // Trigger immediate heartbeat so agent picks it up now, not at next cycle
  await emit.heartbeat({ agentId, companyId, triggeredBy: 'email' }, 0)
}, { connection: redisConnectionBlocking, concurrency: 10 })
```

**Task approved worker:**

```typescript
// src/workers/taskApproved.worker.ts
export const taskApprovedWorker = new Worker('agents', async (job: Job) => {
  if (job.name !== 'task.approved') return

  const { taskId, agentId, companyId, approvedBy } = job.data as TaskApprovedJob

  // Update task status
  await taskService.markApproved(taskId, approvedBy)

  // Agent executes the approved action immediately — not at next heartbeat
  await emit.heartbeat({ agentId, companyId, triggeredBy: 'approval' }, 0)
}, { connection: redisConnectionBlocking, concurrency: 10 })
```

### Worker registry (`src/workers/index.ts`)

```typescript
// Start all workers when the server starts
// Import order doesn't matter — BullMQ handles routing by job name
export { heartbeatWorker }     from './heartbeat.worker'
export { emailWorker }         from './emailReceived.worker'
export { taskApprovedWorker }  from './taskApproved.worker'
export { webhookWorker }       from './webhook.worker'
export { memoryWorker }        from './memoryExtraction.worker'
export { skillImprovWorker }   from './skillImprovement.worker'
```

### Scheduler bootstrap (`src/queue/scheduler.ts`)

Replaces Paperclip's `setInterval` polling loop entirely.

```typescript
// Called once on server start
export async function bootstrapScheduler() {
  // 1. Schedule monthly cost resets for all active companies
  const companies = await db.query.companies.findMany({
    where: eq(companies.status, 'active'),
  })

  for (const company of companies) {
    await emit.scheduleMonthlyReset(company.id)
  }

  // 2. Seed heartbeat jobs for all active agents that don't already have one pending
  const activeAgents = await db.query.agents.findMany({
    where: eq(agents.status, 'active'),
  })

  for (const agent of activeAgents) {
    // Check if a heartbeat job already exists (jobId deduplication)
    const existing = await agentQueue.getJob(`heartbeat:${agent.id}`)
    if (!existing) {
      await emit.heartbeat(
        { agentId: agent.id, companyId: agent.companyId, triggeredBy: 'scheduler' },
        0,  // run immediately on startup
      )
    }
  }

  console.log(`Scheduler bootstrapped: ${activeAgents.length} agents seeded`)
}
```

### Bull Board (monitoring UI)

```typescript
// src/routes/monitoring.ts — internal only, not exposed to customers
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter }   from '@bull-board/api/bullMQAdapter'
import { ExpressAdapter }  from '@bull-board/express'
import { agentQueue, backgroundQueue, systemQueue } from '../queue/queues'

const serverAdapter = new ExpressAdapter()
serverAdapter.setBasePath('/internal/queues')

createBullBoard({
  queues: [
    new BullMQAdapter(agentQueue),
    new BullMQAdapter(backgroundQueue),
    new BullMQAdapter(systemQueue),
  ],
  serverAdapter,
})

// Mount at /internal/queues — protected by internal auth token, never exposed publicly
app.use('/internal/queues', internalAuthMiddleware, serverAdapter.getRouter())
```

---

## Module 2 — Context Assembly Pipeline

**The most important module for output quality. Every agent heartbeat depends on this.**

### Overview

At every heartbeat, the platform assembles a complete, tiered context for the agent before calling the LLM. The quality of this assembly directly determines the quality of every agent output.

### Context assembly service (`src/context/assembler.ts`)

```typescript
export interface AssembledContext {
  systemIdentity:   string    // Layer 1
  companyDna:       string    // Layer 2
  currentTask:      string    // Layer 3
  orgMemory:        string    // Layer 4
  recentOutputs:    string    // Layer 5
  skillInstructions: string   // Layer 6
  totalTokens:      number
  memoryChunksUsed: number
  compressionApplied: boolean
}

// Token budgets by tier
const TOKEN_BUDGETS = {
  T0: { identity: 200, dna: 300,   task: 500,    memory: 500,   outputs: 200, skill: 500  },
  T1: { identity: 300, dna: 600,   task: 2000,   memory: 2000,  outputs: 600, skill: 1500 },
  T2: { identity: 300, dna: 1200,  task: 5000,   memory: 8000,  outputs: 2000, skill: 3000 },
  T3: { identity: 300, dna: 2000,  task: 10000,  memory: 20000, outputs: 5000, skill: 5000 },
} as const

export async function assembleContext(params: {
  agent:    Agent
  task:     Task
  company:  Company
  skill:    ParsedSkill
  tier:     'T0' | 'T1' | 'T2' | 'T3'
}): Promise<AssembledContext> {
  const { agent, task, company, skill, tier } = params
  const budget = TOKEN_BUDGETS[tier]

  // LAYER 1 — System identity (never truncated)
  const systemIdentity = buildSystemIdentity(agent, company, skill)

  // LAYER 2 — Company DNA (compressed for T1)
  const companyDna = tier === 'T0' || tier === 'T1'
    ? await getDnaCompressed(company.id, budget.dna)
    : await getDnaFull(company.id)

  // LAYER 3 — Current task (never truncated — always injected in full)
  const currentTask = buildTaskContext(task, budget.task)

  // LAYER 4 — Org memory (semantic retrieval)
  const { text: orgMemory, chunksUsed } = await retrieveMemory({
    companyId: company.id,
    query:     `${task.title} ${task.description}`,
    maxChunks: tier === 'T1' ? 5 : 10,
    maxTokens: budget.memory,
  })

  // LAYER 5 — Recent agent outputs (last 3 completed tasks)
  const recentOutputs = await getRecentOutputs(agent.id, 3, budget.outputs)

  // LAYER 6 — Skill instructions (with variable interpolation)
  const skillInstructions = interpolateSkill(skill.body, {
    company_name:    company.name,
    company_sector:  company.sector,
    agent_name:      agent.name,
    // ... all DNA variables
  })

  // Total token check — apply compression if over budget
  const total = estimateTokens([systemIdentity, companyDna, currentTask,
                                 orgMemory, recentOutputs, skillInstructions])

  let compressionApplied = false
  if (total > budget.identity + budget.dna + budget.task + budget.memory + budget.outputs + budget.skill) {
    // Compression order: outputs → memory chunks → dna → never touch task
    compressionApplied = true
    // ... compression logic (truncate outputs to 200 tokens each, reduce memory to 5 chunks)
  }

  return {
    systemIdentity, companyDna, currentTask, orgMemory,
    recentOutputs, skillInstructions,
    totalTokens: total,
    memoryChunksUsed: chunksUsed,
    compressionApplied,
  }
}
```

### Company DNA service (`src/context/dna.ts`)

```typescript
// Database schema for Company DNA
// Migration: 0002_company_dna.sql

CREATE TABLE company_dna (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  description         TEXT NOT NULL DEFAULT '',
  customer_profile    TEXT NOT NULL DEFAULT '',
  tone                TEXT NOT NULL DEFAULT 'professional',
  brand_rules         TEXT NOT NULL DEFAULT '',
  regulatory_context  TEXT NOT NULL DEFAULT '',
  forbidden_topics    TEXT[] NOT NULL DEFAULT '{}',
  terminology         JSONB NOT NULL DEFAULT '{}',  -- { "term": "definition" }
  competitors         TEXT[] NOT NULL DEFAULT '{}',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by          UUID REFERENCES users(id)
);

// Short version (T1 context, ~300 tokens)
export async function getDnaCompressed(companyId: string): Promise<string> {
  const dna = await db.query.companyDna.findFirst({ where: eq(companyDna.companyId, companyId) })
  return `Company: ${dna.description}\nCustomers: ${dna.customerProfile}\nTone: ${dna.tone}\nNever write about: ${dna.forbiddenTopics.join(', ')}`
}

// Full version (T2+ context, ~2000 tokens)
export async function getDnaFull(companyId: string): Promise<string> {
  // Returns all fields as structured markdown
}
```

### Memory retrieval (`src/context/memory.ts`)

```typescript
export async function retrieveMemory(params: {
  companyId: string
  query:     string
  maxChunks: number
  maxTokens: number
}): Promise<{ text: string; chunksUsed: number }> {
  const { companyId, query, maxChunks, maxTokens } = params

  // 1. Embed the query
  const queryEmbedding = await embedText(query)

  // 2. Semantic search (pgvector cosine similarity)
  const chunks = await db.execute(sql`
    SELECT id, title, content, importance, created_at,
           1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) AS similarity
    FROM memory_entries
    WHERE company_id = ${companyId}
      AND archived = false
      AND (1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector)) > 0.72
    ORDER BY
      -- Weighted score: relevance × importance × recency
      ((1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector)) * 0.6)
      + (importance::float / 5 * 0.3)
      + (EXTRACT(EPOCH FROM (now() - created_at)) / -2592000 * 0.1)  -- recency decay (30d)
    LIMIT ${maxChunks}
  `)

  // 3. Build context text, respect token budget
  let text = ''
  let chunksUsed = 0
  for (const chunk of chunks) {
    const chunkText = `[Memory] ${chunk.title}: ${chunk.content}\n`
    if (estimateTokens(text + chunkText) > maxTokens) break
    text += chunkText
    chunksUsed++
  }

  // 4. Log access (for memory importance tuning)
  for (const chunk of chunks.slice(0, chunksUsed)) {
    await db.insert(memoryAccessLog).values({ memoryId: chunk.id })
  }

  return { text, chunksUsed }
}
```

---

## Module 3 — LLM Router (T0→T3 with GDPR enforcement)

### Overview

Every agent execution routes to the appropriate LLM based on the skill's declared tier and GDPR sensitivity. The router is the single gatekeeper — no LLM is called outside of it.

### Skill frontmatter schema

Every SKILL.md file must begin with a YAML frontmatter block:

```yaml
---
name: qualification-cv
tier: 1
gdpr_required: true        # Forces Mistral EU regardless of language
web_access: false
autonomy_tier: A           # A = supervised improvement | B = autonomous
tools:
  - mcp: gmail
    permissions: [read, compose]
  - mcp: notion
    permissions: [read, write]
description: Qualifies incoming CVs against the active job posting criteria
---

# Qualification CV

You are the sourcing specialist at {company_name}...
```

### Skill parser (`src/skills/parser.ts`)

```typescript
import matter from 'gray-matter'

export interface ParsedSkill {
  name:          string
  tier:          0 | 1 | 2 | 3
  gdprRequired:  boolean
  webAccess:     boolean
  webScope:      'open' | 'restricted'
  autonomyTier:  'A' | 'B'
  tools:         ToolDeclaration[]
  description:   string
  body:          string   // The markdown content below the frontmatter
}

export function parseSkill(raw: string): ParsedSkill {
  const { data, content } = matter(raw)
  return {
    name:         data.name,
    tier:         data.tier ?? 1,
    gdprRequired: data.gdpr_required ?? false,
    webAccess:    data.web_access ?? false,
    webScope:     data.web_scope ?? 'open',
    autonomyTier: data.autonomy_tier ?? 'A',
    tools:        data.tools ?? [],
    description:  data.description ?? '',
    body:         content.trim(),
  }
}
```

### Model router (`src/llm/router.ts`)

```typescript
export interface RoutingDecision {
  model:    string
  provider: 'openrouter'
  endpoint: string
  maxInputTokens:  number
  maxOutputTokens: number
  estimatedCostEur: number
}

const MODEL_MAP = {
  T0: {
    default: 'mistralai/ministral-3b',
    fallback: 'google/gemma-3-1b',
  },
  T1_FR_GDPR: {
    default: 'mistralai/mistral-small-3.2',
    fallback: 'mistralai/mistral-small-3.2',  // no fallback outside EU for GDPR
  },
  T1_EN: {
    default: 'deepseek/deepseek-chat-v3-5',
    fallback: 'mistralai/mistral-small-3.2',  // fallback to EU if DeepSeek down
  },
  T2_SPEED: {
    default: 'google/gemini-flash-1.5',
    fallback: 'mistralai/mistral-medium-3.1',
  },
  T2_QUALITY_GDPR: {
    default: 'mistralai/mistral-medium-3.1',
    fallback: null,  // no fallback — queue and retry
  },
  T3: {
    default: 'anthropic/claude-sonnet-4-5',
    fallback: null,  // no fallback for T3 — queue and retry with backoff
  },
} as const

export function routeModel(skill: ParsedSkill, language: 'fr' | 'en' | 'auto' = 'auto'): RoutingDecision {
  const { tier, gdprRequired } = skill

  // ABSOLUTE GDPR RULE: personal data never goes outside EU
  if (gdprRequired) {
    if (tier <= 1) return buildDecision(MODEL_MAP.T1_FR_GDPR.default)
    if (tier === 2) return buildDecision(MODEL_MAP.T2_QUALITY_GDPR.default)
    return buildDecision(MODEL_MAP.T3.default)  // T3 = Claude (Anthropic = US but contractually EU-compliant)
  }

  switch (tier) {
    case 0: return buildDecision(MODEL_MAP.T0.default)
    case 1: return language === 'fr'
              ? buildDecision(MODEL_MAP.T1_FR_GDPR.default)
              : buildDecision(MODEL_MAP.T1_EN.default)
    case 2: return buildDecision(MODEL_MAP.T2_SPEED.default)
    case 3: return buildDecision(MODEL_MAP.T3.default)
    default: return buildDecision(MODEL_MAP.T1_EN.default)
  }
}
```

### OpenRouter caller (`src/llm/openrouter.ts`)

```typescript
export async function callLLM(params: {
  model:    string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  tools?:   OpenAITool[]
  maxOutputTokens: number
  companyId: string
  agentId:   string
  taskId:    string
}): Promise<LLMResponse> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type':  'application/json',
      'HTTP-Referer':  process.env.APP_URL!,
      'X-Title':       'Singular Platform',
    },
    body: JSON.stringify({
      model:       params.model,
      messages:    params.messages,
      tools:       params.tools,
      max_tokens:  params.maxOutputTokens,
      temperature: 0.3,
    }),
  })

  if (!response.ok) {
    const err = await response.json()
    throw new LLMError(`OpenRouter error: ${err.error?.message}`, response.status)
  }

  const data = await response.json()

  // Track token usage for cost accounting
  await costService.recordUsage({
    companyId: params.companyId,
    agentId:   params.agentId,
    taskId:    params.taskId,
    model:     params.model,
    inputTokens:  data.usage.prompt_tokens,
    outputTokens: data.usage.completion_tokens,
  })

  return data
}
```

---

## Module 4 — Integration Hub (MCP + API + Webhooks)

### Database migrations

```sql
-- Migration: 0003_integration_hub.sql

CREATE TABLE integrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,   -- 'gmail' | 'slack' | 'notion' | 'linkedin' | 'custom_api' | 'webhook'
  name            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'connected'
                    CHECK (status IN ('connected','disconnected','error','pending')),
  -- Encrypted credentials (AES-256-GCM, key per company stored in env/KMS)
  credentials_enc BYTEA NOT NULL,
  credentials_iv  BYTEA NOT NULL,
  credentials_tag BYTEA NOT NULL,
  -- OAuth token management
  oauth_access_token_enc  BYTEA,
  oauth_refresh_token_enc BYTEA,
  oauth_expires_at        TIMESTAMPTZ,
  -- Metadata
  scopes          TEXT[] NOT NULL DEFAULT '{}',
  webhook_secret  TEXT,              -- for inbound webhooks
  config          JSONB NOT NULL DEFAULT '{}',   -- type-specific config
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, type)
);

CREATE TABLE agent_integration_permissions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id       UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  permissions    TEXT[] NOT NULL DEFAULT '{}',  -- ['read','compose','send','post'...]
  granted_by     UUID REFERENCES users(id),
  granted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, integration_id)
);

CREATE TABLE webhook_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_id    UUID REFERENCES agents(id),
  source      TEXT NOT NULL,
  payload     JSONB NOT NULL,
  status      TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued','processing','processed','failed')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE TABLE tool_call_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_id    UUID REFERENCES agents(id),
  task_id     UUID,
  tool_type   TEXT NOT NULL,   -- 'mcp' | 'api' | 'web_browse'
  tool_name   TEXT NOT NULL,
  input       JSONB NOT NULL,
  output      JSONB,
  status      TEXT NOT NULL,
  duration_ms INTEGER,
  error       TEXT,
  called_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Credential vault (`src/integrations/vault.ts`)

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

// Company vault key: derived from master key + company_id using HKDF
// Master key stored in environment variable / KMS — never in database
function getCompanyKey(companyId: string): Buffer {
  const master = Buffer.from(process.env.VAULT_MASTER_KEY!, 'hex')
  // HKDF expand: deterministic per company, non-reversible without master
  return hkdf(master, companyId, 32)
}

export function encryptCredential(companyId: string, plaintext: string): {
  enc: Buffer; iv: Buffer; tag: Buffer
} {
  const key = getCompanyKey(companyId)
  const iv  = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return { enc, iv, tag: cipher.getAuthTag() }
}

export function decryptCredential(companyId: string, enc: Buffer, iv: Buffer, tag: Buffer): string {
  const key = getCompanyKey(companyId)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(enc) + decipher.final('utf8')
}
```

### MCP Router (`src/integrations/mcp.ts`)

```typescript
export class MCPRouter {
  // Execute an MCP tool call on behalf of an agent
  async callTool(params: {
    agentId:       string
    companyId:     string
    taskId:        string
    server:        string      // 'gmail' | 'slack' | 'notion' | etc.
    tool:          string      // MCP tool name
    args:          Record<string, unknown>
    requiredPerm:  string      // permission level required
  }): Promise<unknown> {
    // 1. Check agent has permission for this integration
    const perm = await this.checkPermission(params.agentId, params.server, params.requiredPerm)
    if (!perm) throw new ForbiddenError(`Agent lacks ${params.requiredPerm} on ${params.server}`)

    // 2. Fetch and decrypt credentials from vault
    const integration = await this.getIntegration(params.companyId, params.server)
    const accessToken = decryptCredential(
      params.companyId, integration.oauthAccessTokenEnc,
      integration.oauthIv, integration.oauthTag
    )

    // 3. Check if token needs refresh
    if (integration.oauthExpiresAt && integration.oauthExpiresAt < new Date()) {
      await this.refreshToken(params.companyId, params.server)
    }

    // 4. Execute via MCP client (server-side — LLM never sees the token)
    const startTime = Date.now()
    let result: unknown
    let error: string | undefined

    try {
      result = await this.executeMCPCall(params.server, params.tool, params.args, accessToken)
    } catch (err) {
      error = String(err)
      throw err
    } finally {
      // 5. Log every tool call to audit trail (AI Act requirement)
      await db.insert(toolCallLog).values({
        companyId:  params.companyId,
        agentId:    params.agentId,
        taskId:     params.taskId,
        toolType:   'mcp',
        toolName:   `${params.server}/${params.tool}`,
        input:      params.args,
        output:     result,
        status:     error ? 'failed' : 'success',
        durationMs: Date.now() - startTime,
        error,
      })
    }

    return result
  }
}

export const mcpRouter = new MCPRouter()
```

### Inbound webhook handler (`src/routes/webhooks.ts`)

```typescript
// POST /webhooks/:companyId/:agentSlug
// Receives events from: Indeed, Calendly, Slack, custom systems
router.post('/webhooks/:companyId/:agentSlug', async (req, res) => {
  // Acknowledge immediately (most webhook providers require <5s response)
  res.status(200).json({ received: true })

  const { companyId, agentSlug } = req.params

  // Validate HMAC signature from webhook secret
  const integration = await findIntegrationByWebhook(companyId)
  if (!verifyWebhookSignature(req, integration.webhookSecret)) {
    console.warn(`Invalid webhook signature for company ${companyId}`)
    return
  }

  // Store the event
  const [event] = await db.insert(webhookEvents).values({
    companyId,
    source:  detectSource(req.headers),
    payload: req.body,
    status:  'queued',
  }).returning()

  // Find the agent and emit event
  const agent = await findAgentBySlug(companyId, agentSlug)
  if (agent) {
    await emit.webhookReceived({
      agentId:    agent.id,
      companyId,
      source:     event.source,
      payload:    req.body,
      receivedAt: new Date().toISOString(),
    })
  }
})
```

---

## Module 5 — Web Browsing Tool

### Architecture

```
Agent context includes: web_access: true (from skill frontmatter)
        ↓
Agent produces tool call: { tool: 'web_browse', url: '...', intent: 'extract job postings' }
        ↓
Tool Executor intercepts (never sent to LLM provider)
        ↓
Firecrawl API call (server-side, EU-routed where possible)
        ↓
Clean Markdown returned to agent context
        ↓
Tool call logged to audit trail
```

### Tool executor (`src/tools/webBrowse.ts`)

```typescript
import FirecrawlApp from '@mendable/firecrawl-js'

const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! })

export interface WebBrowseInput {
  url:     string
  intent?: string           // Natural language description of what to extract
  mode:    'scrape' | 'crawl' | 'extract'
  maxPages?: number         // For crawl mode
  schema?:  Record<string, unknown>  // For structured extraction
}

export interface WebBrowseOutput {
  url:      string
  title:    string
  content:  string     // Clean markdown
  metadata: {
    date?:   string
    author?: string
    canonical?: string
  }
  tokensEstimate: number
}

export async function webBrowse(
  input: WebBrowseInput,
  context: { companyId: string; agentId: string; taskId: string; skill: ParsedSkill }
): Promise<WebBrowseOutput> {
  // 1. Check agent has web_access permission
  if (!context.skill.webAccess) {
    throw new ForbiddenError('This skill does not have web browsing access')
  }

  // 2. Domain whitelist check (if scope is restricted)
  if (context.skill.webScope === 'restricted') {
    const allowed = await getAgentWebWhitelist(context.agentId)
    const domain = new URL(input.url).hostname
    if (!allowed.includes(domain)) {
      throw new ForbiddenError(`Domain ${domain} not in this agent's web whitelist`)
    }
  }

  const startTime = Date.now()
  let result: WebBrowseOutput
  let error: string | undefined

  try {
    if (input.mode === 'scrape') {
      const scraped = await firecrawl.scrapeUrl(input.url, {
        formats: ['markdown'],
        onlyMainContent: true,
      })
      result = {
        url:     input.url,
        title:   scraped.metadata?.title ?? '',
        content: scraped.markdown ?? '',
        metadata: {
          date:      scraped.metadata?.publishedTime,
          author:    scraped.metadata?.author,
          canonical: scraped.metadata?.sourceURL,
        },
        tokensEstimate: estimateTokens(scraped.markdown ?? ''),
      }
    } else if (input.mode === 'extract' && input.schema) {
      const extracted = await firecrawl.extract([input.url], {
        prompt: input.intent,
        schema: input.schema,
      })
      result = {
        url:     input.url,
        title:   '',
        content: JSON.stringify(extracted.data, null, 2),
        metadata: {},
        tokensEstimate: estimateTokens(JSON.stringify(extracted.data)),
      }
    } else {
      throw new Error(`Unknown browse mode: ${input.mode}`)
    }

    // GDPR flag: if content may contain personal data, flag for review
    if (context.skill.gdprRequired) {
      await flagForGDPRReview(context.companyId, input.url, result.content)
    }

  } catch (err) {
    error = String(err)
    // Fallback to Jina Reader
    result = await jinaFallback(input.url)
  } finally {
    // Log every URL fetch (AI Act audit requirement)
    await db.insert(toolCallLog).values({
      companyId:  context.companyId,
      agentId:    context.agentId,
      taskId:     context.taskId,
      toolType:   'web_browse',
      toolName:   'firecrawl',
      input:      { url: input.url, mode: input.mode },
      output:     { title: result?.title, tokensEstimate: result?.tokensEstimate },
      status:     error ? 'failed' : 'success',
      durationMs: Date.now() - startTime,
      error,
    })
  }

  return result!
}

// Jina Reader fallback
async function jinaFallback(url: string): Promise<WebBrowseOutput> {
  const response = await fetch(`https://r.jina.ai/${url}`, {
    headers: { 'Accept': 'text/markdown' }
  })
  const markdown = await response.text()
  return {
    url, title: '', content: markdown, metadata: {},
    tokensEstimate: estimateTokens(markdown),
  }
}
```

---

## Module 6 — Quality Gates & Audit Trail

### Database migrations

```sql
-- Migration: 0004_quality_gates.sql

CREATE TABLE quality_gates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_id    UUID REFERENCES agents(id) ON DELETE CASCADE,  -- null = applies to all agents
  gate_type   TEXT NOT NULL CHECK (gate_type IN (
                'volume_limit','recipient_whitelist','budget_limit',
                'content_forbidden','custom'
              )),
  config      JSONB NOT NULL,  -- type-specific config
  enabled     BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE gate_violations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  gate_id     UUID NOT NULL REFERENCES quality_gates(id),
  agent_id    UUID REFERENCES agents(id),
  task_id     UUID,
  action_type TEXT NOT NULL,
  action_data JSONB NOT NULL,
  violation   TEXT NOT NULL,
  resolution  TEXT CHECK (resolution IN ('blocked','escalated','overridden')),
  resolved_by UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_id    UUID REFERENCES agents(id),
  user_id     UUID REFERENCES users(id),
  task_id     UUID,
  action_type TEXT NOT NULL,
  action_data JSONB NOT NULL,
  result      TEXT NOT NULL CHECK (result IN ('success','blocked','escalated','approved','rejected')),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Immutable audit log: no updates, no deletes
CREATE RULE audit_no_update AS ON UPDATE TO audit_entries DO INSTEAD NOTHING;
CREATE RULE audit_no_delete AS ON DELETE TO audit_entries DO INSTEAD NOTHING;

CREATE INDEX idx_audit_company ON audit_entries(company_id, created_at DESC);
CREATE INDEX idx_violations_company ON gate_violations(company_id, created_at DESC);
```

### Gate engine (`src/gates/engine.ts`)

```typescript
export type GateResult =
  | { passed: true }
  | { passed: false; reason: string; action: 'block' | 'escalate' }

export async function runGates(params: {
  companyId:  string
  agentId:    string
  taskId:     string
  actionType: 'send_email' | 'publish_content' | 'contact_external' | 'api_call'
  actionData: Record<string, unknown>
}): Promise<GateResult> {
  const gates = await getActiveGates(params.companyId, params.agentId)

  for (const gate of gates) {
    const result = await checkGate(gate, params.actionData)
    if (!result.passed) {
      // Log violation
      await db.insert(gateViolations).values({
        companyId:  params.companyId,
        gateId:     gate.id,
        agentId:    params.agentId,
        taskId:     params.taskId,
        actionType: params.actionType,
        actionData: params.actionData,
        violation:  result.reason,
        resolution: result.action === 'block' ? 'blocked' : 'escalated',
      })

      // Write to audit trail
      await db.insert(auditEntries).values({
        companyId:  params.companyId,
        agentId:    params.agentId,
        taskId:     params.taskId,
        actionType: params.actionType,
        actionData: params.actionData,
        result:     result.action === 'block' ? 'blocked' : 'escalated',
      })

      // If escalate: create approval request and notify operator via SSE
      if (result.action === 'escalate') {
        await createApprovalRequest({
          companyId:   params.companyId,
          agentId:     params.agentId,
          taskId:      params.taskId,
          type:        params.actionType,
          data:        params.actionData,
          reason:      result.reason,
        })
        await notifyOperatorSSE(params.companyId, 'approval_required', params.taskId)
      }

      return result
    }
  }

  // All gates passed — log success
  await db.insert(auditEntries).values({
    companyId:  params.companyId,
    agentId:    params.agentId,
    taskId:     params.taskId,
    actionType: params.actionType,
    actionData: params.actionData,
    result:     'success',
  })

  return { passed: true }
}

// Built-in gate checkers
async function checkGate(gate: QualityGate, data: Record<string, unknown>): Promise<GateResult> {
  switch (gate.gateType) {
    case 'volume_limit': {
      const { maxPerDay } = gate.config as { maxPerDay: number }
      const todayCount = await getAgentActionCount(gate.agentId!, 'send_email', 'today')
      if (todayCount >= maxPerDay) {
        return { passed: false, reason: `Daily limit of ${maxPerDay} emails reached`, action: 'block' }
      }
      return { passed: true }
    }
    case 'budget_limit': {
      const agent = await getAgent(gate.agentId!)
      if (agent.budgetUsedMonth >= agent.budgetLimitMonth) {
        return { passed: false, reason: 'Monthly budget exhausted', action: 'escalate' }
      }
      return { passed: true }
    }
    case 'content_forbidden': {
      const { terms } = gate.config as { terms: string[] }
      const content = String(data.content ?? '')
      const found = terms.find(t => content.toLowerCase().includes(t.toLowerCase()))
      if (found) {
        return { passed: false, reason: `Forbidden term detected: "${found}"`, action: 'escalate' }
      }
      return { passed: true }
    }
    case 'recipient_whitelist': {
      const { allowedDomains } = gate.config as { allowedDomains: string[] }
      const recipient = String(data.to ?? '')
      const domain = recipient.split('@')[1]
      if (!allowedDomains.includes(domain)) {
        return { passed: false, reason: `Recipient domain ${domain} not whitelisted`, action: 'block' }
      }
      return { passed: true }
    }
    default:
      return { passed: true }
  }
}
```

---

## Module 7 — Cost Intelligence & Token Routing

### Database migrations

```sql
-- Migration: 0005_cost_intelligence.sql

CREATE TABLE cost_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_id      UUID REFERENCES agents(id),
  task_id       UUID,
  model         TEXT NOT NULL,
  tier          SMALLINT NOT NULL,  -- 0,1,2,3
  input_tokens  INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_eur_micro INTEGER NOT NULL,  -- cost in micro-euros (avoid float rounding)
  billing_month TEXT NOT NULL,      -- 'YYYY-MM' for monthly aggregation
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cost_company_month ON cost_records(company_id, billing_month);
CREATE INDEX idx_cost_agent_month   ON cost_records(agent_id, billing_month);

-- Materialized view for fast dashboard queries
CREATE MATERIALIZED VIEW cost_monthly_summary AS
SELECT
  company_id,
  billing_month,
  SUM(cost_eur_micro) AS total_cost_micro,
  SUM(input_tokens + output_tokens) AS total_tokens,
  COUNT(*) AS total_tasks,
  COUNT(DISTINCT agent_id) AS active_agents,
  SUM(CASE WHEN tier = 3 THEN 1 ELSE 0 END) AS t3_task_count
FROM cost_records
GROUP BY company_id, billing_month;

CREATE UNIQUE INDEX ON cost_monthly_summary(company_id, billing_month);
```

### Cost service (`src/costs/service.ts`)

```typescript
// Model cost table (in micro-euros per 1M tokens)
const MODEL_COSTS = {
  'mistralai/ministral-3b':          { input: 20,    output: 60    },
  'mistralai/mistral-small-3.2':     { input: 150,   output: 600   },
  'deepseek/deepseek-chat-v3-5':     { input: 240,   output: 720   },
  'google/gemini-flash-1.5':         { input: 75,    output: 300   },
  'mistralai/mistral-medium-3.1':    { input: 400,   output: 2000  },
  'anthropic/claude-sonnet-4-5':     { input: 3000,  output: 15000 },
} as const

export async function recordUsage(params: {
  companyId:    string
  agentId:      string
  taskId:       string
  model:        string
  inputTokens:  number
  outputTokens: number
  tier:         0 | 1 | 2 | 3
}) {
  const costs = MODEL_COSTS[params.model as keyof typeof MODEL_COSTS]
  const costMicro = Math.round(
    (params.inputTokens  / 1_000_000) * costs.input  +
    (params.outputTokens / 1_000_000) * costs.output
  )

  const billingMonth = new Date().toISOString().slice(0, 7)  // 'YYYY-MM'

  await db.insert(costRecords).values({
    companyId:   params.companyId,
    agentId:     params.agentId,
    taskId:      params.taskId,
    model:       params.model,
    tier:        params.tier,
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    costEurMicro: costMicro,
    billingMonth,
  })

  // Update company's running monthly counters (for real-time usage gauge)
  await db
    .update(companies)
    .set({
      tasksUsedMonth:  sql`tasks_used_month + 1`,
      tokensUsedMonth: sql`tokens_used_month + ${params.inputTokens + params.outputTokens}`,
    })
    .where(eq(companies.id, params.companyId))

  // Check T3 cap (Growth plan: max 10% of monthly tasks in T3)
  if (params.tier === 3) {
    await checkT3Cap(params.companyId)
  }
}

// Hard stop check — called before every LLM invocation
export async function checkBudgetBeforeCall(companyId: string): Promise<void> {
  const company = await db.query.companies.findFirst({
    where: eq(companies.id, companyId),
  })
  if (!company) throw new Error('Company not found')

  if (company.tasksUsedMonth >= company.tasksLimitMonth) {
    throw new BudgetExhaustedError('Monthly task limit reached. Upgrade your plan or wait for next billing cycle.')
  }

  if (company.tokensUsedMonth >= company.tokensLimitMonth) {
    throw new BudgetExhaustedError('Monthly token limit reached.')
  }
}
```

---

## Module 8 — Org Memory

```sql
-- Migration: 0006_org_memory.sql

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE memory_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN (
                'task_output','agent_decision','human_note',
                'goal_outcome','error_lesson','web_browse_insight'
              )),
  source_id   UUID,
  agent_id    UUID REFERENCES agents(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  tags        TEXT[] NOT NULL DEFAULT '{}',
  importance  SMALLINT NOT NULL DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
  embedding   vector(1024),   -- Mistral Embed dimension
  pinned      BOOLEAN NOT NULL DEFAULT false,
  archived    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_memory_company   ON memory_entries(company_id, archived, created_at DESC);
CREATE INDEX idx_memory_pinned    ON memory_entries(company_id, pinned) WHERE pinned = true;
CREATE INDEX idx_memory_embedding ON memory_entries USING ivfflat(embedding vector_cosine_ops)
  WITH (lists = 100);
```

Memory extraction runs as a background job (see Module 1 worker). Memory retrieval is part of the Context Assembly Pipeline (Module 2). See those modules for implementation details.

---

## Module 9 — Self-Learning & Autonomous Skill Improvement

### Skill version table

```sql
-- Migration: 0007_skill_versioning.sql

CREATE TABLE skill_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  skill_slug    TEXT NOT NULL,
  version       TEXT NOT NULL,   -- 'v1.0', 'v1.1', 'v2.0'
  body          TEXT NOT NULL,   -- full SKILL.md content
  diff_summary  TEXT,            -- plain-English change description
  triggered_by  TEXT NOT NULL CHECK (triggered_by IN ('agent_self','operator','system')),
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','superseded','rolled_back')),
  quality_before DECIMAL(3,2),   -- avg rating before this version
  quality_after  DECIMAL(3,2),   -- populated after 14 days
  activated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, skill_slug, version)
);

CREATE TABLE skill_improvement_proposals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  skill_slug    TEXT NOT NULL,
  current_version TEXT NOT NULL,
  proposed_body TEXT NOT NULL,   -- the full revised SKILL.md
  diff_summary  TEXT NOT NULL,
  predicted_improvement DECIMAL(3,2),
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected','auto_activated')),
  reviewed_by   UUID REFERENCES users(id),
  reviewed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Improvement analyser (`src/improvement/analyser.ts`)

```typescript
export async function analyseSkillPerformance(params: {
  agentId:   string
  companyId: string
  skillSlug: string
}): Promise<'no_action' | 'propose_improvement'> {
  // Get last 20 task outputs for this skill with ratings
  const recentTasks = await db.query.tasks.findMany({
    where: and(
      eq(tasks.agentId, params.agentId),
      eq(tasks.skillSlug, params.skillSlug),
      eq(tasks.status, 'completed'),
      isNotNull(tasks.humanRating),
    ),
    orderBy: desc(tasks.completedAt),
    limit: 20,
  })

  if (recentTasks.length < 5) return 'no_action'  // not enough data

  const avgRating = recentTasks.reduce((s, t) => s + (t.humanRating ?? 0), 0) / recentTasks.length

  // Trigger threshold: avg rating below 3.5 for 2 consecutive weeks
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  const recentEnough = recentTasks.filter(t => new Date(t.completedAt!) > twoWeeksAgo)
  const recentAvg = recentEnough.reduce((s, t) => s + (t.humanRating ?? 0), 0) / (recentEnough.length || 1)

  if (recentAvg < 3.5 && recentTasks.length >= 5) {
    return 'propose_improvement'
  }

  return 'no_action'
}

export async function generateImprovement(params: {
  agentId:     string
  companyId:   string
  skillSlug:   string
  currentSkill: ParsedSkill
  recentTasks:  Task[]
}): Promise<SkillImprovementProposal> {
  // Use T3 (Claude Sonnet) — this is complex meta-reasoning
  const currentSkillBody = params.currentSkill.body
  const taskSample = params.recentTasks.slice(0, 10).map(t =>
    `Output: ${t.output?.slice(0, 300)}\nRating: ${t.humanRating}/5\nOperator note: ${t.ratingNote ?? 'none'}`
  ).join('\n---\n')

  const response = await callLLM({
    model: 'anthropic/claude-sonnet-4-5',
    messages: [{
      role: 'user',
      content: `You are analysing performance of this AI skill and proposing improvements.

CURRENT SKILL INSTRUCTIONS:
${currentSkillBody}

RECENT TASK OUTPUTS AND RATINGS:
${taskSample}

Your task:
1. Identify the root cause of low ratings
2. Propose revised skill instructions that would fix the issue
3. Write a plain-English diff summary (what changed and why)

Respond in JSON:
{
  "rootCause": "...",
  "proposedBody": "... full revised SKILL.md content ...",
  "diffSummary": "Changed X to Y because Z",
  "predictedImprovement": 0.8
}`
    }],
    maxOutputTokens: 5000,
    companyId:  params.companyId,
    agentId:    params.agentId,
    taskId:     'skill-improvement',
  })

  const parsed = JSON.parse(response.choices[0].message.content)
  return parsed
}
```

### Autonomy tier enforcement

```typescript
export async function activateImprovement(params: {
  proposalId: string
  companyId:  string
  agentId:    string
}): Promise<void> {
  const proposal = await getProposal(params.proposalId)
  const skill = await getSkill(params.agentId, proposal.skillSlug)

  // Validate safety invariants before any activation
  const checks = [
    proposal.proposedBody.includes('web_access: true') === (skill.webAccess),  // didn't add web access
    !wasRemoved(proposal.proposedBody, /gdpr_required: true/),                  // didn't remove GDPR flag
    tokenDelta(skill.body, proposal.proposedBody) <= 0.2,                       // ≤ 20% token change
    !hasExternalActions(proposal.proposedBody) || skill.autonomyTier === 'A',   // Tier A if external
  ]

  if (checks.some(c => !c)) {
    throw new Error('Safety validation failed — cannot auto-activate this improvement')
  }

  // Determine activation path based on autonomy tier
  if (skill.autonomyTier === 'B') {
    // Tier B: activate immediately, notify operator after
    await activateSkillVersion(params.agentId, proposal.skillSlug, proposal.proposedBody, 'agent_self')
    await notifyOperatorSSE(params.companyId, 'skill_self_improved', {
      agentId:    params.agentId,
      skillSlug:  proposal.skillSlug,
      diffSummary: proposal.diffSummary,
    })
  } else {
    // Tier A: create approval request for operator
    await createApprovalRequest({
      companyId: params.companyId,
      type:      'skill_improvement',
      data:      { proposalId: params.proposalId },
      summary:   `${skill.name}: ${proposal.diffSummary}`,
    })
  }
}
```

---

## Module 10 — Pack Installer

### Pack manifest schema (`src/packs/types.ts`)

```typescript
export interface PackManifest {
  slug:        string
  name:        string
  version:     string
  description: string
  agents: Array<{
    slug:         string
    name:         string
    role:         string
    skills:       string[]
    heartbeatFrequencyMs: number
    budgetLimitMonth: number  // EUR
    integrations: Array<{
      type:        string
      permissions: string[]
    }>
  }>
  integrations: Array<{
    type:     string
    required: boolean
  }>
  goals: Array<{
    title:       string
    description: string
    daysToTarget: number
  }>
  qualityGates: QualityGateConfig[]
  onboardingQuestions: OnboardingQuestion[]
  dnaTemplate: {
    description:      string   // {company_name}, {sector} placeholders
    customerProfile:  string
    tone:             string
    regulatoryContext: string
  }
}
```

### Pack installer service (`src/packs/installer.ts`)

```typescript
export async function installPack(params: {
  companyId: string
  packSlug:  string
  answers:   Record<string, string>  // onboarding wizard answers
}): Promise<InstallResult> {
  const pack = await loadPack(params.packSlug)

  // All 7 steps in a single transaction — atomic rollback if any step fails
  return db.transaction(async (tx) => {

    // Step 1 — Generate Company DNA from wizard answers
    const dna = interpolateDna(pack.dnaTemplate, params.answers)
    await tx.insert(companyDna).values({
      companyId:         params.companyId,
      description:       dna.description,
      customerProfile:   dna.customerProfile,
      tone:              dna.tone,
      regulatoryContext: dna.regulatoryContext,
    }).onConflictDoUpdate({ target: companyDna.companyId, set: dna })

    // Step 2 — Create agents
    const agentIds: Record<string, string> = {}
    for (const agentDef of pack.agents) {
      const [agent] = await tx.insert(agents).values({
        companyId:            params.companyId,
        slug:                 agentDef.slug,
        name:                 agentDef.name,
        role:                 agentDef.role,
        status:               'active',
        heartbeatFrequencyMs: agentDef.heartbeatFrequencyMs,
        budgetLimitMonth:     agentDef.budgetLimitMonth,
      }).returning()
      agentIds[agentDef.slug] = agent.id
    }

    // Step 3 — Assign skills (load SKILL.md files from pack directory)
    for (const agentDef of pack.agents) {
      for (const skillSlug of agentDef.skills) {
        const skillBody = await loadSkillFile(params.packSlug, skillSlug)
        await tx.insert(agentSkills).values({
          agentId:   agentIds[agentDef.slug],
          skillSlug,
          body:      skillBody,
          version:   'v1.0',
        })
      }
    }

    // Step 4 — Create quality gates
    for (const gateDef of pack.qualityGates) {
      await tx.insert(qualityGates).values({
        companyId: params.companyId,
        gateType:  gateDef.type,
        config:    gateDef.config,
        enabled:   true,
      })
    }

    // Step 5 — Create initial goal
    if (pack.goals.length > 0) {
      const goal = pack.goals[0]
      await tx.insert(goals).values({
        companyId:   params.companyId,
        title:       interpolate(goal.title, params.answers),
        description: interpolate(goal.description, params.answers),
        targetDate:  addDays(new Date(), goal.daysToTarget),
        status:      'active',
      })
    }

    // Step 6 — Schedule recurring workflows (heartbeats)
    for (const agentDef of pack.agents) {
      await emit.heartbeat({
        agentId:     agentIds[agentDef.slug],
        companyId:   params.companyId,
        triggeredBy: 'scheduler',
      }, 5 * 60 * 1000)  // first heartbeat in 5 minutes
    }

    // Step 7 — Schedule monthly cost reset
    await emit.scheduleMonthlyReset(params.companyId)

    return {
      success:  true,
      agentIds: Object.values(agentIds),
      packSlug: params.packSlug,
      message:  `Pack ${pack.name} installed. Your AI team will be ready in 5 minutes.`,
    }
  })
  // If any step throws, the transaction rolls back automatically
}
```

---

## Module 11 — CEO Console

See existing `PAPERCLIP_ENHANCEMENT_SPEC.md` Module 1 for the full implementation detail. The CEO Console is unchanged in v2 except:

1. Approval cards now call `emit.taskApproved()` instead of directly mutating task status
2. The console context snapshot includes real-time queue depth (from BullMQ)
3. Agent hiring via the console triggers `emit.heartbeat()` after the hire approval

---

## Module 12 — Stripe Billing Integration

```sql
-- Migration: 0008_billing.sql

CREATE TABLE billing_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type      TEXT NOT NULL,
  payload         JSONB NOT NULL,
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  stripe_inv_id   TEXT NOT NULL UNIQUE,
  amount_eur_cent INTEGER NOT NULL,
  status          TEXT NOT NULL,
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  pdf_url         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Stripe webhook handler (`src/routes/stripe.ts`)

```typescript
// POST /webhooks/stripe
router.post('/webhooks/stripe',
  express.raw({ type: 'application/json' }),  // Raw body required for signature verification
  async (req, res) => {
    const sig = req.headers['stripe-signature']!
    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
    } catch {
      return res.status(400).send('Invalid signature')
    }

    // Idempotency: skip if already processed
    const existing = await db.query.billingEvents.findFirst({
      where: eq(billingEvents.stripeEventId, event.id)
    })
    if (existing) return res.json({ received: true })

    await db.insert(billingEvents).values({
      companyId:     extractCompanyId(event),
      stripeEventId: event.id,
      eventType:     event.type,
      payload:       event.data,
    })

    switch (event.type) {
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionCancelled(event.data.object as Stripe.Subscription)
        break
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice)
        break
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice)
        break
    }

    res.json({ received: true })
  }
)

async function handleSubscriptionUpdate(sub: Stripe.Subscription) {
  const company = await findCompanyByStripeCustomer(sub.customer as string)
  const plan = mapStripePriceToPlan(sub.items.data[0].price.id)
  const limits = PLAN_LIMITS[plan]

  await db.update(companies).set({
    plan:              plan,
    tasksLimitMonth:   limits.tasksPerMonth,
    tokensLimitMonth:  limits.tokensPerMonth,
    stripeSubId:       sub.id,
  }).where(eq(companies.id, company.id))
}
```

---

## Module 13 — Real-time SSE (Dashboard & Console)

```typescript
// src/realtime/sse.ts

const companyConnections = new Map<string, Set<Response>>()

export function registerSSEConnection(companyId: string, res: Response) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  if (!companyConnections.has(companyId)) {
    companyConnections.set(companyId, new Set())
  }
  companyConnections.get(companyId)!.add(res)

  // Heartbeat to keep connection alive
  const keepAlive = setInterval(() => res.write(': ping\n\n'), 30000)

  req.on('close', () => {
    clearInterval(keepAlive)
    companyConnections.get(companyId)?.delete(res)
  })
}

export function notifyOperatorSSE(
  companyId: string,
  eventType: string,
  data: unknown
) {
  const connections = companyConnections.get(companyId)
  if (!connections?.size) return

  const message = `data: ${JSON.stringify({ type: eventType, payload: data, ts: Date.now() })}\n\n`
  for (const res of connections) {
    try { res.write(message) } catch { connections.delete(res) }
  }
}

// Events emitted via SSE:
// agent.status_changed  — agent went active/paused/error
// task.created         — new task appeared
// task.completed       — task done
// approval.required    — operator needs to approve something
// skill.self_improved  — Tier B autonomous improvement activated
// budget.alert         — approaching 80% or 100% of monthly limit
// gate.violation       — quality gate blocked something
```

---

## Database migration order

Run migrations in this exact sequence:

```
0001_multi_tenancy_foundation.sql    ← Module 0
0002_company_dna.sql                 ← Module 2
0003_integration_hub.sql             ← Module 4
0004_quality_gates.sql               ← Module 6
0005_cost_intelligence.sql           ← Module 7
0006_org_memory.sql                  ← Module 8
0007_skill_versioning.sql            ← Module 9
0008_billing.sql                     ← Module 12
```

---

## Environment variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/platform

# Redis (BullMQ)
REDIS_URL=redis://localhost:6379

# LLM
OPENROUTER_API_KEY=sk-or-...

# Web browsing
FIRECRAWL_API_KEY=fc-...

# Credential vault (generate with: openssl rand -hex 32)
VAULT_MASTER_KEY=<64-char hex>

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...

# App
APP_URL=https://app.yourplatform.com
JWT_SECRET=<64-char random string>
NODE_ENV=production

# Internal monitoring
INTERNAL_AUTH_TOKEN=<token for Bull Board access>
```

---

## Implementation order for Claude Code

Execute in this sequence. Each step is independently testable before proceeding.

```
WEEK 1
  M0  — Multi-tenancy foundation (DB migrations + auth middleware)
  M1  — BullMQ installation + scheduler bootstrap (replace polling loop)

WEEK 2  
  M2  — Context assembly pipeline (DNA + memory retrieval)
  M3  — LLM router (T0→T3 + GDPR enforcement)

WEEK 3
  M4  — Integration hub (vault + MCP router + webhook ingress)
  M5  — Web browsing tool (Firecrawl + Jina fallback)

WEEK 4
  M6  — Quality gates + audit trail
  M7  — Cost intelligence + billing counters

WEEK 5
  M8  — Org memory (schema + extraction worker + retrieval)
  M9  — Skill versioning + improvement analyser

WEEK 6
  M10 — Pack installer (atomic 7-step + template system)
  M11 — CEO Console updates (EDA-aware)
  M12 — Stripe billing integration
  M13 — SSE real-time layer

WEEK 7-8
  Build Pack P1 (recruitment) using DOMAIN_PACK_SPEC.md
  Build the complete React UI (PLATFORM_FUNCTIONAL_SPEC_v4.md sections 5 & 6)
  Integration testing end-to-end
  Load testing (100 concurrent agents, 1000 tasks/hour)
```

---

## Testing requirements

Every module must have:

**Unit tests** — every service function, every gate checker, every job handler (with mock DB and mock Redis)

**Integration tests** — every API route, every webhook handler, every BullMQ worker (with test Redis instance)

**Specific invariants to test:**

```typescript
// Idempotency: running a job twice must not create duplicate data
test('heartbeat job is idempotent', async () => {
  await heartbeatHandler({ agentId, companyId })
  await heartbeatHandler({ agentId, companyId })   // run again
  const tasks = await getTasksForAgent(agentId)
  expect(tasks.length).toBe(1)   // not 2
})

// GDPR routing: personal data must never go to DeepSeek
test('GDPR skill routes to Mistral EU', () => {
  const skill = parseSkill('---\ntier: 1\ngdpr_required: true\n---\nContent')
  const decision = routeModel(skill, 'fr')
  expect(decision.model).toContain('mistral')
  expect(decision.model).not.toContain('deepseek')
})

// Gate hard block: over-limit agent cannot send email
test('email blocked when daily limit exceeded', async () => {
  await setAgentEmailCount(agentId, 50)   // at daily limit
  const result = await runGates({ companyId, agentId, actionType: 'send_email', ... })
  expect(result.passed).toBe(false)
  expect(result.action).toBe('block')
})

// Context budget: task is never truncated regardless of other layers
test('task context is never truncated', async () => {
  const ctx = await assembleContext({ agent, task: longTask, company, skill, tier: 'T1' })
  expect(ctx.currentTask).toContain(longTask.description)  // full task always present
})

// Skill autonomy: Tier A skills cannot self-activate
test('Tier A skill requires operator approval', async () => {
  const skill = parseSkill('---\nautonomy_tier: A\n---')
  await activateImprovement({ proposalId, companyId, agentId })
  const proposal = await getProposal(proposalId)
  expect(proposal.status).toBe('pending')   // not 'auto_activated'
})
```

---

*End of technical implementation specification v2.0. Last updated: April 2026.*
*Companion document: PLATFORM_FUNCTIONAL_SPEC_v4.md*

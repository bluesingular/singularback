# CLAUDE.md — Platform Implementation Brief v2
**For:** Claude Code
**Project:** Singular.blue — AI company platform for SMBs
**Company:** Singular.blue (sovereign AI company, EU-native)
**Base:** Fork of `paperclipai/paperclip` (MIT)
**This file:** Root working brief. Read this first, then the spec files listed below.

---

## What you are building

A managed SaaS platform that lets any SMB — without technical staff — deploy and run a team of AI agents that handle their company's day-to-day work. The mental model: **the owner is the CEO, the agents are the team, the platform is the company.**

This is NOT a developer tool. The end user is a 45-year-old French recruitment agency founder who has never written code. All UI copy is in French. All technical concepts are hidden from the user. See EMOTIONAL_LAYER.md for all user-facing strings.

---

## Spec files — read before each module

| File | Purpose | When to read |
|---|---|---|
| `TECHNICAL_SPEC_v2.md` | Full implementation — SQL, TypeScript, BullMQ, pgvector | Before implementing any backend module |
| `PLATFORM_FUNCTIONAL_SPEC_v5.md` | Product spec — UI flows, trust system, activation sequence | Before building UI or defining APIs |
| `EMOTIONAL_LAYER.md` | All French user-facing strings — notifications, micro-rewards, copy | Before building any UI string or notification |
| `DOMAIN_PACK_SPEC.md` | Pack system — structure, seed tasks, golden datasets | When building Pack P1 (weeks 8–9) |
| `EUROPEAN_SOVEREIGNTY_STRATEGY.md` | Company strategy — for context, not implementation | Read once for orientation |

**The master spec is PLATFORM_FUNCTIONAL_SPEC_v5.md.** The v4 spec is superseded. Do not reference it.

---

## Repository structure

```
/
├── CLAUDE.md                        ← You are here
├── TECHNICAL_SPEC_v2.md             ← Backend implementation spec
├── PLATFORM_FUNCTIONAL_SPEC_v5.md   ← Product spec (current master)
├── EMOTIONAL_LAYER.md               ← All French UI copy
├── DOMAIN_PACK_SPEC.md              ← Pack architecture
│
├── server/                          ← Forked from Paperclip — Node.js TypeScript
│   ├── src/
│   │   ├── agents/                  ← Agent execution (keep Paperclip core)
│   │   ├── tasks/                   ← Task management (keep Paperclip core)
│   │   ├── goals/                   ← Goal system (keep Paperclip core)
│   │   ├── queue/                   ← NEW: BullMQ queues, workers, emit API
│   │   ├── context/                 ← NEW: Context assembly (6-layer + contact injection)
│   │   ├── llm/                     ← NEW: LLM router + GDPR enforcement
│   │   ├── integrations/            ← NEW: MCP router, vault, webhooks
│   │   ├── tools/                   ← NEW: Firecrawl web browsing
│   │   ├── gates/                   ← NEW: Quality gates + output schema validation
│   │   ├── costs/                   ← NEW: Cost tracking + task translation
│   │   ├── memory/                  ← NEW: Org memory + pgvector
│   │   ├── trust/                   ← NEW: Trust Score + autonomy proposals
│   │   ├── improvement/             ← NEW: Skill versioning + self-improvement
│   │   ├── intelligence/            ← NEW: Morning intelligence card generation
│   │   ├── activation/              ← NEW: First-week activation sequence
│   │   ├── packs/                   ← NEW: Pack installer + seed tasks
│   │   ├── console/                 ← NEW: CEO Console + proactive intelligence
│   │   ├── billing/                 ← NEW: Stripe integration
│   │   ├── realtime/                ← NEW: SSE layer (granular events)
│   │   ├── middleware/              ← NEW: Auth + multi-tenancy
│   │   └── workers/                 ← NEW: BullMQ worker definitions
│   └── migrations/                  ← Drizzle migrations (numbered, never edit existing)
│
├── ui/                              ← NEW: Complete React app (not Paperclip's UI)
│   └── src/
│       ├── components/              ← Design system (AgentCard, TrustCard, IntelCard...)
│       ├── pages/                   ← 9 screens per spec sections 6.1–6.10
│       └── hooks/                   ← useCompanyEvents (SSE), useGranularFeed
│
└── packs/
    └── p1-recruitment/
        ├── pack.json                ← includes taskTranslations, activationSequence
        ├── onboarding.json
        ├── seed-tasks.json          ← NEW: 3 seed tasks for Day 0
        ├── activation-sequence.json ← NEW: 5 wow moments with exact copy
        ├── agents/
        ├── skills/
        │   └── [slug]/
        │       ├── SKILL.md         ← includes output schema in frontmatter
        │       └── golden-dataset.json ← NEW: 20 quality examples
        ├── integrations.json
        ├── goals.json
        └── quality-gates.json
```

---

## Implementation order — 10 weeks, follow exactly

Do not skip ahead. Every module must pass its tests before the next begins.

### Week 1 — Foundation
```
M0: Multi-tenancy
  - companies, users, company_members, sessions tables
  - company_id FK on all Paperclip tables
  - Auth middleware (JWT + company check)
  - Company switcher
  TEST: 2 companies, 1 user, data isolated

M1: BullMQ EDA
  - Replace setInterval polling with BullMQ
  - redis.ts, queues.ts, jobs.ts, emit.ts
  - HeartbeatWorker, EmailReceivedWorker, TaskApprovedWorker
  - Bull Board at /internal/queues
  TEST: heartbeat idempotent; approval triggers immediate execution
```

### Week 2 — Intelligence
```
M2: Context assembly pipeline
  - Company DNA table + service
  - 6-layer assembleContext() with token budgets
  - Contact injection in Layer 4 (contact profile > org memory)
  TEST: T1 < 7,000 tokens; task NEVER truncated

M3: LLM router
  - Skill frontmatter parser (gray-matter)
  - routeModel() with GDPR hard rule
  - OpenRouter caller with token tracking
  TEST: gdpr_required:true → NEVER DeepSeek → throws if violated
```

### Week 3 — Integrations
```
M4: Integration Hub
  - AES-256-GCM credential vault (per-company HKDF key)
  - MCP router (server-side, audit-logged)
  - Inbound webhook handler
  TEST: credentials encrypted at rest; LLM never receives tokens

M5: Web browsing (Firecrawl)
  - Firecrawl primary + Jina fallback
  - Permission check (web_access: true required)
  - GDPR flag for personal data content
  - URL logging (AI Act)
  TEST: no web_access → ForbiddenError; URLs logged to audit
```

### Week 4 — Safety layer
```
M6: Quality gates + output schema validation + damage control
  - Output schema validation (before gates run)
  - auto-protection gates (volume, whitelist, budget, forbidden)
  - Immutable audit trail (DB rules: no UPDATE/DELETE)
  - Damage control flow (error report → recovery plan → correction draft)
  TEST: schema validation catches missing fields; audit immutable at DB level

M7: Cost intelligence + task translation
  - cost_records + materialized view
  - recordUsage() micro-euro precision
  - Task translation per pack (pack.taskTranslations)
  - Budget alerts + hard stop
  TEST: task count translates to "~12 CV batches"; costs in micro-euros
```

### Week 5 — Memory + Trust
```
M8: Org memory + Contact entity foundation
  - memory_entries with pgvector (1024 dims, Mistral Embed)
  - Contact tables (contacts, contact_events, contact_notes)
  - Weighted retrieval + contact injection trigger
  TEST: semantic search > 0.72 threshold; contact profile injected when name present

M9: Trust calibration system
  - trust_scores table (per agent per skill type)
  - Trust Score calculation: quality × gate_pass × schema_pass (weighted)
  - trust_proposals table + proposal generation
  - Autonomy level enforcement (Supervised/Spot-checked/Summarised/Silent)
  - Trust downgrade when score drops
  - Approval streak counter (triggers proposal at 10 consecutive 4+★)
  TEST: Tier A never auto-activates; downgrade fires notification
```

### Week 6 — Self-learning + Intelligence
```
M10: Skill versioning + self-improvement + evaluation framework
  - skill_versions table + golden_datasets table
  - Improvement analyser (triggers below 3.5 or after damage control)
  - Golden dataset benchmarking (auto-score new version vs current)
  - Activation decision (new ≥ current + 5% → proceed; < current - 5% → block)
  - Tier A → proposal; Tier B → auto-activate
  TEST: golden benchmark runs before any activation; Tier A creates proposal

M11: Morning intelligence + activation sequence
  - intelligence_cards table
  - Daily sweep (8am BullMQ cron): anomalies, trust, relationship gaps, goals
  - Max 3 cards/day, urgency-ranked, no spam (14-day cooldown per insight)
  - Activation sequence: 5 trigger definitions per pack
  - Approval micro-rewards: streak tracking, inline thread messages
  TEST: max 3 cards generated; streak triggers proposal at 10; Day 0 seed fires < 10min
```

### Week 7 — Shipping infrastructure
```
M12: Pack installer + seed tasks
  - Atomic 7-step transaction with rollback
  - Seed tasks scheduled at installation (fire within 10min)
  - Template variable interpolation
  - activationSequence triggers registered in BullMQ scheduler
  TEST: failed step 4 rolls back 1-3; seed tasks fire within 10min

M13: CEO Console — proactive mode
  - Console opens with unaddressed intelligence cards pre-loaded
  - Approval cards fire emit.taskApproved() on confirm
  - Console context includes queue depth + trust state
  TEST: console shows intelligence cards if unaddressed; approval triggers execution

M14: Stripe billing
  - Idempotent webhook (skip if stripeEventId already processed)
  - Plan → limits mapping with task translation
  TEST: duplicate webhook processed once

M15: SSE real-time layer — granular events
  - Per-company connection map
  - Task-level events: task.started, task.completed, task.blocked
  - Within-task events: agent.reading, agent.analysing, agent.writing
  - Granular events clear after 60s inactivity
  - Keepalive ping every 30s
  TEST: within-task events stream live; clear after timeout
```

### Weeks 8–9 — Pack P1
```
Pack P1 — Recruitment agencies (full build)
  pack.json:
    - 5 agents (Sophie sourcing, Marc client relations, Clara content,
                 Julien admin, Iris market intelligence)
    - taskTranslations (7 tasks = 1 CV batch, 3 = 1 job posting, etc.)
    - activationSequence (5 moments: Day 0/2/4/6/7)
  
  onboarding.json:
    - 7 wizard questions, sector-matched
  
  seed-tasks.json:
    - 3 seed tasks with PRODUCTION-QUALITY anonymised data
    - Must be indistinguishable from real work
  
  activation-sequence.json:
    - Exact push notification copy from EMOTIONAL_LAYER.md sections 2
    - Timing triggers, conditions, micro-reward messages
  
  skills/ (8 skills with output schemas):
    - qualification-cv (gdpr:true, tier:1, schema required)
    - job-posting-writer (gdpr:false, tier:1)
    - candidate-sourcing (gdpr:false, tier:2, web_access:true)
    - candidate-follow-up (gdpr:true, tier:1)
    - candidate-re-engagement (gdpr:true, tier:1)
    - client-email (gdpr:false, tier:1)
    - weekly-client-report (gdpr:false, tier:2)
    - market-intelligence (gdpr:false, tier:2, web_access:true)
  
  golden-datasets/ (20 examples per skill = 160 total)
  quality-gates.json (employment law, batch limit, email tone)
  
  TESTS:
    - 20-minute test: non-technical person completes in < 20min
    - Seed tasks produce output within 10min of installation
    - All French copy matches EMOTIONAL_LAYER.md exactly
    - Handoff: qualification-cv → client-email fires when score ≥ 4
```

### Week 10 — React UI
```
UI — All 9 screens (PLATFORM_FUNCTIONAL_SPEC_v5.md sections 5–6)

Design system:
  - Fonts: Georgia serif (headings), DM Sans (body), DM Mono (timestamps)
  - Colours: #FAFAF8 bg, #1A9E68 green, #C97C0A amber, #1A4E8C trust blue
  - All copy in French from EMOTIONAL_LAYER.md

Screens:
  1. Dashboard (6.1)
     - Morning intelligence cards (max 3, actionable)
     - Live activity feed (granular events, 🔴 En direct)
     - Team status with trust indicators
     - Usage gauge with task translation
  
  2. AI Team (6.2)
     - Trust dot on each agent card
     - Handoff indicator
  
  3. Agent detail (6.3)
     - Trust track record section
     - Autonomy level + streak progress bar
     - Recent handoffs
  
  4. Trust centre (6.4)
     - Pending proposals with evidence
     - Active trust levels (all agents × all skill types)
  
  5. Task thread (6.5)
     - Approval micro-rewards (inline, after every approval)
     - Schema validation note if agent corrected output
     - Handoff chain visible in thread
  
  6. CEO Console (6.6)
     - Opens with intelligence cards if unaddressed
     - French copy from EMOTIONAL_LAYER.md section 8
  
  7. Reports / ROI (6.7)
     - Task translations throughout
     - Hire simulator in French
  
  8. Contacts (6.7 — V2 UI, foundation from MVP)
  
  9. Settings / Company DNA (6.8)
     - French field labels + helper text from EMOTIONAL_LAYER.md section 11

TESTS:
  - All 9 screens < 2s load
  - Zero technical terms visible (grep for heartbeat, token, adapter, pgvector)
  - Mobile: approval cards full-width on iPhone 14 (390px)
  - Live feed: granular events appear within 2s of SSE event
  - French only: no English strings in user-facing copy
```

---

## Hard rules — never violate

```
RULE 1: GDPR ENFORCEMENT (code invariant, not config)
  gdpr_required: true in skill → routeModel() throws if model is not Mistral EU
  DeepSeek FORBIDDEN for any personal data
  Test: yarn test --grep "GDPR routing" must pass before every commit

RULE 2: CREDENTIALS NEVER REACH LLM
  Vault decrypts credentials server-side for tool calls only
  LLM receives clean, pseudonymised task content only
  Lint rule: no raw credential variables in any file under llm/

RULE 3: QUALITY GATES ARE MANDATORY
  Every external action passes runGates() + validateOutputSchema()
  No bypass path exists. Not for testing. Not for admin. Not for demo.

RULE 4: AUDIT TRAIL IS IMMUTABLE
  DB-level RULE prevents UPDATE/DELETE on audit_entries
  Test: direct DELETE attempt must fail at DB level

RULE 5: TASK CONTENT NEVER TRUNCATED
  assembleContext() runtime assertion: if taskLayer was truncated → throw
  Compress in order: outputs → memory → DNA, never task

RULE 6: BULLMQ IDEMPOTENCY
  Every worker safe to run twice
  Heartbeat jobId = heartbeat:${agentId} (BullMQ dedup)

RULE 7: APPROVAL FLOW NON-NEGOTIABLE
  requires_approval action → approval_requests record → wait for human
  Auto-execution before approval → bug, not feature

RULE 8: COMPANY ISOLATION
  company_id from auth middleware, never from client
  Every DB query includes company_id WHERE clause

RULE 9: ALL UI COPY FROM EMOTIONAL_LAYER.md
  No English strings in user-facing UI
  No invented copy — find the exact string in EMOTIONAL_LAYER.md first
  grep for any English in ui/src/pages/ → fail review

RULE 10: SEED TASKS MUST BE INDISTINGUISHABLE FROM REAL WORK
  No "Test Candidate", "Sample Company", or obvious placeholders
  Anonymised from real domain data. Sector-matched to operator's declared spec.
```

---

## Key constants

```typescript
// LLM routing (from TECHNICAL_SPEC_v2.md)
const MODEL_REGISTRY = {
  T0:    'mistralai/ministral-3b',
  T1_FR: 'mistralai/mistral-small-3.2',    // GDPR-safe, French
  T1_EN: 'deepseek/deepseek-chat-v3-5',    // NOT for personal data
  T2_S:  'google/gemini-flash-1.5',
  T2_Q:  'mistralai/mistral-medium-3.1',   // GDPR-safe
  T3:    'anthropic/claude-sonnet-4-5',
}

// Trust Score weights
const TRUST_WEIGHTS = {
  qualityRating:  0.50,
  gatePassRate:   0.30,
  schemaPassRate: 0.20,
  windowDays:     30,
}

// Autonomy thresholds
const AUTONOMY_THRESHOLDS = {
  building:    { min: 0,   max: 2.9 },
  supervised:  { min: 3.0, max: 3.9 },
  trusted:     { min: 4.0, max: 4.4 },
  highlyTrusted: { min: 4.5, max: 5.0 },
}

// Plan limits
const PLAN_LIMITS = {
  solo:       { tasksPerMonth: 500,   tokensPerMonth: 5_000_000,   agents: 2  },
  growth:     { tasksPerMonth: 2000,  tokensPerMonth: 20_000_000,  agents: 6  },
  pro:        { tasksPerMonth: 6000,  tokensPerMonth: 60_000_000,  agents: 15 },
  enterprise: { tasksPerMonth: 99999, tokensPerMonth: 999_000_000, agents: 999 },
}
```

---

## MVP definition of done

- [ ] Pack P1 installs in < 20 minutes (non-technical user test passed)
- [ ] Seed tasks produce visible output within 10 minutes of installation
- [ ] Day 2 notification fires within 5 minutes of first real task completing
- [ ] Activation sequence: all 5 moments trigger in correct order, Days 0–7
- [ ] Trust proposals: generated after 10 consecutive 4+★ approvals
- [ ] Morning intelligence: max 3 cards per day; no card repeated < 14 days
- [ ] Live activity feed: granular events stream within 2s via SSE
- [ ] GDPR: zero DeepSeek calls for any gdpr_required:true skill
- [ ] Output schema: malformed outputs caught before reaching operator
- [ ] Damage control: recovery plan generated when communication marked as error
- [ ] Audit trail: immutable at DB level (DELETE attempt fails)
- [ ] Task translation: usage gauge shows "~95 CV batches remaining"
- [ ] Agent-to-agent handoff: qualification-cv → client-email fires when score ≥ 4
- [ ] All UI copy in French, sourced from EMOTIONAL_LAYER.md
- [ ] Zero English strings visible in any user-facing screen
- [ ] All 9 screens load in < 2s
- [ ] Mobile: approval flow works on iPhone 14 (390px)
- [ ] Stripe: plan change updates limits within 60 seconds
- [ ] 10 design partner accounts onboarded and active

---

*Start by reading TECHNICAL_SPEC_v2.md fully. Then begin M0.*

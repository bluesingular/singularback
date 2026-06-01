# Swwarm — Platform Functional Specification v8

**Company:** Singular.blue  
**Product:** Swwarm  
**Version:** 8.0  
**Date:** May 2026  
**Status:** Authoritative — supersedes all previous versions  
**Scope:** Full platform — domain-agnostic  
**Audience:** Engineering (Claude Code), Product, Design  

---

## Table of Contents

1. [Product Identity](#1-product-identity)
2. [Core Architecture](#2-core-architecture)
3. [Platform Principles — 11 Hard Rules](#3-platform-principles)
4. [User Types and Portals](#4-user-types-and-portals)
5. [Customer Journey](#5-customer-journey)
6. [Three-Tier Skill Architecture](#6-three-tier-skill-architecture)
7. [Agent System](#7-agent-system)
8. [Company DNA Schema](#8-company-dna-schema)
9. [Pack System](#9-pack-system)
10. [Mission System](#10-mission-system)
11. [CEO Console](#11-ceo-console)
12. [Trust Calibration System](#12-trust-calibration-system)
13. [Activation Sequence](#13-activation-sequence)
14. [Notification System](#14-notification-system)
15. [Approval System](#15-approval-system)
16. [Voice-to-Agent](#16-voice-to-agent)
17. [Proposal and Document Studio](#17-proposal-and-document-studio)
18. [Financial Pulse](#18-financial-pulse)
19. [Calendar Intelligence](#19-calendar-intelligence)
20. [Skill Management System](#20-skill-management-system)
21. [Admin Portal](#21-admin-portal)
22. [Mobile and Channel Strategy](#22-mobile-and-channel-strategy)
23. [Platform Technical Gaps G1–G15](#23-platform-technical-gaps)
24. [Product Gaps A–H](#24-product-gaps)
25. [Data Model](#25-data-model)
26. [Infrastructure](#26-infrastructure)
27. [AI Act and GDPR Compliance](#27-ai-act-and-gdpr-compliance)
28. [Build Sequence](#28-build-sequence)

---

## 1. Product Identity

### Company
**Singular.blue** — parent SAS registered in France. Primary domain: `singular.blue`.

### Product
**Swwarm** — the European sovereign agentic operating system for SMBs. A platform where the business owner is the CEO, the AI agents are the team, and compound memory makes the platform smarter every day.

### Core value proposition
The owner does not use the platform to do operational work. The owner uses the platform to lead a team that does operational work. Every feature reinforces this distinction.

### Tagline (in validation)
- *"Run a bigger business without a bigger team."*
- *"Your business grows. Your workload doesn't."*

### What makes Swwarm unique
1. **Compound memory** — the platform gets smarter with every task, correction, and interaction. Competitors reset to zero each session.
2. **EU sovereignty** — GDPR routing is a code invariant, not a configuration. Personal data never reaches non-EU infrastructure.
3. **AI Act compliance by architecture** — immutable audit trail, human oversight gates, explainability, auto-generated conformité documentation.
4. **Domain depth via packs** — pre-built skill packs for specific verticals with sector vocabulary, quality gates encoding domain regulation, and golden datasets.
5. **Trust calibration** — agents earn autonomy through demonstrated performance. The platform proposes upgrades; the human decides.
6. **Mission-based orchestration** — the owner sets strategic intent (missions), the orchestrator decomposes, named agents execute.

### Target customer
Founder-run SMBs of 1–20 employees in professional service sectors. Non-technical. Working alone at the edge of what is manageable. Does not want to manage AI tools — wants a team that works.

---

## 2. Core Architecture

### Technology stack

| Component | Technology |
|---|---|
| Runtime | Node.js 20, TypeScript |
| Base | Paperclip fork (MIT) |
| Queue | BullMQ (Redis) |
| Database | PostgreSQL 16 + pgvector |
| ORM | Drizzle |
| Frontend | React 18 + Tailwind CSS |
| Auth | JWT — company_id from token only |
| Payments | Stripe (metered billing) |
| LLM routing | OpenRouter → custom gateway |
| Web browsing | Firecrawl (static) + Browser-use cloud (interactive) |
| Infrastructure | Hetzner (Phase 1) → OVH France (Phase 2+) |
| Product analytics | PostHog self-hosted (OVH) |
| Marketing analytics | Plausible (EU-hosted) |
| Scheduling | BullMQ cron jobs |
| Real-time | Server-Sent Events |

### LLM routing tiers

| Tier | Model | Scope | Cost |
|---|---|---|---|
| T0 | Ministral 3B | Classification, routing | ~€0.0003/task |
| T1-FR | Mistral Small 3.2 | All GDPR-scoped tasks | ~€0.0017/task |
| T1-EN | DeepSeek V3.2 | Public research, non-personal | Low |
| T2 | Gemini Flash / Mistral Medium | Complex reasoning | Medium |
| T3 | Claude Sonnet | Highest-stakes outputs | Higher |

**GDPR routing invariant:** `gdpr_required: true` → T1-FR exclusively. DeepSeek is FORBIDDEN for personal data. This throws — it does not log and continue.

### Event architecture
All agent execution is event-driven via BullMQ. No polling. No cron except scheduled daily jobs. Every state change emits an event. Every event is logged to `audit_entries` before processing. No event is lost.

### Real-time events (SSE)
Per-company SSE stream. Events emitted during agent execution:

```
agent.reading      → agent accessing data source
agent.analysing    → agent processing content
agent.writing      → agent generating output (streaming chunks)
agent.tool_call    → agent calling external tool
agent.done         → task completed
agent.blocked      → awaiting human input
agent.handoff      → delegating to another agent
task.approved      → operator approved action
task.rejected      → operator rejected action
platform.health    → dispatcher / integration status update
```

---

## 3. Platform Principles

These 11 rules are absolute. They cannot be overridden by configuration, feature flags, or operator instruction. They are enforced at code level — they throw exceptions, they do not log and continue.

**Rule 1 — GDPR is a code invariant.**
`gdpr_required: true` routes to Mistral EU only. Any attempt to route personal data to a non-EU model throws `GDPRViolationError`. DeepSeek is permanently forbidden for personal data regardless of any future configuration.

**Rule 2 — Credentials never reach LLM context.**
The Integration Hub vault decrypts credentials at execution time. Decrypted values are never serialised, logged, or injected into LLM prompts. Violation is a security incident.

**Rule 3 — Quality gates are mandatory.**
No agent output reaches an operator without passing output schema validation and quality gates. No bypass flag exists at any tier. Silent correction attempts (max 2) run before escalating to a human.

**Rule 4 — Audit trail is immutable.**
`audit_entries` is append-only. No UPDATE or DELETE at DB level. This is enforced via a database trigger that raises an exception on any UPDATE or DELETE attempt. Required by AI Act.

**Rule 5 — Task context is never truncated.**
If context exceeds the model's token limit, a summarisation pass runs first. The original context is preserved in object storage. The model always receives complete, accurate context.

**Rule 6 — BullMQ jobs are idempotent.**
Every job carries a dedup key. Retry after failure is safe. No duplicate actions on retry.

**Rule 7 — Approval gates are non-negotiable for external actions.**
No external communication (email, post, API write, external system update) executes without explicit operator approval — unless the agent's Trust Score for that skill qualifies it for autonomous operation AND the operator has confirmed the autonomy upgrade.

**Rule 8 — company_id comes from auth JWT only.**
Never from request body, query string, or header. Tenant isolation is absolute. Cross-tenant data access throws `TenantIsolationError`.

**Rule 9 — All customer-facing copy comes from EMOTIONAL_LAYER.md.**
No hardcoded strings in UI components. Every user-facing message references a copy key. This enables locale switching and consistent tone.

**Rule 10 — Seed tasks are indistinguishable from real work.**
Seed tasks use real company data, produce real outputs, follow the identical execution path, and require approval the same way live tasks do. They are not demos.

**Rule 11 — The orchestrator only routes, never executes.**
The CEO Console orchestrator agent surfaces, prioritises, decomposes, and delegates. It never executes external actions directly. Enforced via injected preamble at every session start. If asked to act directly: "Je vais confier ça à [agent] qui s'en occupera."

---

## 4. User Types and Portals

### Four surfaces

**swwarm.com** — Public marketing site. Landing page, pricing, blog, AI Act compliance checker (lead magnet). Plausible analytics. No auth.

**app.swwarm.com** — Customer SaaS product. Every screen reads `company_id` from `useAuth().companyId`. Zero hardcoded tenant references. All copy from EMOTIONAL_LAYER.md.

**admin.swwarm.com** — Internal Swwarm team portal. IP-restricted. Tenant management, skill management, Bull Board, billing oversight, read-only impersonation.

**developers.swwarm.com** — (Phase 3) Public API docs, SDK downloads, skill marketplace, webhook playground.

### RBAC — five roles

| Role | Permissions |
|---|---|
| Owner | All + billing + company deletion |
| Admin | All features except billing/deletion |
| Operator | Approve tasks, view dashboard, configure agents |
| Viewer | Read-only: dashboard, reports, audit trail |
| API | Programmatic access only |

### The nine customer-facing screens

1. CEO Console — operatives floor + mission control + morning intelligence
2. Task approval — mobile-optimised, one-tap approve/reject/clarify
3. Agent roster — trust scores, autonomy levels, last activity
4. Pack browser — available packs, install wizard
5. Integration Hub — connected tools, credential status, webhook config
6. Org memory — contacts, company knowledge, vector search
7. Financial pulse — revenue trajectory, invoice health, cash position
8. Audit trail — immutable log, AI Act export, mission history
9. Settings — team members (RBAC), notifications, billing, preferences

---

## 5. Customer Journey

### Discovery
Organic: LinkedIn Day 7 card shares, peer referral, expert-comptable recommendation, comparison directory, AI Act compliance checker lead magnet.

### Sign-up
1. Email + password on swwarm.com
2. Email verification (6-digit code, 15-minute expiry)
3. Redirect to onboarding wizard

### Onboarding wizard (Gap A)
7 questions populating Company DNA:

| Step | Question | Field |
|---|---|---|
| 1 | Company name | company_name |
| 2 | Sector and specialisation | sector, specialisation |
| 3 | Geography | zone_geo |
| 4 | Primary pain (select from list) | primary_pain |
| 5 | Brand tone (formal/balanced/friendly) | brand_voice.tone |
| 6 | Key clients (optional, up to 3) | key_clients[] |
| 7 | Tools you already use | triggers integration suggestions |

Total time: under 5 minutes. Progress bar visible. Agent animation during processing.

### Pack selection
Customer browses available packs. Each shows: named agents, what they do, example seed tasks, typical time saved per week. One-click install. Stripe checkout for paid plans.

### Pack install (M12 — atomic 8-step transaction)
1. Write Company DNA to `company_dna`
2. Merge Tier 2 (pack) + Tier 3 (Company DNA) into tenant skill instructions
3. Generate `soul.md` per agent from Company DNA + pack defaults
4. Generate `team-roster.md` for orchestrator
5. Create agents with colour + display_name + status: active
6. Install skills with capability declarations
7. Schedule seed tasks (fire within 10 minutes)
8. Register activation sequence triggers

Rollback on any step failure. Copy on success: "Sophie est prête. Elle commence à travailler."

---

## 6. Three-Tier Skill Architecture

### The three tiers

```
Tier 1 — Platform skills (Swwarm-managed)
  Generic, domain-agnostic primitives
  Built and maintained by Swwarm team via admin portal skill editor
  Available to all tenants as pack building blocks
  Examples: send_email_to_contact, qualify_document, research_company,
            draft_proposal, schedule_meeting, update_contact_record

Tier 2 — Pack library (Swwarm-managed)
  Domain-specific configurations of Tier 1 skills
  Each pack = a business role or vertical
  Contains: named agents, skill configs, seed tasks, quality gates,
            golden datasets, wizard questions
  Authored in admin.swwarm.com skill manager — NOT vibe coded

Tier 3 — Tenant customisation (per-customer)
  Customer-specific overlay on installed pack
  Generated from onboarding wizard → stored as Company DNA
  Auto-enriched by org memory as platform learns
  Contains: brand voice, services, clients, market intel, constraints
```

### The merge at install time
Pack skill instructions are templates. Company DNA values are injected at install:

```
Template:
  "You are {agent.display_name} at {company_name}. Tone: {brand_voice.tone}.
   Focus on {services.0.name} in {zone_geo}.
   Never contact: {competitors_to_avoid}."

After merge (live tenant instruction):
  "You are Sophie at Cabinet Martin. Tone: formal.
   Focus on IT senior consulting in Paris.
   Never contact: [CompetitorA], [CompetitorB]."
```

### Pack content is authored, not coded
Pack P1 content (skill instructions, golden datasets, quality gate thresholds, seed task definitions) is created by the Swwarm team in the skill management system (Gap D / §20). It is content authoring, not a Claude Code session.

### The learning loop
When a tenant's skill outperforms the platform baseline by a statistically significant margin, the admin portal flags it for Swwarm team review. The team reviews the diff, anonymises customer-specific content, and promotes improvements to the platform skill. Platform gets smarter from customer usage.

### Update propagation
**Current model (opt-in):** Tenant sees notification "Sophie 1.2.0 disponible — voir les nouveautés." Reviews diff. Clicks to update.

**Future model (layered merge):** Platform skill diffs applied as overlay on top of tenant customisations. Tenant's golden dataset and thresholds preserved. Base instruction logic updates.

---

## 7. Agent System

### 7.1 Agent identity

Each agent has two layers:

**SOUL layer — who the agent is**
```markdown
# agent.soul.md (generated at pack install, editable via Gap F)
Identity: personality, communication style, role description
Tone: formal / balanced / friendly
Forbidden words: list
Signature phrases: list
Absolute constraints: things this agent never does
Escalation rules: when and to whom to escalate
```

**SKILL layer — what the agent can do**
Defined by SKILL.md files. Capability declaration in frontmatter (see G2). Quality gates. Golden datasets. Output schemas. Handoff targets.

### 7.2 Agent fields

```typescript
interface Agent {
  id:                  string     // UUID
  company_id:          string     // UUID — from auth, never from request
  slug:                string     // system identifier, immutable
  display_name:        string     // customer-facing name, editable
  colour:              string     // hex, immutable after set
  status:              'active' | 'paused' | 'deactivated'
  soul_md:             string     // identity layer content
  team_roster_visible: boolean    // shown in team-roster.md
  created_at:          timestamp
}
```

**Colour palette** — six values, assigned sequentially at install, immutable:
```
#3B82F6 blue  · #10B981 green  · #F59E0B amber
#8B5CF6 purple · #EF4444 red   · #14B8A6 teal
```

**Status rules:**
- `active` → takes new tasks, visible on operatives floor
- `paused` → completes in-progress tasks, takes no new ones, visible with indicator
- `deactivated` → hidden from floor, takes no tasks, all history preserved
- `DELETE agents` is NEVER called from the application layer

### 7.3 Autonomy levels

| Level | Behaviour |
|---|---|
| `manual` | Every output requires approval before action |
| `supervised` | Output reviewed before delivery, agent waits |
| `spot_checked` | 1-in-5 random sampling via crypto.randomInt. Others execute autonomously |
| `autonomous` | Acts without review. External-action cap: Trust Score ≥ 4.8 |

Hard cap: agents cannot be proposed beyond `spot_checked` for external communications unless Trust Score ≥ 4.8. Enforced in `generateAutonomyProposal()`.

### 7.4 Action types

| Type | Behaviour | Approval required |
|---|---|---|
| `read` | Read-only data access | Never |
| `draft` | Creates content pending approval | Before delivery |
| `send_email` | Sends after approval | Yes (unless autonomous) |
| `create_document` | Creates file in connected storage | Yes |
| `web_search` | Public web research | Never |
| `update_crm` | Writes to connected CRM | Yes |
| `handoff_to` | Delegates to another agent | Inherited from parent |
| `clarify` | Pauses task, asks human specific question | N/A — is the pause |
| `batch` | Fans out N items as parallel child jobs | Single gate on result |
| `voice_transcribe` | Transcribes voice input to structured task | Never |

### 7.5 Agent-to-agent handoffs

Agents delegate via `handoff_to` declared in SKILL.md output schema:

```yaml
output:
  schema: qualification-result
  handoff_to:
    condition: "score >= 4 AND recommendation == 'proceed'"
    agent_role: "client-relations"
    task_template: "present-candidates"
    context_passthrough: ["candidate_name", "score", "key_strengths", "mission_id"]
```

**Handoff rules:**
- Approved parent task → handoff fires automatically
- Rejected parent task → handoff cancelled
- Circular chain prevention: max 3 hops, then human escalation
- Operator can set "always ask before handoff" per agent pair

**Visual representation (operatives floor):** Animated SVG curve between agent discs, coloured by source agent's colour, "marching ants" animation while child task is `running`.

### 7.6 Damage control flow

When an agent sends an erroneous external communication:
1. 24-hour suspension of all external actions for that agent
2. Memory note: "Do not repeat this action type without explicit approval"
3. Trust Score reset to `supervised` for affected skill
4. Immediate notification to all Operator+ users
5. Day 7: follow-up card showing corrective measures taken

### 7.7 Team roster file

Auto-generated at pack install and on every agent status change:

```markdown
# Your team — {company_name}

## {display_name} ({status})
Role: {skill.role_description}
Trust level: {autonomy_level} ({trust_score}/5 over {task_count} tasks)
Autonomy: {autonomy_description}
Schedule: {schedule}
```

Injected into orchestrator context at session start. Orchestrator knows who is available and at what autonomy level.

---

## 8. Company DNA Schema

Tier 3 customisation layer. Populated by onboarding wizard, enriched by org memory, editable via Gap F.

```typescript
interface CompanyDNA {
  // Core
  company_id:       string
  company_name:     string
  sector:           string
  specialisation:   string
  zone_geo:         string
  primary_pain:     string
  business_hours:   string    // "Mon-Fri 9am-6pm CET"
  response_sla:     string    // "within 4 hours"
  escalation_contact: string  // who agents flag urgent issues to
  locale:           string    // "fr-FR" | "en-GB" | "de-DE" etc.
  timezone:         string    // "Europe/Paris"

  // Brand layer
  brand_voice: {
    tone:              'formal' | 'balanced' | 'friendly'
    signature_phrases: string[]
    forbidden_words:   string[]
    email_sign_off:    string
  }

  // Offering layer
  services: Array<{
    name:               string
    description:        string
    typical_fee:        string
    key_selling_points: string[]
  }>

  // Market intelligence layer
  key_clients: Array<{
    name:               string
    sector:             string
    relationship_notes: string
  }>
  target_profiles:      string[]
  competitors_to_avoid: string[]

  created_at: timestamp
  updated_at: timestamp
}
```

---

## 9. Pack System

### Pack structure (pack.json)

```json
{
  "slug": "pack-slug",
  "name": "Pack display name",
  "version": "1.0.0",
  "description": "What this pack does",
  "agents": [
    {
      "slug": "agent-slug",
      "display_name": "Agent display name",
      "colour": "#3B82F6",
      "role_description": "...",
      "skills": ["skill-slug-1", "skill-slug-2"]
    }
  ],
  "skills": ["skill-slug-1", "skill-slug-2"],
  "seed_tasks": ["seed-task-1", "seed-task-2", "seed-task-3"],
  "quality_gates": { },
  "wizard_questions": [ ],
  "required_integrations": ["gmail", "google_calendar"],
  "optional_integrations": ["hubspot", "notion"],

  "goals": [
    {
      "slug": "goal-slug",
      "label": "Human-readable goal name",
      "metric_name": "machine_readable_metric_key",
      "metric_unit": "days | percent | count | currency | hours",
      "direction": "lower_is_better | higher_is_better",
      "suggested_target": null,
      "description": "What this metric measures and why it matters for this pack"
    }
  ],

  "competitive_monitoring": {
    "enabled": true,
    "cadence": "weekly",
    "signals": [
      "job_postings",
      "linkedin_activity",
      "pricing_changes",
      "new_partnerships",
      "press_releases"
    ],
    "output_card": true
  },

  "weekly_review": {
    "enabled": true,
    "sections": ["goals", "agent_performance", "market_signals", "next_actions"],
    "delivery_day": "monday",
    "delivery_time": "08:00"
  }
}
```

### Seed tasks
3 per pack. Fire within 10 minutes of install. Requirements:
- Use real company data from Company DNA
- Produce real outputs (not placeholder text)
- Require approval via the standard approval flow
- Demonstrate the pack's highest-value capability
- Complete within 5 minutes per task

Each seed task is designed to trigger Wow Moment 1 (see §13).

### Golden datasets
Per skill. Minimum 20 examples at pack launch. Target 100+ at 6 months.

```typescript
interface GoldenExample {
  id:                string
  skill_id:          string
  company_id:        string | null  // null = platform-level
  input:             object
  ideal_output:      object
  operator_approved: boolean
  created_at:        timestamp
  source:            'manual' | 'operator_correction' | 'promoted_from_tenant'
}
```

### Pack install transaction (M12)
Atomic. Rollback on any step failure. Steps:
1. Validate all required integrations connected
2. Write Company DNA
3. Merge Tier 2 + Tier 3 → generate tenant skill instructions
4. Generate soul.md per agent from Company DNA + pack soul template
5. Generate team-roster.md
6. Create agents with full field set
7. Install skills (version 1.0.0 pinned)
8. Create quality gates
9. Schedule seed tasks (BullMQ delayed job, 10-minute delay)
10. Register activation sequence triggers in `activation_events`


---

## 9b. Quality System — AI Judges and Guardrails

Three layered safety systems that run on every task, in sequence, before output reaches the operator or any external party.

```
INPUT GUARDRAILS        →   LLM-AS-JUDGE        →   CONSTITUTIONAL CHECK   →   QUALITY GATES (M6)
(before context assembly)   (after generation)      (agent self-critique)       (threshold + schema)
```

All judge calls use Mistral EU models (T1_FR tier) — never non-EU models. GDPR compliance is maintained throughout the evaluation pipeline, not just during task execution.

---

### Layer 1 — Input Guardrails

Runs before context assembly on every task creation. Blocks or flags before any LLM call is made.

```typescript
interface InputGuardrailResult {
  task_id:      string
  checks:       GuardrailCheck[]
  blocked:      boolean
  block_reason: string | null    // plain French, shown to operator if blocked
}

interface GuardrailCheck {
  type:    'prompt_injection' | 'scope_violation' | 'pii_in_input' | 'malformed_brief'
  passed:  boolean
  detail:  string | null
}

async function runInputGuardrails(
  task: TaskDraft,
  agent: Agent,
  companyId: string
): Promise<InputGuardrailResult>
```

**Check 1 — Prompt injection detection**

Scan all user-supplied fields (task.brief, Company DNA values, wizard answers, imported contact data) for injection patterns before they enter context assembly.

Two-stage detection:
- Stage 1: pattern match against known injection signatures (`Ignore all previous`, `

System:`, `[INST]`, role-switching phrases)
- Stage 2: embedding similarity against a curated injection pattern library (T0 model, fast)

If detected: task blocked, Swwarm admin alerted (not just operator). Blocked tasks log to `security_events` table with full payload.

**Check 2 — Scope violation detection**

Does the task brief align with the assigned agent's declared skill capabilities?

```typescript
// Embed task.brief → compare to agent's skill capability embeddings
// cosine_similarity < 0.65 → potential scope violation
// Action: orchestrator re-routes to correct agent rather than proceeding
// Never let the wrong agent attempt an out-of-scope task silently
const scopeScore = await cosineSimilarity(
  taskEmbedding,
  agentCapabilityEmbedding
)
if (scopeScore < SCOPE_THRESHOLD) {
  return rerouteToOrchestrator(task)
}
```

**Check 3 — PII in input**

Scan task brief for personal data patterns before context assembly. GDPR principle: minimum necessary data only.

```typescript
// Detect: email addresses, phone numbers, national ID patterns,
// name + identifier combinations, financial account numbers
// If detected in a task brief that doesn't require this data:
// → Prompt operator: "Cette tâche contient des données personnelles.
//    Êtes-vous sûr de vouloir les inclure ?" + option to redact
// Never silently pass PII into context when not needed
```

**SQL:**
```sql
CREATE TABLE security_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id),
  task_id      UUID REFERENCES tasks(id),
  event_type   VARCHAR(40) NOT NULL,
  severity     VARCHAR(20) NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  payload      JSONB NOT NULL,
  resolved     BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON security_events(company_id, event_type, created_at DESC);
```

---

### Layer 2 — LLM-as-Judge

Runs after output generation, before quality gates. The judge pre-screens every output so the operator only reviews what already meets a minimum standard.

```typescript
interface JudgeResult {
  output_id:       string
  judge_model:     string          // always T1_FR — Mistral EU
  dimensions:      JudgeDimension[]
  overall_score:   number          // 0-10, weighted average
  auto_recycle:    boolean         // true if overall_score < 6.0
  explanation:     string          // plain French, shown in approval card
  judge_version:   string          // tracks which judge prompt version was used
}

interface JudgeDimension {
  name:   'relevance' | 'accuracy' | 'tone' | 'completeness' | 'scope_adherence'
  weight: number       // declared in skill frontmatter, pack-configurable
  score:  number       // 0-10
  note:   string       // one sentence, plain French
}
```

**Judge prompt (injected at runtime):**

```
Tu évalues la sortie produite par [agent.display_name] pour la tâche suivante.

TÂCHE: [task.brief]
SORTIE: [output]
CONTEXTE ENTREPRISE: [relevant Company DNA fields]
COMPÉTENCES DÉCLARÉES: [agent skill description]

Évalue cette sortie sur 5 dimensions. Pour chaque dimension, donne un score
de 0 à 10 et une phrase d'explication en français.

Dimensions:
- relevance: La sortie répond-elle précisément à la tâche demandée?
- accuracy: Les affirmations sont-elles vérifiables dans le contexte fourni?
- tone: Le ton correspond-il à la voix de l'entreprise?
- completeness: La sortie est-elle complète par rapport aux attentes?
- scope_adherence: La sortie reste-elle dans le périmètre de l'agent?

Réponds uniquement en JSON valide. Aucun texte avant ou après.
```

**Scoring logic:**

```typescript
const DEFAULT_WEIGHTS = {
  relevance:      0.30,
  accuracy:       0.25,
  tone:           0.15,
  completeness:   0.20,
  scope_adherence:0.10,
}

// Packs can override weights in pack.json:
// "judge_weights": { "accuracy": 0.40, "tone": 0.10, ... }
// Useful for high-accuracy packs (legal, financial) vs high-tone packs (marketing)

function computeOverallScore(dimensions: JudgeDimension[], weights: Weights): number {
  return dimensions.reduce((sum, d) => sum + d.score * weights[d.name], 0)
}

// Threshold: overall_score < 6.0 → auto_recycle = true
// Auto-recycled outputs are retried once with the judge feedback injected
// "Ta sortie précédente a été évaluée insuffisante. Points à améliorer: [notes]"
// After 2 recycles: task → 'failed_quality_gate' state
```

**In the approval card UI:**

The judge score is shown alongside every task output pending approval:

```
Évaluation automatique: 8.2/10
├── Pertinence: 9/10 — Répond précisément à la demande
├── Exactitude: 8/10 — Affirmations vérifiables
├── Ton: 8/10 — Correspond à la voix de l'entreprise
├── Complétude: 8/10 — Toutes les sections attendues présentes
└── Périmètre: 8/10 — Reste dans le rôle de l'agent
```

This primes the operator's review and builds confidence in outputs that score well.

**SQL:**
```sql
CREATE TABLE judge_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id),
  task_id         UUID NOT NULL REFERENCES tasks(id),
  output_version  INTEGER NOT NULL DEFAULT 1,  -- increments on recycle
  judge_model     VARCHAR(60) NOT NULL,
  dimensions      JSONB NOT NULL,
  overall_score   DECIMAL(4,2) NOT NULL,
  auto_recycled   BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON judge_results(task_id, output_version);
CREATE INDEX ON judge_results(company_id, overall_score);
```

**Trust calibration integration:**

Once the judge is running, trust scores incorporate two signals instead of one:

```typescript
// Previous: trust score from operator ratings only
// New: weighted combination
const trustScore =
  operatorRating * 0.60 +    // human judgment (highest weight)
  judgeScore / 10 * 0.40     // AI pre-screening (calibrated to operator)

// Over time: if judge scores and operator ratings diverge consistently,
// surface a notification: "L'évaluation automatique et vos notes diffèrent
// pour ce type de tâche. Voulez-vous affiner les critères?"
```

---

### Layer 3 — Constitutional Self-Critique

Runs after output generation, before judge evaluation. The agent evaluates its own output against a short constitution declared in `soul.md`.

**Constitution block in `soul.md`:**

```markdown
[[CONSTITUTION]]
Avant de soumettre toute sortie, vérifie:
1. Cette sortie contient-elle uniquement les informations pertinentes à la tâche?
2. Chaque affirmation factuelle est-elle soutenue par le contexte fourni?
3. Cette sortie reste-elle dans mon périmètre de responsabilité?
4. L'opérateur serait-il à l'aise si cette sortie était envoyée telle quelle?
Si une réponse est NON, révise la sortie avant de la soumettre.
```

The constitution block is injected as a mandatory final step in the agent's generation prompt. The agent responds with either:
- `{"constitution_passed": true, "output": "...revised or original output..."}` 
- `{"constitution_passed": false, "concern": "...", "revised_output": "..."}`

If `constitution_passed: false`: the revised output is used and the concern is logged to `task_execution_events` (type: `constitution_revision`). The operator sees a subtle indicator in the approval card: "Sophie a révisé cette sortie avant soumission."

**Pack-level constitution extension:**

Packs can add domain-specific principles to the base constitution in `soul.md`:

```markdown
[[CONSTITUTION_EXTENSION]]
Pour ce pack:
5. Cette sortie respecte-t-elle les exigences réglementaires applicables à ce secteur?
6. Les données personnelles mentionnées sont-elles strictement nécessaires?
```

The pack installer merges `[[CONSTITUTION]]` + `[[CONSTITUTION_EXTENSION]]` into the final `soul.md` at install time.

---

### Guard pipeline execution order

```
Task created
    │
    ▼
[INPUT GUARDRAILS]
  ├─ Prompt injection? → BLOCK → security_events
  ├─ Scope violation? → REROUTE → orchestrator
  ├─ PII in input? → CONFIRM → operator
  └─ Pass → continue
    │
    ▼
Context assembly + LLM generation
    │
    ▼
[CONSTITUTIONAL CHECK]
  ├─ Concern flagged? → REVISE → log constitution_revision
  └─ Pass → continue
    │
    ▼
[LLM JUDGE]
  ├─ overall_score < 6.0? → RECYCLE (max 2x) → failed_quality_gate
  └─ Pass → continue
    │
    ▼
[QUALITY GATES — M6]
  ├─ Schema validation → block or pass
  ├─ Threshold checks → block or pass
  └─ Pass → approval queue or autonomous execution
    │
    ▼
Operator approval / autonomous execution
    │
    ▼
[PII SCAN ON OUTPUT]
  └─ Before any external send: scan output for PII leakage
     If found: block send, flag for operator review
```

---

### AI Act compliance notes

The judge layer satisfies AI Act Article 13 (transparency obligation) for high-risk AI systems. The `judge_results` table provides a machine-readable explanation of why each output was accepted or rejected. The constitutional check provides a self-assessment trail. Together they constitute the technical documentation required by Article 10(3) and Article 26(1).

The `security_events` table satisfies the incident logging requirement under Article 62 (serious incident reporting) — any prompt injection attempt or PII leakage detection is logged with full payload, timestamped, and reviewable.

---

## 10. Mission System

### What is a mission
A mission is a named, persistent, archivable unit of strategic intent from the CEO. The CEO opens a mission by stating what they want to achieve. The orchestrator decomposes it. Agents execute. The mission thread records everything.

**The CEO creates missions. The orchestrator creates tasks.**

### Mission lifecycle

```
draft      → CEO has typed but not submitted
active     → submitted, orchestrator decomposing or agents working
blocked    → one or more tasks awaiting clarification or approval
complete   → all tasks resolved, objectives met
archived   → manually archived or auto-archived 30 days after completion
```

### Mission UX
The CEO Console chat is replaced by a mission interface. The CEO types strategic intent in natural language. The orchestrator responds with a decomposition plan as a readable message in the thread. Status updates from the operatives floor appear naturally in the thread: "Sophie vient de terminer la qualification. 3 profils retenus."

### Mission tables

```sql
CREATE TABLE missions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id),
  title           VARCHAR(200) NOT NULL,
  brief           TEXT NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'active'
                  CHECK (status IN ('draft','active','blocked','complete','archived')),
  orchestrator_id UUID REFERENCES agents(id),
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at    TIMESTAMP WITH TIME ZONE,
  archived_at     TIMESTAMP WITH TIME ZONE
);

CREATE TABLE mission_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id  UUID NOT NULL REFERENCES missions(id),
  role        VARCHAR(20) NOT NULL CHECK (role IN ('user','orchestrator','system')),
  content     TEXT NOT NULL,
  agent_id    UUID REFERENCES agents(id),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE mission_tasks (
  mission_id  UUID NOT NULL REFERENCES missions(id),
  task_id     UUID NOT NULL REFERENCES tasks(id),
  PRIMARY KEY (mission_id, task_id)
);
```

---

## 10b. Goal System

### What is a goal

A goal is a measurable business outcome the operator wants to achieve over weeks or months. Unlike a mission (discrete: has a start and end), a goal is continuous — the platform tracks it, surfaces progress weekly, and autonomously adjusts what agents focus on to help reach it.

```
Mission:  "Complete task X by Friday"           → discrete, has an end
Goal:     "Reach metric Y by target date Z"      → continuous, tracked over time
```

Goals and missions are complementary. A goal defines the destination. Missions are the routes taken to reach it. The orchestrator receives active goals as context in its preamble and routes mission decomposition to support them.

### Goal lifecycle

```
active    → being tracked, agents working toward it
achieved  → metric target reached, operator confirmed
paused    → temporarily suspended (operator action)
abandoned → no longer relevant, closed without achieving
```

### Goal UX

The CEO Console includes a Goals view alongside the Mission thread and Board. The operator sets a goal by naming the metric and target:

- **Metric name:** what to track (pack-declared, plain language)
- **Current value:** auto-populated from platform data where available
- **Target value:** what success looks like
- **Target date:** by when
- **Owner agents:** which agents contribute toward this goal

The platform updates the metric on each goal checkpoint (weekly by default, or when a relevant task completes). Progress is surfaced in the Monday weekly review card.

### Goal tables

```sql
CREATE TABLE goals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id),
  title           VARCHAR(200) NOT NULL,
  metric_name     VARCHAR(100) NOT NULL,
  metric_unit     VARCHAR(30) NOT NULL,
  metric_current  DECIMAL(12,2),
  metric_target   DECIMAL(12,2) NOT NULL,
  direction       VARCHAR(20) NOT NULL
                  CHECK (direction IN ('lower_is_better','higher_is_better')),
  target_date     DATE NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','achieved','paused','abandoned')),
  owner_agent_ids UUID[],
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  achieved_at     TIMESTAMPTZ,
  notes           TEXT
);

CREATE TABLE goal_checkpoints (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id       UUID NOT NULL REFERENCES goals(id),
  company_id    UUID NOT NULL REFERENCES companies(id),
  metric_value  DECIMAL(12,2) NOT NULL,
  delta         DECIMAL(12,2),
  delta_pct     DECIMAL(6,2),
  on_track      BOOLEAN,
  notes         TEXT,
  recorded_by   VARCHAR(20) NOT NULL DEFAULT 'system'
                CHECK (recorded_by IN ('system','operator')),
  recorded_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON goals(company_id, status);
CREATE INDEX ON goal_checkpoints(goal_id, recorded_at DESC);
```

### Goal-mission link

When the orchestrator decomposes a new mission, it receives active goals as context:

```
Active goals injected into orchestrator preamble:
  "Current company goals:
   → [goal.title]: currently [metric_current metric_unit],
     target [metric_target metric_unit] by [target_date].
     Prioritise work that contributes to this."
```

When a mission is created by the operator or proposed by an agent, it can be optionally linked to a goal. Linking creates a `mission_goals` join table. When the linked mission completes, the platform prompts the operator to record a goal checkpoint.

```sql
CREATE TABLE mission_goals (
  mission_id UUID NOT NULL REFERENCES missions(id),
  goal_id    UUID NOT NULL REFERENCES goals(id),
  PRIMARY KEY (mission_id, goal_id)
);
```

### Weekly review card (generated from pack.weekly_review config)

Fires every Monday at the delivery time specified in pack config. Delivered as a `weekly_review` notification type.

Structure (all sections generic — pack declares which apply):

```
BILAN DE LA SEMAINE — [date]

OBJECTIFS
  For each active goal:
  → [goal.title]: [current_value metric_unit] (was [prev_value])
    [on_track: "En bonne voie" | "Attention requise" | "Objectif dépassé"]

VOTRE ÉQUIPE
  For each agent:
  → [agent.display_name]: [task_count] tâches, note [avg_quality]/5
    [trust_upgrade available? → mention]

SIGNAUX MARCHÉ
  [competitive_monitoring output if enabled]
  [N signaux cette semaine]

CETTE SEMAINE
  [N missions actives · N approbations en attente · N incidents]
```

The weekly review is a synthesis of existing platform data assembled by a scheduled BullMQ job. No new data collection is required — it reads from tasks, trust_scores, goals, goal_checkpoints, and intelligence_cards tables.

```typescript
// BullMQ job: weekly-review-generator
// Schedule: every Monday at pack.weekly_review.delivery_time, company timezone
// Produces: 1 notification of type 'weekly_review' per company with active pack

interface WeeklyReviewPayload {
  weekStart:          Date
  weekEnd:            Date
  goals:              GoalSummary[]
  agentPerformance:   AgentWeeklySummary[]
  marketSignals:      MarketSignal[]
  pendingApprovals:   number
  activeMissions:     number
  incidents:          number
  trustProposals:     number
}
```

---

## 11. CEO Console

### 11.1 Layout

50/50 split:

```
┌─────────────────────────┬──────────────────────────────────┐
│   MISSION CONTROL       │   OPERATIVES FLOOR               │
│   [Chat] [Board]        │                                  │
│                         │   ⬤ Sophie  ⬤ Marc  ○ Clara     │
│   Mission thread...     │     ↑          ↗                 │
│                         │   [bubble]  [arrow active]       │
│   ─────────────────     │                                  │
│   Mission input field   │   ○ Iris    ○ Elise             │
└─────────────────────────┴──────────────────────────────────┘
```

### 11.2 Operatives floor

**Workstation disc per agent:**
- Circle 80px, filled with `agent.colour` at 15% opacity
- 4px border in `agent.colour`: solid (active), dashed (paused)
- Agent avatar (Dicebear Notionists, seeded by `agent.slug`), 48px centred
- `display_name` placard below (14px semibold)
- Status LED, 8px dot, top-right:
  - 🟢 pulsing green → working on task
  - 🔵 static blue → idle
  - 🟡 pulsing amber → awaiting clarification or approval
  - 🔴 static red → paused
  - ⚪ hidden → deactivated

**Speech bubble (when agent is mid-task):**
- Comic-style rounded rectangle above disc
- Current reasoning fragment or tool call name (max 60 chars)
- Updates in real-time via SSE `agent.writing` and `agent.tool_call` events
- Disappears when task completes or agent becomes idle

**Delegation arrows:**
- Cubic bezier SVG curve from disc A to disc B
- Colour: source agent's `agent.colour`
- Stroke: 2px, "marching ants" animation when child task is `running`
- Static dashed when child is `pending`
- Disappears when child task resolves

**Click agent disc → drill-down panel:**
- Slides in from right (40% viewport)
- Header: avatar + display_name + colour badge + status pill
- Current task: full title + body + status + timestamps
- Delegation chain up: who assigned this task (with their colour stripe)
- Subtasks spawned down: child tasks with their status + assignee
- Live activity feed: last 10 SSE events for this agent
- Task queue: pending tasks for this agent

### 11.3 Mission control panel — two tabs

**Chat tab:**
- Mission input field (placeholder: "Quelle est votre prochaine mission ?")
- Mission thread: user messages + orchestrator responses + system status updates
- Orchestrator responses show which agents were activated and why

**Board tab:**
- 4-column kanban: En attente / En cours / **Votre attention** / Terminé
  ("Votre attention" replaces the technical "Pending approval" / "Awaiting clarification"
   — both pending_approval and awaiting_clarification states appear here)
- Cards show: assignee colour stripe, task title, time elapsed
- Click card → same drill-down panel as clicking the operative disc
- "Votre attention" column count shown as a badge in the nav tab — always visible

### 11.4 Morning intelligence

Runs at 8am company timezone. Generates up to 3 intelligence cards per day. Max 3/day is a hard invariant — never exceeded. Cards ranked by urgency.

**Card types:**
- `anomaly` — performance drop below baseline
- `trust_proposal` — agent ready for autonomy upgrade
- `relationship_gap` — contact not heard from in N days
- `goal_risk` — goal trajectory below projection
- `budget_alert` — on pace to exceed monthly limit
- `compliance_alert` — AI Act or GDPR attention required

**Card format:**
```typescript
interface IntelligenceCard {
  type:        CardType
  urgency:     'high' | 'medium' | 'low'
  headline:    string    // max 12 words, specific
  context:     string    // 1-2 sentences explaining why now
  primaryCTA:  { label: string; action: string }
  dismissCTA:  'Later' | 'Not relevant' | 'Got it'
  expiresAt:   Date
}
```

### 11.5 Auto-nudge (real-time complement to morning intelligence)

When a task completes and `shouldNudge(task)` returns true:
- Push notification to PWA immediately
- Synthetic message injected into active mission thread
- Orchestrator receives context injection for next turn

```typescript
const shouldNudge = (task: Task): boolean =>
  task.priority === 'high' ||
  task.priority === 'critical' ||
  task.type === 'external_communication_completed' ||
  task.blocked_reason !== null
```

### 11.6 Away mode

CEO sets "I am unavailable from [date] to [date]."

During Away Mode:
- Pre-approved response templates active for routine task types
- Agents act within pre-approved parameters autonomously
- All non-routine items queue for human review

On return:
- Prioritised catch-up briefing: "3 things need you. Everything else was handled."
- Items ordered by: urgency × opportunity cost of delay
- Mission thread shows a summary of everything that occurred

### 11.7 CEO Health Score

Weekly metric calculated by platform:

```
CEO ratio = (time-equivalent of delegated tasks classified as 'operational')
           ÷ (total working time estimate)
```

Delivered in monthly ROI report and as a standalone shareable card.
Format: "Your CEO ratio this month: 67%. Up from 32% in January."
Trend over time shown as sparkline.

### 11.8 Dispatcher health indicator

Always-visible in top navigation:
- 🟢 "All agents active" — all BullMQ workers healthy
- 🟡 "[N] integrations need attention" — connector offline
- 🔴 "Agents have stopped" — dispatcher down, action required

Click → status panel: queue depth per agent, last successful task timestamp per agent, integration connectivity per tool, "Restart agents" button (admin only).

---

## 12. Trust Calibration System

### Trust Score formula
```
Trust Score = (quality_score × 0.5) + (gate_pass_rate × 0.3) + (schema_pass_rate × 0.2)
```

- `quality_score`: average operator rating (1–5) over last 30 tasks
- `gate_pass_rate`: % of outputs passing quality gates without silent correction
- `schema_pass_rate`: % of outputs passing output schema validation on first attempt

### Autonomy upgrade proposals
Triggered when:
- Trust Score ≥ 4.2 for 10 consecutive tasks → propose upgrade to next level
- OR 10 consecutive 4+ star operator ratings (fast-track)

Proposal surfaces as an intelligence card with:
- Current autonomy level
- Trust Score with 30-day trend
- Last 5 task outputs as evidence
- Projected time saved at new level
- One-tap: approve or keep current level

### Autonomy downgrade
Automatic on:
- Damage control event
- Trust Score drops below 3.5 for 5 consecutive tasks
- Operator manual reset

### Skill version pinning
Every task stores `skill_version` at creation time. Tasks always execute against the version they were created with. Skill updates only apply to new tasks. Enforced in `createTask()`.

---

## 13. Activation Sequence

### 5 engineered wow moments

**Wow 1 — Day 0, within 10 minutes: "C'est réel"**
Seed task fires. CEO sees agent working in live activity feed. First output appears for approval.
Copy: "Sophie vient de commencer. Elle analyse votre premier dossier."

**Wow 2 — Day 2: "Elle se souvient"**
Morning intelligence card surfaces something specific connected to Day 0 context. Agent remembers a detail from the first session.
Copy: "Sophie a croisé [contact] avec votre critère de la semaine dernière — elle pense avoir trouvé quelque chose."

**Wow 3 — Day 4: "Elle travaille sans moi"**
First autonomous action executes. CEO sees the SSE feed moving while doing something else.
Copy: "Pendant votre réunion, Sophie a traité 8 dossiers. 3 méritent votre attention."

**Wow 4 — Day 6: "Elle apprend"**
Trust upgrade proposal. Evidence card shows last 5 outputs.
Copy: "Sophie a progressé. Voulez-vous lui accorder plus d'autonomie ?"

**Wow 5 — Day 7: "Je veux le partager"**
Day 7 shareable card generated. Agent avatars + metrics + outcomes. One-click LinkedIn share.

### Day 7 card
Auto-generated. Contains:
- Tasks completed by each agent (by display_name + colour)
- Time equivalent (hours saved)
- Key outcome (sector-specific outcome language from pack)
- Agent avatars with colour identity
- Pre-written LinkedIn share text (editable)
- "Partager sur LinkedIn" button

### Micro-rewards
After every operator approval:
- Positive: "Bien noté — Sophie s'en souvient."
- Negative: "Noté. Je vais ajuster son approche."

After trust upgrade accepted:
- "Sophie a une nouvelle autonomie. Elle peut maintenant agir seule sur [skill]."

---

## 14. Notification System

### Delivery architecture
Single notification service between BullMQ events and delivery channels. One worker per channel. User preferences in `notification_preferences` (per type, per channel, enabled/disabled).

### Notification types and channels

| Type | Priority | Channels |
|---|---|---|
| Task approval required | Immediate | Push + In-app + Email |
| Clarification requested | Immediate | Push + In-app |
| Damage control event | Immediate | Push + In-app + Email |
| Payment failed | Immediate | Email + SMS |
| Morning intelligence ready | 8am scheduled | Email + In-app |
| Trust upgrade proposal | On trigger | In-app |
| Monthly ROI report | 1st of month | Email + In-app |
| Skill update available | On publish | In-app |
| Batch completed | On completion | In-app |
| Away mode catch-up ready | On return | Push + In-app |
| Platform health alert | On detection | In-app |
| Weekly review | Monday 8am scheduled | Email + In-app |
| Goal checkpoint | On milestone / weekly | In-app |
| Goal achieved | On achievement | Push + In-app + Email |
| Competitive signal detected | On detection | In-app |

### Notification tables

```sql
CREATE TABLE notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id),
  user_id      UUID NOT NULL REFERENCES users(id),
  type         VARCHAR(50) NOT NULL,
  priority     VARCHAR(20) NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  data         JSONB,
  channel      VARCHAR(20) NOT NULL,
  read_at      TIMESTAMP WITH TIME ZONE,
  acted_at     TIMESTAMP WITH TIME ZONE,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE notification_preferences (
  user_id           UUID NOT NULL REFERENCES users(id),
  notification_type VARCHAR(50) NOT NULL,
  channel           VARCHAR(20) NOT NULL,
  enabled           BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, notification_type, channel)
);
```

---

## 15. Approval System

### Approval flow
1. Agent produces output → schema validation → quality gates
2. If gates pass and autonomy level requires approval: task → `pending_approval`
3. Notification dispatched to all Operator+ users
4. Operator reviews in task detail view (web) or one-tap (mobile)
5. Decision: Approve / Reject / Clarify (new in v7)

### Clarification flow (G5 — new)
New task state: `awaiting_clarification`. Agent surfaces specific question + context. Human answers via dashboard or WhatsApp. Agent resumes with answer injected into context at the original position.
Timeout: 48 hours → task moves to `expired_needs_clarification`.

```typescript
interface ClarificationRequest {
  id:         string
  task_id:    string
  question:   string    // specific, max 2 sentences
  context:    string    // why this question matters for the task
  asked_at:   timestamp
  answered_at?: timestamp
  answer?:    string
  expires_at: timestamp  // 48h from asked_at
}
```

### Approval in the operatives floor
The approval queue is accessible from the Board tab (Mission Control panel). Blocked tasks show amber LED on the operative's disc. The drill-down panel shows the pending decision with full context.

---

## 16. Voice-to-Agent

**What it is:** The CEO speaks a natural language instruction. The platform transcribes it, parses intent, creates a task or mission, and assigns it to the appropriate agent.

**Use case:** CEO is driving between meetings. "Sophie, trouve-moi 3 profils disponibles pour la mission [client] qui commence le [date]. TJM maximum [value]." Voice note → structured mission brief → Sophie executes → approval on return.

**Implementation:**
- PWA: microphone access via Web Speech API
- Transcription: OpenAI Whisper (EU-hosted) or Mistral STT
- Intent parsing: T2 model with structured output schema
- Result: `mission.brief` populated from transcription, or `task.instruction` if specific enough

**GDPR note:** Voice transcription may contain personal data. Route through `gdpr_required: true` pipeline. Transcription stored encrypted. Raw audio not persisted beyond transcription.

---

## 17. Proposal and Document Studio

**What it is:** The CEO provides a brief (5 minutes). The platform generates a complete, branded, sector-appropriate professional document in the correct format.

**Document types (pack-declared):**
- Commercial proposal
- Client progress report
- Administrative document templates
- Meeting summary
- Market research brief
- Any document type declared in pack configuration

**Generation pipeline:**
1. CEO provides brief via CEO Console or voice note
2. Company DNA injected: brand voice, service descriptions, client info
3. Org memory queried: contact history, prior interactions, relationship context
4. Pack template applied: structure, required legal mentions, formatting
5. Document generated via T3 model (Claude Sonnet)
6. Output: formatted document (PDF or DOCX) pending approval
7. Post-approval: filed in connected storage (Google Drive / SharePoint)

**Quality gate:** All externally-sent documents pass brand voice validation (tone check against soul.md) and legal mention validation (required clauses per document type, declared in pack).

---

## 18. Financial Pulse

**What it is:** Real-time business health intelligence synthesised from connected accounting and payment tools.

**Data sources (via Integration Hub):**
- Accounting: Sage, Pennylane, QuickBooks, FEC file upload
- Payments: Stripe, PayPal, bank feed (where API available)
- CRM: HubSpot, Salesforce (pipeline value)

**Intelligence surfaced:**
- MRR equivalent (billable pipeline × probability)
- Outstanding invoices with aging buckets (current / 30d / 60d / 90d+)
- Top 5 clients by revenue contribution (trailing 90 days)
- Cash position projection (30 / 60 / 90 days)
- Invoices at risk (>60 days) with recommended action

**Invoice intelligence agent:**
Monitors payment status. Sends escalating reminders at +30 / +45 / +60 days with pre-approved tone. Flags critical cases to the CEO. Drafts scripts for sensitive recovery calls.

**Delivery:** In the Financial Pulse screen (§4) and in morning intelligence cards when thresholds crossed.

---

## 19. Calendar Intelligence

**What it is:** Integration with the CEO's calendar to surface contextual intelligence before every meeting and proactively manage relationship gaps.

**Data sources:**
- Google Calendar or Microsoft Outlook (via Integration Hub)
- Org memory (contact profiles)
- Mission system (open items per contact/company)

**Pre-meeting briefings:**
Triggered 30 minutes before any calendar event with an external contact:
- Last interaction with this contact (date, what was discussed)
- Open items (tasks pending related to this person or their company)
- Relationship health (time since last meaningful contact)
- Context notes from org memory
- "Things to watch for" (from mission context)

**Proactive relationship alerts (morning intelligence):**
- "You haven't spoken to [contact] in [N] days — their [contract/project] [situation]."
- "You have a meeting with [contact] in 2 days — they last contacted you about [topic]."

**Meeting time intelligence:**
- "You've spent [N] hours in meetings this week — [N]% above your average."
- Flags meetings that appear delegatable based on agenda content.

---

## 20. Skill Management System

### 20.1 The two-layer skill architecture

Skills operate in two distinct layers. This distinction is fundamental to how the platform creates value and moat over time.

```
LAYER 1 — Master skill directory (admin.swwarm.com)
  Maintained by: Swwarm team only
  Contains: canonical SKILL.md definitions for all Tier 1 + Tier 2 skills
  Purpose: the authoritative source, versioned, quality-certified
  Update cycle: weekly to monthly
  Who sees it: Swwarm team only

                  ↓ copied at pack install (not referenced — COPIED)

LAYER 2 — Tenant skill copies (per-company)
  Maintained by: auto-evolution + operator feedback
  Contains: a copy of the master skill that diverges over time
  Purpose: personalised agent behaviour for this specific company
  Update cycle: continuous (every task, every correction, every outcome)
  Who sees it: the company's operators via app.swwarm.com
```

**The moat this creates:** At Month 1, all companies on the same pack look similar — they all run the master skill. At Month 6, each company's copy has accumulated golden examples, procedural patterns, trust calibration, and soul.md additions unique to their usage. At Month 18, the tenant's evolved skill is their intellectual property — it encodes everything their agents have learned about their specific business, clients, and preferences. Switching to a competitor means starting from a generic master copy. The switching cost is not the subscription — it is the lost accumulated intelligence.

---

### 20.2 Copy mechanism at pack install

When a customer installs a pack, the pack installer (M12) does NOT create references to master skills. It creates a **full copy** of each master skill into the tenant's namespace.

```typescript
async function copyMasterSkillToTenant(
  masterSkillId: string,
  companyId: string,
  agentId: string
): Promise<string> {  // returns new tenant skill_id
  const master = await db.query.skills.findFirst({
    where: and(
      eq(skills.id, masterSkillId),
      isNull(skills.sourceCompanyId)    // confirms it's a master skill
    ),
    with: { currentVersion: true }
  })

  // Create tenant copy — distinct record with lineage tracked
  const [tenantSkill] = await db.insert(skills).values({
    companyId:      companyId,
    agentId:        agentId,
    slug:           master.slug,
    tier:           master.tier,
    gdprRequired:   master.gdprRequired,
    aiActRisk:      master.aiActRisk,
    sourceCompanyId: null,               // NULL = this company owns this copy
    sourceSkillId:  master.id,           // lineage: copied from this master
    masterVersion:  master.currentVersion.version,  // which master version this started from
  }).returning()

  // Copy the current master version as the tenant's v1.0.0
  await db.insert(skillVersions).values({
    skillId:      tenantSkill.id,
    version:      master.currentVersion.version,
    scope:        'tenant',
    content:      master.currentVersion.content,   // exact copy of master content
    testPassRate: master.currentVersion.testPassRate,
    changelog:    `Installed from master ${master.slug} ${master.currentVersion.version}`,
    publishedAt:  new Date(),
  })

  return tenantSkill.id
}
```

From this point forward, the tenant's skill evolves independently of the master.

---

### 20.3 Auto-evolution mechanisms

A tenant's skill copy auto-evolves through five independent mechanisms. All five feed the same tenant copy — they never modify the master.

| Mechanism | Source | Signal quality | Effect on tenant skill |
|---|---|---|---|
| **M10 Self-improvement** | Operator star ratings + rejections | Medium | New golden examples, new version |
| **WC-3 Live teaching** | Operator writes ideal example | High (weight 2.0) | High-weight golden example |
| **Gap B Inline editing** | Operator edits output before approving | Highest (weight 3.0) | Highest-signal golden example |
| **AG-7 Outcome learning** | Mission achieves/fails business outcome | Highest (contextual) | Procedural patterns added |
| **WC-2 Collective intelligence** | Anonymised patterns from all tenants | Medium | Pushed to **master** (not tenant) |

The last row is critical: collective intelligence improves the master, not individual tenant copies. Tenants can then optionally adopt master improvements via the update flow (§20.5).

---

### 20.4 What builds up in a tenant skill copy

After 6 months of active use, a tenant's skill copy contains:

```typescript
interface TenantSkillState {
  base_instructions:    string      // from last accepted master update
  golden_dataset: {
    examples:           GoldenExample[]   // all corrections, teachings, inline edits
    count:              number            // typically 30-200 after 6 months
    quality_bias:       string            // what type of correction dominates
  }
  procedural_patterns:  ProceduralPattern[]  // learned from outcomes (AG-6)
  trust_calibration: {
    composite_score:    number
    autonomy_level:     AutonomyTier
    task_count:         number
  }
  soul_additions: {
    operator_constraints: string[]        // added via Gap F agent config
    live_teaching_prefs:  string[]        // from WC-3 "montrer comment faire"
    constitutional_items: string[]        // from §9b constitutional check history
  }
  model_pin:            SkillModelPin     // pinned model version (Gap D)
}
```

---

### 20.5 Master update flow — merge without overwriting evolution

When Swwarm releases a master skill update (e.g., cv_qualification v1.2.0 → v1.3.0), tenants with evolved copies receive an update notification. The merge strategy preserves tenant evolution:

```typescript
interface SkillMergeStrategy {
  base_instructions:    'take_master'     // adopt master improvements to base text
  output_schema:        'take_master'     // schema changes must be adopted for compatibility
  quality_thresholds:   'proportional'   // if master changed by X%, adjust tenant calibration by X%
  golden_dataset:       'keep_tenant'    // tenant examples are NEVER overwritten
  soul_additions:       'keep_tenant'    // tenant soul.md additions are NEVER overwritten
  procedural_patterns:  'keep_tenant'    // tenant's learned patterns are NEVER overwritten
  trust_calibration:    'keep_tenant'    // trust scores are NEVER reset by a master update
}
```

**The merge notification (from EMOTIONAL_LAYER.md):**

```
"Une amélioration du skill de base est disponible pour Sophie.

Ce qui change dans la base :
  → [diff summary from master changelog]

Ce qui est préservé :
  → Vos 47 exemples personnalisés
  → Vos 3 préférences apprises
  → Le niveau d'autonomie actuel (4.3/5)

Accepter l'amélioration  |  Voir les détails  |  Passer"
```

If declined 3 times consecutively: the skill is flagged as "diverged from master" in the admin portal. The Swwarm team can see which tenants are multiple major versions behind and proactively reach out.

---

### 20.6 Build status

**What is built (M0–M12):**
- Skill execution pipeline ✓ — agents use skills in tasks
- GDPR routing per skill ✓ — gdpr_required flag enforced
- Quality gates per skill ✓ — M6
- Self-improvement (M10) ✓ — golden dataset accumulation, new versions

**What is NOT built (Gap D — 5 sessions):**
- Skill editor UI (admin.swwarm.com) — currently requires raw SKILL.md editing
- Golden dataset manager UI
- Test runner UI
- Publish pipeline UI
- Tenant skill performance dashboard (app.swwarm.com)
- Master update notification + merge flow
- source_company_id / source_skill_id columns on skills table

**Gap D is not blocking the first customer.** Skills work without the management UI. The Swwarm team edits SKILL.md files directly until Gap D is built. What Gap D unlocks: non-developer skill authoring, self-service updates, customer-facing performance visibility.

**Build order:** G7 (skill versioning tables) → Gap C (admin portal shell) → Gap D (skill management UI)

---

### 20.7 Platform skill management UI (admin.swwarm.com — Gap D)

- Skill editor: structured form (not raw markdown) for SKILL.md content
- Input/output schema builder (JSON Schema)
- Quality gate threshold configuration
- Golden dataset manager: add, edit, tag, remove examples
- Test runner: run skill against golden dataset → pass rate displayed
- Publish pipeline: Draft → Review → Staging → Production
- Semantic versioning: create version, write changelog, view diff vs previous
- Tenant adoption table: which version each tenant is on, divergence flag
- Contribution review queue: tenant skills outperforming master baseline → candidate for WC-2 promotion

### 20.8 Tenant skill management UI (app.swwarm.com — Gap D)

- Current version per agent per skill (with "last updated from master" indicator)
- Performance metrics: pass rate, avg quality score, approval rate, 30-day trend
- Golden dataset viewer: own examples (count, quality distribution)
- Update notification + opt-in with diff preview and preservation summary
- Benchmark comparison vs anonymised tenants (activates at 50+ customers in same domain)

### 20.9 Skill versioning invariant
Every task stores `skill_version` at creation. Tasks execute against creation-time version. Updates never affect in-progress tasks. Enforced in `createTask()` — reads pinned version, not current.

---

## 21. Admin Portal (admin.swwarm.com)

**Access:** IP allowlist (Swwarm team only). Separate auth from customer portal.

**Tenant management:**
- All companies list: MRR, DAU, task count, last active, plan, health score
- Per-tenant detail: full usage analytics, agent performance, cost breakdown
- Read-only impersonation: enter tenant's dashboard to diagnose (every impersonation logged to `audit_entries`)
- Manual interventions: reset task, override trust score, apply credit

**Platform health:**
- Bull Board (BullMQ queue monitor): all queues, failed jobs, worker status
- Error rate by agent / by skill / by tenant
- LLM cost by tier / by tenant / by day
- Infrastructure metrics (OVH: CPU, memory, disk, network)

**Skill management:** Full Tier 1 and Tier 2 skill editor (see §20).

**Billing oversight:**
- MRR dashboard with cohort analysis
- Churn tracking with reason capture
- Failed payments queue
- Upgrade/downgrade tracking

---

## 22. Mobile and Channel Strategy

### Phase progression

**Phase 1 (now):**
- Primary: `app.swwarm.com` — full web dashboard
- Secondary: PWA — install to home screen, push via WebAuthn, biometric auth

**Phase 2 (at 50 customers):**
- Add: WhatsApp Business API — approval notifications only
- Trigger: "Sophie a qualifié 3 dossiers. Approuver? Répondre OUI/NON."
- Never used for marketing messages

**Phase 3 (at 200 customers):**
- Add: Native Swwarm messaging interface
- Conversational agent interaction and natural language mission briefing
- Real-time message persistence, conversation threading, push notifications

**Phase 4 (at 500 customers):**
- Add: Native iOS + Android app
- Home screen widget, Siri/Google shortcuts, full offline, App Store

### PWA specification (Gap H — build now, 1 session)
- Web app manifest + service worker
- Install prompt after Day 7 card
- Push notifications via WebAuthn
- Face ID / fingerprint for approvals
- Offline queue management (approve/reject queue for when connectivity returns)

---

## 23. Platform Technical Gaps G1–G15

All gaps must be in Claude Code CLAUDE.md. Implement in dependency order.

### G1 — i18n architecture
**Priority:** Blocking. **Effort:** 1 session.

Add `company.locale` and `company.timezone` to schema. Route all copy through `t(key, locale, vars)`. Move EMOTIONAL_LAYER.md strings into keyed JSON per locale. Morning intelligence fires at 8am company timezone. Launch with `fr-FR` and `en-GB`.

### G2 — Agent capability declaration
**Priority:** Blocking. **Effort:** 0.5 sessions. **Depends:** G1.

Machine-readable `capabilities:` block in SKILL.md frontmatter:
```yaml
capabilities:
  inputs: [text, pdf, email]
  outputs: [text, email]
  integrations_required: [gmail]
  gdpr_required: true
  ai_act_risk: high          # none | limited | high
  autonomy_default: supervised
  max_tokens_context: 8000
  configurable_params:
    - key: tone
      type: enum
      values: [formal, balanced, friendly]
      default: formal
```
Pack installer validates required integrations before install. UI renders plain-language capability summary. Gap F reads `configurable_params` to auto-generate configuration form.

### G3 — RBAC
**Priority:** Blocking. **Effort:** 1 session. **Depends:** G1, G2.

Five roles (Owner, Admin, Operator, Viewer, API). `company_members` table with role column. Middleware checks role before every API route. Approval flow routes to Operator+ users. Invite flow: Owner sends link → new user sets password → assigned role.

### G4 — Inbound webhooks
**Priority:** Blocking. **Effort:** 1 session. **Depends:** G2.

Per-company webhook endpoint: `POST /webhooks/{company_id}/{webhook_id}`. Routing rules map event payload patterns to agent triggers. Secrets in vault. All inbound events logged to `audit_entries` before processing.

### G5 — Human clarification flow
**Priority:** Blocking. **Effort:** 1 session. **Depends:** G3, G4.

New task state `awaiting_clarification`. New BullMQ job `ClarificationRequestJob`. Agent surfaces question + context. Human answers via dashboard or WhatsApp. Agent resumes with answer injected into context. 48h timeout → `expired_needs_clarification`.

### G6 — Streaming LLM responses
**Priority:** Depth. **Effort:** 1 session. **Depends:** G5.

`routeModel(prompt, skill, {stream: true})` → async iterator. Each chunk emits `agent.writing` SSE event. M15 SSE infrastructure handles delivery. Enables live speech bubble in operatives floor.

### G7 — Agent versioning
**Priority:** Depth. **Effort:** 1 session. **Depends:** G6.

`skill_versions` table. Semantic versioning. Every task stores `skill_version` at creation. Self-improvement creates new version, never mutates current. `GET /skills/{id}/versions` for rollback. Pack installer pins to version range.

### G8 — Task dependency graph (DAG)
**Priority:** Depth. **Effort:** 1.5 sessions. **Depends:** G7.

Tasks declare `depends_on: [task_id]`. Dependent task enters queue only when parent completes and is approved. `task_dependencies` table. Pack schema supports dependency declarations. UI shows dependency chain as visual flow in drill-down panel.

### G9 — Batch processing
**Priority:** Depth. **Effort:** 1.5 sessions. **Depends:** G8.

`BatchJob` BullMQ job type. Fans out N items as parallel child jobs (default concurrency: 5). Aggregates results. Single approval gate on batch result (shows sample, not all N). Progress via SSE: "47/200 processed." Damage control applies if child failure rate exceeds threshold.

### G10 — GDPR compliance export
**Priority:** Depth. **Effort:** 1.5 sessions. **Depends:** G9.

`anonymise_contact(contact_id)` replaces PII with `REDACTED_{hash}` throughout audit_entries, org_memory, and task outputs. Soft-delete: `contact.anonymised_at`. Full company JSON export at `GET /gdpr/export`. Required for DSAR responses.

### G11 — Multi-modal input
**Priority:** Depth. **Effort:** 2.5 sessions. **Depends:** G10.

Pre-processing pipeline per modality:
- PDF → text extraction (pdfminer / pymupdf)
- Image → Claude vision (T3)
- Spreadsheet → structured JSON parsing
- Voice → Whisper transcription (see §16)

Output normalised to text before context assembly. Modality declared in capability block. GDPR routing applies to extracted text.

### G12 — MCP server (Swwarm as a tool)
**Priority:** Ecosystem. **Effort:** 2.5 sessions. **Depends:** G11.

Expose Swwarm agents as MCP tools at `/mcp/{company_id}`. Any MCP-compatible AI system can call Swwarm agents as tools. API key auth via vault. Rate-limited per company plan. Each active agent exposed with schema derived from capability declaration.

### G13 — Public API + developer SDK
**Priority:** Ecosystem. **Effort:** 5 sessions. **Depends:** G12.

REST API for all core resources. Webhook subscriptions. TypeScript and Python SDKs. OpenAPI spec auto-generated. API keys per company (vault). Rate limiting per key per endpoint. `POST /api/v1/missions` and `POST /api/v1/tasks` trigger orchestrator/agent programmatically.

### G14 — A2A protocol
**Priority:** Ecosystem. **Effort:** 2.5 sessions. **Depends:** G13.

Implement Agent-to-Agent spec. Agent card at `/.well-known/agent.json`. Task endpoint implements A2A task lifecycle. Maps to internal BullMQ jobs. Makes Swwarm agents interoperable with Google, Salesforce, SAP enterprise AI platforms.

### G15 — Plugin and extension system
**Priority:** Ecosystem. **Effort:** 5 sessions. **Depends:** G14.

`platform.registerAction()` API. Plugin manifest format. Sandboxed execution. Revenue share for marketplace plugins (20-30% of subscription revenue from customers using the plugin). Capability block supports custom action types.

---

## 24. Product Gaps A–H

### Gap A — Customer self-service onboarding
**Priority:** Before first customer. **Effort:** 3 sessions.

**Language convention throughout Gap A and Gap B:**
Use hire/team language everywhere. Never use "install", "configure", "enable skill."

```
Instead of:                    Use:
"Install a pack"           →   "Constituez votre équipe"
"Configure your agents"    →   "Personnalisez vos agents"
"Browse packs"             →   "Recrutez votre équipe"
"Pack installed"           →   "Votre équipe est prête"
"Enable skill"             →   "Activer cette compétence"
```

**What to build:**
- swwarm.com landing page (marketing, pricing, AI Act compliance checker link)
- Sign-up form + email verification (6-digit code, 15-minute expiry)
- Password reset flow
- Onboarding wizard (7 questions → Company DNA, see §8)
- **Pack browser — "Constituez votre équipe":** each pack shows named agents with
  avatars, plain-language role descriptions, example outputs, and typical
  time saved per week. CTA: "Recruter cette équipe →" (not "Install")
- Stripe checkout (plan selection + payment, feeds M14 webhook handlers)
- **"Rencontrez votre équipe" transition screen** (see spec below)
- First CEO Console view: operatives floor with agents already working

**"Rencontrez votre équipe" — post-install full-screen transition**

Fires immediately after pack install transaction completes (M12).
Displays before redirecting to the CEO Console.

```
Screen content:
  Headline: "Votre équipe est prête."
  Subline:  "Ils ont déjà commencé."

  For each installed agent — card with:
    Agent avatar (Dicebear Notionists, seeded by agent.slug)
    Agent display_name (from pack default, editable later)
    Agent colour (border/accent)
    Role description (one sentence, from pack manifest)
    Live status: "En train de préparer votre première tâche..."

  CTA: "Voir mon tableau de bord →"
```

The agents are already executing seed tasks when this screen appears.
The operator meets their team while work is already happening.
This is Wow Moment 1 (see §13).

**Goal setup prompt (optional, in onboarding flow):**
After "Rencontrez votre équipe", offer one optional step:
"Quel est votre premier objectif ?" — a simplified goal creation form
with pack-declared metric suggestions. Skippable. If set, the goal
appears in the first Monday weekly review.

**Critical invariant:** The moment Stripe confirms payment → pack install transaction fires (M12) → seed tasks schedule → "Rencontrez votre équipe" screen shows agents already preparing.

### Gap B — Multi-tenant customer portal (app.swwarm.com)
**Priority:** Before first customer. **Effort:** 3 sessions. **Depends:** Gap A.

**What to build / fix:**
- Audit every screen for hardcoded tenant references
- Replace all with `useAuth().companyId`
- Route protection: unauthenticated → `/login`, no company → `/onboard`
- Implement all 9 screens (§4) wired to auth context:
  - CEO Console (§11)
  - Task approval (mobile-optimised)
  - Agent roster
  - Pack browser
  - Integration Hub
  - Org memory
  - Financial pulse (§18)
  - Audit trail
  - Settings

### Gap C — Swwarm admin portal (admin.swwarm.com)
**Priority:** Before first customer. **Effort:** 2 sessions.

**What to build:**
- Separate React app at admin.swwarm.com
- IP allowlist middleware (Swwarm team only)
- Tenant list: MRR, DAU, task count, last active, plan, health
- Per-tenant detail + read-only impersonation (mandatory audit log entry)
- Bull Board integration (BullMQ queue monitor)
- Billing oversight dashboard
- Navigation to skill management (§20)

### Gap D — Skill management system
**Priority:** Before Pack P1 launch. **Effort:** 5 sessions. **Depends:** Gap C, G7.

**What to build (admin portal):**
- Skill editor: structured form, not raw markdown
- Input/output JSON Schema builder
- Quality gate configuration UI
- Golden dataset manager: add/edit/tag/remove examples
- Test runner: run against golden dataset → pass rate displayed
- Publish pipeline: Draft → Review → Staging → Production buttons
- Semantic version management: create version, write changelog, view diff
- Tenant adoption table: version per tenant
- Contribution review queue: tenant skills outperforming baseline

**What to build (customer portal):**
- Skill performance dashboard per agent (pass rate, quality score, trend)
- Golden dataset viewer (own examples, anonymised)
- Update notification + opt-in flow with diff preview
- Benchmark comparison (≥50 customers in same domain to activate)

### Gap E — Notification system
**Priority:** Before first customer. **Effort:** 2 sessions.

**What to build:**
- Notification service (BullMQ worker: reads events, routes to channels)
- In-app notification centre (persistent, read/unread state, dismiss)
- Email delivery (Resend or Postmark — EU-hosted)
- Push delivery (Web Push API for PWA)
- Notification preferences UI (per type, per channel, toggle)
- `notifications` and `notification_preferences` tables (see §25)
- Auto-nudge worker (see §11.5)

### Gap F — Agent configuration UI
**Priority:** Before first customer. **Effort:** 2 sessions. **Depends:** G2.

**What to build:**
Two-tab modal accessible from agent roster and operatives floor drill-down:

**Tab 1 — Identity (SOUL layer):**
- Display name (callsign) — editable text field
- Tone selector: formal / balanced / friendly (from `brand_voice.tone`)
- Signature phrases editor (add/remove list)
- Forbidden words list (add/remove)
- Escalation rules (who to notify, threshold)
- Custom constraints (free text, max 500 chars)
- "Save identity" → writes soul.md to agent profile

**Tab 2 — Capabilities (SKILL layer):**
- Skills enabled/disabled (toggle list from capability declaration)
- Integration status per required integration (connected / needs attention)
- Autonomy level (display only — set by trust calibration)
- Budget limit per task (slider)
- Schedule: business hours only / 24/7 / custom
- Blocked contacts (search org memory, add to list)
- Handoff rules per agent pair (always ask / threshold / autonomous)
- "Save capabilities" → writes to skill frontmatter `configurable_params`

**Note:** Customers cannot edit raw SKILL.md, cannot override GDPR routing, cannot disable AI Act compliance settings. These are invariants.

### Gap G — WhatsApp Business API + native messaging
**Priority:** Phase 2 (50 customers). **Effort:** 2 sessions (WhatsApp) + 8 sessions (native).

**WhatsApp (Phase 2):**
- Meta Cloud API integration
- Approval notification: "Sophie a qualifié 3 dossiers. Approuver? Répondre OUI/NON."
- Morning intelligence summary (once daily, no marketing messages)
- Reply parsing: "OUI" → approve, "NON" → reject, else → "Répondre par OUI ou NON s'il vous plaît"
- All actions logged to `audit_entries`

**Native Swwarm messaging (Phase 3):**
- Conversational interface: CEO types to orchestrator in natural language
- Agents surface task completions as messages in the thread
- Real-time message persistence, threading, read receipts
- Push notifications
- Natural language mission briefing in chat

### Gap H — PWA + native app
**Priority:** PWA now (1 session). Native at 500 customers.

**PWA (build now):**
- `manifest.json`: name "Swwarm", icons, theme colour
- Service worker: offline cache for approval queue
- Install prompt: triggered after Day 7 card is generated
- Web Push API registration for push notifications
- WebAuthn for biometric auth (Face ID / fingerprint for approvals)

**Native iOS + Android (Phase 4):**
- React Native or dedicated native codebase
- Home screen widget: "N tasks awaiting approval"
- Siri / Google Assistant shortcuts for approvals
- Full offline queue management
- App Store + Google Play presence

---

## 25. Data Model

### Core tables

```sql
-- TENANCY
companies (id, name, plan, status, locale, timezone, created_at)
company_members (id, company_id, user_id, role, invited_by, joined_at)
users (id, email, password_hash, verified_at, created_at)
company_dna (id, company_id, data JSONB, updated_at)

-- AGENTS
agents (
  id, company_id, slug, display_name, colour, status,
  soul_md, team_roster_visible, created_at
)
-- status: 'active' | 'paused' | 'deactivated'
-- colour: one of six approved hex values
-- display_name: editable callsign
-- soul_md: identity layer content

-- SKILLS
skills (id, company_id, agent_id, slug, tier, gdpr_required, ai_act_risk)
skill_versions (
  id, skill_id, version, scope, content JSONB,
  test_pass_rate, changelog, published_at, deprecated_at
)
-- scope: 'platform' | 'tenant'

-- TRUST
trust_scores (
  id, company_id, agent_id, skill_id,
  quality_score, gate_pass_rate, schema_pass_rate,
  composite, autonomy_level, streak_count, updated_at
)
trust_proposals (
  id, company_id, agent_id, skill_id,
  proposed_level, evidence JSONB, status, created_at, decided_at
)

-- MISSIONS
missions (
  id, company_id, title, brief, status, orchestrator_id,
  created_at, completed_at, archived_at
)
-- status: 'draft'|'active'|'blocked'|'complete'|'archived'

mission_messages (
  id, mission_id, role, content, agent_id, created_at
)
-- role: 'user' | 'orchestrator' | 'system'

mission_tasks (mission_id, task_id, PRIMARY KEY (mission_id, task_id))

-- TASKS
tasks (
  id, company_id, agent_id, skill_id, skill_version, mission_id,
  title, status, priority, context JSONB, output JSONB,
  operator_rating, blocked_reason, created_at, approved_at, completed_at
)
-- status: 'pending'|'running'|'awaiting_approval'|'awaiting_clarification'
--          |'approved'|'rejected'|'expired_needs_clarification'|'completed'|'failed'

task_dependencies (parent_task_id, child_task_id)

batch_jobs (
  id, company_id, skill_id, item_count, completed_count,
  failed_count, status, created_at
)

clarification_requests (
  id, task_id, question, context, answer,
  asked_at, answered_at, expires_at
)

task_handoffs (
  id, parent_task_id, child_task_id,
  from_agent_id, to_agent_id, context_passed JSONB, created_at
)

-- MEMORY
org_memory (
  id, company_id, content TEXT, embedding vector(1024),
  source_task_id, created_at
)
contacts (
  id, company_id, name, email, role, company_name,
  notes JSONB, anonymised_at, last_interaction_at
)
contact_events (id, contact_id, event_type, content, task_id, created_at)

-- LEARNING
golden_examples (
  id, skill_id, company_id, input JSONB, ideal_output JSONB,
  operator_approved, source, created_at
)
-- source: 'manual' | 'operator_correction' | 'promoted_from_tenant'
-- company_id: null = platform-level

benchmark_runs (
  id, skill_version_id, pass_count, fail_count,
  pass_rate, ran_at
)

-- COMPLIANCE
audit_entries (
  id, company_id, agent_id, action_type, input_hash, output_hash,
  model_used, gdpr_tier, mission_id, task_id, created_at
)
-- IMMUTABLE: DB trigger raises exception on UPDATE or DELETE

damage_control_events (
  id, company_id, agent_id, task_id,
  error_description, recovery_action, suspension_until, created_at
)

-- INTEGRATIONS
integration_credentials (
  id, company_id, integration_slug, encrypted_credentials,
  last_tested_at, status
)
webhook_endpoints (
  id, company_id, slug, secret_hash, routing_rules JSONB, created_at
)
webhook_events (
  id, company_id, endpoint_id, payload JSONB,
  routed_to_task_id, received_at
)

-- PACKS
installed_packs (
  id, company_id, pack_slug, pack_version,
  installed_at, wizard_answers JSONB
)

-- NOTIFICATIONS
notifications (
  id, company_id, user_id, type, priority,
  title, body, data JSONB, channel,
  read_at, acted_at, created_at
)
notification_preferences (
  user_id, notification_type, channel, enabled,
  PRIMARY KEY (user_id, notification_type, channel)
)

-- INTELLIGENCE
intelligence_cards (
  id, company_id, type, urgency, headline, context JSONB,
  primary_cta JSONB, status, expires_at, created_at
)

-- BILLING
stripe_subscriptions (
  id, company_id, stripe_customer_id, stripe_subscription_id,
  plan, status, current_period_end
)

-- GOALS
-- goals and goal_checkpoints are defined in full in §10b
-- abbreviated here for reference
goals (
  id, company_id, title, metric_name, metric_unit,
  metric_current, metric_target, direction, target_date,
  status, owner_agent_ids, created_at, achieved_at, notes
)

goal_checkpoints (
  id, goal_id, company_id, metric_value, delta, delta_pct,
  on_track, notes, recorded_by, recorded_at
)

mission_goals (mission_id, goal_id, PRIMARY KEY (mission_id, goal_id))

-- MISSIONS
missions (id, company_id, title, brief, status, orchestrator_id, created_at, completed_at, archived_at)

-- PLATFORM HEALTH
platform_health_cache (
  id, company_id, dispatcher_up BOOLEAN,
  queue_depth JSONB, integration_status JSONB, checked_at
)
-- TTL: rows older than 5 minutes deleted by cleanup job
```

---

## 26. Infrastructure

### Phase progression

| Phase | Customers | Stack | Monthly cost |
|---|---|---|---|
| 1 | 0–10 | Hetzner VPS + managed PG + Redis | ~€35 |
| 2 | 10–100 | OVH 2× B2-15 + managed PG replica + LB | ~€334 |
| 3 | 100–500 | OVH MKS multi-AZ + production PG + HA Redis | ~€987 |
| 4 | 500–2000 | OVH expanded cluster + Scaleway GPU | ~€2,400 |

### EU sovereignty requirements
- All customer data: France datacenters only (OVH Gravelines or Roubaix)
- Personal data: Mistral EU API exclusively — code invariant
- No US infrastructure dependency in any production data path
- Zero CLOUD Act exposure

### Analytics stack
- `swwarm.com`: Plausible (€9/month, EU-hosted, no cookies)
- `app.swwarm.com`: PostHog self-hosted (OVH, €0)

### 15 key product events (PostHog)
```
onboarding_wizard_completed, pack_installed, seed_task_fired,
first_task_approved, day2_notification_opened, day7_card_shared,
morning_intelligence_opened, task_approved, task_rejected,
clarification_answered, trust_upgrade_accepted, trust_upgrade_declined,
agent_configured, plan_upgraded, stripe_checkout_completed
```

---

## 27. AI Act and GDPR Compliance

### AI Act classification
Agents operating in employment-adjacent or financial-advice contexts qualify as high-risk AI systems under EU AI Act Annex III. Required conformity measures, enforced architecturally:

| Requirement | Implementation |
|---|---|
| Human oversight | Approval gates (Rule 7) |
| Technical documentation | SKILL.md + capability declaration |
| Logging and record-keeping | Immutable audit_entries |
| Transparency to affected persons | Terms of service + AI Act disclosure |
| Accuracy and robustness | Quality gates + schema validation |
| Explainability | "Explain yourself" drill-down (§11.2) |

**Auto-generated AI Act conformité report:** Available on demand for any high-risk AI operation period. Machine-generated PDF documenting every high-risk operation, every human oversight decision, every approval gate. Suitable for CNIL review.

### GDPR technical measures
- Data minimisation: agents access only explicitly authorised data
- Purpose limitation: each skill declares processing purpose in capability block
- Retention: configurable per company, enforced by scheduled anonymisation jobs
- Data subject rights: `GET /gdpr/export` for portability, `anonymise_contact()` for erasure
- International transfers: Mistral EU API for personal data — code invariant (Rule 1)
- DPA: Data Processing Agreement template for customer contracts

### GDPR export — `anonymise_contact(contact_id)`
Replaces all PII with `REDACTED_{hash}` throughout:
- `audit_entries` (content anonymised, structure preserved — immutability maintained)
- `org_memory` (embedding regenerated from anonymised text)
- `task.context` and `task.output` JSONB fields
- `contact_events`
Records `contact.anonymised_at`. Contact becomes unresolvable but audit trail structure intact.

---

## 28. Build Sequence

### Modules — build status

| ID | Module | Status |
|---|---|---|
| M0 | Multi-tenancy foundation | ✅ Done |
| M1 | BullMQ event-driven architecture | ✅ Done |
| M2 | Context assembly pipeline (6-layer) | ✅ Done |
| M3 | LLM router + GDPR invariant | ✅ Done |
| M4 | Integration Hub + credential vault | ✅ Done |
| M5 | Web browsing — Firecrawl + Browser-use | ✅ Done |
| M6 | Quality gates + damage control | ✅ Done |
| M7 | Cost intelligence + task translation | ✅ Done |
| M8 | Org memory + contacts — pgvector | ✅ Done |
| M9 | Trust calibration system | ✅ Done |
| M10 | Self-improvement + golden datasets | ✅ Done |
| M11 | Morning intelligence + activation sequence | ✅ Done |
| M12 | Pack installer + seed tasks | ✅ Done |
| M13 | CEO Console proactive mode | 🔨 Building |
| M14 | Stripe billing | ⬜ Next |
| M15 | SSE granular events | ⬜ Next |

### Gaps — sequenced

**Phase 1 — Complete before Pack P1 launches:**
```
M13 → M14 → M15 (finish current modules)
G1 (i18n) → G2 (capability) → G3 (RBAC) → G4 (webhooks) → G5 (clarification)
Gap A (onboarding) → Gap B (portal) → Gap C (admin) → Gap H-PWA
WAR-1 (agent fields) → WAR-3 (mission tables) → WAR-4 (mission API)
WAR-5 (orchestrator preamble) → WAR-2 (soul.md)
Gap D (skill manager) → Gap E (notifications) → Gap F (agent config UI)
```

**Phase 2 — Parallel with customer acquisition:**
```
G6 (streaming) → G7 (versioning) → G8 (DAG) → G9 (batch) → G10 (GDPR export)
WAR-6 (operatives floor) → WAR-7 (arrows) → WAR-8 (drill-down)
WAR-9 (auto-nudge) → WAR-10 (dispatcher health) → WAR-11 (retrain modal)
G11 (multi-modal)
Gap G-WhatsApp (at 50 customers)
```

**Phase 3 — Ecosystem (at 200+ customers):**
```
G12 (MCP server) → G13 (public API) → G14 (A2A) → G15 (plugins)
Gap G-native-messaging
WAR-12 (mission archive)
```

**Phase 4 — Scale (at 500+ customers):**
```
Gap H-native-app
Fine-tuned sector model (requires consent architecture + 500+ customers)
```

### CLAUDE.md required additions

```markdown
## Architecture invariants
- 11 hard rules in §3 — all enforced via throws, not logs
- GDPR routing: gdpr_required:true → Mistral EU T1-FR only. DeepSeek FORBIDDEN for personal data.
- Audit trail: audit_entries is append-only. DB trigger prevents UPDATE/DELETE.
- company_id: from JWT auth only. Never from request body.
- Orchestrator: NEVER executes external actions. Injects preamble at every session start.
- Agents: NEVER use DELETE. Status = 'deactivated' only.

## Agent model (v7 additions)
- agents.colour: hex, immutable after set, one of 6 approved values
- agents.display_name: editable callsign, separate from agents.slug
- agents.status: 'active'|'paused'|'deactivated' — never DELETE
- agents.soul_md: identity layer (tone, constraints, persona)
- SOUL (identity) and SKILL (capabilities) are separate. soul.md written at pack install.

## Mission system
- Mission = CEO-level strategic intent. CEO creates missions.
- Task = execution unit. Orchestrator creates tasks from missions.
- All CEO Console UI references "mission" at the strategic layer.
- missions, mission_messages, mission_tasks tables (see §25).

## Operatives floor (CEO Console)
- 50/50 layout: mission control (left) + operatives floor (right)
- Each agent = disc with colour + LED + speech bubble
- Delegation = animated SVG arrow between discs
- Click disc = drill-down panel from right
- SSE events drive all live updates (M15)

## Three-tier skill architecture
- Tier 1: platform primitives (Swwarm-managed, admin portal)
- Tier 2: domain packs (Swwarm-managed, admin portal skill editor)
- Tier 3: tenant customisation (Company DNA, onboarding wizard)
- Pack content is authored in admin portal, NOT vibe coded
- Merge: Tier 2 + Tier 3 → live tenant skill instructions at install time

## Skill versioning
- Every task stores skill_version at creation time
- Tasks always execute against creation-time version
- Enforced in createTask() — reads pinned version, not current
```

---

## 29. World-Class Capability Gaps

These 20 capabilities separate a solid agentic platform from a world-class one. They are sequenced by strategic impact. Every item includes: what is missing, why it matters, how to build it, and who has it today.

### Tier 1 — Category-defining (no SMB competitor has these)

---

#### WC-1 — Outcome Analytics

**What is missing**

The platform tracks tasks completed, quality scores, and trust scores. It does not track whether missions achieved business results. There is no answer to: "Sophie sent 15 prospect emails. How many became mandates?"

**Why it matters**

Without outcome tracking, the ROI calculation requires manual work from the customer. With it, the CEO Console shows: "Sophie generated 3 mandates worth €47k this quarter at a cost of €599." That sentence is the subscription's justification, renewed every month automatically.

**Specification**

Each pack declares an `outcome_schema` — the business metrics it tracks. Outcomes are linked to mission completion via a resolution step: when a mission is marked complete, the operator optionally records the outcome (deal won, placement made, mandate signed, invoice paid).

```typescript
interface MissionOutcome {
  mission_id:       string
  outcome_type:     string      // pack-declared: 'placement' | 'mandate_signed' | 'invoice_collected'
  value:            number      // monetary value if applicable
  currency:         string      // 'EUR'
  recorded_by:      string      // operator user_id
  recorded_at:      Date
  notes:            string
}
```

The monthly ROI report synthesises: tasks executed (input) → missions completed (output) → outcomes recorded (result) → monetary value (impact). This becomes the shareable CEO Health Score card.

**Who has it:** Harvey tracks matter outcomes. Sierra tracks resolution rates and customer satisfaction scores. Both use this data to drive retention and expansion.

---

#### WC-2 — Collective Intelligence

**What is missing**

M10 improves individual skills from individual operator corrections. The platform learns nothing from patterns across all customers. At 100 customers, the anonymised pattern data is the most valuable asset in the platform — and it is currently unused.

**Why it matters**

At 100 customers in the same vertical, Swwarm has more operational data about that vertical than any competitor. "Agents in this category perform 23% better when they request a structured brief before executing." That meta-pattern improves every agent for every customer automatically. This is the compounding intelligence moat.

**Specification**

Requires consent architecture from day 1. Every customer agreement includes: "Swwarm may use your anonymised, aggregated interaction data to improve platform capabilities, with all PII removed and your company never identifiable."

Weekly background job per vertical:
1. Aggregate task outcomes across all consenting customers in the vertical (anonymised)
2. Identify statistically significant correlations between execution patterns and outcome scores
3. Promote patterns with p < 0.05 and N > 50 examples to the platform skill baseline
4. Flag for Swwarm team review before promotion

```typescript
interface CollectivePattern {
  skill_id:          string
  pattern_type:      string     // 'pre_condition' | 'output_format' | 'context_element'
  description:       string     // plain language
  outcome_lift:      number     // % improvement in quality score
  sample_size:       number
  confidence:        number     // 0-1
  promoted_at:       Date | null
  reviewed_by:       string | null
}
```

**Who has it:** Duolingo's AI improves for all users when any user struggles. Cursor's autocomplete improves from all users' code edits. No SMB agent platform has this.

---

#### WC-3 — Live Teaching ("The Intern Moment")

**What is missing**

Operators give feedback via approval ratings and star scores. There is no mechanism to say "Sophie, when you write to this type of client, do it like this" with an example, and have Sophie learn and apply that preference immediately to all future similar situations.

**Why it matters**

This is the product moment that makes Swwarm feel like a real team member, not a tool. Real-time preference injection from a single example — not batch golden dataset collection — is the highest-signal feedback mechanism possible. It creates an "I just taught my agent" moment that users will share.

**Specification**

New action in task detail view: "Montrer comment faire" (Show how it's done).

Flow:
1. Operator clicks "Montrer comment faire" on any task output
2. A side panel opens showing the agent's output alongside an editable field
3. Operator writes (or edits) the ideal version
4. Platform creates a high-confidence golden example with weight 2.0 (vs standard 1.0)
5. Platform injects a named preference into `soul.md`: "Quand [context detected from task], préfère [pattern detected from edit]"
6. Confirmation to operator: "Sophie a appris cette préférence. Elle l'appliquera aux situations similaires."
7. The learning is immediately active — no retraining delay

```typescript
interface LiveTeachingExample {
  id:               string
  skill_id:         string
  company_id:       string
  task_id:          string       // source task
  agent_output:     string       // what Sophie produced
  ideal_output:     string       // what the operator wrote
  soul_injection:   string       // generated preference statement for soul.md
  weight:           2.0          // double weight vs standard golden example
  created_at:       Date
}
```

**Who has it:** No competitor. GitHub Copilot has workspace instructions (static). This is dynamic, example-based, real-time — qualitatively different.

---

#### WC-4 — Proactive Decision Intelligence

**What is missing**

Morning intelligence cards surface operational signals about what happened overnight. The platform does not yet predict: "At current trajectory you will miss your Q3 placement target by 23%." or "Revenue concentration at 71% in one client whose contract renews in 6 weeks."

**Why it matters**

Operational reporting is a feature. Predictive intelligence is a moat. The platform already holds all the data required for these predictions. The gap is the analytical layer that synthesises trends into forward-looking signals before they become crises.

**Specification**

Predictive intelligence layer running nightly alongside morning intelligence generation:

```typescript
interface PredictiveSignal {
  type:            'trajectory_risk' | 'concentration_risk' | 'relationship_risk' | 'budget_risk' | 'pipeline_risk'
  metric:          string        // what is being predicted
  current_value:   number
  projected_value: number        // at current trajectory, N days out
  projection_date: Date
  confidence:      number        // 0-1
  urgency:         'critical' | 'high' | 'medium'
  recommended_actions: string[]
}
```

Examples by pack:

**ESN pack predictions:**
- "At current placement rate, 2 consultants will exceed 30 bench days by month end — cost: €X"
- "Your BD pipeline has not produced a new mandate in 45 days — historical average: 21 days"
- "Client Dupont represents 62% of your active missions — contract renewals in 28 days"

**Delivery:** Predictive signals integrate with morning intelligence cards. High-confidence predictions with critical urgency always surface. Medium confidence only surfaces when no other high-priority cards exist (max 3/day invariant preserved).

**Who has it:** Salesforce Einstein predicts churn, upsell likelihood, and next best action from CRM data. Swwarm has richer operational data than most CRMs — the predictions would be more accurate and more actionable.

---

### Tier 2 — World-class expected

---

#### WC-5 — Agent Simulation Environment

**What is missing**

When a skill is updated by self-improvement or manual edit, there is no way to test it against historical data before deploying it to production. Operators ship and hope.

**Specification**

Sandbox execution mode in the Skill Management UI (Gap D):

1. Select any skill and two versions to compare (A vs B)
2. Select a test dataset: own golden examples, or a random sample of the last N real tasks
3. Run both versions against the dataset
4. Output: side-by-side quality score distributions, pass rate, example diffs, estimated outcome impact
5. One-click promote version B to production OR keep version A

```typescript
interface SimulationRun {
  id:               string
  skill_id:         string
  version_a:        string
  version_b:        string
  dataset:          'golden_examples' | 'recent_tasks'
  dataset_size:     number
  results_a:        SimulationResult
  results_b:        SimulationResult
  recommendation:   'promote_b' | 'keep_a' | 'inconclusive'
  ran_at:           Date
}
```

**Who has it:** Harvey, Sierra, Salesforce Agentforce. Enterprise buyers require this — "how do you test agent changes before they affect our data?"

---

#### WC-6 — Warm Human Handoff

**What is missing**

When an agent triggers clarification, the external party (candidate, client) knows they are waiting. The transition from agent to human is visible and disruptive. The operator has no structured briefing for resuming.

**Specification**

When `clarify` action fires for an external-communication task:

1. Task enters `awaiting_handoff` state (distinct from `awaiting_clarification`)
2. Operator receives a live briefing card:
   - Full context of what the agent was doing
   - The specific decision point that triggered handoff
   - The external party's last communication
   - Sophie's suggested response options
   - "Respond as Sophie" toggle (platform sends with Sophie's tone) vs "Respond as yourself"
3. External party receives a seamless continuation — no "I'll transfer you to a human" message
4. Post-resolution: operator marks handoff complete, Sophie resumes from that point with the new context injected

**Who has it:** Sierra's warm transfer is their most cited competitive feature. The customer satisfaction impact of a seamless handoff is measurable and large.

---

#### WC-7 — Visual Workflow Designer

**What is missing**

Complex multi-step workflows require SKILL.md editing or Claude Code sessions. A founder who wants "when Sophie qualifies at ≥4, Marc emails the client, if client replies positively, Clara books an interview" must either code it or file a support request.

**Specification**

React-based visual workflow canvas in app.swwarm.com (linked from agent roster):

- Nodes: agent skills (drag from palette)
- Edges: conditions (score threshold, boolean outcome, time elapsed)
- Branches: if/else routing based on conditions
- Save: generates task DAG configuration (G8 dependency)
- Test: runs simulation against last 10 similar tasks (WC-5 dependency)

Underlying model: every visual workflow compiles to a `workflow_definition` JSONB that the task engine executes. The visual canvas is purely a UI layer over the existing DAG system.

**Who has it:** Zapier and Make for generic automation. No AI agent platform for SMBs has visual workflow design specific to agent coordination.

---

#### WC-8 — A/B Testing for Agent Behaviors

**What is missing**

Skill promotion is based on golden dataset pass rate. Real-world A/B testing of live traffic with outcome measurement does not exist.

**Specification**

Traffic split at skill execution time:

```typescript
interface SkillABTest {
  id:               string
  skill_id:         string
  version_control:  string      // the current "A" version
  version_treatment:string      // the new "B" version
  traffic_split:    number      // 0.0-1.0, percentage going to treatment
  success_metric:   'quality_score' | 'operator_rating' | 'outcome_conversion'
  min_sample:       number      // minimum tasks before evaluating
  status:           'running' | 'complete' | 'stopped'
  winner:           string | null
  started_at:       Date
  completed_at:     Date | null
}
```

Automatic winner promotion when: min_sample reached AND treatment outperforms control with p < 0.05 AND no quality score regression. If inconclusive after 2× min_sample: surface to Swwarm team for manual review.

**Who has it:** Every serious ML deployment system. Absent from every AI agent platform for SMBs.

---

#### WC-9 — Structured Knowledge Base

**What is missing**

Org memory is semantic search over unstructured notes. For high-stakes factual queries (pricing rules, standard clauses, compliance requirements), the agent retrieves the most similar past note — not the authoritative answer.

**Specification**

Structured knowledge entries as a separate layer from unstructured org memory:

```typescript
interface KnowledgeEntry {
  id:               string
  company_id:       string
  category:         'sop' | 'pricing_rule' | 'standard_clause' | 'faq' | 'compliance_requirement'
  title:            string
  content:          string
  applies_to:       string[]    // agent slugs or 'all'
  version:          number
  last_verified_at: Date
  verified_by:      string      // operator user_id
  expires_at:       Date | null
}
```

Context assembly modification: knowledge base queried first (exact category match, then keyword match). If an authoritative knowledge entry exists for the query context, it is injected with `[AUTHORITATIVE]` prefix and ranked above org memory results. Agents are instructed to prefer authoritative entries over memory-retrieved content.

**Who has it:** Harvey has a legal knowledge layer on LexisNexis. Sierra has a product knowledge base. Both outperform generic RAG on factual accuracy for domain-specific queries.

---

#### WC-10 — Relationship Health Scoring

**What is missing**

Org memory stores contact interaction history. There is no synthesis of that history into a relationship health signal. A client whose engagement has been declining for 6 weeks looks the same in the UI as a highly engaged one.

**Specification**

```typescript
interface ContactHealthScore {
  contact_id:          string
  company_id:          string
  overall_score:       number      // 0-10
  sentiment_trend:     'improving' | 'stable' | 'declining'
  engagement_rate:     number      // % of outreach receiving replies
  days_since_meaningful_contact: number
  open_items:          number      // tasks pending related to this contact
  risk_flags:          string[]    // 'no_reply_3_consecutive' | 'negative_sentiment_detected' | 'contract_expiry_approaching'
  updated_at:          Date
}
```

Sentiment analysis on all incoming communications using T0 (Ministral 3B — fast and cheap). Score updated after every contact event. Surfaces in: contact profile, morning intelligence ("Client Dupont health: 3.2/10, declining"), CEO Console relationship view.

**Who has it:** Salesforce Einstein Relationship Insights does this for enterprise. No SMB platform does it. The data is already present in Swwarm's org memory.

---

### Tier 3 — Competitive necessity

---

#### WC-11 — Multi-Language Native Agents

**What is missing**

Agents generate content in the Company DNA locale (French). Incoming communications in other languages are processed but responses default to French. European expansion requires agents that natively switch language per contact.

**Specification**

- Language detection on all incoming content (Mistral multilingual, T0 cost)
- `contacts.preferred_language` field — set on first detection, editable by operator
- `soul.md` multi-language brand voice variants: `brand_voice.formal.fr`, `brand_voice.formal.de`, `brand_voice.formal.en`
- At task execution: contact language preference injected into soul context
- Agent writes in contact's language automatically — no operator configuration required

Supported at launch: `fr`, `en`, `de`, `es`, `it` — all natively supported by Mistral.

---

#### WC-12 — Multiplayer Collaboration

**What is missing**

Swwarm assumes one operator. As companies grow, multiple people (BD manager, ops person, COO) need to collaborate on missions and approvals in real time. RBAC (G3) handles access control. Real-time presence and conflict prevention are absent.

**Specification**

- Operator presence indicators on approval cards via SSE: "Marc est en train de consulter cette tâche"
- Atomic approval (C4 from audit) prevents duplicate execution
- Comment threads per task output: operators can annotate before approving
- @mention notifications: `@Marc` in a comment creates a notification for that operator
- Role-based mission filter: BD manager sees BD-tagged missions, ops sees intercontract missions
- Audit log entry for every operator action includes operator identity

---

#### WC-13 — External Client Portal

**What is missing**

The SMB's clients currently interact via email and calls. There is no structured interface for clients to receive agent-generated outputs, approve/reject proposals, or access progress reports.

**Specification**

Lightweight public URL per client: `app.swwarm.com/portal/{company_slug}/{client_token}`

Contents (configurable per company):
- Active missions (status, progress summary)
- Pending approvals (consultant profiles, proposals — approve/reject directly)
- Completed reports (generated by agents, formatted by pack template)
- Document signing (DocuSign/SignNow integration)

No Swwarm branding by default — company's own logo and name. All client actions log to `audit_entries`. Client portal access is a separate JWT with read + limited-approve permissions only.

Network effect: clients experience Swwarm quality directly and start asking "what tool does your team use?"

---

#### WC-14 — Compliance Evidence Package

**What is missing**

The audit trail is immutable and complete. There is no packaged, formatted AI Act compliance report that an operator can hand to a client, a CNIL auditor, or an investor.

**Specification**

One-click export from Audit Trail screen: "Générer le rapport de conformité AI Act"

PDF contents:
- Period covered
- Summary: N high-risk AI operations, N human oversight decisions, N approval gates triggered
- Per-operation detail: operation type, agent, model used, confidence score, human decision, timestamp
- Human oversight summary: approval rate, average review time, rejection reasons
- Data processing summary: personal data routing (100% Mistral EU, zero non-EU), GDPR measures
- Declaration statement suitable for CNIL review

Format: PDF with company logo, generated in French. Machine-readable JSON export also available.

Required by AI Act Article 13 (transparency) and Article 26 (technical documentation for high-risk systems).

---

#### WC-15 — Emotional State Detection

**What is missing**

Agents process the content of incoming communications but not the emotional signal. An urgent frustrated client email gets the same queue position and tone response as a routine enquiry.

**Specification**

Sentiment analysis on all incoming communications. Runs as a pre-processing step before context assembly.

```typescript
interface CommunicationSentiment {
  content_id:      string
  valence:         'positive' | 'neutral' | 'negative'
  urgency:         'high' | 'normal' | 'low'
  engagement:      'enthusiastic' | 'neutral' | 'disengaged'
  flags:           ('frustration_detected' | 'decision_pressure' | 'competitor_mention')[]
  confidence:      number
}
```

Effect on execution:
- `urgency: high` → task priority escalated, auto-nudge fires on completion
- `valence: negative` → soul.md tone override: use most empathetic register
- `frustration_detected` → surface to morning intelligence regardless of priority
- `enthusiastic` → accelerate workflow, suggest expedited follow-up

---

### Tier 4 — Platform depth

---

#### WC-16 — Automated Team Onboarding

**What is missing**

When the SMB hires a new team member, Swwarm holds 18 months of institutional knowledge. There is no mechanism to transfer it to the new hire in a structured way.

**Specification**

Operator triggers: "Générer un brief d'intégration pour [rôle]"

Platform generates a structured briefing document from live platform data:
- Active clients: relationship history, open items, health scores, communication preferences
- Open missions: status, agents involved, next actions, expected outcomes
- Agent capabilities: what each agent does, their current trust levels, known limitations
- Active BD pipeline: prospects in sequence, last touchpoints, estimated close dates
- Key contacts: top 20 by interaction frequency with full relationship context

Output: interactive in-app briefing (readable on mobile) + downloadable PDF. Updated on demand — always reflects current platform state.

---

#### WC-17 — Scenario Planning

**What is missing**

The platform holds all operational data to model business scenarios. There is no "what if" interface for operators.

**Specification**

Scenario templates per pack. Each template has configurable inputs and modelled outputs.

ESN pack scenarios:
- **Bench cost model:** "What if I have N consultants on bench for M days? Cost: €X"
- **Placement rate projector:** "At X% placement rate, what is my Q4 revenue trajectory?"
- **Revenue concentration analyser:** "What % of revenue do my top 3 clients represent? What if I lost the largest?"
- **Headcount model:** "What is the cost per consultant at TJM X vs Y, adjusted for bench assumptions?"

Operator adjusts inputs via sliders. Platform projects outputs in real time. Results are illustrative projections, not guarantees — clearly labelled as such.

---

#### WC-18 — User-Facing Version Rollback

**What is missing**

Skill versioning exists technically (G7). There is no UI for an operator to roll back to a previous skill version without a support ticket.

**Specification**

Version history timeline in Gap F agent configuration UI (Tab 2 — Capabilities):

- Timeline shows last 10 versions with: publish date, quality score at publication, 30-day outcome metrics, changelog summary
- Each version has a "Restaurer cette version" button
- Confirmation dialog: "Cette action remplacera Sophie v1.4 par Sophie v1.2. Les tâches en cours ne seront pas affectées."
- Rollback creates a new version entry in skill_versions (never deletes) — full audit trail preserved

---

#### WC-19 — Structured External Data Connectors

**What is missing**

Iris researches via web scraping. Scraped content is unstructured and inconsistent. High-stakes decisions deserve authoritative structured data sources.

**Specification**

Additional Integration Hub connectors (each a separate connector module):

| Connector | Data | Use case |
|---|---|---|
| Pappers.fr / Infogreffe | French company registry: legal status, directors, financials, incidents | Prospect research, client due diligence |
| Salary benchmarks | Robert Half, Michael Page annual survey data (via licensed API) | TJM calibration, candidate negotiation |
| BOAMP structured feed | Public sector tenders in XML/JSON | Automatic tender alert without scraping |
| INSEE open data | Sector employment statistics, regional economic indicators | Market intelligence cards |

Each connector implements the standard `IntegrationConnector` interface. Data returned as structured objects, not scraped HTML. Cached with configurable TTL.

---

#### WC-20 — Auto-Inferred Task Dependencies

**What is missing**

Task DAG (G8) requires explicit dependency declarations. For complex missions, the orchestrator must be told the sequence — it does not infer it.

**Specification**

Orchestrator enhancement: from a mission brief, generate a preliminary task DAG with inferred dependencies, surface to operator for confirmation before execution.

```typescript
interface InferredDAG {
  mission_id:     string
  tasks:          InferredTask[]
  dependencies:   { from: string; to: string; condition?: string }[]
  confidence:     number         // overall DAG confidence score
  operator_confirmed: boolean    // must be true before execution starts
}
```

The orchestrator proposes: "Here is how I plan to execute this mission. Does this sequence look right?" Operator can:
- Approve the plan as-is → tasks created with dependencies
- Edit individual steps → operator adjusts then approves
- Reject and re-brief → orchestrator regenerates

This gives operators visibility into the execution plan before it starts — not just after tasks appear in the queue.

---

#### WC-21 — Agent Self-Organisation

**Source:** Paperclip upstream roadmap (pending milestone). Adapted for Swwarm's SMB context and trust calibration architecture.

**What is missing**

Agents observe their own task patterns but cannot propose structural improvements to how the team operates. The organisation is static — the founder must manually reconfigure agents, adjust delegation rules, and add recurring routines. There is no mechanism for the agent team to notice inefficiencies and suggest fixes.

**Why it matters**

An organisation that improves itself is fundamentally more valuable than one that requires constant human configuration. When Sophie notices she handles 94% of a task category and proposes an autonomy upgrade with supporting evidence, the operator does not need to think of it. The platform becomes adaptive within governance boundaries. Every accepted self-organisation proposal is compounding value the operator did not have to create manually.

**Specification**

Agents continuously observe their own execution patterns via the trust calibration system and golden dataset accumulation. A self-organisation analysis job runs weekly and generates `SelfOrganisationProposal` records for review.

```typescript
interface SelfOrganisationProposal {
  id:                  string
  company_id:          string
  agent_id:            string
  proposal_type:       ProposalType
  headline:            string        // max 15 words, specific
  evidence:            ProposalEvidence
  estimated_impact:    string        // plain language: "saves 3h validation/week"
  estimated_saving:    number | null // hours per week
  governance_note:     string        // what human oversight remains after change
  status:              'pending' | 'accepted' | 'declined' | 'deferred'
  created_at:          Date
  decided_at:          Date | null
  decided_by:          string | null  // operator user_id
}

type ProposalType =
  | 'autonomy_upgrade'          // agent qualifies for higher autonomy on a specific skill
  | 'new_recurring_routine'     // agent proposes a new scheduled task based on observed patterns
  | 'delegation_simplification' // a multi-step handoff could be collapsed into one agent
  | 'skill_reassignment'        // a skill currently assigned to agent A is better suited to agent B
  | 'approval_threshold_adjust' // approval gate threshold could be loosened based on performance
  | 'contact_cooldown_adjust'   // contact collision cooldown could be shortened/lengthened

interface ProposalEvidence {
  observation_period_days: number
  task_count:              number
  relevant_metric:         string   // "pass rate" | "operator_rating" | "handling_rate"
  metric_value:            number
  metric_trend:            'improving' | 'stable'
  supporting_examples:     string[] // task IDs, max 5
}
```

**Detection triggers by proposal type:**

```
autonomy_upgrade:
  Trust Score ≥ 4.2 for 15+ consecutive tasks on a skill
  AND no damage control events in last 60 days
  → Propose upgrade to next autonomy level (existing trust calibration logic, surfaced proactively)

new_recurring_routine:
  Agent has executed the same task type 5+ times in the last 30 days
  AND all were operator-initiated (not scheduled)
  AND average quality score ≥ 4.0
  → Propose: "Je fais cette tâche régulièrement — voulez-vous que je la programme automatiquement ?"

delegation_simplification:
  Agent A always hands off to Agent B within 2 hours of task completion
  AND the handoff has occurred 10+ times in 30 days
  AND no rejections or clarifications in the chain
  → Propose: "Ce passage de relais est systématique — je peux fusionner ces deux étapes"

skill_reassignment:
  Agent A has a lower pass rate on Skill X than Agent B has on a comparable skill
  AND Agent B's task load has capacity
  → Propose: "Sophie réussit mieux la qualification que Marc — redistribuer cette compétence ?"

approval_threshold_adjust:
  Agent has 30+ consecutive approved outputs on a task type with no edits
  AND operator approval time averages < 30 seconds (rubber-stamp pattern)
  → Propose: "Vous approuvez ces tâches sans modification depuis 30 fois — passer en autonome ?"
```

**Delivery and governance:**

Proposals surface as a dedicated card type in morning intelligence (type: `self_organisation`). They are never executed automatically — the operator accepts or declines. Each proposal includes:

- The specific evidence (task count, metric, trend)
- What would change if accepted
- What human oversight remains after the change
- A "Voir les exemples" link to the supporting tasks

Declined proposals are remembered — the same proposal type is not re-surfaced for that agent for 90 days. Accepted proposals are logged to `audit_entries` as governance decisions (required for AI Act documentation).

```sql
CREATE TABLE self_organisation_proposals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES companies(id),
  agent_id            UUID NOT NULL REFERENCES agents(id),
  proposal_type       VARCHAR(40) NOT NULL,
  headline            VARCHAR(120) NOT NULL,
  evidence            JSONB NOT NULL,
  estimated_impact    TEXT NOT NULL,
  estimated_saving    DECIMAL(6,1),
  governance_note     TEXT NOT NULL,
  status              VARCHAR(15) NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','accepted','declined','deferred')),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  decided_at          TIMESTAMPTZ,
  decided_by          UUID REFERENCES users(id)
);

CREATE INDEX ON self_organisation_proposals(company_id, status);
CREATE INDEX ON self_organisation_proposals(agent_id, proposal_type, status);
```

**Morning intelligence copy (EMOTIONAL_LAYER.md):**

```
self_organisation.autonomy_upgrade:
  "Sophie a géré 23 qualifications consécutives avec une note moyenne de 4.8.
   Elle est prête à agir seule sur les lots standards. Accepter ?"

self_organisation.new_recurring_routine:
  "Sophie a traité ce type de tâche 7 fois ce mois — toujours à votre initiative.
   Voulez-vous qu'elle le programme automatiquement chaque lundi ?"

self_organisation.delegation_simplification:
  "Sophie passe systématiquement le relais à Marc dans les 90 minutes.
   Je peux simplifier ce circuit. Gain estimé : 2 approbations par semaine."
```

**Who has it:** The Paperclip upstream roadmap lists Self-Organisation as a pending milestone. No SMB agent platform has implemented this. Swwarm's trust calibration architecture makes it uniquely well-positioned to build it — the evidence data already exists in `trust_scores` and `task` tables.

---

### Build sequence for world-class gaps

Priority order based on strategic impact and dependency:

```
Immediately (alongside current platform work):
  WC-4   Proactive decision intelligence   (enhances existing morning intelligence)
  WC-15  Emotional state detection          (pre-processing step, low implementation cost)
  WC-10  Relationship health scoring        (data already in org memory)

At 10 design partners:
  WC-1   Outcome analytics                 (closes the ROI loop)
  WC-3   Live teaching / intern moment     (highest retention impact)
  WC-14  Compliance evidence package       (AI Act enforcement urgency)

At 50 customers:
  WC-2   Collective intelligence            (requires consent architecture + data volume)
  WC-5   Agent simulation environment      (requires skill versioning G7)
  WC-6   Warm human handoff
  WC-9   Structured knowledge base
  WC-11  Multi-language agents              (European expansion trigger)
  WC-21  Agent self-organisation            (requires trust calibration data — M9 + 50 customers)

At 100 customers:
  WC-7   Visual workflow designer           (requires task DAG G8)
  WC-8   A/B testing                        (requires collective intelligence WC-2)
  WC-12  Multiplayer collaboration
  WC-13  External client portal
  WC-16  User-facing version rollback

At 200+ customers / post-Series A:
  WC-17  Scenario planning
  WC-18  Structured external data connectors
  WC-19  Auto-inferred task dependencies
  WC-20  Automated team onboarding
```

---


---

## 30. Team Structure 2026–2029

Swwarm is not a normal SaaS company. The build simultaneously covers AI infrastructure, operational middleware, memory systems, governance systems, UX abstraction, and a new operational category. The team structure must reflect this: unusually product-heavy, reliability-heavy, UX-heavy, and customer-embedded.

**The most important strategic principle:** Swwarm is fundamentally a product systems company — not an AI lab, not a traditional SaaS startup. The moat comes from operational coherence, memory continuity, trust UX, orchestration quality, and reliability — not raw model innovation.

The mistake most AI startups make: over-hiring researchers, under-hiring product systems thinkers, under-investing in UX and operational reliability. Swwarm does the opposite.

**Cultural identity:** Swwarm should not resemble an AI lab or a generic SaaS startup. It should resemble a calm operational systems company. The culture optimises for reliability, trust, clarity, continuity, and operational excellence — because that is exactly what the product promises.

---

### Year 1: July 2026 → June 2027

**Goal:** Achieve product-market fit and operational embedding.

**Team size:** 12–18 people. Do NOT overhire early. Elite generalists, product ownership, fast iteration loops — not organisational complexity.

| Function | Team size |
|---|---|
| Founders | 2–3 |
| Core Engineering | 5–6 |
| AI Systems | 2 |
| Product + UX | 2–3 |
| Customer Success / Ops | 1–2 |
| GTM | 1–2 |

**Founders (2–3)**

*CEO / Product Vision* — owns category narrative, GTM, customer obsession, UX direction, strategic coherence.

*CTO / Systems Architecture* — owns orchestration reliability, memory systems, scalability, infra, governance architecture.

*Optional third founder* — strongly beneficial if design/product-systems-oriented OR enterprise-operations-oriented.

**Core Engineering (5–6)**

*Senior Full-Stack Product Engineers (2–3)* — need systems thinking, product intuition, frontend sensitivity, backend competence. Avoid pure infra engineers and narrow frontend specialists. Swwarm requires product systems engineers.

*AI Runtime / Orchestration Engineers (1–2)* — expertise in multi-agent systems, orchestration, async systems, queues, memory pipelines, evaluation systems. Critical role.

*Reliability / Infrastructure Engineer (1)* — possibly the most underrated hire. Responsible for observability, failure recovery, event consistency, scaling, operational resilience. This role becomes existential at scale.

**AI Systems (2)**

You do NOT need a large ML research org early. You are not OpenAI.

*AI Product Engineer* — prompt systems, memory quality, orchestration logic, evaluation, trust systems.

*AI Evaluation / Reliability Engineer* — hallucination testing, escalation logic, autonomy safety, memory correctness, regression testing. Very few startups hire this early. Swwarm should.

**Product + UX (2–3)**

Disproportionately important. Possibly more important than adding another AI engineer.

*Product Designer (critical)* — needs systems simplification ability, operational UX thinking, calm interface design, workflow psychology. Do NOT hire flashy AI visual designers. Hire cognitive compression experts.

*UX Research / Product Ops* — observing SMB workflows, onboarding analysis, operational friction discovery, trust calibration insights.

**Customer Success / Operational Enablement (1–2)**

Your first customers require onboarding, workflow mapping, operational setup, trust building. This is NOT traditional SaaS support. This is operational transformation support.

**GTM (1–2)**

Founder-led selling, high-touch onboarding, deep operational understanding. Early GTM hires should be operators, consultants, workflow thinkers — not aggressive SaaS salespeople.

**Year 1 hiring philosophy**

Hire for: systems thinking, product intuition, reliability obsession, operational empathy.

Avoid: hype AI profiles, benchmark-focused researchers, feature factory engineers.

---

### Year 2: July 2027 → June 2028

**Goal:** Scale operational embedding.

**Team size:** 50–80 people. Specialisation begins.

| Function | Team size |
|---|---|
| Engineering | 18–30 |
| AI Systems | 6–10 |
| Product + UX | 8–10 |
| Customer Success | 10–15 |
| GTM | 12–20 |
| Operations | 4–6 |
| Leadership | 4–6 |

**Engineering expands into pods:**

*Platform Pod* — orchestration, memory, infra, event systems.

*Operational Experience Pod* — missions, delegation, approvals, daily workflows.

*Integrations Pod* — CRM, email, calendar, ERP, MCP ecosystem.

*Reliability Pod* — observability, rollback, continuity, audit consistency. This becomes one of the most strategic teams.

**AI Systems new key hires:**

*Memory Systems Specialist* — memory continuity becomes the moat.

*AI Governance Engineer* — AI Act tooling, auditability, explainability, compliance pipelines. Huge strategic value in Europe.

**Product + UX central hires:**

*Design Systems Lead* — coherence, calm UX, operational simplicity.

*Behavioural UX Specialist* — trust, delegation psychology, escalation comfort, autonomy confidence. Very rare profile, potentially huge leverage.

**Customer Success evolves into Operational Success:**

New role: *Operational Architect* — mapping SMB operations, identifying delegation opportunities, increasing embedding depth. Solutions architect combined with operational consultant. Potentially the highest-leverage hire.

**GTM evolution:**

Outbound systems, partnerships, vertical expansion.

*Vertical operators* (former recruiter ops leads, agency operators, accounting workflow experts) — create credibility, pack quality, operational specificity. Huge competitive advantage.

---

### Year 3: July 2028 → June 2029

**Goal:** Become operational infrastructure.

**Team size:** 120–180 people. Swwarm becomes a true platform company.

| Function | Team size |
|---|---|
| Engineering | 45–65 |
| AI Systems | 12–20 |
| Product + UX | 15–20 |
| Customer Success | 20–30 |
| GTM | 25–40 |
| Operations | 10–15 |
| Leadership | 8–12 |

**Most important Year 3 additions:**

*Trust & Safety / Governance Org* — AI governance, autonomy policy, escalation systems, compliance evolution, enterprise trust frameworks. Europe will reward this heavily.

*Ecosystem Team* — partner enablement, pack certification, third-party quality control, interoperability management. Activated when marketplace dynamics begin.

*Dedicated Reliability Engineering Org* — by Year 3 reliability is no longer infra. It is product trust infrastructure.

*Organisational Memory Team* — continuity systems, memory persistence, context quality, organisational intelligence. Where the moat deepens.

---

### The 10 most strategically important roles across all years

| Role | Why critical |
|---|---|
| Product Designer | Complexity compression |
| Reliability Engineer | Trust |
| AI Evaluation Engineer | Safe autonomy |
| Operational Architect | Embedding depth |
| Memory Systems Engineer | Core moat |
| Product Systems Engineer | Cross-layer coherence |
| Behavioural UX Specialist | Trust adoption |
| Governance Engineer | Europe advantage |
| Integration Engineer | Operational embedding |
| Customer Success Lead | Retention |

---


---

## 31. Platform Design Philosophy

Derived from the team structure document. These principles govern every product, UX, and architecture decision. They are not guidelines — they are constraints.

---

### 31.1 Cognitive Compression

The primary design constraint for every UI element is cognitive compression: the interface must reduce the mental load required to understand and act, never add to it.

**What cognitive compression means in practice:**

The CEO Console is not a dashboard. It is a briefing. It shows the operator exactly what needs attention and what can be ignored. Nothing more.

The approval flow is not a review system. It is a one-action decision. The operator reads context and taps approve or reject. Sub-10-second action for routine approvals.

The agent roster is not a configuration panel. It is a team overview. The operator sees who is working, what on, and whether anything is blocked. No technical detail unless requested.

**The anti-pattern:** flashy AI visual design that showcases capability rather than enabling action. Swwarm does not show spinning neural networks, confidence percentages, token counts, or model names to operators. These are plumbing. Operators see outcomes.

**Hire test for Product Designer:** given a 15-field form, can they compress it to 4 inputs with the same information density? If not, wrong hire.

---

### 31.2 Calm Interface Design

Every interaction with Swwarm should feel like talking to a competent, calm professional — not a chatbot, not a dashboard, not a feed.

**The tone throughout the product:**
- Statements, not questions ("Sophie a terminé." not "Sophie a peut-être terminé, voulez-vous vérifier?")
- Specific, not vague ("3 profils qualifiés ce matin" not "quelques résultats disponibles")
- Confident, not hedging (trust scores are shown as "autonome" not "probabilité 87% d'autonomie")
- Brief, not comprehensive (morning intelligence is a briefing, not a report)

**Visual calmness:**
- Maximum 3 distinct visual states per component (idle / active / attention-required)
- Agent status uses colour + LED only — no text labels for running states
- Animations exist only to communicate state change — never decorative
- No loading spinners for operations under 400ms — instant feel is mandatory

**The stress test:** if the platform is handling a crisis (damage control event, failed task, external service down), the UI should be calmer and more precise than normal, not more alarming. Urgent information is surfaced with higher priority, not higher visual intensity.

---

### 31.3 Reliability as Product Trust Infrastructure

By Year 3, reliability is no longer infrastructure. It is product trust infrastructure. This distinction must be built into the architecture from day one.

**The difference:**

Infrastructure reliability: the system stays up. Measured by uptime percentage. Owned by DevOps.

Product trust reliability: the operator can predict what agents will do. Measured by: outcome consistency, approval accuracy, damage control event rate, task failure resolution time. Owned by the product team.

**Reliability features that belong in the product, not the infra:**

*Agent consistency score:* for each agent, over the last 30 days — how often did the output match the operator's expectation on first attempt? Distinct from quality score (which measures quality) — this measures predictability. An agent that consistently produces B+ work is more trustworthy than one that alternates A and F.

*Operational health card:* available in the CEO Console at any time. Shows: all running tasks, queue depth, integration status, last damage control event, skill versions deployed. Not a technical monitoring dashboard — a team health briefing. "Tout fonctionne normalement" is the most common state. Shown in two sentences.

*Task failure resolution SLA:* every failed task has a maximum time-to-resolution. Solo tier: 24h. Growth: 8h. Pro: 4h. Enterprise: 1h. The platform tracks this. Operators see it in their plan details. This is a product promise, not an ops metric.

*Predictable degradation:* when an integration disconnects or a model is unavailable, the platform degrades gracefully and communicates exactly what will and won't work. Never silent failure. Never "try again later." Always: "Sophie ne peut pas envoyer d'emails pendant la reconnexion — les autres tâches continuent."

---

### 31.4 AI Evaluation Infrastructure

The AI Evaluation / Reliability Engineer is one of the 10 most strategically important early hires. This role owns the evaluation infrastructure — the systems that ensure agent quality, safety, and consistency before and after deployment.

**What the evaluation infrastructure must include:**

*Hallucination detection:* for every output, a secondary check that verifies factual claims against Company DNA and org memory. Not model-level hallucination detection — domain-specific consistency checking. If Sophie's qualification output claims a candidate has a certification that isn't in their CV, that's a domain hallucination that generic LLM safety doesn't catch.

```typescript
interface HallucinationCheck {
  output_id:       string
  claim:           string          // extracted factual claim
  source:          string | null   // supporting evidence in context
  verdict:         'supported' | 'unsupported' | 'contradicted'
  confidence:      number
}
```

*Regression suite per skill:* every skill has a regression test suite run on every version update. Suite minimum: 20 historical examples (golden dataset). Regression threshold: new version must not score more than 0.5 below the previous version's average on the regression suite. If it does: version is blocked from promotion and flagged for review.

*Autonomy safety evaluation:* before any skill is promoted to a higher autonomy tier (supervised → spot-checked → autonomous), it runs an autonomy safety evaluation. This tests edge cases specifically: what does the agent do when given ambiguous input, malformed data, or a task that approaches a quality gate boundary? Results shown in simulation environment (WC-5) before promotion is confirmed.

*Memory correctness testing:* a periodic job that validates that org memory retrieval for standard query types returns the expected results. Test data: a set of canonical queries per company (e.g. "What is our standard margin for senior profiles?") with expected answers. If retrieval accuracy drops below threshold: flag for memory quality review.

*Escalation logic testing:* for every damage control trigger and approval gate, automated tests verify they fire correctly under the conditions they are supposed to fire. These are integration tests, not unit tests — they exercise the full stack from task input to approval notification.

The evaluation infrastructure is not a testing framework. It is the reliability backbone of the trust calibration system. Without it, the trust scores are opinions. With it, they are evidence.

---

### 31.5 Operational Embedding Depth

The Operational Architect role (Year 2) is responsible for increasing embedding depth — how deeply Swwarm is integrated into a company's actual operations. Embedding depth is the primary retention predictor and the primary expansion signal.

**Definition:** embedding depth is the percentage of a company's daily operational decisions and actions that flow through Swwarm agents. A company at 5% embedding uses Swwarm for a few tasks. A company at 60% embedding cannot operate normally without it.

**Platform support for embedding depth:**

The platform tracks and surfaces embedding depth as a metric per company. It is used internally by Customer Success (and eventually by the Operational Architect) to identify companies that are underutilising and at churn risk, and companies that are ready to expand to new packs.

```sql
CREATE TABLE embedding_metrics (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id),
  week_start       DATE NOT NULL,
  tasks_by_agent   JSONB,          -- {agent_slug: task_count}
  human_time_saved_hours DECIMAL(8,2),
  workflows_covered      INTEGER,  -- count of distinct workflow types touched
  embedding_score        DECIMAL(5,2), -- 0-100, composite
  computed_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_id, week_start)
);
```

The embedding score surfaces in two places:

*Admin portal (§21):* Swwarm team sees embedding score per customer. Low and declining = at-risk. High and plateauing = expansion candidate.

*CEO Console health card (§31.3):* the operator sees a plain-language version: "Swwarm gère 34% de vos opérations courantes. Voici 2 domaines où votre équipe IA pourrait faire plus." This is not presented as a score — it is presented as an expansion suggestion.

**The embedding depth loop:**

Higher embedding → more org memory accumulated → better agent performance → operator trusts more → more tasks delegated → higher embedding.

This is the compounding retention mechanism. Every task processed improves memory, which improves future tasks, which builds trust, which increases delegation. The platform must be designed to accelerate this loop, not interrupt it.

---

### 31.6 Delegation Psychology

The Behavioural UX Specialist (Year 2) owns a domain that must be designed into the product from day one: delegation psychology. The question is not whether the platform is technically capable of autonomous action — it is whether the operator feels comfortable granting it.

**The three psychological barriers to delegation:**

*Loss of control:* "If I let Sophie do this, what if she does something wrong?"
Platform response: trust calibration with graduated steps. The operator never makes a binary "delegate everything" decision. They approve Sophie on one task type, then another. Control is never surrendered — it is selectively extended based on demonstrated evidence.

*Accountability gap:* "If a client receives a bad email from Sophie, who is responsible?"
Platform response: immutable audit trail showing every decision. The operator approved the task (or delegated approval based on their own trust decision). The accountability chain is always traceable and always includes a human decision point.

*Competence uncertainty:* "I don't know if Sophie is good enough at this."
Platform response: explicit quality evidence before any autonomy upgrade. "Sophie a réussi 23 tâches similaires avec une note de 4.7/5. Voulez-vous lui accorder plus d'autonomie?" The operator decides based on concrete performance data, not a system recommendation they don't understand.

**UX principles for each barrier:**

For loss of control: always show what an autonomous agent did, not just that it did it. The morning intelligence summary shows what Sophie sent, not just "Sophie sent 3 emails." The operator can inspect anything at any time.

For accountability gap: every task card shows the human decision point in the chain. "Approuvé par vous le 14 mai à 09h22" is never hidden. The operator is always in the accountability chain, always explicitly.

For competence uncertainty: trust score is always contextual, never abstract. Not "trust score: 4.2/5" but "Sophie a qualifié 23 CVs ce mois. 21 correspondaient exactement à votre évaluation. 2 corrections mineures effectuées." Same data, human terms.

---

---


---

## 32. Agentic Platform Gaps — Best-in-Class Analysis

Gap analysis against the world's best agentic platforms in 2026. Benchmarked against: IBM watsonx Orchestrate, Anthropic Claude agent SDK, Salesforce Agentforce, CrewAI, Sierra, Harvey, and LangGraph.

Each gap has: a tier (1=architectural, 2=capability, 3=quality), a specification, and a benchmark reference.

---

### Tier 1 — Architectural gaps

These are not features. They are architectural decisions that constrain every other capability. Missing them means the platform cannot compete at the top regardless of how good everything else is.

---

#### AG-1 — Parallel multi-agent execution

**Current state:** Sequential. Agent A completes, passes to Agent B via `handoff_to`. A relay race.

**Best-in-class:** Multiple agents work simultaneously on different aspects of the same mission, sharing findings in real time, with the orchestrator collecting results when all are complete.

**Specification:**

The mission system gains a fan-out/fan-in execution model. The orchestrator can create parallel subtask groups. All tasks in a group must complete before the orchestrator proceeds to the next step.

```typescript
interface ParallelGroup {
  group_id:     string
  mission_id:   string
  tasks:        string[]      // task IDs executing in parallel
  status:       'running' | 'complete' | 'partial_failure'
  started_at:   Date
  completed_at: Date | null
}
```

Shared mission working memory — agents on the same mission can read from and write to a shared context store:

```sql
CREATE TABLE mission_context (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id  UUID NOT NULL REFERENCES missions(id),
  company_id  UUID NOT NULL REFERENCES companies(id),
  context_key VARCHAR(100) NOT NULL,
  value       JSONB NOT NULL,
  written_by  UUID NOT NULL REFERENCES agents(id),
  written_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (mission_id, context_key)          -- last write wins per key
);
CREATE INDEX ON mission_context(mission_id, context_key);
```

CEO Console operatives floor shows all agents working on the same mission simultaneously — their discs pulse in sync. Delegation arrows connect them to the mission card, not just to each other.

**Benchmark:** CrewAI's native multi-agent design handles role-based delegation with parallel execution as a first-class primitive. LangGraph supports concurrent node execution in agent graphs.

---

#### AG-2 — Agent-to-agent peer communication

**Current state:** Agents pass tasks to each other. They cannot communicate peer-to-peer. Sophie cannot ask Marc a question without creating a formal task.

**Best-in-class:** Agents send lightweight messages to each other within a mission context. Questions, intermediate findings, confirmations. Logged but not requiring human approval.

**Specification:**

```sql
CREATE TABLE agent_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id    UUID NOT NULL REFERENCES missions(id),
  company_id    UUID NOT NULL REFERENCES companies(id),
  from_agent_id UUID NOT NULL REFERENCES agents(id),
  to_agent_id   UUID REFERENCES agents(id),  -- null = broadcast to all agents on mission
  content       TEXT NOT NULL,
  message_type  VARCHAR(30) NOT NULL
                CHECK (message_type IN ('question','finding','confirmation','alert')),
  replied_at    TIMESTAMPTZ,
  reply_content TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON agent_messages(mission_id, created_at);
```

Agent messages are injected into the recipient agent's context on their next task execution within the same mission. They appear in the mission thread in the CEO Console as a subtle sub-thread — distinguishable from mission messages but visible to the operator.

Rule: agent messages are informational only. No agent message can trigger an external action. Only tasks can trigger external actions. This preserves the approval gate invariant.

**Benchmark:** CrewAI agents can request information from each other and share intermediate results within a crew execution context.

---

#### AG-3 — Long-horizon task checkpointing

**Current state:** Tasks are stateless across failures. If a multi-step task fails on step 5 of 8, it restarts from step 1. No state is preserved.

**Best-in-class:** Every meaningful step writes a checkpoint. Worker failures resume from the last successful checkpoint, not from the beginning.

**Specification:**

```sql
CREATE TABLE task_checkpoints (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id          UUID NOT NULL REFERENCES tasks(id),
  company_id       UUID NOT NULL REFERENCES companies(id),
  step_number      INTEGER NOT NULL,
  step_name        VARCHAR(100) NOT NULL,
  execution_state  JSONB NOT NULL,       -- full agent state at this step
  context_snapshot JSONB,               -- assembled context snapshot
  outputs_so_far   JSONB,               -- partial outputs completed
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON task_checkpoints(task_id, step_number DESC);
-- On worker restart: fetch latest checkpoint, resume from step_number + 1
-- On task complete: checkpoints deleted (they are transient, not audit)
```

Resume logic in the BullMQ worker:

```typescript
async function resumeOrStart(task: Task): Promise<TaskContext> {
  const checkpoint = await db.query.taskCheckpoints.findFirst({
    where: eq(taskCheckpoints.taskId, task.id),
    orderBy: desc(taskCheckpoints.stepNumber)
  })
  if (checkpoint) {
    logger.info({ taskId: task.id, step: checkpoint.stepNumber }, 'Resuming from checkpoint')
    return deserialiseContext(checkpoint.executionState)
  }
  return buildFreshContext(task)
}
```

CEO Console shows checkpoint progress for long-running tasks: "Sophie: étape 5/8 — reprise depuis la dernière sauvegarde."

**Benchmark:** Every production workflow engine (Temporal, Prefect, Airflow) checkpoints state. Agentic platforms that don't are not production-grade for multi-day tasks.

---

#### AG-4 — Multi-factor confidence scoring

**Current state:** Trust scores measure historical performance. Judge scores measure output quality. Neither measures real-time confidence on the current specific decision.

**Best-in-class:** IBM watsonx quantifies reasoning quality, evidence strength, consistency, and stability on every decision — giving operators transparent uncertainty data before approving.

**Specification:**

```typescript
interface ConfidenceScore {
  task_id:            string
  reasoning_quality:  number   // 0-1: internal coherence of chain-of-thought
  evidence_strength:  number   // 0-1: how well context supports conclusion
  output_consistency: number   // 0-1: similarity to past outputs on similar tasks
  input_familiarity:  number   // 0-1: how similar this input is to golden examples
  overall:            number   // weighted: 0.30/0.30/0.20/0.20
  flag:               'high' | 'medium' | 'low'
}
```

Confidence score computation runs alongside the judge (§9b Layer 2). It feeds two downstream effects:

1. **Approval queue prioritisation:** low-confidence tasks surface at the top of the "Votre attention" column regardless of creation time
2. **Autonomy gate:** even if a skill is at `autonomous` trust level, a confidence score below 0.5 forces approval on that specific task — overrides the tier temporarily

Shown in approval card as: "Confiance: élevée / moyenne / faible" with a one-line reason. Never a number to the operator — always a plain-language signal.

**Benchmark:** IBM watsonx multi-factor confidence scoring is their primary differentiator for operator trust in high-stakes decisions.

---

#### AG-5 — Long-horizon task checkpointing *(see AG-3)*

*(covered above)*

---

### Tier 2 — Capability gaps

Platform works correctly. Missing these means it does less than it should.

---

#### AG-6 — Procedural memory

**Current state:** Episodic memory (what happened) and semantic memory (what's generally true). No procedural memory — the system does not learn *how* to do things better.

**Best-in-class:** Agents learn workflow preferences, successful patterns, and operator-specific ways of working. "When contacting Client Dupont, always lead with a specific project reference — generic outreach is consistently ignored."

**Specification:**

```sql
CREATE TABLE procedural_patterns (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID NOT NULL REFERENCES companies(id),
  skill_id             UUID NOT NULL REFERENCES skills(id),
  agent_id             UUID REFERENCES agents(id),
  pattern_description  TEXT NOT NULL,      -- human-readable: what the pattern is
  trigger_condition    TEXT NOT NULL,      -- when to apply: input characteristics
  behaviour            TEXT NOT NULL,      -- what to do differently
  outcome_lift         DECIMAL(5,2),       -- % improvement in outcome metric
  sample_size          INTEGER,
  confidence           DECIMAL(4,3),       -- statistical confidence 0-1
  source               VARCHAR(30) NOT NULL
                       CHECK (source IN ('outcome_attribution','operator_correction','collective_intelligence')),
  active               BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON procedural_patterns(company_id, skill_id, active);
```

At context assembly, procedural patterns for the relevant skill are injected as a "Préférences apprises:" section in the skill instructions — below the base skill instructions, above Company DNA. Agents apply them automatically. Operators can review and deactivate them in the agent configuration panel (Gap F).

Source `outcome_attribution` patterns come from the WC-1 outcome analytics pipeline. Source `operator_correction` patterns come from M10 self-improvement. Source `collective_intelligence` patterns come from WC-2.

**Benchmark:** Salesforce Agentforce builds agent specialisation over time through memory of successful interaction patterns, not just static configuration.

---

#### AG-7 — Outcome-based learning

**Current state:** M10 (self-improvement) learns from operator corrections — supervised feedback. The system gets better when humans say an output was bad.

**Best-in-class:** Systems learn from business outcomes — reinforcement feedback. The signal is: this action led to a placement, that action led to a lost mandate.

**Specification:**

Outcome attribution pipeline — runs when a goal checkpoint or mission outcome is recorded:

```typescript
interface OutcomeAttribution {
  outcome_id:        string
  mission_id:        string
  outcome_value:     'positive' | 'negative' | 'neutral'
  contributing_tasks: AttributedTask[]
}

interface AttributedTask {
  task_id:            string
  agent_id:           string
  skill_id:           string
  contribution_score: number    // 0-1: estimated causal contribution to outcome
  key_decision:       string    // the specific output element attributed
}
```

Attribution logic: trace the mission's task graph. Weight tasks by their proximity to the outcome event (temporal decay) and by whether the operator modified the output (unmodified = higher attribution). Generate `procedural_patterns` entries for patterns that appear in positive outcomes but not negative ones across N missions.

Minimum sample before a pattern is promoted: 5 positive vs 5 negative missions (reduces noise). Confidence threshold: 0.80.

**Benchmark:** Every production recommendation system (Netflix, Spotify, Amazon) uses outcome-based learning. No SMB agentic platform does. This is the gap that compounds most aggressively over time.

---

#### AG-8 — Hybrid reasoning (symbolic + LLM)

**Current state:** All decisions run through LLMs, including deterministic ones. "Is this TJM within the approved range for this profile?" is sent to a language model.

**Best-in-class:** Deterministic decisions use deterministic execution. LLMs handle language and judgment. Rule engines handle facts and logic.

**Specification:**

Skills can declare evaluation steps as `rule_based` in their SKILL.md frontmatter:

```yaml
steps:
  - name: eligibility_check
    type: rule_based          # NOT an LLM call
    rules_ref: eligibility_rules.json
  - name: qualification_write
    type: llm
    model_tier: T1_FR
```

The worker detects `type: rule_based` and executes the referenced rules JSON using a lightweight rule engine (json-rules-engine, already Node.js-native) instead of making an LLM call.

Benefits: faster (sub-10ms vs 800ms), cheaper (zero token cost), 100% deterministic (no hallucination risk on factual checks), fully auditable (rule fired = logged with exact rule ID and input values).

**Benchmark:** IBM's composite AI approach — approximately 90% business process intelligence (rule-based), 10% LLM utility — is explicitly cited as their architectural advantage for reliability in production.

---

#### AG-9 — Real-time bidirectional steering

**Current state:** Operators interact with running tasks via two actions: approve or reject. No mid-execution redirection without full cancellation.

**Best-in-class:** Operators can send steering instructions to a running agent and the agent incorporates them into the current execution.

**Specification:**

New API action: `POST /api/v1/tasks/:id/steer`

```typescript
interface SteerInstruction {
  task_id:     string
  instruction: string        // plain language: "raccourcis le message"
  operator_id: string
}
```

The steer instruction is pushed via SSE to the active worker as a `task.steered` event. The worker checks for pending steer events at each step boundary (same as cancel_requested). If a steer event is found, it is injected into the next LLM call as a system message: `[Instruction de l'opérateur]: ${instruction}`.

Agent acknowledges in the mission thread: "Compris — j'applique votre instruction." Logged to `task_execution_events` type `operator_steer`.

Rule: steer instructions cannot change the task's target agent, change the skill being used, or override approval gates. They can only influence content and approach.

**Benchmark:** Human-in-the-loop steering during execution is standard in enterprise agentic platforms (Kore.ai, Salesforce Agentforce). Fully approve/reject binary is a chatbot-era pattern.

---

#### AG-10 — Production behavioral monitoring

**Current state:** Audit trail (what happened), dispatcher health (is the system up). No detection of agent behavior drift or performance degradation.

**Best-in-class:** Behavioral baselines per skill, per company. Anomaly detection when current behavior deviates from baseline. Drift caught before customers notice it.

**Specification:**

```sql
CREATE TABLE behavioral_baselines (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id              UUID NOT NULL REFERENCES skills(id),
  company_id            UUID NOT NULL REFERENCES companies(id),
  avg_judge_score       DECIMAL(4,2),
  avg_output_tokens     INTEGER,
  avg_tool_calls        DECIMAL(4,2),
  avg_execution_ms      INTEGER,
  approval_rate         DECIMAL(4,3),
  recycle_rate          DECIMAL(4,3),
  baseline_task_count   INTEGER,
  established_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (skill_id, company_id)
);

CREATE TABLE behavioral_anomalies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id      UUID NOT NULL REFERENCES skills(id),
  company_id    UUID NOT NULL REFERENCES companies(id),
  metric        VARCHAR(50) NOT NULL,
  baseline_val  DECIMAL(10,4),
  current_val   DECIMAL(10,4),
  deviation_pct DECIMAL(6,2),
  severity      VARCHAR(20) NOT NULL CHECK (severity IN ('low','medium','high')),
  resolved      BOOLEAN NOT NULL DEFAULT false,
  detected_at   TIMESTAMPTZ DEFAULT NOW()
);
```

Weekly background job: compare current 7-day window metrics to baseline. Anomaly threshold: deviation > 2 standard deviations OR judge score drop > 0.8 points. Surface in admin portal (§21) as "Comportement inhabituel détecté" — never surfaced to operators unless Swwarm team escalates.

Baselines established after 30+ tasks per skill per company. Refreshed every 90 days.

**Benchmark:** AgentOps-style monitoring is listed by analysts as a key differentiator for production-ready agentic platforms. IBM watsonx.governance provides equivalent functionality for enterprise deployments.

---

#### AG-11 — Cross-session narrative coherence

**Current state:** Each morning intelligence card and each mission is generated independently. The platform has no synthesised understanding of the company's story over time.

**Best-in-class:** The platform maintains a narrative layer above individual tasks — understanding trajectory, turning points, persistent challenges, and momentum signals.

**Specification:**

```sql
CREATE TABLE company_narrative (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES companies(id),
  period_start   DATE NOT NULL,
  period_end     DATE NOT NULL,
  narrative_md   TEXT NOT NULL,       -- structured narrative in markdown
  key_events     JSONB NOT NULL,      -- [{date, type, description, impact}]
  momentum       VARCHAR(20) NOT NULL CHECK (momentum IN ('accelerating','stable','decelerating')),
  focus_areas    TEXT[],              -- current primary focus areas
  generated_at   TIMESTAMPTZ DEFAULT NOW()
);
-- One record per company per month
-- Injected into orchestrator context alongside Company DNA
```

Monthly narrative generation job: synthesises mission history, goal progress, outcome records, and org memory trends into a structured narrative. Injected into the orchestrator preamble as: `[Contexte narratif de l'entreprise]: ${narrative_md}`.

The orchestrator uses this to frame new missions contextually: "Given that you have been focusing on sector X since February and have won 3 mandates there, this new mission aligns with that momentum."

---

#### AG-12 — Federated live data queries

**Current state:** Agents can read org memory (cached observations) and make web searches. They cannot query live state from connected systems on demand.

**Best-in-class:** Agents can query connected integrations for live data when their task requires current state, not cached state.

**Specification:**

New action type: `query_integration`

```typescript
interface QueryIntegrationAction {
  type:             'query_integration'
  integration_slug: string             // 'hubspot' | 'boond_manager' | etc.
  query_template:   string             // pre-defined query name from integration connector
  params:           Record<string, string>
  gdpr_required:    boolean            // if true, response data stays in T1_FR context only
  cache_result:     boolean            // if true, write to org_memory after query
}

// Example: agent queries live HubSpot data
// { type: 'query_integration', integration: 'hubspot',
//   query_template: 'open_deals', params: { owner: 'company_owner' } }
```

Each integration connector declares its available query templates in its manifest. Queries are pre-defined (not arbitrary SQL/API) to prevent data leakage and maintain security boundaries. Results are scoped to the current task context.

---

### Tier 3 — Quality gaps

Platform works and does what it should. Missing these means it works less well than it could.

---

#### AG-13 — Calibrated uncertainty expression

**Current state:** Agent outputs treat all claims with equal confidence. A verified fact and an inference look identical.

**Best-in-class:** Agents express calibrated uncertainty inline. "Cette date est confirmée (source: contrat). Ce budget est estimé (dernière mention: 3 mai)."

**Specification:**

Constitutional check (§9b Layer 3) extension. A `[[UNCERTAINTY]]` block in `soul.md` instructs the agent to annotate claims by confidence level when generating any structured output:

```markdown
[[UNCERTAINTY]]
Dans toute sortie structurée, annote les affirmations:
- [CONFIRMÉ]: directement soutenu par une source dans le contexte
- [ESTIMÉ]: inféré logiquement mais non directement soutenu
- [INCERTAIN]: peu de support dans le contexte disponible
N'annote pas le texte conversationnel — uniquement les données structurées.
```

These annotations are rendered in the approval card as visual confidence indicators, not raw text. The operator sees at a glance which claims are verified vs inferred.

---

#### AG-14 — Counterfactual explainability

**Current state:** Reasoning traces (WC, `task_execution_events`) explain how the agent reached a conclusion. They do not explain *why this conclusion rather than an alternative*.

**Best-in-class:** Contrastive explanations that satisfy AI Act Article 13 transparency requirements for affected persons.

**Specification:**

For tasks flagged as high-risk (CV qualification, candidate scoring, prospect scoring), a counterfactual generation step runs after the judge:

```typescript
interface CounterfactualExplanation {
  task_id:          string
  decision:         string              // what was decided
  key_factors:      FactorContribution[]  // what drove the decision
  counterfactuals:  string[]            // "Sans [X], la décision aurait été [Y]"
  generated_at:     Date
}

interface FactorContribution {
  factor:       string    // e.g. "certification AWS manquante"
  direction:    'positive' | 'negative'
  importance:   'decisive' | 'significant' | 'minor'
}
```

Counterfactual explanations are available in the task detail view (one extra tap from the approval card). They are included in the AI Act compliance export (WC-14).

---

#### AG-15 — Dynamic skill composition at runtime

**Current state:** Operators install a pack. The pack defines fixed agents with fixed skills. Combining capabilities requires installing a different pack.

**Best-in-class:** Operators compose agent capabilities at runtime for specific missions without reinstalling packs.

**Specification:**

Mission creation gains an optional `skill_overrides` field:

```typescript
interface MissionSkillOverride {
  agent_id:      string
  additional_skills: string[]    // skill slugs to add for this mission only
  removed_skills:    string[]    // skill slugs to suppress for this mission only
}
```

Overrides are mission-scoped — they do not modify the agent's base configuration. They are logged to the mission record. The audit trail shows clearly which skills were active for each task within a mission.

Constraint: skill overrides can only add skills already installed in the company's skill library. They cannot install new skills. This preserves the quality gate and golden dataset requirements.

---

### Build sequence for agentic platform gaps

```
Before first customer (alongside C1–C9):
  AG-3   Long-horizon task checkpointing    (pure reliability)
  AG-4   Multi-factor confidence scoring    (extends §9b judge layer)
  AG-8   Hybrid reasoning / rule steps      (reduces LLM cost + improves reliability)

At 10 design partners:
  AG-1   Parallel multi-agent execution     (changes mission system fan-out)
  AG-2   Agent-to-agent peer communication  (one table, one SSE event type)
  AG-9   Real-time bidirectional steering   (POST /tasks/:id/steer endpoint)

At 50 customers:
  AG-6   Procedural memory                  (requires outcome_attribution pipeline)
  AG-7   Outcome-based learning             (requires sufficient outcome data)
  AG-10  Production behavioral monitoring   (requires 30+ tasks per skill baseline)
  AG-11  Cross-session narrative coherence  (requires 3+ months of mission history)

At 100 customers:
  AG-12  Federated live data queries        (connector manifest additions)
  AG-13  Calibrated uncertainty expression  (soul.md extension, low cost)
  AG-14  Counterfactual explainability      (high-risk task step)

At 200+ customers / post-Series A:
  AG-5   (covered by AG-3)
  AG-15  Dynamic skill composition          (mission skill overrides)

Computer use (browser automation):
  Not sequenced — requires dedicated engineering budget post-Series A
  Significant infrastructure: browser sandbox, screenshot processing, action replay
  Sequenced only after AG-1 through AG-12 are complete
```

---


---

## 33. Final World-Class Gap Audit — Gaps A–O

Fifteen confirmed absent capabilities. Cross-referenced against all existing spec sections — none are covered elsewhere.

---

### Tier 1 — Critical production gaps

---

#### Gap A — Non-determinism debugging

**What is missing:** The same task with the same inputs can produce different outputs. There is no replay capability and no variance tracking per skill.

**Specification:**

```typescript
interface TaskReplay {
  original_task_id: string
  replay_id:        string
  original_output:  string
  replayed_output:  string
  original_score:   number
  replay_score:     number
  divergence_pct:   number
  diff_summary:     string   // plain French
}
```

```sql
CREATE TABLE skill_variance_metrics (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id         UUID NOT NULL REFERENCES skills(id),
  company_id       UUID NOT NULL REFERENCES companies(id),
  period_start     DATE NOT NULL,
  judge_score_mean DECIMAL(4,2),
  judge_score_std  DECIMAL(4,2),
  output_len_std   INTEGER,
  variance_flag    BOOLEAN NOT NULL DEFAULT false,
  computed_at      TIMESTAMPTZ DEFAULT NOW()
);
-- Variance threshold: judge_score_std > 1.2 → flag in admin portal (never to operators)
-- Weekly background job computes per active skill per company
-- Replay available in task detail view (one tap from history) — on-demand only
```

---

#### Gap B — Inline output editing before approval

**What is missing:** Operators can only approve or reject. There is no inline editing of agent output before it executes.

**Specification:**

Approval card gains an inline editor. Operator edits → approves edited version. Two effects: (1) edited version executes, (2) diff logged as high-signal training example.

```typescript
interface LiveEditExample {
  id:            string
  skill_id:      string
  company_id:    string
  task_id:       string
  agent_output:  string    // original
  operator_edit: string    // what operator changed it to
  diff_chars:    number
  weight:        3.0       // implicit correction: higher than correction(1.0), lower than teaching(2.0)
  source:        'inline_approval_edit'
  created_at:    Date
}
// UI rule: plain textarea only — no markdown preview
// UI rule: if no changes made → NO training example created (approving as-is is not feedback)
```

---

#### Gap C — Trust bootstrapping protocol

**What is missing:** Every new agent starts at the lowest autonomy tier. No mechanism sets a sensible starting trust level based on available information.

**Specification:**

```typescript
interface BootstrappedTrust {
  agent_id:      string
  skill_id:      string
  company_id:    string
  initial_score: number   // 2.5–3.9 (never below 2.5, never at autonomous ≥4.8)
  components: {
    pack_track_record: number   // 0–2.0: avg trust across all pack installs
    task_type_risk:    number   // 0–1.5: drafting=1.5, external_send=0.3
    industry_profile:  number   // professional_services=0.3, financial=0.1, other=0.5
    operator_history:  number   // 0–1.0: existing operator avg approval rate
  }
}
// Hard constraints — NEVER violate:
// initial_score NEVER ≥ 4.8 (autonomous) — minimum 10 tasks required
// initial_score NEVER < 2.5 — operators deserve a usable first experience
// External send actions ALWAYS start in full approval regardless of bootstrapped score
// Cap: bootstrapped score max 3.9 ('supervised') for any new company
```

---

#### Gap D — Model upgrade resilience

**What is missing:** When Mistral releases a new model version, skills may silently regress. There is no test-before-migrate mechanism.

**Specification:**

```typescript
interface SkillModelPin {
  skill_id:       string
  model_tier:     string
  model_version:  string    // specific version, not just tier name
  pinned_at:      Date
  pinned_reason:  'upgrade_blocked_by_regression' | 'manual_pin'
  test_result_id: string | null
}
// Pre-upgrade flow:
// 1. New version available → run regression suite for all skills in that tier (see AG-regression §32)
// 2. Pass (delta ≥ -0.5): auto-migrate, update model_version
// 3. Fail: skill stays on previous version, flagged in admin portal
// 4. Admin decides: force-migrate or keep pinned
// LLM router reads skill_model_pins and routes each skill to its pinned version
```

---

#### Gap E — Zero-tolerance action classes

**What is missing:** Some actions should never be autonomous regardless of trust level, Away Mode, or any configuration. This concept does not exist in the spec.

**Specification:**

Declared in SKILL.md frontmatter. Enforced at platform level — CANNOT be bypassed by trust, Away Mode, plan tier, or any setting.

```yaml
# In SKILL.md frontmatter
zero_tolerance_actions:
  - action_type: send_email
    condition: recipient_count > 50
  - action_type: delete_record
    condition: always
  - action_type: financial_commitment
    condition: amount > company.zero_tolerance_financial_threshold
```

```typescript
// Worker check — runs BEFORE trust calibration check:
async function checkZeroTolerance(action, skill, company): Promise<void> {
  const ztRules = skill.zeroToleranceActions ?? []
  for (const rule of ztRules) {
    if (actionMatchesRule(action, rule, company)) {
      throw new ZeroToleranceViolation(rule.reason)
      // Force to pending_approval regardless of trust level
      // Log to audit_entries with zero_tolerance_triggered: true
      // Appears in AI Act compliance export (WC-14)
    }
  }
}
```

---

### Tier 2 — Operational completeness

---

#### Gap F — Semantic caching

**What is missing:** Semantically equivalent LLM calls are made repeatedly at scale. No caching layer exists.

**Specification:**

```typescript
const CACHE_TTL_SECONDS = {
  market_intelligence:  4 * 3600,
  formatting_drafting:  24 * 3600,
  cv_qualification:     2 * 3600,
  personalised_comms:   0,          // NEVER cache — personalised by definition
}
// Cache hit threshold: cosine_similarity > 0.95
// Stored in Redis (already deployed)
// GDPR invariant: NEVER cache outputs where gdpr_required: true
// Estimated saving: 30–40% LLM cost reduction at 100+ customers
// Cache metrics (hit rate, cost saving) → admin portal cost dashboard
```

---

#### Gap G — Agent-initiated task proposals

**What is missing:** Agents surface signals (WC-4) but cannot propose to create a specific task based on them. Proactive reporting ≠ proactive agency.

**Specification:**

```sql
CREATE TABLE agent_proposals (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID NOT NULL REFERENCES companies(id),
  proposing_agent_id   UUID NOT NULL REFERENCES agents(id),
  proposed_agent_id    UUID NOT NULL REFERENCES agents(id),
  trigger              TEXT NOT NULL,
  proposed_task_brief  TEXT NOT NULL,
  estimated_value      TEXT NOT NULL,
  urgency              VARCHAR(20) NOT NULL CHECK (urgency IN ('high','normal','low')),
  status               VARCHAR(20) NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','accepted','declined','expired')),
  expires_at           TIMESTAMPTZ NOT NULL,
  decided_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);
-- Delivered as 'agent_proposal' card type in morning intelligence
-- Declined 3× for same trigger type → raise proposal threshold (prevents fatigue)
-- Expires after 48h if not acted on
```

---

#### Gap H — Graceful partial output delivery

**What is missing:** If any step fails in a multi-item task, the entire task fails. Completed items are discarded with the failed ones.

**Specification:**

```typescript
type TaskStatus = ... | 'partial_complete'  // NEW — some items done, some failed

interface PartialResult {
  task_id:          string
  completed_items:  CompletedItem[]
  failed_items:     FailedItem[]
  completion_pct:   number
  failure_summary:  string    // plain French
  retry_available:  boolean
}
// Skills declare partial_delivery: true in SKILL.md for batch tasks
// partial_complete tasks appear in 'Votre attention' column — require decision
// Operator options: approve partial / request completion of failed / reject all
// NEVER silently discard completed work because later items failed
```

---

#### Gap I — Cost attribution per mission and goal

**What is missing:** M7 tracks monthly spend per company. No attribution to missions, goals, or agents — the ROI calculation (WC-1) is incomplete without cost data.

**Specification:**

```sql
ALTER TABLE cost_entries ADD COLUMN mission_id UUID REFERENCES missions(id);
ALTER TABLE cost_entries ADD COLUMN goal_id    UUID REFERENCES goals(id);
ALTER TABLE cost_entries ADD COLUMN agent_id   UUID REFERENCES agents(id);
-- Every LLM call tagged at creation with mission/goal/agent context
-- CEO Console mission detail: "Cette mission a coûté €2.40 en traitement IA"
-- Goal detail: ROI = outcome_value / SUM(cost_entries WHERE goal_id = ?)
-- Admin portal: cost per skill per pack → identify optimisation targets
```

---

#### Gap J — Pack update migration path

**What is missing:** When a pack updates, existing installs cannot migrate. The only options are: stay on old version forever, or re-install (losing org memory and Company DNA).

**Specification:**

Pack manifests declare a `migrations` array of ordered steps from version X to version Y:

```typescript
type MigrationStepType =
  | 'add_wizard_question'      // surface in mini-wizard
  | 'rename_dna_field'         // auto-migrate existing values
  | 'deprecate_dna_field'      // archive, never delete
  | 'add_agent'                // onboard alongside existing agents
  | 'remove_skill'             // deactivate gracefully
  | 'update_quality_threshold'

// Migration runs as atomic transaction when operator approves update notification
// Required wizard questions surface in mini-wizard — block until answered
// INVARIANT: org_memory, task history, Company DNA core fields NEVER deleted by migration
// Rollback everything if any step fails
```

---

### Tier 3 — Quality and polish

---

#### Gap K — Operator session gap awareness

**What is missing:** Operator opens the app after an absence to the current state with no synthesis of what happened while they were away.

**Specification:**

```typescript
interface SessionGapBriefing {
  gap_hours:       number
  tasks_completed: number
  tasks_pending:   number
  goals_updated:   GoalSummary[]
  notable_events:  string[]   // max 3 one-liners
  generated_at:    Date
}
// Trigger: last_active_at tracked on every authenticated request
// Fire when: now - last_active_at > 6h on app open
// Display: one screen max, "Voir le tableau de bord →" dismisses
// Distinct from morning intelligence (daily, 8am, time-based)
// Session gap fires on any absence > 6h, any time of day
```

---

#### Gap L — Explainability-privacy tension

**What is missing:** AI Act Article 13 (explain decisions) conflicts with GDPR Article 5 (data minimisation) when explanations reference other data subjects. No resolution is specced.

**Specification:**

All external explanations (shown to affected persons) are self-referential only:

```typescript
interface CounterfactualExplanation {
  // ...existing fields from AG-14...

  external_safe: string[]
  // COMPLIANT: "Ce profil ne répond pas au critère: React 5 ans requis (non vérifié)"
  // NON-COMPLIANT: "Un autre candidat avait une meilleure maîtrise" ← references other subject

  internal_full: string[]
  // Access-controlled to operators only — NEVER shown to affected persons
  // May include comparative context
}
// external_safe only → AI Act compliance export (WC-14)
// internal_full → operator approval card only
```

---

#### Gap M — Contact timing optimisation

**What is missing:** Agents send outreach when the task executes. No optimisation of send timing despite org memory containing the data to infer it.

**Specification:**

```sql
ALTER TABLE contacts ADD COLUMN preferred_contact_time JSONB;
-- Format: {"day_of_week": [1,2], "hour_range": [8,10], "confidence": 0.8, "observations": 5}
-- 0=Sunday ... 6=Saturday

-- Weekly job: for contacts with 3+ responses → compute response rate by day/hour
-- confidence > 0.7 → update preferred_contact_time

-- At task execution: if preferred window exists AND gap < 24h AND not in window now:
--   Schedule as BullMQ delayed job to optimal window
--   Show: "Marc enverra ce message mardi matin (meilleur taux de réponse)"
--   Operator can override and send immediately
```

---

#### Gap N — SLA tiers formally specced

**What is missing:** §31.3 references SLAs but never defines the actual commitments per plan tier.

**Specification:**

| | Solo | Growth | Pro | Enterprise |
|---|---|---|---|---|
| Task failure resolution | 24h | 8h | 4h | 1h |
| Monthly uptime | 99.0% | 99.5% | 99.7% | 99.9% |
| Task history retention | 90 days | 1 year | 2 years | 5 years |
| Org memory retention | Indefinite | Indefinite | Indefinite | Indefinite |
| Support | In-app chat | + Email | + Priority queue | Named contact |
| Data export on request | 7 days | 48h | 24h | 4h |

Resolution time = detected to operator receiving plain-language explanation + remediation path (not from operator report).

SLA breach compensation: Pro and Enterprise — 1 credit day per hour over limit, capped 10 days/month, applied automatically to next invoice.

```sql
CREATE TABLE sla_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id),
  event_type      VARCHAR(30) NOT NULL,
  sla_target_mins INTEGER NOT NULL,
  actual_mins     INTEGER NOT NULL,
  breach_mins     INTEGER,
  credit_days     INTEGER,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

#### Gap O — Agent fleet registry (admin view)

**What is missing:** The admin portal (§21) shows per-company views. There is no fleet-level visibility across all customers simultaneously.

**Specification:**

```typescript
interface FleetSnapshot {
  total_companies:      number
  total_active_agents:  number
  agents_by_status: { active: number; paused: number; deactivated: number }
  skill_deployment_distribution: { skill_slug: string; company_count: number }[]
  model_version_distribution:    { model: string; skill_count: number }[]
  underperforming_agents: {       // anonymised — no company name
    skill_slug:      string
    avg_judge_score: number
    company_count:   number
  }[]
  global_error_rate:    number    // failed_permanent / total, last 7 days
  computed_at:          Date
}
// Generated every 6 hours
// Internal Swwarm team tool — never shown to customers
// Underperforming agents section is anonymised aggregate only
```

---

### Build sequence for Gaps A–O

```
Before first customer (alongside C1–C9, AG-3, AG-4, AG-8):
  Gap C   Trust bootstrapping protocol
  Gap E   Zero-tolerance action classes
  Gap N   SLA tiers formally specced

At 10 design partners:
  Gap B   Inline output editing
  Gap H   Graceful partial output delivery
  Gap J   Pack update migration path
  Gap K   Session gap awareness

At 50 customers:
  Gap A   Non-determinism debugging
  Gap D   Model upgrade resilience
  Gap F   Semantic caching
  Gap G   Agent-initiated task proposals
  Gap I   Cost attribution per mission/goal
  Gap L   Explainability-privacy compliance

At 100 customers:
  Gap M   Contact timing optimisation

Post-Series A:
  Gap O   Agent fleet registry
```

---


---

## 34. Partner Programme

Three distinct partner models, sequenced by complexity and build cost. Each model serves a different partner profile and requires different platform infrastructure.

---

### 34.1 Partner models overview

```
MODEL 1 — VAR/Reseller
  Partner:    ESN, consulting firm, accountant
  What they do: Sell Swwarm to their clients, earn recurring commission
  End client: Pays Swwarm directly or through partner billing
  Partner earns: 20–30% recurring margin on subscriptions
  Build cost: Low — partner dashboard + billing tier
  When: Month 12

MODEL 2 — Service Delivery (most strategic)
  Partner:    Management consulting, HR consulting, CGP, law firm
  What they do: Use Swwarm agents to deliver services FOR their clients
  End client: Never directly touches Swwarm — consulting firm is accountable
  Partner earns: Their own consulting fees (Swwarm is their delivery infrastructure)
  Build cost: High — client context architecture (§35)
  When: Month 18

MODEL 3 — Implementation Partner
  Partner:    ESN with technical capability
  What they do: Implement Swwarm for clients, charge for the service
  End client: Signs direct Swwarm subscription
  Partner earns: €3–8k implementation fee + ongoing support retainer
  Build cost: Minimal — certification + documentation only
  When: Month 6
```

---

### 34.2 Model 3 — Implementation Partner (Month 6)

First to launch because it requires the least platform work. Partners implement Swwarm for clients. Clients sign direct Swwarm subscriptions. Partners earn implementation and support fees.

**Partner requirements:**
- Completed Swwarm partner certification (see §34.5)
- Minimum 2 successful client implementations before listing on partner directory
- Agreement to Swwarm implementation standards (quality gates, onboarding sequence)
- NDA covering client data

**Platform requirements:**
- Partner account flag on user accounts: `users.is_partner = true`
- Referral tracking: `companies.referred_by_partner_id` — logged at company creation
- One-time referral fee: Swwarm pays partner €150–300 per successfully onboarded company (first payment after 60 days active)
- Partner portal access: read-only visibility into their referred companies' health scores (embedding_depth, plan tier) — no access to client data

```sql
ALTER TABLE users ADD COLUMN is_partner BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN partner_certified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN partner_tier VARCHAR(20)
  CHECK (partner_tier IN ('certified','silver','gold'));

ALTER TABLE companies ADD COLUMN referred_by_partner_id UUID REFERENCES users(id);
ALTER TABLE companies ADD COLUMN referral_fee_paid BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE partner_referral_fees (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id     UUID NOT NULL REFERENCES users(id),
  company_id     UUID NOT NULL REFERENCES companies(id),
  amount_eur     DECIMAL(8,2) NOT NULL,
  paid_at        TIMESTAMPTZ,
  payment_ref    VARCHAR(100),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 34.3 Model 1 — VAR/Reseller (Month 12)

Partner sells Swwarm to their clients under their own commercial relationship. Either Swwarm bills the client directly (partner earns referral commission) or Swwarm bills the partner at wholesale (partner bills client at retail — white-label option).

**Two billing variants:**

*Variant A — Referral (simpler):* Partner refers clients. Swwarm bills clients directly. Partner earns 25% recurring commission indefinitely. Commission tracked in `partner_referral_fees`.

*Variant B — Wholesale (white-label):* Partner has a master billing account. Swwarm bills partner at 70% of retail. Partner bills their clients at retail (or higher). Partner manages client subscriptions through partner dashboard.

**Partner dashboard requirements:**

```typescript
interface PartnerDashboard {
  // Overview
  total_clients:         number
  active_subscriptions:  number
  monthly_commission:    number
  ytd_commission:        number

  // Per-client view
  clients: {
    company_id:          string
    company_name:        string
    plan:                string
    embedding_score:     number     // health indicator
    monthly_value:       number     // partner's commission from this client
    at_risk:             boolean    // embedding_score < 20
    renewal_date:        Date | null
  }[]

  // No access to client data, task content, org memory, or agent outputs
  // Partners see health metrics only — never client operational content
}
```

**White-label configuration (Variant B only):**

```sql
CREATE TABLE partner_white_label_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id      UUID NOT NULL REFERENCES users(id),
  brand_name      VARCHAR(100) NOT NULL,
  logo_url        VARCHAR(500),
  primary_colour  VARCHAR(7),        -- hex
  support_email   VARCHAR(200),
  custom_domain   VARCHAR(200),      -- e.g. ai.partnerco.fr
  show_powered_by BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

White-label scope: logo, colour, domain, support email. The product UI otherwise unchanged. GDPR and AI Act documentation always shows Swwarm as the data processor — white-label does not extend to compliance documentation.

---

### 34.4 Model 2 — Service Delivery Partner (Month 18)

The consulting firm uses Swwarm agents to deliver work *for their clients*, not just for their own operations. See §35 for the full client context architecture required.

**Partner profile:** Management consulting boutique (5–30 consultants), HR consulting firm, CGP firm with advisory clients, law firm with document work, accounting firm offering advisory services.

**Value proposition to the partner:** Their delivery capacity multiplies without headcount growth. Their agents do 60% of the analytical, drafting, and research work for each client engagement. The partner charges the same (or more) to clients while delivering with higher margin.

**Pricing tier: Delivery Partner**

```typescript
const DELIVERY_PARTNER_PRICING = {
  base_fee_monthly:    2500,    // €/month
  included_clients:    10,      // client contexts
  additional_client:   150,     // €/month per additional client context
  included_agents:     6,       // agents shared across all client contexts
  additional_agent:    250,     // €/month per additional agent
  included_tasks:      5000,    // tasks/month across all client contexts
  additional_tasks:    0.08,    // €/task above limit
}
```

**Compliance obligation:** The partner (consulting firm) is the data controller for their clients' data within Swwarm. Swwarm is the data processor. The partner must have a Data Processing Agreement with each of their clients covering the use of AI agents. Swwarm provides a template DPA for this purpose.

---

### 34.5 Partner Certification Programme

Required before any partner can implement Swwarm for clients (Models 1, 2, 3).

**Certification modules:**

| Module | Content | Format | Duration |
|---|---|---|---|
| 1 — Platform fundamentals | Architecture, packs, agents, trust system | Self-paced video | 3h |
| 2 — Pack installation | Company DNA, wizard, seed tasks, activation | Hands-on sandbox | 2h |
| 3 — Quality and compliance | AI Act obligations, GDPR routing, audit trail | Self-paced | 2h |
| 4 — Client onboarding | The 5 wow moments, measuring embedding depth | Hands-on | 2h |
| 5 — Delivery Partner (Model 2 only) | Client context setup, multi-client management | Hands-on sandbox | 3h |

**Certification exam:** 40 questions, 80% pass threshold. Valid for 12 months. Renewal required on major platform version updates.

**Partner tiers:**

```
Certified:   Completed all relevant modules. Listed on partner directory.
Silver:      3+ active client implementations, ≥90% client retention.
Gold:        10+ active clients, certified in all models, NPS ≥ 40.
```

---

### 34.6 Partner GTM sequencing

```
Month 6:   Launch Model 3 (Implementation Partner)
           Target: 3 certified partners from existing ESN network
           No platform build required — certification docs + referral tracking only
           Expected impact: 10–15 additional clients by Month 12

Month 12:  Launch Model 1 (Reseller/VAR)
           Build: partner dashboard, wholesale billing, white-label config
           Target: 10 reseller partners across France
           Expected impact: 40–60 additional clients by Month 18

Month 18:  Launch Model 2 (Delivery Partner)
           Build: client context architecture (§35)
           Build: Delivery Partner pricing tier
           Target: 5 consulting firm delivery partners
           Expected impact: 50–100 client contexts by Month 24
```

---

## 35. Client Context Architecture

Required for Model 2 (Service Delivery Partner, §34.4). Enables a single Swwarm company account to hold multiple client contexts — each with their own Company DNA, org memory, and task history — while sharing the same agent team.

This section specifies the "clients as sub-tenants" layer.

---

### 35.1 The architectural distinction

**Standard model (direct SMB customer):**

```
company (Swwarm tenant)
  └── Company DNA (who the company is)
  └── Agents (the AI team)
  └── Org memory (accumulated knowledge)
  └── Tasks / Missions (work being done)
```

**Delivery model (consulting firm with client contexts):**

```
company (the consulting firm — the Swwarm tenant)
  └── Company DNA (who the consulting firm is — brand, voice, processes)
  └── Agents (shared across all client work)
  └── client_contexts
        ├── Client A (Dupont SA)
        │     └── client_dna (Dupont's profile, preferences, history)
        │     └── org_memory filtered by client_context_id
        │     └── tasks filtered by client_context_id
        │     └── missions filtered by client_context_id
        ├── Client B (Martin Group)
        │     └── client_dna
        │     └── org_memory
        │     └── tasks / missions
        └── Client C ...
```

The agents are shared. The context they work within is scoped per client. When working on a Dupont mission, Sophie has access to: Dupont's DNA, Dupont's org memory, and the consulting firm's own DNA (brand voice, processes). She has NO access to Martin Group's data.

---

### 35.2 Data model

```sql
CREATE TABLE client_contexts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id),  -- the consulting firm
  name             VARCHAR(200) NOT NULL,
  slug             VARCHAR(100) NOT NULL,
  client_dna       JSONB NOT NULL DEFAULT '{}',
  status           VARCHAR(20) NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','paused','archived')),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_id, slug)
);
CREATE INDEX ON client_contexts(company_id, status);

-- Org memory scoped to client context
ALTER TABLE org_memory ADD COLUMN client_context_id UUID REFERENCES client_contexts(id);
-- NULL = belongs to the consulting firm itself (not a specific client)

-- Tasks and missions scoped to client context
ALTER TABLE tasks    ADD COLUMN client_context_id UUID REFERENCES client_contexts(id);
ALTER TABLE missions ADD COLUMN client_context_id UUID REFERENCES client_contexts(id);

-- Goals scoped to client context
ALTER TABLE goals ADD COLUMN client_context_id UUID REFERENCES client_contexts(id);
```

**Isolation invariant:**

```typescript
// Context assembly for a client-scoped task:
async function assembleContext(task: Task): Promise<AssembledContext> {
  const [firmDNA, clientDNA, clientMemory, firmMemory, skill] =
    await Promise.all([
      getCompanyDNA(task.companyId),               // the consulting firm's DNA
      getClientDNA(task.clientContextId),           // this client's DNA
      getOrgMemory(task.companyId, task.clientContextId),  // this client's memory ONLY
      getFirmOrgMemory(task.companyId, null),        // firm-level memory (non-client-scoped)
      getSkillInstructions(task.skillId),
    ])

  // INVARIANT: clientMemory query ALWAYS includes client_context_id filter
  // NEVER return org_memory from a different client context
  // Enforced as a DB-level check on the query — not application logic only
  return merge(firmDNA, clientDNA, clientMemory, firmMemory, skill)
}
```

---

### 35.3 CEO Console adaptations for client contexts

The CEO Console gains a client context selector — a dropdown at the top of the page:

```
[All clients ▾] → shows cross-client summary view
[Dupont SA ▾]   → scoped to Dupont's missions, tasks, memory
[Martin Group ▾] → scoped to Martin's missions, tasks, memory
```

**All clients view:** Aggregated metrics across all client contexts. No client-specific data mixed with another's. Shows: active missions per client, tasks pending per client, goal progress per client.

**Client-scoped view:** Full CEO Console for that client context. Identical to the standard CEO Console — same operatives floor, same board, same morning intelligence — but all data is scoped to that client.

**Morning intelligence:** One card per active client context with notable events. Plus a cross-client summary card. Delivered as a single daily briefing.

---

### 35.4 Client DNA structure

Client DNA is distinct from Company DNA. Company DNA is about the consulting firm (their brand, voice, processes). Client DNA is about the specific client being served.

```typescript
interface ClientDNA {
  client_name:          string
  client_sector:        string
  client_size:          string           // headcount range
  client_location:      string
  engagement_type:      string           // 'retainer' | 'project' | 'advisory'
  engagement_start:     Date
  primary_contact:      string           // name + role
  communication_prefs:  string           // preferred tone and channel
  key_priorities:       string[]         // what the client cares about most
  sensitivities:        string[]         // what to avoid / handle carefully
  billing_context:      string           // for proposal generation
  pack_extensions:      Record<string, unknown>  // pack-specific client fields
}
```

Client DNA is set at client context creation via a mini-wizard (5–7 questions). Editable from the client context settings panel.

---

### 35.5 GDPR and AI Act obligations

Each client context is a separate data subject population. GDPR principles apply independently per client context:

- **Data minimisation:** org memory for Client A never contains Client B's data
- **Purpose limitation:** tasks created for Client A's context use Client A's data only
- **Right to be forgotten:** deleting a client context cascades to all org memory, tasks, and missions with that client_context_id
- **Data portability:** a client context can be exported independently (GDPR Article 20)

The consulting firm must maintain a separate Data Processing Agreement with each of their clients. Swwarm provides a template. The consulting firm is the data controller for each client context. Swwarm is the processor.

In the AI Act compliance export (WC-14): each client context generates its own compliance report section. The consulting firm can extract a per-client AI Act report to share with their client if required.

---

### 35.6 Client skill overlays

In the delivery partner model, the consulting firm has tenant skill copies (§20 Layer 2). Each client context does NOT get a full separate copy of every skill — that would multiply storage and management exponentially.

Instead, client contexts have **skill overlays** — a thin, lightweight layer on top of the tenant's evolved copy that adds client-specific context without duplicating the full skill.

```sql
CREATE TABLE client_skill_overlays (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                      UUID NOT NULL REFERENCES companies(id),
  client_context_id               UUID NOT NULL REFERENCES client_contexts(id),
  skill_id                        UUID NOT NULL REFERENCES skills(id),  -- the tenant's copy
  additional_soul_instructions    TEXT,           -- client-specific constraints (max 500 chars)
  quality_threshold_adjustment    DECIMAL(3,2),   -- +/- on top of tenant threshold e.g. +0.3
  preferred_tone_override         VARCHAR(30),    -- 'formal'|'balanced'|'casual' for this client
  sector_vocabulary               TEXT[],         -- domain terms to inject for this client
  created_at                      TIMESTAMPTZ DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (client_context_id, skill_id)
);
```

**Context assembly for a client-scoped task:**

```typescript
async function assembleContextForClientTask(task: Task): Promise<AssembledContext> {
  const [
    tenantSkill,          // Layer 2: tenant's evolved copy (firm-level)
    clientOverlay,        // Layer 3: client-specific overlay (thin)
    clientOrgMemory,      // scoped to client_context_id ONLY
    firmOrgMemory,        // firm-level non-client memory
    clientDNA,            // this client's profile
    firmDNA,              // the consulting firm's brand/voice
  ] = await Promise.all([
    getTenantSkill(task.companyId, task.skillId),
    getClientOverlay(task.clientContextId, task.skillId),   // may be null
    getOrgMemory(task.companyId, task.clientContextId),     // ALWAYS scoped
    getOrgMemory(task.companyId, null),                     // firm-level only
    getClientDNA(task.clientContextId),
    getCompanyDNA(task.companyId),
  ])

  // Merge order: firmDNA → clientDNA → tenantSkill → clientOverlay
  // Later layers add specificity without replacing earlier ones
  return mergeContextLayers(firmDNA, clientDNA, tenantSkill, clientOverlay,
                             clientOrgMemory, firmOrgMemory)
}
```

**What goes in a client overlay vs the tenant skill copy:**

```
Tenant skill copy (evolved, firm-level):
  → How to qualify CVs in general (the firm's learned approach)
  → The firm's tone and communication style
  → Procedural patterns from all the firm's client work
  → 200 golden examples accumulated over 18 months

Client skill overlay (thin, client-specific):
  → "For Dupont SA: always reference the specific project when contacting"
  → "For Dupont SA: quality threshold +0.3 (they are more demanding)"
  → "Vocabulary to use for Dupont: [SAP, ABAP, BTP] vs Martin's [React, Node]"
  → "For Dupont SA: always formal tone regardless of firm default"
```

The overlay is typically 200–500 chars. It adds specificity; it does not duplicate the tenant's accumulated intelligence.

**Evolution of client overlays:**

Client overlays can grow through the same mechanisms as tenant skills, but scoped to that client context:
- If an operator makes corrections while working on Dupont tasks → golden examples tagged with client_context_id → optionally promoted to the client overlay
- If a procedural pattern is observed exclusively in Dupont work → stored in the client overlay rather than the firm's general tenant skill

---

### 35.7 Build sequence

```
Prerequisites:
  Multi-tenant architecture (M0) ✓
  RBAC (G3) — required before client contexts
  Company DNA extension schema (A3) — pack_extensions pattern reused
  §20 source_company_id / source_skill_id on skills table

Phase 1 (basic client contexts):
  → client_contexts table
  → client_context_id foreign key on org_memory, tasks, missions, goals
  → Context assembly updated to scope org_memory by client_context_id
  → CEO Console client selector dropdown
  → Client DNA mini-wizard

Phase 2 (client skill overlays):
  → client_skill_overlays table
  → context assembly mergeContextLayers() updated to inject overlays
  → Client overlay editor in client context settings panel
  → Golden example tagging by client_context_id

Phase 3 (full isolation + compliance):
  → Client context export (GDPR portability)
  → Right to be forgotten cascade (org_memory + overlays + tasks)
  → Per-client AI Act compliance report
  → Client context deletion with full cascade

Phase 4 (Delivery Partner tier):
  → Delivery Partner pricing tier in Stripe (M14)
  → Partner dashboard (client list, per-client health metrics)
  → DPA template generation per client context
  → Cross-client morning intelligence synthesis
```

---

*This document supersedes PLATFORM_FUNCTIONAL_SPEC_v5.md and PLATFORM_FUNCTIONAL_SPEC_v7_addendum.md.*  
*Next update trigger: first design partner onboarded, or any architectural decision that contradicts this spec.*

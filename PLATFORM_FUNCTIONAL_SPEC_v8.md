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
      "display_name": "Sophie",
      "colour": "#3B82F6",
      "role_description": "...",
      "skills": ["skill-slug-1", "skill-slug-2"]
    }
  ],
  "skills": ["skill-slug-1", "skill-slug-2"],
  "seed_tasks": ["seed-task-1", "seed-task-2", "seed-task-3"],
  "quality_gates": { ... },
  "wizard_questions": [ ... ],
  "required_integrations": ["gmail", "google_calendar"],
  "optional_integrations": ["hubspot", "notion"]
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
- 4-column kanban: Todo / Ready / Running / Blocked
- Cards show: assignee colour stripe, task title, time elapsed
- Click card → same drill-down panel as clicking the operative disc

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

### Two management layers

**Platform skill management (admin.swwarm.com):**

The Swwarm team uses this to build and maintain Tier 1 and Tier 2 skills.

- Skill editor: structured form (not raw markdown) for SKILL.md content
- Input/output schema builder (JSON Schema)
- Quality gate threshold configuration
- Golden dataset manager: add, edit, tag examples
- Test runner: run skill against golden dataset → pass rate
- Publish pipeline: Draft → Review → Staging → Production
- Semantic versioning: 1.0.0 → 1.0.1 patches → 1.1.0 new capabilities
- Diff view between versions with changelog
- Tenant adoption tracking: which version each tenant is on
- Contribution review flow: flag tenant skills outperforming platform baseline

**Tenant skill management (app.swwarm.com):**

Customers view and manage their installed skill versions.

- Current version per agent per skill
- Performance metrics: pass rate, avg quality score, approval rate, 30-day trend
- Golden dataset viewer: accumulated examples (anonymised from other tenants)
- Update notification: "Sophie 1.2.0 disponible — voir les nouveautés"
- Opt-in update with diff preview
- Performance vs anonymised benchmark (activates at 50+ customers in same domain)

### Skill versioning invariant
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

**What to build:**
- swwarm.com landing page (marketing, pricing, AI Act compliance checker link)
- Sign-up form + email verification (6-digit code, 15-minute expiry)
- Password reset flow
- Onboarding wizard (7 questions → Company DNA, see §8)
- Pack selection screen (browse packs, see agents, example seed tasks)
- Stripe checkout (plan selection + payment, feeds M14 webhook handlers)
- First login experience: triggers activation sequence, shows operatives floor loading

**Critical invariant:** The moment Stripe confirms payment → pack install transaction fires (M12) → seed tasks schedule → CEO Console shows operatives floor with agents preparing.

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

*This document supersedes PLATFORM_FUNCTIONAL_SPEC_v5.md and PLATFORM_FUNCTIONAL_SPEC_v7_addendum.md.*  
*Next update trigger: first design partner onboarded, or any architectural decision that contradicts this spec.*

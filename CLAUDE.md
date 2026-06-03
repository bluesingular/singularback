# CLAUDE.md — Platform Implementation Brief v3
**For:** Claude Code  
**Project:** Swwarm — EU-sovereign agentic operating system for SMBs  
**Company:** Singular.blue (parent SAS, French)  
**Product:** Swwarm — domain-agnostic platform, packs are the verticals  
**Base:** Fork of `paperclipai/paperclip` (MIT)  
**This file:** Root working brief. Read this first, then the spec files listed below.  
**Version:** 3.0 — supersedes CLAUDE_v2.md entirely  

---

## What you are building

Swwarm is an agentic operating system for SMBs. The platform is domain-agnostic. Business domain knowledge lives exclusively in packs. The platform knows nothing about any specific industry — it only knows how to orchestrate agents, manage memory, enforce compliance, and route work.

**Mental model:** The owner is the CEO. The agents are the team. The platform is the operating system. Packs are the apps.

**Critical distinction:**
- Platform = TypeScript code, BullMQ, pgvector, LLM routing, trust calibration, quality gates
- Pack = SKILL.md files, golden datasets, pack.json, quality gate thresholds — authored in the Skill Manager, NOT coded
- Pack content is never vibe-coded. It is content authoring.

**The end user** is a non-technical SMB founder. All UI copy is in French. All technical concepts are hidden. See EMOTIONAL_LAYER.md for all user-facing strings.

---

## Spec files — read before each session

| File | Purpose | When to read |
|---|---|---|
| `PLATFORM_FUNCTIONAL_SPEC_v8.md` | **Master spec** — full product, architecture, data model, gaps, build sequence | Every session — this is authoritative |
| `PLATFORM_FUNCTIONAL_SPEC_v7_addendum.md` | War Room additions — operatives floor, mission system, agent identity, soul.md | When building CEO Console, agent config, missions |
| `TECHNICAL_SPEC_v2.md` | Backend implementation — SQL, TypeScript, BullMQ patterns | Before implementing any backend module |
| `EMOTIONAL_LAYER.md` | All French user-facing strings | Before building any UI string or notification |

**v8 supersedes v5. Never reference v5 or earlier.**

---

## Architecture — locked decisions

### Platform invariants (11 hard rules — NEVER violate)

```
RULE 1  GDPR routing is a code invariant
        gdpr_required:true → routeModel() THROWS if model is not Mistral EU
        DeepSeek FORBIDDEN for personal data
        Test: yarn test --grep "GDPR routing" must pass before every commit

RULE 2  Credentials never reach LLM context
        Vault decrypts server-side for tool calls only
        LLM receives clean pseudonymised content only

RULE 3  Quality gates are mandatory — no bypass exists
        Every external action passes runGates() + validateOutputSchema()
        Not for testing. Not for admin. Not for demo.

RULE 4  Audit trail is immutable
        DB-level trigger prevents UPDATE/DELETE on audit_entries
        Test: direct DELETE attempt must throw at DB level

RULE 5  Task context is never truncated
        assembleContext() throws if task layer was compressed
        Compress in order: outputs → memory → DNA — never task

RULE 6  BullMQ jobs are idempotent — safe to run twice

RULE 7  Approval flow is non-negotiable for external actions
        requires_approval action → wait for human → then execute

RULE 8  company_id from auth JWT only — never from client

RULE 9  All UI copy from EMOTIONAL_LAYER.md — no invented strings

RULE 10 Seed tasks are indistinguishable from real work

RULE 11 Orchestrator only routes, never executes
        Orchestrator NEVER sends emails, NEVER calls external APIs
        If asked to act directly: delegates via handoff_to or task_create
        Enforced via injected preamble at every session start
```

### Agent model (v7 additions)

```typescript
// agents table — required fields
{
  slug:                string     // system identifier, immutable
  display_name:        string     // customer-facing callsign, editable
  colour:              string     // hex, ONE of 6 approved values, immutable after set
  status:              'active' | 'paused' | 'deactivated'
  soul_md:             string     // identity layer (tone, constraints, persona)
  team_roster_visible: boolean
}

// APPROVED COLOURS ONLY — no others
const AGENT_COLOURS = ['#3B82F6','#10B981','#F59E0B','#8B5CF6','#EF4444','#14B8A6']

// Status rules
// 'deactivated' = hidden from floor, takes no tasks, all history PRESERVED
// DELETE agents is NEVER called — only deactivate
// 'paused' = completes in-progress tasks, takes no new ones
```

### SOUL vs SKILL separation

```
soul.md  = WHO the agent is (tone, forbidden words, constraints, escalation rules)
skill.md = WHAT the agent can do (capabilities, integrations, schemas, thresholds)

These are SEPARATE files. Saving identity edits writes soul.md.
Saving capability edits writes skill frontmatter. Different write paths.
```

### Mission system (v7)

```
Mission = CEO-level strategic intent (what the CEO wants)
Task    = execution unit (what agents do)

CEO creates missions. Orchestrator creates tasks from missions.
All CEO Console UI references "mission" at the strategic layer.
Tasks are the execution layer underneath — never surfaced to CEO directly.

Tables: missions, mission_messages, mission_tasks
Status: draft | active | blocked | complete | archived
```

### Three-tier skill architecture

```
Tier 1: Platform skills (generic, Swwarm-managed, admin portal)
Tier 2: Pack skills (domain-specific, Swwarm-managed, admin portal)  
Tier 3: Tenant customisation (Company DNA + soul.md, per-customer)

Merge at install: Tier 2 template + Tier 3 Company DNA → live skill instruction
Pack content is AUTHORED in Skill Manager, NOT vibe-coded
```

### Team roster file

Generated at pack install and on every agent status change:
```markdown
# Your team — {company_name}
## {display_name} ({status})
Role: {skill.role_description}
Trust level: {autonomy_level} ({trust_score}/5 over {task_count} tasks)
Schedule: {schedule}
```
Injected into orchestrator context at session start via `{team_roster}` token.

---

## Platform finetune backlog — fix before new features

These are production-quality issues identified in audit. Implement in priority order.

### CRITICAL — fix before first customer

**Skills: current build status check**
```
BUILT (M0–M12):
  ✓ Skill execution — agents use SKILL.md instructions in tasks
  ✓ GDPR routing per skill — gdpr_required flag enforced in LLM router
  ✓ Quality gates — M6 thresholds enforced per skill
  ✓ Self-improvement — M10 golden dataset accumulation + new skill versions

BUILT (Gap D — all items complete as of §20 + §20.8):
  ✓ source_company_id / source_skill_id columns on skills table
  ✓ Skill copy function at pack install (copyMasterSkillToTenant() called in installer)
  ✓ Skill editor UI (admin.swwarm.com) — AdminSkillEditor.tsx
  ✓ Golden dataset manager UI — GoldenDatasets component in AdminSkillEditor
  ✓ Master update notification + merge flow — skill_update_notifications + AdminSkills
  ✓ Tenant skill performance dashboard (app.swwarm.com) — SkillPerformance.tsx
  ✓ client_skill_overlays table + overlay context assembly — client-assembly.ts
```

**C1 — Task state machine (prevents corrupted states)**
```typescript
// Create a state_transitions table
// Valid paths ONLY:
// pending → running → pending_approval → approved → completed
// pending → running → failed
// pending → running → awaiting_clarification → running (on answer)
// any → cancelled (if cancel_requested = true)

// PostgreSQL trigger — rejects invalid transitions:
CREATE OR REPLACE FUNCTION enforce_task_state_transition()
RETURNS TRIGGER AS $$
DECLARE
  valid_transitions JSONB := '{
    "pending":              ["running","cancelled"],
    "running":              ["pending_approval","awaiting_clarification","failed","cancelled"],
    "pending_approval":     ["approved","rejected","cancelled"],
    "awaiting_clarification": ["running","expired_needs_clarification","cancelled"],
    "approved":             ["completed","failed"],
    "rejected":             ["pending"],
    "completed":            [],
    "failed":               ["pending"],
    "cancelled":            [],
    "expired_needs_clarification": []
  }';
BEGIN
  IF NOT (valid_transitions->OLD.status ? NEW.status) THEN
    RAISE EXCEPTION 'Invalid task state transition: % → %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_state_machine
  BEFORE UPDATE OF status ON tasks
  FOR EACH ROW EXECUTE FUNCTION enforce_task_state_transition();
```

**C2 — Agent collision detection (prevents double-contacting same person)**
```typescript
// Before any external_communication action, check:
async function checkContactCollision(
  companyId: string,
  contactId: string,
  cooldownHours: number = 24
): Promise<CollisionResult> {
  const recentComm = await db.query.contactEvents.findFirst({
    where: and(
      eq(contactEvents.companyId, companyId),
      eq(contactEvents.contactId, contactId),
      eq(contactEvents.eventType, 'external_communication'),
      gt(contactEvents.createdAt, subHours(new Date(), cooldownHours))
    ),
    orderBy: desc(contactEvents.createdAt)
  })
  if (recentComm) {
    return { collision: true, lastContact: recentComm.createdAt, taskId: recentComm.taskId }
  }
  return { collision: false }
}

// If collision: task → 'blocked_collision', surface warning to operator
// Warning copy from EMOTIONAL_LAYER.md: "Sophie a déjà contacté ce prospect récemment"
```

**C3 — Task cancellation**
```typescript
// Add to tasks table:
// cancel_requested BOOLEAN NOT NULL DEFAULT false

// Workers check at each step boundary:
async function checkCancellation(taskId: string): Promise<void> {
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    columns: { cancelRequested: true }
  })
  if (task?.cancelRequested) {
    throw new TaskCancelledException(taskId)
  }
}

// UI: cancel button on any task in running/pending_approval/awaiting_clarification state
// API: POST /api/v1/tasks/:id/cancel
// Sets cancel_requested = true. Worker detects and transitions to 'cancelled'.
```

**C4 — Per-company queue rate limiting (prevents tenant starvation)**
```typescript
// In BullMQ worker — before processing:
const COMPANY_CONCURRENCY_LIMIT = {
  solo: 2,       // max 2 concurrent tasks per company
  growth: 5,
  pro: 10,
  enterprise: 25
}

async function enforceCompanyConcurrency(companyId: string, plan: string): Promise<void> {
  const limit = COMPANY_CONCURRENCY_LIMIT[plan] ?? 5
  const activeCount = await getActiveTaskCountForCompany(companyId)
  if (activeCount >= limit) {
    // Don't process — requeue with delay
    throw new CompanyConcurrencyLimitError(companyId, limit)
  }
}
```

**C5 — Pack template injection sanitisation**
```typescript
// Before ANY Company DNA value is interpolated into skill instructions:
function sanitiseDNAValue(value: string): string {
  return value
    .replace(/\{|\}/g, '')                           // Remove template delimiters
    .replace(/\n\n(System|User|Assistant):/gi, '')   // Remove role injections
    .replace(/ignore (all |previous |above )/gi, '') // Remove prompt injections
    .replace(/\[INST\]|\[\/INST\]/g, '')             // Remove Mistral delimiters
    .trim()
    .slice(0, 500)                                   // Hard cap per field
}

// Apply to ALL Company DNA fields before pack install template interpolation
// Log a warning (not an error) when sanitisation modifies a value
```

**C6 — LLM response failure states**
```typescript
// Explicit error states — add to task status enum:
type TaskFailureReason = 
  | 'failed_schema_validation'      // output didn't match declared schema after 3 attempts
  | 'failed_quality_gate'           // quality gate blocked and 2 corrections failed
  | 'failed_llm_unavailable'        // model API unreachable after retries
  | 'failed_tool_error'             // external tool (Gmail, etc.) failed
  | 'failed_budget_exceeded'        // monthly token/task limit hit mid-execution
  | 'failed_permanent'              // unrecoverable — requires human intervention

// Every failure type has:
// 1. A plain-French operator notification (from EMOTIONAL_LAYER.md)
// 2. A specific recovery suggestion
// 3. NEVER a technical error message visible to the user
```

---

**C7 — Input guardrails (blocks prompt injection and scope violations)**
```typescript
// Run BEFORE context assembly on every task creation
// Three checks in sequence — all must pass before context assembly begins:

// CHECK 1: Prompt injection detection
// Pattern match + embedding similarity against injection library
// If detected: block task, log to security_events, alert admin
// security_events.severity = 'critical' for injection attempts

// CHECK 2: Scope violation detection
const SCOPE_THRESHOLD = 0.65
const scopeScore = await cosineSimilarity(taskEmbedding, agentCapabilityEmbedding)
if (scopeScore < SCOPE_THRESHOLD) {
  // DO NOT proceed with wrong agent — reroute to orchestrator
  return { action: 'reroute', reason: 'scope_mismatch', score: scopeScore }
}

// CHECK 3: PII in input
// Scan task.brief for personal data patterns
// If found when not expected: surface confirmation to operator before proceeding
// Never silently pass PII into context

// SQL required:
// CREATE TABLE security_events (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   company_id UUID NOT NULL REFERENCES companies(id),
//   task_id UUID REFERENCES tasks(id),
//   event_type VARCHAR(40) NOT NULL,
//   severity VARCHAR(20) NOT NULL CHECK (severity IN ('low','medium','high','critical')),
//   payload JSONB NOT NULL,
//   resolved BOOLEAN NOT NULL DEFAULT false,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );
```

**C8 — LLM-as-judge layer (pre-screens all outputs before operator sees them)**
```typescript
// Run AFTER output generation, BEFORE quality gates
// Judge model: ALWAYS T1_FR (Mistral EU) — never non-EU model
// Threshold: overall_score < 6.0 → auto_recycle = true (max 2 recycles)

interface JudgeResult {
  output_id:     string
  overall_score: number       // 0-10
  auto_recycle:  boolean      // true if score < 6.0
  explanation:   string       // plain French for approval card
  dimensions: {
    relevance:       { score: number; note: string }
    accuracy:        { score: number; note: string }
    tone:            { score: number; note: string }
    completeness:    { score: number; note: string }
    scope_adherence: { score: number; note: string }
  }
}

// Default weights (pack-configurable in pack.json judge_weights):
const DEFAULT_WEIGHTS = {
  relevance: 0.30, accuracy: 0.25, tone: 0.15,
  completeness: 0.20, scope_adherence: 0.10
}

// On auto_recycle: retry with judge feedback injected into prompt
// "Ta sortie précédente a été évaluée insuffisante. Points à améliorer: [notes]"
// After 2 recycles: task → 'failed_quality_gate'

// Approval card UI: always show judge score alongside output
// "Évaluation automatique: 8.2/10 — Pertinence: 9, Exactitude: 8, Ton: 8..."

// SQL:
// CREATE TABLE judge_results (
//   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//   company_id UUID NOT NULL REFERENCES companies(id),
//   task_id UUID NOT NULL REFERENCES tasks(id),
//   output_version INTEGER NOT NULL DEFAULT 1,
//   judge_model VARCHAR(60) NOT NULL,
//   dimensions JSONB NOT NULL,
//   overall_score DECIMAL(4,2) NOT NULL,
//   auto_recycled BOOLEAN NOT NULL DEFAULT false,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );
```

**C9 — Constitutional self-critique (agent reviews own output before submission)**
```typescript
// Run AFTER generation, BEFORE judge evaluation
// Agent evaluates its own output against [[CONSTITUTION]] block in soul.md
// Uses same T0/T1 model as generation — cheap, fast, same GDPR tier

// soul.md constitution block (pack-generated at install):
// [[CONSTITUTION]]
// Avant de soumettre toute sortie, vérifie:
// 1. Uniquement les informations pertinentes à la tâche?
// 2. Chaque affirmation factuelle soutenue par le contexte?
// 3. Dans mon périmètre de responsabilité?
// 4. L'opérateur serait-il à l'aise si cette sortie était envoyée telle quelle?
// Si une réponse est NON, révise avant soumission.

// Agent response schema:
interface ConstitutionCheck {
  constitution_passed: boolean
  concern:             string | null   // if not passed
  revised_output:      string | null   // agent's revision if concern found
}

// If constitution_passed = false:
// → Use revised_output instead of original
// → Log to task_execution_events (type: 'constitution_revision')
// → Show subtle indicator in approval card: "Sophie a révisé cette sortie"

// Pack can extend constitution in soul.md via [[CONSTITUTION_EXTENSION]] block
// Installer merges base + extension at pack install time
```

---

**AG-3 — Long-horizon task checkpointing (before first customer)**
```sql
-- Write checkpoint after EVERY successful step boundary in task execution
-- On worker restart: resume from latest checkpoint, not from beginning

CREATE TABLE task_checkpoints (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id          UUID NOT NULL REFERENCES tasks(id),
  company_id       UUID NOT NULL REFERENCES companies(id),
  step_number      INTEGER NOT NULL,
  step_name        VARCHAR(100) NOT NULL,
  execution_state  JSONB NOT NULL,
  context_snapshot JSONB,
  outputs_so_far   JSONB,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON task_checkpoints(task_id, step_number DESC);

-- Resume logic in every BullMQ worker:
async function resumeOrStart(task: Task): Promise<TaskContext> {
  const checkpoint = await db.query.taskCheckpoints.findFirst({
    where: eq(taskCheckpoints.taskId, task.id),
    orderBy: desc(taskCheckpoints.stepNumber)
  })
  if (checkpoint) {
    logger.info({ taskId: task.id, step: checkpoint.stepNumber, traceId }, 'Resuming from checkpoint')
    return deserialiseContext(checkpoint.executionState)
  }
  return buildFreshContext(task)
}
-- Checkpoints are transient — deleted on task completion, not in audit trail
```

**AG-4 — Multi-factor confidence scoring (before first customer)**
```typescript
// Runs alongside judge (§9b Layer 2) — same Mistral EU T1_FR call
// Output feeds two effects: approval queue priority + autonomy gate override

interface ConfidenceScore {
  task_id:            string
  reasoning_quality:  number   // 0-1: coherence of chain-of-thought
  evidence_strength:  number   // 0-1: context supports conclusion
  output_consistency: number   // 0-1: similarity to past outputs
  input_familiarity:  number   // 0-1: similarity to golden examples
  overall:            number   // weighted: 0.30 / 0.30 / 0.20 / 0.20
  flag:               'high' | 'medium' | 'low'
}

// If overall < 0.50:
//   → Force approval even if skill is at 'autonomous' trust tier
//   → Surface at top of 'Votre attention' column regardless of age

// In approval card: "Confiance: élevée / moyenne / faible" + one-line reason
// NEVER show raw score to operator — always plain-language flag only
```

**AG-8 — Hybrid reasoning: rule-based steps (before first customer)**
```typescript
// Skills declare deterministic steps in SKILL.md frontmatter:
// steps:
//   - name: eligibility_check
//     type: rule_based          ← NOT an LLM call
//     rules_ref: eligibility_rules.json
//   - name: write_output
//     type: llm
//     model_tier: T1_FR

// Worker detects type: rule_based → executes rules JSON via json-rules-engine
// Benefits: <10ms vs ~800ms, zero token cost, 100% deterministic, fully auditable
// Rule execution logs to task_execution_events with exact rule ID + input values
// NEVER send deterministic eligibility/threshold checks to an LLM
```

---

**Gap C — Trust bootstrapping protocol (before first customer)**
```typescript
// Set sensible starting trust — prevents 30-task approval marathon for new companies
interface BootstrappedTrust {
  initial_score: number  // ALWAYS 2.5–3.9. Never < 2.5. Never ≥ 4.8 (autonomous).
  components: {
    pack_track_record: number  // 0–2.0: avg trust across all pack installs globally
    task_type_risk:    number  // 0–1.5: drafting/analysis = 1.5, external_send = 0.3
    industry_profile:  number  // professional_services = 0.3, financial = 0.1, other = 0.5
    operator_history:  number  // 0–1.0: if returning operator, their avg approval rate
  }
}
// Hard constraints — ALL MANDATORY:
// ❌ initial_score NEVER ≥ 4.8 — minimum 10 tasks required for autonomous tier
// ❌ initial_score NEVER < 2.5 — operators deserve a usable product from day 1
// ❌ External send actions ALWAYS start in full approval regardless of bootstrapped score
// ✓  Cap at 3.9 ('supervised') for any new company — first 10 tasks always monitored
```

**Gap E — Zero-tolerance action classes (before first customer)**
```typescript
// Declared in SKILL.md frontmatter — enforced by platform — ZERO bypass path
// Runs BEFORE trust calibration check in worker execution

async function checkZeroTolerance(action: AgentAction, skill: Skill, company: Company): Promise<void> {
  const ztRules = skill.frontmatter.zero_tolerance_actions ?? []
  for (const rule of ztRules) {
    if (actionMatchesRule(action, rule, company)) {
      // Force to pending_approval — ignores trust level, Away Mode, plan tier
      throw new ZeroToleranceViolation(rule.reason)
      // Log to audit_entries: zero_tolerance_triggered = true
      // Included in AI Act compliance export (WC-14) as evidence of human oversight
    }
  }
}

// Example SKILL.md frontmatter:
// zero_tolerance_actions:
//   - action_type: send_email
//     condition: recipient_count > 50
//   - action_type: delete_record
//     condition: always
//   - action_type: financial_commitment
//     condition: amount > company.zero_tolerance_financial_threshold
```

**Gap N — SLA tiers (before first customer — product promise must exist before selling)**
```typescript
const SLA_TIERS = {
  solo:       { resolution_hours: 24, uptime_pct: 99.0, history_days: 90,   export_hours: 168 },
  growth:     { resolution_hours: 8,  uptime_pct: 99.5, history_days: 365,  export_hours: 48  },
  pro:        { resolution_hours: 4,  uptime_pct: 99.7, history_days: 730,  export_hours: 24  },
  enterprise: { resolution_hours: 1,  uptime_pct: 99.9, history_days: 1825, export_hours: 4   },
} as const

// Resolution time definition: detected → operator receives plain-French explanation + remediation
// NOT from when operator reports it — platform detects and acts proactively
// Breach compensation: 1 credit day per hour over limit, capped 10 days/month → sla_events table
```

---

### HIGH PRIORITY — fix before 10 customers

**F1 — Memory conflict resolution**
```typescript
// Add to org_memory table:
// confidence_score DECIMAL(3,2) DEFAULT 1.0
// superseded_by UUID REFERENCES org_memory(id)
// last_reinforced_at TIMESTAMPTZ

// In context assembly — recency-weighted scoring:
// score = semantic_similarity * 0.6 + recency_factor * 0.4
// recency_factor = 1 / (1 + days_since_created / 30)

// Conflict detection: if two memories about the same entity contradict,
// surface in morning intelligence: "2 notes contradictoires sur [contact]"
```

**F2 — Memory staleness detection**
```typescript
// Add to org_memory:
// confidence_decay_at TIMESTAMPTZ  (null = never decays)

// Background job — daily:
// SELECT * FROM org_memory 
// WHERE last_reinforced_at < NOW() - INTERVAL '90 days'
// AND confidence_score > 0.3
// → Reduce confidence_score by 0.1
// → When confidence_score < 0.2: flag for review in morning intelligence
```

**F3 — Approval escalation path**
```typescript
// Add to tasks:
// approval_escalate_at TIMESTAMPTZ  (set when task enters pending_approval)
// escalation_level INTEGER DEFAULT 0

// Background worker — every 15 minutes:
// High priority tasks: escalate to Owner after 2 hours
// Normal tasks: include in morning intelligence next day
// Before expiry (48h): final escalation push notification
```

**F4 — Approval race condition (atomic approval)**
```typescript
// ATOMIC approval — prevents double-execution:
const result = await db
  .update(tasks)
  .set({ 
    status: 'approved', 
    approvedBy: userId, 
    approvedAt: new Date() 
  })
  .where(and(
    eq(tasks.id, taskId),
    eq(tasks.status, 'pending_approval'),  // Guard clause
    eq(tasks.companyId, companyId)         // Tenant isolation
  ))
  .returning({ id: tasks.id })

if (result.length === 0) {
  // Another operator approved first — return informational message
  throw new AlreadyProcessedError(taskId)
}
// Only if result.length === 1: execute the action
```

**F5 — Integration disconnection handling**
```typescript
// Pre-flight check when creating a task:
async function validateRequiredIntegrations(
  skillSlug: string, 
  companyId: string
): Promise<void> {
  const capabilities = await getSkillCapabilities(skillSlug)
  for (const integration of capabilities.integrations_required) {
    const cred = await db.query.integrationCredentials.findFirst({
      where: and(
        eq(integrationCredentials.companyId, companyId),
        eq(integrationCredentials.integrationSlug, integration),
        eq(integrationCredentials.status, 'connected')
      )
    })
    if (!cred) {
      throw new IntegrationDisconnectedError(integration)
      // Task state: 'blocked_integration_disconnected'
      // Notification: "Gmail déconnecté — reconnectez pour que Sophie continue" (EMOTIONAL_LAYER.md)
    }
  }
}
```

**F6 — Token budget pre-flight check**
```typescript
// Before EVERY LLM call:
async function checkBudgetBeforeLLMCall(
  companyId: string,
  estimatedTokens: number
): Promise<void> {
  const company = await getCompany(companyId)
  const remaining = company.tokensLimitMonth - company.tokensUsedMonth
  if (remaining < estimatedTokens) {
    // Pause task gracefully — NEVER truncate
    throw new TokenBudgetExceededError(companyId, remaining, estimatedTokens)
    // Task state: 'blocked_budget_exceeded'
    // Notification: "Limite mensuelle atteinte — upgrader pour continuer" (EMOTIONAL_LAYER.md)
  }
}
```

**F7 — Reasoning capture for explainability**
```typescript
// New SSE event type (alongside agent.writing, agent.tool_call):
interface AgentReasoningEvent {
  type: 'agent.reasoning'
  taskId: string
  agentId: string
  fragment: string    // max 120 chars — truncated chain-of-thought fragment
  timestamp: Date
}

// Store in task_execution_events table:
// task_id, event_type, content, created_at
// Available in drill-down panel (v7 spec)
// Never exposed in main UI — only in drill-down on operator request
```

**F8 — Skill version notice on pending approval**
```typescript
// In approval UI — check if skill was updated since task was created:
const taskSkillVersion = task.skillVersion
const currentSkillVersion = await getCurrentSkillVersion(task.skillId)

if (taskSkillVersion !== currentSkillVersion) {
  // Surface notice in approval card:
  // "Cette tâche a été générée avec Sophie v{old}. Sophie v{new} est disponible."
  // (from EMOTIONAL_LAYER.md)
}
```

**T5 — Standardise API response envelope**
```typescript
// ALL API routes must return this shape:
interface APIResponse<T> {
  ok: true
  data: T
}
interface APIError {
  ok: false
  error: {
    code: string      // 'SWWARM_GDPR_VIOLATION' | 'SWWARM_TRUST_INSUFFICIENT' | etc.
    message: string   // Plain French from EMOTIONAL_LAYER.md
    details?: unknown // Dev-only, stripped in production
  }
}

// Implement as Express middleware: responseFormatter
// Wrap all route handlers with try/catch that formats errors to this shape
```

**T10 — Structured logging**
```typescript
// Use pino. Every log entry MUST include:
interface LogEntry {
  timestamp: string  // ISO
  level: string
  traceId: string    // UUID — propagated across BullMQ worker boundaries
  companyId?: string
  agentId?: string
  taskId?: string
  module: string     // 'llm-router' | 'quality-gate' | 'org-memory' | etc.
  message: string
  [key: string]: unknown  // additional context
}

// traceId generation: at task creation. Passed through every BullMQ job payload.
// Every worker logs the traceId from the job payload — never generates a new one.
```

**P2 — API key hashing**
```typescript
// Store ONLY the hash of API keys (for G13 public API):
import { createHash } from 'crypto'

function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

// On creation: show full key ONCE, store hash
// On auth: hash incoming key, compare to stored hash
// On display: show only first 8 chars + "..." (e.g., "swwarm_sk_a1b2c3d4...")
```

**P4 — Trace ID propagation**
```typescript
// In every BullMQ job payload — required field:
interface BaseJobPayload {
  traceId: string     // UUID from original HTTP request or task creation
  companyId: string
  triggeredBy: 'operator' | 'scheduler' | 'agent' | 'webhook'
}

// Worker extracts traceId from job payload and passes to every downstream call
// Log entry: logger.info({ traceId: job.data.traceId, ... }, 'message')
```

**P5 — Transactional outbox for BullMQ jobs**
```typescript
// PROBLEM: Pack installer writes to PostgreSQL then enqueues BullMQ jobs.
// If Redis is down after PG commit, seed tasks never fire.

// FIX: Outbox pattern
// 1. Write job details to pending_jobs table INSIDE the PostgreSQL transaction
// 2. Separate outbox worker (polls every 5s): reads pending_jobs, enqueues in BullMQ, marks sent

interface PendingJob {
  id: string
  queue: string
  payload: object
  created_at: Date
  sent_at?: Date
}

// This guarantees exactly-once job delivery even if Redis is temporarily down
```

**A1 — Pack manifest schema validation**
```typescript
// Zod schema for PackManifest — validated as FIRST step of pack installer:
const PackManifestSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(3).max(100),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().max(500),
  minPlatformVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  agents: z.array(AgentManifestSchema).min(1).max(10),
  skills: z.array(z.string()),
  seed_tasks: z.array(z.string()).length(3),  // exactly 3
  required_integrations: z.array(z.string()),
  optional_integrations: z.array(z.string()),
})

// If validation fails: throw PackManifestInvalidError with specific field errors
// Never proceed to installation with an invalid manifest
```

**A3 — Company DNA extension for packs**
```sql
-- Company DNA has core (platform-defined) + pack_extensions (pack-defined)
ALTER TABLE company_dna 
  ADD COLUMN pack_extensions JSONB NOT NULL DEFAULT '{}';

-- Pack manifest declares its DNA extension schema:
-- "dna_extensions": {
--   "boond_manager_id": { "type": "string", "label": "ID Boond Manager" },
--   "syntec_agreement": { "type": "enum", "values": ["syntec", "other"] }
-- }

-- Onboarding wizard renders questions from core schema + pack extension schema
-- Both are stored in company_dna: core fields + pack_extensions JSONB
```

---

**AG-1 — Parallel multi-agent execution (before 10 customers)**
```typescript
// Orchestrator gains fan-out/fan-in model for parallel subtask groups
// Shared mission working memory — all agents on same mission can read/write

CREATE TABLE mission_context (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id  UUID NOT NULL REFERENCES missions(id),
  company_id  UUID NOT NULL REFERENCES companies(id),
  context_key VARCHAR(100) NOT NULL,
  value       JSONB NOT NULL,
  written_by  UUID NOT NULL REFERENCES agents(id),
  written_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (mission_id, context_key)   -- last write wins
);

interface ParallelGroup {
  group_id:     string
  mission_id:   string
  tasks:        string[]     // task IDs executing in parallel
  status:       'running' | 'complete' | 'partial_failure'
  completed_at: Date | null
}

// CEO Console: all agents in same parallel group show simultaneous pulse
// Delegation arrows connect each to the mission card (not just to each other)
```

**AG-2 — Agent-to-agent peer communication (before 10 customers)**
```sql
-- Lightweight peer channel — NOT tasks, NOT requiring approval
-- Injected into recipient's context on their next execution within the mission

CREATE TABLE agent_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id    UUID NOT NULL REFERENCES missions(id),
  company_id    UUID NOT NULL REFERENCES companies(id),
  from_agent_id UUID NOT NULL REFERENCES agents(id),
  to_agent_id   UUID REFERENCES agents(id),  -- null = broadcast to mission
  content       TEXT NOT NULL,
  message_type  VARCHAR(30) NOT NULL
                CHECK (message_type IN ('question','finding','confirmation','alert')),
  replied_at    TIMESTAMPTZ,
  reply_content TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- INVARIANT: agent messages are informational only
-- No agent message can trigger an external action — only tasks can
-- Approval gate invariant is preserved
```

**AG-9 — Real-time bidirectional steering (before 10 customers)**
```typescript
// POST /api/v1/tasks/:id/steer
// Only valid while task.status === 'running'

interface SteerInstruction {
  task_id:     string
  instruction: string     // plain language: "raccourcis le message"
  operator_id: string
}

// Worker checks for pending steer events at each step boundary
// (same mechanism as cancel_requested flag)
// If steer found: inject as system message into next LLM call:
// "[Instruction de l'opérateur]: " + instruction

// Agent acknowledges in mission thread:
// "Compris — j'applique votre instruction."
// Log to task_execution_events type: 'operator_steer'

// CONSTRAINTS (enforced, not configurable):
// Steer cannot: change target agent, change skill, override approval gates
// Steer can only: influence content, tone, and approach of current execution
```

---

**Gap B — Inline output editing before approval (before 10 customers)**
```typescript
// Operator edits output directly in approval card → approves edited version
// The diff is the highest-signal training data per interaction

interface LiveEditExample {
  skill_id:      string
  task_id:       string
  agent_output:  string   // Sophie's original
  operator_edit: string   // what operator changed it to
  weight:        3.0      // implicit correction (1.0 < this < teaching 2.0... wait, higher is better here)
  source:        'inline_approval_edit'
}
// weight 3.0 = highest signal: operator saw output AND decided to change specific words
// IF no changes made → NO example created. Approving as-is ≠ feedback.
// UI: plain textarea only, no markdown preview, no formatting tools
// Render after approval: "Vous avez modifié 23 caractères — Sophie apprend."
```

**Gap H — Graceful partial output delivery (before 10 customers)**
```typescript
// New task status: 'partial_complete'
// Skills with partial_delivery: true in SKILL.md submit what they completed if a step fails

interface PartialResult {
  completed_items: CompletedItem[]
  failed_items:    FailedItem[]
  completion_pct:  number
  failure_summary: string     // plain French: what failed and why
  retry_available: boolean
}
// partial_complete → appears in 'Votre attention' column (requires decision)
// Operator options: approve partial | request completion of failed items | reject all
// NEVER silently discard completed work because later items failed
```

**Skill copy at pack install (before first customer)**
```typescript
// At pack install: COPY master skills into tenant namespace — do NOT reference
// This is the moment Layer 1 (master) → Layer 2 (tenant) separation happens

async function copyMasterSkillToTenant(
  masterSkillId: string,
  companyId: string,
  agentId: string
): Promise<string> {
  const master = await db.query.skills.findFirst({
    where: and(eq(skills.id, masterSkillId), isNull(skills.sourceCompanyId))
  })

  const [tenantSkill] = await db.insert(skills).values({
    companyId:       companyId,
    agentId:         agentId,
    slug:            master.slug,
    tier:            master.tier,
    gdprRequired:    master.gdprRequired,
    aiActRisk:       master.aiActRisk,
    sourceCompanyId: null,            // NULL = this company owns this copy
    sourceSkillId:   master.id,       // lineage: copied from this master
    masterVersion:   master.currentVersion.version,
  }).returning()

  // Copy current master version as tenant v1.0.0
  await db.insert(skillVersions).values({
    skillId:      tenantSkill.id,
    version:      master.currentVersion.version,
    scope:        'tenant',
    content:      master.currentVersion.content,   // EXACT copy of master content
    testPassRate: master.currentVersion.testPassRate,
    changelog:    `Installed from master ${master.slug} ${master.currentVersion.version}`,
    publishedAt:  new Date(),
  })

  return tenantSkill.id
}

// After this point, tenant's skill evolves independently via:
// M10 self-improvement → new skill versions
// WC-3 live teaching → golden examples (weight 2.0)
// Gap B inline editing → golden examples (weight 3.0)
// AG-7 outcome learning → procedural patterns
// NONE of these touch the master skill
```

**Master skill update merge (before Gap D ships)**
```typescript
// When Swwarm updates master cv_qualification v1.2 → v1.3:
// Tenants receive notification. On accept: merge with preservation strategy.

const SKILL_MERGE_STRATEGY = {
  base_instructions:   'take_master',    // adopt improved base text
  output_schema:       'take_master',    // must adopt for compatibility
  quality_thresholds:  'proportional',   // master changed by X% → adjust tenant by X%
  golden_dataset:      'keep_tenant',    // NEVER overwrite tenant examples
  soul_additions:      'keep_tenant',    // NEVER overwrite tenant soul.md additions
  procedural_patterns: 'keep_tenant',    // NEVER overwrite tenant learned patterns
  trust_calibration:   'keep_tenant',    // NEVER reset trust scores on master update
} as const

// The golden rule: a master update NEVER erases tenant evolution
// It only replaces the base instructions and schema — the foundation, not the learning
```

**Client skill overlay context assembly (for §35 delivery partner)**
```typescript
// Context assembly for a client-scoped task merges FOUR layers:
async function assembleContextForClientTask(task: Task): Promise<AssembledContext> {
  const [tenantSkill, clientOverlay, clientMemory, firmMemory, clientDNA, firmDNA] =
    await Promise.all([
      getTenantSkill(task.companyId, task.skillId),              // Layer 2: evolved copy
      getClientOverlay(task.clientContextId, task.skillId),      // Layer 3: thin overlay
      getOrgMemory(task.companyId, task.clientContextId),        // ALWAYS client-scoped
      getOrgMemory(task.companyId, null),                        // firm-level only
      getClientDNA(task.clientContextId),
      getCompanyDNA(task.companyId),
    ])
  // Merge order: firmDNA → clientDNA → tenantSkill → clientOverlay
  // Later layers add specificity without replacing earlier ones
  return mergeContextLayers(firmDNA, clientDNA, tenantSkill, clientOverlay,
                             clientMemory, firmMemory)
}
// Invariant: clientMemory query ALWAYS filters by client_context_id
// Invariant: clientOverlay may be null — skill works fine without it
```

**Gap J — Pack update migration path (before 10 customers)**
```typescript
// Migration steps declared in pack.json — run atomically on update approval
type MigrationStepType =
  | 'add_wizard_question'    // surfaces in mini-wizard, optional or required
  | 'rename_dna_field'       // auto-migrate existing values
  | 'deprecate_dna_field'    // archive, NEVER delete
  | 'add_agent'              // onboard alongside existing agents
  | 'remove_skill'           // deactivate gracefully
  | 'update_quality_threshold'

// Migration transaction rules:
// ✓ Run as single atomic transaction
// ✓ Required wizard questions block until answered
// ✓ Rollback entirely if any step fails
// ❌ NEVER delete org_memory, task history, or core Company DNA fields
```

**Client context isolation invariant (before Delivery Partner launch)**
```typescript
// CRITICAL INVARIANT: org_memory from Client A NEVER appears in Client B's context
// Enforced at the DB query level — not application logic

// Context assembly for client-scoped task:
async function assembleContext(task: Task): Promise<AssembledContext> {
  const [firmDNA, clientDNA, clientMemory, firmMemory, skill] = await Promise.all([
    getCompanyDNA(task.companyId),
    task.clientContextId ? getClientDNA(task.clientContextId) : null,
    getOrgMemory(task.companyId, task.clientContextId),   // ALWAYS scoped
    getOrgMemory(task.companyId, null),                    // firm-level only
    getSkillInstructions(task.skillId),
  ])
  return merge(firmDNA, clientDNA, clientMemory, firmMemory, skill)
}

// getOrgMemory ALWAYS includes client_context_id in WHERE clause
// When clientContextId is NULL: WHERE client_context_id IS NULL (firm-level only)
// When clientContextId is set: WHERE client_context_id = $contextId
// NEVER: WHERE client_context_id IS NULL OR client_context_id = $contextId
//        (this would leak firm-level memory into client context — FORBIDDEN)

// Deletion cascade: deleting a client_context cascades to ALL:
//   org_memory, tasks, missions, goals WITH that client_context_id
//   Required for GDPR right to be forgotten
```

**Gap K — Session gap awareness (before 10 customers)**
```typescript
// When operator opens app after ≥6h absence: show 1-screen briefing overlay first
interface SessionGapBriefing {
  gap_hours:       number
  tasks_completed: number
  tasks_pending:   number        // in 'Votre attention' column
  goals_updated:   GoalSummary[]
  notable_events:  string[]      // max 3 one-liners, plain French
}
// Track users.last_active_at on every authenticated request
// Fire on: (now - last_active_at) > 6h at app open
// One screen max — "Voir le tableau de bord →" dismisses to normal CEO Console
// NOT the same as morning intelligence (daily/8am). Fires any time of day after absence.
```

---

### MEDIUM PRIORITY — fix before 50 customers

**AG-6 — Procedural memory (at 50 customers)**
```sql
-- Agents learn HOW to do things, not just WHAT they know
-- Injected as "Préférences apprises:" section in skill instructions

CREATE TABLE procedural_patterns (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID NOT NULL REFERENCES companies(id),
  skill_id             UUID NOT NULL REFERENCES skills(id),
  agent_id             UUID REFERENCES agents(id),
  pattern_description  TEXT NOT NULL,
  trigger_condition    TEXT NOT NULL,
  behaviour            TEXT NOT NULL,
  outcome_lift         DECIMAL(5,2),
  sample_size          INTEGER,
  confidence           DECIMAL(4,3),
  source               VARCHAR(30) NOT NULL
                       CHECK (source IN ('outcome_attribution','operator_correction','collective_intelligence')),
  active               BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);
-- Minimum before promotion: 5 positive + 5 negative missions, confidence >= 0.80
-- Operator can review and deactivate in Gap F agent configuration panel
```

**AG-7 — Outcome-based learning (at 50 customers)**
```typescript
// Outcome attribution pipeline — runs when mission outcome is recorded (WC-1)
// Links business outcomes to specific agent decisions that contributed to them

interface OutcomeAttribution {
  outcome_id:          string
  mission_id:          string
  outcome_value:       'positive' | 'negative' | 'neutral'
  contributing_tasks:  AttributedTask[]
}

interface AttributedTask {
  task_id:             string
  agent_id:            string
  skill_id:            string
  contribution_score:  number    // 0-1: estimated causal contribution
  key_decision:        string    // the specific output element attributed
}

// Attribution: trace mission task graph, weight by temporal proximity to outcome
// Unmodified outputs get higher attribution (operator approved exactly as-is)
// Patterns appearing in positive but not negative missions → procedural_patterns
```

**AG-10 — Production behavioral monitoring (at 50 customers)**
```sql
-- Catch agent drift before customers notice it
-- Baselines established after 30+ tasks per skill per company

CREATE TABLE behavioral_baselines (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id            UUID NOT NULL REFERENCES skills(id),
  company_id          UUID NOT NULL REFERENCES companies(id),
  avg_judge_score     DECIMAL(4,2),
  avg_output_tokens   INTEGER,
  avg_tool_calls      DECIMAL(4,2),
  avg_execution_ms    INTEGER,
  approval_rate       DECIMAL(4,3),
  recycle_rate        DECIMAL(4,3),
  baseline_task_count INTEGER,
  established_at      TIMESTAMPTZ DEFAULT NOW(),
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
-- Anomaly threshold: deviation > 2 std deviations OR judge score drop > 0.8pts
-- Surface in admin portal (§21) only — never alert operators directly
-- Baselines refreshed every 90 days
```

**AG-11 — Cross-session narrative coherence (at 50 customers)**
```sql
-- Platform maintains company story above individual tasks and missions
-- Injected into orchestrator preamble alongside Company DNA

CREATE TABLE company_narrative (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES companies(id),
  period_start   DATE NOT NULL,
  period_end     DATE NOT NULL,
  narrative_md   TEXT NOT NULL,
  key_events     JSONB NOT NULL,    -- [{date, type, description, impact}]
  momentum       VARCHAR(20) NOT NULL
                 CHECK (momentum IN ('accelerating','stable','decelerating')),
  focus_areas    TEXT[],
  generated_at   TIMESTAMPTZ DEFAULT NOW()
);
-- Monthly generation job: synthesises mission history, goal progress,
-- outcome records, org memory trends
-- Orchestrator uses this to frame new missions contextually
```

**AG-12 — Federated live data queries (at 100 customers)**
```typescript
// New action type: query_integration
// Agents query live system state, not just cached org memory

interface QueryIntegrationAction {
  type:             'query_integration'
  integration_slug: string
  query_template:   string       // pre-defined query name from connector manifest
  params:           Record<string, string>
  gdpr_required:    boolean      // true → response stays in T1_FR context only
  cache_result:     boolean      // true → write result to org_memory after query
}

// Each connector declares available query_templates in its manifest
// Queries are pre-defined — NOT arbitrary API calls — security boundary maintained
// Results scoped to current task context only
```

---

**Gap A — Non-determinism debugging (at 50 customers)**
```sql
-- Track output variance per skill per company — catch quality drift
CREATE TABLE skill_variance_metrics (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id         UUID NOT NULL REFERENCES skills(id),
  company_id       UUID NOT NULL REFERENCES companies(id),
  period_start     DATE NOT NULL,
  judge_score_mean DECIMAL(4,2),
  judge_score_std  DECIMAL(4,2),
  variance_flag    BOOLEAN NOT NULL DEFAULT false,  -- true if std > 1.2
  computed_at      TIMESTAMPTZ DEFAULT NOW()
);
-- Replay: re-run any task with original context snapshot (from task_checkpoints)
-- Compare original vs replay output — show diff and both judge scores to operator
-- High-variance skills flagged in admin portal only (never surfaced to operators)
```

**Gap D — Model upgrade resilience (at 50 customers)**
```typescript
// Pin skills to specific model versions — test before migrating to new version
// LLM router reads skill_model_pins to route each skill to its pinned version

interface SkillModelPin {
  skill_id:       string
  model_version:  string    // e.g. "mistral-small-3.2-20250601" NOT just "T1_FR"
  pinned_reason:  'upgrade_blocked_by_regression' | 'manual_pin'
}
// Pre-upgrade: run regression suite against new model (AG regression §32)
// Pass (delta ≥ -0.5) → auto-migrate model_version
// Fail → keep old pin, flag in admin portal for team review
```

**Gap F — Semantic caching (at 50 customers)**
```typescript
// 30–40% LLM cost reduction at scale — stored in Redis (already deployed)
const CACHE_TTL = {
  market_intelligence: 4 * 3600,
  formatting_drafting: 24 * 3600,
  cv_qualification:    2 * 3600,
  personalised_comms:  0,           // NEVER cache — personalised by definition
}
// Cache hit: cosine_similarity(context_embedding, cache_embedding) > 0.95
// CRITICAL: NEVER cache where gdpr_required: true — GDPR invariant extends to caching
// Admin portal: show hit rate and estimated monthly cost saving per company
```

**Gap G — Agent-initiated task proposals (at 50 customers)**
```sql
-- Agents propose tasks (not just surface signals) — operator accepts or declines
CREATE TABLE agent_proposals (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID NOT NULL REFERENCES companies(id),
  proposing_agent_id   UUID NOT NULL REFERENCES agents(id),
  proposed_agent_id    UUID NOT NULL REFERENCES agents(id),
  trigger              TEXT NOT NULL,         -- what was observed
  proposed_task_brief  TEXT NOT NULL,         -- what the task would do
  estimated_value      TEXT NOT NULL,         -- plain French one-liner
  urgency              VARCHAR(20) NOT NULL CHECK (urgency IN ('high','normal','low')),
  status               VARCHAR(20) NOT NULL DEFAULT 'pending',
  expires_at           TIMESTAMPTZ NOT NULL,  -- 48h default
  decided_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);
-- Declined 3× for same trigger → raise threshold (anti-fatigue)
-- Surfaced as 'agent_proposal' morning intelligence card type
```

**Gap I — Cost attribution per mission/goal/agent (at 50 customers)**
```sql
-- Extend cost_entries (M7) to enable granular ROI calculation (WC-1)
ALTER TABLE cost_entries ADD COLUMN mission_id UUID REFERENCES missions(id);
ALTER TABLE cost_entries ADD COLUMN goal_id    UUID REFERENCES goals(id);
ALTER TABLE cost_entries ADD COLUMN agent_id   UUID REFERENCES agents(id);
-- CEO Console mission detail: "Cette mission a coûté €2.40"
-- Goal ROI: outcome_value / SUM(cost WHERE goal_id = ?) → surfaces in goal detail view
```

**Gap L — Explainability-privacy compliance spec (at 50 customers)**
```typescript
// AI Act Article 13 (explain) vs GDPR Article 5 (minimisation) — formal resolution

// In CounterfactualExplanation (AG-14) — TWO formats generated:
interface CounterfactualExplanation {
  external_safe: string[]  // self-referential only — safe for affected persons
  // ✓ "Ce profil ne répond pas au critère: React 5 ans requis (non vérifié)"
  // ✗ "Un autre candidat avait une meilleure maîtrise" ← GDPR violation

  internal_full: string[]  // may include comparative context
  // Access-controlled: operators only, NEVER shown to affected persons
}
// external_safe → AI Act compliance export (WC-14)
// internal_full → operator approval card only (role-gated)
```

**Gap M — Contact timing optimisation (at 100 customers)**
```sql
-- Learn optimal send times from response patterns — 3+ responses required
ALTER TABLE contacts ADD COLUMN preferred_contact_time JSONB;
-- {"day_of_week": [1,2], "hour_range": [8,10], "confidence": 0.8, "observations": 5}

-- Weekly pattern job: compute response rate by day/hour per contact
-- confidence > 0.7 → update preferred_contact_time
-- At execution: if optimal window exists AND gap < 24h AND not in window now
--   → schedule as BullMQ delayed job to optimal window
-- Show: "Marc enverra mardi matin (meilleur taux de réponse pour ce contact)"
-- Operator override always available — this is a suggestion, not a constraint
```



**T1 — Eliminate N+1 queries in context assembly**
```typescript
// assembleContext() must fire ALL queries in parallel:
async function assembleContext(taskId: string) {
  const [companyDNA, contacts, orgMemory, skillInstructions, history] = 
    await Promise.all([
      fetchCompanyDNA(companyId),
      fetchRelevantContacts(companyId, taskContext),
      fetchOrgMemory(companyId, taskContext, limit: 10),
      fetchSkillInstructions(skillId),
      fetchTaskHistory(companyId, agentId, limit: 5)
    ])
  return assembleIntoContext([companyDNA, contacts, orgMemory, skillInstructions, history])
}
// Never sequential awaits in context assembly
```

**T2 — pgvector HNSW index**
```sql
-- For datasets < 500k vectors (current scale): HNSW is faster
-- Replace IVFFlat with HNSW:
DROP INDEX IF EXISTS org_memory_embedding_idx;
CREATE INDEX org_memory_embedding_idx 
  ON org_memory 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- When to switch to IVFFlat: when any company has > 500k memory entries
-- Document this threshold in migrations/README.md
```

**T3 — Pin embedding model**
```typescript
// In config — MUST match the model used to generate existing embeddings:
const EMBEDDING_CONFIG = {
  model: 'mistral-embed',    // Mistral EU embedding API
  dimensions: 1024,
  // WARNING: changing this model requires re-embedding ALL existing org_memory
  // Run: yarn scripts/re-embed-all --confirm before any model change
}
```

**T4 — BullMQ job cleanup**
```typescript
// In queue configuration:
const agentQueue = new Queue('agent', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: { count: 1000, age: 86400 },  // 1000 jobs or 24h
    removeOnFail: { count: 500, age: 604800 },       // 500 jobs or 7 days
  }
})
// This prevents Redis memory growth in production
```

**T6 — Redis connection resilience**
```typescript
// BullMQ connection with retry:
const redisConnection = new IORedis({
  maxRetriesPerRequest: null,   // Required by BullMQ
  retryStrategy: (times) => Math.min(times * 100, 3000),
  reconnectOnError: (err) => err.message.includes('READONLY'),
})

// Health check endpoint:
// GET /api/v1/health → { redis: 'ok'|'degraded', postgres: 'ok'|'degraded' }
// If Redis is down: queue new tasks in PostgreSQL pending_jobs (outbox), resume on recovery
```

**T8 — Vault key versioning**
```typescript
// Credentials store which key version encrypted them:
interface EncryptedCredential {
  encrypted: string
  keyVersion: number    // Increment when rotating keys
  iv: string
}

// Key rotation procedure:
// 1. Generate new AES-256 key → store as KEY_V{n}
// 2. Run: yarn scripts/rotate-vault-keys
//    → Decrypts each credential with old key version
//    → Re-encrypts with new key version
//    → Updates keyVersion field
// Document this procedure in OPERATIONS.md
```

**P1 — Content Security Policy**
```typescript
// Express middleware — add to all responses:
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",  // Tailwind requires this
    "connect-src 'self' https://api.openrouter.ai https://api.mistral.ai",
    "img-src 'self' data: https:",
    "frame-ancestors 'none'",
  ].join('; '))
  next()
})
```

**P3 — Three-tier rate limiting**
```typescript
// Per-IP: 1000 req/hour (blocks bots)
// Per-user: 100 req/minute (blocks brute force)
// Per-company: 10000 req/hour (prevents abuse)
// Auth endpoints: 20 attempts/15 minutes per IP (stricter)

// Use express-rate-limit with Redis store for distributed deployment
```

**A2 — Pack version compatibility**
```typescript
// In pack manifest:
// "minPlatformVersion": "1.2.0"

// In pack installer — first validation step:
const PLATFORM_VERSION = process.env.PLATFORM_VERSION ?? '1.0.0'
if (!semver.gte(PLATFORM_VERSION, manifest.minPlatformVersion)) {
  throw new PackIncompatibleError(
    manifest.slug,
    manifest.minPlatformVersion,
    PLATFORM_VERSION
  )
}
```

**A4 — Action type registry (open for extension)**
```typescript
// Replace hardcoded action type enum with registry:
const actionTypeRegistry = new Map<string, ActionTypeHandler>()

// Register built-in actions:
actionTypeRegistry.set('send_email', emailActionHandler)
actionTypeRegistry.set('create_document', documentActionHandler)
actionTypeRegistry.set('web_search', webSearchHandler)
actionTypeRegistry.set('handoff_to', handoffHandler)
actionTypeRegistry.set('clarify', clarifyHandler)
actionTypeRegistry.set('batch', batchHandler)

// Integration connectors register additional types when connected:
// actionTypeRegistry.set('send_whatsapp', whatsappHandler)
// actionTypeRegistry.set('create_hubspot_deal', hubspotHandler)

// Unknown action type at task creation: throw ActionTypeUnknownError (never at runtime)
```

---

## Build sequence (dependency order)

### Complete current modules first
```
M13  CEO Console proactive mode          ← finish this first (in progress)
M14  Stripe billing
M15  SSE granular events
```

### Critical fixes (before ANY new feature)
```
C1   Task state machine (DB trigger)
C2   Agent collision detection
C3   Task cancellation
C4   Per-company queue rate limiting
C5   Pack template injection sanitisation
C6   LLM response failure states
C7   Input guardrails (injection, scope, PII)
C8   LLM-as-judge layer
C9   Constitutional self-critique
```

### Platform blocking gaps (before Pack P1 launches)
```
G1   i18n architecture (company.locale + company.timezone)
G2   Agent capability declaration (SKILL.md frontmatter)
G3   RBAC (company_members + role enforcement)
G4   Inbound webhooks
G5   Human clarification flow (awaiting_clarification state)
```

### High priority fixes (before 10 customers)
```
F1   Memory conflict resolution
F2   Memory staleness detection
F3   Approval escalation path
F4   Approval race condition (atomic approval)
F5   Integration disconnection handling
F6   Token budget pre-flight check
F7   Reasoning capture (agent.reasoning SSE event)
F8   Skill version notice on pending approval
T5   API response envelope standardisation
T10  Structured logging (pino)
P2   API key hashing
P4   Trace ID propagation
P5   Transactional outbox
A1   Pack manifest Zod validation
A3   Company DNA extension schema
AG-1 Parallel multi-agent execution
AG-2 Agent-to-agent peer communication
AG-9 Real-time bidirectional steering
```

### Agentic platform + world-class gaps
```
Before first customer:
  AG-3  Task checkpointing + resume
  AG-4  Multi-factor confidence scoring
  AG-8  Hybrid reasoning (rule-based steps)
  Gap C Trust bootstrapping protocol
  Gap E Zero-tolerance action classes
  Gap N SLA tiers formally specced

At 10 design partners:
  Gap B  Inline output editing
  Gap H  Graceful partial output delivery
  Gap J  Pack update migration path
  Gap K  Session gap awareness

At 50 customers:
  AG-6   Procedural memory
  AG-7   Outcome-based learning
  AG-10  Production behavioral monitoring
  AG-11  Cross-session narrative coherence
  Gap A  Non-determinism debugging
  Gap D  Model upgrade resilience
  Gap F  Semantic caching
  Gap G  Agent-initiated task proposals
  Gap I  Cost attribution per mission/goal
  Gap L  Explainability-privacy compliance

At 100 customers:
  AG-12  Federated live data queries
  AG-13  Calibrated uncertainty expression
  AG-14  Counterfactual explainability
  Gap M  Contact timing optimisation

Post-Series A:
  AG-15  Dynamic skill composition at runtime
  Gap O  Agent fleet registry
  Computer use / browser automation (dedicated infra budget)

Partner programme (§34–§35):
  Month 6:   Model 3 Implementation Partner
             → partner flag + referral tracking on users/companies tables
             → certification docs (no platform build)
  Month 12:  Model 1 Reseller/VAR
             → partner dashboard React component
             → wholesale billing tier in Stripe (M14)
             → white-label config table
  Month 18:  Model 2 Delivery Partner
             → client_contexts table (§35 Phase 1)
             → client_context_id on org_memory, tasks, missions, goals
             → context assembly scoping update (CRITICAL — isolation invariant)
             → CEO Console client selector dropdown
             → client DNA mini-wizard
             → Delivery Partner Stripe pricing tier
```

### Product gaps (before first customer)
```
Gap A  Customer self-service onboarding
Gap B  Multi-tenant customer portal (app.swwarm.com)
Gap C  Swwarm admin portal (admin.swwarm.com)
Gap H  PWA (1 session: manifest + service worker + WebAuthn)
Gap D  Skill management system
Gap E  Notification system
Gap F  Agent configuration UI (two-tab: soul + skills)
```

### War Room additions (CEO Console visual layer)
```
WAR-1  Agent fields: colour, display_name, status, soul_md
WAR-2  soul.md generation at pack install
WAR-3  Mission tables + migrations
WAR-4  Mission API endpoints
WAR-5  Orchestrator preamble + team-roster.md
WAR-6  Operatives floor React component
WAR-7  Delegation arrows SVG (marching ants)
WAR-8  Agent drill-down panel
WAR-9  Auto-nudge BullMQ worker
WAR-10 Dispatcher health indicator
WAR-11 Gap F retrain modal (two-tab)
WAR-12 Mission archive page
```

### Platform depth (parallel with customer acquisition)
```
G6   Streaming LLM
G7   Agent versioning
G8   Task DAG dependencies
G9   Batch processing
G10  GDPR compliance export (anonymise_contact)
G11  Multi-modal input
Medium fixes: T1 T2 T3 T4 T6 T8 P1 P3 A2 A4
```

### Ecosystem (at 200+ customers)
```
G12  MCP server
G13  Public API + SDK
G14  A2A protocol
G15  Plugin system
Gap G WhatsApp Business API
```

---

## Key constants

```typescript
// LLM routing
const MODEL_REGISTRY = {
  T0:    'mistralai/ministral-3b',
  T1_FR: 'mistralai/mistral-small-3.2',    // GDPR-safe, EU only
  T1_EN: 'deepseek/deepseek-chat-v3-5',    // NEVER for personal data
  T2_S:  'google/gemini-flash-1.5',
  T2_Q:  'mistralai/mistral-medium-3.1',   // GDPR-safe
  T3:    'anthropic/claude-sonnet-4-5',
}

// Embedding
const EMBEDDING_CONFIG = {
  model: 'mistral-embed',
  dimensions: 1024,
}

// Trust Score
const TRUST_WEIGHTS = {
  qualityRating:  0.50,
  gatePassRate:   0.30,
  schemaPassRate: 0.20,
  windowDays:     30,
}

// Autonomy thresholds
const AUTONOMY_THRESHOLDS = {
  manual:       { max: 2.9 },
  supervised:   { min: 3.0, max: 3.9 },
  spot_checked: { min: 4.0, max: 4.7 },
  autonomous:   { min: 4.8 },  // hard cap — external comms only at 4.8+
}

// Agent colours (ONLY these 6)
const AGENT_COLOURS = ['#3B82F6','#10B981','#F59E0B','#8B5CF6','#EF4444','#14B8A6']

// Plan limits
const PLAN_LIMITS = {
  solo:       { tasksPerMonth: 500,   tokensPerMonth: 5_000_000,   agents: 2   },
  growth:     { tasksPerMonth: 2000,  tokensPerMonth: 20_000_000,  agents: 6   },
  pro:        { tasksPerMonth: 6000,  tokensPerMonth: 60_000_000,  agents: 15  },
  enterprise: { tasksPerMonth: 99999, tokensPerMonth: 999_000_000, agents: 999 },
}

// Queue concurrency per company
const COMPANY_CONCURRENCY = {
  solo: 2, growth: 5, pro: 10, enterprise: 25
}
```

---

## Data model additions (v7 + v8 + audit)

```sql
-- Agent identity (v7)
ALTER TABLE agents ADD COLUMN colour VARCHAR(7) NOT NULL DEFAULT '#3B82F6';
ALTER TABLE agents ADD COLUMN display_name VARCHAR(50) NOT NULL;
ALTER TABLE agents ADD COLUMN status VARCHAR(15) NOT NULL DEFAULT 'active';
ALTER TABLE agents ADD COLUMN soul_md TEXT;
ALTER TABLE agents ADD COLUMN team_roster_visible BOOLEAN NOT NULL DEFAULT true;

-- Audit: status CHECK constraint
-- CHECK (status IN ('active','paused','deactivated'))
-- Colour CHECK: CHECK (colour IN ('#3B82F6','#10B981','#F59E0B','#8B5CF6','#EF4444','#14B8A6'))

-- Missions (v7)
CREATE TABLE missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  title VARCHAR(200) NOT NULL,
  brief TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft','active','blocked','complete','archived')),
  orchestrator_id UUID REFERENCES agents(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ
);

CREATE TABLE mission_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES missions(id),
  role VARCHAR(20) NOT NULL CHECK (role IN ('user','orchestrator','system')),
  content TEXT NOT NULL,
  agent_id UUID REFERENCES agents(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE mission_tasks (
  mission_id UUID NOT NULL REFERENCES missions(id),
  task_id UUID NOT NULL REFERENCES tasks(id),
  PRIMARY KEY (mission_id, task_id)
);

-- Task execution events (for reasoning capture F7)
CREATE TABLE task_execution_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  event_type VARCHAR(50) NOT NULL,  -- 'tool_call' | 'reasoning' | 'output'
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON task_execution_events(task_id);

-- Outbox for BullMQ jobs (P5)
CREATE TABLE pending_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

-- Platform health cache
CREATE TABLE platform_health_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  dispatcher_up BOOLEAN NOT NULL,
  queue_depth JSONB,
  integration_status JSONB,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contact collision tracking (C2)
-- Add to contact_events: event_type including 'external_communication'

-- Task: add cancel_requested and failure_reason
ALTER TABLE tasks ADD COLUMN cancel_requested BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tasks ADD COLUMN failure_reason VARCHAR(50);
-- CHECK (failure_reason IN ('failed_schema_validation','failed_quality_gate',
--   'failed_llm_unavailable','failed_tool_error','failed_budget_exceeded','failed_permanent'))

-- Company DNA extension (A3)
ALTER TABLE company_dna ADD COLUMN pack_extensions JSONB NOT NULL DEFAULT '{}';

-- §34 PARTNER PROGRAMME
ALTER TABLE users ADD COLUMN is_partner           BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN partner_certified_at  TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN partner_tier          VARCHAR(20)
  CHECK (partner_tier IN ('certified','silver','gold'));

ALTER TABLE companies ADD COLUMN referred_by_partner_id UUID REFERENCES users(id);
ALTER TABLE companies ADD COLUMN referral_fee_paid       BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE partner_referral_fees (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id  UUID NOT NULL REFERENCES users(id),
  company_id  UUID NOT NULL REFERENCES companies(id),
  amount_eur  DECIMAL(8,2) NOT NULL,
  paid_at     TIMESTAMPTZ,
  payment_ref VARCHAR(100),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE partner_white_label_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id      UUID NOT NULL REFERENCES users(id),
  brand_name      VARCHAR(100) NOT NULL,
  logo_url        VARCHAR(500),
  primary_colour  VARCHAR(7),
  support_email   VARCHAR(200),
  custom_domain   VARCHAR(200),
  show_powered_by BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- §35 CLIENT CONTEXT ARCHITECTURE
CREATE TABLE client_contexts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id),
  name         VARCHAR(200) NOT NULL,
  slug         VARCHAR(100) NOT NULL,
  client_dna   JSONB NOT NULL DEFAULT '{}',
  status       VARCHAR(20) NOT NULL DEFAULT 'active'
               CHECK (status IN ('active','paused','archived')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_id, slug)
);
CREATE INDEX ON client_contexts(company_id, status);

-- Scope org_memory, tasks, missions, goals to client contexts
-- NULL = firm-level (belongs to consulting firm, not any specific client)
ALTER TABLE org_memory ADD COLUMN client_context_id UUID REFERENCES client_contexts(id);
ALTER TABLE tasks      ADD COLUMN client_context_id UUID REFERENCES client_contexts(id);
ALTER TABLE missions   ADD COLUMN client_context_id UUID REFERENCES client_contexts(id);
ALTER TABLE goals      ADD COLUMN client_context_id UUID REFERENCES client_contexts(id);
CREATE INDEX ON org_memory(company_id, client_context_id);
CREATE INDEX ON tasks(company_id, client_context_id);
```

---

---

## Platform design philosophy (§31) — governs all UI and architecture decisions

These are constraints, not guidelines. Every implementation decision is checked against them.

---

### Cognitive compression — the primary UI constraint

Every UI element is evaluated against one question: does it reduce mental load or add to it?

```
OPERATORS NEVER SEE:          OPERATORS ALWAYS SEE:
Token counts                  Task outcome in plain French
Model names                   Agent display_name only
Confidence percentages        Trust level in words ("autonome")
Queue depth numbers           "Tout fonctionne normalement"
Technical error messages      Actionable plain-language message
Spinning neural networks      Agent LED + colour only
```

**Hard rules for every React component:**
- Maximum 3 distinct visual states per component: idle / active / attention-required
- Agent running states: colour + LED only, no text label
- Animations only for state transitions, never decorative
- No loading spinners for operations under 400ms
- Every approval card readable and actionable in under 10 seconds

**Test before shipping any UI component:** can a non-technical 45-year-old SMB founder understand what this screen wants them to do in under 5 seconds? If not, compress further.

---

### Calm interface — tone rules for all user-facing strings

All copy from EMOTIONAL_LAYER.md. These rules govern EMOTIONAL_LAYER.md authoring.

```
NEVER:                                ALWAYS:
"Sophie a peut-être terminé..."   →   "Sophie a terminé."
"Quelques résultats disponibles"  →   "3 profils qualifiés ce matin"
"Probabilité 87% d'autonomie"     →   "Sophie agit seule sur ce type de tâche"
"Voulez-vous vérifier?"           →   "Voir →" (one action, no question)
"Une erreur s'est produite"       →   "Sophie ne peut pas envoyer d'emails
                                       pendant la reconnexion — les autres
                                       tâches continuent normalement."
```

**Stress test:** when something goes wrong (damage control, failed task, service down), the UI must be calmer and more precise than normal — not more alarming. Urgency is communicated by priority and placement, never by visual intensity.

---

### AI evaluation infrastructure — implementation spec

The AI Evaluation / Reliability Engineer owns this. It must exist before the first customer.

**1 — Hallucination check on every external output**

```typescript
interface HallucinationCheck {
  output_id:    string
  claim:        string          // extracted factual claim from output
  source:       string | null   // supporting text found in context
  verdict:      'supported' | 'unsupported' | 'contradicted'
  confidence:   number          // 0-1
}

// Run after quality gates, before approval notification
// If any verdict === 'contradicted': block output, route to damage control
// If unsupported claims > threshold: surface warning in approval card
async function runHallucinationCheck(
  output: string,
  context: AssembledContext
): Promise<HallucinationCheck[]>
```

**2 — Regression suite per skill**

Every skill has a regression test suite. Runs on every version update before promotion.

```typescript
interface RegressionResult {
  skill_id:             string
  version_candidate:    string
  version_baseline:     string
  examples_run:         number
  avg_quality_candidate: number
  avg_quality_baseline:  number
  delta:                number     // candidate - baseline
  promoted:             boolean    // false if delta < -0.5
  blocked_reason:       string | null
}

// Promotion threshold: delta must be >= -0.5 (can be equal or better)
// If blocked: create SelfOrganisationProposal type 'regression_detected'
// Never auto-promote a skill that regresses more than 0.5 points
```

**3 — Autonomy safety evaluation before tier upgrade**

Before any skill is promoted to a higher autonomy tier:

```typescript
interface AutonomySafetyEval {
  skill_id:         string
  current_tier:     AutonomyTier
  proposed_tier:    AutonomyTier
  edge_cases_run:   number           // min 10 edge cases
  safe_responses:   number           // agent escalated or clarified correctly
  unsafe_responses: number           // agent proceeded when it should not have
  safety_rate:      number           // safe / total
  passed:           boolean          // safety_rate >= 0.95 required
}

// Edge cases: ambiguous input, malformed data, quality gate boundary,
// contact collision scenario, GDPR-sensitive data in wrong tier
// If passed: show results in WC-5 simulation UI before operator confirms
// If not passed: block tier upgrade, show specific failing cases
```

**4 — Memory correctness testing (weekly background job)**

```typescript
// Per company, per installed pack
// Run canonical queries against org memory
// Compare results to expected answers (set at pack install from Company DNA)
interface MemoryCorrectnessTest {
  company_id:       string
  query:            string
  expected_answer:  string    // set at install, updated by operator
  actual_answer:    string    // retrieved via pgvector search
  match_score:      number    // semantic similarity 0-1
  passed:           boolean   // match_score >= 0.85
}
// If avg match_score < 0.80 for a company: flag in morning intelligence
// "La mémoire de votre équipe pourrait bénéficier d'une mise à jour"
```

---

### Operational embedding depth — implementation spec

Primary retention metric. Tracks what % of a company's daily operations run through Swwarm.

**SQL table:**

```sql
CREATE TABLE embedding_metrics (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id               UUID NOT NULL REFERENCES companies(id),
  week_start               DATE NOT NULL,
  tasks_by_agent           JSONB,        -- {agent_slug: task_count}
  distinct_workflow_types  INTEGER,      -- count of different task categories
  human_time_saved_hours   DECIMAL(8,2), -- estimated from task type + duration
  autonomous_task_pct      DECIMAL(5,2), -- % of tasks completed without approval
  embedding_score          DECIMAL(5,2), -- 0-100 composite
  computed_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_id, week_start)
);
```

**Embedding score formula:**

```typescript
function computeEmbeddingScore(metrics: WeekMetrics): number {
  const taskVolume   = Math.min(metrics.taskCount / 50, 1) * 25     // max 25 pts
  const workflowBreadth = Math.min(metrics.workflowTypes / 8, 1) * 25  // max 25 pts
  const autonomyPct  = (metrics.autonomousTaskPct / 100) * 25       // max 25 pts
  const timeSaved    = Math.min(metrics.timeSavedHours / 10, 1) * 25 // max 25 pts
  return Math.round(taskVolume + workflowBreadth + autonomyPct + timeSaved)
}
```

**Where it surfaces:**

```
Admin portal (§21):     embedding_score per customer, week-on-week trend
                        < 20 and declining → at-risk flag (amber)
                        > 60 and stable    → expansion candidate (green)

CEO Console:            plain language only, never the score itself
                        "Votre équipe gère 34% de vos opérations courantes.
                         Voici 2 domaines où elle pourrait faire plus." [→]
                        surfaces as a weekly_review card section when
                        embedding_score < 40 or grew > 10pts this week
```

---

### Delegation psychology — UX rules for approval and trust UI

The three psychological barriers to delegation and the platform's response to each.

**Barrier 1 — Loss of control**

Response: graduated autonomy. Never a binary "delegate everything" decision.

```
UI rule: the operator always sees WHAT an autonomous agent did,
         not just THAT it did it.

NEVER: "Sophie a envoyé 3 emails."
ALWAYS: "Sophie a envoyé 3 emails. [Voir les messages →]"

The inspector is always one tap away. Never hidden after autonomous execution.
```

**Barrier 2 — Accountability gap**

Response: every task card shows the human decision point in the chain.

```
UI rule: every completed task card shows:
  "Approuvé par [operator name] le [date] à [time]"
  OR
  "Exécuté en autonomie — Sophie niveau [trust_level], [N] tâches similaires"

The operator is always in the chain. Always explicit. Never hidden.
```

**Barrier 3 — Competence uncertainty**

Response: trust score communicated as evidence, never as abstraction.

```
NEVER: "Score de confiance: 4.2/5"
ALWAYS: "Sophie a qualifié 23 candidatures ce mois. 21 correspondaient
         exactement à votre évaluation. 2 corrections mineures."

Same data. Human terms. Operator decides based on what they understand.
```

**Trust upgrade proposal copy (from EMOTIONAL_LAYER.md pattern):**

```
"Sophie a géré [N] [task_type] consécutives avec une note de [score]/5
 et aucun incident. Elle est prête à agir seule sur ce type de tâche.

 Si vous acceptez :
 → Plus besoin de valider chaque [task_type]
 → Sophie continue à vous informer le matin
 → Vous gardez le contrôle total — cette décision est réversible

 Accepter l'autonomie  |  Garder la validation"
```

The last line is always present: "cette décision est réversible." Delegation is never permanent in the operator's mental model.

---

## When starting a new session

1. Read this file (CLAUDE.md) fully
2. Identify which item from the build sequence you are implementing
3. If implementing a finetune item (C1-C6, F1-F8, T1-T10, P1-P6, A1-A5): follow the exact code patterns above
4. If implementing a new module: read the relevant section of PLATFORM_FUNCTIONAL_SPEC_v8.md
5. Run existing tests before starting: `yarn test`
6. For any UI work: all strings from EMOTIONAL_LAYER.md — zero invented French copy

---

## Definition of done (updated)

### Critical quality gates
- [ ] Task state machine trigger exists and rejects invalid transitions
- [ ] Agent collision detection fires before any external communication
- [ ] Task cancellation: cancel button visible on running tasks, workers honour it
- [ ] API response envelope: ALL routes return `{ ok, data }` or `{ ok, error }`
- [ ] Trace ID: propagates through all BullMQ job payloads and log entries
- [ ] GDPR routing: zero DeepSeek calls for any gdpr_required:true skill

### Platform quality
- [ ] Pack installer validates manifest against Zod schema before any DB write
- [ ] Skills COPIED (not referenced) at pack install — source_skill_id set, tenant owns the copy
- [ ] Master update merge: take_master for base_instructions + output_schema, keep_tenant for everything else
- [ ] Client skill overlays: null overlay = skill works normally (overlay is additive, never required)
- [ ] All LLM failure modes map to a named failure_reason (never 'unknown error')
- [ ] Token budget checked before every LLM call
- [ ] Integration disconnection handled gracefully (blocked state, not crash)
- [ ] Input guardrails run before every context assembly — zero bypass path
- [ ] LLM judge runs on every output — overall_score shown in every approval card
- [ ] Constitutional check logs to task_execution_events on every revision
- [ ] Judge model is always T1_FR (Mistral EU) — never non-EU for evaluation
- [ ] security_events table logs all injection attempts with full payload

### Product quality
- [ ] Pack installs in < 20 minutes for a non-technical user
- [ ] Seed tasks produce visible output within 10 minutes of installation
- [ ] Approval race condition: simultaneous approvals result in exactly one execution
- [ ] All 9 screens load in < 2s
- [ ] Zero English strings in any user-facing screen
- [ ] Mobile approval flow works on 390px viewport
- [ ] Morning intelligence: max 3 cards/day invariant holds

### Agentic platform quality
- [ ] Task checkpoints written at every step boundary — no work lost on worker restart
- [ ] Confidence score flag shown on every approval card (high/medium/low only)
- [ ] Rule-based steps execute deterministically — never routed to LLM
- [ ] Parallel tasks in same mission share mission_context read/write access
- [ ] Steer endpoint: only works on running tasks, cannot override approval gates
- [ ] Behavioral baselines established after 30 tasks, anomalies logged to admin only

### World-class gaps quality gates (§33)
- [ ] Zero-tolerance check runs BEFORE trust calibration — no bypass path exists
- [ ] Trust bootstrapping: 2.5 ≤ initial_score ≤ 3.9, external sends always require approval
- [ ] Inline edit: only creates training example when operator actually changed content
- [ ] partial_complete status: appears in Votre attention column, requires operator decision
- [ ] Pack migrations: atomic transaction, rollback on failure, org_memory never deleted
- [ ] Session gap briefing: fires on open after ≥6h, one screen max
- [ ] Semantic cache: NEVER caches gdpr_required:true outputs (GDPR invariant extends here)
- [ ] External explanations (AI Act): self-referential only, no reference to other data subjects
- [ ] SLA_TIERS constant defined — engineering builds to these exact targets
- [ ] agent_proposals: declined 3× same trigger → threshold raised (anti-fatigue enforced)

### Partner and client context quality gates (§34–§35)
- [ ] Client context isolation: org_memory query ALWAYS filters by client_context_id — never leaks across contexts
- [ ] Deleting a client_context cascades to all scoped org_memory, tasks, missions, goals
- [ ] Partner dashboard: shows health metrics only — zero access to client operational data or agent outputs
- [ ] White-label config: GDPR and AI Act compliance docs always show Swwarm as processor — white-label does not extend to compliance
- [ ] Referral fee: created after 60 days active subscription — never on sign-up alone
- [ ] Client context morning intelligence: each active context gets its own card — zero data mixing

---

*Read PLATFORM_FUNCTIONAL_SPEC_v8.md for the full product specification.*  
*Read TECHNICAL_SPEC_v2.md for backend implementation patterns.*  
*This file is the primary brief. When in doubt, this file wins.*

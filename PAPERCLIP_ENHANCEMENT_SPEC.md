# Paperclip Enhancement Specification
**Version:** 1.0.0  
**Target:** Local install (self-hosted, Node.js + PostgreSQL stack)  
**Scope:** 7 enhancement modules on top of the existing `paperclipai/paperclip` codebase  
**Intended consumer:** Claude Code — use this document as the authoritative implementation brief  

---

## How to use this document

Each module is self-contained and can be implemented independently. They are ordered by **implementation dependency** — later modules may reference database tables or services introduced by earlier ones. Read the full spec for a module before touching any file. Where a migration is described, always create a new numbered migration file; never alter existing ones.

Coding conventions to follow throughout:
- TypeScript strict mode; no `any` unless explicitly noted
- Drizzle ORM for all DB access (match existing patterns in the repo)
- Zod schemas for all API input validation
- Server-Sent Events (SSE) for real-time streaming where noted
- Existing error handling conventions (`AppError`, HTTP status codes)
- All new API routes under `/api/v1/` and grouped by module prefix
- All React components use existing design system tokens (Tailwind classes already in repo)
- Write unit tests for every service function; integration tests for every new API route

---

## Module 1 — CEO Console (Natural Language Command Interface)

### Overview
A conversational interface that lets the human operator control the entire company in plain language. Sits alongside (not replacing) the existing ticket/dashboard UI. The operator can ask questions, issue commands, get status updates, and approve decisions — all via chat.

### User stories
- "What is the marketing agent working on right now?" → returns live task summary
- "Pause all outreach tasks" → pauses matching tasks atomically
- "Hire a data analyst for Project Alpha" → drafts agent config for human approval
- "Show me this week's cost breakdown" → returns structured budget report
- "Why did the coder agent stop?" → explains last heartbeat outcome

### Architecture

```
Browser (React)
  └─ <CEOConsole /> component
       ├─ Message thread (SSE stream)
       └─ Command input + quick actions

API layer
  POST /api/v1/console/message          — send a user message
  GET  /api/v1/console/stream/:sessionId — SSE stream of assistant replies
  GET  /api/v1/console/history/:companyId — paginated conversation history

Console Service (server)
  ├─ IntentClassifier     — classifies message into intent type
  ├─ ContextBuilder       — assembles company state snapshot
  ├─ LLMOrchestrator      — calls Claude with context + tools
  └─ ActionExecutor       — executes approved actions against existing services
```

### Database schema additions

```sql
-- Migration: 0020_add_console_sessions.sql

CREATE TABLE console_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE console_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES console_sessions(id) ON DELETE CASCADE,
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content       TEXT NOT NULL,
  intent        TEXT,                        -- classified intent slug
  action_taken  JSONB,                       -- serialized action if any was executed
  tokens_used   INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_console_messages_session ON console_messages(session_id, created_at);
CREATE INDEX idx_console_messages_company ON console_messages(company_id, created_at);
```

### Intent taxonomy

Define these intent types as a TypeScript union in `src/console/intents.ts`:

```typescript
export type ConsoleIntent =
  | 'query.agent.status'        // "what is X working on"
  | 'query.task.status'         // "what happened to task Y"
  | 'query.budget'              // "how much have we spent"
  | 'query.company.summary'     // "give me an overview"
  | 'action.task.pause'         // "pause task / all tasks"
  | 'action.task.resume'        // "resume task X"
  | 'action.task.reassign'      // "give this task to agent Y"
  | 'action.agent.pause'        // "pause agent X"
  | 'action.agent.resume'       // "resume agent X"
  | 'action.agent.hire'         // "hire a designer"  → requires approval
  | 'action.goal.create'        // "create a goal for Q3 launch" → requires approval
  | 'action.budget.adjust'      // "increase coder budget to $200" → requires approval
  | 'approval.pending'          // user is responding to an approval request
  | 'general';                  // fallback: answer using company context
```

Actions marked "requires approval" must NEVER execute automatically. They must:
1. Return a structured approval card in the console
2. Create a pending approval record (see Module 4)
3. Execute only after explicit human confirmation

### LLM system prompt (stored in `src/console/systemPrompt.ts`)

```
You are the CEO Console for {companyName}, an AI company managed by Paperclip.
You have read access to the entire company state: agents, tasks, goals, budgets, audit logs.
You have write access to execute safe operations (pause, resume, reassign).
You MUST request approval for any operation that creates, deletes, or financially impacts agents or goals.

When answering status queries, be concise and structured. Use bullet points for lists.
When executing actions, confirm exactly what you did and the new state.
When requesting approvals, present a clear summary card with [Approve] / [Reject] options.

Company context injected below:
{contextSnapshot}
```

### Context snapshot builder (`src/console/contextBuilder.ts`)

Assemble on every request — do NOT cache for more than 30 seconds:

```typescript
interface CompanyContextSnapshot {
  company:     { id, name, mission }
  agents:      Array<{ id, name, role, status, currentTaskTitle, budgetUsedPct }>
  activeGoals: Array<{ id, title, progress }>
  budgetSummary: { totalSpentThisMonth, totalBudget, agentBreakdown }
  recentAlerts: Array<{ type, message, createdAt }>   // last 10
  pendingApprovals: Array<{ id, type, summary }>
}
```

### Tool definitions (passed to Claude API)

Define these as Anthropic tool objects in `src/console/tools.ts`:

| Tool name | Description | Parameters | Requires approval |
|---|---|---|---|
| `get_agent_status` | Returns full status of one or all agents | `agentId?: string` | No |
| `get_task_detail` | Returns task thread and status | `taskId: string` | No |
| `get_budget_report` | Returns cost breakdown by scope | `scope: 'agent'\|'project'\|'company'`, `period?: string` | No |
| `pause_task` | Pauses a specific task | `taskId: string`, `reason: string` | No |
| `resume_task` | Resumes a paused task | `taskId: string` | No |
| `reassign_task` | Moves task to different agent | `taskId: string`, `toAgentId: string` | No |
| `pause_agent` | Pauses all tasks for an agent | `agentId: string`, `reason: string` | No |
| `request_hire_approval` | Drafts an agent hire for approval | `role: string`, `projectId?: string`, `rationale: string` | **Yes** |
| `request_goal_approval` | Drafts a new goal for approval | `title: string`, `description: string`, `parentGoalId?: string` | **Yes** |
| `request_budget_approval` | Requests budget adjustment | `agentId: string`, `newLimit: number`, `rationale: string` | **Yes** |

### API routes (`src/routes/console.ts`)

```typescript
// POST /api/v1/console/message
// Body: { companyId: string, sessionId?: string, message: string }
// Returns: { sessionId: string, messageId: string }
// Side-effect: begins streaming response on SSE channel

// GET /api/v1/console/stream/:sessionId
// Returns: SSE stream
// Events:
//   data: { type: 'token', content: string }
//   data: { type: 'action', action: ActionRecord }
//   data: { type: 'approval_request', approval: ApprovalCard }
//   data: { type: 'done', tokensUsed: number }

// POST /api/v1/console/approve/:approvalId
// Body: { decision: 'approve' | 'reject', note?: string }

// GET /api/v1/console/history/:companyId?limit=50&before=<cursor>
```

### React component structure

```
src/components/console/
  CEOConsole.tsx          — main shell, SSE subscriber, message list
  ConsoleMessage.tsx      — renders user/assistant message bubbles
  ApprovalCard.tsx        — structured approve/reject UI for pending actions
  ActionBadge.tsx         — inline badge showing executed action
  ConsoleInput.tsx        — textarea + send button + quick action chips
  QuickActions.tsx        — predefined chips: "Status", "Budget", "Pause all"
```

Mount `<CEOConsole />` in the company sidebar or as a slide-over panel. Add a keyboard shortcut (`Cmd+K` or `Ctrl+K`) to open it.

---

## Module 2 — Organizational Memory Graph

### Overview
A persistent, shared knowledge store that accumulates everything agents learn, decide, and produce. New agents onboard with full institutional context. The company gets smarter over time — not just bigger.

### Architecture

```
Memory ingestion pipeline
  Agent completes task → MemoryExtractor → chunks + embeds → stores in memory_entries

Memory retrieval
  Agent heartbeat → MemoryRetriever → top-K relevant chunks → injected into SKILLS.md context

Human curation
  Dashboard "Company Knowledge" page → browse, tag, pin, delete entries

Vector storage
  Local: pgvector extension on existing PostgreSQL instance
  Embedding model: call existing LLM provider (text-embedding-3-small or equivalent)
```

### Prerequisites

Enable pgvector in PostgreSQL:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Add to onboard/setup scripts and document in README.

### Database schema additions

```sql
-- Migration: 0021_add_memory_graph.sql

CREATE TABLE memory_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source_type     TEXT NOT NULL CHECK (source_type IN (
                    'task_output','agent_decision','human_note',
                    'goal_outcome','error_lesson','integration_fact'
                  )),
  source_id       UUID,                           -- FK to task/goal/etc. (nullable)
  agent_id        UUID REFERENCES agents(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  tags            TEXT[] NOT NULL DEFAULT '{}',
  importance      SMALLINT NOT NULL DEFAULT 3     -- 1 (low) to 5 (critical)
                    CHECK (importance BETWEEN 1 AND 5),
  embedding       vector(1536),                   -- adjust dim to match your embedding model
  pinned          BOOLEAN NOT NULL DEFAULT false,
  archived        BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_memory_company    ON memory_entries(company_id, archived, created_at DESC);
CREATE INDEX idx_memory_tags       ON memory_entries USING GIN(tags);
CREATE INDEX idx_memory_embedding  ON memory_entries USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);    -- tune lists = sqrt(row_count) as data grows

CREATE TABLE memory_access_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id       UUID NOT NULL REFERENCES memory_entries(id) ON DELETE CASCADE,
  agent_id        UUID REFERENCES agents(id) ON DELETE SET NULL,
  task_id         UUID,
  accessed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Memory extraction service (`src/memory/extractor.ts`)

Called automatically at the end of every task completion. Must be non-blocking (run as a background job).

```typescript
interface ExtractionJob {
  taskId:    string
  agentId:   string
  companyId: string
  output:    string     // final task output text
  toolCalls: ToolCall[] // from task audit log
}

async function extractMemories(job: ExtractionJob): Promise<void>
```

Internal steps:
1. Call LLM with the task output and a structured extraction prompt (see below)
2. Parse structured JSON response into `MemoryEntry[]`
3. Embed each entry's `title + content` using embedding API
4. Upsert into `memory_entries` — deduplicate by semantic similarity threshold (cosine > 0.95 = skip)

**Extraction prompt** (stored in `src/memory/prompts.ts`):

```
You are a knowledge extraction system for an AI company.

Given the output of a completed task, extract discrete, reusable knowledge entries.
Each entry should be a standalone fact, decision, lesson, or preference that would help
future agents working in this company.

Return a JSON array (no markdown, no preamble):
[
  {
    "title": "<short descriptive title, max 80 chars>",
    "content": "<the knowledge, 2-5 sentences, self-contained>",
    "source_type": "task_output|agent_decision|error_lesson|integration_fact",
    "tags": ["<tag1>", "<tag2>"],
    "importance": <1-5>
  }
]

Task context:
Agent role: {agentRole}
Task title: {taskTitle}
Task output:
{output}
```

### Memory retrieval service (`src/memory/retriever.ts`)

Called during agent heartbeat context assembly, before SKILLS.md injection.

```typescript
async function retrieveRelevantMemories(params: {
  companyId: string
  agentId:   string
  taskTitle: string
  taskGoal:  string
  limit?:    number   // default 10
}): Promise<MemoryEntry[]>
```

Internal steps:
1. Embed `taskTitle + taskGoal` 
2. Run cosine similarity query against `memory_entries` for this company
3. Filter out archived entries
4. Boost pinned entries (multiply similarity score by 1.5)
5. Return top-K sorted by boosted score

**SQL for retrieval:**
```sql
SELECT *, 
  (1 - (embedding <=> $1::vector)) * 
  CASE WHEN pinned THEN 1.5 ELSE 1.0 END AS relevance_score
FROM memory_entries
WHERE company_id = $2
  AND archived = false
ORDER BY relevance_score DESC
LIMIT $3;
```

### SKILLS.md injection format

Append to the agent's runtime context during heartbeat assembly:

```markdown
## Company knowledge (most relevant to your current task)

{foreach entry}
**{title}** (importance: {importance}/5)
{content}
Tags: {tags}
---
{/foreach}
```

### Human curation API (`src/routes/memory.ts`)

```
GET    /api/v1/memory/:companyId              — paginated list with search + tag filter
GET    /api/v1/memory/:companyId/:entryId     — single entry detail + access log
POST   /api/v1/memory/:companyId              — manual human note creation
PATCH  /api/v1/memory/:companyId/:entryId     — update title/content/tags/importance/pinned
DELETE /api/v1/memory/:companyId/:entryId     — soft-delete (set archived=true)
POST   /api/v1/memory/:companyId/search       — semantic search (body: { query, limit })
```

### React component structure

```
src/components/memory/
  MemoryPage.tsx           — full-page knowledge browser
  MemoryEntryCard.tsx      — card with title, tags, importance indicator, pin toggle
  MemorySearch.tsx         — semantic search input
  MemoryCreateModal.tsx    — human note creation form
  MemoryAccessLog.tsx      — which agents used this entry and when
```

Add "Company Knowledge" link to main sidebar navigation.

---

## Module 3 — Unified Integration Hub

### Overview
A company-wide MCP router that gives all agents permissioned, shared access to external business tools. Agents declare which integrations they need; the hub handles authentication, routing, and audit logging. No more per-agent credential configuration.

### Architecture

```
Integration Hub
  ├─ IntegrationRegistry    — which integrations are configured for this company
  ├─ CredentialVault        — encrypted storage of API keys / OAuth tokens
  ├─ PermissionMatrix       — which agents can call which integrations
  ├─ MCPRouter              — forwards MCP tool calls to correct provider
  └─ IntegrationAuditLog    — every external call logged

Agent heartbeat
  → Hub resolves agent's permitted integrations
  → Injects available MCP tools into agent runtime context
  → All tool calls routed through Hub (not directly from agent)
```

### Supported integrations (initial set)

| Integration | Auth type | MCP server URL pattern |
|---|---|---|
| Gmail | OAuth2 | `https://gmail.mcp.claude.com/mcp` |
| Google Calendar | OAuth2 | `https://gcal.mcp.claude.com/mcp` |
| Microsoft 365 | OAuth2 | `https://microsoft365.mcp.claude.com/mcp` |
| HubSpot | API key | `https://mcp.hubspot.com/anthropic` |
| GitHub | Personal token | `https://api.githubcopilot.com/mcp` |
| Slack | OAuth2 | `https://slack.mcp.example.com/mcp` |
| Notion | API key | custom adapter |
| Stripe | API key | custom adapter |
| Generic HTTP | Bearer token | configurable URL |

Adapters for "custom adapter" integrations are thin wrappers that translate MCP tool calls to the target REST API. Store adapter definitions in `src/integrations/adapters/`.

### Database schema additions

```sql
-- Migration: 0022_add_integration_hub.sql

CREATE TABLE integrations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  slug            TEXT NOT NULL,           -- e.g. 'gmail', 'github', 'hubspot'
  display_name    TEXT NOT NULL,
  mcp_server_url  TEXT NOT NULL,
  auth_type       TEXT NOT NULL CHECK (auth_type IN ('oauth2','apikey','bearer','none')),
  encrypted_creds TEXT,                    -- AES-256-GCM encrypted JSON blob
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, slug)
);

CREATE TABLE integration_permissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id  UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  allowed_tools   TEXT[],                  -- null = all tools; array = specific tool names
  granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by      TEXT,                    -- 'human' or 'system'
  UNIQUE(integration_id, agent_id)
);

CREATE TABLE integration_calls (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  integration_id  UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  agent_id        UUID REFERENCES agents(id) ON DELETE SET NULL,
  task_id         UUID,
  tool_name       TEXT NOT NULL,
  input_hash      TEXT,                    -- SHA-256 of input params (no PII stored)
  status          TEXT NOT NULL CHECK (status IN ('success','error','denied')),
  error_message   TEXT,
  duration_ms     INTEGER,
  called_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_integration_calls_company ON integration_calls(company_id, called_at DESC);
CREATE INDEX idx_integration_calls_agent   ON integration_calls(agent_id, called_at DESC);
```

### Credential vault (`src/integrations/vault.ts`)

Use Node.js built-in `crypto` module. No external vault dependency for local install.

```typescript
// Key derived from PAPERCLIP_VAULT_SECRET env var using PBKDF2
// Encrypt with AES-256-GCM; store iv + tag + ciphertext as base64 JSON

export async function encryptCredentials(data: object): Promise<string>
export async function decryptCredentials(encrypted: string): Promise<object>
```

Document in `.env.example`:
```
PAPERCLIP_VAULT_SECRET=<random-256-bit-hex>   # required for integration hub
```

### MCP router (`src/integrations/router.ts`)

```typescript
interface MCPToolCallRequest {
  companyId:     string
  agentId:       string
  taskId?:       string
  integrationSlug: string
  toolName:      string
  toolInput:     Record<string, unknown>
}

async function routeMCPToolCall(req: MCPToolCallRequest): Promise<MCPToolResult>
```

Steps:
1. Look up integration by `(companyId, slug)` — 404 if not found or inactive
2. Check `integration_permissions` — if no row for `(integration_id, agent_id)`, return `status: 'denied'`
3. If `allowed_tools` is set, verify `toolName` is in the list
4. Decrypt credentials from vault
5. Forward tool call to `mcp_server_url` using MCP protocol
6. Log to `integration_calls`
7. Return result or propagate error

### Agent context injection

During heartbeat context assembly (modify existing heartbeat service):

```typescript
// Add to agent runtime context:
const permissions = await getAgentIntegrationPermissions(agentId)
const mcpServers = permissions.map(p => ({
  type: 'url',
  url:  p.integration.mcpServerUrl,
  name: p.integration.slug,
}))
// Pass mcpServers array to Claude API call (mcp_servers parameter)
```

### API routes (`src/routes/integrations.ts`)

```
GET    /api/v1/integrations/:companyId                    — list configured integrations
POST   /api/v1/integrations/:companyId                    — add new integration
PATCH  /api/v1/integrations/:companyId/:integrationId     — update (credentials, active flag)
DELETE /api/v1/integrations/:companyId/:integrationId     — remove integration

GET    /api/v1/integrations/:companyId/:integrationId/permissions          — list agent permissions
POST   /api/v1/integrations/:companyId/:integrationId/permissions          — grant agent access
DELETE /api/v1/integrations/:companyId/:integrationId/permissions/:agentId — revoke access

GET    /api/v1/integrations/:companyId/audit?agentId=&integrationId=&limit=
```

### React component structure

```
src/components/integrations/
  IntegrationsPage.tsx         — grid of integration cards with status indicator
  IntegrationCard.tsx          — logo, name, status, connected agents count
  AddIntegrationModal.tsx      — multi-step wizard: select type → enter creds → test → save
  IntegrationPermissions.tsx   — agent permission matrix (rows=agents, cols=tool groups)
  IntegrationAuditTable.tsx    — paginated call log with filter by agent / tool / status
  OAuthConnectButton.tsx       — initiates OAuth2 PKCE flow for supported integrations
```

---

## Module 4 — Inter-Agent Quality Gates

### Overview
A semantic validation layer that sits between agent handoffs. When Agent A produces output that Agent B will consume, a Quality Gate evaluates the output before it is passed on. Anomalies trigger human escalation rather than silent cascade.

### Architecture

```
Task completion (Agent A)
  → QualityGateService.evaluate(output, gate_config)
       ├─ VolumeCheck        — count/size within expected range?
       ├─ SchemaCheck        — output matches expected structure?
       ├─ SemanticCheck      — LLM-powered: does this make sense?
       └─ CustomRuleCheck    — user-defined rules (regex, keywords, numeric bounds)
  → PASS: output forwarded to Agent B as normal
  → FAIL: task blocked, escalation created, human notified
```

### Gate configuration

Gates are configured per task-type or per project. They are NOT global — the human decides where to add gates based on risk.

```typescript
interface QualityGateConfig {
  id:             string
  name:           string
  companyId:      string
  projectId?:     string
  taskTitleMatch: string       // regex pattern matched against task title
  checks:         GateCheck[]
  onFail:         'block' | 'warn' | 'require_approval'
  createdAt:      Date
}

type GateCheck =
  | { type: 'volume';   field: 'word_count'|'item_count'|'byte_size'; min?: number; max?: number }
  | { type: 'schema';   jsonSchema: object }                            // JSON Schema validation
  | { type: 'semantic'; prompt: string; passPhrase: string }           // LLM evaluates; must contain passPhrase
  | { type: 'regex';    pattern: string; mustMatch: boolean }
  | { type: 'keyword';  forbidden: string[]; required: string[] }
  | { type: 'numeric';  extract: string; min?: number; max?: number }  // extract a number from output
```

### Database schema additions

```sql
-- Migration: 0023_add_quality_gates.sql

CREATE TABLE quality_gate_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  task_title_match TEXT NOT NULL DEFAULT '.*',   -- regex
  checks          JSONB NOT NULL DEFAULT '[]',
  on_fail         TEXT NOT NULL DEFAULT 'block'
                    CHECK (on_fail IN ('block','warn','require_approval')),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE quality_gate_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gate_id         UUID NOT NULL REFERENCES quality_gate_configs(id) ON DELETE CASCADE,
  task_id         UUID NOT NULL,
  agent_id        UUID REFERENCES agents(id) ON DELETE SET NULL,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  verdict         TEXT NOT NULL CHECK (verdict IN ('pass','fail','warn')),
  check_results   JSONB NOT NULL,    -- array of { type, passed, detail }
  output_preview  TEXT,              -- first 500 chars of output (for review UI)
  action_taken    TEXT,              -- 'forwarded'|'blocked'|'escalated'
  reviewed_by     TEXT,              -- human reviewer if escalated
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_qgr_company ON quality_gate_results(company_id, created_at DESC);
CREATE INDEX idx_qgr_task    ON quality_gate_results(task_id);
CREATE INDEX idx_qgr_verdict ON quality_gate_results(company_id, verdict);

CREATE TABLE escalations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN (
                    'quality_gate_fail','budget_anomaly','agent_error',
                    'console_approval','agent_hire','goal_create','budget_adjust'
                  )),
  source_id       UUID,              -- gate_result_id, console_message_id, etc.
  title           TEXT NOT NULL,
  detail          TEXT NOT NULL,
  severity        TEXT NOT NULL DEFAULT 'medium'
                    CHECK (severity IN ('low','medium','high','critical')),
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','acknowledged','resolved','dismissed')),
  resolution_note TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ
);

CREATE INDEX idx_escalations_company ON escalations(company_id, status, created_at DESC);
```

### Quality gate service (`src/qualityGates/service.ts`)

```typescript
async function evaluateOutput(params: {
  taskId:    string
  agentId:   string
  companyId: string
  taskTitle: string
  projectId: string | null
  output:    string
}): Promise<GateEvaluationResult>

interface GateEvaluationResult {
  gateId:       string | null   // null = no gate configured for this task
  verdict:      'pass' | 'fail' | 'warn' | 'no_gate'
  checkResults: CheckResult[]
  action:       'forwarded' | 'blocked' | 'escalated' | 'warned'
}
```

Implementation notes:
- Match task title against all active gate configs using `new RegExp(config.taskTitleMatch)`
- Run all checks in parallel where possible
- For `semantic` checks: call LLM with the configured `prompt` + output, check response contains `passPhrase`
- Short-circuit on first `block` verdict (do not run remaining checks)
- Create `escalation` record for any `block` or `require_approval` result
- Emit a server-sent event to any open console session for this company

### Anomaly detection — volume heuristics

Automatically apply these checks to ALL task outputs (not just configured gates), as a safety net:

| Metric | Anomaly threshold | Action |
|---|---|---|
| Email recipient count | > 10 (configurable) | warn + escalate |
| Output word count increase vs task average | > 500% | warn |
| Tool call count per heartbeat | > 50 | block agent, escalate |
| Consecutive error count | > 3 | pause agent, escalate |

Store company-level defaults in a `company_settings` JSONB column (add via migration if not exists).

### API routes (`src/routes/qualityGates.ts`)

```
GET    /api/v1/quality-gates/:companyId                    — list gate configs
POST   /api/v1/quality-gates/:companyId                    — create gate
PATCH  /api/v1/quality-gates/:companyId/:gateId            — update gate
DELETE /api/v1/quality-gates/:companyId/:gateId            — delete gate

GET    /api/v1/quality-gates/:companyId/results?verdict=&limit=
GET    /api/v1/quality-gates/:companyId/results/:resultId  — detail + full check breakdown

GET    /api/v1/escalations/:companyId?status=open          — pending escalations
PATCH  /api/v1/escalations/:companyId/:escalationId        — acknowledge / resolve / dismiss
```

### React component structure

```
src/components/qualityGates/
  QualityGatesPage.tsx         — list of configured gates + recent results summary
  GateConfigForm.tsx           — create/edit gate (task pattern + check builder)
  CheckBuilder.tsx             — dynamic form for adding/removing check rules
  GateResultDetail.tsx         — per-result breakdown: each check, pass/fail, detail
  EscalationBanner.tsx         — sticky banner shown when open escalations exist (all pages)
  EscalationList.tsx           — full escalation management page
  EscalationCard.tsx           — type, severity, detail, action buttons
```

The `EscalationBanner` must be rendered at the app shell level (alongside the sidebar), not just on the gates page.

---

## Module 5 — Agent Performance & ROI Scoring

### Overview
Tracks and surfaces the quality, cost-efficiency, and reliability of every agent. Answers the question: "Is this agent worth its tokens?"

### Metrics per agent

| Metric | How computed |
|---|---|
| `task_completion_rate` | completed / (completed + failed + timed_out) in rolling 30d |
| `avg_quality_score` | average of human ratings (1–5) on sampled outputs |
| `error_rate` | error heartbeats / total heartbeats in rolling 30d |
| `cost_per_task` | total tokens cost / completed tasks in rolling 30d |
| `peer_review_pass_rate` | QA gate passes / total QA gate evaluations |
| `avg_task_duration_hrs` | average wall-clock time from task start to completion |
| `roi_score` | composite: `quality_score × completion_rate / cost_per_task × 100` |

### Database schema additions

```sql
-- Migration: 0024_add_performance_tracking.sql

CREATE TABLE task_ratings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL,
  agent_id    UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  feedback    TEXT,
  rated_by    TEXT NOT NULL DEFAULT 'human',  -- 'human' | 'qa_agent'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agent_performance_snapshots (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id                  UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  company_id                UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  snapshot_date             DATE NOT NULL,
  task_completion_rate      NUMERIC(5,4),
  avg_quality_score         NUMERIC(3,2),
  error_rate                NUMERIC(5,4),
  cost_per_task_cents       INTEGER,
  peer_review_pass_rate     NUMERIC(5,4),
  avg_task_duration_hrs     NUMERIC(8,2),
  roi_score                 NUMERIC(8,2),
  tasks_completed           INTEGER,
  tasks_failed              INTEGER,
  total_cost_cents          INTEGER,
  UNIQUE(agent_id, snapshot_date)
);

CREATE INDEX idx_aps_agent   ON agent_performance_snapshots(agent_id, snapshot_date DESC);
CREATE INDEX idx_aps_company ON agent_performance_snapshots(company_id, snapshot_date DESC);
```

### Snapshot job (`src/performance/snapshotJob.ts`)

Run daily via the existing cron/heartbeat scheduler. Computes rolling 30-day metrics for every active agent and inserts a row into `agent_performance_snapshots`.

```typescript
async function computeAgentSnapshot(agentId: string, companyId: string, date: Date): Promise<void>
```

### ROI score formula

```typescript
function computeROIScore(metrics: AgentMetrics): number {
  if (metrics.costPerTaskCents === 0) return 0
  const quality  = metrics.avgQualityScore  ?? 3   // default to mid-range if no ratings
  const complete = metrics.taskCompletionRate ?? 0
  const cost     = metrics.costPerTaskCents / 100   // convert to dollars
  return Math.round((quality * complete / cost) * 100) / 100
}
```

### Human rating integration

After every task completion, the task detail page shows a 1–5 star rating prompt. Rating is optional. If no rating is given within 7 days, the task is considered unrated (not penalized).

QA agents (any agent with role matching `/qa|review|test/i`) automatically submit `rated_by: 'qa_agent'` ratings based on their review outputs. Extract numeric score from QA agent output using a simple regex: `score[:\s]+([1-5])/5` or call a lightweight extraction LLM call.

### API routes (`src/routes/performance.ts`)

```
GET /api/v1/performance/:companyId                        — all agents, latest snapshot
GET /api/v1/performance/:companyId/:agentId               — single agent time-series (last 90 days)
GET /api/v1/performance/:companyId/:agentId/tasks         — rated tasks for this agent

POST /api/v1/performance/:companyId/:agentId/rate         — submit human rating
Body: { taskId: string, rating: 1|2|3|4|5, feedback?: string }

GET /api/v1/performance/:companyId/leaderboard            — agents ranked by roi_score
```

### React component structure

```
src/components/performance/
  PerformancePage.tsx          — company-wide leaderboard + summary
  AgentROICard.tsx             — compact card: ROI score, sparkline, top metric
  AgentPerformanceDetail.tsx   — full agent view: all metrics + trend charts
  MetricSparkline.tsx          — 30-day mini trend chart (Chart.js or recharts)
  TaskRatingWidget.tsx         — inline 1–5 star rating on task completion
  ROILeaderboard.tsx           — sortable table: agent, role, ROI, cost/task, quality
```

Add a "Performance" section to the sidebar. Place `TaskRatingWidget` in the existing task detail view.

---

## Module 6 — Predictive Cost Intelligence

### Overview
Transforms the existing cost tracker into a forward-looking CFO tool. Surfaces burn-rate projections, "days until limit" warnings, and hire-cost simulations.

### New computed metrics

| Metric | Formula |
|---|---|
| `daily_burn_rate` | total spend in last 7 days / 7 |
| `days_until_limit` | (budget_limit - spent_this_month) / daily_burn_rate |
| `projected_month_end_spend` | spent_so_far + (daily_burn_rate × days_remaining_in_month) |
| `budget_utilization_pct` | spent_this_month / budget_limit |
| `hire_simulation_cost` | estimated monthly cost for a new agent of given type (based on similar existing agents) |

### Database schema additions

```sql
-- Migration: 0025_add_cost_intelligence.sql

CREATE TABLE budget_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_id        UUID REFERENCES agents(id) ON DELETE CASCADE,   -- null = company-level
  alert_type      TEXT NOT NULL CHECK (alert_type IN (
                    'approaching_limit','days_until_limit','projected_overage',
                    'anomalous_spike','new_month_reset'
                  )),
  threshold_pct   INTEGER,        -- e.g. 80 for "80% of budget"
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_fired_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, agent_id, alert_type, threshold_pct)
);

CREATE TABLE cost_projections (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_id                  UUID REFERENCES agents(id) ON DELETE CASCADE,
  projection_date           DATE NOT NULL,
  daily_burn_rate_cents     INTEGER,
  days_until_limit          NUMERIC(6,1),
  projected_month_end_cents INTEGER,
  budget_utilization_pct    NUMERIC(5,2),
  computed_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, agent_id, projection_date)
);
```

### Projection job (`src/costs/projectionJob.ts`)

Run hourly (or on every heartbeat completion). Compute projections for every agent and company-level roll-up. Insert into `cost_projections` and fire alerts when thresholds are crossed.

```typescript
async function computeProjections(companyId: string): Promise<void>
async function checkAndFireAlerts(companyId: string, projections: CostProjection[]): Promise<void>
```

Alert firing rules:
- `approaching_limit`: `budget_utilization_pct >= threshold_pct` AND not fired in last 24h
- `days_until_limit`: `days_until_limit < 3` AND not fired in last 6h
- `projected_overage`: `projected_month_end_cents > budget_limit_cents` AND not fired today
- `anomalous_spike`: daily burn rate increased > 200% vs prior 7-day average AND not fired today

When an alert fires: create an `escalation` record (Module 4), emit SSE to console session.

### Hire simulation endpoint

```
POST /api/v1/costs/:companyId/simulate-hire
Body: { 
  role: string,           // "Marketing Manager", "Data Analyst", etc.
  model?: string,         // which LLM model, defaults to company default
  tasksPerDay?: number,   // estimated tasks per day
  avgTaskComplexity?: 'low'|'medium'|'high'
}
Response: {
  estimatedMonthlyCostCents: number,
  estimationBasis: string,      // human-readable explanation
  comparableAgents: AgentCostSummary[]
}
```

Estimation logic:
1. Find existing agents with similar role keywords
2. Average their `cost_per_task_cents` from performance snapshots
3. Multiply by `tasksPerDay × 30`
4. If no comparable agents: use model pricing table (`src/costs/modelPricing.ts`) with complexity multiplier

### API routes (`src/routes/costs.ts`) — additions to existing cost routes

```
GET /api/v1/costs/:companyId/projections          — latest projections for all agents
GET /api/v1/costs/:companyId/projections/:agentId — single agent projection detail
GET /api/v1/costs/:companyId/alerts               — configured alerts
POST /api/v1/costs/:companyId/alerts              — create alert
PATCH /api/v1/costs/:companyId/alerts/:alertId    — update threshold or disable
POST /api/v1/costs/:companyId/simulate-hire       — hire cost estimator
GET /api/v1/costs/:companyId/history?granularity=day|week|month — spend over time
```

### React component structure

```
src/components/costs/
  CostIntelligencePage.tsx     — full CFO dashboard
  BurnRateCard.tsx             — daily rate, trend arrow, days-until-limit badge
  ProjectionGauge.tsx          — circular gauge: current utilization vs budget
  ProjectedOverageAlert.tsx    — warning banner when month-end projection > budget
  HireSimulator.tsx            — role input → cost estimate card
  AgentCostRanking.tsx         — most/least expensive agents (cost per task)
  SpendHistoryChart.tsx        — stacked bar: spend by agent per day/week/month
  AlertsConfig.tsx             — configure alert thresholds per agent
```

Integrate `BurnRateCard` and `ProjectedOverageAlert` into the existing company dashboard header.

---

## Module 7 — Agent Self-Improvement Loops

### Overview
Agents observe their own outputs, collect feedback signals, and adaptively refine their working instructions over time. This is not model fine-tuning — it is prompt/instruction evolution managed within Paperclip's governance framework. Every improvement requires human approval before taking effect.

### Mechanism

```
1. Performance signal collected (human rating, QA gate result, task outcome)
2. ImprovementAnalyzer runs when agent's rolling 30-day quality_score drops below threshold
   OR when 3+ consecutive tasks receive ratings ≤ 2
3. ImprovementAnalyzer generates proposed instruction deltas (diffs to agent's SKILLS.md / system prompt)
4. Proposal submitted as escalation with type 'instruction_improvement'
5. Human reviews diff → Approve / Reject / Modify
6. On approval: new instructions versioned and deployed to agent
7. Effect monitored: 14-day quality trend tracked post-deployment
```

### Database schema additions

```sql
-- Migration: 0026_add_self_improvement.sql

CREATE TABLE agent_instruction_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  version_number  INTEGER NOT NULL,
  skills_content  TEXT NOT NULL,         -- full SKILLS.md content at this version
  system_prompt   TEXT,                  -- full system prompt if changed
  change_summary  TEXT NOT NULL,         -- human-readable description of changes
  change_type     TEXT NOT NULL CHECK (change_type IN ('manual','ai_proposed','rollback')),
  proposed_by     TEXT,                  -- 'system' | 'human'
  approved_by     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT false,
  activated_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, version_number)
);

CREATE TABLE improvement_proposals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id            UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  trigger_reason      TEXT NOT NULL,     -- e.g. "quality_score below 3.0 for 14 days"
  trigger_metrics     JSONB NOT NULL,    -- snapshot of metrics that triggered this
  proposed_diff       TEXT NOT NULL,     -- unified diff format
  full_proposed_text  TEXT NOT NULL,     -- complete new SKILLS.md for preview
  rationale           TEXT NOT NULL,     -- LLM explanation of proposed changes
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','rejected','withdrawn')),
  reviewer_note       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at         TIMESTAMPTZ
);

CREATE INDEX idx_proposals_agent   ON improvement_proposals(agent_id, status);
CREATE INDEX idx_proposals_company ON improvement_proposals(company_id, status);
```

### Improvement analyzer (`src/improvement/analyzer.ts`)

Run as part of the daily performance snapshot job (after Module 5 snapshots are computed).

```typescript
interface ImprovementTrigger {
  agentId:    string
  companyId:  string
  reason:     string
  metrics:    AgentPerformanceSnapshot
}

async function checkImprovementTriggers(companyId: string): Promise<ImprovementTrigger[]>
async function generateProposal(trigger: ImprovementTrigger): Promise<void>
```

Trigger conditions:
- Rolling 30-day `avg_quality_score < 2.5` (configurable)
- 3+ consecutive tasks rated ≤ 2
- `error_rate > 0.3` for 7+ days
- `peer_review_pass_rate < 0.5` for 14+ days

Do NOT trigger more than once per 14 days per agent.

### Proposal generation prompt (`src/improvement/prompts.ts`)

```
You are an AI performance coach for an AI agent named "{agentName}" with role "{agentRole}".

The agent has been underperforming. Here are the metrics:
{metricsJson}

Here are recent low-rated tasks and the feedback received:
{lowRatedTasksJson}

Here is the agent's current SKILLS.md (working instructions):
---
{currentSkillsContent}
---

Your task:
1. Identify the specific behaviours causing poor performance
2. Propose targeted changes to the SKILLS.md to address them
3. Do NOT suggest changes that alter the agent's fundamental role or scope
4. Keep proposals minimal — change only what is necessary
5. Return a JSON object (no markdown, no preamble):
{
  "rationale": "<2-3 sentences explaining the root cause and proposed fix>",
  "proposed_skills_content": "<complete new SKILLS.md content>",
  "change_summary": "<one sentence summary of changes>"
}
```

### Diff computation

Use the `diff` npm package to compute a unified diff between current and proposed SKILLS.md content. Store both the diff and the full proposed text. Display diff in the approval UI.

### Version management

```typescript
async function activateInstructionVersion(agentId: string, versionId: string): Promise<void>
async function rollbackToVersion(agentId: string, versionNumber: number): Promise<void>
async function getCurrentInstructions(agentId: string): Promise<AgentInstructionVersion>
```

When activating: set previous version `is_active = false`, new version `is_active = true`, record `activated_at`. Update the agent's runtime SKILLS.md used during heartbeat context assembly.

### API routes (`src/routes/improvement.ts`)

```
GET    /api/v1/improvement/:companyId/proposals?status=pending
GET    /api/v1/improvement/:companyId/proposals/:proposalId     — full proposal with diff
POST   /api/v1/improvement/:companyId/proposals/:proposalId/approve
Body:  { note?: string }
POST   /api/v1/improvement/:companyId/proposals/:proposalId/reject
Body:  { note: string }

GET    /api/v1/improvement/:companyId/agents/:agentId/versions  — instruction version history
POST   /api/v1/improvement/:companyId/agents/:agentId/rollback
Body:  { versionNumber: number }
```

### React component structure

```
src/components/improvement/
  ImprovementPage.tsx          — pending proposals list + agent version history
  ProposalCard.tsx             — trigger reason, metrics snapshot, review CTA
  ProposalReviewModal.tsx      — side-by-side diff viewer + approve/reject form
  DiffViewer.tsx               — syntax-highlighted unified diff
  InstructionVersionHistory.tsx — timeline of all versions per agent + rollback button
  PerformanceTrendChart.tsx    — 60-day quality trend with version activation markers
```

Add "Improvements" badge to sidebar nav (shows count of pending proposals).

---

## Cross-module integration checklist

After implementing all modules, verify these integration points:

| From | To | What must happen |
|---|---|---|
| Module 4 (Gate fail) | Module 1 (Console) | Escalation emitted as SSE to open console sessions |
| Module 4 (Gate fail) | Module 4 (Escalations table) | Escalation record created automatically |
| Module 5 (Rating) | Module 7 (Improvement trigger) | Rating written → daily job reads for trigger evaluation |
| Module 6 (Alert fire) | Module 4 (Escalations table) | Budget alert creates escalation record |
| Module 6 (Alert fire) | Module 1 (Console) | Alert emitted as SSE to console |
| Module 2 (Memory) | Module 5 (Performance) | Memory access log updated when agent uses a memory entry |
| Module 7 (Approval) | Module 4 (Escalations table) | Improvement proposal creates escalation of type `instruction_improvement` |
| All modules | Module 1 (Console) | All major events queryable via console natural language |

---

## Environment variable additions

Add to `.env.example`:

```bash
# Module 1 — CEO Console
CONSOLE_LLM_MODEL=claude-sonnet-4-20250514
CONSOLE_MAX_CONTEXT_TOKENS=8000
CONSOLE_SESSION_TTL_HOURS=24

# Module 2 — Organizational Memory
MEMORY_EMBEDDING_MODEL=text-embedding-3-small   # or equivalent from your provider
MEMORY_EMBEDDING_DIMENSIONS=1536
MEMORY_RETRIEVAL_LIMIT=10
MEMORY_SIMILARITY_THRESHOLD=0.72
MEMORY_DEDUP_THRESHOLD=0.95

# Module 3 — Integration Hub
PAPERCLIP_VAULT_SECRET=                         # 256-bit hex random (required)
INTEGRATION_CALL_TIMEOUT_MS=30000

# Module 4 — Quality Gates
GATE_SEMANTIC_CHECK_MODEL=claude-haiku-4-5-20251001
GATE_DEFAULT_EMAIL_RECIPIENT_LIMIT=10
GATE_MAX_TOOL_CALLS_PER_HEARTBEAT=50

# Module 5 — Performance
PERFORMANCE_SNAPSHOT_CRON=0 2 * * *             # 2am daily
PERFORMANCE_RATING_PROMPT_DELAY_HOURS=1         # show rating prompt N hours after completion

# Module 6 — Cost Intelligence
COST_PROJECTION_CRON=0 * * * *                  # hourly
COST_ALERT_APPROACHING_LIMIT_PCT=80
COST_ALERT_DAYS_UNTIL_LIMIT_THRESHOLD=3

# Module 7 — Self Improvement
IMPROVEMENT_QUALITY_TRIGGER_THRESHOLD=2.5
IMPROVEMENT_MIN_DAYS_BETWEEN_PROPOSALS=14
IMPROVEMENT_PROPOSAL_MODEL=claude-sonnet-4-20250514
```

---

## Migration execution order

Run migrations in this exact order; do not skip or reorder:

```
0020_add_console_sessions.sql
0021_add_memory_graph.sql           (requires pgvector — install first)
0022_add_integration_hub.sql
0023_add_quality_gates.sql
0024_add_performance_tracking.sql
0025_add_cost_intelligence.sql
0026_add_self_improvement.sql
```

---

## Recommended implementation order for Claude Code

Implement in this sequence to minimise blocked dependencies:

1. **Module 4 — Quality Gates** first (Escalations table is depended on by M1, M6, M7)
2. **Module 5 — Performance** (ratings feed M7 triggers)
3. **Module 6 — Cost Intelligence** (alerts use escalation from M4)
4. **Module 2 — Memory Graph** (independent, high value)
5. **Module 3 — Integration Hub** (independent, complex auth)
6. **Module 7 — Self Improvement** (needs M5 ratings data)
7. **Module 1 — CEO Console** (last; wraps everything via tool queries)

---

## Testing requirements

Each module must include:

- **Unit tests** for every service function (Jest or Vitest, match existing test runner)
- **Integration tests** for every API route (use supertest, real test DB)
- **Seed fixtures** for test data (agents, tasks, costs) in `src/test/fixtures/`
- **E2E smoke test** for the happy path of each module

Minimum coverage threshold: 80% line coverage per module.

---

*End of specification. All modules are additive — the existing codebase is not restructured, only extended.*

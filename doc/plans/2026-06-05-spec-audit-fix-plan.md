# Spec Audit & Fix Plan — 2026-06-05 (rev 3)

Three audit passes performed against PLATFORM_FUNCTIONAL_SPEC_v8 / CLAUDE.md.
Status: **DONE** = fully implemented · **PARTIAL** = logic gap · **MISSING** = not wired · **DEFERRED** = correct per build sequence

---

## What changed across all sessions

### Rev 1 fixes
- ✅ P5 Outbox wiring (seed tasks + activation triggers inside DB transaction)
- ✅ T10/P4 traceId in executor + job schemas + internal-execute route
- ✅ F8 Skill version notice in ApprovalCard (amber banner)
- ✅ Settings layout overflow (min-h-screen → min-h-full)
- ✅ Migration journal mismatch (0102_c1_task_state_machine registered)

### Rev 2 fixes
- ✅ T10 traceId binding in all 13 BullMQ workers
- ✅ Queue routing: installQueue + heartbeatQueue added to queues.ts; outbox router + installer corrected
- ✅ F1 recency-weighted memory retrieval (combined = similarity×0.6 + recency×0.4; confidence < 0.2 filtered)
- ✅ G5 clarification answer UI (ClarificationCard + clarificationsApi; backend already complete)

---

## ✅ Fully Implemented — complete verified list

| Item | Location | Milestone |
|---|---|---|
| RULE 1 GDPR routing | `server/src/llm/router.ts` — throws GdprViolationError; DeepSeek forbidden for personal data | Architecture invariant |
| RULE 4 Audit trail immutable | `packages/db/src/migrations/0070_audit_immutable_triggers.sql` — DB trigger on audit_entries | Architecture invariant |
| RULE 5 Task context never truncated | `server/src/context/assembler.ts` — compression order: outputs→memory→DNA→skill, never task | Architecture invariant |
| C1 Task state machine | `packages/db/src/migrations/0102_c1_task_state_machine.sql` | First customer |
| C2 Agent collision detection | `server/src/extensions/builtin-actions.ts:203` — called in executeAction | First customer |
| C3 Task cancellation | `server/src/tasks/checkpoints.ts` + `routes/issues.ts` | First customer |
| C4 Per-company queue rate limiting | `server/src/safety/concurrency.ts` | First customer |
| C5 Pack template injection sanitisation | `server/src/safety/dna-sanitise.ts` | First customer |
| C6 LLM response failure states | `server/src/tasks/failure-reasons.ts` | First customer |
| C7 Input guardrails (injection + PII) | `server/src/safety/input-guardrails.ts` | First customer |
| C8 LLM-as-judge (T1_FR hardcoded) | `server/src/safety/judge.ts` | First customer |
| C9 Constitutional self-critique | `server/src/safety/constitution.ts` (called from executor.ts) | First customer |
| AG-3 Task checkpointing | `server/src/tasks/checkpoints.ts` — written at steps 1/10/20 in executor | First customer |
| AG-4 Confidence scoring + force-approval | `server/src/safety/confidence.ts` + `executor.ts:204-209` | First customer |
| AG-8 Hybrid rule-based steps | `server/src/tasks/rule-engine.ts` | First customer |
| AG-9 Real-time bidirectional steering | `server/src/routes/steer.ts` — only on in_progress tasks, cannot override approval | 10 customers |
| Gap B Inline output editing | `server/src/routes/task-inline-edit.ts` | 10 customers |
| Gap C Trust bootstrapping | `server/src/trust/bootstrap.ts` — clamps to [2.5, 3.9] | First customer |
| Gap E Zero-tolerance (function) | `server/src/safety/zero-tolerance.ts` — function exists, see ITEM 1 below | First customer |
| Gap N SLA tiers | `server/src/billing/sla.ts` | First customer |
| F1 Memory recency weighting | `server/src/memory/service.ts` — combined score, confidence < 0.2 filtered | 10 customers |
| F2 Memory staleness decay | `server/src/workers/memoryDecay.worker.ts` | 10 customers |
| F3 Approval escalation (scheduled) | `server/src/intelligence/approval-escalation.ts` + morning-intelligence worker | 10 customers |
| F4 Atomic approval | `server/src/services/approvals.ts:54-65` | 10 customers |
| F5 Integration disconnection | `server/src/safety/integration-check.ts` | 10 customers |
| F6 Token budget pre-flight | `server/src/costs/service.ts` | 10 customers |
| F7 Reasoning capture SSE | `server/src/realtime/publish.ts:105-119` | 10 customers |
| F8 Skill version notice (UI) | `ui/src/components/ApprovalCard.tsx:105-111` — amber banner | 10 customers |
| T5 API response envelope | `server/src/middleware/response-envelope.ts` | 10 customers |
| T10 Structured logging (all workers) | All 13 workers use `logger.child({ traceId, companyId, ... })` | 10 customers |
| P1 Content Security Policy | `server/src/app.ts` — CSP headers on all API routes | 10 customers |
| P2 API key hashing | `server/src/middleware/public-api-auth.ts` | 10 customers |
| P3 Three-tier rate limiting | `server/src/middleware/rate-limit.ts` — IP/user/company/auth tiers | 10 customers |
| P4 traceId propagation | `server/src/tasks/executor.ts`, `routes/internal-execute.ts`, all workers | 10 customers |
| P5 Outbox wiring | `server/src/packs/installer.ts` + `queues.ts` (installQueue, heartbeatQueue added) | 10 customers |
| A1 Pack manifest Zod validation | `server/src/packs/installer.ts:49-118` | 10 customers |
| A3 Company DNA pack_extensions | `packages/db/src/schema/company_dna.ts` + migration 0087 | 10 customers |
| G1 i18n schema | `packages/db/src/schema/companies.ts` — locale + timezone columns | First customer |
| G3 RBAC | `server/src/routes/authz.ts` — company_memberships + requireRole() | First customer |
| G5 Clarification UI | `ui/src/components/ClarificationCard.tsx` + `ui/src/api/clarifications.ts` | 10 customers |
| Away Mode | `server/src/routes/away-mode.ts` | First customer |
| Morning Intelligence | `server/src/routes/intelligence.ts` | First customer |
| CEO Console (WAR-1 through WAR-12) | `ui/src/pages/singular/ConsoleCEO.tsx` | First customer |
| MissionsArchive | `ui/src/pages/singular/MissionsArchive.tsx` | First customer |
| TrustCentre (display_name) | `server/src/routes/trust.ts:33` | First customer |
| Team page | `ui/src/pages/singular/Team.tsx` | First customer |
| ConfigAgent (two-tab soul + skills) | `ui/src/pages/singular/ConfigAgent.tsx` | First customer |
| Settings page | `ui/src/pages/singular/Settings.tsx` | First customer |

---

## ⚠️ Partial / Not Wired — Fix Required

### ITEM 1 · Gap E + RULE 3 — `checkZeroTolerance` and `runGates` not wired into `executeAction`

**Spec requirements:**
- Gap E: `checkZeroTolerance()` must run BEFORE trust calibration, no bypass path
- RULE 3: Every external action passes `runGates()` + `validateOutputSchema()`, no bypass

**Current state:**
- `checkZeroTolerance()` — defined in `server/src/safety/zero-tolerance.ts` — **never called** outside tests
- `runGates()` — defined in `server/src/gates/engine.ts` — **never called** outside tests
- `executeAction()` in `server/src/extensions/builtin-actions.ts` is the correct wiring point; it already has C2 collision detection but is missing the other two guards

**Fix (priority: HIGH — before first customer):**
In `executeAction()` in `builtin-actions.ts`, add before calling `def.handler()`:
1. `checkZeroTolerance(skill.frontmatter.zero_tolerance_actions ?? [], action, company)` — throws → forces pending_approval
2. `await runGates(db, { companyId, agentId, taskId, output, skillType })` — throws → blocks action

Note: `executeAction` also needs `skill` and `company` context passed in, or zero-tolerance rules loaded from the skill metadata in a pre-check step.

---

### ITEM 2 · F8 Backend — approval response never includes skill version data

**Spec requirement:** When showing an approval card, include `taskSkillVersion` (version when task was generated) and `latestSkillVersion` (current active version). If they differ, show the amber notice.

**Current state:**
- `Approval` type has optional `taskSkillVersion?: string` and `latestSkillVersion?: string`
- `ApprovalCard.tsx` renders the notice when both are present and differ
- `server/src/tasks/skill-version.ts` has `resolveSkillForTask()` and `getActiveSkillVersion()`
- Tasks table has `skill_version_id` and `skill_type` columns
- **Missing**: Approval API route never fetches or populates these fields — always null at runtime

**Fix (priority: MEDIUM — before 10 customers):**
In the approvals route (or `approvalService.getById()`), when serializing an approval:
1. If `approval.issueId` exists, fetch `task.skillVersionId` + `task.skillType`
2. Look up that version's `version` string from `skill_versions`
3. Look up the current active version via `getActiveSkillVersion()`
4. Attach both as `taskSkillVersion` and `latestSkillVersion` to the response

---

## ❌ Missing — Correctly Deferred (do not implement yet)

| Item | Milestone | Notes |
|---|---|---|
| Full post-approval action execution (trigger executeAction after approval) | M13 / CEO Console | Current model: LLM generates text → approval → done. Full action dispatch (send email etc.) is M13 scope |
| C7 scope violation (embedding similarity check) | 50 customers | Intentional stub |
| F1 conflict detection in morning intelligence | 10 customers | Memory decay done; conflict surfacing deferred |
| AG-1 Parallel multi-agent orchestration (fan-out/fan-in) | 10 customers | Tables exist |
| AG-2 Agent-to-agent peer communication (workers wired) | 10 customers | Table exists |
| AG-6/7/10/11 | 50 customers | Not started |
| Gap H Graceful partial output | 10 design partners | State machine state exists |
| Gap K Session gap awareness | 10 design partners | `last_active_at` column missing from users |
| Gap A/D/F/G/I/L/M | 50–100 customers | Not started |

---

## Build Order — Rev 3

```
1. Gap E + RULE 3: wire checkZeroTolerance + runGates into executeAction   ✅ DONE 2026-06-05
2. F8 backend: populate taskSkillVersion/latestSkillVersion in approval API ✅ DONE 2026-06-05
```

---

## ⚠️ Paperclip Functionality Audit — Rev 4 (2026-06-05)

Audit of core Paperclip features across workers, queues, and trust. All items confirmed by reading source.

---

### ITEM 3 · CRITICAL — Heartbeat queue mismatch (agents never wake up)

**Impact:** `emit.heartbeat()` posts to `"agents"` queue. `heartbeat.worker.ts` listens to `"heartbeats"` queue. The job never gets processed — no agent ever wakes from a heartbeat trigger.

**Files:**
- `server/src/queue/emit.ts:33` — posts to `agentQueue` ("agents")
- `server/src/workers/heartbeat.worker.ts:43` — listens to `"heartbeats"`

**Fix:** Change the Worker queue name in `heartbeat.worker.ts:43` from `"heartbeats"` to `"agents"`.

---

### ITEM 4 · CRITICAL — Four new workers never initialized in index.ts

These workers were added in the previous session but never wired into `server/src/index.ts` or `server/src/workers/index.ts`:

| Worker | File | Impact |
|---|---|---|
| `initHeartbeatWorker` | `workers/heartbeat.worker.ts` | Heartbeat jobs sit unprocessed even after ITEM 3 fix |
| `startOutboxWorker` | `workers/outbox.worker.ts` | `pending_jobs` rows never dequeue → seed tasks never fire |
| `initSeedTaskWorker` | `workers/seedTask.worker.ts` | Seed task jobs (install queue) never execute |
| `initMemoryDecayWorker` | `workers/memoryDecay.worker.ts` | Memory staleness decay never runs |

**Fix:** In `server/src/index.ts` around line 650, add:
```typescript
import { initHeartbeatWorker } from "./workers/heartbeat.worker.js";
import { startOutboxWorker } from "./workers/outbox.worker.js";
import { initSeedTaskWorker } from "./workers/seedTask.worker.js";
import { initMemoryDecayWorker, scheduleMemoryDecaySweep } from "./workers/memoryDecay.worker.js";

// in startup block:
initHeartbeatWorker(db as any);
startOutboxWorker(db as any);
initSeedTaskWorker(db as any);
initMemoryDecayWorker(db as any);
void scheduleMemoryDecaySweep().catch(...);
```
Also add exports to `server/src/workers/index.ts`.

---

### ITEM 5 · MEDIUM — Trust score not updated after task approval

**Spec:** Trust score / approval streak must update after every approved task.
**Current state:** `recordApproval()` in `server/src/trust/service.ts` is only called from the manual rating endpoint (`POST /issues/:id/rate`, `routes/issues.ts:3021`). It is never called from `taskApproved.worker.ts` when the agent executes after an operator's approval click.

**Fix:** In `server/src/workers/taskApproved.worker.ts`, after releasing blocked tasks, call `recordApproval(db, { agentId, companyId, skillType, qualityRating: null, approved: true })` to record the streak even without an explicit quality rating.

---

## Build Order — Rev 4

```
3. ITEM 3: fix heartbeat queue name in heartbeat.worker.ts:43            [ ]
4. ITEM 4: wire 4 missing workers into index.ts + workers/index.ts       [ ]
5. ITEM 5: call recordApproval() in taskApproved.worker.ts               [ ]
```

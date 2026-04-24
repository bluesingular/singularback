# Scoring Guide

## Relevance axis (0–10)

| Score | Meaning | Example |
|-------|---------|---------|
| 0 | Touches a fully replaced subsystem | Heartbeat fix when local repo uses BullMQ |
| 2 | Touches a subsystem the local repo barely uses | SSH support when running local-only |
| 4 | Touches shared infrastructure both use | Adapter registry |
| 6 | Touches core logic the local repo depends on | Issue service, agent execution |
| 8 | Directly improves something the local repo uses heavily | BullMQ queue, DB schema |
| 10 | Fixes a bug the local repo would also hit | Stale lock, duplicate migration |

## Impact axis (0–10)

| Score | Meaning | Example |
|-------|---------|---------|
| 0–2 | Docs, chore, test coverage only | README update, lockfile refresh |
| 3–4 | Minor DX improvement | Better error message, type cleanup |
| 5–6 | Reliability/hardening | Cleanup zombie processes, idempotency |
| 7–8 | Bug fix with production impact | Stale lock prevents re-checkout after crash |
| 9–10 | Critical fix or high-value feature | Security fix, major performance gain |

## Combined score formula

```
score = (relevance × 0.6) + (impact × 0.4)
```

## Effort estimates

| Label | Hours | Signals |
|-------|-------|---------|
| Low | < 2h | Cherry-picks clean, no architecture changes |
| Medium | 2–6h | Minor rewiring (e.g. import path changes, hook into different worker) |
| High | 6–12h | Significant adaptation (new tables + service + worker integration) |

## Conflict risk levels

| Level | Meaning |
|-------|---------|
| None | Files changed don't exist in local repo, or are identical to upstream |
| Low | Files changed exist but are lightly modified locally |
| Medium | Files changed are heavily modified locally (e.g. heartbeat.ts) |
| High | Structural conflict — local repo has replaced the whole subsystem |

## Common patterns

### "Already have" detection
- Search for the function/constant name in local repo
- If found with same semantics → ✅ Already have
- If found but implemented differently → 🔄 Needs adaptation (check if upstream version is better)

### Migration conflicts
Always run:
```bash
ls packages/db/src/migrations/*.sql | sort | tail -5
```
before reporting any upstream migration as safe to merge.

### Heartbeat vs BullMQ
If local repo has `server/src/queue/` with BullMQ workers, treat any upstream commit
touching `heartbeat.ts` service, heartbeat scheduling, or heartbeat runtime as
relevance 0–2. The execution model is different.

Exception: upstream commits to `heartbeat.ts` that add new utility functions
(e.g. `classifyAndPersistRunLiveness`) may still be worth merging if those functions
are called from non-heartbeat paths.

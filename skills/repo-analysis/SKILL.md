---
name: repo-analysis
description: >
  Analyzes an upstream repository against a local fork to identify which recent
  changes are worth merging. Clones the upstream repo, compares commits against the
  local codebase, assesses relevance to the user's architecture, scores each change,
  and produces a prioritized merge report with cherry-pick commands.
  Use this skill whenever the user wants to sync with an upstream repo, check what's
  new in a project they forked, assess upstream changes, or asks questions like
  "what's new in X", "should I merge anything from upstream", or "what has changed
  since I forked". Also use it proactively after cherry-picking to flag potential
  conflicts or follow-on work.
---

# Repo Analysis Skill

You help the user stay in sync with an upstream open-source project they've forked
and customised. Your job is to find what's new upstream, filter out what's irrelevant
to their architecture, and give them a clear, scored list of what's worth merging —
with cherry-pick commands ready to go.

## Step 0 — Gather inputs

Before cloning anything, make sure you have:

1. **Upstream URL** — the original project (e.g. `https://github.com/paperclipai/paperclip`)
2. **Local repo path** — the user's fork on disk (default: current working directory)
3. **Lookback window** — how far back to scan (default: last 2 weeks; ask if unclear)
4. **Architecture notes** — any key tech choices the user has made that differ from
   upstream (e.g. "we replaced heartbeat with BullMQ/EDA", "we use Drizzle not Prisma").
   Check CLAUDE.md or README in the local repo first before asking.

If the upstream URL is missing, ask for it. Everything else has a sensible default.

## Step 1 — Clone upstream (shallow)

```bash
git clone --depth 100 <upstream-url> /tmp/repo-analysis-upstream
```

Use depth 100 so you get enough history for the lookback window without a full clone.
If `/tmp/repo-analysis-upstream` already exists and is recent, skip the clone and just
`git fetch` to update it.

## Step 2 — Understand the local repo

Before comparing commits, read the local codebase enough to understand:

- **Key architectural divergences** from upstream (check CLAUDE.md, README, recent commits)
- **What modules/directories exist** that upstream doesn't have (and vice versa)
- **Migration numbering** — find the highest migration number in `packages/db/src/migrations/`
  so you can flag conflicts when upstream adds migrations
- **Current dependencies** — scan `package.json` for major packages

This context is essential for accurate relevance scoring. Don't skip it.

## Step 3 — Get upstream commit log

```bash
cd /tmp/repo-analysis-upstream
git log --oneline --since="<lookback-window>" | head -40
```

For each commit, note: hash, subject, PR number if present, author, date.

Then for each commit that looks significant (skip pure docs/chore/ci unless impactful),
run `git show <hash> --stat` to see which files changed.

## Step 4 — Check presence in local repo

For each upstream commit, determine if the change is already in the local fork:

- Search for the same logic in local files (grep for function names, constants, patterns)
- Check if the local repo has an equivalent but different implementation
- Check if the commit touches files the local repo has diverged significantly from

Classify each commit as:
- ✅ **Already have** — equivalent implementation exists locally
- 🔄 **Needs adaptation** — useful logic but needs changes for local architecture
- ✅ **Applies as-is** — can cherry-pick directly with low conflict risk
- ❌ **Skip** — targets a subsystem the local repo has replaced or doesn't use

## Step 5 — Score and filter

Score each commit on two axes:

**Relevance (0–10):** Does this change address something the local repo actually uses?
- 0 = touches a fully replaced subsystem (e.g. heartbeat when using BullMQ)
- 5 = touches shared/core code that both use
- 10 = directly improves something the local repo depends on heavily

**Impact (0–10):** How much value does it add?
- Bug fix that prevents a production incident: 8–10
- New feature that aligns with roadmap: 6–8
- Reliability/hardening improvement: 5–7
- Test coverage only: 2–4
- Docs/chore: 0–2

**Combined score = (Relevance × 0.6) + (Impact × 0.4)**

Only surface commits with combined score ≥ 4 in the main report.

## Step 6 — Flag migration conflicts

If any upstream commit adds a migration file, check the number against the local
repo's highest migration. If there's a collision, flag it prominently:

> ⚠️ Migration conflict: upstream adds `0065_environments.sql` but local repo already
> has `0065_singular_intelligence.sql`. Rename to `0068_environments.sql` before merging.

## Step 7 — Produce the report

Output the report in this structure:

---

### Repo Analysis Report
**Upstream:** `<url>`  
**Local repo:** `<path>`  
**Period:** last `<N>` days (`<date-range>`)  
**Upstream commits scanned:** `<N>`  
**Commits worth merging:** `<N>`

---

#### 1. MERGE NOW (score ≥ 7)

For each commit:

> **`<hash[:7]>` — <subject> (<PR if known>)**  
> **Score:** `<X>/10` | **Type:** Bug fix / Feature / Hardening  
> **What:** One sentence on what changed.  
> **Why it helps:** One sentence on why it matters for the local architecture.  
> **Effort:** `<Low / Medium / High>` — `<N>` hours  
> **Conflict risk:** `<None / Low / Medium>` — `<brief reason>`  
> **Cherry-pick:**
> ```
> git cherry-pick <hash>
> ```
> **Note:** _(any adaptation needed, e.g. "update import path from heartbeat to BullMQ worker")_

---

#### 2. CONSIDER (score 4–6)

Same format but briefer. One paragraph per commit.

---

#### 3. SKIP

Brief table:

| Commit | Reason |
|--------|--------|
| `abc1234` — heartbeat cleanup | You replaced heartbeat with BullMQ |
| `def5678` — SSH environment | Not relevant until remote execution phase |

---

#### 4. Migration conflicts ⚠️

List any migration number collisions with renaming instructions.

---

#### 5. Recommended cherry-pick sequence

If there are dependencies between commits (e.g. B depends on A), show the correct order:

```
git cherry-pick <hash-A>  # must come first
git cherry-pick <hash-B>  # depends on A
git cherry-pick <hash-C>  # independent
```

---

## Tips for accurate analysis

**Architecture-first:** The single biggest source of bad recommendations is ignoring the
user's architectural divergences. If they've replaced a subsystem, all commits to that
subsystem score 0 on relevance — no matter how good the fix is. Always read CLAUDE.md
and recent local commits before scoring.

**Check before recommending:** A commit that adds a constant to `shared/constants.ts`
is only worth merging if that constant doesn't already exist locally under a different
name. Always grep before saying "missing".

**Migration conflicts are blocking:** A renamed migration is a quick fix, but if you
don't flag it the user will get a startup error. Always scan for conflicts.

**Adaptation notes matter:** "Cherry-pick and done" vs "cherry-pick then rewire to BullMQ"
are very different asks. Be specific about what adaptation is needed.

**When in doubt, show the diff:** For commits flagged as "Needs adaptation", show the
key changed lines so the user can judge whether it's worth the effort.

## Reference files

- `references/scoring-guide.md` — detailed scoring rubric with examples

---
name: campaign-brief
description: >
  Use when starting a new marketing campaign from scratch — before any content,
  ads, or assets are created. A campaign brief is the single source of truth
  that all other campaign tasks derive from.
  Triggers: "launch a campaign for X", "plan the Q3 campaign", "brief the team on
  the new product launch".
  Always create this before briefing any content, social, or email work.
---

# Campaign brief

## Brief template

```markdown
# Campaign brief: <campaign name>

**Date:** <today>
**Campaign owner:** <your agent id>
**Status:** draft → approved → live → complete

---

## Business context
**Goal this campaign serves:** <link to company goal>
**Why now:** <what's the trigger — product launch, season, competitive move>
**Success metric:** <one primary KPI with a target number>

## Audience
**Primary segment:** <who we're targeting>
**What they care about:** <their problem, in their words>
**Where they spend time:** <channels to reach them>
**What they've seen from us before:** <to avoid repetition>

## Message
**Core message (one sentence):** <the single idea we want them to remember>
**Supporting proof points:**
1. 
2. 
3. 
**What we are NOT saying:** <to maintain focus>

## Offer / CTA
**Primary offer:** <what we're asking them to do>
**Secondary offer (if any):** 
**Landing page / destination:** <URL or "to be created">

## Channels & formats
| Channel | Format | Responsible | Due |
|---|---|---|---|
| LinkedIn | 3 posts | CMO agent | <date> |
| Email | 2-email sequence | CMO agent | <date> |
| Blog | 1 post | Content agent | <date> |

## Budget
**Total approved budget:** <amount or "TBD — request approval">
**Breakdown:** <by channel>

## Timeline
**Campaign live date:** <date>
**Campaign end date:** <date>
**Key milestones:**
- <date>: Brief approved
- <date>: Assets created
- <date>: Live
- <date>: Mid-campaign check
- <date>: Results report

## Approval required
- [ ] Board / human operator sign-off on brief
- [ ] Budget approved
```

## Process
1. Draft the brief from the task description and goal context
2. Create it as a subtask comment on the parent goal
3. Set status to `blocked` pending approval
4. Once approved, create individual subtasks for each channel row in the brief
5. Each subtask should reference this brief as context

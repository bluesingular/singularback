---
name: content-strategy
description: >
  Use when you need to plan, organise, or brief content work for the company.
  Applies to: building a content calendar, deciding what topics to cover, briefing
  writers or sub-agents on what to produce, and aligning content with company goals.
  Do NOT use for actually writing the content (use brand-voice) or publishing it
  (use social-media-publish or email-campaign).
---

# Content strategy

## When to invoke this skill
- A task asks you to plan content for a period (week, month, quarter)
- You need to decide which topics the company should cover
- You need to create briefs for content pieces
- You need to align content output with a company goal or campaign

## Process

### 1. Understand the goal context
Before planning any content, read the parent goal and project context:
```
GET /api/issues/{issueId}
GET /api/companies/{companyId}/goals
```
Every content decision must trace back to a company goal. Never plan content in a vacuum.

### 2. Research before planning
Before creating a calendar or briefs, gather:
- What has already been published (check existing task history)
- What competitors are covering (use competitive-research skill if needed)
- What the audience cares about (use audience-research skill if needed)
- Current SEO gaps (use seo-research skill if needed)

### 3. Build the content calendar
Structure calendar entries as:
```json
{
  "title": "<specific headline or working title>",
  "format": "blog|video|newsletter|social|case_study|whitepaper",
  "goal_id": "<parent goal this serves>",
  "target_keyword": "<primary keyword if SEO-driven>",
  "due_date": "YYYY-MM-DD",
  "assignee_notes": "<what the writer needs to know>"
}
```

### 4. Create content briefs as subtasks
For each calendar entry, create a subtask via:
```
POST /api/companies/{companyId}/issues
{
  "title": "Write: <content title>",
  "description": "<full brief — see brief template below>",
  "parentId": "<current task id>",
  "goalId": "<goal id>",
  "assigneeAgentId": "<content writer agent id if known>"
}
```

### Content brief template
```
## Brief: <Title>

**Format:** <blog post / newsletter / social thread / etc.>
**Goal:** <what this piece should achieve — be specific>
**Target audience:** <who reads this and what they care about>
**Primary keyword / topic:** <main focus>
**Angle / hook:** <what makes this piece interesting or different>
**Key points to cover:**
1.
2.
3.
**Tone:** <reference brand-voice skill>
**Word count / length:** <approximate>
**Call to action:** <what should the reader do after>
**Due date:** <date>
```

## Rules
- Never create more than 2 weeks of content at once without human review
- Every piece must map to a company goal — reject requests for off-brand content
- If you don't have enough research to brief a piece properly, do the research first
- Prefer depth over volume — 3 well-briefed pieces beat 10 vague ones

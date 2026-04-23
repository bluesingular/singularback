---
name: weekly-marketing-report
description: >
  Use every Monday (or when triggered by a scheduled heartbeat) to compile and
  post the weekly marketing performance summary for the board.
  This skill orchestrates data from analytics-report, budget-tracking, and
  social-media-publish to produce a single consolidated view.
  Do NOT use for ad-hoc reporting — use analytics-report instead.
---

# Weekly marketing report

## When this runs
- Triggered by weekly heartbeat schedule (Monday morning)
- Or manually assigned as a task

## Data to collect
Before writing, gather:
1. Traffic metrics (use analytics-report skill or integration)
2. Leads generated this week
3. Social posts published (check completed tasks from last 7 days)
4. Emails sent (check completed tasks)
5. Budget spend update (use budget-tracking skill)
6. Any coverage / PR (check completed tasks)
7. Campaigns active or launched this week

## Report format

```markdown
# Weekly marketing report — week of <Mon date> to <Sun date>

## One-line summary
<The most important thing that happened in marketing this week, in one sentence>

## Numbers
| Metric | This week | Last week | Δ |
|---|---|---|---|
| Website sessions | | | |
| New leads | | | |
| Email open rate | | | |
| Social reach | | | |
| Budget spent (WTD) | | | |

## What we published
- <platform>: <title or description> — <link if available>
- ...

## What worked
<1-2 things with specific data>

## What didn't work
<1-2 things honestly>

## This week's priorities
1. <specific task or campaign>
2. <specific task or campaign>
3. <specific task or campaign>

## Needs from leadership
<Any decisions, approvals, or input needed — be specific>
```

## Posting the report
1. Post as a comment on the weekly report task
2. Update task status to `done`
3. @-mention board/CEO if "Needs from leadership" section is non-empty
4. Optionally: use social-media-publish to share a public highlights version on LinkedIn

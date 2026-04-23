---
name: analytics-report
description: >
  Use when you need to pull, interpret, and present marketing performance data.
  Triggers: "how are we performing", "what's our traffic this month", "report on
  campaign X", "marketing metrics for the board", weekly/monthly reporting tasks.
  Do NOT use for financial reporting (use budget-tracking).
  Do NOT use for product analytics — that belongs to a different role.
---

# Analytics report

## Core metrics by category

### Acquisition
| Metric | What it tells you | Good benchmark |
|---|---|---|
| Organic traffic | SEO health | MoM growth > 5% |
| Paid traffic | Ad efficiency | CPC vs industry avg |
| Referral traffic | Partnership / PR value | Track source quality |
| Direct traffic | Brand awareness | Growing = healthy brand |
| Email traffic | List engagement | Open rate > 25%, CTR > 3% |

### Engagement
| Metric | What it tells you |
|---|---|
| Bounce rate | Content relevance to intent |
| Time on page | Content quality / depth |
| Pages per session | Site architecture + content linking |
| Scroll depth | Whether content is being consumed |

### Conversion
| Metric | What it tells you |
|---|---|
| Leads generated | Top of funnel volume |
| Lead quality score | Are we attracting the right ICP? |
| MQL → SQL rate | Marketing to sales handoff quality |
| Cost per lead (CPL) | Acquisition efficiency |
| Customer acquisition cost (CAC) | Total marketing efficiency |

### Retention / Loyalty
| Metric | What it tells you |
|---|---|
| Email list growth | Audience building |
| Unsubscribe rate | Content relevance |
| Social follower growth | Brand reach |
| NPS / CSAT | Customer sentiment |

## Standard reporting cadence

### Weekly (Monday)
Focus: what happened last week vs the week before
- Traffic by channel (WoW change)
- Leads generated
- Top performing content (by visits and conversions)
- Campaigns active / any anomalies
- One recommendation for this week

### Monthly (1st of month)
Focus: trend analysis vs prior month and vs target
- All acquisition metrics vs target
- Top 5 content pieces by traffic and conversion
- Campaign ROI summary
- Competitive position (search rankings for top 10 keywords)
- Budget spent vs plan
- Next month priorities

### Quarterly (board-level)
- OKR progress against marketing goals
- Channel mix and efficiency trends
- CAC and LTV trends
- Key experiments run and learnings
- Next quarter plan and budget request

## Pulling data

If analytics integrations are configured (Google Analytics, HubSpot, etc.), use the Integration Hub tools.

If not, collect data manually:
1. List the metrics needed from the report template above
2. Query available tools (check what MCP integrations are active for this company)
3. For missing data sources, note in the report and create a task to set up the integration

## Report format
```
## Marketing report — <period>

**Summary (3 sentences max):**
<What happened, what worked, what needs attention>

**Metrics vs target:**
| Metric | Target | Actual | Δ |
|---|---|---|---|
| <metric> | <target> | <actual> | <+/-> |

**Top wins:**
- <specific result with numbers>

**Areas of concern:**
- <specific issue with context>

**Recommended actions:**
1. <action — be specific and ownable>

**Data sources:** <list tools / dashboards used>
```

Post the completed report as a comment on the task, then update status to done.

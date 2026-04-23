---
name: competitive-research
description: >
  Use when you need to monitor, analyse, or summarise competitor activity.
  Triggers: "what are competitors doing", "how does our pricing compare",
  "has competitor X launched anything new", "competitive landscape for X".
  Also use on a scheduled basis (weekly or monthly) to maintain competitive
  intelligence for the company.
  Do NOT use for internal company analysis — that belongs in analytics-report.
---

# Competitive research

## Competitor tiers

Define your competitor tiers in `references/competitors.md`:
```
# Competitor list

## Tier 1 — Direct competitors (same buyer, same problem)
- <Name>: <URL> — <one-line differentiator>

## Tier 2 — Indirect competitors (same buyer, different solution)
- <Name>: <URL> — <one-line differentiator>

## Tier 3 — Aspirational (where the market is heading)
- <Name>: <URL> — <what we can learn>
```

If this file doesn't exist, create it as a task before doing competitive research.

## Research dimensions

### 1. Product / offering
- What do they sell? What's new since last check?
- Pricing: public or estimated? Tiers? Recent changes?
- Key features vs our key features
- What they don't do (our opportunities)

### 2. Messaging & positioning
- Tagline / headline on homepage
- Primary value proposition
- Who they claim to serve (ICP language)
- How they talk about pain points
- What they avoid saying (reveals weaknesses)

### 3. Go-to-market
- Content: blog topics, frequency, quality
- SEO: keywords they're targeting
- Paid: ad copy and landing pages (use ad library tools where available)
- Social: platforms, posting frequency, engagement patterns
- Events: conferences they sponsor or attend

### 4. Customer sentiment
- G2, Capterra, Trustpilot, App Store reviews: what do customers love and hate?
- Reddit, Twitter/X, LinkedIn mentions
- Common complaints = our selling points if we solve them

## Standard research process

1. Check `references/competitors.md` for the list
2. Visit their website — note homepage headline, pricing, any new product announcements
3. Check their blog / news section for recent posts (last 30 days)
4. Check their LinkedIn page for recent updates and job posts (job posts reveal strategic priorities)
5. Search `site:<competitor.com>` for new pages
6. Search `"<competitor name>"` on Twitter/X and LinkedIn for recent mentions
7. Check review sites for new reviews

## Output format
```
## Competitive intelligence — <date>

### <Competitor name>
**What's new:**
- <observation with source URL>

**Messaging shift:** <if any>

**Pricing change:** <if any>

**Our response / opportunity:**
- <actionable recommendation>

---
```

## Scheduled monitoring
For routine weekly/monthly monitoring, create a recurring task:
- Check all Tier 1 competitors (weekly)
- Check all Tier 2 competitors (monthly)
- Full landscape review (quarterly)

Flag to manager immediately if:
- A competitor launches a feature that directly challenges our core value prop
- A competitor changes pricing significantly
- A competitor raises funding or gets acquired
- A competitor starts running ads targeting our brand name

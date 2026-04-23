---
name: seo-research
description: >
  Use when you need to research keywords, analyse search intent, identify
  content gaps, or assess a page's SEO opportunity.
  Triggers: "find keywords for X", "what should we write about for SEO",
  "why isn't our page ranking", "what topics are competitors ranking for".
  Do NOT use for writing the content itself (use content-strategy + brand-voice).
  Do NOT use for paid search / SEM — that is a separate skill.
---

# SEO research

## Research types and when to use each

| Type | When to use | Output |
|---|---|---|
| Keyword discovery | Starting a new topic cluster | List of keywords with volume + difficulty |
| Search intent analysis | Before briefing any content | Intent classification per keyword |
| Competitor gap analysis | Quarterly or for new verticals | Keywords competitors rank for, you don't |
| Page audit | When a page isn't performing | On-page issues list with priority |

## Step-by-step: keyword discovery

### 1. Seed keywords
Start with 3-5 seed terms from the task context or company goals. If not provided, derive them from the company mission and product/service description.

### 2. Expand using web research
Search for each seed term and observe:
- What Google autocomplete suggests
- "People also ask" questions
- Related searches at the bottom of SERPs
- What the top 3 ranking pages cover

Record findings in this format:
```
Keyword: <term>
Estimated monthly searches: <low/medium/high based on SERP volume signals>
Difficulty: <low/medium/high based on DA of ranking pages>
Intent: informational | navigational | commercial | transactional
Current ranking position: <our position or "not ranking">
Opportunity: <1-5 score — 5 = high volume + low difficulty + matches our offering>
```

### 3. Cluster into topic groups
Group keywords by semantic similarity. Each cluster = one potential content piece or pillar page.
- Pillar page: broad head term + high volume (covers the cluster)
- Supporting pages: long-tail variants (link back to pillar)

### 4. Prioritise
Score each cluster:
```
Priority score = (business relevance × opportunity) / estimated effort
```
- Business relevance: 1-5 (does ranking for this bring qualified visitors?)
- Opportunity: 1-5 (from step 2)
- Estimated effort: 1-3 (1 = quick win, 3 = major content investment)

## Competitor gap analysis

1. Identify 3-5 direct competitors from company context or web search
2. For each competitor, review their:
   - Blog/resources section (what topics do they cover?)
   - Meta titles on key pages (what keywords are they targeting?)
   - Top pages by estimated traffic (use Ahrefs, SEMrush if integrated — or manual SERP observation)
3. List topics they rank for that we don't cover
4. Filter to topics relevant to our ICP and goals

## On-page audit checklist (for existing pages)
```
URL: 
Title tag: <current> → <recommended> (55-60 chars, keyword-first)
Meta description: <current> → <recommended> (150-160 chars, includes CTA)
H1: present? matches title intent?
Keyword in first 100 words: yes/no
Internal links pointing to this page: <count>
Internal links from this page: <count + quality>
Page speed: fast/medium/slow (check via manual observation or PageSpeed tool)
Mobile-friendly: yes/no
Schema markup: present/missing
Issues: <list>
Priority fixes: <top 3>
```

## Output format for task comment
Always summarise findings as:
```
## SEO research summary — <topic/date>

**Top opportunity keywords:**
1. <keyword> — <intent> — <opportunity score>
2. ...

**Recommended content to create:**
- <title> targeting "<keyword>" (estimated effort: <low/medium/high>)

**Quick wins (existing pages to optimise):**
- <page url> — fix: <specific change>

**Sources reviewed:** <list of URLs checked>
```

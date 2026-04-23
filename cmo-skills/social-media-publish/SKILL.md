---
name: social-media-publish
description: >
  Use when you need to draft, schedule, or publish content to social media
  platforms (LinkedIn, X/Twitter, Instagram, Facebook).
  Also use when reviewing a social post before publishing.
  Do NOT use for long-form content (use content-strategy + brand-voice).
  Do NOT use if you don't have the required integration credentials configured
  in the Integration Hub — create a task to request setup instead.
---

# Social media publish

## Supported platforms and post types

| Platform | Post types | Character limit |
|---|---|---|
| LinkedIn | Text, image, article, poll | 3,000 (text), 700 (recommended) |
| X (Twitter) | Tweet, thread | 280 per tweet |
| Instagram | Caption + image/video | 2,200 (caption) |
| Facebook | Post, event | 63,206 (use ≤500) |

## Pre-publish checklist
Before drafting any post, confirm:
1. Is this post tied to a campaign or content calendar entry? Check the task's parent goal.
2. Does the brand-voice skill apply? Yes — always read it before writing.
3. Is there a visual required? If yes and you can't produce one, create a subtask for a designer.
4. Is there a link? Shorten it and ensure UTM parameters are added (see below).

## UTM parameter template
All links in social posts must include UTM tracking:
```
?utm_source=<platform>&utm_medium=social&utm_campaign=<campaign-slug>&utm_content=<post-slug>
```
Example:
```
https://example.com/product?utm_source=linkedin&utm_medium=social&utm_campaign=q2-launch&utm_content=feature-announcement
```

## Platform-specific rules

### LinkedIn
- Open with a strong hook line (stands alone without "See more")
- Use line breaks generously — no walls of text
- Emojis: max 3, only if they add meaning
- Tag people/companies only when directly relevant
- Best times: Tuesday–Thursday, 08:00–10:00 and 17:00–18:00

### X (Twitter)
- First tweet of a thread carries full weight — write it as a standalone
- Threads: max 8 tweets unless genuinely necessary
- Quote tweets over plain retweets when adding commentary
- Replies count — engage within 2h of posting for algorithm boost

### Instagram
- Caption should complement the visual, not describe it
- First 125 chars are above the fold — put the hook there
- Hashtags: 5–10, mix broad and niche, place at end or in first comment

## Draft format for handoff or review
When creating a draft for human review (recommended for announcements):
```
POST /api/companies/{companyId}/issues
{
  "title": "Review social post: <platform> — <topic>",
  "description": "**Platform:** <platform>\n**Scheduled for:** <date/time>\n\n**Draft:**\n\n<post text>\n\n**Visual:** <description or attachment>\n**Link:** <UTM url>",
  "status": "blocked",
  "parentId": "<campaign task id>",
  "goalId": "<goal id>"
}
```
Then @-mention your manager or board for approval.

## Publishing via Integration Hub
If the integration is configured:
```
Use the <platform> MCP tool: post_content
Input: { text: "...", scheduled_time: "ISO8601", media_url: "..." }
```
Always log the published post URL back to the task as a comment:
```
PATCH /api/issues/{issueId}
{ "status": "done", "comment": "Published: <post_url>\nReach/impressions to be reported in weekly-marketing-report." }
```

## What NOT to do
- Never publish to social without checking brand-voice
- Never post about company financials, legal matters, or personnel
- Never engage with negative comments without human approval — create a task instead
- Never use automated replies or generic responses

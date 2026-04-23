---
name: email-campaign
description: >
  Use when drafting, structuring, or briefing email marketing campaigns or sequences.
  Applies to: newsletters, nurture sequences, launch emails, re-engagement campaigns,
  transactional marketing emails (not ops/system emails).
  Do NOT use for internal company communications or individual outreach (use pr-outreach).
  Do NOT use for sending emails — that requires the email integration to be configured.
---

# Email campaign

## Email types and their goals

| Type | Goal | Frequency |
|---|---|---|
| Newsletter | Nurture + brand | Weekly or biweekly |
| Nurture sequence | Move leads down funnel | Triggered, 3-7 emails |
| Launch / announcement | Drive immediate action | Event-based |
| Re-engagement | Reactivate cold subscribers | Quarterly |
| Post-purchase | Upsell / retain | Triggered |

## Anatomy of a high-converting email

```
From name:  <Real name or brand — not "noreply">
Subject:    <40 chars max — benefit or curiosity, no clickbait>
Preheader:  <90 chars — extends subject, adds context>

Body:
  Opening:  1 sentence that hooks based on the reader's situation
  Value:    2-3 short paragraphs OR a clear list — never both
  CTA:      One primary CTA, maximum two. Button or bolded link.
  Sign-off: Human sign-off (name + role) for relationship emails

Footer:
  Unsubscribe link (required)
  Physical address (required by CAN-SPAM / GDPR)
  Preference centre link (recommended)
```

## Subject line formulas
- **Benefit**: "3 ways to cut your CAC in half"
- **Curiosity gap**: "We almost didn't ship this"
- **Specificity**: "What 847 marketing teams do differently"
- **Personal**: "Quick question, <first_name>"
- **Urgency** (use sparingly): "Last day: <specific thing>"

Never: "Newsletter #12", "Update from <Company>", exclamation marks in B2B

## Segmentation rules
Always define the segment before writing:
```
Segment: <who receives this>
Why they should care: <specific reason for this segment>
What we know about them: <data points that personalise the message>
What action we want: <one specific action>
```

## Campaign brief template
For multi-email sequences:
```
## Email sequence brief: <name>

**Goal:** <what this sequence should achieve — be measurable>
**Audience segment:** <who, how many>
**Trigger:** <what starts this sequence>
**Sequence length:** <number of emails>
**Cadence:** <timing between emails>

### Email 1
Subject: 
Preheader: 
Goal for this email: 
Key message (1 sentence): 
CTA: 
Send timing: immediately after trigger

### Email 2
Subject: 
Preheader:
Goal: 
Key message:
CTA:
Send timing: +3 days

[continue for each email]
```

## A/B testing guidance
Always test one variable at a time:
- Subject line (most impactful — test this first)
- Send time
- CTA copy
- Email length (short vs long)
- Personalisation vs no personalisation

Minimum sample size for statistical significance: 500 recipients per variant.
Run for at least 4 hours before declaring a winner.

## Output
Draft each email and post to the task as a comment in this format:
```
---
**Email <n> of <total>**
**Subject:** <subject>
**Preheader:** <preheader>

<email body>

---
```

If the email requires human review before sending (recommended for any broadcast to >500), set task status to `blocked` and @-mention your manager.

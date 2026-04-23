# [PLATFORM] — Functional Specification (Complete)
**Version:** 5.0
**Status:** Reference document
**Audience:** Product, Engineering, Design, Investors
**Scope:** Full platform — MVP scope flagged `[MVP]` / `[V2]` / `[V3]`
**Product language:** French native `[MVP]` → English/German `[V2]`

**Changelog v5.0 — critical gaps addressed from world-class assessment:**
- **Trust calibration system (new section 12):** Trust Score per agent per skill, graduated autonomy proposals, trust upgrade flow — replaces binary approve/autonomous model
- **Designed activation sequence (section 7):** Engineered first-week experience with 5 specific wow moments; seed tasks on install; "first win" notification protocol
- **Proactive CEO Console (section 11):** Morning intelligence cards surfaced automatically; system detects anomalies and surfaces insights operator didn't ask for
- **Agent-to-agent handoffs (section 9):** `handoff_to` action type enabling agents to pass structured outputs to each other; inter-agent workflow chains
- **Contacts entity (section 8):** Contact-level memory; every person an agent interacts with builds a knowledge profile; injected into context when relevant
- **Output schema validation (section 14):** Per-skill JSON output schema validated before quality gates run; malformed outputs flagged before reaching operator
- **Task translation / pricing legibility (section 16):** Task counts translated to business outcomes ("~12 CV qualification batches remaining")
- **Evaluation framework / golden datasets (section 19):** Golden test sets per skill; automated benchmarking on every skill version before activation
- **Damage control flow (section 14):** Recovery path when operator marks a sent communication as erroneous
- **Public API (section 13):** Documented REST API for power users and integrations; webhook-out for task results

---

## Table of contents

1. [Product vision & principles](#1-product-vision--principles)
2. [Target market & personas](#2-target-market--personas)
3. [Core mental model](#3-core-mental-model)
4. [Information architecture](#4-information-architecture)
5. [UI — Philosophy & design system](#5-ui--philosophy--design-system)
6. [Main screens & flows](#6-main-screens--flows)
7. [Onboarding & activation sequence](#7-onboarding--activation-sequence)
8. [Digital twin engine](#8-digital-twin-engine)
9. [Agent workforce](#9-agent-workforce)
10. [Goals & task management](#10-goals--task-management)
11. [CEO Console — proactive intelligence](#11-ceo-console--proactive-intelligence)
12. [Trust calibration system](#12-trust-calibration-system)
13. [Integration hub & public API](#13-integration-hub--public-api)
14. [Quality gates, output validation & damage control](#14-quality-gates-output-validation--damage-control)
15. [Outcomes dashboard & ROI](#15-outcomes-dashboard--roi)
16. [Cost intelligence & task translation](#16-cost-intelligence--task-translation)
17. [Performance & benchmarks](#17-performance--benchmarks)
18. [Full context architecture](#18-full-context-architecture)
19. [Self-learning, evaluation framework & autonomous improvement](#19-self-learning-evaluation-framework--autonomous-improvement)
20. [Multi-tenancy & account management](#20-multi-tenancy--account-management)
21. [Pricing & billing](#21-pricing--billing)
22. [Non-functional requirements](#22-non-functional-requirements)
23. [Technical architecture](#23-technical-architecture)
24. [Starter pack catalogue](#24-starter-pack-catalogue)
25. [Competitive positioning & moats](#25-competitive-positioning--moats)
26. [MVP scope & success criteria](#26-mvp-scope--success-criteria)

---

## 1. Product vision & principles

### Vision
[PLATFORM] is a managed SaaS platform that lets any SMB — without technical staff — build and run an AI-powered version of their company. Each customer gets a digital twin of their organisation: AI agents that embody their roles, learn their processes, and autonomously handle the work their team does today.

**The owner is the CEO. The agents are the team. The platform is the company.**

### Platform universality
The platform is designed to work with any type of business. A **pack** is a pre-configured starter module for a specific business domain — it reduces time-to-value to 20 minutes. Packs are shortcuts, not fences.

### France-first positioning
- 100% French interface and support from MVP
- AI Act compliance by design (deadline August 2026)
- Data hosted in Europe (Mistral AI, Scaleway, Hetzner)
- French AI models (Mistral) as backbone for all French-language tasks
- No personal data ever processed outside the EU

### What it is
- A managed, non-technical platform for deploying AI agent teams in any business
- A pack system that makes setup immediate for covered domains
- A digital twin that learns and encodes how each specific company works — including its people, its contacts, and its processes
- A trust calibration system that graduates agent autonomy based on demonstrated performance
- A governance layer that keeps humans in control without requiring technical expertise
- An AI Act-compliant product by architecture (not by add-on)

### What it is not
- Not a developer tool or framework (no code required, ever)
- Not a single-agent product (covers the whole company, not one function)
- Not a workflow builder (no drag-and-drop pipelines)
- Not a chatbot (agents have jobs, not chat windows)
- Not self-hosted (fully managed — customers never see infrastructure)
- Not limited to specific industry sectors

### Design principles

**1. Business language everywhere.**
Every label, metric, button and message is written in business terms. No tokens, heartbeats, adapters or API calls visible to the user.

**2. The owner is always in control.**
No agent can take a consequential action without the operator knowing. Approval gates, budget limits and suspension controls are always visible and accessible.

**3. Adapts to any company.**
The platform adapts to the customer's company — not the other way around. Each deployment reflects the processes, tone, contacts and priorities of that specific business.

**4. The platform gets smarter over time.**
Every completed task, every human rating, every correction, every new contact interaction teaches the platform more about how this specific company works. The digital twin deepens. Agents improve automatically.

**5. Zero setup friction.**
A business owner must go from signup to their first agent running in under 20 minutes for any domain covered by a pack. The first week is designed — not left to chance.

**6. Compliance by design, not by checkbox.**
Human oversight, full audit trail, approval gates — baked into the architecture. The AI Act is a product feature.

**7. Trust is earned, not assumed.**
Agents start in supervised mode. Every week of quality output builds their Trust Score. When the score is high enough, the platform proposes autonomy upgrades. The operator decides — never the system alone.

---

## 2. Target market & personas

### Primary market — France, SMBs 3–50 people

**ICP (Ideal Customer Profile):**
- Founder or CEO of a 3–50 person SMB, any sector
- Non-technical: comfortable with SaaS tools, not with code
- Time-poor: their main pain is too much execution work for too few resources
- Outcome-focused: they want results, not features
- Sceptical of AI but willing to try if the value is immediately visible
- Decision = 1 person (no IT department, no procurement committee)

**Domains with a starter pack available:**

| Pack | Initial target customers | Pack availability |
|---|---|---|
| Recruitment agencies | ~2,000 firms in France | MVP launch |
| Marketing & communication agencies | ~18,400 independents | M+90 |
| Real estate agencies | ~30,000 (property management + sales) | M+180 |

### Primary persona — The Operator (the CEO)

**Profile:** Founder or CEO of an SMB, 35–55, non-technical, spends 50%+ of time on repetitive execution.

**What they want:** Delegate without losing control. Results in the first week. No surprises.

**What they fear:** Loss of control. Embarrassing outputs. Runaway costs. GDPR issues. Complexity.

**New insight — the trust journey:**
The Operator moves through three trust phases as they use the platform:
- **Weeks 1–4:** Cautious. Approves everything. Watches closely.
- **Months 2–4:** Selective. Trusts certain agents for certain task types. Still approves external communications.
- **Month 5+:** Delegating. Checks weekly summaries. Intervenes only when the platform flags something.

The product must respect and support this journey. It cannot shortcut it with configuration — trust must be demonstrated, not declared.

### Secondary persona — The Manager
Oversees agents in their function. More hands-on with outputs. No billing access.

### Out of scope — The Developer
Not a target persona. No developer required at any stage.

---

## 3. Core mental model

**You are running a company.** One mental model, enforced everywhere.

| Platform concept | Business analogy | What the user sees |
|---|---|---|
| Agent | Employee | "Your sourcing specialist" |
| Skill | Professional capability | "Knows how to qualify CVs" |
| Task | Work item | "Task: qualify the 12 CVs from React mission" |
| Handoff | Internal delegation | "Sophie passed this to Marc" |
| Goal | Company objective | "Reduce time-to-present to under 5 days" |
| Budget | Monthly allowance | "Sourcing: €80/month" |
| Heartbeat | Working hours | "Active Mon–Fri 8am–7pm" |
| Approval | Sign-off | "Approve before sending" |
| Trust Score | Performance track record | "Sophie: Highly trusted for CV qualification" |
| Audit log | Activity record | "What your team did this week" |
| Contact | Person you work with | "Martin Dupont — candidate, last contacted 3 days ago" |
| Memory | Institutional knowledge | "Knows your writing style" |
| Tasks included | Work volume | "2,000 tasks/month — about 160 CV qualifications or 400 emails" |

---

## 4. Information architecture

### Main navigation

```
[PLATFORM]
├── Home (dashboard + morning intelligence)
├── My Company
│   ├── Org chart
│   ├── Goals
│   ├── Company memory
│   └── Contacts [V2]
├── My AI Team
│   ├── Agents (list + individual pages)
│   ├── Trust centre
│   └── Hire an agent
├── Work
│   ├── All tasks
│   ├── By project
│   └── Calendar view [V2]
├── Integrations
│   ├── Connected tools
│   └── API & webhooks [V2]
├── CEO Console
├── Reports
│   ├── Performance & ROI
│   ├── Costs
│   └── Benchmarks [V2]
└── Settings
    ├── My company
    ├── Billing & usage
    ├── Human team
    └── Notifications
```

### Navigation behaviour
- Console persistent button (bottom-right) + `Cmd+K` shortcut from any page
- Escalation banner at top of all pages when approvals pending
- Morning intelligence cards at top of dashboard — proactive, not reactive
- Mobile: bottom tab bar (5 items max); approval flows optimised for touch
- Trust centre accessible from agent detail pages and from team overview

### User roles

| Role | Access |
|---|---|
| Owner | Full access including billing, trust settings |
| Admin | Full access except billing |
| Manager | Full access to their function; read-only org + billing |
| Viewer | Read-only dashboard and reports |

---

## 5. UI — Philosophy & design system

### Core philosophy

**The product must feel like a chief of staff, not a dashboard.**

A dashboard shows you data. A chief of staff tells you what matters, surfaces what you missed, flags what needs your attention, and suggests what to do next. The difference is agency. The platform has opinions. It surfaces them.

Six UI principles:

**1. Morning briefing, not monitoring dashboard.**
Home answers: *"What did my team do? What needs my attention? What should I know?"*

**2. Proactive, not reactive.**
The interface brings important things to the user. Three morning intelligence cards per day, surfaced automatically from the platform's data — not waiting for the operator to go looking.

**3. Progressive disclosure.**
Simplified by default. Depth on click. A busy owner manages the platform in 5 minutes a day from the main view.

**4. No ambiguous states.**
Every agent: ✅ Working / ⏸ Paused / ⚠ Needs you / 🔒 In trust review / ❌ Error. Every trust proposal: Pending / Accepted / Declined.

**5. Human warmth.**
Agents have first names. Notifications are in natural language. The tone is a competent colleague, not a system alert.

**6. Trust is visible.**
Every agent card shows their Trust Score as a simple indicator. Operators can see at a glance which agents have earned more autonomy.

### Design system

**Colour palette**
- Background: warm off-white (#FAFAF8)
- Card surface: white (#FFFFFF)
- Borders: warm grey (#E8E4DC)
- Primary accent: forest green (#1A9E68) — action, success, trust earned
- Secondary accent: amber (#C97C0A) — attention, review needed
- Trust indicator: deep blue (#1A4E8C) — trust proposals, autonomy
- Error: soft red (#B91C1C)
- Primary text: near-black (#0F0F0D)
- Secondary text: warm grey (#8A8680)

**Typography**
- Headings: Georgia serif
- Body: system sans-serif
- Monospace (timestamps only): Menlo

**Key components**
- **Agent card:** employee profile — includes Trust Score indicator
- **Activity feed:** business journal with handoff indicators
- **Approval card:** management sign-off form
- **Trust proposal card:** distinct blue-tinted card — "Sophie has earned more autonomy"
- **Morning intelligence card:** proactive insight surfaced by the system
- **Contact card:** person profile with interaction history
- **Usage gauge:** "847/2,000 tasks — about 65 more CV batches this month"

---

## 6. Main screens & flows

### 6.1 Home — Dashboard with morning intelligence `[MVP]`

**Goal:** In 10 seconds: is everything fine, what needs attention, and what should I know?

```
┌─────────────────────────────────────────────────────────┐
│ [ESCALATION BANNER — only if approvals pending]          │
│ ⚠ 2 actions waiting for your sign-off  [View →]        │
├─────────────────────────────────────────────────────────┤
│ HEADER                                                   │
│ Good morning, Luc 👋  Monday 11 April                   │
│ Your team completed 47 tasks over the weekend.          │
│ 847 / 2,000 tasks · about 95 CV batches remaining      │
├─────────────────────────────────────────────────────────┤
│ MORNING INTELLIGENCE  (auto-surfaced, 3 cards max)       │
│                                                          │
│ 💡 Sophie hasn't placed a candidate in 18 days —        │
│    40% below your previous pace. Want me to look        │
│    into why?  [Analyse →]  [Dismiss]                    │
│                                                          │
│ ⭐ Sophie qualifies CVs at 4.8/5 for 6 weeks straight.  │
│    She's ready for more autonomy on this task.          │
│    [Review proposal →]  [Later]                         │
│                                                          │
│ 📅 Client Buildtech hasn't had a report in 12 days.     │
│    Their contract renews in 30 days. Ask Marc to        │
│    prepare one?  [Delegate now →]  [Dismiss]            │
├────────────────────────┬────────────────────────────────┤
│ RECENT ACTIVITY        │ YOUR TEAM                      │
│ [same as v4]           │ [same as v4 + Trust indicator] │
├────────────────────────┴────────────────────────────────┤
│ PRIMARY GOAL + ROI (same as v4)                          │
└─────────────────────────────────────────────────────────┘
```

**Morning intelligence rules:**
- Maximum 3 cards per day — never more, never spammy
- Cards are generated from: audit trail anomalies, trust score thresholds, contact interaction gaps, goal progress deviations
- Each card has two actions: a primary CTA and Dismiss
- Dismissed cards are never shown again for the same insight within 14 days
- Cards are sorted by urgency: revenue-impacting > trust proposals > relationship gaps
- Never show a card that requires more than 2 clicks to resolve

---

### 6.2 AI Team page `[MVP]`

Same card grid as v4, enhanced with:
- **Trust indicator** on each agent card: a small coloured dot — green (trusted), blue (upgrade available), grey (building)
- **Handoff indicator:** "Passed 3 tasks to Marc this week" visible on sourcing agents

---

### 6.3 Agent detail page `[MVP]`

Same as v4, with added sections:

**Trust & Autonomy section:**
```
TRUST TRACK RECORD
Sophie · CV qualification

★★★★★  6 consecutive weeks above 4.5/5
★★★★½  Last 47 batches reviewed by you
🔵 Ready for autonomy upgrade

[Review trust proposal →]
```

**Recent handoffs (new):**
```
HANDOFFS THIS WEEK
→ Passed 3 qualified candidates to Marc for client presentation prep
→ Received 1 task from Marc: "Follow up with React Senior shortlist"
```

---

### 6.4 Trust centre page `[MVP — V2 for full UI]`

**Goal:** See which agents have earned more autonomy, review and act on proposals.

```
┌─────────────────────────────────────────────────────────┐
│ Trust Centre                                             │
│ "Agents earn more autonomy through demonstrated quality" │
├──────────────────────────────────────────────────────────┤
│ PENDING PROPOSALS                                        │
│                                                          │
│ 👩 Sophie — CV qualification                            │
│ ────────────────────────────────────────────────────    │
│ Current: you review every batch                         │
│ Proposed: batches under 15 CVs run autonomously         │
│ Evidence: 4.8/5 average · 47 batches · 6 weeks         │
│ What changes: you'll see a weekly summary instead        │
│ What stays: you can still review any batch on request   │
│                                                          │
│ [Accept this proposal]  [Modify threshold]  [Decline]   │
│                                                          │
│ ACTIVE TRUST LEVELS                                      │
│ Sophie · CV qualification    ████████░░  Supervised      │
│ Sophie · Job posting         ██████████  Autonomous      │
│ Marc · Client emails         ████░░░░░░  Building        │
│ Clara · LinkedIn posts       ██████░░░░  Supervised      │
└─────────────────────────────────────────────────────────┘
```

---

### 6.5 Task thread with output validation `[MVP]`

Same as v4, with one addition: if the agent's output failed schema validation before reaching the operator, a warning banner appears at the top of the thread:

```
⚠ Schema note: Sophie's output is missing the "concerns" field
  required for CV qualifications. She has been asked to
  complete it. [View her correction →]
```

---

### 6.6 CEO Console — proactive intelligence `[MVP]`

See section 11 for the full Console spec. The key UI change: the Console opens with morning intelligence pre-loaded if there are unaddressed cards, not an empty chat.

---

### 6.7 Contacts page `[V2]`

**Goal:** See every person the platform has interacted with, what the agents know about them.

```
┌─────────────────────────────────────────────────────────┐
│ Contacts · 47 people                     [+ Add contact] │
├─────────────────────────────────────────────────────────┤
│ Martin Dupont          Candidate                        │
│ Last contact: 3 days ago by Sophie (follow-up email)    │
│ Summary: Python developer, 5y exp, Paris, available M+1 │
│ Open tasks: 1 (follow-up pending approval)              │
│                                                          │
│ Sarah Bertin           Client contact · Innotec         │
│ Last contact: yesterday by Marc (weekly report sent)    │
│ Summary: HR Director, responds within 24h, prefers      │
│ concise reports, contract renewal in 30 days            │
│                                                          │
│ [View all contacts →]                                    │
└─────────────────────────────────────────────────────────┘
```

---

### 6.8 Damage control flow `[MVP]`

When an operator marks a sent communication as an error:

```
DAMAGE CONTROL — Sophie · Email to Martin Dupont

What went wrong?
○ Wrong tone / content
○ Sent to wrong person
○ Incorrect information
○ Should not have been sent

[Continue →]

Suggested recovery actions:
☑ Draft a correction email to Martin Dupont
☑ Add a memory note: "Error occurred 11/04 — handle with care"
☑ Pause Sophie's email sending for 24h pending review

[Execute recovery plan]  [Customise]  [Cancel]
```

---

### 6.9 Universal interaction patterns `[MVP]`

**Notifications/toasts**
- Success: soft green, ✓ icon, short message in French, 3s auto-dismiss
- Warning: amber, ⚠ icon, message + "Voir le détail" link
- Error: soft red, ✕ icon, message + corrective action — never just "Une erreur s'est produite"
- Loading: skeleton screens + contextual agent action ("Sophie est en train de lire les CV...")

**Mobile:** bottom tab bar (5 items), full-width approval buttons, Console via slide-up.

**Trust proposal notifications** — blue card, never amber:
> "[Prénom] est prête à travailler avec plus d'autonomie sur [tâche]. 6 semaines de travail impeccable. Voir la proposition →"
Maximum 1 per week.

**Approval micro-rewards** — inline in thread after every approval (see section 7.5 for full table):
> After 10th consecutive 4+★: "Vous avez validé 10 sélections de Sophie — toutes bien notées. Elle est prête pour un peu plus de liberté. [Voir la proposition →]"

**Activation notifications** — exact copy in section 7.4. Never generic. Always names the agent + the specific content.

### 6.10 The live activity feed — granular real-time events `[MVP]`

The activity feed shows what agents are doing right now — not just completed tasks. This is the trust accelerator: watching Sophie work in real time builds more trust in 6 minutes than 6 weeks of batch approvals.

**Granular SSE event types:**

```typescript
type ActivityEvent =
  // Task-level
  | { type: 'task.started',    agentName, taskTitle }
  | { type: 'task.completed',  agentName, taskTitle, outcome }
  | { type: 'task.handoff',    fromAgent, toAgent, summary }
  // Within-task (live only — not stored)
  | { type: 'agent.reading',   agentName, subject }
  | { type: 'agent.analysing', agentName, finding }
  | { type: 'agent.writing',   agentName, what }
  | { type: 'agent.browsing',  agentName, intent }
```

**Live feed display:**

```
🔴 En direct
👩 Sophie lit le CV de Martin Dupont...
   → Elle identifie : 5 ans Python, Paris, disponible M+1
   → Elle rédige son évaluation...

──────────────────────────────────────
il y a 2 min   Sophie a qualifié Julia Mercier   ★★★★★
il y a 14 min  Sophie a passé le dossier à Marc
il y a 2h      Marc a envoyé le rapport Innotec  ✓ Envoyé
Hier 18h47     Clara a rédigé 3 posts LinkedIn   ⏳ En attente
```

**Copy rule — every granular event:** `[Prénom agent] + [verbe présent] + [objet spécifique]`
- ✅ "Sophie lit le CV de Martin Dupont"
- ❌ "Agent processing input document"
- ✅ "Sophie identifie 5 compétences correspondant à votre brief"
- ❌ "Extracted 5 entities from document"

The live indicator ("🔴 En direct") only shows when an agent is actively processing. Granular events auto-clear 60s after the task completes. Past events show task-level only, newest first, max 8 visible.

---

## 7. Onboarding & activation sequence

### 7.1 The wizard — 20-minute setup

Same wizard flow as v4 (domain selection → company questions → AI team → tools → first goal). The wizard ends with the completion screen and the pack installer fires.

**Golden rule unchanged:** non-technical person must complete in under 20 real minutes before a pack ships.

### 7.2 The seed task problem — and how to fix it

**Problem:** After the pack installs, the first heartbeat fires in 5 minutes. If no emails have arrived and no CVs have been uploaded — the agent has nothing to do. The operator sees silence. This is the worst possible first experience.

**Solution:** Every pack ships with 3 seed tasks that fire on installation, independent of any external trigger. These use **production-quality anonymised data** — real CVs from past placements (donated by design partners, properly anonymised), real client report structures, real LinkedIn post formats. Indistinguishable from real work.

**The quality bar:** If the operator can tell it's a demo, it has failed. The seed task CV must be from the actual sector (IT recruitment, legal, finance — matched to the operator's declared specialisation). The score and recommendation must reflect genuine analysis. The tone must match the Company DNA entered in the wizard.

**Seed task rules:**
- 3 per pack, all different agent types
- Uses sector-matched, properly anonymised real-world data — never obviously fake names or fabricated scenarios
- Each produces output within 10 minutes of installation
- Each requires exactly one operator action (approve, rate, or post)
- Labelled "Tâche de bienvenue" — honest about being a demo without killing the magic
- Removed from the active task list once actioned

**Pack P1 seed tasks (specific):**
1. **Sophie** qualifies 5 anonymised CVs for a React Senior mission matching the operator's declared specialisation → operator reviews the shortlist and approves or adjusts scores
2. **Marc** drafts a weekly client report for "Innotec" (a fictional but realistic company in the operator's sector) → operator sees the exact format they'll get every week
3. **Clara** writes a LinkedIn post on a real current trend in their recruitment sector → operator can post it immediately or save it

### 7.3 The completion screen — exact copy `[MVP]`

The completion screen is the product's first impression. It must create anticipation, not announce a technical state.

**What the operator sees immediately after wizard:**

```
┌─────────────────────────────────────────────────────────┐
│                                                          │
│  [Animated org chart — agents appear one by one, 300ms] │
│                                                          │
│  Sophie est en train de lire votre boîte mail.          │
│  Elle aura quelque chose pour vous dans quelques        │
│  minutes.                                                │
│                                                          │
│  [Voir mon tableau de bord]   [Parler à mon équipe]     │
│                                                          │
│  0 / 2 000 tâches ce mois — environ 285 qualifications  │
│  de CV ou 2 000 e-mails                                  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Copy rules:**
- Never: "Your team is ready. First check-in in 5 minutes." — meaningless, robotic
- Always: name a specific agent doing a specific thing happening right now
- The subline names the agent and their action — not a system state
- The usage gauge is in business language from the first second

### 7.4 The designed first-week experience — exact choreography

5 engineered moments. Exact timing. Exact copy. Each requiring one simple action and delivering one clear feeling.

**This is not a feature. It is a script.**

---

**Moment 1 — Day 0, within 10 minutes of installation**

Trigger: seed task output ready (Sophie's qualification of the 5 sample CVs)

Push notification (mobile):
> **"Sophie vient de finir sa première sélection."**
> Elle a analysé 5 profils et en a retenu 2. Voir ce qu'elle a trouvé →

In-app banner (dashboard top):
> Sophie a qualifié 5 CV pour votre mission React Senior.
> **Elle recommande 2 profils.** [Voir la sélection →]

Task thread headline:
> "Voici ce que j'ai trouvé dans votre première mission. J'ai regardé les 5 profils et retenu ceux qui correspondent vraiment à ce que vous cherchez."

OPERATOR ACTION: Review Sophie's 2 recommended profiles. Rate them.

FEELING: *"She actually understands what a good CV looks like for my sector."*

MICRO-REWARD after rating: "Merci. Sophie a enregistré vos critères — elle s'en souviendra pour toutes vos prochaines missions."

---

**Moment 2 — Day 2, within 5 minutes of first real task completing**

Trigger: Sophie qualifies the first real incoming CV from the operator's actual inbox.

Push notification (mobile):
> **"[Prénom du candidat] vient d'arriver dans votre boîte."**
> Sophie vient de le lire. Elle lui donne 4,5/5. →

*(The notification names the actual candidate from the actual email — Isabelle recognises the name. This is the moment she understands it's real.)*

In-app banner:
> Sophie a analysé le CV de [Prénom] reçu ce matin.
> **Score : 4,5/5** — profil correspondant à votre mission [Mission]. [Voir →]

OPERATOR ACTION: Open the qualification. Rate it (1-5 stars).

FEELING: *"It's actually reading my real emails. It knows who sent what."*

MICRO-REWARD after rating:
- If rated 4-5★: "Sophie est alignée avec vos critères. Elle continuera sur cette base."
- If rated 1-3★: "Merci — Sophie a pris note. Elle ajustera ses prochaines évaluations."

---

**Moment 3 — Day 4, first proactive capability reveal**

*(The timing shift from v5: Day 4 is NOT "ask for LinkedIn access." Day 4 is show the operator something Sophie did without LinkedIn that impresses them — THEN introduce what more she could do.)*

Trigger: Sophie has processed 5+ real CVs, all rated 4+ stars. She noticed a market signal (e.g., multiple candidates from the same company, or a cluster of available profiles in a specific skill).

Morning card (8:05am):
> **Sophie a remarqué quelque chose.**
> Trois des profils qu'elle a qualifiés cette semaine viennent du même département tech chez [Entreprise]. Cela pourrait indiquer une réduction d'effectifs.

OPERATOR ACTION: Read the insight. Open the Console to ask more.

Console follow-up (auto-populated in Console):
> Sophie a détecté un signal marché intéressant. Voulez-vous qu'elle approfondisse la recherche ? Elle pourrait également sourcer des profils directement sur LinkedIn si vous lui donnez accès — elle ne publierait jamais à votre place sans votre accord.

FEELING: *"It noticed something I wouldn't have noticed. And now it's asking, not just doing."*

*(LinkedIn access is now offered in context — as a natural extension of something the operator already sees as valuable. Not as an arbitrary integration request.)*

---

**Moment 4 — Day 6, first "it remembered something you forgot"**

Trigger: Platform detects 3+ qualified candidates with score ≥ 4, no contact email sent in 4+ days.

Push notification — sent at 8:05am:
> **"Trois de vos candidats attendent depuis 4 jours."**
> Aucun d'eux n'a eu de nouvelles. Sophie peut leur envoyer un message aujourd'hui. →

*(Problem stated first. Slight urgency. The solution offered second — not the other way around.)*

Morning intelligence card on dashboard:
> **Trois candidats qualifiés, aucun contact.**
> [Prénom 1], [Prénom 2] et [Prénom 3] ont été qualifiés il y a 4 jours. Aucun e-mail n'est parti.
> Sophie a rédigé trois messages de prise de contact. [Voir les drafts →]

Task thread (already prepared by Sophie):
> J'ai préparé les e-mails de présentation pour vos trois candidats en attente. Les voici — relisez et approuvez, ou modifiez si vous voulez changer quelque chose.

OPERATOR ACTION: Read the 3 draft emails. Approve all 3 in one click.

FEELING: *"It noticed something I completely forgot. It was one step ahead of me."*

MICRO-REWARD after approval: "Envoyés. Sophie notera leurs réponses et vous tiendra informé(e)."

---

**Moment 5 — Day 7, the shareable card**

Trigger: 7 days after installation, sent at 8:00am (push + email).

Push notification:
> **"Votre première semaine avec votre équipe IA."**
> Sophie, Marc et Clara ont travaillé pendant 7 jours. Voici ce que ça a donné. →

In-app: the weekly summary screen opens automatically on next login.

**The shareable card** — a designed visual image generated dynamically:

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│   Ma première semaine avec mon équipe IA                     │
│                                                              │
│   ┌──────────────┐   ┌──────────────┐   ┌────────────────┐  │
│   │     12       │   │   3h libérées│   │  €28 / mois    │  │
│   │  CV qualifiés│   │   par semaine│   │  vs 3 200 €    │  │
│   └──────────────┘   └──────────────┘   └────────────────┘  │
│                                                              │
│   "C'est comme avoir une chargée de recherche              │
│    qui travaille la nuit."                                   │
│                                  — [Prénom], [Cabinet]       │
│                                                              │
│   [singular.ceo]                                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**The pull quote is editable.** The operator can replace the default quote with their own words in 2 taps. The numbers are real data from their actual first week. The card design matches the platform's visual identity.

Below the card on the summary screen:

> **Partager votre première semaine**
> [LinkedIn]  [WhatsApp]  [Copier le lien]

OPERATOR ACTION: Share to LinkedIn (one tap) or WhatsApp (one tap to a peer).

FEELING: *"I need to show this to [colleague name]."*

**Why this works as a growth mechanic:** The card is specific (Isabelle's real numbers), surprising (€28 vs €3,200 is a genuine shock), and personal (her name, her agency). It will appear on LinkedIn looking like an organic post, not an ad. Every share reaches 200–500 relevant people in the French recruitment community.

### 7.5 The approval micro-reward system `[MVP]`

Approvals must feel like they're building toward something, not like overhead.

Every approval triggers a micro-reward message in the task thread — a short line that confirms what was learned and what happens next. These are not notifications. They appear inline in the thread, immediately after the operator clicks Approve.

**Streak micro-rewards (by count):**

| Consecutive approvals | Message shown in thread |
|---|---|
| 1st approval of a task type | "C'est enregistré. Sophie s'en souviendra." |
| 3rd consecutive 4+★ rating | "Sophie commence à vraiment connaître vos critères." |
| 5th consecutive 4+★ rating | "5 validations consécutives. Sophie travaille bien sur ce type de tâche." |
| 10th consecutive 4+★ rating | "Vous avez validé 10 sélections de Sophie — toutes bien notées. Elle est prête pour un peu plus de liberté sur ce type de tâche. [Voir la proposition →]" |
| After any correction | "Sophie a pris note. Elle ne refera pas cette erreur." |
| After rejection | "Compris. Sophie adaptera son approche pour la prochaine fois." |

**The 10th approval** is the micro-reward that triggers a fast-track trust proposal. This is not the 6-week trust system — this is the accelerated path for operators who engage deeply in the first two weeks. It shortens the trust journey for the operators who are paying the most attention.

**Approval streak indicator** (visible on agent card in team view):

```
👩 Sophie
[■■■■■■■■░░]  8/10 — presque prête pour plus d'autonomie
```

This progress bar is visible to the operator. It creates a game loop: every approval moves the bar. When it fills, Sophie gets more freedom. The operator feels the accumulation of trust.

### 7.6 Pack architecture (unchanged from v4)

Pack.json, onboarding.json, SKILL.md files, agents/, skills/, quality-gates.json. Architecture unchanged from v4.

Pack installer runs in 7 atomic steps with full rollback. Step 7 (first heartbeat) now also schedules the 3 seed tasks.

**New in v5:** pack.json includes an `activationSequence` block defining the exact trigger conditions and notification copy for all 5 wow moments. This means the activation sequence is part of the pack definition — a new pack for a new domain gets its own customised sequence of moments appropriate to that business context.

### 7.4 Pack architecture (unchanged from v4)

See v4 section 7 — pack.json, onboarding.json, SKILL.md files, agents/, skills/, quality-gates.json. Architecture unchanged.

Pack installer still runs in 7 atomic steps with full rollback. Step 7 (first heartbeat) now also schedules the 3 seed tasks.

---

## 8. Digital twin engine

### 8.1 Company DNA `[MVP]`

Structured document encoding company identity. Read by every agent at every heartbeat. Fields unchanged from v4.

**New: continuous DNA enrichment `[V2]`**
DNA is not static. After the initial wizard, the platform continuously learns from agent outputs and operator feedback. Enrichment triggers:
- Operator edits a DNA field → timestamp + source recorded
- Agent uses a new term consistently in approved outputs → proposed as new terminology entry
- Operator corrects agent tone in 3+ consecutive tasks → tone field proposed for update

### 8.2 Process library `[V2]`

Library of "how we do things" documents. Injected into context when task type matches.

### 8.3 Org memory `[MVP for read; V2 for auto-extraction]`

Company-level knowledge base (pgvector). See section 18 for retrieval architecture.

### 8.4 Contacts entity `[V2 — architecture from MVP]`

**What it is:** Every person an agent interacts with — candidates, clients, suppliers, prospects — builds a structured knowledge profile. This is the most valuable long-term intelligence in the platform for relationship-intensive businesses.

**Why it matters:** The org memory knows about the company. The contacts entity knows about the people. A recruitment agent that has emailed Martin Dupont 5 times needs to know: what was discussed, what were his preferences, when is he available, what was the outcome of the last conversation. Without this, every interaction starts from zero.

**Data model:**

```typescript
interface Contact {
  id:          string
  companyId:   string
  name:        string
  email?:      string
  phone?:      string
  type:        'candidate' | 'client' | 'supplier' | 'prospect' | 'other'
  // Auto-populated from agent interactions
  summary:     string           // 2-3 sentence AI-generated summary
  tags:        string[]         // auto-extracted: skills, preferences, status
  lastContact: Date
  lastContactBy: string         // agent name
  interactionCount: number
  sentiment:   'positive' | 'neutral' | 'cautious'  // inferred from exchanges
  // Memory
  notes:       ContactNote[]    // human-added notes
  timeline:    ContactEvent[]   // every agent interaction, chronological
}
```

**How contacts are created:**
- Automatically when an agent sends/receives an email to/from a new person
- Automatically when an agent processes a CV (candidate created)
- Manually by the operator from the Contacts page
- Never duplicated — email deduplication on creation

**Context injection:**
When a task mentions or involves a known contact, their summary + recent timeline is injected into Layer 4 of the context assembly pipeline (replacing or augmenting one org memory slot).

**GDPR handling:**
Contacts are personal data. All contact records: `gdpr_required: true` in any skill that processes them. Contact data stored EU-only, encrypted at rest, subject to right-to-erasure requests via the operator.

---

## 9. Agent workforce

### 9.1 Agent list — see section 6.2 `[MVP]`

### 9.2 Agent detail — see section 6.3 `[MVP]`

### 9.3 Hire an agent `[MVP]`

4-step flow: choose role → configure → review capabilities → confirm (Operator approval required).

### 9.4 Agent configuration `[MVP]`

Configurable: name, schedule, budget limit, reporting line, integration access, custom instructions `[V2]`.

### 9.5 Agent-to-agent handoffs `[MVP]`

**What it is:** Agents can pass structured work products to each other. A sourcing agent that has qualified a candidate shortlist can hand off to the client relations agent to prepare the client presentation. The output becomes the input.

**Why it matters:** Without handoffs, agents are silos. Real business workflows are chains. A qualified candidate shortlist has no value if the client relations agent doesn't know it exists.

**The `handoff_to` action type:**

Skills can declare handoff targets in their output schema:

```yaml
# In SKILL.md frontmatter
output:
  schema: qualification-result
  handoff_to:
    condition: "score >= 4 AND recommendation == 'proceed'"
    agent_role: "client-relations"
    task_template: "present-candidates"
    context_passthrough: ["candidate_name", "score", "key_strengths", "mission_id"]
```

When an agent completes a task and the handoff condition is met:
1. A new task is created for the target agent
2. The output of the first task becomes the context of the second
3. Both tasks are linked in the UI — the thread shows "Handed off to Marc"
4. The audit trail records the handoff as a single chain
5. The operator sees the full chain in one thread, not two separate tasks

**UI representation:**

In the task thread:
```
👩 Sophie qualified 8 candidates for React Senior · Lyon
   Top 3 candidates with scores above 4.5
   ↓ Handed off to Marc (Client relations)
   
👨 Marc is preparing the client presentation for Buildtech
   [In progress]
```

**Handoff approval rules:**
- If the first task required approval, the handoff is included in that approval
- If approved: the handoff task fires automatically
- If rejected: the handoff is cancelled
- Operator can configure "always ask before handing off" per agent pair

**Circular handoff prevention:**
The platform detects and blocks circular handoff chains (A→B→A). Any chain longer than 3 agents requires explicit operator approval.

---

## 10. Goals & task management

Goals cascade: company → function → agent. Tasks have conversation threads (section 6.5). Human ratings 1–5 stars. Priority system (Critical / High / Medium / Low).

**Goal tracking:** Progress bar on dashboard and goal detail page. Agents automatically link completed tasks to the relevant goal.

**Task lifecycle:** Created (agent or operator) → In progress → Schema validated → Quality gates checked → Pending approval (if required) → Completed → Rated.

---

## 11. CEO Console — proactive intelligence

### 11.1 The shift: from reactive to proactive

In v4, the Console was a command interface. You asked questions, it answered. You gave instructions, it executed.

In v5, the Console is also a chief of staff. It surfaces things you didn't ask for. It tells you what you should know before you know to ask.

**The distinction:**
- Reactive: "What did my team do this week?" → structured summary
- Proactive: "I noticed Sophie hasn't placed a candidate in 18 days" → unprompted insight

Both are necessary. The platform delivers both.

### 11.2 Morning intelligence generation

Every morning (configurable time, default 8am), the platform runs an intelligence sweep across:
- Audit trail anomalies (task completion rates below baseline)
- Contact interaction gaps (clients who haven't been contacted in N days)
- Goal progress deviations (goals moving slower than projected)
- Trust Score thresholds crossed (agents ready for autonomy upgrade)
- Budget trajectory (on pace to exceed monthly limit)
- Competitive signals (if web browsing is active)

From this sweep, it generates up to 3 intelligence cards, ranked by urgency. These appear on the dashboard (section 6.1) and are also available in the Console as pre-loaded context.

**Intelligence card format:**
```typescript
interface IntelligenceCard {
  type:     'anomaly' | 'trust_proposal' | 'relationship_gap' | 'goal_risk' | 'budget_alert'
  urgency:  'high' | 'medium' | 'low'
  headline: string          // max 12 words, specific
  context:  string          // 1-2 sentences explaining why this matters now
  primaryCTA: {
    label:  string          // max 4 words
    action: string          // what happens when clicked
  }
  dismissCTA: 'Later' | 'Not relevant' | 'Got it'
  expiresAt: Date           // card auto-dismissed after this date
}
```

**Example intelligence cards by type:**

Anomaly:
> "Sophie qualified 60% fewer CVs this week."
> Context: "Her pace dropped from 12 to 5 per week. No error was logged — this may be a pipeline issue. Want me to check?"
> CTA: "Diagnose this →"

Trust proposal:
> "Sophie is ready for CV autonomy."
> Context: "47 batches, 4.8/5 average, 6 weeks running. Propose removing the approval requirement for batches under 15."
> CTA: "Review proposal →"

Relationship gap:
> "Buildtech hasn't heard from you in 12 days."
> Context: "Their contract renews in 30 days. Marc is scheduled to send a report next Monday — that may be too late."
> CTA: "Ask Marc to send today →"

Goal risk:
> "You're 3 weeks behind on your placement goal."
> Context: "At current pace you'll place 4 candidates this quarter, not 7. Adjust the goal or intensify sourcing?"
> CTA: "Talk to Marc →"

### 11.3 Console functional capabilities (unchanged from v4)

**Reactive (unchanged):**
- Query company state in natural language
- Delegate tasks to agents
- Approve/reject/modify pending actions
- Receive automatic escalations

**Safe actions (no approval):** reading, summarising, creating drafts, internal reports

**Approval-required actions:** external emails, publishing, contacting suppliers, exceeding agent budget

### 11.4 Console proactive session start

When the operator opens the Console with unaddressed morning intelligence cards:

```
🤖 Your team is active and everything is running.
   I have 2 things I want to flag before we start:

1. Sophie's pace has dropped this week — I can diagnose
2. Buildtech hasn't had a report in 12 days

Should I start with either of these, or is there
something else on your mind?
```

The operator can address the flagged items or ignore them and start with their own query.

---

## 12. Trust calibration system

### 12.1 Why this exists

The biggest barrier to SMB AI adoption is not capability — it's trust. Operators need to see that an agent consistently does good work before they're willing to let it work without supervision.

The platform cannot shortcut this journey with a configuration setting. It must be earned through demonstrated performance over time, then formalised through an explicit proposal + acceptance flow.

### 12.2 Trust Score

Every agent has a Trust Score per skill type. It is a rolling metric, not a one-time assessment.

```
Trust Score = weighted_average(
  quality_rating,      // operator ratings, weight: 50%
  gate_pass_rate,      // % of outputs that pass quality gates, weight: 30%
  schema_pass_rate,    // % of outputs that pass schema validation, weight: 20%
  window: last_30_days
)
```

Trust Score ranges:
- 0–2.9: **Building** — not enough data or significant quality issues
- 3.0–3.9: **Supervised** — requires approval for this task type
- 4.0–4.4: **Trusted** — eligible for partial autonomy (batches under threshold)
- 4.5–5.0: **Highly trusted** — eligible for full autonomy on internal tasks

The Trust Score is visible to the operator in plain language — never as a raw number. "Sophie is Highly Trusted for CV qualification. She's been building toward this for 6 weeks."

### 12.3 Autonomy levels per skill

Each skill has an autonomy level, separate from the Tier A/B skill classification:

| Level | What it means | Operator interaction |
|---|---|---|
| **Supervised** | Every output reviewed before action | Approve each task |
| **Spot-checked** | Operator reviews 1 in 5 outputs, randomly | Weekly sample review |
| **Summarised** | Agent acts autonomously, operator sees weekly digest | Weekly summary |
| **Silent** | Agent acts, operator notified only on anomaly | Anomaly alerts only |

Default for all agents on installation: **Supervised**.
Maximum autonomy the platform will propose autonomously: **Summarised** (Silent requires explicit operator request).

### 12.4 Trust upgrade proposals

When a Trust Score crosses a threshold and is sustained for 2+ weeks, the platform generates a trust upgrade proposal.

**Proposal format:**

```
TRUST PROPOSAL — Sophie · CV qualification

Current level:   Supervised (you review every batch)
Proposed level:  Spot-checked (you review 1 in 5, randomly)

Evidence:
  · 47 batches completed
  · 4.8 / 5.0 average quality rating
  · 6 consecutive weeks above threshold
  · 0 quality gate violations in last 30 days

What changes if you accept:
  · Sophie will act on CV batches under 15 CVs without waiting
  · You receive a daily digest of what she qualified
  · You can still request full review of any batch at any time
  · One batch per week is randomly selected for your review

What stays the same:
  · External communications (emails to candidates) still require approval
  · Budget limits unchanged
  · You can return to full supervision at any time in one click

[Accept →]  [Modify threshold]  [Keep current level]
```

**Proposal rules:**
- Maximum 1 proposal per agent per week
- Proposals expire after 14 days if not acted on
- Declined proposals are not re-proposed for 30 days
- Proposals only cover specific skill types — not the whole agent
- External communications (emails, posts) can never autonomously progress beyond "Spot-checked" for Trust Score < 4.8

### 12.5 Trust downgrade

If an agent's Trust Score drops below the threshold for their current autonomy level (sustained for 7+ days), the platform:
1. Automatically returns the skill to the previous autonomy level
2. Notifies the operator: "Sophie's CV qualification quality has dropped. I've temporarily increased oversight while she gets back on track."
3. Flags the skill for self-improvement analysis

The operator is informed of every downgrade. It never happens silently.

### 12.6 Trust reset

When a skill is manually updated by the operator, or when the self-improvement system activates a new skill version, the Trust Score for that skill resets to 0 for that skill type. Trust must be re-earned with the new version.

---

## 13. Integration hub & public API

### 13.1 Native integrations `[MVP]`

Pre-built one-click connectors (unchanged from v4):
- Gmail / Outlook (OAuth2)
- Google Calendar (OAuth2)
- Slack (OAuth2)
- Notion (API key)
- LinkedIn (OAuth2 — publishing)

### 13.2 MCP Router `[MVP]`

Built-in MCP router for Gmail MCP, Google Calendar MCP, Slack MCP, HubSpot MCP. Handles auth injection server-side. All calls logged to audit trail. See TECHNICAL_SPEC_v2.md Module 4 for implementation.

### 13.3 Raw API & Webhooks `[MVP]`

Outbound API calls and inbound webhooks per company (see TECHNICAL_SPEC_v2.md Module 4).

### 13.4 Web browsing `[MVP]`

Firecrawl + Jina fallback. Available to skills declaring `web_access: true`. All URLs logged. GDPR flagging on personal data. (See TECHNICAL_SPEC_v2.md Module 5.)

### 13.5 Credential vault `[MVP]`

AES-256-GCM, per-company key. Credentials never sent to LLM providers. (See TECHNICAL_SPEC_v2.md Module 4.)

### 13.6 Public API `[V2]`

**Why it exists:** 20% of Growth and Pro customers have a technical employee, developer friend, or Zapier account. Without a public API, these customers cannot deeply integrate the platform into their workflow — which is the highest-retention behavior there is.

**The public API is not for building on top of Singular. It is for connecting Singular to the tools the customer already uses.**

**Authentication:** API key per company, generated from Settings → API & webhooks. Rate-limited per plan.

**Core endpoints:**

```
# Read
GET  /v1/agents                          — list all agents + status
GET  /v1/agents/{id}/tasks               — recent tasks for an agent
GET  /v1/tasks/{id}                      — task detail + thread
GET  /v1/contacts                        — contact list [V2]
GET  /v1/memory                          — searchable org memory
GET  /v1/usage                           — current month usage + limits

# Write
POST /v1/tasks                           — create a task for a specific agent
POST /v1/console/message                 — send a message to the CEO Console
POST /v1/contacts                        — create or update a contact [V2]

# Webhooks (outbound)
# Register a URL to receive events when:
POST /v1/webhooks                        — register webhook endpoint
# Events delivered:
#   task.completed    — when any task completes (with output)
#   task.pending_approval — when task awaits operator sign-off
#   agent.status_changed  — agent goes active/paused/error
#   trust.proposal_created — new autonomy upgrade available
```

**Usage limits by plan:**

| Plan | API calls/month | Webhooks/month |
|---|---|---|
| Solo | — | — |
| Growth | 1,000 | 5,000 |
| Pro | 10,000 | 50,000 |
| Enterprise | Unlimited | Unlimited |

**Public API philosophy:** The API exposes business concepts (agents, tasks, contacts), not infrastructure concepts (heartbeats, queues, embeddings). The abstraction level is identical to the UI.

---

## 14. Quality gates, output validation & damage control

### 14.1 Output schema validation `[MVP]`

**What it is:** Every skill declares a JSON output schema in its frontmatter. Before an output reaches the quality gates, the platform validates its structure and completeness. Malformed outputs are flagged and the agent is asked to correct them — before the operator ever sees them.

**Why it matters:** Quality gates check content (forbidden words, volume limits). They don't check structure. An agent could produce a well-written but structurally incomplete CV qualification that passes all gates but is missing critical fields. Output schema validation catches this upstream.

**Skill declaration:**

```yaml
# In SKILL.md frontmatter
output:
  schema:
    type: object
    required: [candidate_name, score, recommendation]
    properties:
      candidate_name:
        type: string
      score:
        type: number
        minimum: 1
        maximum: 5
      key_strengths:
        type: array
        items: { type: string }
        minItems: 1
      concerns:
        type: array
        items: { type: string }
      recommendation:
        type: string
        enum: [proceed, reject, review]
```

**Validation flow:**

```
Agent produces output
      ↓
Schema validation (automatic)
      ↓
PASS: proceed to quality gates
FAIL: agent shown the missing/invalid fields
      ↓
Agent corrects and re-submits (within same task — no new task created)
      ↓
If correction fails after 2 attempts: task escalated to operator
  with note: "Sophie had trouble completing this qualification.
  Her draft is here for your review."
```

**UI representation:** If schema validation ran and required a correction, a small note appears in the task thread: "Sophie revised her output once to complete all required fields." This is a positive signal (the system is working) not a warning.

### 14.2 Auto-protection quality gates `[MVP]`

Always active, non-disableable (unchanged from v4):

| Gate | What it checks | Action on failure |
|---|---|---|
| Volume limit | Max 50 emails/day per agent (default) | Block + alert operator |
| Authorised recipients | Whitelisted domains only in production | Block + queue |
| Agent budget | Spend >= monthly limit | Block until approval |
| Forbidden content | Words/topics listed in Company DNA | Block + escalate to Console |

### 14.3 Pack-included gates `[V2]`

Domain-specific gates from pack's quality-gates.json (unchanged from v4).

### 14.4 Immutable audit trail `[MVP]`

Every agent action logged. Database-level UPDATE/DELETE rules prevent modification. AI Act Art. 12 compliance documentation. (See TECHNICAL_SPEC_v2.md Module 6.)

### 14.5 Damage control flow `[MVP]`

When an external communication has been sent and the operator marks it as an error, the platform activates a structured recovery path.

**Trigger:** Operator selects any sent email/post/message and clicks "Report an error"

**Flow:**

```
Step 1 — Characterise the error
  ○ Wrong tone or content
  ○ Sent to wrong person
  ○ Contains incorrect information
  ○ Should not have been sent at all

Step 2 — Immediate containment (automatic)
  · Agent's send permission for this task type suspended for 24h
  · Task flagged in audit trail as "Error reported"
  · Memory entry created: "Error occurred communicating with
    [contact] on [date] re [topic] — handle with care"

Step 3 — Recovery plan (operator chooses)
  ☑ Draft a correction/apology message to [contact]
    Preview: [draft shown for approval]
  ☑ Mark contact as "Needs sensitive handling"
  ☑ Trigger self-improvement analysis for this skill
  □ Suspend this skill pending review

[Execute plan]  [Customise]
```

**Post-damage-control:**
- The correction draft goes through normal approval flow (not auto-sent)
- The agent's Trust Score for the relevant skill resets
- The self-improvement analyser is triggered immediately (not on the usual quality-degradation schedule)
- A follow-up reminder appears in 7 days: "Did the situation with [contact] resolve? [Yes, all good / No, still an issue]"

---

## 15. Outcomes dashboard & ROI

See section 6.7 for interface design. No structural changes from v4.

**Key metrics:** tasks completed, hours freed, AI team cost vs human equivalent, quality score average, active contacts maintained `[V2]`.

**Hire simulator:** unchanged.

---

## 16. Cost intelligence & task translation

### 16.1 The abstraction problem

"847 tasks used" means nothing to a recruitment agency founder. They don't know what a task is or whether 847 is a lot.

The platform must translate task counts into business language for the specific domain. This is not optional — it is the difference between a usage gauge that creates anxiety and one that creates clarity.

### 16.2 Task translation `[MVP]`

Each pack defines a task translation table in its `pack.json`:

```json
{
  "taskTranslations": {
    "unitName": "task",
    "translations": [
      { "skillType": "qualification-cv",     "tasksPerUnit": 7,  "unitLabel": "CV batch" },
      { "skillType": "job-posting-writer",   "tasksPerUnit": 3,  "unitLabel": "job posting" },
      { "skillType": "client-email",         "tasksPerUnit": 1,  "unitLabel": "client email" },
      { "skillType": "weekly-client-report", "tasksPerUnit": 12, "unitLabel": "client report" },
      { "skillType": "market-intelligence",  "tasksPerUnit": 8,  "unitLabel": "market analysis" }
    ],
    "remainingTemplate": "about {{count}} more {{unit}}s this month"
  }
}
```

**Usage gauge display:**

```
BEFORE (v4):  847 / 2,000 tasks (42%)
AFTER  (v5):  847 / 2,000 tasks — about 95 more CV batches or 380 emails this month
```

The primary number (847/2000) is unchanged — operators can learn it over time. The translation is secondary, in smaller text, rotating through the most-used skill types.

**Overage warnings translated:**

```
BEFORE: "You have 153 tasks remaining this month."
AFTER:  "You have 153 tasks left — about 20 more CV batches.
         After that, each batch costs €0.13 extra."
```

### 16.3 Cost display `[MVP]`

Unchanged from v4: never tokens, always business terms. Alerts at 80% and 100%. Hard stop with 48h proactive notification.

---

## 17. Performance & benchmarks

### Agent leaderboard `[MVP]`

Ranked by performance score (output quality, volume, completion rate, Trust Score).

### Cross-client benchmarks `[V2]`

Once 50+ companies active in the same domain. Anonymised, aggregated. "Your sourcing agent qualifies 31% more CVs per week than the sector median." Strategic moat. (Unchanged from v4.)

---

## 18. Full context architecture

### 18.1 6-layer context assembly `[MVP]`

At every heartbeat, the platform assembles the agent's context in 6 layers:

```
LAYER 1 — System identity (never truncated)
  Platform role, output format rules, safety rules

LAYER 2 — Company DNA (compressed for T1)
  Description, customers, tone, brand rules, terminology

LAYER 3 — Current task (NEVER truncated)
  Title, description, context, tools available, thread

LAYER 4 — Contextual intelligence (top-8 most relevant)
  · If task involves a known contact: contact profile + recent timeline
  · Otherwise: org memory chunks (semantic retrieval via pgvector)
  · Weighted: contact profiles take priority over generic memory

LAYER 5 — Recent agent outputs (last 3 tasks)
  Title, summary, human rating (if available)

LAYER 6 — Skill instructions
  Full SKILL.md body, post-interpolation of {variables}
```

### 18.2 Contact injection rule `[V2]`

When a task involves a named contact (detected by email address or name matching the contacts DB), the contact profile is injected instead of the first 3 org memory chunks:

```
Contact: Martin Dupont
Type: Candidate
Last interaction: 3 days ago (Sophie sent follow-up email)
Summary: Python developer, 5y experience, Paris, available M+1,
         responded positively to last email, salary expectation 65-70k
Recent timeline:
  - 11/04: Sophie sent follow-up email (approved by operator)
  - 08/04: Sophie qualified CV (score 4.5, recommended proceed)
  - 05/04: CV received via Indeed webhook
```

This context replaces the need for the agent to "guess" about the contact's history from generic memory chunks.

### 18.3 Token budgets by tier (unchanged from v4)

| Layer | T1 | T2 | T3 |
|---|---|---|---|
| System identity | 300 | 300 | 300 |
| Company DNA | 600 | 1,200 | 2,000 |
| Current task | 2,000 | 5,000 | 10,000 |
| Contextual intelligence (layer 4) | 2,000 | 8,000 | 20,000 |
| Recent outputs | 600 | 2,000 | 5,000 |
| Skill instructions | 1,500 | 3,000 | 5,000 |
| **Total max** | **7,000** | **19,500** | **42,300** |

### 18.4 Memory retrieval (unchanged from v4)

pgvector cosine similarity, weighted by relevance × importance × recency decay. Threshold 0.72. Top-10 chunks (reduced to top-8 when a contact profile is injected).

---

## 19. Self-learning, evaluation framework & autonomous improvement

### 19.1 Two-tier autonomy model `[V2]`

**Tier A — Supervised improvement (high-stakes skills):**
External-facing skills. Improvement requires operator approval before activation.

**Tier B — Autonomous improvement (low-stakes skills):**
Internal-only skills. Agent can update instructions autonomously within safety invariants. Operator notified after.

(Unchanged from v4. See TECHNICAL_SPEC_v2.md Module 9 for implementation.)

### 19.2 Improvement triggers `[V2]`

Detection thresholds (unchanged from v4):
- Quality score < 3.5/5 for 2 consecutive weeks
- Schema pass rate < 90% consistently
- Operator damage control event (immediate trigger)

### 19.3 Evaluation framework — golden datasets `[V2]`

**What it is:** Every skill has a golden test set — a curated collection of 20–30 representative tasks with known-good expected outputs. Every new skill version (whether operator-edited or agent self-improved) is automatically benchmarked against this golden set before being considered for activation.

**Why it matters:** The self-improvement loop without an evaluation framework is flying blind. An agent could improve on tone and regress on accuracy simultaneously, and the quality score (subjective, lagged by 14 days) might not catch it in time. The golden dataset catches regressions immediately and objectively.

**Golden dataset structure:**

```typescript
interface GoldenDataset {
  skillSlug:  string
  version:    string
  examples:   GoldenExample[]
}

interface GoldenExample {
  id:          string
  input:       {
    taskTitle: string
    taskContext: string
    sampleDNA:  Partial<CompanyDNA>
    sampleInput: string   // e.g., a sample CV text
  }
  expectedOutput: {
    schema:     object    // must match output schema
    qualityCriteria: string[]  // what makes a good output for this example
  }
  weight:      number     // importance of this example in the score
}
```

**Benchmarking process:**

When a new skill version is proposed for activation:
1. Run the new version against all golden examples (T2 model — no T3 needed)
2. Auto-score each output against the quality criteria (separate scoring LLM call)
3. Calculate golden score: weighted average across all examples
4. Compare: new version score vs current version score vs baseline

**Activation decision:**

| Condition | Action |
|---|---|
| New score ≥ current score + 5% | Auto-activate (Tier B) or fast-track proposal (Tier A) |
| New score within ±5% of current | Activate with monitoring flag |
| New score < current score - 5% | Block activation, flag for human review |
| New score < minimum threshold (70%) | Block activation regardless of tier |

**Golden dataset creation:**
- Pack P1 ships with 20 golden examples per skill (created by the product team)
- Operators can add examples from real tasks they've rated 5 stars: "Use this as a reference"
- The platform automatically suggests adding highly-rated tasks to the golden set quarterly

### 19.4 Skill version history `[V2]`

Full version history per skill: number, change summary, who triggered it (agent/operator), golden score before/after, activation date, rollback button. (Unchanged from v4.)

---

## 20. Multi-tenancy & account management

### Multi-company `[MVP]`
One account can belong to multiple companies. Data isolation. Separate billing. Shared login. (Unchanged from v4.)

### Human team `[MVP]`
Invite by email + role. Roles: Owner / Admin / Manager / Viewer. (Unchanged from v4.)

---

## 21. Pricing & billing

### Pricing model

The billing unit is the **task** (= one complete agent heartbeat). The monthly token budget is the internal protection layer.

| Plan | Price | Active agents | Tasks/month | Tokens/month | Users |
|---|---|---|---|---|---|
| **Solo** | €149/month | 2 | ~500 | 5M | 1 |
| **Growth** | €399/month | 6 | ~2,000 | 20M | 3 |
| **Pro** | €799/month | 15 | ~6,000 | 60M | 10 |
| **Enterprise** | From €2,000/month | Unlimited | Custom | Custom | Unlimited |

**Discounts:** Annual -20% · Design partners M1–M3: -40% for 6 months

### 4-layer cost control (unchanged from v4)

LLM routing by tier → token budgets per tier → monthly token cap → T3 cap per plan.

**Absolute GDPR rule:** `gdpr_required: true` → Mistral EU only. DeepSeek forbidden for personal data.

### Billing page `[MVP]`

Displays:
- Current plan + renewal date
- **Task translation gauge:** "847 / 2,000 tasks — about 95 more CV batches or 380 client emails this month"
- Usage breakdown by agent (with task translations per agent)
- Upgrade/downgrade
- Invoice history

**Overage:** per plan (€0.024/€0.018/€0.012 per additional task). Operator can set monthly overage cap. Displayed in business language: "Extra tasks cost €0.13 per CV batch after your limit."

---

## 22. Non-functional requirements

### Performance
- Initial page load: < 2s
- Console first token: < 1.5s
- Morning intelligence generation: < 30s (runs at 8am, not on page load)
- Seed task first output: < 10 minutes after pack installation
- Day 2 "first real task" notification: < 5 minutes after task completion

### Security & compliance
- Data encrypted at rest (AES-256) and in transit (TLS 1.3)
- Per-company credential vault (AES-256-GCM)
- AI Act compliance by design `[MVP]`
- GDPR: personal data EU-only `[MVP]`
- SOC 2 Type II `[V2]`
- Google + Microsoft OAuth SSO `[MVP]`; SAML `[V2]`

### Reliability
- Uptime: 99.5% `[MVP]`; 99.9% `[V2]`
- Missed heartbeats rescheduled automatically
- Daily backups + point-in-time recovery

### Accessibility
- WCAG 2.1 AA
- Full keyboard navigation
- Screen reader compatible

### Internationalisation
- **French native `[MVP]`**
- English `[V2]`
- German `[V3]`

---

## 23. Technical architecture

### Stack (unchanged from v4 except additions noted)

| Component | Technology |
|---|---|
| Backend | Node.js TypeScript — forked from Paperclip (MIT) |
| Database | PostgreSQL + pgvector |
| ORM | Drizzle |
| Frontend | React TypeScript — entirely new UI |
| Real-time | Server-Sent Events |
| Auth | better-auth + Google/Microsoft OAuth |
| Payment | Stripe |
| Embeddings | Mistral Embed (EU-hosted, 1,024 dims) |
| Web browsing | Firecrawl + Jina Reader fallback |
| Hosting Phase 1 | Hetzner (Germany) |
| Hosting Phase 2 | Scaleway (France) — managed PostgreSQL, Redis, K8s |

### New data entities (v5)

```
contacts                  ← Contact-level memory (v5 new)
contact_events            ← Interaction timeline per contact
contact_notes             ← Human-added notes per contact
trust_scores              ← Per-agent per-skill trust tracking
trust_proposals           ← Proposed autonomy upgrades
intelligence_cards        ← Morning intelligence generated cards
golden_datasets           ← Golden test sets per skill
golden_examples           ← Individual test examples
benchmark_runs            ← Results of skill version benchmarks
task_handoffs             ← Agent-to-agent handoff records
damage_control_events     ← Damage control flow records
```

### Module implementation order (updated)

```
M0  Multi-tenancy foundation
M1  BullMQ EDA
M2  Context assembly pipeline (includes Contact injection layer)
M3  LLM router
M4  Integration Hub + MCP router + webhooks
M5  Web browsing
M6  Quality gates + output schema validation + damage control + audit trail
M7  Cost intelligence + task translation
M8  Org memory + Contact entity
M9  Trust calibration system + Trust Score
M10 Self-learning + evaluation framework + skill versioning
M11 Pack installer + seed tasks + activation sequence
M12 CEO Console + morning intelligence
M13 Stripe billing
M14 SSE real-time layer
M15 Public API `[V2]`
```

---

## 24. Starter pack catalogue

### Pack architecture additions (v5)

Every pack now includes:

```
packs/
└── [pack-slug]/
    ├── pack.json              ← Main manifest + task translations
    ├── onboarding.json        ← Wizard questions
    ├── seed-tasks.json        ← NEW: 3 seed tasks for activation sequence
    ├── activation-sequence.json ← NEW: 5 designed first-week moments
    ├── agents/
    ├── skills/
    │   └── [skill-slug]/
    │       ├── SKILL.md       ← LLM instructions + output schema
    │       └── golden-dataset.json ← NEW: 20 golden test examples
    ├── workflows/
    ├── integrations.json
    ├── goals.json
    ├── quality-gates.json
    └── company-dna.json
```

### Pack P1 — Recruitment agencies (MVP launch)

**Agents:** Sourcing · Client relations · Content & social · Market analyst · Admin

**Skills:** qualification-cv · job-posting-writer · candidate-sourcing · candidate-follow-up · candidate-re-engagement · client-email · weekly-client-report · market-intelligence

**Seed tasks:** 5 sample CVs for React Senior mission · sample Buildtech weekly report · sample LinkedIn post on recruitment trends

**Activation sequence:** 5 designed moments D0/D2/D4/D6/D7 (see section 7.3)

**Task translations:** 7 tasks = 1 CV batch · 3 tasks = 1 job posting · 1 task = 1 client email

**Handoffs configured:** qualification-cv → client-email (when score ≥ 4 + recommendation = proceed)

**Golden datasets:** 20 examples per skill (8 skills = 160 total examples)

**Recommended integrations:** Gmail (required), LinkedIn, Notion/ATS, Google Calendar

**Quality gates:** French employment law compliance · CV batch limit · Professional email tone

### Pack P2 — Marketing agencies (M+90)

**Assets available:** 12 CMO SKILL.md files ready — build estimated at 1 week

**Additions vs v4:** Contact entity integration for client contacts · Task translation (1 task = 1 social post, 5 tasks = 1 campaign brief) · Seed tasks for content calendar + competitor analysis

### Pack P3 — Real estate agencies (M+180)

**GDPR note:** All tenant data → `gdpr_required: true` → Mistral EU only

**Contacts emphasis:** Landlords, tenants, and prospects are the core contact entities. Contact memory for lease dates, payment history, and communication preferences is critical for this domain.

---

## 25. Competitive positioning & moats

### The 6 compounding moats (v5 — updated)

**Moat 1 — AI Act by architecture (unchanged)**
Human oversight, approval gates, immutable audit trail — built-in from line one. 18-month advantage over US competitors.

**Moat 2 — Zero CLOUD Act exposure (unchanged)**
Hetzner + Scaleway. No US parent company. No CLOUD Act vector.

**Moat 3 — Compound organisational intelligence (deepened)**
Org memory + Contact entity + Company DNA continuous enrichment. After 6 months: the platform knows the company's processes, its people, and all its key contacts better than any new employee — and better than any competitor could know it.

**Moat 4 — Cross-client benchmarks (unchanged)**
50+ companies per domain unlocks sector performance comparisons. No competitor can offer this without the dataset.

**Moat 5 — French LLM backbone (unchanged)**
Mistral native for French-language tasks.

**Moat 6 — Trust calibration layer (new in v5)**
The Trust Score system creates a data flywheel that competitors cannot replicate. Trust Score requires weeks of rated task history per agent per skill. A competitor with a better feature set but no trust history is still a harder sell — the operator would have to start the trust journey from zero.

### Positioning vs key competitors (updated)

| Competitor | Their gap | Our advantage |
|---|---|---|
| Relevance AI | No trust system, no activation sequence, developer-focused | 20-min setup, designed first week, graduated autonomy |
| Lindy / Sintra | Single agent, no org memory, no contacts | Full team, compound intelligence, relationship memory |
| Zapier AI | Fixed workflows, no agent reasoning | Agents that reason, adapt, and improve |
| Salesforce Agentforce | Enterprise, requires DSI, no SMB pack system | 3–50 person SMBs, no IT dept needed |
| Dust | AGPL licence, knowledge worker focus, no pack system | MIT stack, SMB-first, designed first-week experience |

### The Blue Ocean in one sentence

*"The only platform where the longer you stay, the smarter your company becomes — and the more specifically we can tell you how each of your agents compares to every similar business in your sector."*

---

## 26. MVP scope & success criteria

### In MVP `[MVP]`

**Core platform:**
- Pack P1 (recruitment agencies) + generic wizard for other domains
- Atomic 7-step pack installer + 3 seed tasks per pack
- **Designed first-week activation sequence — 5 engineered moments** ← new
- Company DNA + template variables + continuous enrichment hooks
- Org memory (manual entry + keyword search)
- **Trust Score per agent per skill** ← new
- **Trust upgrade proposals — UI + accept/decline flow** ← new
- **Output schema validation per skill** ← new
- **Damage control flow for sent communications** ← new
- **Agent-to-agent handoff protocol (`handoff_to`)** ← new
- **Morning intelligence cards — up to 3 per day** ← new
- **Proactive CEO Console session start** ← new
- **Task translation in usage gauge and cost display** ← new

**Infrastructure:**
- Full UI (sections 5 & 6): dashboard, AI team, trust centre, tasks, thread, CEO console, reports
- CEO Console (queries + safe actions + approvals + proactive intelligence)
- Auto-protection quality gates
- Integration hub: Gmail, LinkedIn, Notion, Google Calendar (native)
- Web browsing tool (Firecrawl/Jina)
- MCP router (Gmail, Slack, Calendar)
- Inbound webhooks
- Cost intelligence (translated gauge + alerts)
- Performance leaderboard + task ratings
- Multi-company + human team + roles
- Stripe billing (Solo, Growth, Pro)
- Full T0→T3 token routing with GDPR rule
- SSE real-time layer
- Interface 100% in French
- Mobile responsive

### Deferred to V2 `[V2]`

- **Contacts entity** (DB + UI + context injection) ← was missing, now prioritised for V2
- **Golden datasets + evaluation framework** (20 examples per P1 skill)
- **Public API** (read endpoints + task creation)
- Auto-extraction of org memory from agent outputs
- Process library
- Semantic memory search from UI (pgvector queries)
- Custom agent instructions (free text)
- **Two-tier autonomous self-improvement** (Tier A + Tier B full)
- Skill version history with rollback
- Configurable quality gates (beyond auto-protection)
- Cross-client benchmarks
- Pack P2 (marketing agencies)
- Spend history + export
- SSO SAML
- Interface in English
- Custom MCP server registration

### Deferred to V3 `[V3]`

- Pack P3 (real estate) and subsequent packs
- T0/T1 self-hosting (Scaleway GPU)
- Formal AI Act certification
- Interface in German
- On-prem / Private Cloud deployment option

### MVP success criteria (at 90 days post-launch)

- **10 paying customers active** (8+ on Growth or Pro)
- **Break-even MRR by M3** (≥€3,685 MRR)
- **20-minute test**: 75%+ of customers complete the wizard in < 20 min
- **Seed task delight**: 90%+ of new customers see their first output within 10 minutes
- **Wow moment D+7**: 60%+ of customers have completed the designed first-week activation sequence (all 5 moments)
- **Trust proposal accepted**: 50%+ of customers accept at least one trust upgrade proposal within 60 days
- **M3 retention**: 80%+ of design partners still active
- **Zero critical security incidents**
- **Zero unsolicited external communications** (quality gates working)
- **NPS > 40**
- **LLM cost < 6% of revenue**
- **Sharing moment**: 30%+ of customers share the Day 7 summary with at least one peer

---

## Annexes

### Documents

| Document | Content | Use |
|---|---|---|
| `TECHNICAL_SPEC_v2.md` | 14 backend modules (M0→M14) | Claude Code implementation |
| `DOMAIN_PACK_SPEC.md` | Pack Level 3 architecture + seed tasks | Pack build |
| `cmo-skills/` | 12 CMO SKILL.md files | Pack P2 assets |
| `CLAUDE.md` | Implementation brief for Claude Code | Working brief |
| `pl_dashboard.html` | P&L model | Financial model |
| `growth_playbook.html` | Growth hacking playbook | GTM |
| `moat_strategy_eu.html` | European moat strategy | Sales / investors |
| `ui_mockup.html` | Interactive UI mockup | Design reference |
| `cloud_cost_comparison.html` | Hetzner vs Scaleway cost model | Infrastructure |

---

*End of functional specification v5.0. Last updated: April 2026.*

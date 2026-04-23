# Emotional Copy Layer
## Platform — French copy for all user-facing strings
**Version:** 1.0
**Companion to:** PLATFORM_FUNCTIONAL_SPEC_v5.md
**For:** Claude Code — implement these exact strings in the UI and notification system
**Language:** French (MVP) — English translations provided as comments

---

## Philosophy

Every string in this product answers one question:
**"What does this mean for Isabelle's Tuesday morning?"**

Not what happened. What it means for her life.

Two rules:
1. Name the agent. Name the specific thing. Never be generic.
2. Speak like a competent colleague, not a system log.

---

## 1. Onboarding & completion

### Wizard step headings

```
Step 1: "Dans quel secteur exercez-vous ?"
         // In which sector do you work?

Step 2: "Parlez-nous de votre cabinet."
         // Tell us about your firm.

Step 3: "Voici votre équipe IA."
         // Here is your AI team.

Step 4: "Connectez vos outils."
         // Connect your tools.

Step 5: "Quel est votre objectif principal ?"
         // What is your main goal?
```

### Completion screen headline

```
PRIMARY (agent working):
"Sophie est en train de lire votre boîte mail."
// Sophie is reading your inbox right now.

SUBLINE:
"Elle aura quelque chose pour vous dans quelques minutes."
// She'll have something for you in a few minutes.

NEVER:
"Votre équipe est prête. Premier check-in dans 5 minutes."
// ❌ Meaningless system state.
```

### Completion screen CTAs

```
PRIMARY CTA:   "Voir mon tableau de bord"
SECONDARY CTA: "Parler à mon équipe"
USAGE LINE:    "0 / 2 000 tâches ce mois — environ 285 sélections de CV ou 2 000 e-mails"
```

---

## 2. Activation sequence — exact copy

### Moment 1 — Day 0, seed task ready (within 10 min of install)

```
PUSH NOTIFICATION:
Title: "Sophie vient de finir sa première sélection."
Body:  "Elle a analysé 5 profils et en a retenu 2. Voir ce qu'elle a trouvé →"

IN-APP BANNER:
"Sophie a qualifié 5 CV pour votre mission React Senior.
Elle recommande 2 profils."
CTA: "Voir la sélection →"

TASK THREAD OPENING LINE (written by Sophie):
"Voici ce que j'ai trouvé dans votre première mission.
J'ai regardé les 5 profils et retenu ceux qui correspondent vraiment
à ce que vous cherchez. Mes recommandations :"

MICRO-REWARD after operator rates:
4-5★: "Merci. Sophie a enregistré vos critères — elle s'en souviendra
       pour toutes vos prochaines missions."
1-3★: "Merci. Sophie a pris note et ajustera ses prochaines évaluations."
```

### Moment 2 — Day 2, first real task (within 5 min of completion)

```
PUSH NOTIFICATION:
Title: "[Prénom du candidat réel] vient d'arriver dans votre boîte."
Body:  "Sophie vient de le lire. Elle lui donne 4,5/5. →"

// [Prénom] = actual first name from the email. If unknown, use email domain:
// "Un profil de chez [Entreprise] vient d'arriver dans votre boîte."

IN-APP BANNER:
"Sophie a analysé le CV de [Prénom] reçu ce matin.
Score : 4,5/5 — profil correspondant à votre mission [Mission]."
CTA: "Voir →"

MICRO-REWARD after rating:
4-5★: "Sophie est bien alignée avec vos critères. Elle continuera sur cette base."
1-3★: "Sophie a pris note. Elle ajustera ses prochaines évaluations."
No rating after 48h: no reminder (never badger)
```

### Moment 3 — Day 4, capability reveal

```
MORNING INTELLIGENCE CARD (8:05am):
Headline: "Sophie a remarqué quelque chose cette semaine."
Body:     "Trois des profils qualifiés viennent du même département chez [Entreprise].
           Cela pourrait indiquer une réorganisation en cours."
CTA:      "En savoir plus →"
Dismiss:  "Pas intéressant"

CONSOLE FOLLOW-UP (auto-populated when operator opens Console after card):
"Sophie a détecté un signal marché intéressant.
Voulez-vous qu'elle approfondisse ? Elle pourrait aussi sourcer directement
sur LinkedIn si vous lui donnez accès — elle ne publie et ne contacte jamais
sans votre accord."
```

### Moment 4 — Day 6, proactive insight (sent at 8:05am)

```
PUSH NOTIFICATION:
Title: "Trois de vos candidats attendent depuis 4 jours."
Body:  "Aucun d'eux n'a eu de nouvelles. Sophie peut les contacter aujourd'hui. →"

// Rule: state the problem first. Urgency second. Solution third.
// NEVER: "Sophie peut envoyer des e-mails. Voulez-vous ?"
// ALWAYS: "Trois candidats attendent." → then offer solution.

MORNING INTELLIGENCE CARD:
Headline: "Trois candidats qualifiés, aucun contact."
Body:     "[Prénom 1], [Prénom 2] et [Prénom 3] ont été qualifiés il y a 4 jours.
           Aucun e-mail n'est parti. Sophie a préparé trois messages."
CTA:      "Voir les drafts →"
Dismiss:  "Je m'en occupe moi-même"

TASK THREAD OPENING (Sophie's message):
"Trois de vos candidats qualifiés n'ont pas encore eu de nouvelles de votre cabinet.
J'ai préparé un message de prise de contact pour chacun d'eux.
Lisez et approuvez — ou modifiez si vous voulez changer le ton."

MICRO-REWARD after approving:
"Envoyés. Sophie notera leurs réponses et vous tiendra informé(e)."
```

### Moment 5 — Day 7, shareable card (sent at 8:00am)

```
PUSH NOTIFICATION:
Title: "Votre première semaine avec votre équipe IA."
Body:  "Sophie, Marc et Clara ont travaillé pendant 7 jours. Voici le bilan. →"

EMAIL SUBJECT:
"[Prénom], voici ce que votre équipe IA a accompli cette semaine"

SUMMARY SCREEN HEADLINE:
"Votre première semaine"

SUMMARY SCREEN SUBLINE:
"Voici ce que Sophie, Marc et Clara ont fait pendant que vous gériez votre cabinet."

SHAREABLE CARD — dynamic fields:
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│   Ma première semaine avec mon équipe IA                         │
│                                                                  │
│   [N] CV qualifiés   [N]h libérées/sem   €[X]/mois vs [Y]€ hum │
│                                                                  │
│   "[Citation éditable par l'opérateur]"                          │
│                             — [Prénom opérateur], [Nom cabinet]  │
│                                                                  │
│   singular.ceo                                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

DEFAULT QUOTE (editable in 2 taps):
"C'est comme avoir une chargée de recherche qui travaille la nuit."

SHARE SECTION COPY:
"Partager votre première semaine"
Buttons: [LinkedIn]  [WhatsApp]  [Copier le lien]

BELOW CARD (upsell, subtle):
"Votre équipe peut faire encore plus. Explorez ce qu'elle peut apprendre. →"
```

---

## 3. Dashboard — every recurring string

### Header greeting variants

```
MORNING (before 12h):
"Bonjour [Prénom] 👋  [Jour] [date]"

AFTERNOON (12h–18h):
"Bonjour [Prénom] 👋  [Jour] [date]"  // same — French doesn't distinguish

EVENING (after 18h):
"Bonsoir [Prénom] 👋  [Jour] [date]"
```

### Header summary line variants

```
WORK HAPPENED (>0 tasks since last login):
"Votre équipe a traité [N] tâches [depuis hier soir / ce week-end / depuis votre dernière visite]."

NO WORK (0 tasks since last login — agent paused or no triggers):
"Votre équipe attend de nouvelles missions."
// Never: "No tasks completed." — implies failure.

FIRST DAY:
"Sophie est en train de découvrir votre boîte mail. Elle sera prête dans quelques minutes."
```

### Usage gauge copy

```
STANDARD:
"[N] / 2 000 tâches ce mois — environ [X] sélections de CV ou [Y] e-mails restants"

AT 80%:
"[N] / 2 000 tâches — il vous reste environ [X] sélections de CV ce mois."

AT 95%:
"Presque au bout de vos tâches ce mois. [Augmenter le plan →]"

AT 100%:
"Vous avez atteint votre limite ce mois. Votre équipe reprend le [date renouvellement]."
CTA: "Augmenter le plan pour continuer maintenant →"
```

### Activity feed event copy

```
TASK COMPLETED:
"[Prénom] a [verbe passé + objet]"
Examples:
  "Sophie a qualifié 12 CV pour la mission React Senior"
  "Marc a envoyé le rapport hebdo à Innotec"
  "Clara a rédigé 3 posts LinkedIn pour cette semaine"

TASK PENDING APPROVAL:
"[Prénom] a [verbe passé + objet]" + tag "⏳ En attente"
Example: "Clara a rédigé 3 posts LinkedIn  ⏳ En attente"

TASK SENT:
tag "✓ Envoyé"

HANDOFF:
"[Prénom A] a passé le dossier [Mission/Candidat] à [Prénom B]"

LIVE (within-task):
"[Prénom] [verbe présent] [objet]..."
Examples:
  "Sophie lit le CV de Martin Dupont..."
  "Sophie identifie : 5 ans Python, Paris, disponible M+1"
  "Marc rédige le rapport pour Innotec..."
  "Clara consulte les dernières tendances recrutement IT..."
```

---

## 4. Agent cards & detail

### Status badges

```
WORKING:      "✅ Travaille"
PAUSED:       "⏸ En pause"
NEEDS YOU:    "⚠ A besoin de vous"   // awaiting approval
ERROR:        "❌ Erreur"
BUILDING:     "🔵 En formation"      // Trust Score building
```

### Agent card — current task line

```
Standard:
"En train de [verbe + objet]"
Examples:
  "En train de qualifier des CV pour la mission React Senior"
  "En train de rédiger le rapport Innotec"
  "En train de rechercher des profils CTO sur LinkedIn"

When paused:
"En pause — [raison si manuelle: 'suspendue manuellement']"

When needs approval:
"[N] [type de tâche] attendent votre validation"
Examples:
  "3 posts LinkedIn attendent votre validation"
  "1 offre d'emploi attend votre validation"
```

### Agent detail — trust track record

```
HIGH TRUST:
"Sophie est fiable sur la qualification de CV.
 4,8/5 en moyenne · 47 sélections · 6 semaines"
CTA: "Voir la proposition d'autonomie →"

BUILDING:
"Sophie construit son historique sur la qualification de CV.
 [N] sélections validées jusqu'ici."

SUPERVISED (standard):
"Vous validez chaque sélection de Sophie. C'est normal pour commencer."

AFTER DOWNGRADE:
"Sophie traverse une période de correction sur ce type de tâche.
 Je supervise de plus près le temps qu'elle se recalibre."
```

### Agent hire flow

```
HIRE CTA:   "+ Recruter un agent"
CONFIRM:    "Votre nouvel agent [Prénom] prendra son poste dans 5 minutes."
// Never: "Agent successfully created."
```

---

## 5. Task threads

### Opening lines (written by agents — by skill type)

```
CV QUALIFICATION:
"Voici ce que j'ai trouvé parmi les [N] CV reçus pour la mission [Mission].
J'ai retenu [M] profils qui correspondent vraiment à ce que vous cherchez :"

JOB POSTING:
"J'ai rédigé l'offre pour le poste de [Intitulé] selon vos critères.
J'ai veillé à respecter la législation française et le ton de votre cabinet.
À vous de valider avant diffusion :"

CLIENT EMAIL:
"Voici le message que je propose d'envoyer à [Prénom client] chez [Entreprise].
J'ai gardé le ton professionnel habituel de votre cabinet.
Lisez et approuvez, ou modifiez si vous voulez :"

LINKEDIN POST:
"J'ai rédigé [N] post[s] LinkedIn pour cette semaine selon votre calendrier éditorial.
Voici la [première] version — dites-moi si le ton vous convient :"

WEEKLY REPORT:
"Voici le rapport hebdomadaire pour [Client].
J'ai résumé l'avancement des missions et les prochaines étapes.
À valider avant envoi :"

MARKET INTELLIGENCE:
"Voici ce que j'ai observé sur le marché [Secteur] cette semaine.
[2-3 bullet insights en français, spécifiques et actionnables]"
```

### Approval buttons

```
APPROVE:         "✓ Approuver"
APPROVE + SEND:  "✓ Approuver et envoyer"
APPROVE + POST:  "✓ Approuver et publier"
MODIFY:          "✎ Demander des modifications"
REJECT:          "✗ Rejeter"

BULK APPROVE:    "✓ Approuver les [N] [type]"
```

### After approval — confirmation lines

```
EMAIL SENT:
"Envoyé à [Prénom destinataire]. Sophie notera la réponse quand elle arrivera."

POST PUBLISHED:
"Publié sur LinkedIn. Clara suivra les réactions."

QUALIFICATION APPROVED:
"Validé. Sophie continue sur cette base pour les prochaines missions."

REPORT SENT:
"Rapport envoyé à [Prénom client]. Marc planifie le prochain pour [date]."
```

---

## 6. Approval micro-rewards

Inline message, appears at the bottom of the task thread immediately after the operator clicks Approve. Small, warm, specific. Never more than one line.

```
1ST APPROVAL (of any task type, ever):
"C'est enregistré. [Prénom] s'en souviendra."

3RD CONSECUTIVE 4+★ (same task type):
"[Prénom] commence à vraiment connaître vos critères."

5TH CONSECUTIVE 4+★:
"5 validations consécutives 4 étoiles ou plus. [Prénom] travaille bien."

10TH CONSECUTIVE 4+★:
"Vous avez validé 10 sélections de [Prénom] — toutes très bien notées.
Elle est prête pour un peu plus de liberté sur ce type de tâche. [Voir la proposition →]"

AFTER CORRECTION (operator modified the output):
"[Prénom] a pris note. Elle ne refera pas cette erreur."

AFTER REJECTION:
"Compris. [Prénom] adaptera son approche la prochaine fois."

AFTER 1ST RATING (any star):
"Merci — vos notes aident [Prénom] à s'améliorer."

AFTER 5★ RATING:
"Parfait. [Prénom] garde ce niveau comme référence."
```

**Approval streak progress bar** (on agent card):

```
When between 5–9 consecutive 4+★:
[■■■■■■░░░░]  [N]/10 — presque prête pour plus d'autonomie

When at 10:
[■■■■■■■■■■]  Prête pour plus d'autonomie
→ triggers trust proposal notification
```

---

## 7. Morning intelligence cards — copy templates

Each card: headline (max 10 words) + body (1-2 sentences) + primary CTA + dismiss.

### Anomaly cards

```
PACE DROP:
Headline: "[Prénom] a traité [X]% moins de [tâche] cette semaine."
Body:     "Elle est passée de [N] à [M] par semaine. Aucune erreur détectée —
           cela peut indiquer un problème de pipeline ou une mission moins active."
CTA:      "Comprendre pourquoi →"
Dismiss:  "Je suis au courant"

NO PLACEMENT (recruitment specific):
Headline: "[Prénom] n'a pas eu de placement depuis [N] jours."
Body:     "C'est [X]% en dessous de votre rythme habituel.
           Voulez-vous que j'analyse les missions en cours ?"
CTA:      "Analyser →"
Dismiss:  "C'est normal en ce moment"

BUDGET APPROACHING:
Headline: "Vous approchez de votre limite mensuelle."
Body:     "Il vous reste environ [N] sélections de CV ou [M] e-mails ce mois.
           Au rythme actuel, vous les atteindrez le [date]."
CTA:      "Augmenter le plan →"
Dismiss:  "Je gère"
```

### Relationship gap cards

```
CLIENT NOT CONTACTED:
Headline: "[Client] n'a pas eu de nouvelles depuis [N] jours."
Body:     "Leur contrat se renouvelle dans [X] jours.
           Marc peut leur envoyer un point d'avancement aujourd'hui."
CTA:      "Demander à Marc →"
Dismiss:  "J'ai prévu un appel"

CANDIDATE WAITING:
Headline: "[N] candidats qualifiés n'ont pas eu de nouvelles."
Body:     "[Prénom 1], [Prénom 2] [et [Prénom 3]] attendent depuis [N] jours.
           Sophie a préparé des messages de contact."
CTA:      "Voir les drafts →"
Dismiss:  "Je m'en occupe"

CANDIDATE GOING COLD:
Headline: "[Prénom candidat] n'a pas répondu depuis [N] jours."
Body:     "Les candidats passifs décrochent souvent après 7 jours sans contact.
           Sophie peut envoyer une relance douce."
CTA:      "Voir le draft →"
Dismiss:  "Ce profil n'est plus prioritaire"
```

### Trust proposal cards

```
TRUST UPGRADE READY:
Headline: "[Prénom] est prête pour plus d'autonomie."
Body:     "[N] semaines de travail impeccable sur la [tâche].
           Proposer de réduire vos validations sur ce type de tâche ?"
CTA:      "Voir la proposition →"
Dismiss:  "Plus tard"
// NEVER dismiss option: "Non" — always "Plus tard" (keeps the door open)
```

### Goal risk cards

```
GOAL BEHIND:
Headline: "Vous êtes [N] semaines en retard sur votre objectif."
Body:     "Au rythme actuel, vous atteindrez [X] placements ce trimestre, pas [Y].
           Voulez-vous en parler à votre équipe ?"
CTA:      "Parler à mon équipe →"
Dismiss:  "J'ai ajusté mes attentes"
```

---

## 8. CEO Console — opening states

### Empty console (first open)

```
"Vous pouvez me demander n'importe quoi sur votre équipe et votre activité.

Par exemple :
 · 'Qu'est-ce que Sophie a fait cette semaine ?'
 · 'Demande à Marc de préparer un rapport pour Innotec'
 · 'Combien j'ai dépensé ce mois ?'
 · 'Montre-moi les candidats en attente'"
```

### Console with unaddressed morning intelligence

```
"Votre équipe travaille bien.
J'ai deux choses à vous signaler avant de commencer :

1. [Headline of card 1]
2. [Headline of card 2]

Voulez-vous qu'on commence par là, ou avez-vous autre chose en tête ?"
```

### Console — agent status responses

```
WHEN TEAM IS FINE:
"Tout se passe bien. Sophie a qualifié [N] CV aujourd'hui, Marc a envoyé [N] rapports,
et Clara prépare les posts de la semaine.
[N] actions attendent votre validation — voulez-vous les voir ?"

WHEN PROBLEM DETECTED:
"En général ça tourne bien, mais j'ai remarqué quelque chose :
[insight in 1 sentence].
Voulez-vous que je creuse ?"
```

### Console — task delegation confirmations

```
TASK CREATED:
"C'est noté. Sophie commence à travailler sur ça.
Elle vous donnera une première version [aujourd'hui / ce soir / demain matin]."

TASK APPROVED VIA CONSOLE:
"Validé. [Action immédiate] — Sophie notera la réaction quand elle arrivera."

APPROVAL DECLINED VIA CONSOLE:
"Compris. J'ai informé Sophie. Elle adaptera son approche."
```

---

## 9. Trust centre copy

### Trust centre page headline

```
"Votre équipe gagne votre confiance tâche par tâche."
```

### Trust levels — displayed as text

```
SUPERVISED:
"Vous validez chaque [type de tâche] de [Prénom]. C'est le point de départ."

SPOT-CHECKED:
"Vous vérifiez 1 [tâche] sur 5 de [Prénom], aléatoirement."

SUMMARISED:
"[Prénom] travaille de façon autonome. Vous recevez un résumé hebdomadaire."

AUTONOMOUS (internal only):
"[Prénom] travaille de façon autonome sur les tâches internes.
Vous êtes notifié(e) seulement en cas d'anomalie."
```

### Trust proposal — body copy

```
PROPOSAL HEADING:
"[Prénom] a mérité plus d'autonomie sur [type de tâche]."

EVIDENCE BLOCK:
"[N] [tâches] validées · Moyenne [X]/5 · [N] semaines consécutives"

WHAT CHANGES:
"Si vous acceptez : [Prénom] travaillera sans attendre votre validation
sur les [tâches] inférieures à [seuil].
Vous recevrez [un résumé quotidien / un résumé hebdomadaire]."

WHAT STAYS THE SAME:
"Vous pouvez toujours voir n'importe quelle [tâche] sur demande.
Les e-mails envoyés à l'extérieur restent soumis à votre validation.
Vous pouvez revenir au mode précédent en un clic."

CTA: "Accepter cette proposition"
ALT: "Ajuster le seuil"
DECLINE: "Garder le niveau actuel"
```

### Trust downgrade notification

```
"[Prénom] traverse une période difficile sur [type de tâche].
J'ai temporairement augmenté la supervision — vous serez notifié(e)
de chaque [tâche] jusqu'à ce qu'elle se recalibre.
[Voir ce qui s'est passé →]"
```

---

## 10. Damage control copy

### Error report modal

```
HEADLINE: "Que s'est-il passé avec cet envoi ?"

OPTIONS:
○ Ton ou contenu inapproprié
○ Envoyé à la mauvaise personne
○ Informations incorrectes
○ N'aurait pas dû être envoyé

CTA: "Continuer →"
```

### Recovery plan

```
HEADLINE: "Plan de reprise"

RECOVERY STEPS (checkboxes):
☑ Rédiger un message de correction à [Prénom destinataire]
   Aperçu : "[draft shown]"
☑ Signaler [Prénom destinataire] comme "À traiter avec soin"
☑ Analyser pourquoi cette erreur s'est produite
□ Suspendre l'envoi d'e-mails de [Prénom agent] 24h

CTA: "Mettre en place le plan"
ALT: "Personnaliser"
```

### Post-recovery follow-up (7 days later)

```
MORNING CARD:
Headline: "Comment s'est réglée la situation avec [Prénom destinataire] ?"
Body:     "Il y a 7 jours, [Prénom agent] avait envoyé un message incorrect.
           Tout est rentré dans l'ordre ?"
CTA: "Oui, c'est réglé"
Dismiss: "Toujours en cours"
```

---

## 11. Settings — company DNA fields

### Field labels and helper text

```
WHO WE ARE:
Label: "Qui sommes-nous ?"
Helper: "2-3 phrases décrivant votre cabinet — vos agents liront ceci
         avant chaque tâche. Plus c'est précis, meilleurs sont les résultats."
Placeholder: "Nous sommes un cabinet de recrutement IT spécialisé
              dans les profils tech mid-senior sur Paris et Lyon..."

OUR CUSTOMERS:
Label: "Nos clients"
Helper: "Qui sont vos clients types ? Vos agents communiqueront
         en tenant compte de ce profil."
Placeholder: "Startups et PME tech en croissance, DSI et DRH,
              généralement entre 30 et 300 salariés..."

HOW WE COMMUNICATE:
Label: "Notre style de communication"
Helper: "Ces règles s'appliquent à tout ce que vos agents écrivent.
         C'est la chose la plus importante à bien remplir."
Placeholder: "Professionnel mais chaleureux. Jamais de vouvoiement
              excessif. Phrases courtes. Pas de jargon..."
```

### Importance reminder (shown next to the 3 fields)

```
"Ces 3 champs définissent la voix de votre cabinet.
Chaque tâche de votre équipe s'y référe.
Une mise à jour améliore immédiatement tous vos agents."
```

---

## 12. Reports & ROI

### ROI highlight copy

```
"Votre équipe a créé [€X] de valeur ce mois
pour un coût de [€Y] — soit un ratio de [Z]×.

Valeur calculée sur la base du temps humain équivalent (€35/h chargé)
× durée moyenne par type de tâche."
```

### Hire simulator copy

```
"Si vous embauchiez quelqu'un pour faire ce que fait [Prénom] :

    [Poste équivalent] : [€X]/mois net + [€Y] de charges = [€Z]/mois total

    [Prénom] ce mois : [€W]

    Différence : [€(Z-W)]/mois — remboursé en [N] jours de placement."
```

### Monthly summary email subject lines

```
Week 4 (first month):
"[Prénom], votre équipe IA a [N] jours d'ancienneté — voici le bilan"

Month 3:
"[Prénom], 3 mois avec votre équipe IA. Ce qu'elle a accompli."

Month 6 (upsell trigger):
"[Prénom], votre équipe IA a économisé [N] heures depuis 6 mois."
```

---

## 13. Error states

### Specific error messages (replace all generic errors)

```
AGENT BUDGET EXHAUSTED:
"[Prénom] a atteint son enveloppe mensuelle.
Elle reprendra le [date] — ou augmentez son budget si c'est urgent.
[Modifier l'enveloppe →]"

INTEGRATION DISCONNECTED:
"[Prénom] n'a plus accès à Gmail — il faut reconnecter le compte.
[Reconnecter →]"

QUALITY GATE BLOCKED:
"[Prénom] a préparé [N] e-mails, mais ils n'ont pas pu partir.
La limite quotidienne est atteinte. Ils partiront demain matin.
[Voir les e-mails →]"

SCHEMA VALIDATION (shown in task thread):
"[Prénom] a relu et complété son évaluation pour s'assurer
qu'elle contient tous les éléments requis."
// Never: "Schema validation error. Field 'concerns' missing."

LLM ERROR (if task fails):
"[Prénom] a rencontré un problème et n'a pas pu terminer cette tâche.
Elle va réessayer dans quelques minutes.
[Voir le détail →]"
```

---

## 14. Empty states

```
NO TASKS YET (fresh install, before seed tasks):
Icon: agent illustration
Headline: "[Prénom] prend son poste."
Body:     "Elle sera opérationnelle dans quelques minutes."
// Never: "No tasks to display."

NO APPROVALS PENDING:
Icon: green checkmark
Headline: "Tout est à jour."
Body:     "Aucune action n'attend votre validation."
// Never: "0 pending approvals."

NO AGENTS YET (theoretical — pack installs agents):
Icon: empty chair
Headline: "Votre équipe vous attend."
Body:     "Choisissez un pack pour démarrer en 20 minutes."
CTA:      "Choisir un pack →"

NO CONTACTS YET (V2):
Icon: address book illustration
Headline: "Vos contacts apparaîtront ici."
Body:     "Dès que Sophie interagit avec un candidat ou un client,
           son profil sera créé automatiquement."
```

---

## 15. Copywriting do / don't reference

### By category

| Category | ✅ Do | ❌ Don't |
|---|---|---|
| Agent status | "Sophie travaille" | "Agent active" |
| Task names | "Qualifier les CV de la mission React" | "Execute skill: qualification-cv" |
| Errors | "Sophie n'a pas pu envoyer cet e-mail — limite atteinte" | "Error: volume gate triggered" |
| Budgets | "€28 utilisés sur €80 ce mois" | "5,847 tokens consumed" |
| Progress | "environ 95 sélections de CV restantes" | "153 tasks remaining" |
| Notifications | "Martin Dupont vient d'arriver dans votre boîte" | "New task created for agent" |
| Success | "Envoyé. Sophie notera la réponse." | "Task completed successfully" |
| Trust | "Sophie est prête pour plus d'autonomie" | "Trust score threshold reached" |
| Time | "dans quelques minutes" | "ETA: 300 seconds" |
| Quality | "Sophie connaît bien vos critères" | "Model performance improving" |

### The Tuesday morning test

Before publishing any string, ask: **"Does this tell Isabelle something that changes what she does this Tuesday morning?"**

If the answer is no — the string is probably technical output masquerading as a user message. Rewrite it.

---

*End of Emotional Copy Layer v1.0*
*Companion to PLATFORM_FUNCTIONAL_SPEC_v5.md*
*Last updated: April 2026*

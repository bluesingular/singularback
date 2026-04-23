# Spécification — Système de packs domaines métier (Niveau 3)
**Version:** 1.0  
**Objectif:** Architecture complète d'un système de packs "prêts à l'emploi" par domaine métier  
**Principe:** L'infrastructure est commune. Un pack = 1 manifest JSON + N fichiers SKILL.md + 1 wizard de configuration  
**Temps de déploiement client cible:** 20 minutes de la création de compte à l'activation du premier agent

---

## 1. Architecture d'un pack domaine

### Structure de fichiers

```
packs/
└── [domain-slug]/
    ├── pack.json              ← Manifest principal (obligatoire)
    ├── onboarding.json        ← Questions de configuration client (obligatoire)
    ├── agents/
    │   ├── [role-slug].json   ← Config de chaque agent du pack
    │   └── ...
    ├── skills/
    │   ├── [skill-slug]/
    │   │   └── SKILL.md       ← Un skill par fichier
    │   └── ...
    ├── workflows/
    │   └── [workflow-slug].json ← Tâches récurrentes préconfigurées
    ├── integrations.json      ← Intégrations recommandées pour ce domaine
    ├── goals.json             ← Objectifs types pour ce domaine
    ├── quality-gates.json     ← Quality gates préconfigurées
    └── company-dna.json       ← Template ADN entreprise spécifique au domaine
```

---

## 2. Le manifest pack (pack.json)

```json
{
  "pack_id": "agence-recrutement",
  "pack_version": "1.0.0",
  "name": "Cabinet de recrutement",
  "tagline": "Automatisez le sourcing, le suivi candidats et le reporting client",
  "category": "services-rh",
  "language": "fr",
  "target_company_size": "2-50",
  "estimated_setup_minutes": 20,

  "value_proposition": [
    "Vos candidats sourcés et présélectionnés en automatique",
    "Suivi client et reporting hebdomadaire sans effort",
    "Offres d'emploi rédigées et diffusées en 2 minutes"
  ],

  "agents_included": [
    "sourcing-agent",
    "client-comms-agent",
    "content-agent",
    "reporting-agent",
    "compliance-agent"
  ],

  "skills_included": [
    "sourcing-candidats",
    "redaction-offre-emploi",
    "suivi-candidat",
    "email-client",
    "reporting-hebdo",
    "veille-marche-emploi",
    "qualification-cv",
    "relance-candidat"
  ],

  "integrations_recommended": [
    { "slug": "gmail", "required": true, "reason": "Communication candidats et clients" },
    { "slug": "linkedin", "required": false, "reason": "Sourcing et diffusion d'offres" },
    { "slug": "notion", "required": false, "reason": "Base candidats et suivi missions" },
    { "slug": "google-calendar", "required": false, "reason": "Planification entretiens" }
  ],

  "default_goals": [
    "Augmenter le nombre de placements par consultant",
    "Réduire le délai de présentation candidats",
    "Améliorer la satisfaction client (NPS)"
  ],

  "heartbeat_defaults": {
    "frequency_hours": 4,
    "active_days": ["MON","TUE","WED","THU","FRI"],
    "active_hours_start": "08:00",
    "active_hours_end": "19:00"
  },

  "budget_defaults": {
    "per_agent_monthly_euros": 80,
    "total_monthly_euros": 399
  },

  "benchmarks": {
    "kpi_tracked": [
      "placements_per_consultant_per_month",
      "time_to_shortlist_days",
      "client_satisfaction_score",
      "offers_published_per_week"
    ]
  }
}
```

---

## 3. Le wizard d'onboarding (onboarding.json)

Chaque domaine a ses propres questions. Elles alimentent le Company DNA, paramètrent les agents, et adaptent les skills au contexte spécifique du client.

```json
{
  "steps": [
    {
      "step": 1,
      "title": "Votre cabinet",
      "fields": [
        {
          "id": "cabinet_name",
          "label": "Nom du cabinet",
          "type": "text",
          "required": true,
          "maps_to": "company_dna.name"
        },
        {
          "id": "specialisation",
          "label": "Spécialisation principale",
          "type": "select",
          "options": [
            "Généraliste",
            "IT & Digital",
            "Finance & Comptabilité",
            "Marketing & Communication",
            "Fonctions supports",
            "Cadres dirigeants (executive search)",
            "Santé & Médical",
            "Industrie & Ingénierie"
          ],
          "required": true,
          "maps_to": "company_dna.specialisation",
          "affects_skills": ["sourcing-candidats", "qualification-cv"]
        },
        {
          "id": "nb_consultants",
          "label": "Nombre de consultants dans l'équipe",
          "type": "select",
          "options": ["1 (solo)", "2-5", "6-15", "16-50"],
          "required": true,
          "maps_to": "config.team_size"
        },
        {
          "id": "zone_geo",
          "label": "Zone géographique principale",
          "type": "select",
          "options": ["Île-de-France", "Région (préciser)", "National", "International"],
          "required": true,
          "maps_to": "company_dna.geography"
        }
      ]
    },
    {
      "step": 2,
      "title": "Vos clients",
      "fields": [
        {
          "id": "client_type",
          "label": "Type de clients principaux",
          "type": "multi_select",
          "options": ["PME", "ETI", "Grands groupes", "Start-ups", "Secteur public"],
          "maps_to": "company_dna.target_clients"
        },
        {
          "id": "avg_salary_range",
          "label": "Fourchette de salaire des profils placés",
          "type": "select",
          "options": ["< 35k€", "35-55k€", "55-80k€", "80-120k€", "> 120k€"],
          "maps_to": "config.salary_range",
          "affects_skills": ["redaction-offre-emploi"]
        },
        {
          "id": "billing_model",
          "label": "Modèle de facturation",
          "type": "select",
          "options": ["Succès (% du salaire)", "Forfait mission", "Abonnement", "Mixte"],
          "maps_to": "company_dna.billing_model"
        }
      ]
    },
    {
      "step": 3,
      "title": "Vos outils actuels",
      "description": "Connectez vos outils pour que vos agents y aient accès.",
      "type": "integration_setup",
      "integrations_to_show": "from_pack_manifest",
      "minimum_required": ["gmail"]
    },
    {
      "step": 4,
      "title": "Votre premier objectif",
      "fields": [
        {
          "id": "primary_goal",
          "label": "Quel est votre défi principal en ce moment ?",
          "type": "select",
          "options": [
            "Trouver plus de candidats qualifiés",
            "Réduire le temps de traitement des missions",
            "Améliorer le suivi et la communication client",
            "Développer ma visibilité et attirer de nouveaux clients",
            "Réduire la charge administrative de mon équipe"
          ],
          "maps_to": "initial_goal.type"
        }
      ]
    },
    {
      "step": 5,
      "title": "Votre équipe IA est prête",
      "type": "confirmation",
      "shows": ["org_chart_preview", "agents_summary", "first_tasks_preview"]
    }
  ]
}
```

---

## 4. Configuration d'un agent (agents/sourcing-agent.json)

```json
{
  "agent_id": "sourcing-agent",
  "role_name": "Chargé(e) de sourcing",
  "description": "Recherche et présélectionne des candidats pour vos missions ouvertes",
  "icon": "search",
  "reports_to": "ceo",

  "capabilities": [
    "Recherche de candidats sur LinkedIn et job boards",
    "Qualification préliminaire des CVs reçus",
    "Rédaction et diffusion d'offres d'emploi",
    "Relance des candidats sans réponse",
    "Mise à jour du vivier candidats"
  ],

  "skills_assigned": [
    "sourcing-candidats",
    "qualification-cv",
    "redaction-offre-emploi",
    "relance-candidat"
  ],

  "tier_profile": {
    "default_tier": 2,
    "heavy_tasks": ["sourcing-candidats"],
    "light_tasks": ["relance-candidat", "qualification-cv"]
  },

  "integrations_needed": ["gmail", "linkedin", "notion"],

  "default_tasks_on_activation": [
    {
      "title": "Audit du vivier candidats existant",
      "description": "Recenser et catégoriser les candidats déjà dans votre base",
      "priority": "high",
      "due_days": 3
    },
    {
      "title": "Configurer les alertes de sourcing",
      "description": "Paramétrer les critères de recherche pour vos missions types",
      "priority": "medium",
      "due_days": 7
    }
  ],

  "quality_gate": {
    "on_cv_batch": {
      "max_per_heartbeat": 20,
      "requires_human_review_above": 10
    }
  }
}
```

---

## 5. Un skill domaine (skills/redaction-offre-emploi/SKILL.md)

```markdown
---
name: redaction-offre-emploi
description: >
  Utiliser quand on doit rédiger une offre d'emploi ou une fiche de poste.
  Déclencher sur : "rédige une offre pour", "fiche de poste", "annonce pour le poste de".
  Ne pas utiliser pour : répondre à un candidat, rédiger un email client, sourcing.
tier: 1
gdpr_required: false
---

# Rédaction d'offre d'emploi

## Contexte à récupérer avant de rédiger
Avant de commencer, vérifier dans la mémoire organisationnelle :
- Le style de rédaction du cabinet (formel / accessible / premium)
- Les éléments de marque employeur à inclure
- La spécialisation du cabinet (ex : IT, Finance) pour adapter le vocabulaire

Récupérer depuis la tâche ou demander si absent :
- Intitulé du poste
- Secteur d'activité du client
- Localisation (ville, télétravail ?)
- Fourchette de salaire (si communiquée)
- 3-5 missions principales
- 3-5 compétences requises
- Avantages à mettre en valeur

## Structure de l'offre

```
[INTITULÉ DU POSTE] — [VILLE] ([TÉLÉTRAVAIL si applicable])

**L'entreprise**
[2-3 phrases décrivant le client sans le nommer si confidentiel]

**Le poste**
[Contexte du recrutement en 1 phrase — pourquoi ce recrutement ?]

**Vos missions principales**
• [Mission 1]
• [Mission 2]
• [Mission 3]
• [Mission 4 si applicable]

**Votre profil**
• [Compétence / expérience clé 1]
• [Compétence / expérience clé 2]
• [Soft skill important]

**Ce que nous proposons**
• Rémunération : [fourchette ou "selon profil"]
• [Avantage 1]
• [Avantage 2]

**Pour postuler**
[Instruction de contact — email, lien, ou "envoyez votre CV à notre équipe"]
```

## Règles de rédaction
- Toujours respecter la loi française : pas de mention d'âge, de nationalité, de situation familiale
- Écriture inclusive : utiliser "[Poste] H/F/X" dans l'intitulé
- Longueur : 200-350 mots maximum (les offres longues sont moins lues)
- Ton : adapté à la spécialisation du cabinet (récupérer dans Company DNA)
- Éviter le jargon RH générique : "rejoindre une équipe dynamique", "entreprise en pleine croissance"

## Output attendu
Poster l'offre rédigée en commentaire sur la tâche.
Créer une sous-tâche "Diffuser l'offre" si une intégration LinkedIn ou Indeed est disponible.
```

---

## 6. Workflows préconfigurés (workflows/)

### workflow: suivi-mission-hebdomadaire.json

```json
{
  "workflow_id": "suivi-mission-hebdomadaire",
  "name": "Suivi hebdomadaire des missions",
  "description": "Chaque lundi, point automatique sur l'avancement de chaque mission ouverte",
  "trigger": {
    "type": "schedule",
    "cron": "0 8 * * MON",
    "label": "Chaque lundi à 8h"
  },
  "tasks_generated": [
    {
      "title": "Point mission : {mission_name}",
      "template": "Faire le point sur la mission {mission_name} pour le client {client_name} : nombre de candidats en cours, statut des entretiens, actions à prendre cette semaine.",
      "assigned_to": "sourcing-agent",
      "for_each": "open_missions",
      "priority": "high"
    },
    {
      "title": "Email de suivi client hebdomadaire",
      "template": "Envoyer un email de suivi à {client_name} avec : nombre de candidats présentés, retours en attente, prochaines étapes.",
      "assigned_to": "client-comms-agent",
      "depends_on": "point-mission",
      "priority": "high"
    }
  ]
}
```

### workflow: relance-candidats-silencieux.json

```json
{
  "workflow_id": "relance-candidats-silencieux",
  "name": "Relance candidats sans réponse",
  "trigger": {
    "type": "schedule",
    "cron": "0 10 * * WED",
    "label": "Chaque mercredi à 10h"
  },
  "tasks_generated": [
    {
      "title": "Relancer les candidats sans réponse depuis {days} jours",
      "template": "Identifier les candidats contactés il y a plus de {relance_delay_days} jours sans réponse. Envoyer un email de relance personnalisé pour chaque candidat encore pertinent pour une mission ouverte.",
      "assigned_to": "sourcing-agent",
      "config": {
        "relance_delay_days": 5
      }
    }
  ]
}
```

---

## 7. Quality gates par domaine (quality-gates.json)

```json
{
  "gates": [
    {
      "name": "Validation email client avant envoi",
      "applies_to_tasks": ["email-client", "suivi-client", "reporting"],
      "checks": [
        {
          "type": "tone",
          "description": "L'email est professionnel et adapté au client"
        },
        {
          "type": "keyword",
          "forbidden": ["problème", "difficultés", "malheureusement", "impossible"]
        }
      ],
      "on_fail": "require_approval"
    },
    {
      "name": "Vérification offre d'emploi",
      "applies_to_tasks": ["redaction-offre-emploi"],
      "checks": [
        {
          "type": "keyword",
          "forbidden": ["âge", "né(e) en", "nationalité", "état civil", "permis B obligatoire"],
          "description": "Conformité droit du travail français"
        },
        {
          "type": "volume",
          "field": "word_count",
          "min": 100,
          "max": 400
        }
      ],
      "on_fail": "block"
    },
    {
      "name": "Limite traitement CVs par batch",
      "applies_to_tasks": ["qualification-cv", "sourcing"],
      "checks": [
        {
          "type": "volume",
          "field": "item_count",
          "max": 20,
          "description": "Pas plus de 20 CVs traités par heartbeat"
        }
      ],
      "on_fail": "warn"
    }
  ]
}
```

---

## 8. Company DNA template par domaine (company-dna.json)

Pré-rempli avec des valeurs par défaut métier, que le wizard complète :

```json
{
  "template": {
    "description": "Cabinet de recrutement spécialisé en {specialisation}, accompagnant des {client_type} dans leurs recrutements sur {zone_geo}.",
    "communication_tone": "Professionnel et chaleureux — nous parlons à des candidats et des DRH.",
    "what_we_never_say": [
      "Ne jamais mentionner les noms de nos clients sans autorisation",
      "Ne jamais communiquer les fourchettes de salaire des autres candidats",
      "Ne jamais promettre un placement ou un délai précis"
    ],
    "regulatory_context": [
      "Respecter le RGPD pour toutes les données candidats",
      "Respecter la loi française sur la non-discrimination à l'embauche",
      "Conservation des CVs limitée à 2 ans sans contact"
    ],
    "brand_personality": [
      "Expert de notre secteur",
      "Réactif et disponible",
      "Honnête sur les opportunités et les délais"
    ]
  }
}
```

---

## 9. Catalogue de packs — 6 domaines prioritaires

### Ordre de build recommandé (impact × effort × proximité marché)

| Priorité | Domaine | Agents inclus | Nb skills | Effort build | Potentiel France |
|---|---|---|---|---|---|
| 1 | **Cabinets de recrutement** | 5 | 8 | 3 sem | 4 000 cabinets |
| 2 | **Agences marketing / comm** | 5 | 12 | 4 sem | 8 000 agences |
| 3 | **Agences immobilières** | 4 | 7 | 3 sem | 12 000 agences |
| 4 | **Experts-comptables** | 4 | 8 | 5 sem | 24 000 cabinets |
| 5 | **Cabinets de conseil RH** | 4 | 7 | 3 sem | 3 000 cabinets |
| 6 | **Artisans / BTP PME** | 3 | 6 | 4 sem | 400 000 PME |

---

## 10. Architecture technique du pack installer

### Ce qui se passe quand un client active un pack

```typescript
// server/src/packs/installer.ts

interface PackInstallOptions {
  companyId: string
  packId: string
  wizardAnswers: Record<string, unknown>
}

async function installPack(options: PackInstallOptions): Promise<void> {

  // 1. Charger le manifest du pack
  const pack = await loadPackManifest(options.packId)

  // 2. Générer le Company DNA depuis les réponses wizard + template domaine
  await createCompanyDNA({
    companyId: options.companyId,
    template: pack.companyDnaTemplate,
    answers: options.wizardAnswers
  })

  // 3. Créer les agents avec leurs configs
  for (const agentConfig of pack.agents) {
    const agentId = await createAgent({
      companyId: options.companyId,
      ...agentConfig,
      // Remplacer les variables template par les réponses wizard
      role_name: interpolate(agentConfig.role_name, options.wizardAnswers)
    })
    // Assigner les skills à cet agent
    await assignSkills(agentId, agentConfig.skills_assigned)
  }

  // 4. Créer les quality gates
  for (const gate of pack.qualityGates) {
    await createQualityGate({ companyId: options.companyId, ...gate })
  }

  // 5. Créer les workflows récurrents
  for (const workflow of pack.workflows) {
    await scheduleWorkflow({ companyId: options.companyId, ...workflow })
  }

  // 6. Créer l'objectif initial
  const goalType = options.wizardAnswers.primary_goal as string
  const goalTemplate = pack.defaultGoals.find(g => g.type === goalType)
  await createGoal({ companyId: options.companyId, ...goalTemplate })

  // 7. Créer les premières tâches de démarrage
  await createOnboardingTasks(options.companyId, pack)

  // 8. Déclencher le premier heartbeat dans 5 min
  await scheduleFirstHeartbeat(options.companyId, delay_minutes: 5)
}
```

### Variables de template dans les skills

Les skills utilisent des variables `{variable}` qui sont remplacées à l'installation par les réponses du wizard :

```markdown
# Sourcing de candidats

Vous êtes le chargé de sourcing de {company_name}, cabinet spécialisé en {specialisation} 
situé à {zone_geo}. Vos clients sont principalement des {client_type}.

Lorsque vous sourcez des candidats pour des postes à {avg_salary_range}, 
vous vous concentrez sur les profils...
```

---

## 11. Process de build d'un nouveau pack — 3 semaines

### Semaine 1 — Recherche et structure
- Jour 1-2 : Interview de 3-5 professionnels du domaine (1h chacun)
  - Quelles tâches prennent le plus de temps ?
  - Quels emails/documents rédigez-vous le plus souvent ?
  - Quels outils utilisez-vous au quotidien ?
  - Quels sont les risques / choses à ne jamais faire ?
- Jour 3 : Mapping des agents et de leurs responsabilités
- Jour 4-5 : Rédaction du manifest + onboarding.json

### Semaine 2 — Skills et workflows
- Jour 1-3 : Rédaction de tous les SKILL.md (8-12 skills)
  - Chaque skill testé sur 10 tâches réelles
  - Itération jusqu'à 80% de satisfaction sur les outputs
- Jour 4-5 : Configuration des workflows récurrents + quality gates

### Semaine 3 — Test et calibration
- Jour 1-2 : Installation du pack sur une instance de test
- Jour 3-4 : Simulation complète de l'onboarding client
  - Parcourir tout le wizard
  - Vérifier que tous les agents démarrent correctement
  - Tester les 5 tâches les plus fréquentes du domaine
- Jour 5 : Corrections + documentation du pack

### Livrable final par pack
- pack.json complet et validé
- onboarding.json avec toutes les questions
- N agents configurés
- N skills rédigés et testés
- 3-5 workflows préconfigurés
- Quality gates adaptées au domaine
- Company DNA template prérempli
- Playbook de vente ("pourquoi ce pack pour ce domaine")

---

## 12. Règle d'or : le test des 20 minutes

**Avant de publier un pack, le fondateur doit pouvoir :**

1. Créer un compte (2 min)
2. Parcourir le wizard (5 min)
3. Connecter Gmail (3 min)
4. Voir l'org chart généré avec ses agents (1 min)
5. Lire les 3 premières tâches créées automatiquement (2 min)
6. Poster un message à un agent et recevoir une réponse cohérente (5 min)
7. Voir un heartbeat tourner (2 min)

**Total : 20 minutes.** Si un pack ne passe pas ce test, il n'est pas prêt.

---

*Ce document est le brief de build pour chaque nouveau pack domaine. Il est à transmettre à Claude Code pour l'implémentation du pack installer, et à l'équipe contenu pour la rédaction des skills.*

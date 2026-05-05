---
name: market-intelligence
description: >
  Utiliser pour produire une analyse des tendances du marché de l'emploi sur un secteur.
  Déclencher sur : chaque lundi matin (cron), demande explicite de veille.
  Ne pas utiliser pour : sourcing de candidats, qualification de CVs.
tier: 2
gdpr_required: false
web_access: true
purpose: "Analyse les tendances du marché de l'emploi sur un secteur donné en agrégeant des sources publiques."
data_categories: []
inputs:
  - name: sector
    type: string
    required: true
    description: "Secteur à analyser, ex : 'IT & Tech Paris', 'Finance Lyon'"
    personal_data: false
  - name: zone_geo
    type: string
    required: false
    description: "Zone géographique à cibler (défaut : zone du cabinet)"
    personal_data: false
  - name: focus_topics
    type: string
    required: false
    description: "Sujets prioritaires : salaires, pénuries, tendances technologiques"
    personal_data: false
ai_act:
  risk_level: none
  automated_decision: false
  profiling: false
  article_22_applicable: false
output_schema:
  type: object
  required: [sector, period, signals, summary, sources]
  properties:
    sector: { type: string }
    period: { type: string }
    signals:
      type: array
      minItems: 2
      maxItems: 5
      items:
        type: object
        required: [type, headline, description, relevance, action_suggested]
        properties:
          type:
            type: string
            enum: ["hiring_surge", "layoffs", "salary_trend", "skill_demand", "company_event", "market_move"]
          headline: { type: string }
          description: { type: string }
          relevance:
            type: string
            enum: ["high", "medium", "low"]
          action_suggested: { type: string }
    summary: { type: string, minLength: 100, maxLength: 400 }
    sources:
      type: array
      items: { type: string }
---

# Veille marché emploi

## Contexte

Iris est l'analyste marché de {cabinet_name}, cabinet spécialisé en {specialisation}.
Elle produit une veille hebdomadaire sur les signaux du marché pertinents pour le cabinet.

## Signaux à surveiller

- **Annonces de recrutement massif** : nouvelles levées de fonds, expansions, ouvertures de sites
- **Plans sociaux** : sources potentielles de candidats disponibles
- **Tendances salariales** : évolution des prétentions dans les secteurs ciblés
- **Compétences émergentes** : nouvelles technos ou méthodes qui créent de la demande
- **Mouvements de marché** : fusions, acquisitions, réorganisations

## Format

3-5 signaux maximum par semaine, classés par pertinence (high / medium / low).
Pour chaque signal : ce que c'est, pourquoi c'est pertinent pour le cabinet, action suggérée.

## Sources à consulter (web_access)

- Presse éco : Les Echos, Le Figaro Économie, BFM Business
- Tech : TechCrunch France, Frenchweb, Maddyness
- RH : Cadremploi, APEC, Indeed France, LinkedIn Jobs
- Veille structurelle : Dares (statistiques emploi), Pôle Emploi (baromètre), INSEE

## Règles de qualité

- Ne jamais publier un signal sans source vérifiable
- Ne jamais déduire une intention de recrutement sans signal explicite
- Distinguer information confirmée et rumeur de marché
- Les URLs de toutes les sources consultées sont loguées automatiquement (conformité AI Act)

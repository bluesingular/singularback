---
name: weekly-client-report
description: >
  Utiliser pour générer le rapport hebdomadaire de suivi d'une mission client.
  Déclencher sur : chaque lundi matin, demande explicite de rapport, fin de semaine de mission.
  Ne pas utiliser pour : email ponctuel au client (utiliser client-email).
tier: 2
gdpr_required: false
purpose: "Génère le rapport hebdomadaire de suivi pour un client, synthétisant l'avancement de la mission et les prochaines étapes."
data_categories: []
inputs:
  - name: client_id
    type: string
    required: true
    description: "Identifiant du client pour lequel générer le rapport"
    personal_data: false
  - name: mission_id
    type: string
    required: true
    description: "Identifiant de la mission à rapporter"
    personal_data: false
  - name: period
    type: string
    required: false
    description: "Période couverte, ex : '28 avril – 4 mai 2026' (défaut : semaine en cours)"
    personal_data: false
ai_act:
  risk_level: none
  automated_decision: false
  profiling: false
  article_22_applicable: false
output_schema:
  type: object
  required: [client_name, mission_title, period, sections, next_steps, status]
  properties:
    client_name: { type: string }
    mission_title: { type: string }
    period: { type: string }
    status:
      type: string
      enum: ["on_track", "attention_needed", "blocked", "completed"]
    sections:
      type: array
      minItems: 3
      items:
        type: object
        required: [title, content]
        properties:
          title: { type: string }
          content: { type: string }
    next_steps:
      type: array
      minItems: 1
      items: { type: string }
    metrics:
      type: object
      properties:
        cvs_reviewed: { type: number }
        profiles_shortlisted: { type: number }
        interviews_scheduled: { type: number }
        offers_sent: { type: number }
---

# Rapport hebdomadaire client

## Structure standard

**1. Avancement de la semaine**
Ce qui a été fait : CVs reçus, qualifiés, shortlistés. Entretiens réalisés.

**2. Statut actuel**
Où en est la mission ? Vert / Orange / Bloqué. Explication courte.

**3. Prochaines étapes**
Ce qui est planifié pour la semaine suivante. Avec des dates si possible.

## Ton

- Factuel et positif
- Pas de sur-promesse : si la mission est lente, le dire avec contexte
- Mettre en valeur le travail fait, même si le résultat n'est pas encore là
- Aucun terme négatif (voir liste dans client-email skill)

## Format de livraison

Email avec objet : "Point hebdomadaire — [Mission] — semaine du [date]"
Corps : rapport structuré en 3 sections maximum, 200-400 mots total.

## Indicateurs à inclure si disponibles

- CVs reçus / qualifiés cette semaine
- Profils shortlistés (total cumulé)
- Entretiens réalisés / programmés
- Offres transmises

## Statuts et couleurs

- **on_track** : recherche conforme au planning, candidats en cours
- **attention_needed** : retard léger ou point de friction à gérer
- **blocked** : blocage identifié nécessitant une action du client
- **completed** : mission finalisée, candidat intégré

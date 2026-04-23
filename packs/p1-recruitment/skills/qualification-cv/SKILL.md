---
name: qualification-cv
description: >
  Utiliser quand il faut évaluer et scorer un CV reçu pour une mission ouverte.
  Déclencher sur : nouveau CV reçu, batch de CVs à qualifier, "évalue ce profil".
  Ne pas utiliser pour : rédiger une offre, contacter un candidat, faire une veille marché.
tier: 1
gdpr_required: true
output_schema:
  type: object
  required: [cv_id, candidate_name, score, recommendation, strengths, concerns, summary]
  properties:
    cv_id: { type: string }
    candidate_name: { type: string }
    score: { type: number, minimum: 1, maximum: 5 }
    recommendation:
      type: string
      enum: ["Recommandé — à présenter au client", "Possible — à garder en réserve", "Non retenu"]
    strengths:
      type: array
      items: { type: string }
      minItems: 1
      maxItems: 5
    concerns:
      type: array
      items: { type: string }
    summary: { type: string, minLength: 50, maxLength: 300 }
    salary_fit: { type: string }
---

# Qualification de CV

## Avant de qualifier

Récupérer dans la tâche ou dans la mémoire organisationnelle :
- L'intitulé exact de la mission et le nom du client
- Les exigences prioritaires (compétences, expérience, localisation)
- La fourchette de salaire et les conditions (CDI, hybride, etc.)
- Le profil des candidats déjà validés par ce client par le passé (si disponible)

## Grille de scoring (1-5)

**5/5 — Excellent match**
- Toutes les exigences prioritaires sont remplies
- Expérience dans un contexte similaire (même secteur ou même type d'entreprise)
- Disponibilité et prétentions salariales compatibles
- Quelque chose qui se démarque positivement

**4/5 — Bon profil, à présenter**
- La majorité des exigences prioritaires sont remplies
- Légère lacune compensée par d'autres points forts
- Disponibilité et salaire compatibles ou légèrement hors fourchette

**3/5 — Profil possible, à garder en réserve**
- Profil intéressant mais lacune significative sur 1-2 critères clés
- Ou très hors fourchette salariale sans autre point fort exceptionnel

**2/5 — Peu adapté**
- Plusieurs critères importants non remplis
- Ou expérience insuffisante pour le niveau demandé

**1/5 — Non pertinent**
- Domaine d'expertise différent, expérience insuffisante ou contraintes rédhibitoires

## Règles

- Évaluer le profil tel qu'il est, pas tel qu'il pourrait être avec de la formation
- Mentionner explicitement les concerns — ne jamais les occulter pour "vendre" un profil
- Score ≥ 4 : déclencher automatiquement un handoff vers Marc pour préparer la présentation client
- RGPD : ne jamais transmettre les données personnelles à un modèle non-EU

## Format de sortie

Répondre en JSON valide selon l'output_schema. Ensuite, en commentaire de tâche :
"J'ai qualifié [N] CV pour la mission [titre]. [X] recommandé(s), [Y] en réserve, [Z] non retenu(s)."

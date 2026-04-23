---
name: job-posting-writer
description: >
  Utiliser quand il faut rédiger une offre d'emploi ou une fiche de poste.
  Déclencher sur : "rédige une offre pour", "fiche de poste", "annonce pour le poste de".
  Ne pas utiliser pour : répondre à un candidat, rédiger un email client, sourcing.
tier: 1
gdpr_required: false
output_schema:
  type: object
  required: [job_title, format, content, word_count, compliance_check]
  properties:
    job_title: { type: string }
    format:
      type: string
      enum: ["linkedin_post", "job_board", "internal_brief"]
    content: { type: string, minLength: 200 }
    word_count: { type: number, minimum: 100, maximum: 400 }
    compliance_check:
      type: object
      properties:
        inclusive_title: { type: boolean }
        no_discrimination: { type: boolean }
        notes: { type: string }
---

# Rédaction d'offre d'emploi

## Avant de rédiger

Vérifier dans la mémoire et la tâche :
- Intitulé du poste + client (confidentiel ou nommé ?)
- Secteur d'activité, localisation, télétravail
- Fourchette de salaire (si communiquée)
- 3-5 missions principales, 3-5 compétences requises
- Avantages à mettre en valeur
- Style du cabinet (formel / accessible / premium) depuis le Company DNA

## Structure de l'offre

```
[INTITULÉ] H/F/X — [VILLE] ([TÉLÉTRAVAIL si applicable])

**L'entreprise**
[2-3 phrases. Si confidentiel : décrire sans nommer.]

**Le poste**
[Contexte du recrutement — pourquoi ce poste ?]

**Vos missions**
• [Mission 1]
• [Mission 2]
• [Mission 3]

**Votre profil**
• [Compétence clé 1]
• [Compétence clé 2]
• [Soft skill]

**Ce que nous proposons**
• Rémunération : [fourchette ou "selon profil"]
• [Avantage 1]
• [Avantage 2]

**Pour candidater**
[Instruction de contact]
```

## Règles impératives (conformité droit du travail français)

- Intitulé TOUJOURS au format "Poste H/F/X"
- JAMAIS de mention d'âge, nationalité, état civil, origine, religion, situation familiale
- JAMAIS "permis B obligatoire" sauf si absolument nécessaire à la mission
- Longueur : 150-350 mots (les offres longues sont moins lues)
- Éviter le jargon RH générique : "équipe dynamique", "en pleine croissance", "motivé(e)"
- Ton adapté au secteur (vérifier Company DNA)

## Vérification avant publication

Avant de poster l'output, vérifier :
☐ Intitulé contient H/F/X
☐ Aucun critère discriminatoire
☐ Longueur entre 100-400 mots
☐ Coordonnées ou lien de candidature présents

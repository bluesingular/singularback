---
name: client-email
description: >
  Utiliser pour rédiger un email à un client (DRH, manager, dirigeant).
  Déclencher sur : présentation de candidats, mise à jour de mission, réponse à une question client.
  Ne pas utiliser pour : rapport hebdomadaire (utiliser weekly-client-report).
tier: 1
gdpr_required: false
output_schema:
  type: object
  required: [recipient_name, recipient_email, subject, body, email_type]
  properties:
    recipient_name: { type: string }
    recipient_email: { type: string }
    subject: { type: string }
    body: { type: string, minLength: 80, maxLength: 800 }
    email_type:
      type: string
      enum: ["candidate_presentation", "mission_update", "interview_followup", "commercial", "general"]
    tone_check:
      type: object
      properties:
        is_professional: { type: boolean }
        no_negative_terms: { type: boolean }
---

# Email client

## Principes

- S'adresser au client par son prénom si la relation est établie, sinon "Madame/Monsieur [Nom]"
- Ne jamais mentionner de "problèmes" ou "difficultés" — reformuler en positif
- Être précis : nombre de candidats, noms (si accord), prochaines étapes avec dates
- Longueur : 100-250 mots. Les DRH n'ont pas le temps de lire de longs emails.
- Signer avec le prénom et le nom du consultant + titre + coordonnées directes

## Règle de tonalité

Gate automatique : si le corps de l'email contient l'un des mots suivants, l'email est soumis à approbation :
malheureusement, problème, difficile, retard, désolé, échec, raté, impossible.

Reformulations alternatives :
- "malheureusement" → supprimer ou reformuler avec les faits seuls
- "problème" → "point d'attention", "élément à clarifier"
- "retard" → "délai ajusté", "calendrier révisé"
- "désolé pour le délai" → "voici le point de situation, comme convenu"

## Structure selon le type d'email

**Présentation de candidats**
- Nombre de profils + synthèse en 1 phrase par candidat
- Proposition d'entretiens avec créneaux disponibles
- Pièces jointes : synthèses anonymisées (jamais les CVs bruts sans accord du candidat)

**Mise à jour de mission**
- Où en est la recherche (phase, volume traité)
- Prochaine étape et timing
- Un point d'attention si pertinent (formulé positivement)

**Suivi d'entretien**
- Retour factuel sur l'entretien (ce que le candidat a dit de la mission, son intérêt)
- Prochaine étape attendue du client
- Délai de retour souhaité

**Commercial**
- Valeur proposée avant le prix
- Références sectorielles si pertinentes
- Appel à l'action clair et non intrusif

## Gate: validation avant envoi

Tout email client passe par le gate "email-client-tone" avant envoi.
Si le gate détecte un terme négatif, l'email est soumis à approbation humaine.

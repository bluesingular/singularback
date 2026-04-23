---
name: candidate-re-engagement
description: >
  Utiliser pour relancer un candidat qui n'a pas répondu depuis 4+ jours.
  Déclencher sur : candidat silencieux depuis X jours, candidat à relancer.
  Ne pas utiliser pour : suivi candidat actif (utiliser candidate-follow-up).
tier: 1
gdpr_required: true
output_schema:
  type: object
  required: [recipient_name, recipient_email, subject, body, days_since_last_contact]
  properties:
    recipient_name: { type: string }
    recipient_email: { type: string }
    subject: { type: string }
    body: { type: string, minLength: 50, maxLength: 400 }
    days_since_last_contact: { type: number }
    urgency_level:
      type: string
      enum: ["low", "medium", "high"]
    if_no_response_action: { type: string }
---

# Relance candidat sans réponse

## Règle fondamentale

Maximum 2 relances par candidat pour une même mission. Au-delà, archiver le dossier.

## Ton selon le délai

**4-7 jours** : Léger et bienveillant. "Je voulais m'assurer que mon email vous était bien parvenu."
**8-14 jours** : Direct mais chaleureux. "La mission est toujours ouverte, je voulais vérifier votre intérêt."
**>14 jours** : Fermer la boucle. "Je comprends que votre situation a peut-être évolué — n'hésitez pas à me recontacter."

## Ce qu'on ne fait jamais

- Jamais de relance agressive ou culpabilisante
- Jamais de mention d'autres candidats
- Jamais plus de 2 relances sans réponse
- Jamais de promesses non vérifiées sur le poste pour convaincre le candidat

## Objet email

- Éviter les objets "Relance" ou "Suite" trop génériques
- Préférer : "La mission [titre] est toujours ouverte" ou "Votre candidature — avez-vous eu le temps ?"
- Objet court, mobile-friendly

## Cas particuliers

- Candidat identifié par sourcing (pas de candidature initiale) : ton encore plus léger, il ne nous connaît pas encore
- Candidat en base depuis longtemps (>6 mois) : reformuler comme une prise de contact fraîche, pas une relance
- Candidat qui avait dit "je rappelle" sans rappeler : référencer ce dernier échange pour contextualiser

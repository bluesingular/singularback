---
name: candidate-follow-up
description: >
  Utiliser pour rédiger un email de suivi à un candidat en cours de process.
  Déclencher sur : candidat en attente de retour, confirmation d'entretien, mise à jour de statut.
  Ne pas utiliser pour : premier contact (utiliser candidate-sourcing), relance sans réponse (utiliser candidate-re-engagement).
tier: 1
gdpr_required: true
purpose: "Rédige des emails de suivi personnalisés pour les candidats en cours de process de recrutement."
data_categories: [contact_info, recruitment_status]
inputs:
  - name: candidate_id
    type: string
    required: true
    description: "Identifiant du candidat dans le système"
    personal_data: true
  - name: follow_up_type
    type: string
    required: true
    description: "Type de suivi : interview_confirmation | status_update | positive_outcome | rejection | on_hold"
    personal_data: false
  - name: context
    type: string
    required: false
    description: "Contexte supplémentaire : date d'entretien, décision client, etc."
    personal_data: false
ai_act:
  risk_level: low
  automated_decision: false
  profiling: false
  article_22_applicable: false
output_schema:
  type: object
  required: [recipient_name, recipient_email, subject, body, follow_up_type]
  properties:
    recipient_name: { type: string }
    recipient_email: { type: string }
    subject: { type: string }
    body: { type: string, minLength: 50, maxLength: 600 }
    follow_up_type:
      type: string
      enum: ["interview_confirmation", "status_update", "positive_outcome", "rejection", "on_hold"]
    next_follow_up_days: { type: number }
---

# Suivi candidat

## Principes

- Personnaliser avec le prénom du candidat et le nom de la mission
- Être direct sur le statut — ne jamais laisser un candidat dans l'incertitude
- Ton : professionnel et humain. Un candidat en process mérite de la clarté.
- Longueur : 80-150 mots maximum. Les candidats lisent sur mobile.
- Signer avec le prénom du consultant responsable du dossier

## Types de suivi

**Confirmation d'entretien** : date, heure, lieu ou lien, contact sur place, format (présentiel/visio)
**Mise à jour positive** : retour positif, prochaine étape, timing estimé
**En attente** : expliquer pourquoi (délai décision client, agenda), donner un délai de retour
**Refus** : clair et respectueux, encourager pour d'autres opportunités, laisser la porte ouverte
**En réserve** : garder le contact pour des opportunités futures similaires

## Règles RGPD

- Ne jamais mentionner d'autres candidats nommément
- Ne pas communiquer les critères d'évaluation comparatifs
- Ne pas préciser les raisons détaillées d'un refus si elles concernent des données personnelles
- L'email ne doit contenir que les informations nécessaires au suivi du candidat concerné

## Ton selon le contexte

- Refus après long process (3+ entretiens) : plus de chaleur, reconnaître l'investissement
- Premier entretien annulé par le client : être transparent sur la raison (si communicable), reproposer rapidement
- Candidat qui attend depuis 2+ semaines : reconnaître le délai et s'en excuser brièvement

-- Seed P1 Recruitment pack master skills (Tier 1 — platform-owned).
--
-- All rows use company_id = '00000000-0000-0000-0000-000000000001' (platform sentinel).
-- source_company_id IS NULL → this is a master skill.
-- source_skill_id IS NULL   → not a copy, this IS the original.
--
-- Fixed UUIDs are used so the P1 manifest can reference them by sourceSkillId.
-- gdpr_required = true for skills that process candidate personal data (GDPR RULE 1).

INSERT INTO company_skills (
  id, company_id, key, slug, name, description, markdown,
  source_type, source_locator, source_ref,
  trust_level, compatibility,
  source_company_id, source_skill_id, master_version,
  gdpr_required, tier, ai_act_risk,
  metadata
) VALUES
(
  '11000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'candidate-follow-up', 'candidate-follow-up', 'Suivi candidat',
  'Rédige des emails de suivi personnalisés après entretien ou dépôt de candidature.',
  E'---\nname: candidate-follow-up\ntier: 1\ngdpr_required: true\nai_act_risk: limited\n---\n\n# Suivi candidat\n\nTu rédiges des emails de suivi chaleureux et professionnels après un entretien ou un dépôt de candidature.\n\n## Instructions\n- Personnalise chaque message avec le prénom du candidat et le poste visé\n- Ton : chaleureux, professionnel, encourageant\n- Longueur : 80-120 mots maximum\n- Termine toujours par une prochaine étape claire',
  'pack', 'p1-recruitment', '1.0.0',
  3, 'compatible',
  NULL, NULL, '1.0.0',
  true, 1, 'limited',
  '{}'
),
(
  '11000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'candidate-re-engagement', 'candidate-re-engagement', 'Réengagement candidat',
  'Relance les candidats passifs ou anciens candidats pertinents.',
  E'---\nname: candidate-re-engagement\ntier: 1\ngdpr_required: true\nai_act_risk: limited\n---\n\n# Réengagement candidat\n\nTu relances des candidats qui n''ont pas donné suite ou dont le profil correspond à une nouvelle opportunité.\n\n## Instructions\n- Référence la candidature ou l''échange précédent\n- Présente la nouvelle opportunité en 2-3 phrases\n- Ton : direct et respectueux du temps du candidat\n- Inclure un call-to-action clair (répondre, appeler, se connecter)',
  'pack', 'p1-recruitment', '1.0.0',
  3, 'compatible',
  NULL, NULL, '1.0.0',
  true, 1, 'limited',
  '{}'
),
(
  '11000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  'candidate-sourcing', 'candidate-sourcing', 'Sourcing candidat',
  'Rédige des messages de sourcing personnalisés pour approcher des candidats passifs.',
  E'---\nname: candidate-sourcing\ntier: 1\ngdpr_required: true\nai_act_risk: limited\n---\n\n# Sourcing candidat\n\nTu rédiges des messages d''approche personnalisés pour attirer des candidats passifs sur LinkedIn ou par email.\n\n## Instructions\n- Accroche personnalisée : mentionne un élément spécifique du profil\n- Présente l''opportunité sans dévoiler le client si confidentiel\n- Valeur perçue : pourquoi CE candidat pour CE poste\n- Longueur : 60-80 mots pour LinkedIn, 120-150 pour email\n- Ne jamais promettre un salaire sans confirmation client',
  'pack', 'p1-recruitment', '1.0.0',
  3, 'compatible',
  NULL, NULL, '1.0.0',
  true, 1, 'limited',
  '{}'
),
(
  '11000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000001',
  'client-email', 'client-email', 'Email client',
  'Rédige des emails professionnels à destination des clients recruteurs.',
  E'---\nname: client-email\ntier: 1\ngdpr_required: false\nai_act_risk: minimal\n---\n\n# Email client\n\nTu rédiges des emails professionnels à destination des clients recruteurs : propositions de candidats, comptes-rendus, mises à jour de mission.\n\n## Instructions\n- Ton : professionnel, orienté résultats, concis\n- Structure : contexte → information → prochaine étape\n- Longueur : 100-200 mots selon le sujet\n- Jamais de jargon RH excessif\n- Toujours proposer une action concrète',
  'pack', 'p1-recruitment', '1.0.0',
  3, 'compatible',
  NULL, NULL, '1.0.0',
  false, 1, 'minimal',
  '{}'
),
(
  '11000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000001',
  'job-posting-writer', 'job-posting-writer', 'Rédaction offre d''emploi',
  'Rédige des annonces d''emploi attractives et conformes aux obligations légales.',
  E'---\nname: job-posting-writer\ntier: 1\ngdpr_required: false\nai_act_risk: minimal\n---\n\n# Rédaction offre d''emploi\n\nTu rédiges des annonces d''emploi attractives, claires et conformes au droit du travail français.\n\n## Instructions\n- Structure : titre accrocheur → mission → profil → ce qu''on offre\n- Écriture inclusive obligatoire (H/F/X ou formulations neutres)\n- Interdire toute mention discriminatoire (âge, origine, etc.)\n- Mettre en valeur la culture de l''entreprise\n- Longueur : 300-500 mots\n- Appel à candidature clair en fin d''annonce',
  'pack', 'p1-recruitment', '1.0.0',
  3, 'compatible',
  NULL, NULL, '1.0.0',
  false, 1, 'minimal',
  '{}'
),
(
  '11000000-0000-0000-0000-000000000006',
  '00000000-0000-0000-0000-000000000001',
  'market-intelligence', 'market-intelligence', 'Veille marché',
  'Produit des synthèses de veille sur le marché de l''emploi et les tendances sectorielles.',
  E'---\nname: market-intelligence\ntier: 2\ngdpr_required: false\nai_act_risk: minimal\n---\n\n# Veille marché\n\nTu produis des synthèses de veille sur le marché de l''emploi, les tendances salariales et les mouvements sectoriels.\n\n## Instructions\n- Sources : presse spécialisée, rapports sectoriels, données publiques\n- Format : bullet points structurés + 1 insight actionnable\n- Périmètre : secteur ou métier précisé dans la tâche\n- Longueur : 200-400 mots\n- Toujours dater les informations si connues\n- Ne jamais inventer des statistiques',
  'pack', 'p1-recruitment', '1.0.0',
  3, 'compatible',
  NULL, NULL, '1.0.0',
  false, 2, 'minimal',
  '{}'
),
(
  '11000000-0000-0000-0000-000000000007',
  '00000000-0000-0000-0000-000000000001',
  'qualification-cv', 'qualification-cv', 'Qualification CV',
  'Analyse et qualifie des CVs par rapport à une fiche de poste.',
  E'---\nname: qualification-cv\ntier: 1\ngdpr_required: true\nai_act_risk: high\n---\n\n# Qualification CV\n\nTu analyses des CVs et évalues l''adéquation candidat/poste de manière objective et structurée.\n\n## Instructions\n- Évalue chaque critère de la fiche de poste : ✓ présent / ~ partiel / ✗ absent\n- Sois factuel : cite des éléments du CV pour chaque évaluation\n- Ne jamais inférer des caractéristiques personnelles non déclarées\n- Donne un score global /10 avec justification\n- Liste les 3 points forts et les 2 points de vigilance\n- Ton : neutre, professionnel, sans biais\n\n## Conformité AI Act\nCe système est classé à risque élevé (sélection du personnel). Toute décision finale reste humaine.',
  'pack', 'p1-recruitment', '1.0.0',
  3, 'compatible',
  NULL, NULL, '1.0.0',
  true, 1, 'high',
  '{}'
),
(
  '11000000-0000-0000-0000-000000000008',
  '00000000-0000-0000-0000-000000000001',
  'weekly-client-report', 'weekly-client-report', 'Rapport client hebdomadaire',
  'Génère des rapports hebdomadaires d''avancement de mission pour les clients.',
  E'---\nname: weekly-client-report\ntier: 1\ngdpr_required: false\nai_act_risk: minimal\n---\n\n# Rapport client hebdomadaire\n\nTu génères des rapports d''avancement hebdomadaires synthétisant l''activité de sourcing et de recrutement.\n\n## Instructions\n- Structure : résumé exécutif → actions réalisées → pipeline candidats → prochaines étapes\n- Chiffres clés : CVs reçus, qualifiés, présentés, entretiens planifiés\n- Ton : professionnel, factuel, orienté résultats\n- Longueur : 300-500 mots\n- Toujours respecter la confidentialité des candidats (prénom + initiale du nom uniquement)',
  'pack', 'p1-recruitment', '1.0.0',
  3, 'compatible',
  NULL, NULL, '1.0.0',
  false, 1, 'minimal',
  '{}'
)
ON CONFLICT (id) DO NOTHING;

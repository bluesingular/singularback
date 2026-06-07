/**
 * server/src/skills/quality-eval.ts
 *
 * SKILL.md quality evaluator — adapted from bluesingular/asm evaluator.ts.
 *
 * Scores a skill against 7 dimensions (0–10 each) and produces an overall
 * 0–100 score with letter grade and per-dimension suggestions.
 *
 * Pure function — no DB, no I/O. Safe to call in the hot path.
 *
 * Used by:
 *   - POST /admin/skills/eval  (real-time score in AdminSkillEditor)
 *   - pack installer (informational warning only, never blocks)
 *   - regression suite (track quality over versions)
 */

import matter from "gray-matter";

// ── Types ─────────────────────────────────────────────────────────────────────

export type LetterGrade = "A" | "B" | "C" | "D" | "F"

export interface DimensionResult {
  name:        string
  score:       number     // 0–10
  maxScore:    number     // always 10
  suggestions: string[]   // actionable improvement notes (empty = nothing to fix)
}

export interface SkillQualityReport {
  slug:        string
  overallScore: number     // 0–100
  grade:        LetterGrade
  dimensions:   DimensionResult[]
  /** Top 3 highest-priority suggestions (across all dimensions) */
  topSuggestions: string[]
}

// ── Action verbs (presence signals well-scoped skill descriptions) ────────────

const ACTION_VERBS = new Set([
  "analyse", "analyze", "audit", "build", "check", "classify", "compare",
  "compose", "configure", "create", "detect", "draft", "evaluate", "extract",
  "filter", "generate", "identify", "monitor", "parse", "process", "qualify",
  "rank", "review", "scan", "score", "search", "summarise", "summarize",
  "transform", "validate", "verify", "write",
])

// ── Safety keywords (presence signals guardrails are in place) ────────────────

const SAFETY_KEYWORDS = [
  "confirm", "prerequisite", "error", "fallback", "escalat",
  "irréversible", "irreversible", "vérifi", "verif", "valider",
  "annuler", "cancel", "limite", "limit",
]

// ── Dimension scorers ─────────────────────────────────────────────────────────

function scoreStructure(fm: Record<string, unknown>, body: string): DimensionResult {
  const suggestions: string[] = []
  let score = 0

  if (fm.name && typeof fm.name === "string") {
    score += 2
  } else {
    suggestions.push("Frontmatter manquant: 'name' est obligatoire")
  }

  if (fm.description && typeof fm.description === "string") {
    score += 2
  } else {
    suggestions.push("Frontmatter manquant: 'description' améliore la découverte")
  }

  // Recommended fields
  if (fm.gdpr_required !== undefined) score += 1
  else suggestions.push("Déclarer 'gdpr_required' explicitement (true/false)")

  if (fm.tier !== undefined) score += 1
  else suggestions.push("Déclarer 'tier' (0–3) pour le routage modèle")

  if (fm.ai_act !== undefined) score += 1
  else suggestions.push("Déclarer 'ai_act.risk_level' pour la conformité AI Act")

  if (fm.output_schema !== undefined) score += 1
  else suggestions.push("Déclarer 'output_schema' pour la validation de sortie (Rule 3)")

  if (body.trim().length >= 20) {
    score += 2
  } else {
    suggestions.push("Le corps du skill est trop court — minimum 20 caractères")
  }

  return { name: "Structure & complétude", score: Math.min(score, 10), maxScore: 10, suggestions }
}

function scoreDescription(fm: Record<string, unknown>): DimensionResult {
  const suggestions: string[] = []
  let score = 0

  const desc = typeof fm.description === "string" ? fm.description : ""

  if (!desc) {
    return {
      name: "Qualité de la description",
      score: 0,
      maxScore: 10,
      suggestions: ["Ajouter une description dans le frontmatter"],
    }
  }

  const words = desc.trim().split(/\s+/)
  const wordCount = words.length

  // Optimal: 8–40 words
  if (wordCount >= 8 && wordCount <= 40) {
    score += 4
  } else if (wordCount >= 4) {
    score += 2
    if (wordCount < 8) suggestions.push("Description trop courte — viser 8–40 mots")
    if (wordCount > 40) suggestions.push("Description trop longue — résumer en 40 mots max")
  } else {
    suggestions.push("Description trop courte — viser 8–40 mots avec un verbe d'action")
  }

  // Action verb in first 4 words
  const firstFour = words.slice(0, 4).map(w => w.toLowerCase().replace(/[^a-zàâéèêôùûç]/g, ""))
  if (firstFour.some(w => ACTION_VERBS.has(w))) {
    score += 3
  } else {
    suggestions.push("Commencer la description par un verbe d'action (ex: 'Évalue', 'Analyse', 'Génère')")
  }

  // Trigger/use-case specificity — look for "quand", "when", "lorsque", or context nouns
  if (/\b(quand|when|lorsque|pour|for|afin de|in order to)\b/i.test(desc)) {
    score += 3
  } else {
    suggestions.push("Préciser le déclencheur ou le cas d'usage dans la description")
  }

  return { name: "Qualité de la description", score: Math.min(score, 10), maxScore: 10, suggestions }
}

function scorePromptEngineering(body: string): DimensionResult {
  const suggestions: string[] = []
  let score = 0

  const wordCount = body.trim().split(/\s+/).length
  const lines = body.split("\n")

  // Body length: 80–3000 words is optimal
  if (wordCount >= 80 && wordCount <= 3000) {
    score += 3
  } else if (wordCount >= 20) {
    score += 1
    if (wordCount < 80)   suggestions.push("Corps trop court — viser 80–3000 mots pour un prompt efficace")
    if (wordCount > 3000) suggestions.push("Corps très long — risque de compression de contexte (Rule 5)")
  } else {
    suggestions.push("Corps insuffisant — au minimum 80 mots pour des instructions exploitables")
  }

  // Numbered/bulleted lists (structured instructions)
  const hasLists = lines.some(l => /^\s*[-*•]|\s*\d+\./.test(l))
  if (hasLists) {
    score += 2
  } else {
    suggestions.push("Structurer les instructions en liste numérotée ou à puces")
  }

  // Code examples or schema examples
  if (/```/.test(body)) {
    score += 2
  } else {
    suggestions.push("Ajouter des exemples de sortie ou de schéma (bloc ``` ...)")
  }

  // Imperative voice — verbs at line start
  const imperativeLines = lines.filter(l => /^\s*\d+\.\s+[A-ZÀÂÉÈÊÔÙÛÇ]/u.test(l) || /^\s*[-*]\s+[A-ZÀÂÉÈÊÔÙÛÇ]/u.test(l))
  if (imperativeLines.length >= 3) {
    score += 2
  } else {
    suggestions.push("Utiliser la voix impérative en début de ligne ('Extraire', 'Vérifier'...)")
  }

  // Progressive disclosure — at least 2 headings (## sections)
  const headingCount = lines.filter(l => /^#{2,}/.test(l)).length
  if (headingCount >= 2) {
    score += 1
  } else {
    suggestions.push("Diviser en sections (## Objectif / ## Instructions / ## Garde-fous)")
  }

  return { name: "Ingénierie de prompt", score: Math.min(score, 10), maxScore: 10, suggestions }
}

function scoreContextEfficiency(body: string): DimensionResult {
  const suggestions: string[] = []
  let score = 0

  const wordCount = body.trim().split(/\s+/).length

  // Optimal range: 120–1500 words
  if (wordCount >= 120 && wordCount <= 1500) {
    score += 4
  } else if (wordCount >= 60) {
    score += 2
    if (wordCount > 1500) suggestions.push("Skill très long — réduire sous 1500 mots pour limiter la consommation de tokens")
  } else {
    suggestions.push("Corps trop court pour un skill efficace")
  }

  // No excessive code blocks (each block > 30 lines is a penalty)
  const codeBlocks = body.match(/```[\s\S]*?```/g) ?? []
  const largeBlocks = codeBlocks.filter(b => b.split("\n").length > 30)
  if (largeBlocks.length === 0) {
    score += 3
  } else {
    score += 1
    suggestions.push(`${largeBlocks.length} bloc(s) de code trop grand(s) — extraire en référence externe`)
  }

  // External references instead of inline data (good sign)
  if (/\[\w+\]\(https?:/.test(body)) {
    score += 2
  }

  // Token budget mention (shows cost-awareness)
  if (/token|budget|limite|limit/i.test(body)) {
    score += 1
  } else {
    suggestions.push("Mentionner les limites de tokens ou de contexte si applicable")
  }

  return { name: "Efficacité du contexte", score: Math.min(score, 10), maxScore: 10, suggestions }
}

function scoreSafetyGuardrails(body: string, fm: Record<string, unknown>): DimensionResult {
  const suggestions: string[] = []
  let score = 0

  // Safety keywords in body
  const matchedKeywords = SAFETY_KEYWORDS.filter(kw => new RegExp(kw, "i").test(body))
  if (matchedKeywords.length >= 3) {
    score += 4
  } else if (matchedKeywords.length >= 1) {
    score += 2
    suggestions.push("Ajouter des garde-fous explicites: confirmation, escalade, gestion d'erreur")
  } else {
    suggestions.push("Aucun garde-fou détecté — documenter les cas d'erreur et les limites du skill")
  }

  // Destructive action warnings (detect if skill touches sensitive ops, then check for guard)
  const hasDestructiveRef = /\b(delete|supprimer|envoyer|send|post|publier|publish)\b/i.test(body)
  if (hasDestructiveRef) {
    if (/confirm|valider|approv/i.test(body)) {
      score += 3
    } else {
      score += 1
      suggestions.push("Le skill réalise des actions irréversibles — ajouter une étape de confirmation explicite")
    }
  } else {
    score += 3
  }

  // zero_tolerance_actions declared in frontmatter
  if (fm.zero_tolerance_actions && Array.isArray(fm.zero_tolerance_actions) && fm.zero_tolerance_actions.length > 0) {
    score += 2
  } else if (hasDestructiveRef) {
    suggestions.push("Déclarer 'zero_tolerance_actions' dans le frontmatter pour les actions critiques (Gap E)")
  }

  // Prerequisites documented
  if (/prérequis|prerequisite|requis|requires/i.test(body)) {
    score += 1
  } else {
    suggestions.push("Documenter les prérequis (intégrations, données, permissions nécessaires)")
  }

  return { name: "Sécurité & garde-fous", score: Math.min(score, 10), maxScore: 10, suggestions }
}

function scoreTestability(body: string, fm: Record<string, unknown>): DimensionResult {
  const suggestions: string[] = []
  let score = 0

  // Output schema declared
  if (fm.output_schema && typeof fm.output_schema === "object") {
    score += 4
  } else {
    suggestions.push("Déclarer 'output_schema' — requis pour la validation automatique (Rule 3)")
  }

  // Acceptance criteria or expected output described in body
  if (/critère|criteria|attendu|expected|exemple de sortie|example output/i.test(body)) {
    score += 3
  } else {
    suggestions.push("Décrire les critères d'acceptation ou un exemple de sortie attendu")
  }

  // Edge cases documented
  if (/cas limite|edge case|si.*absent|si.*vide|si.*manqu/i.test(body)) {
    score += 2
  } else {
    suggestions.push("Documenter les cas limites (données manquantes, format inattendu)")
  }

  // Quality gate thresholds
  if (/seuil|threshold|score minimum|note minimale/i.test(body)) {
    score += 1
  }

  return { name: "Testabilité", score: Math.min(score, 10), maxScore: 10, suggestions }
}

function scoreNamingConventions(fm: Record<string, unknown>): DimensionResult {
  const suggestions: string[] = []
  let score = 0

  const name = typeof fm.name === "string" ? fm.name : ""

  if (!name) {
    return {
      name: "Nommage & conventions",
      score: 0,
      maxScore: 10,
      suggestions: ["Nom de skill manquant dans le frontmatter"],
    }
  }

  // kebab-case
  if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
    score += 4
  } else {
    suggestions.push("Utiliser le kebab-case pour le nom du skill (ex: 'cv-qualification', 'lead-scoring')")
  }

  // Not too short (< 3 chars) or too long (> 40 chars)
  if (name.length >= 3 && name.length <= 40) {
    score += 2
  } else {
    suggestions.push("Nom trop court ou trop long — viser 3–40 caractères descriptifs")
  }

  // Description does not repeat the name verbatim
  const desc = typeof fm.description === "string" ? fm.description : ""
  if (desc && desc.toLowerCase() !== name.toLowerCase()) {
    score += 2
  }

  // Tier declared (naming/metadata completeness)
  if (fm.tier !== undefined) {
    score += 2
  } else {
    suggestions.push("Déclarer 'tier' dans le frontmatter pour compléter les métadonnées")
  }

  return { name: "Nommage & conventions", score: Math.min(score, 10), maxScore: 10, suggestions }
}

// ── Grade mapping ─────────────────────────────────────────────────────────────

function toGrade(score: number): LetterGrade {
  if (score >= 90) return "A"
  if (score >= 80) return "B"
  if (score >= 65) return "C"
  if (score >= 50) return "D"
  return "F"
}

// ── Main evaluator ────────────────────────────────────────────────────────────

/**
 * Evaluate a raw SKILL.md string and return a structured quality report.
 *
 * @param skillMarkdown  Full SKILL.md content (frontmatter + body)
 * @param slug           Optional slug used as report identifier (defaults to fm.name)
 */
export function evaluateSkillQuality(
  skillMarkdown: string,
  slug?: string,
): SkillQualityReport {
  const { data: fm, content: body } = matter(skillMarkdown)

  const dimensions: DimensionResult[] = [
    scoreStructure(fm, body),
    scoreDescription(fm),
    scorePromptEngineering(body),
    scoreContextEfficiency(body),
    scoreSafetyGuardrails(body, fm),
    scoreTestability(body, fm),
    scoreNamingConventions(fm),
  ]

  const totalRaw    = dimensions.reduce((sum, d) => sum + d.score, 0)
  const totalMax    = dimensions.reduce((sum, d) => sum + d.maxScore, 0)
  const overallScore = Math.round((totalRaw / totalMax) * 100)
  const grade        = toGrade(overallScore)

  // Top 3 suggestions — pick from lowest-scoring dimensions first
  const sorted = [...dimensions].sort((a, b) => a.score - b.score)
  const topSuggestions: string[] = []
  for (const dim of sorted) {
    for (const s of dim.suggestions) {
      if (topSuggestions.length >= 3) break
      topSuggestions.push(s)
    }
    if (topSuggestions.length >= 3) break
  }

  return {
    slug:       slug ?? String(fm.name ?? "unknown"),
    overallScore,
    grade,
    dimensions,
    topSuggestions,
  }
}

/**
 * server/src/skills/parser.ts
 *
 * Parses SKILL.md files into structured ParsedSkill objects.
 * Every skill file must begin with a YAML frontmatter block.
 *
 * Example frontmatter:
 * ---
 * name: qualification-cv
 * tier: 1
 * gdpr_required: true
 * web_access: false
 * autonomy_tier: A
 * purpose: "Évalue et score les CVs entrants pour une mission ouverte"
 * data_categories: [cv_data, contact_info]
 * inputs:
 *   - name: cv_document
 *     type: file
 *     required: true
 *     description: "CV du candidat"
 *     personal_data: true
 * ai_act:
 *   risk_level: limited
 *   automated_decision: false
 *   profiling: true
 *   article_22_applicable: false
 * tools:
 *   - mcp: gmail
 *     permissions: [read, compose]
 * description: Qualifies incoming CVs against job posting criteria
 * ---
 *
 * Body: Markdown below the frontmatter, may contain {variable} placeholders
 * interpolated by the context assembler.
 */

import matter from "gray-matter";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ToolDeclaration {
  mcp: string; // integration name: 'gmail' | 'slack' | 'notion' | 'linkedin' | etc.
  permissions: string[]; // ['read','compose','send','post','write'...]
}

/** Machine-readable declaration of a skill input parameter. */
export interface InputDeclaration {
  /** Identifier, e.g. "cv_document" */
  name: string;
  /** JSON schema primitive or 'file' */
  type: "string" | "number" | "boolean" | "file" | "array" | "object";
  required: boolean;
  description: string;
  /** True if this input may carry EU personal data (triggers GDPR gating) */
  personalData: boolean;
}

/** EU AI Act risk classification for this skill. */
export interface AiActDeclaration {
  /** EU AI Act risk tier */
  riskLevel: "none" | "low" | "limited" | "high";
  /** Skill produces a decision affecting a person without human review */
  automatedDecision: boolean;
  /** Skill builds or applies a profile of individuals */
  profiling: boolean;
  /** GDPR Art. 22 — fully automated decision with significant legal effect */
  article22Applicable: boolean;
}

export interface ParsedSkill {
  /** Unique slug, e.g. "qualification-cv" */
  name: string;
  /** Model tier: 0=micro, 1=standard, 2=advanced, 3=frontier */
  tier: 0 | 1 | 2 | 3;
  /** Forces Mistral EU models regardless of language — personal data protection */
  gdprRequired: boolean;
  /** Whether this skill may invoke web browsing tools */
  webAccess: boolean;
  /** open = any URL; restricted = allowlisted domains only */
  webScope: "open" | "restricted";
  /** A = supervised (human approves autonomy expansion); B = can self-improve */
  autonomyTier: "A" | "B";
  /** MCP tool declarations with required permissions */
  tools: ToolDeclaration[];
  /** One-line description shown in the UI */
  description: string;
  /** Markdown body below the frontmatter (may contain {variable} placeholders) */
  body: string;

  // ── G2: Capability declarations ───────────────────────────────────────────

  /** Plain-language purpose statement (AI Act Art. 13 transparency) */
  purpose: string;
  /** Categories of personal data this skill processes */
  dataCategories: string[];
  /** Declared input parameters */
  inputs: InputDeclaration[];
  /** JSON Schema describing expected output structure (from output_schema frontmatter) */
  outputSchema: Record<string, unknown> | null;
  /** EU AI Act classification */
  aiAct: AiActDeclaration;
}

// ── Parsers ───────────────────────────────────────────────────────────────────

const VALID_TIERS = new Set([0, 1, 2, 3]);

function parseTier(raw: unknown): 0 | 1 | 2 | 3 {
  const n = Number(raw);
  if (VALID_TIERS.has(n)) return n as 0 | 1 | 2 | 3;
  return 1;
}

function parseAutonomyTier(raw: unknown): "A" | "B" {
  if (raw === "A" || raw === "B") return raw;
  return "A";
}

function parseWebScope(raw: unknown): "open" | "restricted" {
  if (raw === "restricted") return "restricted";
  return "open";
}

function parseTools(raw: unknown): ToolDeclaration[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t): t is Record<string, unknown> => t !== null && typeof t === "object")
    .map((t) => ({
      mcp: String(t.mcp ?? ""),
      permissions: Array.isArray(t.permissions) ? t.permissions.map(String) : [],
    }))
    .filter((t) => t.mcp.length > 0);
}

const VALID_INPUT_TYPES = new Set(["string", "number", "boolean", "file", "array", "object"]);

function parseInputs(raw: unknown): InputDeclaration[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((i): i is Record<string, unknown> => i !== null && typeof i === "object")
    .map((i) => ({
      name: String(i.name ?? ""),
      type: VALID_INPUT_TYPES.has(String(i.type))
        ? (String(i.type) as InputDeclaration["type"])
        : "string",
      required: Boolean(i.required ?? false),
      description: typeof i.description === "string" ? i.description : "",
      personalData: Boolean(i.personal_data ?? false),
    }))
    .filter((i) => i.name.length > 0);
}

const VALID_RISK_LEVELS = new Set(["none", "low", "limited", "high"]);

function parseAiAct(raw: unknown): AiActDeclaration {
  const defaults: AiActDeclaration = {
    riskLevel: "none",
    automatedDecision: false,
    profiling: false,
    article22Applicable: false,
  };
  if (!raw || typeof raw !== "object") return defaults;
  const r = raw as Record<string, unknown>;
  return {
    riskLevel: VALID_RISK_LEVELS.has(String(r.risk_level))
      ? (String(r.risk_level) as AiActDeclaration["riskLevel"])
      : "none",
    automatedDecision: Boolean(r.automated_decision ?? false),
    profiling: Boolean(r.profiling ?? false),
    article22Applicable: Boolean(r.article_22_applicable ?? false),
  };
}

function parseDataCategories(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(String).filter((s) => s.length > 0);
}

function parseOutputSchema(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

/**
 * Parse a raw SKILL.md string into a validated ParsedSkill.
 * Throws if the file is missing required fields (name).
 */
export function parseSkill(raw: string): ParsedSkill {
  const { data, content } = matter(raw);

  if (!data.name || typeof data.name !== "string") {
    throw new Error(`SKILL.md is missing required frontmatter field: name`);
  }

  return {
    name: data.name,
    tier: parseTier(data.tier),
    gdprRequired: Boolean(data.gdpr_required ?? false),
    webAccess: Boolean(data.web_access ?? false),
    webScope: parseWebScope(data.web_scope),
    autonomyTier: parseAutonomyTier(data.autonomy_tier),
    tools: parseTools(data.tools),
    description: typeof data.description === "string" ? data.description : "",
    body: content.trim(),

    // G2 capability declarations
    purpose: typeof data.purpose === "string" ? data.purpose : "",
    dataCategories: parseDataCategories(data.data_categories),
    inputs: parseInputs(data.inputs),
    outputSchema: parseOutputSchema(data.output_schema),
    aiAct: parseAiAct(data.ai_act),
  };
}

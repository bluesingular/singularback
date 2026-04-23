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
}

// ── Parser ────────────────────────────────────────────────────────────────────

const VALID_TIERS = new Set([0, 1, 2, 3]);

function parseTier(raw: unknown): 0 | 1 | 2 | 3 {
  const n = Number(raw);
  if (VALID_TIERS.has(n)) return n as 0 | 1 | 2 | 3;
  return 1; // default
}

function parseAutonomyTier(raw: unknown): "A" | "B" {
  if (raw === "A" || raw === "B") return raw;
  return "A"; // default — supervised
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
      permissions: Array.isArray(t.permissions)
        ? t.permissions.map(String)
        : [],
    }))
    .filter((t) => t.mcp.length > 0);
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
  };
}

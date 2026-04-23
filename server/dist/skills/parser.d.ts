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
export interface ToolDeclaration {
    mcp: string;
    permissions: string[];
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
/**
 * Parse a raw SKILL.md string into a validated ParsedSkill.
 * Throws if the file is missing required fields (name).
 */
export declare function parseSkill(raw: string): ParsedSkill;
//# sourceMappingURL=parser.d.ts.map
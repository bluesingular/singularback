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
// ── Parser ────────────────────────────────────────────────────────────────────
const VALID_TIERS = new Set([0, 1, 2, 3]);
function parseTier(raw) {
    const n = Number(raw);
    if (VALID_TIERS.has(n))
        return n;
    return 1; // default
}
function parseAutonomyTier(raw) {
    if (raw === "A" || raw === "B")
        return raw;
    return "A"; // default — supervised
}
function parseWebScope(raw) {
    if (raw === "restricted")
        return "restricted";
    return "open";
}
function parseTools(raw) {
    if (!Array.isArray(raw))
        return [];
    return raw
        .filter((t) => t !== null && typeof t === "object")
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
export function parseSkill(raw) {
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
//# sourceMappingURL=parser.js.map
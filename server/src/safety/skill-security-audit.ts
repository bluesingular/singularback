/**
 * server/src/safety/skill-security-audit.ts
 *
 * SKILL.md security scanner — adapted from bluesingular/asm security-auditor.ts.
 *
 * Scans raw SKILL.md content (frontmatter + body) for:
 *   - Credential / secret exposure (API keys, tokens, passwords)
 *   - Obfuscation (base64 blobs, atob, hex encoding)
 *   - Prompt injection embedded inside skill instructions
 *   - Shell / code execution references that should never appear in skill prose
 *   - Hardcoded URLs with embedded credentials
 *
 * Severity levels:
 *   critical — blocks installation; logged to security_events
 *   warning  — surfaces to admin; does not block
 *   info     — informational only
 *
 * Verdict:
 *   dangerous — any critical finding → block install
 *   warning   — one or more warnings, no criticals
 *   safe      — no findings
 *
 * Called from:
 *   - installSkills() in packs/installer.ts (per-skill at pack install)
 *   - POST /admin/skills/master (when authoring master skills)
 *   - PATCH /admin/skills/master/:skillId (when updating master skills)
 */

// ── Pattern library ───────────────────────────────────────────────────────────

interface SecurityPattern {
  id:          string
  category:    "credential" | "obfuscation" | "injection" | "execution" | "exfiltration"
  severity:    "critical" | "warning" | "info"
  pattern:     RegExp
  description: string
}

const PATTERNS: SecurityPattern[] = [
  // ── Credentials & secrets ────────────────────────────────────────────────
  {
    id: "hardcoded-openai-key",
    category: "credential",
    severity: "critical",
    pattern: /sk-[A-Za-z0-9]{20,}/,
    description: "Hardcoded OpenAI API key detected",
  },
  {
    id: "hardcoded-anthropic-key",
    category: "credential",
    severity: "critical",
    pattern: /sk-ant-[A-Za-z0-9\-_]{20,}/,
    description: "Hardcoded Anthropic API key detected",
  },
  {
    id: "hardcoded-github-pat",
    category: "credential",
    severity: "critical",
    pattern: /ghp_[A-Za-z0-9]{36}/,
    description: "Hardcoded GitHub personal access token detected",
  },
  {
    id: "hardcoded-aws-access-key",
    category: "credential",
    severity: "critical",
    pattern: /AKIA[0-9A-Z]{16}/,
    description: "Hardcoded AWS access key detected",
  },
  {
    id: "hardcoded-mistral-key",
    category: "credential",
    severity: "critical",
    pattern: /['"](mis|mstr)_[A-Za-z0-9]{20,}['"]/,
    description: "Hardcoded Mistral API key detected",
  },
  {
    id: "password-in-frontmatter",
    category: "credential",
    severity: "critical",
    pattern: /password\s*[:=]\s*['"]?[^\s'"]{8,}/i,
    description: "Hardcoded password found",
  },
  {
    id: "token-in-frontmatter",
    category: "credential",
    severity: "warning",
    pattern: /\b(?:api[-_]?key|bearer[-_]?token|secret[-_]?key)\s*[:=]\s*['"]?[A-Za-z0-9+/=_\-]{16,}/i,
    description: "Possible hardcoded token or API key",
  },
  {
    id: "url-with-credentials",
    category: "credential",
    severity: "critical",
    pattern: /https?:\/\/[^@\s]+:[^@\s]+@/,
    description: "URL contains embedded credentials (user:pass@host)",
  },

  // ── Obfuscation ──────────────────────────────────────────────────────────
  {
    id: "atob-call",
    category: "obfuscation",
    severity: "critical",
    pattern: /\batob\s*\(/,
    description: "Base64 decode call (atob) — possible obfuscation",
  },
  {
    id: "large-base64-blob",
    category: "obfuscation",
    severity: "critical",
    pattern: /[A-Za-z0-9+/]{100,}={0,2}/,
    description: "Large base64-encoded block — possible obfuscated payload",
  },
  {
    id: "hex-escape-sequence",
    category: "obfuscation",
    severity: "warning",
    pattern: /(?:\\x[0-9a-fA-F]{2}){8,}/,
    description: "Long hex escape sequence — possible obfuscation",
  },
  {
    id: "unicode-escape-sequence",
    category: "obfuscation",
    severity: "warning",
    pattern: /(?:\\u[0-9a-fA-F]{4}){5,}/,
    description: "Long unicode escape sequence — possible obfuscation",
  },

  // ── Prompt injection inside skill body ───────────────────────────────────
  {
    id: "inst-delimiter",
    category: "injection",
    severity: "critical",
    pattern: /\[INST\]|\[\/INST\]/,
    description: "Mistral instruction delimiter found inside skill — injection risk",
  },
  {
    id: "im-start-delimiter",
    category: "injection",
    severity: "critical",
    pattern: /<\|im_start\|>|<\|im_end\|>/,
    description: "ChatML delimiter found inside skill — injection risk",
  },
  {
    id: "ignore-previous-instructions",
    category: "injection",
    severity: "critical",
    pattern: /ignore\s+(?:all\s+)?(?:previous\s+|above\s+)?(?:instructions?|prompts?|directives?)/i,
    description: "Prompt injection phrase: 'ignore previous instructions'",
  },
  {
    id: "system-role-injection",
    category: "injection",
    severity: "critical",
    pattern: /^(System|User|Assistant)\s*:/i,
    description: "Role injection pattern embedded in skill body",
  },
  {
    id: "jailbreak-phrase",
    category: "injection",
    severity: "warning",
    pattern: /\bjailbreak\b/i,
    description: "Jailbreak keyword detected",
  },
  {
    id: "dan-mode",
    category: "injection",
    severity: "warning",
    pattern: /\bDAN\s+mode\b/i,
    description: "DAN mode instruction detected",
  },

  // ── Shell / code execution references ────────────────────────────────────
  // These patterns flag shell commands embedded in skill prose — acceptable
  // to document as examples but flagged at warning level so admins review.
  {
    id: "rm-rf-command",
    category: "execution",
    severity: "critical",
    pattern: /\brm\s+-rf\b/,
    description: "rm -rf command reference in skill body",
  },
  {
    id: "shell-exec-call",
    category: "execution",
    severity: "warning",
    pattern: /\bexec\s*\(|child_process|spawn\s*\(/,
    description: "Shell execution call reference",
  },
  {
    id: "eval-dynamic-code",
    category: "execution",
    severity: "warning",
    pattern: /\beval\s*\(|\bnew\s+Function\s*\(/,
    description: "Dynamic code execution reference (eval / new Function)",
  },

  // ── Exfiltration ──────────────────────────────────────────────────────────
  {
    id: "curl-with-data",
    category: "exfiltration",
    severity: "warning",
    pattern: /\bcurl\s+.*-d\b|\bcurl\s+.*--data\b/,
    description: "curl data-post command — possible exfiltration",
  },
  {
    id: "webhook-call",
    category: "exfiltration",
    severity: "info",
    pattern: /https?:\/\/[^\s]+\/webhook/i,
    description: "Webhook URL reference detected",
  },
]

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SkillSecurityFinding {
  patternId:   string
  category:    SecurityPattern["category"]
  severity:    SecurityPattern["severity"]
  description: string
  excerpt:     string   // short excerpt where the match was found (max 100 chars)
  lineNumber:  number
}

export type SkillSecurityVerdict = "dangerous" | "warning" | "safe"

export interface SkillSecurityAuditResult {
  verdict:   SkillSecurityVerdict
  findings:  SkillSecurityFinding[]
  /** Permissions the skill appears to require (informational) */
  permissions: string[]
}

// ── Audit function ────────────────────────────────────────────────────────────

/**
 * Scan raw SKILL.md content for security issues.
 *
 * Returns a structured result. The caller decides whether to block
 * (verdict === "dangerous") or surface warnings.
 *
 * Pure function — no DB access, no side effects.
 */
export function auditSkillContent(skillMarkdown: string): SkillSecurityAuditResult {
  const findings: SkillSecurityFinding[] = []
  const lines = skillMarkdown.split("\n")

  for (const p of PATTERNS) {
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx]
      // Create a fresh non-global copy to avoid stateful lastIndex issues
      const re = new RegExp(p.pattern.source, p.pattern.flags.replace("g", ""))
      const match = re.exec(line)
      if (match) {
        const start = Math.max(0, match.index - 20)
        const excerpt = line.slice(start, start + 100).trim()

        findings.push({
          patternId:   p.id,
          category:    p.category,
          severity:    p.severity,
          description: p.description,
          excerpt,
          lineNumber:  lineIdx + 1,
        })
        // One finding per pattern is enough
        break
      }
    }
  }

  // Determine verdict
  const hasCritical = findings.some(f => f.severity === "critical")
  const hasWarning  = findings.some(f => f.severity === "warning")

  const verdict: SkillSecurityVerdict =
    hasCritical ? "dangerous" :
    hasWarning  ? "warning"   : "safe"

  // Infer required permissions from findings
  const permissions = new Set<string>()
  for (const f of findings) {
    if (f.category === "execution")    permissions.add("shell")
    if (f.category === "exfiltration") permissions.add("network")
    if (f.category === "credential")   permissions.add("credential-access")
  }

  return {
    verdict,
    findings,
    permissions: [...permissions],
  }
}

/**
 * Throw if the audit result is dangerous.
 * Use this as a guard at install time.
 */
export function assertSkillSecuritySafe(
  result: SkillSecurityAuditResult,
  skillSlug: string,
): void {
  if (result.verdict === "dangerous") {
    const criticals = result.findings
      .filter(f => f.severity === "critical")
      .map(f => `  L${f.lineNumber}: [${f.patternId}] ${f.description}`)
      .join("\n")
    throw new Error(
      `Skill "${skillSlug}" failed security audit — ${result.findings.filter(f => f.severity === "critical").length} critical finding(s):\n${criticals}`,
    )
  }
}

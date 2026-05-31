/**
 * server/src/tasks/rule-engine.ts
 *
 * AG-8 — Hybrid reasoning: rule-based steps.
 *
 * Skills declare deterministic steps in SKILL.md frontmatter:
 *   steps:
 *     - name: eligibility_check
 *       type: rule_based
 *       rules_ref: eligibility_rules.json
 *     - name: write_output
 *       type: llm
 *       model_tier: T1_FR
 *
 * Workers detect type: rule_based → execute rules via this engine.
 * Benefits: <10ms vs ~800ms, zero token cost, 100% deterministic, fully auditable.
 * NEVER route deterministic eligibility/threshold checks to an LLM.
 *
 * Rule format (eligibility_rules.json):
 *   { rules: [{ id, field, op, value, outcome }] }
 *   op: "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "contains" | "exists"
 */

import pino from "pino";

const logger = pino({ name: "rule-engine" });

export type RuleOp = "eq" | "neq" | "gt" | "lt" | "gte" | "lte" | "contains" | "exists";

export interface Rule {
  id:      string;
  field:   string;        // dot-notation path into input data, e.g. "candidate.score"
  op:      RuleOp;
  value?:  unknown;       // comparison value (not needed for "exists")
  outcome: "pass" | "fail" | "escalate";
}

export interface RuleSet {
  rules:        Rule[];
  defaultOutcome: "pass" | "fail";
}

export interface RuleResult {
  ruleId:   string;
  field:    string;
  op:       RuleOp;
  actual:   unknown;
  expected: unknown;
  outcome:  "pass" | "fail" | "escalate";
  matched:  boolean;
}

export interface RuleEngineResult {
  overall:   "pass" | "fail" | "escalate";
  results:   RuleResult[];
  durationMs: number;
}

// ── Field accessor ────────────────────────────────────────────────────────────

function getField(data: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((obj, key) => {
    if (obj != null && typeof obj === "object") {
      return (obj as Record<string, unknown>)[key];
    }
    return undefined;
  }, data);
}

// ── Rule evaluation ───────────────────────────────────────────────────────────

function evaluate(actual: unknown, op: RuleOp, expected: unknown): boolean {
  switch (op) {
    case "eq":       return actual === expected;
    case "neq":      return actual !== expected;
    case "gt":       return Number(actual) > Number(expected);
    case "lt":       return Number(actual) < Number(expected);
    case "gte":      return Number(actual) >= Number(expected);
    case "lte":      return Number(actual) <= Number(expected);
    case "contains": return typeof actual === "string" && actual.includes(String(expected));
    case "exists":   return actual !== undefined && actual !== null;
    default:         return false;
  }
}

// ── Main engine ───────────────────────────────────────────────────────────────

/**
 * Execute a rule set against input data.
 * First rule that matches determines the overall outcome (short-circuit).
 * If no rule matches, uses defaultOutcome.
 */
export function executeRules(
  ruleset:   RuleSet,
  input:     Record<string, unknown>,
  stepName:  string,
): RuleEngineResult {
  const start = Date.now();
  const results: RuleResult[] = [];

  let overall: "pass" | "fail" | "escalate" = ruleset.defaultOutcome;

  for (const rule of ruleset.rules) {
    const actual  = getField(input, rule.field);
    const matched = evaluate(actual, rule.op, rule.value);

    results.push({
      ruleId:   rule.id,
      field:    rule.field,
      op:       rule.op,
      actual,
      expected: rule.value,
      outcome:  rule.outcome,
      matched,
    });

    if (matched) {
      overall = rule.outcome;
      break; // first-match-wins
    }
  }

  const durationMs = Date.now() - start;

  logger.info(
    { stepName, overall, ruleCount: ruleset.rules.length, durationMs },
    "rule-engine: step evaluated",
  );

  return { overall, results, durationMs };
}

/**
 * Parse a rule set from JSON (from rules_ref file content).
 * Returns null if the JSON is invalid — caller should fall back to LLM.
 */
export function parseRuleSet(json: string): RuleSet | null {
  try {
    const parsed = JSON.parse(json) as { rules?: unknown[]; defaultOutcome?: string };
    if (!Array.isArray(parsed.rules)) return null;
    return {
      rules:          parsed.rules as Rule[],
      defaultOutcome: (parsed.defaultOutcome as "pass" | "fail") ?? "fail",
    };
  } catch {
    return null;
  }
}

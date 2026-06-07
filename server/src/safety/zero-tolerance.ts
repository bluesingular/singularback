/**
 * server/src/safety/zero-tolerance.ts
 *
 * Gap E — Zero-tolerance action classes.
 *
 * Declared in SKILL.md frontmatter — enforced by platform — ZERO bypass path.
 * Runs BEFORE trust calibration check in worker execution.
 *
 * Example SKILL.md frontmatter:
 *   zero_tolerance_actions:
 *     - action_type: send_email
 *       condition: recipient_count > 50
 *     - action_type: delete_record
 *       condition: always
 *     - action_type: financial_commitment
 *       condition: amount > 1000
 *
 * INVARIANT: If a zero-tolerance rule matches, the action is FORCED to
 * pending_approval — no trust level, Away Mode, or plan tier bypasses this.
 */

import pino from "pino";

const logger = pino({ name: "zero-tolerance" });

export class ZeroToleranceViolation extends Error {
  constructor(
    public readonly actionType: string,
    public readonly reason:     string,
  ) {
    super(`Zero-tolerance violation: ${actionType} — ${reason}`);
    this.name = "ZeroToleranceViolation";
  }
}

export interface ZeroToleranceRule {
  action_type: string;
  condition:   string;   // "always" | field comparisons like "recipient_count > 50"
}

export interface AgentAction {
  type:   string;
  params: Record<string, unknown>;
}

// ── Condition evaluator ───────────────────────────────────────────────────────

function evaluateCondition(
  condition: string,
  action:    AgentAction,
  context:   Record<string, unknown>,
): boolean {
  if (condition === "always") return true;

  // Parse simple comparisons: "field op value"
  const match = condition.match(/^(\w+)\s*(>=|<=|==|!=|>|<)\s*(.+)$/);
  if (!match) return false;

  const [, field, op, rawValue] = match;
  const actual = action.params[field!] ?? context[field!];
  const expected = isNaN(Number(rawValue)) ? rawValue!.trim() : Number(rawValue);

  switch (op) {
    case ">":  return Number(actual) >  Number(expected);
    case "<":  return Number(actual) <  Number(expected);
    case ">=": return Number(actual) >= Number(expected);
    case "<=": return Number(actual) <= Number(expected);
    case "==": return String(actual) === String(expected);
    case "!=": return String(actual) !== String(expected);
    default:   return false;
  }
}

// ── Main check ────────────────────────────────────────────────────────────────

/**
 * Check whether an action violates any zero-tolerance rules from the skill.
 * Throws ZeroToleranceViolation if matched — caller must force pending_approval.
 *
 * @param rules   zero_tolerance_actions from skill frontmatter metadata
 * @param action  the action about to be executed
 * @param context company context (for condition evaluation)
 */
export function checkZeroTolerance(
  rules:   ZeroToleranceRule[],
  action:  AgentAction,
  context: Record<string, unknown> = {},
): void {
  if (!rules || rules.length === 0) return;

  for (const rule of rules) {
    if (rule.action_type !== action.type && rule.action_type !== "*") continue;

    const triggered = evaluateCondition(rule.condition, action, context);
    if (triggered) {
      logger.info(
        { actionType: action.type, condition: rule.condition },
        "zero-tolerance: action blocked — forcing approval",
      );
      throw new ZeroToleranceViolation(action.type, rule.condition);
    }
  }
}

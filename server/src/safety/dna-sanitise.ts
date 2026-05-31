/**
 * server/src/safety/dna-sanitise.ts
 *
 * C5 — Pack template injection sanitisation.
 *
 * Applied to EVERY Company DNA field value before it is interpolated into
 * skill instructions at pack install time (and on every context assembly).
 *
 * Strips:
 *   - Template delimiters that could break the interpolation engine
 *   - Role injection patterns (System:/User:/Assistant: prefixes after newlines)
 *   - Common prompt injection phrases (ignore previous instructions, etc.)
 *   - Mistral instruction delimiters ([INST]/[/INST])
 *
 * Hard caps each field at 500 characters after sanitisation.
 * Logs a warning (not an error) when the value is modified — so the pack
 * installer can surface a notice to the operator without blocking installation.
 */

import pino from "pino";

const logger = pino({ name: "dna-sanitise" });

const MAX_FIELD_LENGTH = 500;

/**
 * Sanitise a single Company DNA field value before template interpolation.
 * Returns the sanitised value (may be identical to input if nothing was stripped).
 */
export function sanitiseDNAValue(value: string, fieldKey?: string): string {
  const original = value;

  let sanitised = value
    // Remove template delimiters that could inject extra interpolation tokens
    .replace(/\{|\}/g, "")
    // Remove role injection patterns after newlines
    .replace(/\n\n(System|User|Assistant):/gi, "")
    // Remove common prompt injection phrases
    .replace(/ignore\s+(all\s+|previous\s+|above\s+)/gi, "")
    // Remove Mistral instruction delimiters
    .replace(/\[INST\]|\[\/INST\]/g, "")
    .trim()
    // Hard cap
    .slice(0, MAX_FIELD_LENGTH);

  if (sanitised !== original) {
    logger.warn(
      { field: fieldKey, originalLength: original.length, sanitisedLength: sanitised.length },
      "dna-sanitise: field value was modified during sanitisation",
    );
  }

  return sanitised;
}

/**
 * Sanitise all string values in a Company DNA record.
 * Non-string values are passed through unchanged.
 */
export function sanitiseDNARecord(
  dna: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(dna)) {
    result[key] = typeof value === "string" ? sanitiseDNAValue(value, key) : value;
  }
  return result;
}

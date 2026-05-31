/**
 * server/src/safety/input-guardrails.ts
 *
 * C7 — Input guardrails.
 *
 * Three sequential checks run BEFORE context assembly on every task creation.
 * All three must pass or the task is blocked and a security_event is logged.
 *
 * CHECK 1: Prompt injection detection
 *   Pattern match against known injection phrases.
 *   If detected → block task, log security_event (severity: critical).
 *
 * CHECK 2: PII detection
 *   Scan task brief for obvious personal data patterns (email, phone, IBAN).
 *   If found when not expected → surface confirmation before proceeding.
 *   (Soft block — returns piiDetected: true, caller decides to pause or continue.)
 *
 * CHECK 3: Scope violation
 *   Reserved for embedding-based check once pgvector is wired to capabilities.
 *   Currently a pass-through (returns scopeOk: true always).
 *
 * INVARIANT: No bypass path. Called from task creation route before any DB write.
 */

import { eq } from "drizzle-orm";
import { securityEvents } from "@paperclipai/db";
import type { Db } from "@paperclipai/db";
import pino from "pino";

const logger = pino({ name: "input-guardrails" });

// ── Injection patterns ────────────────────────────────────────────────────────

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+|previous\s+|above\s+)(instructions?|prompts?)/gi,
  /\[INST\]|\[\/INST\]/g,
  /<<<.*>>>/g,
  /<\|im_start\|>|<\|im_end\|>/g,
  /\bSystem:\s/gi,
  /\bDAN\s+mode\b/gi,
  /jailbreak/gi,
  /act\s+as\s+(if\s+you\s+are|a\s+different)/gi,
  /you\s+are\s+now\s+(a\s+)?(?:different|new|another)\s+(AI|model|assistant)/gi,
];

// ── PII patterns ──────────────────────────────────────────────────────────────

const PII_PATTERNS = [
  /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b/,    // IBAN
  /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/,                // credit card
  /\b\d{3}-\d{2}-\d{4}\b/,                                   // SSN (US)
  /\b(?:\+33|0)[1-9](?:[\s.-]?\d{2}){4}\b/,                  // French phone
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,   // email
];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GuardrailResult {
  injectionDetected: boolean;
  piiDetected:       boolean;
  scopeOk:           boolean;
  blocked:           boolean;        // true if task must not proceed
  reason?:           string;
}

// ── Main check ────────────────────────────────────────────────────────────────

export async function runInputGuardrails(
  db:        Db,
  params: {
    companyId:   string;
    taskId?:     string;
    brief:       string;
    expectsPii?: boolean;   // true for skills that legitimately handle personal data
  },
): Promise<GuardrailResult> {
  const { companyId, taskId, brief, expectsPii = false } = params;

  // ── CHECK 1: Prompt injection ─────────────────────────────────────────────
  const injectionDetected = INJECTION_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0; // reset stateful regex
    return pattern.test(brief);
  });

  if (injectionDetected) {
    logger.warn({ companyId, taskId }, "guardrails: prompt injection detected");

    await db.insert(securityEvents).values({
      companyId,
      taskId:    taskId ?? null,
      eventType: "prompt_injection",
      severity:  "critical",
      payload:   { briefExcerpt: brief.slice(0, 200) },
    });

    return { injectionDetected: true, piiDetected: false, scopeOk: true, blocked: true, reason: "prompt_injection" };
  }

  // ── CHECK 2: PII detection ────────────────────────────────────────────────
  const piiDetected = !expectsPii && PII_PATTERNS.some((p) => p.test(brief));

  if (piiDetected) {
    logger.info({ companyId, taskId }, "guardrails: PII detected in task brief");

    await db.insert(securityEvents).values({
      companyId,
      taskId:    taskId ?? null,
      eventType: "pii_in_brief",
      severity:  "medium",
      payload:   { briefExcerpt: brief.slice(0, 200) },
    });
    // Soft block — caller decides whether to surface confirmation or proceed
    return { injectionDetected: false, piiDetected: true, scopeOk: true, blocked: false };
  }

  // ── CHECK 3: Scope violation (stub — full embedding check at 50 customers) ─
  const scopeOk = true;

  return { injectionDetected: false, piiDetected: false, scopeOk, blocked: false };
}

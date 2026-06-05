/**
 * server/src/packs/types.ts
 *
 * Pack manifest type definitions — M12.
 *
 * A pack is a self-contained bundle that installs a complete AI team for a
 * vertical (e.g. recruitment agencies). The installer reads pack.json and
 * runs a 7-step atomic transaction.
 */

// ── Pack manifest ─────────────────────────────────────────────────────────────

export interface PackAgentHandoff {
  /** Condition key, e.g. "cv_score_gte_4" */
  condition:     string;
  /** Slug of the target agent that receives the follow-on task */
  targetAgent:   string;
  /** Task title template for the new issue (may use {{candidate_name}} etc.) */
  taskTemplate:  string;
}

export interface PackAgent {
  slug:        string;
  name:        string;
  /** Customer-facing callsign (defaults to name if omitted) */
  displayName?: string;
  description: string;
  /** One of 6 approved hex values. Assigned sequentially at install if omitted. */
  colour?:     string;
  /** soul.md template — interpolated with Company DNA at install time */
  soulTemplate?: string;
  /** [[CONSTITUTION_EXTENSION]] block appended to the base constitution */
  constitutionExtension?: string;
  /** LLM model routing key, e.g. "T1_FR" */
  modelTier:   string;
  /** Skill slugs this agent is assigned to */
  skills:      string[];
  /** Handoff rules — follow-on tasks to create when conditions are met */
  handoffs?:   PackAgentHandoff[];
}

export interface PackSkill {
  slug:       string;
  name:       string;
  /** Full SKILL.md content (may contain {{template_vars}}) */
  markdown:   string;
  /** JSON Schema for output validation (M6) */
  outputSchema?: Record<string, unknown>;
  tier:       0 | 1 | 2 | 3;
  gdprRequired: boolean;
}

export interface PackQualityGate {
  /** volume_limit | recipient_whitelist | content_forbidden | budget_limit */
  gateType: string;
  config:   Record<string, unknown>;
  enabled:  boolean;
}

export interface SeedTask {
  /** Slug of the agent that will execute this task */
  agentSlug: string;
  /** Task title (may contain {{template_vars}}) */
  title:     string;
  /** Task body / instructions (may contain {{template_vars}}) */
  body:      string;
  /**
   * Delay before the task fires, in ms.
   * Capped at SEED_TASK_MAX_DELAY_MS (10 min) by the installer.
   */
  delayMs?:  number;
}

export interface PackActivationTrigger {
  key:               string;   // e.g. "day_2_first_task"
  dayThreshold:      number;
  /** Notification title (from EMOTIONAL_LAYER.md) */
  notificationTitle: string;
  /** Notification body (from EMOTIONAL_LAYER.md) */
  notificationBody:  string;
}

export interface PackCompanyDna {
  description?:       string;
  customerProfile?:   string;
  tone?:              string;
  regulatoryContext?: string;
}

export interface PackManifest {
  /** Unique pack slug, e.g. "p1-recruitment" */
  slug:               string;
  /** Human-readable pack name */
  name:               string;
  version:            string;
  agents:             PackAgent[];
  skills:             PackSkill[];
  qualityGates:       PackQualityGate[];
  /** Exactly 3 seed tasks per spec (RULE 10: must look like real work) */
  seedTasks:          SeedTask[];
  /** Exactly 5 activation moments per spec */
  activationSequence: PackActivationTrigger[];
  companyDna?:        PackCompanyDna;
  // UI / marketplace fields
  description?:            string;
  tagline?:                string;
  estimated_setup_minutes?: number;
  value_proposition?:       string[];
}

// ── Installer params / result ─────────────────────────────────────────────────

export interface InstallPackParams {
  companyId:  string;
  pack:       PackManifest;
  /** Template variable values, e.g. { company_name: "Agence Dupont RH" } */
  variables:  Record<string, string>;
  /**
   * Base URL of this server (e.g. "http://127.0.0.1:3102").
   * Used to configure the HTTP adapter URL on installed agents so they can
   * be executed via POST /internal/agent/execute.
   * Defaults to http://127.0.0.1:3210 if not provided.
   */
  serverBaseUrl?: string;
  /**
   * @deprecated No longer used — seed tasks and activation triggers are now
   * written to the pending_jobs outbox inside the DB transaction (P5).
   * The outbox worker dispatches to BullMQ after commit. Kept for call-site
   * backwards compatibility; will be removed in a future cleanup.
   */
  installQueue?: { add: (name: string, data: unknown, opts?: { delay?: number; jobId?: string }) => Promise<unknown> };
  /** @deprecated See installQueue. */
  systemQueue?:  { add: (name: string, data: unknown, opts?: { delay?: number; jobId?: string }) => Promise<unknown> };
}

export interface InstallPackResult {
  success:   boolean;
  agentIds:  string[];
  packSlug:  string;
}

// ── Errors ────────────────────────────────────────────────────────────────────

export class PackValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PackValidationError";
  }
}

export class PackInstallError extends Error {
  constructor(
    message: string,
    public readonly step: number,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "PackInstallError";
  }
}

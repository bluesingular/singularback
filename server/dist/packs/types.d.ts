/**
 * server/src/packs/types.ts
 *
 * Pack manifest type definitions — M12.
 *
 * A pack is a self-contained bundle that installs a complete AI team for a
 * vertical (e.g. recruitment agencies). The installer reads pack.json and
 * runs a 7-step atomic transaction.
 */
export interface PackAgent {
    slug: string;
    name: string;
    description: string;
    /** LLM model routing key, e.g. "T1_FR" */
    modelTier: string;
    /** Skill slugs this agent is assigned to */
    skills: string[];
}
export interface PackSkill {
    slug: string;
    name: string;
    /** Full SKILL.md content (may contain {{template_vars}}) */
    markdown: string;
    /** JSON Schema for output validation (M6) */
    outputSchema?: Record<string, unknown>;
    tier: 0 | 1 | 2 | 3;
    gdprRequired: boolean;
}
export interface PackQualityGate {
    /** volume_limit | recipient_whitelist | content_forbidden | budget_limit */
    gateType: string;
    config: Record<string, unknown>;
    enabled: boolean;
}
export interface SeedTask {
    /** Slug of the agent that will execute this task */
    agentSlug: string;
    /** Task title (may contain {{template_vars}}) */
    title: string;
    /** Task body / instructions (may contain {{template_vars}}) */
    body: string;
    /**
     * Delay before the task fires, in ms.
     * Capped at SEED_TASK_MAX_DELAY_MS (10 min) by the installer.
     */
    delayMs?: number;
}
export interface PackActivationTrigger {
    key: string;
    dayThreshold: number;
    /** Notification title (from EMOTIONAL_LAYER.md) */
    notificationTitle: string;
    /** Notification body (from EMOTIONAL_LAYER.md) */
    notificationBody: string;
}
export interface PackCompanyDna {
    description?: string;
    customerProfile?: string;
    tone?: string;
    regulatoryContext?: string;
}
export interface PackManifest {
    /** Unique pack slug, e.g. "p1-recruitment" */
    slug: string;
    /** Human-readable pack name */
    name: string;
    version: string;
    agents: PackAgent[];
    skills: PackSkill[];
    qualityGates: PackQualityGate[];
    /** Exactly 3 seed tasks per spec (RULE 10: must look like real work) */
    seedTasks: SeedTask[];
    /** Exactly 5 activation moments per spec */
    activationSequence: PackActivationTrigger[];
    companyDna?: PackCompanyDna;
    description?: string;
    tagline?: string;
    estimated_setup_minutes?: number;
    value_proposition?: string[];
}
export interface InstallPackParams {
    companyId: string;
    pack: PackManifest;
    /** Template variable values, e.g. { company_name: "Agence Dupont RH" } */
    variables: Record<string, string>;
    /** BullMQ agentQueue — for seed task scheduling */
    agentQueue: {
        add: (name: string, data: unknown, opts?: {
            delay?: number;
            jobId?: string;
        }) => Promise<unknown>;
    };
    /** BullMQ systemQueue — for activation trigger registration */
    systemQueue: {
        add: (name: string, data: unknown, opts?: {
            delay?: number;
            jobId?: string;
        }) => Promise<unknown>;
    };
}
export interface InstallPackResult {
    success: boolean;
    agentIds: string[];
    packSlug: string;
}
export declare class PackValidationError extends Error {
    constructor(message: string);
}
export declare class PackInstallError extends Error {
    readonly step: number;
    readonly cause?: unknown | undefined;
    constructor(message: string, step: number, cause?: unknown | undefined);
}
//# sourceMappingURL=types.d.ts.map
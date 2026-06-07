import type { ApprovalStatus, ApprovalType } from "../constants.js";
export interface Approval {
    id: string;
    companyId: string;
    type: ApprovalType;
    requestedByAgentId: string | null;
    requestedByUserId: string | null;
    status: ApprovalStatus;
    payload: Record<string, unknown>;
    decisionNote: string | null;
    decidedByUserId: string | null;
    decidedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    /**
     * F8 — Skill version notice.
     * Set by the API when the skill used to generate this task has since been updated.
     * When both fields are present and differ, the UI shows a notice in the approval card.
     */
    taskSkillVersion?: string;
    latestSkillVersion?: string;
    /** AG-4 — Confidence flag from multi-factor confidence scoring. Never a raw number. */
    confidenceFlag?: "high" | "medium" | "low";
}
export interface ApprovalComment {
    id: string;
    companyId: string;
    approvalId: string;
    authorAgentId: string | null;
    authorUserId: string | null;
    body: string;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=approval.d.ts.map
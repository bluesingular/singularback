import type { IssueExecutionDecision, IssueExecutionPolicy, IssueExecutionStagePrincipal, IssueExecutionState } from "@paperclipai/shared";
type AssigneeLike = {
    assigneeAgentId?: string | null;
    assigneeUserId?: string | null;
};
type IssueLike = AssigneeLike & {
    status: string;
    executionPolicy?: IssueExecutionPolicy | Record<string, unknown> | null;
    executionState?: IssueExecutionState | Record<string, unknown> | null;
};
type ActorLike = {
    agentId?: string | null;
    userId?: string | null;
};
type RequestedAssigneePatch = {
    assigneeAgentId?: string | null;
    assigneeUserId?: string | null;
};
type TransitionInput = {
    issue: IssueLike;
    policy: IssueExecutionPolicy | null;
    requestedStatus?: string;
    requestedAssigneePatch: RequestedAssigneePatch;
    actor: ActorLike;
    commentBody?: string | null;
};
type TransitionResult = {
    patch: Record<string, unknown>;
    decision?: Pick<IssueExecutionDecision, "stageId" | "stageType" | "outcome" | "body">;
    workflowControlledAssignment?: boolean;
};
export declare function normalizeIssueExecutionPolicy(input: unknown): IssueExecutionPolicy | null;
export declare function parseIssueExecutionState(input: unknown): IssueExecutionState | null;
export declare function assigneePrincipal(input: AssigneeLike): IssueExecutionStagePrincipal | null;
export declare function applyIssueExecutionPolicyTransition(input: TransitionInput): TransitionResult;
export {};
//# sourceMappingURL=issue-execution-policy.d.ts.map
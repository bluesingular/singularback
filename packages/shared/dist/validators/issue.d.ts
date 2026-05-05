import { z } from "zod";
export declare const ISSUE_EXECUTION_WORKSPACE_PREFERENCES: readonly ["inherit", "shared_workspace", "isolated_workspace", "operator_branch", "reuse_existing", "agent_default"];
export declare const issueExecutionWorkspaceSettingsSchema: z.ZodObject<{
    mode: z.ZodOptional<z.ZodEnum<["inherit", "shared_workspace", "isolated_workspace", "operator_branch", "reuse_existing", "agent_default"]>>;
    workspaceStrategy: z.ZodNullable<z.ZodOptional<z.ZodObject<{
        type: z.ZodOptional<z.ZodEnum<["project_primary", "git_worktree", "adapter_managed", "cloud_sandbox"]>>;
        baseRef: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        branchTemplate: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        worktreeParentDir: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        provisionCommand: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        teardownCommand: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    }, "strict", z.ZodTypeAny, {
        type?: "project_primary" | "git_worktree" | "adapter_managed" | "cloud_sandbox" | undefined;
        provisionCommand?: string | null | undefined;
        teardownCommand?: string | null | undefined;
        baseRef?: string | null | undefined;
        branchTemplate?: string | null | undefined;
        worktreeParentDir?: string | null | undefined;
    }, {
        type?: "project_primary" | "git_worktree" | "adapter_managed" | "cloud_sandbox" | undefined;
        provisionCommand?: string | null | undefined;
        teardownCommand?: string | null | undefined;
        baseRef?: string | null | undefined;
        branchTemplate?: string | null | undefined;
        worktreeParentDir?: string | null | undefined;
    }>>>;
    workspaceRuntime: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, "strict", z.ZodTypeAny, {
    workspaceRuntime?: Record<string, unknown> | null | undefined;
    mode?: "shared_workspace" | "isolated_workspace" | "operator_branch" | "inherit" | "reuse_existing" | "agent_default" | undefined;
    workspaceStrategy?: {
        type?: "project_primary" | "git_worktree" | "adapter_managed" | "cloud_sandbox" | undefined;
        provisionCommand?: string | null | undefined;
        teardownCommand?: string | null | undefined;
        baseRef?: string | null | undefined;
        branchTemplate?: string | null | undefined;
        worktreeParentDir?: string | null | undefined;
    } | null | undefined;
}, {
    workspaceRuntime?: Record<string, unknown> | null | undefined;
    mode?: "shared_workspace" | "isolated_workspace" | "operator_branch" | "inherit" | "reuse_existing" | "agent_default" | undefined;
    workspaceStrategy?: {
        type?: "project_primary" | "git_worktree" | "adapter_managed" | "cloud_sandbox" | undefined;
        provisionCommand?: string | null | undefined;
        teardownCommand?: string | null | undefined;
        baseRef?: string | null | undefined;
        branchTemplate?: string | null | undefined;
        worktreeParentDir?: string | null | undefined;
    } | null | undefined;
}>;
export declare const issueAssigneeAdapterOverridesSchema: z.ZodObject<{
    adapterConfig: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    useProjectWorkspace: z.ZodOptional<z.ZodBoolean>;
}, "strict", z.ZodTypeAny, {
    adapterConfig?: Record<string, unknown> | undefined;
    useProjectWorkspace?: boolean | undefined;
}, {
    adapterConfig?: Record<string, unknown> | undefined;
    useProjectWorkspace?: boolean | undefined;
}>;
export declare const issueExecutionStagePrincipalSchema: z.ZodEffects<z.ZodObject<{
    type: z.ZodEnum<["agent", "user"]>;
    agentId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    userId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    type: "agent" | "user";
    agentId?: string | null | undefined;
    userId?: string | null | undefined;
}, {
    type: "agent" | "user";
    agentId?: string | null | undefined;
    userId?: string | null | undefined;
}>, {
    type: "agent" | "user";
    agentId?: string | null | undefined;
    userId?: string | null | undefined;
}, {
    type: "agent" | "user";
    agentId?: string | null | undefined;
    userId?: string | null | undefined;
}>;
export declare const issueExecutionStageParticipantSchema: z.ZodEffects<z.ZodObject<{
    type: z.ZodEnum<["agent", "user"]>;
    agentId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    userId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
} & {
    id: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "agent" | "user";
    id?: string | undefined;
    agentId?: string | null | undefined;
    userId?: string | null | undefined;
}, {
    type: "agent" | "user";
    id?: string | undefined;
    agentId?: string | null | undefined;
    userId?: string | null | undefined;
}>, {
    type: "agent" | "user";
    id?: string | undefined;
    agentId?: string | null | undefined;
    userId?: string | null | undefined;
}, {
    type: "agent" | "user";
    id?: string | undefined;
    agentId?: string | null | undefined;
    userId?: string | null | undefined;
}>;
export declare const issueExecutionStageSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<["review", "approval"]>;
    approvalsNeeded: z.ZodDefault<z.ZodOptional<z.ZodLiteral<1>>>;
    participants: z.ZodDefault<z.ZodArray<z.ZodEffects<z.ZodObject<{
        type: z.ZodEnum<["agent", "user"]>;
        agentId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        userId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    } & {
        id: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "agent" | "user";
        id?: string | undefined;
        agentId?: string | null | undefined;
        userId?: string | null | undefined;
    }, {
        type: "agent" | "user";
        id?: string | undefined;
        agentId?: string | null | undefined;
        userId?: string | null | undefined;
    }>, {
        type: "agent" | "user";
        id?: string | undefined;
        agentId?: string | null | undefined;
        userId?: string | null | undefined;
    }, {
        type: "agent" | "user";
        id?: string | undefined;
        agentId?: string | null | undefined;
        userId?: string | null | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    type: "review" | "approval";
    approvalsNeeded: 1;
    participants: {
        type: "agent" | "user";
        id?: string | undefined;
        agentId?: string | null | undefined;
        userId?: string | null | undefined;
    }[];
    id?: string | undefined;
}, {
    type: "review" | "approval";
    id?: string | undefined;
    approvalsNeeded?: 1 | undefined;
    participants?: {
        type: "agent" | "user";
        id?: string | undefined;
        agentId?: string | null | undefined;
        userId?: string | null | undefined;
    }[] | undefined;
}>;
export declare const issueExecutionPolicySchema: z.ZodObject<{
    mode: z.ZodDefault<z.ZodOptional<z.ZodEnum<["normal", "auto"]>>>;
    commentRequired: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    stages: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<["review", "approval"]>;
        approvalsNeeded: z.ZodDefault<z.ZodOptional<z.ZodLiteral<1>>>;
        participants: z.ZodDefault<z.ZodArray<z.ZodEffects<z.ZodObject<{
            type: z.ZodEnum<["agent", "user"]>;
            agentId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
            userId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        } & {
            id: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "agent" | "user";
            id?: string | undefined;
            agentId?: string | null | undefined;
            userId?: string | null | undefined;
        }, {
            type: "agent" | "user";
            id?: string | undefined;
            agentId?: string | null | undefined;
            userId?: string | null | undefined;
        }>, {
            type: "agent" | "user";
            id?: string | undefined;
            agentId?: string | null | undefined;
            userId?: string | null | undefined;
        }, {
            type: "agent" | "user";
            id?: string | undefined;
            agentId?: string | null | undefined;
            userId?: string | null | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        type: "review" | "approval";
        approvalsNeeded: 1;
        participants: {
            type: "agent" | "user";
            id?: string | undefined;
            agentId?: string | null | undefined;
            userId?: string | null | undefined;
        }[];
        id?: string | undefined;
    }, {
        type: "review" | "approval";
        id?: string | undefined;
        approvalsNeeded?: 1 | undefined;
        participants?: {
            type: "agent" | "user";
            id?: string | undefined;
            agentId?: string | null | undefined;
            userId?: string | null | undefined;
        }[] | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    mode: "auto" | "normal";
    commentRequired: boolean;
    stages: {
        type: "review" | "approval";
        approvalsNeeded: 1;
        participants: {
            type: "agent" | "user";
            id?: string | undefined;
            agentId?: string | null | undefined;
            userId?: string | null | undefined;
        }[];
        id?: string | undefined;
    }[];
}, {
    mode?: "auto" | "normal" | undefined;
    commentRequired?: boolean | undefined;
    stages?: {
        type: "review" | "approval";
        id?: string | undefined;
        approvalsNeeded?: 1 | undefined;
        participants?: {
            type: "agent" | "user";
            id?: string | undefined;
            agentId?: string | null | undefined;
            userId?: string | null | undefined;
        }[] | undefined;
    }[] | undefined;
}>;
export declare const issueExecutionStateSchema: z.ZodObject<{
    status: z.ZodEnum<["idle", "pending", "changes_requested", "completed"]>;
    currentStageId: z.ZodNullable<z.ZodString>;
    currentStageIndex: z.ZodNullable<z.ZodNumber>;
    currentStageType: z.ZodNullable<z.ZodEnum<["review", "approval"]>>;
    currentParticipant: z.ZodNullable<z.ZodEffects<z.ZodObject<{
        type: z.ZodEnum<["agent", "user"]>;
        agentId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        userId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        type: "agent" | "user";
        agentId?: string | null | undefined;
        userId?: string | null | undefined;
    }, {
        type: "agent" | "user";
        agentId?: string | null | undefined;
        userId?: string | null | undefined;
    }>, {
        type: "agent" | "user";
        agentId?: string | null | undefined;
        userId?: string | null | undefined;
    }, {
        type: "agent" | "user";
        agentId?: string | null | undefined;
        userId?: string | null | undefined;
    }>>;
    returnAssignee: z.ZodNullable<z.ZodEffects<z.ZodObject<{
        type: z.ZodEnum<["agent", "user"]>;
        agentId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        userId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        type: "agent" | "user";
        agentId?: string | null | undefined;
        userId?: string | null | undefined;
    }, {
        type: "agent" | "user";
        agentId?: string | null | undefined;
        userId?: string | null | undefined;
    }>, {
        type: "agent" | "user";
        agentId?: string | null | undefined;
        userId?: string | null | undefined;
    }, {
        type: "agent" | "user";
        agentId?: string | null | undefined;
        userId?: string | null | undefined;
    }>>;
    completedStageIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    lastDecisionId: z.ZodNullable<z.ZodString>;
    lastDecisionOutcome: z.ZodNullable<z.ZodEnum<["approved", "changes_requested"]>>;
}, "strip", z.ZodTypeAny, {
    status: "idle" | "pending" | "changes_requested" | "completed";
    currentStageId: string | null;
    currentStageIndex: number | null;
    currentStageType: "review" | "approval" | null;
    currentParticipant: {
        type: "agent" | "user";
        agentId?: string | null | undefined;
        userId?: string | null | undefined;
    } | null;
    returnAssignee: {
        type: "agent" | "user";
        agentId?: string | null | undefined;
        userId?: string | null | undefined;
    } | null;
    completedStageIds: string[];
    lastDecisionId: string | null;
    lastDecisionOutcome: "changes_requested" | "approved" | null;
}, {
    status: "idle" | "pending" | "changes_requested" | "completed";
    currentStageId: string | null;
    currentStageIndex: number | null;
    currentStageType: "review" | "approval" | null;
    currentParticipant: {
        type: "agent" | "user";
        agentId?: string | null | undefined;
        userId?: string | null | undefined;
    } | null;
    returnAssignee: {
        type: "agent" | "user";
        agentId?: string | null | undefined;
        userId?: string | null | undefined;
    } | null;
    lastDecisionId: string | null;
    lastDecisionOutcome: "changes_requested" | "approved" | null;
    completedStageIds?: string[] | undefined;
}>;
export declare const createIssueSchema: z.ZodObject<{
    projectId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    projectWorkspaceId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    goalId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    parentId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    blockedByIssueIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    inheritExecutionWorkspaceFromIssueId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    title: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    status: z.ZodDefault<z.ZodOptional<z.ZodEnum<["backlog", "todo", "in_progress", "in_review", "done", "blocked", "cancelled", "awaiting_clarification"]>>>;
    priority: z.ZodDefault<z.ZodOptional<z.ZodEnum<["critical", "high", "medium", "low"]>>>;
    assigneeAgentId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    assigneeUserId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    requestDepth: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    billingCode: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    assigneeAdapterOverrides: z.ZodNullable<z.ZodOptional<z.ZodObject<{
        adapterConfig: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        useProjectWorkspace: z.ZodOptional<z.ZodBoolean>;
    }, "strict", z.ZodTypeAny, {
        adapterConfig?: Record<string, unknown> | undefined;
        useProjectWorkspace?: boolean | undefined;
    }, {
        adapterConfig?: Record<string, unknown> | undefined;
        useProjectWorkspace?: boolean | undefined;
    }>>>;
    executionPolicy: z.ZodNullable<z.ZodOptional<z.ZodObject<{
        mode: z.ZodDefault<z.ZodOptional<z.ZodEnum<["normal", "auto"]>>>;
        commentRequired: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        stages: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            type: z.ZodEnum<["review", "approval"]>;
            approvalsNeeded: z.ZodDefault<z.ZodOptional<z.ZodLiteral<1>>>;
            participants: z.ZodDefault<z.ZodArray<z.ZodEffects<z.ZodObject<{
                type: z.ZodEnum<["agent", "user"]>;
                agentId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
                userId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
            } & {
                id: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                type: "agent" | "user";
                id?: string | undefined;
                agentId?: string | null | undefined;
                userId?: string | null | undefined;
            }, {
                type: "agent" | "user";
                id?: string | undefined;
                agentId?: string | null | undefined;
                userId?: string | null | undefined;
            }>, {
                type: "agent" | "user";
                id?: string | undefined;
                agentId?: string | null | undefined;
                userId?: string | null | undefined;
            }, {
                type: "agent" | "user";
                id?: string | undefined;
                agentId?: string | null | undefined;
                userId?: string | null | undefined;
            }>, "many">>;
        }, "strip", z.ZodTypeAny, {
            type: "review" | "approval";
            approvalsNeeded: 1;
            participants: {
                type: "agent" | "user";
                id?: string | undefined;
                agentId?: string | null | undefined;
                userId?: string | null | undefined;
            }[];
            id?: string | undefined;
        }, {
            type: "review" | "approval";
            id?: string | undefined;
            approvalsNeeded?: 1 | undefined;
            participants?: {
                type: "agent" | "user";
                id?: string | undefined;
                agentId?: string | null | undefined;
                userId?: string | null | undefined;
            }[] | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        mode: "auto" | "normal";
        commentRequired: boolean;
        stages: {
            type: "review" | "approval";
            approvalsNeeded: 1;
            participants: {
                type: "agent" | "user";
                id?: string | undefined;
                agentId?: string | null | undefined;
                userId?: string | null | undefined;
            }[];
            id?: string | undefined;
        }[];
    }, {
        mode?: "auto" | "normal" | undefined;
        commentRequired?: boolean | undefined;
        stages?: {
            type: "review" | "approval";
            id?: string | undefined;
            approvalsNeeded?: 1 | undefined;
            participants?: {
                type: "agent" | "user";
                id?: string | undefined;
                agentId?: string | null | undefined;
                userId?: string | null | undefined;
            }[] | undefined;
        }[] | undefined;
    }>>>;
    executionWorkspaceId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    executionWorkspacePreference: z.ZodNullable<z.ZodOptional<z.ZodEnum<["inherit", "shared_workspace", "isolated_workspace", "operator_branch", "reuse_existing", "agent_default"]>>>;
    executionWorkspaceSettings: z.ZodNullable<z.ZodOptional<z.ZodObject<{
        mode: z.ZodOptional<z.ZodEnum<["inherit", "shared_workspace", "isolated_workspace", "operator_branch", "reuse_existing", "agent_default"]>>;
        workspaceStrategy: z.ZodNullable<z.ZodOptional<z.ZodObject<{
            type: z.ZodOptional<z.ZodEnum<["project_primary", "git_worktree", "adapter_managed", "cloud_sandbox"]>>;
            baseRef: z.ZodNullable<z.ZodOptional<z.ZodString>>;
            branchTemplate: z.ZodNullable<z.ZodOptional<z.ZodString>>;
            worktreeParentDir: z.ZodNullable<z.ZodOptional<z.ZodString>>;
            provisionCommand: z.ZodNullable<z.ZodOptional<z.ZodString>>;
            teardownCommand: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        }, "strict", z.ZodTypeAny, {
            type?: "project_primary" | "git_worktree" | "adapter_managed" | "cloud_sandbox" | undefined;
            provisionCommand?: string | null | undefined;
            teardownCommand?: string | null | undefined;
            baseRef?: string | null | undefined;
            branchTemplate?: string | null | undefined;
            worktreeParentDir?: string | null | undefined;
        }, {
            type?: "project_primary" | "git_worktree" | "adapter_managed" | "cloud_sandbox" | undefined;
            provisionCommand?: string | null | undefined;
            teardownCommand?: string | null | undefined;
            baseRef?: string | null | undefined;
            branchTemplate?: string | null | undefined;
            worktreeParentDir?: string | null | undefined;
        }>>>;
        workspaceRuntime: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    }, "strict", z.ZodTypeAny, {
        workspaceRuntime?: Record<string, unknown> | null | undefined;
        mode?: "shared_workspace" | "isolated_workspace" | "operator_branch" | "inherit" | "reuse_existing" | "agent_default" | undefined;
        workspaceStrategy?: {
            type?: "project_primary" | "git_worktree" | "adapter_managed" | "cloud_sandbox" | undefined;
            provisionCommand?: string | null | undefined;
            teardownCommand?: string | null | undefined;
            baseRef?: string | null | undefined;
            branchTemplate?: string | null | undefined;
            worktreeParentDir?: string | null | undefined;
        } | null | undefined;
    }, {
        workspaceRuntime?: Record<string, unknown> | null | undefined;
        mode?: "shared_workspace" | "isolated_workspace" | "operator_branch" | "inherit" | "reuse_existing" | "agent_default" | undefined;
        workspaceStrategy?: {
            type?: "project_primary" | "git_worktree" | "adapter_managed" | "cloud_sandbox" | undefined;
            provisionCommand?: string | null | undefined;
            teardownCommand?: string | null | undefined;
            baseRef?: string | null | undefined;
            branchTemplate?: string | null | undefined;
            worktreeParentDir?: string | null | undefined;
        } | null | undefined;
    }>>>;
    labelIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    status: "backlog" | "todo" | "in_progress" | "in_review" | "done" | "blocked" | "cancelled" | "awaiting_clarification";
    title: string;
    priority: "critical" | "high" | "medium" | "low";
    requestDepth: number;
    description?: string | null | undefined;
    projectId?: string | null | undefined;
    projectWorkspaceId?: string | null | undefined;
    executionWorkspaceId?: string | null | undefined;
    goalId?: string | null | undefined;
    parentId?: string | null | undefined;
    blockedByIssueIds?: string[] | undefined;
    inheritExecutionWorkspaceFromIssueId?: string | null | undefined;
    assigneeAgentId?: string | null | undefined;
    assigneeUserId?: string | null | undefined;
    billingCode?: string | null | undefined;
    assigneeAdapterOverrides?: {
        adapterConfig?: Record<string, unknown> | undefined;
        useProjectWorkspace?: boolean | undefined;
    } | null | undefined;
    executionPolicy?: {
        mode: "auto" | "normal";
        commentRequired: boolean;
        stages: {
            type: "review" | "approval";
            approvalsNeeded: 1;
            participants: {
                type: "agent" | "user";
                id?: string | undefined;
                agentId?: string | null | undefined;
                userId?: string | null | undefined;
            }[];
            id?: string | undefined;
        }[];
    } | null | undefined;
    executionWorkspacePreference?: "shared_workspace" | "isolated_workspace" | "operator_branch" | "inherit" | "reuse_existing" | "agent_default" | null | undefined;
    executionWorkspaceSettings?: {
        workspaceRuntime?: Record<string, unknown> | null | undefined;
        mode?: "shared_workspace" | "isolated_workspace" | "operator_branch" | "inherit" | "reuse_existing" | "agent_default" | undefined;
        workspaceStrategy?: {
            type?: "project_primary" | "git_worktree" | "adapter_managed" | "cloud_sandbox" | undefined;
            provisionCommand?: string | null | undefined;
            teardownCommand?: string | null | undefined;
            baseRef?: string | null | undefined;
            branchTemplate?: string | null | undefined;
            worktreeParentDir?: string | null | undefined;
        } | null | undefined;
    } | null | undefined;
    labelIds?: string[] | undefined;
}, {
    title: string;
    status?: "backlog" | "todo" | "in_progress" | "in_review" | "done" | "blocked" | "cancelled" | "awaiting_clarification" | undefined;
    description?: string | null | undefined;
    projectId?: string | null | undefined;
    projectWorkspaceId?: string | null | undefined;
    executionWorkspaceId?: string | null | undefined;
    goalId?: string | null | undefined;
    parentId?: string | null | undefined;
    blockedByIssueIds?: string[] | undefined;
    inheritExecutionWorkspaceFromIssueId?: string | null | undefined;
    priority?: "critical" | "high" | "medium" | "low" | undefined;
    assigneeAgentId?: string | null | undefined;
    assigneeUserId?: string | null | undefined;
    requestDepth?: number | undefined;
    billingCode?: string | null | undefined;
    assigneeAdapterOverrides?: {
        adapterConfig?: Record<string, unknown> | undefined;
        useProjectWorkspace?: boolean | undefined;
    } | null | undefined;
    executionPolicy?: {
        mode?: "auto" | "normal" | undefined;
        commentRequired?: boolean | undefined;
        stages?: {
            type: "review" | "approval";
            id?: string | undefined;
            approvalsNeeded?: 1 | undefined;
            participants?: {
                type: "agent" | "user";
                id?: string | undefined;
                agentId?: string | null | undefined;
                userId?: string | null | undefined;
            }[] | undefined;
        }[] | undefined;
    } | null | undefined;
    executionWorkspacePreference?: "shared_workspace" | "isolated_workspace" | "operator_branch" | "inherit" | "reuse_existing" | "agent_default" | null | undefined;
    executionWorkspaceSettings?: {
        workspaceRuntime?: Record<string, unknown> | null | undefined;
        mode?: "shared_workspace" | "isolated_workspace" | "operator_branch" | "inherit" | "reuse_existing" | "agent_default" | undefined;
        workspaceStrategy?: {
            type?: "project_primary" | "git_worktree" | "adapter_managed" | "cloud_sandbox" | undefined;
            provisionCommand?: string | null | undefined;
            teardownCommand?: string | null | undefined;
            baseRef?: string | null | undefined;
            branchTemplate?: string | null | undefined;
            worktreeParentDir?: string | null | undefined;
        } | null | undefined;
    } | null | undefined;
    labelIds?: string[] | undefined;
}>;
export type CreateIssue = z.infer<typeof createIssueSchema>;
export declare const createIssueLabelSchema: z.ZodObject<{
    name: z.ZodString;
    color: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    color: string;
}, {
    name: string;
    color: string;
}>;
export type CreateIssueLabel = z.infer<typeof createIssueLabelSchema>;
export declare const updateIssueSchema: z.ZodObject<{
    projectId: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    projectWorkspaceId: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    goalId: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    parentId: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    blockedByIssueIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    inheritExecutionWorkspaceFromIssueId: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    status: z.ZodOptional<z.ZodDefault<z.ZodOptional<z.ZodEnum<["backlog", "todo", "in_progress", "in_review", "done", "blocked", "cancelled", "awaiting_clarification"]>>>>;
    priority: z.ZodOptional<z.ZodDefault<z.ZodOptional<z.ZodEnum<["critical", "high", "medium", "low"]>>>>;
    assigneeUserId: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    requestDepth: z.ZodOptional<z.ZodDefault<z.ZodOptional<z.ZodNumber>>>;
    billingCode: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    assigneeAdapterOverrides: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodObject<{
        adapterConfig: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        useProjectWorkspace: z.ZodOptional<z.ZodBoolean>;
    }, "strict", z.ZodTypeAny, {
        adapterConfig?: Record<string, unknown> | undefined;
        useProjectWorkspace?: boolean | undefined;
    }, {
        adapterConfig?: Record<string, unknown> | undefined;
        useProjectWorkspace?: boolean | undefined;
    }>>>>;
    executionPolicy: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodObject<{
        mode: z.ZodDefault<z.ZodOptional<z.ZodEnum<["normal", "auto"]>>>;
        commentRequired: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        stages: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            type: z.ZodEnum<["review", "approval"]>;
            approvalsNeeded: z.ZodDefault<z.ZodOptional<z.ZodLiteral<1>>>;
            participants: z.ZodDefault<z.ZodArray<z.ZodEffects<z.ZodObject<{
                type: z.ZodEnum<["agent", "user"]>;
                agentId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
                userId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
            } & {
                id: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                type: "agent" | "user";
                id?: string | undefined;
                agentId?: string | null | undefined;
                userId?: string | null | undefined;
            }, {
                type: "agent" | "user";
                id?: string | undefined;
                agentId?: string | null | undefined;
                userId?: string | null | undefined;
            }>, {
                type: "agent" | "user";
                id?: string | undefined;
                agentId?: string | null | undefined;
                userId?: string | null | undefined;
            }, {
                type: "agent" | "user";
                id?: string | undefined;
                agentId?: string | null | undefined;
                userId?: string | null | undefined;
            }>, "many">>;
        }, "strip", z.ZodTypeAny, {
            type: "review" | "approval";
            approvalsNeeded: 1;
            participants: {
                type: "agent" | "user";
                id?: string | undefined;
                agentId?: string | null | undefined;
                userId?: string | null | undefined;
            }[];
            id?: string | undefined;
        }, {
            type: "review" | "approval";
            id?: string | undefined;
            approvalsNeeded?: 1 | undefined;
            participants?: {
                type: "agent" | "user";
                id?: string | undefined;
                agentId?: string | null | undefined;
                userId?: string | null | undefined;
            }[] | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        mode: "auto" | "normal";
        commentRequired: boolean;
        stages: {
            type: "review" | "approval";
            approvalsNeeded: 1;
            participants: {
                type: "agent" | "user";
                id?: string | undefined;
                agentId?: string | null | undefined;
                userId?: string | null | undefined;
            }[];
            id?: string | undefined;
        }[];
    }, {
        mode?: "auto" | "normal" | undefined;
        commentRequired?: boolean | undefined;
        stages?: {
            type: "review" | "approval";
            id?: string | undefined;
            approvalsNeeded?: 1 | undefined;
            participants?: {
                type: "agent" | "user";
                id?: string | undefined;
                agentId?: string | null | undefined;
                userId?: string | null | undefined;
            }[] | undefined;
        }[] | undefined;
    }>>>>;
    executionWorkspaceId: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    executionWorkspacePreference: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodEnum<["inherit", "shared_workspace", "isolated_workspace", "operator_branch", "reuse_existing", "agent_default"]>>>>;
    executionWorkspaceSettings: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodObject<{
        mode: z.ZodOptional<z.ZodEnum<["inherit", "shared_workspace", "isolated_workspace", "operator_branch", "reuse_existing", "agent_default"]>>;
        workspaceStrategy: z.ZodNullable<z.ZodOptional<z.ZodObject<{
            type: z.ZodOptional<z.ZodEnum<["project_primary", "git_worktree", "adapter_managed", "cloud_sandbox"]>>;
            baseRef: z.ZodNullable<z.ZodOptional<z.ZodString>>;
            branchTemplate: z.ZodNullable<z.ZodOptional<z.ZodString>>;
            worktreeParentDir: z.ZodNullable<z.ZodOptional<z.ZodString>>;
            provisionCommand: z.ZodNullable<z.ZodOptional<z.ZodString>>;
            teardownCommand: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        }, "strict", z.ZodTypeAny, {
            type?: "project_primary" | "git_worktree" | "adapter_managed" | "cloud_sandbox" | undefined;
            provisionCommand?: string | null | undefined;
            teardownCommand?: string | null | undefined;
            baseRef?: string | null | undefined;
            branchTemplate?: string | null | undefined;
            worktreeParentDir?: string | null | undefined;
        }, {
            type?: "project_primary" | "git_worktree" | "adapter_managed" | "cloud_sandbox" | undefined;
            provisionCommand?: string | null | undefined;
            teardownCommand?: string | null | undefined;
            baseRef?: string | null | undefined;
            branchTemplate?: string | null | undefined;
            worktreeParentDir?: string | null | undefined;
        }>>>;
        workspaceRuntime: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    }, "strict", z.ZodTypeAny, {
        workspaceRuntime?: Record<string, unknown> | null | undefined;
        mode?: "shared_workspace" | "isolated_workspace" | "operator_branch" | "inherit" | "reuse_existing" | "agent_default" | undefined;
        workspaceStrategy?: {
            type?: "project_primary" | "git_worktree" | "adapter_managed" | "cloud_sandbox" | undefined;
            provisionCommand?: string | null | undefined;
            teardownCommand?: string | null | undefined;
            baseRef?: string | null | undefined;
            branchTemplate?: string | null | undefined;
            worktreeParentDir?: string | null | undefined;
        } | null | undefined;
    }, {
        workspaceRuntime?: Record<string, unknown> | null | undefined;
        mode?: "shared_workspace" | "isolated_workspace" | "operator_branch" | "inherit" | "reuse_existing" | "agent_default" | undefined;
        workspaceStrategy?: {
            type?: "project_primary" | "git_worktree" | "adapter_managed" | "cloud_sandbox" | undefined;
            provisionCommand?: string | null | undefined;
            teardownCommand?: string | null | undefined;
            baseRef?: string | null | undefined;
            branchTemplate?: string | null | undefined;
            worktreeParentDir?: string | null | undefined;
        } | null | undefined;
    }>>>>;
    labelIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
} & {
    assigneeAgentId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    comment: z.ZodOptional<z.ZodString>;
    reopen: z.ZodOptional<z.ZodBoolean>;
    interrupt: z.ZodOptional<z.ZodBoolean>;
    hiddenAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    comment?: string | undefined;
    status?: "backlog" | "todo" | "in_progress" | "in_review" | "done" | "blocked" | "cancelled" | "awaiting_clarification" | undefined;
    description?: string | null | undefined;
    title?: string | undefined;
    projectId?: string | null | undefined;
    projectWorkspaceId?: string | null | undefined;
    executionWorkspaceId?: string | null | undefined;
    goalId?: string | null | undefined;
    parentId?: string | null | undefined;
    blockedByIssueIds?: string[] | undefined;
    inheritExecutionWorkspaceFromIssueId?: string | null | undefined;
    priority?: "critical" | "high" | "medium" | "low" | undefined;
    assigneeAgentId?: string | null | undefined;
    assigneeUserId?: string | null | undefined;
    requestDepth?: number | undefined;
    billingCode?: string | null | undefined;
    assigneeAdapterOverrides?: {
        adapterConfig?: Record<string, unknown> | undefined;
        useProjectWorkspace?: boolean | undefined;
    } | null | undefined;
    executionPolicy?: {
        mode: "auto" | "normal";
        commentRequired: boolean;
        stages: {
            type: "review" | "approval";
            approvalsNeeded: 1;
            participants: {
                type: "agent" | "user";
                id?: string | undefined;
                agentId?: string | null | undefined;
                userId?: string | null | undefined;
            }[];
            id?: string | undefined;
        }[];
    } | null | undefined;
    executionWorkspacePreference?: "shared_workspace" | "isolated_workspace" | "operator_branch" | "inherit" | "reuse_existing" | "agent_default" | null | undefined;
    executionWorkspaceSettings?: {
        workspaceRuntime?: Record<string, unknown> | null | undefined;
        mode?: "shared_workspace" | "isolated_workspace" | "operator_branch" | "inherit" | "reuse_existing" | "agent_default" | undefined;
        workspaceStrategy?: {
            type?: "project_primary" | "git_worktree" | "adapter_managed" | "cloud_sandbox" | undefined;
            provisionCommand?: string | null | undefined;
            teardownCommand?: string | null | undefined;
            baseRef?: string | null | undefined;
            branchTemplate?: string | null | undefined;
            worktreeParentDir?: string | null | undefined;
        } | null | undefined;
    } | null | undefined;
    labelIds?: string[] | undefined;
    reopen?: boolean | undefined;
    interrupt?: boolean | undefined;
    hiddenAt?: string | null | undefined;
}, {
    comment?: string | undefined;
    status?: "backlog" | "todo" | "in_progress" | "in_review" | "done" | "blocked" | "cancelled" | "awaiting_clarification" | undefined;
    description?: string | null | undefined;
    title?: string | undefined;
    projectId?: string | null | undefined;
    projectWorkspaceId?: string | null | undefined;
    executionWorkspaceId?: string | null | undefined;
    goalId?: string | null | undefined;
    parentId?: string | null | undefined;
    blockedByIssueIds?: string[] | undefined;
    inheritExecutionWorkspaceFromIssueId?: string | null | undefined;
    priority?: "critical" | "high" | "medium" | "low" | undefined;
    assigneeAgentId?: string | null | undefined;
    assigneeUserId?: string | null | undefined;
    requestDepth?: number | undefined;
    billingCode?: string | null | undefined;
    assigneeAdapterOverrides?: {
        adapterConfig?: Record<string, unknown> | undefined;
        useProjectWorkspace?: boolean | undefined;
    } | null | undefined;
    executionPolicy?: {
        mode?: "auto" | "normal" | undefined;
        commentRequired?: boolean | undefined;
        stages?: {
            type: "review" | "approval";
            id?: string | undefined;
            approvalsNeeded?: 1 | undefined;
            participants?: {
                type: "agent" | "user";
                id?: string | undefined;
                agentId?: string | null | undefined;
                userId?: string | null | undefined;
            }[] | undefined;
        }[] | undefined;
    } | null | undefined;
    executionWorkspacePreference?: "shared_workspace" | "isolated_workspace" | "operator_branch" | "inherit" | "reuse_existing" | "agent_default" | null | undefined;
    executionWorkspaceSettings?: {
        workspaceRuntime?: Record<string, unknown> | null | undefined;
        mode?: "shared_workspace" | "isolated_workspace" | "operator_branch" | "inherit" | "reuse_existing" | "agent_default" | undefined;
        workspaceStrategy?: {
            type?: "project_primary" | "git_worktree" | "adapter_managed" | "cloud_sandbox" | undefined;
            provisionCommand?: string | null | undefined;
            teardownCommand?: string | null | undefined;
            baseRef?: string | null | undefined;
            branchTemplate?: string | null | undefined;
            worktreeParentDir?: string | null | undefined;
        } | null | undefined;
    } | null | undefined;
    labelIds?: string[] | undefined;
    reopen?: boolean | undefined;
    interrupt?: boolean | undefined;
    hiddenAt?: string | null | undefined;
}>;
export type UpdateIssue = z.infer<typeof updateIssueSchema>;
export type IssueExecutionWorkspaceSettings = z.infer<typeof issueExecutionWorkspaceSettingsSchema>;
export declare const checkoutIssueSchema: z.ZodObject<{
    agentId: z.ZodString;
    expectedStatuses: z.ZodArray<z.ZodEnum<["backlog", "todo", "in_progress", "in_review", "done", "blocked", "cancelled", "awaiting_clarification"]>, "atleastone">;
}, "strip", z.ZodTypeAny, {
    agentId: string;
    expectedStatuses: ["backlog" | "todo" | "in_progress" | "in_review" | "done" | "blocked" | "cancelled" | "awaiting_clarification", ...("backlog" | "todo" | "in_progress" | "in_review" | "done" | "blocked" | "cancelled" | "awaiting_clarification")[]];
}, {
    agentId: string;
    expectedStatuses: ["backlog" | "todo" | "in_progress" | "in_review" | "done" | "blocked" | "cancelled" | "awaiting_clarification", ...("backlog" | "todo" | "in_progress" | "in_review" | "done" | "blocked" | "cancelled" | "awaiting_clarification")[]];
}>;
export type CheckoutIssue = z.infer<typeof checkoutIssueSchema>;
export declare const addIssueCommentSchema: z.ZodObject<{
    body: z.ZodString;
    reopen: z.ZodOptional<z.ZodBoolean>;
    interrupt: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    body: string;
    reopen?: boolean | undefined;
    interrupt?: boolean | undefined;
}, {
    body: string;
    reopen?: boolean | undefined;
    interrupt?: boolean | undefined;
}>;
export type AddIssueComment = z.infer<typeof addIssueCommentSchema>;
export declare const linkIssueApprovalSchema: z.ZodObject<{
    approvalId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    approvalId: string;
}, {
    approvalId: string;
}>;
export type LinkIssueApproval = z.infer<typeof linkIssueApprovalSchema>;
export declare const createIssueAttachmentMetadataSchema: z.ZodObject<{
    issueCommentId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    issueCommentId?: string | null | undefined;
}, {
    issueCommentId?: string | null | undefined;
}>;
export type CreateIssueAttachmentMetadata = z.infer<typeof createIssueAttachmentMetadataSchema>;
export declare const ISSUE_DOCUMENT_FORMATS: readonly ["markdown"];
export declare const issueDocumentFormatSchema: z.ZodEnum<["markdown"]>;
export declare const issueDocumentKeySchema: z.ZodString;
export declare const upsertIssueDocumentSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    format: z.ZodEnum<["markdown"]>;
    body: z.ZodString;
    changeSummary: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    baseRevisionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    body: string;
    format: "markdown";
    title?: string | null | undefined;
    changeSummary?: string | null | undefined;
    baseRevisionId?: string | null | undefined;
}, {
    body: string;
    format: "markdown";
    title?: string | null | undefined;
    changeSummary?: string | null | undefined;
    baseRevisionId?: string | null | undefined;
}>;
export declare const restoreIssueDocumentRevisionSchema: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
export type IssueDocumentFormat = z.infer<typeof issueDocumentFormatSchema>;
export type UpsertIssueDocument = z.infer<typeof upsertIssueDocumentSchema>;
export type RestoreIssueDocumentRevision = z.infer<typeof restoreIssueDocumentRevisionSchema>;
//# sourceMappingURL=issue.d.ts.map
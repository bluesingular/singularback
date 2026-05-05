import type { Db } from "@paperclipai/db";
import type { CreateRoutine, CreateRoutineTrigger, Routine, RoutineDetail, RoutineListItem, RoutineRunSummary, RoutineTrigger, RoutineTriggerSecretMaterial, RoutineVariable, RunRoutine, UpdateRoutine, UpdateRoutineTrigger } from "@paperclipai/shared";
import { type IssueAssignmentWakeupDeps } from "./issue-assignment-wakeup.js";
type Actor = {
    agentId?: string | null;
    userId?: string | null;
};
export declare function routineService(db: Db, deps?: {
    heartbeat?: IssueAssignmentWakeupDeps;
}): {
    get: (id: string) => Promise<{
        id: string;
        description: string | null;
        status: string;
        createdAt: Date;
        updatedAt: Date;
        companyId: string;
        title: string;
        createdByAgentId: string | null;
        createdByUserId: string | null;
        updatedByUserId: string | null;
        updatedByAgentId: string | null;
        projectId: string | null;
        goalId: string | null;
        priority: string;
        assigneeAgentId: string | null;
        parentIssueId: string | null;
        concurrencyPolicy: string;
        catchUpPolicy: string;
        variables: RoutineVariable[];
        lastTriggeredAt: Date | null;
        lastEnqueuedAt: Date | null;
    }>;
    getTrigger: (id: string) => Promise<{
        id: string;
        timezone: string | null;
        createdAt: Date;
        updatedAt: Date;
        companyId: string;
        createdByAgentId: string | null;
        createdByUserId: string | null;
        updatedByUserId: string | null;
        kind: string;
        label: string | null;
        routineId: string;
        enabled: boolean;
        cronExpression: string | null;
        nextRunAt: Date | null;
        lastFiredAt: Date | null;
        publicId: string | null;
        secretId: string | null;
        signingMode: string | null;
        replayWindowSec: number | null;
        lastRotatedAt: Date | null;
        lastResult: string | null;
        updatedByAgentId: string | null;
    }>;
    list: (companyId: string) => Promise<RoutineListItem[]>;
    getDetail: (id: string) => Promise<RoutineDetail | null>;
    create: (companyId: string, input: CreateRoutine, actor: Actor) => Promise<Routine>;
    update: (id: string, patch: UpdateRoutine, actor: Actor) => Promise<Routine | null>;
    createTrigger: (routineId: string, input: CreateRoutineTrigger, actor: Actor) => Promise<{
        trigger: RoutineTrigger;
        secretMaterial: RoutineTriggerSecretMaterial | null;
    }>;
    updateTrigger: (id: string, patch: UpdateRoutineTrigger, actor: Actor) => Promise<RoutineTrigger | null>;
    deleteTrigger: (id: string) => Promise<boolean>;
    rotateTriggerSecret: (id: string, actor: Actor) => Promise<{
        trigger: RoutineTrigger;
        secretMaterial: RoutineTriggerSecretMaterial;
    }>;
    runRoutine: (id: string, input: RunRoutine) => Promise<{
        id: string;
        companyId: string;
        routineId: string;
        triggerId: string | null;
        source: string;
        status: string;
        triggeredAt: Date;
        idempotencyKey: string | null;
        triggerPayload: Record<string, unknown> | null;
        linkedIssueId: string | null;
        coalescedIntoRunId: string | null;
        failureReason: string | null;
        completedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    firePublicTrigger: (publicId: string, input: {
        authorizationHeader?: string | null;
        signatureHeader?: string | null;
        hubSignatureHeader?: string | null;
        timestampHeader?: string | null;
        idempotencyKey?: string | null;
        rawBody?: Buffer | null;
        payload?: Record<string, unknown> | null;
    }) => Promise<{
        id: string;
        companyId: string;
        routineId: string;
        triggerId: string | null;
        source: string;
        status: string;
        triggeredAt: Date;
        idempotencyKey: string | null;
        triggerPayload: Record<string, unknown> | null;
        linkedIssueId: string | null;
        coalescedIntoRunId: string | null;
        failureReason: string | null;
        completedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    listRuns: (routineId: string, limit?: number) => Promise<RoutineRunSummary[]>;
    tickScheduledTriggers: (now?: Date) => Promise<{
        triggered: number;
    }>;
    syncRunStatusForIssue: (issueId: string) => Promise<{
        id: string;
        companyId: string;
        routineId: string;
        triggerId: string | null;
        source: string;
        status: string;
        triggeredAt: Date;
        idempotencyKey: string | null;
        triggerPayload: Record<string, unknown> | null;
        linkedIssueId: string | null;
        coalescedIntoRunId: string | null;
        failureReason: string | null;
        completedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
};
export {};
//# sourceMappingURL=routines.d.ts.map
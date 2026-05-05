import type { Db } from "@paperclipai/db";
import { issues, labels } from "@paperclipai/db";
import type { IssueRelationIssueSummary } from "@paperclipai/shared";
export interface IssueFilters {
    status?: string;
    assigneeAgentId?: string;
    participantAgentId?: string;
    assigneeUserId?: string;
    touchedByUserId?: string;
    inboxArchivedByUserId?: string;
    unreadForUserId?: string;
    projectId?: string;
    executionWorkspaceId?: string;
    parentId?: string;
    labelId?: string;
    originKind?: string;
    originId?: string;
    includeRoutineExecutions?: boolean;
    excludeRoutineExecutions?: boolean;
    q?: string;
    limit?: number;
}
type IssueRow = typeof issues.$inferSelect;
type IssueLabelRow = typeof labels.$inferSelect;
type IssueActiveRunRow = {
    id: string;
    status: string;
    agentId: string;
    invocationSource: string;
    triggerDetail: string | null;
    startedAt: Date | null;
    finishedAt: Date | null;
    createdAt: Date;
};
type IssueWithLabels = IssueRow & {
    labels: IssueLabelRow[];
    labelIds: string[];
};
type IssueWithLabelsAndRun = IssueWithLabels & {
    activeRun: IssueActiveRunRow | null;
};
type IssueUserContextInput = {
    createdByUserId: string | null;
    assigneeUserId: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
};
type IssueCreateInput = Omit<typeof issues.$inferInsert, "companyId"> & {
    labelIds?: string[];
    blockedByIssueIds?: string[];
    inheritExecutionWorkspaceFromIssueId?: string | null;
};
type IssueRelationSummaryMap = {
    blockedBy: IssueRelationIssueSummary[];
    blocks: IssueRelationIssueSummary[];
};
/** Decodes HTML character references in a raw @mention capture so UI-encoded bodies match agent names. */
export declare function normalizeAgentMentionToken(raw: string): string;
export declare function deriveIssueUserContext(issue: IssueUserContextInput, userId: string, stats: {
    myLastCommentAt: Date | string | null;
    myLastReadAt: Date | string | null;
    lastExternalCommentAt: Date | string | null;
} | null | undefined): {
    myLastTouchAt: Date;
    lastExternalCommentAt: Date | null;
    isUnreadForMe: boolean;
};
export declare function issueService(db: Db): {
    clearExecutionRunIfTerminal: (issueId: string) => Promise<boolean>;
    list: (companyId: string, filters?: IssueFilters) => Promise<IssueWithLabelsAndRun[]>;
    countUnreadTouchedByUser: (companyId: string, userId: string, status?: string) => Promise<number>;
    markRead: (companyId: string, issueId: string, userId: string, readAt?: Date) => Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        companyId: string;
        userId: string;
        issueId: string;
        lastReadAt: Date;
    }>;
    markUnread: (companyId: string, issueId: string, userId: string) => Promise<boolean>;
    archiveInbox: (companyId: string, issueId: string, userId: string, archivedAt?: Date) => Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        companyId: string;
        userId: string;
        issueId: string;
        archivedAt: Date;
    }>;
    unarchiveInbox: (companyId: string, issueId: string, userId: string) => Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        companyId: string;
        userId: string;
        issueId: string;
        archivedAt: Date;
    }>;
    getById: (raw: string) => Promise<IssueWithLabels | null>;
    getByIdentifier: (identifier: string) => Promise<IssueWithLabels | null>;
    getRelationSummaries: (issueId: string) => Promise<IssueRelationSummaryMap>;
    listWakeableBlockedDependents: (blockerIssueId: string) => Promise<{
        id: string;
        assigneeAgentId: string;
        blockerIssueIds: string[];
    }[]>;
    getWakeableParentAfterChildCompletion: (parentIssueId: string) => Promise<{
        id: string;
        assigneeAgentId: string;
        childIssueIds: string[];
    } | null>;
    create: (companyId: string, data: IssueCreateInput) => Promise<IssueWithLabels>;
    update: (id: string, data: Partial<typeof issues.$inferInsert> & {
        labelIds?: string[];
        blockedByIssueIds?: string[];
        actorAgentId?: string | null;
        actorUserId?: string | null;
    }, dbOrTx?: any) => Promise<IssueWithLabels | null>;
    remove: (id: string) => Promise<IssueWithLabels | null>;
    checkout: (id: string, agentId: string, expectedStatuses: string[], checkoutRunId: string | null) => Promise<{
        id: string;
        companyId: string;
        projectId: string | null;
        projectWorkspaceId: string | null;
        goalId: string | null;
        parentId: string | null;
        title: string;
        description: string | null;
        status: string;
        priority: string;
        assigneeAgentId: string | null;
        assigneeUserId: string | null;
        checkoutRunId: string | null;
        executionRunId: string | null;
        executionAgentNameKey: string | null;
        executionLockedAt: Date | null;
        createdByAgentId: string | null;
        createdByUserId: string | null;
        issueNumber: number | null;
        identifier: string | null;
        originKind: string;
        originId: string | null;
        originRunId: string | null;
        requestDepth: number;
        billingCode: string | null;
        assigneeAdapterOverrides: Record<string, unknown> | null;
        executionPolicy: Record<string, unknown> | null;
        executionState: Record<string, unknown> | null;
        executionWorkspaceId: string | null;
        executionWorkspacePreference: string | null;
        executionWorkspaceSettings: Record<string, unknown> | null;
        startedAt: Date | null;
        completedAt: Date | null;
        cancelledAt: Date | null;
        hiddenAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    assertCheckoutOwner: (id: string, actorAgentId: string, actorRunId: string | null) => Promise<{
        adoptedFromRunId: string | null;
        id: string;
        status: string;
        assigneeAgentId: string | null;
        checkoutRunId: string | null;
        executionRunId: string | null;
    }>;
    release: (id: string, actorAgentId?: string, actorRunId?: string | null) => Promise<IssueWithLabels | null>;
    adminForceRelease: (id: string, options?: {
        clearAssignee?: boolean;
    }) => Promise<{
        issue: IssueWithLabels;
        previous: {
            checkoutRunId: string | null;
            executionRunId: string | null;
        };
    } | null>;
    listLabels: (companyId: string) => Omit<import("drizzle-orm/pg-core").PgSelectBase<"labels", {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "labels";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        companyId: import("drizzle-orm/pg-core").PgColumn<{
            name: "company_id";
            tableName: "labels";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        name: import("drizzle-orm/pg-core").PgColumn<{
            name: "name";
            tableName: "labels";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        color: import("drizzle-orm/pg-core").PgColumn<{
            name: "color";
            tableName: "labels";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "labels";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        updatedAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "updated_at";
            tableName: "labels";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    }, "single", Record<"labels", "not-null">, false, "where" | "orderBy", {
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        companyId: string;
        color: string;
    }[], {
        id: import("drizzle-orm/pg-core").PgColumn<{
            name: "id";
            tableName: "labels";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: true;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        companyId: import("drizzle-orm/pg-core").PgColumn<{
            name: "company_id";
            tableName: "labels";
            dataType: "string";
            columnType: "PgUUID";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        name: import("drizzle-orm/pg-core").PgColumn<{
            name: "name";
            tableName: "labels";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        color: import("drizzle-orm/pg-core").PgColumn<{
            name: "color";
            tableName: "labels";
            dataType: "string";
            columnType: "PgText";
            data: string;
            driverParam: string;
            notNull: true;
            hasDefault: false;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        createdAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "created_at";
            tableName: "labels";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
        updatedAt: import("drizzle-orm/pg-core").PgColumn<{
            name: "updated_at";
            tableName: "labels";
            dataType: "date";
            columnType: "PgTimestamp";
            data: Date;
            driverParam: string;
            notNull: true;
            hasDefault: true;
            isPrimaryKey: false;
            isAutoincrement: false;
            hasRuntimeDefault: false;
            enumValues: undefined;
            baseColumn: never;
            identity: undefined;
            generated: undefined;
        }, {}, {}>;
    }>, "where" | "orderBy">;
    getLabelById: (id: string) => Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        companyId: string;
        color: string;
    }>;
    createLabel: (companyId: string, data: Pick<typeof labels.$inferInsert, "name" | "color">) => Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        companyId: string;
        color: string;
    }>;
    deleteLabel: (id: string) => Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        companyId: string;
        color: string;
    }>;
    listComments: (issueId: string, opts?: {
        afterCommentId?: string | null;
        order?: "asc" | "desc";
        limit?: number | null;
    }) => Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        companyId: string;
        issueId: string;
        body: string;
        createdByRunId: string | null;
        authorAgentId: string | null;
        authorUserId: string | null;
    }[]>;
    getCommentCursor: (issueId: string) => Promise<{
        totalComments: number;
        latestCommentId: string;
        latestCommentAt: Date;
    }>;
    getComment: (commentId: string) => Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        companyId: string;
        issueId: string;
        body: string;
        createdByRunId: string | null;
        authorAgentId: string | null;
        authorUserId: string | null;
    } | null>;
    removeComment: (commentId: string) => Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        companyId: string;
        issueId: string;
        body: string;
        createdByRunId: string | null;
        authorAgentId: string | null;
        authorUserId: string | null;
    } | null>;
    addComment: (issueId: string, body: string, actor: {
        agentId?: string;
        userId?: string;
        runId?: string | null;
    }) => Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        companyId: string;
        issueId: string;
        body: string;
        createdByRunId: string | null;
        authorAgentId: string | null;
        authorUserId: string | null;
    }>;
    createAttachment: (input: {
        issueId: string;
        issueCommentId?: string | null;
        provider: string;
        objectKey: string;
        contentType: string;
        byteSize: number;
        sha256: string;
        originalFilename?: string | null;
        createdByAgentId?: string | null;
        createdByUserId?: string | null;
    }) => Promise<{
        id: string;
        companyId: string;
        issueId: string;
        issueCommentId: string | null;
        assetId: string;
        provider: string;
        objectKey: string;
        contentType: string;
        byteSize: number;
        sha256: string;
        originalFilename: string | null;
        createdByAgentId: string | null;
        createdByUserId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    listAttachments: (issueId: string) => Promise<{
        id: string;
        companyId: string;
        issueId: string;
        issueCommentId: string | null;
        assetId: string;
        provider: string;
        objectKey: string;
        contentType: string;
        byteSize: number;
        sha256: string;
        originalFilename: string | null;
        createdByAgentId: string | null;
        createdByUserId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    getAttachmentById: (id: string) => Promise<{
        id: string;
        companyId: string;
        issueId: string;
        issueCommentId: string | null;
        assetId: string;
        provider: string;
        objectKey: string;
        contentType: string;
        byteSize: number;
        sha256: string;
        originalFilename: string | null;
        createdByAgentId: string | null;
        createdByUserId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    removeAttachment: (id: string) => Promise<{
        id: string;
        companyId: string;
        issueId: string;
        issueCommentId: string | null;
        assetId: string;
        provider: string;
        objectKey: string;
        contentType: string;
        byteSize: number;
        sha256: string;
        originalFilename: string | null;
        createdByAgentId: string | null;
        createdByUserId: string | null;
        createdAt: Date;
        updatedAt: Date;
    } | null>;
    findMentionedAgents: (companyId: string, body: string) => Promise<string[]>;
    findMentionedProjectIds: (issueId: string, opts?: {
        includeCommentBodies?: boolean;
    }) => Promise<string[]>;
    getAncestors: (issueId: string) => Promise<{
        project: {
            id: string;
            name: string;
            description: string | null;
            status: string;
            goalId: string | null;
            workspaces: Array<{
                id: string;
                companyId: string;
                projectId: string;
                name: string;
                cwd: string | null;
                repoUrl: string | null;
                repoRef: string | null;
                metadata: Record<string, unknown> | null;
                isPrimary: boolean;
                createdAt: Date;
                updatedAt: Date;
            }>;
            primaryWorkspace: {
                id: string;
                companyId: string;
                projectId: string;
                name: string;
                cwd: string | null;
                repoUrl: string | null;
                repoRef: string | null;
                metadata: Record<string, unknown> | null;
                isPrimary: boolean;
                createdAt: Date;
                updatedAt: Date;
            } | null;
        } | null;
        goal: {
            id: string;
            title: string;
            description: string | null;
            level: string;
            status: string;
        } | null;
        id: string;
        identifier: string | null;
        title: string;
        description: string | null;
        status: string;
        priority: string;
        assigneeAgentId: string | null;
        projectId: string | null;
        goalId: string | null;
    }[]>;
};
export {};
//# sourceMappingURL=issues.d.ts.map
import type { Db } from "@paperclipai/db";
import type { StorageService } from "../storage/types.js";
export declare function issueRoutes(db: Db, storage: StorageService, opts?: {
    feedbackExportService?: {
        flushPendingFeedbackTraces(input?: {
            companyId?: string;
            traceId?: string;
            limit?: number;
            now?: Date;
        }): Promise<unknown>;
    };
}): import("express-serve-static-core").Router;
//# sourceMappingURL=issues.d.ts.map
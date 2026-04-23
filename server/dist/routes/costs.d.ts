import type { Db } from "@paperclipai/db";
export declare function parseCostDateRange(query: Record<string, unknown>): {
    from: Date | undefined;
    to: Date | undefined;
} | undefined;
export declare function parseCostLimit(query: Record<string, unknown>): number;
export declare function costRoutes(db: Db): import("express-serve-static-core").Router;
//# sourceMappingURL=costs.d.ts.map
import { z } from "zod";
export declare const environmentDriverSchema: z.ZodEnum<["local"]>;
export declare const environmentStatusSchema: z.ZodEnum<["active", "archived"]>;
export declare const environmentLeaseStatusSchema: z.ZodEnum<["active", "released", "expired", "failed"]>;
export declare const environmentLeaseCleanupStatusSchema: z.ZodEnum<["pending", "success", "failed"]>;
export declare const createEnvironmentSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    driver: z.ZodEnum<["local"]>;
    status: z.ZodDefault<z.ZodOptional<z.ZodEnum<["active", "archived"]>>>;
    config: z.ZodDefault<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    metadata: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, "strict", z.ZodTypeAny, {
    status: "active" | "archived";
    name: string;
    config: Record<string, unknown>;
    driver: "local";
    description?: string | null | undefined;
    metadata?: Record<string, unknown> | null | undefined;
}, {
    name: string;
    driver: "local";
    status?: "active" | "archived" | undefined;
    description?: string | null | undefined;
    config?: Record<string, unknown> | undefined;
    metadata?: Record<string, unknown> | null | undefined;
}>;
export type CreateEnvironment = z.infer<typeof createEnvironmentSchema>;
export declare const updateEnvironmentSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    driver: z.ZodOptional<z.ZodEnum<["local"]>>;
    status: z.ZodOptional<z.ZodEnum<["active", "archived"]>>;
    config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    metadata: z.ZodNullable<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, "strict", z.ZodTypeAny, {
    status?: "active" | "archived" | undefined;
    description?: string | null | undefined;
    name?: string | undefined;
    config?: Record<string, unknown> | undefined;
    metadata?: Record<string, unknown> | null | undefined;
    driver?: "local" | undefined;
}, {
    status?: "active" | "archived" | undefined;
    description?: string | null | undefined;
    name?: string | undefined;
    config?: Record<string, unknown> | undefined;
    metadata?: Record<string, unknown> | null | undefined;
    driver?: "local" | undefined;
}>;
export type UpdateEnvironment = z.infer<typeof updateEnvironmentSchema>;
//# sourceMappingURL=environment.d.ts.map
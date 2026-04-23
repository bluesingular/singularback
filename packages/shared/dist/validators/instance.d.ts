import { z } from "zod";
export declare const backupRetentionPolicySchema: z.ZodObject<{
    dailyDays: z.ZodDefault<z.ZodEffects<z.ZodNumber, 3 | 7 | 14, number>>;
    weeklyWeeks: z.ZodDefault<z.ZodEffects<z.ZodNumber, 2 | 4 | 1, number>>;
    monthlyMonths: z.ZodDefault<z.ZodEffects<z.ZodNumber, 3 | 6 | 1, number>>;
}, "strip", z.ZodTypeAny, {
    dailyDays: 3 | 7 | 14;
    weeklyWeeks: 2 | 4 | 1;
    monthlyMonths: 3 | 6 | 1;
}, {
    dailyDays?: number | undefined;
    weeklyWeeks?: number | undefined;
    monthlyMonths?: number | undefined;
}>;
export declare const instanceGeneralSettingsSchema: z.ZodObject<{
    censorUsernameInLogs: z.ZodDefault<z.ZodBoolean>;
    keyboardShortcuts: z.ZodDefault<z.ZodBoolean>;
    feedbackDataSharingPreference: z.ZodDefault<z.ZodEnum<["allowed", "not_allowed", "prompt"]>>;
    backupRetention: z.ZodDefault<z.ZodObject<{
        dailyDays: z.ZodDefault<z.ZodEffects<z.ZodNumber, 3 | 7 | 14, number>>;
        weeklyWeeks: z.ZodDefault<z.ZodEffects<z.ZodNumber, 2 | 4 | 1, number>>;
        monthlyMonths: z.ZodDefault<z.ZodEffects<z.ZodNumber, 3 | 6 | 1, number>>;
    }, "strip", z.ZodTypeAny, {
        dailyDays: 3 | 7 | 14;
        weeklyWeeks: 2 | 4 | 1;
        monthlyMonths: 3 | 6 | 1;
    }, {
        dailyDays?: number | undefined;
        weeklyWeeks?: number | undefined;
        monthlyMonths?: number | undefined;
    }>>;
}, "strict", z.ZodTypeAny, {
    censorUsernameInLogs: boolean;
    keyboardShortcuts: boolean;
    feedbackDataSharingPreference: "allowed" | "not_allowed" | "prompt";
    backupRetention: {
        dailyDays: 3 | 7 | 14;
        weeklyWeeks: 2 | 4 | 1;
        monthlyMonths: 3 | 6 | 1;
    };
}, {
    censorUsernameInLogs?: boolean | undefined;
    keyboardShortcuts?: boolean | undefined;
    feedbackDataSharingPreference?: "allowed" | "not_allowed" | "prompt" | undefined;
    backupRetention?: {
        dailyDays?: number | undefined;
        weeklyWeeks?: number | undefined;
        monthlyMonths?: number | undefined;
    } | undefined;
}>;
export declare const patchInstanceGeneralSettingsSchema: z.ZodObject<{
    censorUsernameInLogs: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    keyboardShortcuts: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    feedbackDataSharingPreference: z.ZodOptional<z.ZodDefault<z.ZodEnum<["allowed", "not_allowed", "prompt"]>>>;
    backupRetention: z.ZodOptional<z.ZodDefault<z.ZodObject<{
        dailyDays: z.ZodDefault<z.ZodEffects<z.ZodNumber, 3 | 7 | 14, number>>;
        weeklyWeeks: z.ZodDefault<z.ZodEffects<z.ZodNumber, 2 | 4 | 1, number>>;
        monthlyMonths: z.ZodDefault<z.ZodEffects<z.ZodNumber, 3 | 6 | 1, number>>;
    }, "strip", z.ZodTypeAny, {
        dailyDays: 3 | 7 | 14;
        weeklyWeeks: 2 | 4 | 1;
        monthlyMonths: 3 | 6 | 1;
    }, {
        dailyDays?: number | undefined;
        weeklyWeeks?: number | undefined;
        monthlyMonths?: number | undefined;
    }>>>;
}, "strict", z.ZodTypeAny, {
    censorUsernameInLogs?: boolean | undefined;
    keyboardShortcuts?: boolean | undefined;
    feedbackDataSharingPreference?: "allowed" | "not_allowed" | "prompt" | undefined;
    backupRetention?: {
        dailyDays: 3 | 7 | 14;
        weeklyWeeks: 2 | 4 | 1;
        monthlyMonths: 3 | 6 | 1;
    } | undefined;
}, {
    censorUsernameInLogs?: boolean | undefined;
    keyboardShortcuts?: boolean | undefined;
    feedbackDataSharingPreference?: "allowed" | "not_allowed" | "prompt" | undefined;
    backupRetention?: {
        dailyDays?: number | undefined;
        weeklyWeeks?: number | undefined;
        monthlyMonths?: number | undefined;
    } | undefined;
}>;
export declare const instanceExperimentalSettingsSchema: z.ZodObject<{
    enableIsolatedWorkspaces: z.ZodDefault<z.ZodBoolean>;
    autoRestartDevServerWhenIdle: z.ZodDefault<z.ZodBoolean>;
}, "strict", z.ZodTypeAny, {
    enableIsolatedWorkspaces: boolean;
    autoRestartDevServerWhenIdle: boolean;
}, {
    enableIsolatedWorkspaces?: boolean | undefined;
    autoRestartDevServerWhenIdle?: boolean | undefined;
}>;
export declare const patchInstanceExperimentalSettingsSchema: z.ZodObject<{
    enableIsolatedWorkspaces: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    autoRestartDevServerWhenIdle: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
}, "strict", z.ZodTypeAny, {
    enableIsolatedWorkspaces?: boolean | undefined;
    autoRestartDevServerWhenIdle?: boolean | undefined;
}, {
    enableIsolatedWorkspaces?: boolean | undefined;
    autoRestartDevServerWhenIdle?: boolean | undefined;
}>;
export type InstanceGeneralSettings = z.infer<typeof instanceGeneralSettingsSchema>;
export type PatchInstanceGeneralSettings = z.infer<typeof patchInstanceGeneralSettingsSchema>;
export type InstanceExperimentalSettings = z.infer<typeof instanceExperimentalSettingsSchema>;
export type PatchInstanceExperimentalSettings = z.infer<typeof patchInstanceExperimentalSettingsSchema>;
//# sourceMappingURL=instance.d.ts.map
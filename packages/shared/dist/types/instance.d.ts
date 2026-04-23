import type { FeedbackDataSharingPreference } from "./feedback.js";
export declare const DAILY_RETENTION_PRESETS: readonly [3, 7, 14];
export declare const WEEKLY_RETENTION_PRESETS: readonly [1, 2, 4];
export declare const MONTHLY_RETENTION_PRESETS: readonly [1, 3, 6];
export interface BackupRetentionPolicy {
    dailyDays: (typeof DAILY_RETENTION_PRESETS)[number];
    weeklyWeeks: (typeof WEEKLY_RETENTION_PRESETS)[number];
    monthlyMonths: (typeof MONTHLY_RETENTION_PRESETS)[number];
}
export declare const DEFAULT_BACKUP_RETENTION: BackupRetentionPolicy;
export interface InstanceGeneralSettings {
    censorUsernameInLogs: boolean;
    keyboardShortcuts: boolean;
    feedbackDataSharingPreference: FeedbackDataSharingPreference;
    backupRetention: BackupRetentionPolicy;
}
export interface InstanceExperimentalSettings {
    enableIsolatedWorkspaces: boolean;
    autoRestartDevServerWhenIdle: boolean;
}
export interface InstanceSettings {
    id: string;
    general: InstanceGeneralSettings;
    experimental: InstanceExperimentalSettings;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=instance.d.ts.map
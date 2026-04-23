/**
 * server/src/costs/taskTranslation.ts
 *
 * Task translation — converts raw task counts into business language.
 *
 * "153 tasks remaining" → "about 20 more CV batches"
 * "847 / 2,000 tasks"  → "about 95 more CV batches or 380 client emails this month"
 *
 * Translation tables are defined per pack in pack.json → taskTranslations.
 * This module is pack-agnostic: it receives the translation config and computes.
 */
export interface TaskTranslationEntry {
    skillType: string;
    tasksPerUnit: number;
    unitLabel: string;
}
export interface TaskTranslations {
    unitName: string;
    translations: TaskTranslationEntry[];
    remainingTemplate: string;
}
/**
 * Translate a remaining task count into human-readable business units.
 * Returns the top-2 translations (most tasks-per-unit first = most meaningful).
 *
 * Example:
 *   153 tasks, translations = [{tasksPerUnit:7, label:"CV batch"}, {tasksPerUnit:1, label:"email"}]
 *   → ["about 21 more CV batches", "about 153 more emails"]
 */
export declare function translateRemainingTasks(tasksRemaining: number, translations: TaskTranslations): string[];
/**
 * Format the full usage gauge string for the dashboard.
 *
 * Example output:
 *   "847 / 2,000 tasks — about 95 more CV batches or 380 client emails this month"
 */
export declare function formatUsageGauge(tasksUsed: number, tasksLimit: number, translations: TaskTranslations): string;
/**
 * Format an overage warning with translated cost.
 *
 * Example:
 *   "You have 153 tasks left — about 20 more CV batches.
 *    After that, each batch costs €0.13 extra."
 */
export declare function formatOverageWarning(tasksRemaining: number, translations: TaskTranslations, overageCostEurPerTask: number): string;
//# sourceMappingURL=taskTranslation.d.ts.map
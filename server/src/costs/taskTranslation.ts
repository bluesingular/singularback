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

import { formatNumber, DEFAULT_LOCALE } from "../i18n/format.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TaskTranslationEntry {
  skillType:    string;
  tasksPerUnit: number;
  unitLabel:    string;
}

export interface TaskTranslations {
  unitName:          string;
  translations:      TaskTranslationEntry[];
  remainingTemplate: string;
}

// ── Translation logic ─────────────────────────────────────────────────────────

/**
 * Translate a remaining task count into human-readable business units.
 * Returns the top-2 translations (most tasks-per-unit first = most meaningful).
 *
 * Example:
 *   153 tasks, translations = [{tasksPerUnit:7, label:"CV batch"}, {tasksPerUnit:1, label:"email"}]
 *   → ["about 21 more CV batches", "about 153 more emails"]
 */
export function translateRemainingTasks(
  tasksRemaining: number,
  translations: TaskTranslations,
): string[] {
  if (tasksRemaining <= 0) return ["0 tasks remaining"];

  // Sort by tasksPerUnit descending (most "meaningful" unit first)
  const sorted = [...translations.translations].sort(
    (a, b) => b.tasksPerUnit - a.tasksPerUnit,
  );

  return sorted.slice(0, 2).map((t) => {
    const count = Math.floor(tasksRemaining / t.tasksPerUnit);
    const label = count === 1 ? t.unitLabel : `${t.unitLabel}s`;
    return `about ${count} more ${label}`;
  });
}

/**
 * Format the full usage gauge string for the dashboard.
 *
 * Example output:
 *   "847 / 2,000 tasks — about 95 more CV batches or 380 client emails this month"
 */
export function formatUsageGauge(
  tasksUsed: number,
  tasksLimit: number,
  translations: TaskTranslations,
  locale = DEFAULT_LOCALE,
): string {
  const remaining = Math.max(0, tasksLimit - tasksUsed);
  const parts = translateRemainingTasks(remaining, translations);

  const usedStr  = formatNumber(tasksUsed, locale);
  const limitStr = formatNumber(tasksLimit, locale);

  if (parts.length === 0 || remaining === 0) {
    return `${usedStr}\u202F/\u202F${limitStr} tasks — limit reached`;
  }

  const translationStr = parts.join(" or ");
  return `${usedStr}\u202F/\u202F${limitStr} tasks — ${translationStr} this month`;
}

/**
 * Format an overage warning with translated cost.
 *
 * Example:
 *   "You have 153 tasks left — about 20 more CV batches.
 *    After that, each batch costs €0.13 extra."
 */
export function formatOverageWarning(
  tasksRemaining: number,
  translations: TaskTranslations,
  overageCostEurPerTask: number,
): string {
  const primary = translations.translations.sort(
    (a, b) => b.tasksPerUnit - a.tasksPerUnit,
  )[0];

  if (!primary) return `You have ${tasksRemaining} tasks left.`;

  const units = Math.floor(tasksRemaining / primary.tasksPerUnit);
  const costPerUnit = (overageCostEurPerTask * primary.tasksPerUnit).toFixed(2);

  return (
    `You have ${tasksRemaining} tasks left — about ${units} more ${primary.unitLabel}s.\n` +
    `After that, each ${primary.unitLabel} costs €${costPerUnit} extra.`
  );
}

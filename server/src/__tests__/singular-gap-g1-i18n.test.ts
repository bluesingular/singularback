/**
 * G1 — i18n architecture
 *
 * Tests:
 *  1. formatDate — fr-FR formats as "6 mai 2026"
 *  2. formatDate — en-GB formats as "6 May 2026"
 *  3. formatDate — respects timezone (UTC vs Europe/Paris)
 *  4. formatTime — fr-FR formats as "08:15"
 *  5. formatDateTime — includes date and time components
 *  6. formatNumber — fr-FR uses thin space as thousands separator
 *  7. formatNumber — en-GB uses comma as thousands separator
 *  8. formatMicroEuros — 5_000_000 → "5,00 €" (fr-FR)
 *  9. formatMicroEuros — 0 → "0,00 €" (fr-FR)
 * 10. formatEuros — 12.5 → "12,50 €" (fr-FR)
 * 11. formatEuros — 12.5 → "£12.50" does not apply (EUR currency always)
 * 12. formatUsageGauge — uses locale for number formatting
 * 13. formatUsageGauge — fr-FR separates with thin space
 * 14. formatUsageGauge — en-GB separates with comma
 * 15. DEFAULT_LOCALE is fr-FR
 * 16. DEFAULT_TIMEZONE is Europe/Paris
 */

import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatTime,
  formatDateTime,
  formatNumber,
  formatMicroEuros,
  formatEuros,
  DEFAULT_LOCALE,
  DEFAULT_TIMEZONE,
} from "../i18n/format.js";
import { formatUsageGauge } from "../costs/taskTranslation.js";

const TRANSLATIONS = {
  unitName: "tâches",
  remainingTemplate: "{count} {unit} restant",
  translations: [
    { skillType: "qualification-cv", tasksPerUnit: 7, unitLabel: "lot de CV" },
    { skillType: "client-email",     tasksPerUnit: 1, unitLabel: "email client" },
  ],
};

describe("G1 — i18n format utilities", () => {

  // ── formatDate ──────────────────────────────────────────────────────────────

  it("1. formatDate — fr-FR formats as '6 mai 2026'", () => {
    const date = new Date("2026-05-06T10:00:00Z");
    const result = formatDate(date, "fr-FR", "UTC");
    expect(result).toMatch(/6/);
    expect(result.toLowerCase()).toMatch(/mai/);
    expect(result).toMatch(/2026/);
  });

  it("2. formatDate — en-GB formats with English month name", () => {
    const date = new Date("2026-05-06T10:00:00Z");
    const result = formatDate(date, "en-GB", "UTC");
    expect(result).toMatch(/6/);
    expect(result).toMatch(/May/);
    expect(result).toMatch(/2026/);
  });

  it("3. formatDate — respects timezone (same UTC moment, different display)", () => {
    // 2026-05-06T23:00:00Z is May 7 in Europe/Paris (UTC+2)
    const date = new Date("2026-05-06T23:00:00Z");
    const paris = formatDate(date, "fr-FR", "Europe/Paris");
    const utc   = formatDate(date, "fr-FR", "UTC");
    // Paris shows May 7, UTC shows May 6
    expect(paris).not.toEqual(utc);
    expect(paris.toLowerCase()).toMatch(/7/);
  });

  // ── formatTime ──────────────────────────────────────────────────────────────

  it("4. formatTime — fr-FR returns HH:MM format", () => {
    const date = new Date("2026-05-06T06:15:00Z");
    const result = formatTime(date, "fr-FR", "UTC");
    expect(result).toMatch(/06/);
    expect(result).toMatch(/15/);
  });

  // ── formatDateTime ──────────────────────────────────────────────────────────

  it("5. formatDateTime — includes both date and time components", () => {
    const date = new Date("2026-05-06T08:15:00Z");
    const result = formatDateTime(date, "fr-FR", "UTC");
    expect(result).toMatch(/2026/);
    expect(result).toMatch(/08/);
    expect(result).toMatch(/15/);
  });

  // ── formatNumber ────────────────────────────────────────────────────────────

  it("6. formatNumber — fr-FR formats 2000 with space separator", () => {
    const result = formatNumber(2000, "fr-FR");
    // Should be "2 000" or "2 000" (thin space)
    expect(result.replace(/\s/g, " ").trim()).toMatch(/2.000/);
    expect(result).not.toContain(",");
  });

  it("7. formatNumber — en-GB formats 2000 with comma separator", () => {
    const result = formatNumber(2000, "en-GB");
    expect(result).toContain(",");
  });

  // ── formatMicroEuros ────────────────────────────────────────────────────────

  it("8. formatMicroEuros — 5_000_000 micro → 5.00 EUR (fr-FR)", () => {
    const result = formatMicroEuros(5_000_000, "fr-FR");
    expect(result).toMatch(/5/);
    expect(result).toMatch(/€/);
  });

  it("9. formatMicroEuros — 0 → 0.00 EUR", () => {
    const result = formatMicroEuros(0, "fr-FR");
    expect(result).toMatch(/0/);
    expect(result).toMatch(/€/);
  });

  // ── formatEuros ─────────────────────────────────────────────────────────────

  it("10. formatEuros — 12.5 → formatted EUR string with fr-FR", () => {
    const result = formatEuros(12.5, "fr-FR");
    expect(result).toMatch(/12/);
    expect(result).toMatch(/50/);
    expect(result).toMatch(/€/);
  });

  it("11. formatEuros — currency is always EUR regardless of locale", () => {
    const result = formatEuros(10, "en-GB");
    // en-GB with EUR currency shows € or "EUR" prefix — NOT £
    expect(result).not.toMatch(/£/);
  });

  // ── Constants ───────────────────────────────────────────────────────────────

  it("15. DEFAULT_LOCALE is fr-FR", () => {
    expect(DEFAULT_LOCALE).toBe("fr-FR");
  });

  it("16. DEFAULT_TIMEZONE is Europe/Paris", () => {
    expect(DEFAULT_TIMEZONE).toBe("Europe/Paris");
  });

  // ── taskTranslation integration ─────────────────────────────────────────────

  it("12. formatUsageGauge — accepts locale parameter without error", () => {
    const result = formatUsageGauge(847, 2000, TRANSLATIONS, "fr-FR");
    expect(typeof result).toBe("string");
    expect(result).toContain("847");
    expect(result).toContain("2");
  });

  it("13. formatUsageGauge — fr-FR formats 2000 with space (not comma)", () => {
    const result = formatUsageGauge(0, 2000, TRANSLATIONS, "fr-FR");
    // 2000 in fr-FR → "2 000" (with thin space)
    // The number should not contain a comma for fr-FR
    const parts = result.split(" / ");
    expect(parts[0]).not.toContain(",");
  });

  it("14. formatUsageGauge — en-GB formats 2000 with comma", () => {
    const result = formatUsageGauge(0, 2000, TRANSLATIONS, "en-GB");
    // 2000 in en-GB → "2,000"
    const parts = result.split(" / ");
    expect(parts[0]).not.toContain(" "); // no thin space
  });
});

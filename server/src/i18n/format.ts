/**
 * server/src/i18n/format.ts
 *
 * G1 — Locale-aware formatting utilities for server-side strings.
 * All functions accept company.locale (BCP-47, e.g. "fr-FR") and
 * company.timezone (IANA, e.g. "Europe/Paris").
 *
 * Never hardcode "fr-FR" outside this module.
 */

export const DEFAULT_LOCALE   = "fr-FR";
export const DEFAULT_TIMEZONE = "Europe/Paris";

/**
 * Format a Date as a short date string respecting the company's locale and timezone.
 * e.g. "6 mai 2026" (fr-FR) or "6 May 2026" (en-GB)
 */
export function formatDate(
  date: Date | string,
  locale   = DEFAULT_LOCALE,
  timezone = DEFAULT_TIMEZONE,
): string {
  return new Intl.DateTimeFormat(locale, {
    day:      "numeric",
    month:    "long",
    year:     "numeric",
    timeZone: timezone,
  }).format(new Date(date));
}

/**
 * Format a Date as a short datetime string.
 * e.g. "6 mai 2026, 08:15" (fr-FR)
 */
export function formatDateTime(
  date: Date | string,
  locale   = DEFAULT_LOCALE,
  timezone = DEFAULT_TIMEZONE,
): string {
  return new Intl.DateTimeFormat(locale, {
    day:      "numeric",
    month:    "short",
    year:     "numeric",
    hour:     "2-digit",
    minute:   "2-digit",
    timeZone: timezone,
  }).format(new Date(date));
}

/**
 * Format a time-of-day string (HH:MM).
 * e.g. "08:15"
 */
export function formatTime(
  date: Date | string,
  locale   = DEFAULT_LOCALE,
  timezone = DEFAULT_TIMEZONE,
): string {
  return new Intl.DateTimeFormat(locale, {
    hour:     "2-digit",
    minute:   "2-digit",
    timeZone: timezone,
  }).format(new Date(date));
}

/**
 * Format a number with locale-appropriate separators.
 * e.g. 2000 → "2 000" (fr-FR) or "2,000" (en-GB)
 */
export function formatNumber(
  value: number,
  locale = DEFAULT_LOCALE,
): string {
  return value.toLocaleString(locale);
}

/**
 * Format a euro amount (from micro-euros, 1 EUR = 1 000 000 µEUR).
 * e.g. 5_000_000 → "5,00 €" (fr-FR)
 */
export function formatMicroEuros(
  microEuros: number,
  locale = DEFAULT_LOCALE,
): string {
  const euros = microEuros / 1_000_000;
  return new Intl.NumberFormat(locale, {
    style:    "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(euros);
}

/**
 * Format a euro amount (from full euros, already a float).
 */
export function formatEuros(
  euros: number,
  locale = DEFAULT_LOCALE,
): string {
  return new Intl.NumberFormat(locale, {
    style:    "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(euros);
}

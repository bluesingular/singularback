/**
 * G1 — useLocale()
 *
 * Returns the BCP-47 locale and IANA timezone of the currently selected company.
 * Falls back to fr-FR / Europe/Paris (Singular's primary market).
 *
 * Usage:
 *   const { locale, timezone, formatDate, formatTime, formatNumber } = useLocale()
 *   formatDate(new Date()) // → "6 mai 2026"
 */

import { useCompany } from "../context/CompanyContext";

const FALLBACK_LOCALE   = "fr-FR";
const FALLBACK_TIMEZONE = "Europe/Paris";

export interface LocaleFormatters {
  locale:       string;
  timezone:     string;
  formatDate:   (date: Date | string) => string;
  formatTime:   (date: Date | string) => string;
  formatDateTime: (date: Date | string) => string;
  formatNumber: (n: number) => string;
  formatEuros:  (euros: number) => string;
}

export function useLocale(): LocaleFormatters {
  const { selectedCompany } = useCompany();

  const locale   = selectedCompany?.locale   ?? FALLBACK_LOCALE;
  const timezone = selectedCompany?.timezone ?? FALLBACK_TIMEZONE;

  return {
    locale,
    timezone,

    formatDate: (date: Date | string) =>
      new Intl.DateTimeFormat(locale, {
        day:      "numeric",
        month:    "long",
        year:     "numeric",
        timeZone: timezone,
      }).format(new Date(date)),

    formatTime: (date: Date | string) =>
      new Intl.DateTimeFormat(locale, {
        hour:     "2-digit",
        minute:   "2-digit",
        timeZone: timezone,
      }).format(new Date(date)),

    formatDateTime: (date: Date | string) =>
      new Intl.DateTimeFormat(locale, {
        day:      "numeric",
        month:    "short",
        year:     "numeric",
        hour:     "2-digit",
        minute:   "2-digit",
        timeZone: timezone,
      }).format(new Date(date)),

    formatNumber: (n: number) => n.toLocaleString(locale),

    formatEuros: (euros: number) =>
      new Intl.NumberFormat(locale, {
        style:    "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(euros),
  };
}

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import frCommon from "../locales/fr/common.json";
import frDashboard from "../locales/fr/dashboard.json";
import frAgents from "../locales/fr/agents.json";
import frTrust from "../locales/fr/trust.json";
import frTasks from "../locales/fr/tasks.json";
import frConsole from "../locales/fr/console.json";
import frSettings from "../locales/fr/settings.json";

import enCommon from "../locales/en/common.json";
import enDashboard from "../locales/en/dashboard.json";
import enAgents from "../locales/en/agents.json";
import enTrust from "../locales/en/trust.json";
import enTasks from "../locales/en/tasks.json";
import enConsole from "../locales/en/console.json";
import enSettings from "../locales/en/settings.json";

export const SUPPORTED_LANGUAGES = ["fr", "en"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const NAMESPACES = [
  "common",
  "dashboard",
  "agents",
  "trust",
  "tasks",
  "console",
  "settings",
] as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: {
        common: frCommon,
        dashboard: frDashboard,
        agents: frAgents,
        trust: frTrust,
        tasks: frTasks,
        console: frConsole,
        settings: frSettings,
      },
      en: {
        common: enCommon,
        dashboard: enDashboard,
        agents: enAgents,
        trust: enTrust,
        tasks: enTasks,
        console: enConsole,
        settings: enSettings,
      },
    },
    defaultNS: "common",
    fallbackLng: "fr",
    supportedLngs: SUPPORTED_LANGUAGES,
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "singular_language",
      caches: ["localStorage"],
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;

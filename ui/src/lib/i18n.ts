import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import frCommon from "../locales/fr/common.json";
import frDashboard from "../locales/fr/dashboard.json";
import frAgents from "../locales/fr/agents.json";
import frTrust from "../locales/fr/trust.json";
import frTasks from "../locales/fr/tasks.json";
import frConsole from "../locales/fr/console.json";
import frSettings from "../locales/fr/settings.json";
import frReports from "../locales/fr/reports.json";
import frContacts from "../locales/fr/contacts.json";

import enCommon from "../locales/en/common.json";
import enDashboard from "../locales/en/dashboard.json";
import enAgents from "../locales/en/agents.json";
import enTrust from "../locales/en/trust.json";
import enTasks from "../locales/en/tasks.json";
import enConsole from "../locales/en/console.json";
import enSettings from "../locales/en/settings.json";
import enReports from "../locales/en/reports.json";
import enContacts from "../locales/en/contacts.json";

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
  "reports",
  "contacts",
] as const;

// Read language directly from localStorage — no detector magic.
const stored = typeof localStorage !== "undefined"
  ? localStorage.getItem("singular_language")
  : null;
const initialLng = stored === "en" ? "en" : "fr";

i18n
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
        reports: frReports,
        contacts: frContacts,
      },
      en: {
        common: enCommon,
        dashboard: enDashboard,
        agents: enAgents,
        trust: enTrust,
        tasks: enTasks,
        console: enConsole,
        settings: enSettings,
        reports: enReports,
        contacts: enContacts,
      },
    },
    lng: initialLng,
    fallbackLng: "fr",
    defaultNS: "common",
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;

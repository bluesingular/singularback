import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/i18n";
import { useCompany } from "@/context/CompanyContext";
import { companiesApi } from "@/api/companies";

const LANGUAGE_FLAGS: Record<SupportedLanguage, string> = {
  fr: "🇫🇷",
  en: "🇬🇧",
};

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation("common");
  const { selectedCompanyId } = useCompany();
  const current = i18n.language as SupportedLanguage;

  async function switchTo(lang: SupportedLanguage) {
    await i18n.changeLanguage(lang);
    if (selectedCompanyId) {
      companiesApi.update(selectedCompanyId, { locale: lang }).catch(() => {
        // non-blocking — locale already applied locally
      });
    }
  }

  return (
    <div className="flex items-center gap-1">
      {SUPPORTED_LANGUAGES.map((lang) => (
        <button
          key={lang}
          onClick={() => switchTo(lang)}
          title={t(`language.${lang}`)}
          className={`flex items-center gap-1.5 rounded px-2 py-1 text-sm transition-colors ${
            current === lang
              ? "bg-neutral-200 font-medium text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100"
              : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:text-neutral-400"
          }`}
        >
          <span>{LANGUAGE_FLAGS[lang]}</span>
          <span className="uppercase">{lang}</span>
        </button>
      ))}
    </div>
  );
}

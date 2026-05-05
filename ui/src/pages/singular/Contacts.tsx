import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, Plus, Users } from "lucide-react";

type FilterTab = "tous" | "candidats" | "clients" | "partenaires";

export function Contacts() {
  const { t, i18n } = useTranslation("contacts");
  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: "tous",       label: t("filters.all") },
    { key: "candidats",  label: t("filters.candidates") },
    { key: "clients",    label: t("filters.clients") },
    { key: "partenaires",label: t("filters.partners") },
  ];
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("tous");

  const fr = i18n.language !== "en";

  return (
    <div className="min-h-screen px-6 py-6" style={{ backgroundColor: "#FAFAF8" }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl" style={{ fontFamily: "Georgia, serif", color: "#0F0F0D" }}>
          {t("title")}
        </h1>
        <button
          className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg opacity-50 cursor-not-allowed"
          style={{ backgroundColor: "#1A9E68", color: "#FFFFFF" }}
          disabled
        >
          <Plus size={14} />
          {t("addContact")}
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#8A8680" }} />
        <input
          type="text"
          placeholder={t("search")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm outline-none"
          style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E4DC", color: "#0F0F0D" }}
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className="text-sm px-4 py-1.5 rounded-full transition-colors"
            style={
              activeFilter === tab.key
                ? { backgroundColor: "#0F0F0D", color: "#FFFFFF" }
                : { backgroundColor: "transparent", color: "#8A8680" }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Empty state */}
      <div
        className="rounded-2xl border p-12 text-center flex flex-col items-center gap-4"
        style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E4DC" }}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "#F5F5F3" }}
        >
          <Users size={24} style={{ color: "#8A8680" }} />
        </div>
        <div>
          <p className="text-sm font-medium" style={{ color: "#0F0F0D" }}>
            {fr
              ? "Les contacts apparaîtront ici automatiquement"
              : "Contacts will appear here automatically"}
          </p>
          <p className="text-xs mt-1.5 max-w-xs mx-auto" style={{ color: "#8A8680" }}>
            {fr
              ? "Chaque candidat ou client contacté par vos agents sera enregistré avec son historique d'interactions."
              : "Every candidate or client contacted by your agents will be recorded with their interaction history."}
          </p>
        </div>
      </div>

      {/* V2 notice */}
      <p className="text-xs text-center mt-6" style={{ color: "#8A8680" }}>
        {fr
          ? "Les fiches contacts détaillées arrivent dans la prochaine version."
          : "Detailed contact profiles are coming in the next release."}
      </p>
    </div>
  );
}

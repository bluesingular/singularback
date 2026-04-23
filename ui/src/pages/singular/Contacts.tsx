import { useState } from "react";
import { Search, Plus, ChevronDown, ChevronUp, Clock, AlertCircle } from "lucide-react";

type ContactType = "candidat" | "client" | "partenaire";

interface ContactInteraction {
  date: string;
  agent: string;
  action: string;
}

interface Contact {
  id: string;
  name: string;
  type: ContactType;
  company?: string;
  lastContactDays: number;
  lastContactAgent: string;
  lastContactAction: string;
  profile: string;
  openTasks: number;
  openTaskLabel?: string;
  history: ContactInteraction[];
}

const contacts: Contact[] = [
  {
    id: "1",
    name: "Martin Dupont",
    type: "candidat",
    lastContactDays: 3,
    lastContactAgent: "Sophie",
    lastContactAction: "email de suivi",
    profile: "Développeur Python, 5 ans exp., Paris, disponible M+1",
    openTasks: 1,
    openTaskLabel: "relance en attente d'approbation",
    history: [
      { date: "il y a 3 jours", agent: "Sophie", action: "Email de suivi envoyé" },
      { date: "il y a 10 jours", agent: "Sophie", action: "CV qualifié — score 4,2/5" },
      { date: "il y a 15 jours", agent: "Sophie", action: "Premier contact établi" },
    ],
  },
  {
    id: "2",
    name: "Sarah Bertin",
    type: "client",
    company: "Innotec",
    lastContactDays: 1,
    lastContactAgent: "Marc",
    lastContactAction: "rapport hebdo envoyé",
    profile:
      "DRH, répond sous 24h, préfère des rapports concis, renouvellement de contrat dans 30 jours",
    openTasks: 0,
    history: [
      { date: "hier", agent: "Marc", action: "Rapport hebdo envoyé" },
      { date: "il y a 8 jours", agent: "Marc", action: "Présentation de 3 candidats" },
      { date: "il y a 15 jours", agent: "Marc", action: "Email de suivi de mission" },
    ],
  },
  {
    id: "3",
    name: "Antoine Moreau",
    type: "candidat",
    lastContactDays: 7,
    lastContactAgent: "Julien",
    lastContactAction: "suivi de dossier",
    profile: "Chef de projet digital, 8 ans exp., Lyon, CDI",
    openTasks: 0,
    history: [
      { date: "il y a 7 jours", agent: "Julien", action: "Suivi de dossier envoyé" },
      { date: "il y a 21 jours", agent: "Sophie", action: "CV qualifié — score 3,8/5" },
    ],
  },
  {
    id: "4",
    name: "Nathalie Perrin",
    type: "client",
    company: "Talentis SA",
    lastContactDays: 2,
    lastContactAgent: "Marc",
    lastContactAction: "présentation candidats",
    profile: "Directrice talent acquisition, budget 3 recrutements/mois",
    openTasks: 0,
    history: [
      { date: "il y a 2 jours", agent: "Marc", action: "Présentation de 2 candidats" },
      { date: "il y a 9 jours", agent: "Marc", action: "Rapport hebdo envoyé" },
      { date: "il y a 16 jours", agent: "Marc", action: "Premier contact établi" },
    ],
  },
];

type FilterTab = "tous" | "candidats" | "clients" | "partenaires";

const filterTabs: { key: FilterTab; label: string }[] = [
  { key: "tous", label: "Tous" },
  { key: "candidats", label: "Candidats" },
  { key: "clients", label: "Clients" },
  { key: "partenaires", label: "Partenaires" },
];

function typeBadge(type: ContactType, company?: string) {
  if (type === "candidat") {
    return (
      <span
        className="text-xs font-medium px-2 py-0.5 rounded-full"
        style={{ backgroundColor: "#1A9E6815", color: "#1A9E68" }}
      >
        Candidat
      </span>
    );
  }
  if (type === "client") {
    return (
      <span
        className="text-xs font-medium px-2 py-0.5 rounded-full"
        style={{ backgroundColor: "#1A4E8C15", color: "#1A4E8C" }}
      >
        Contact client{company ? ` · ${company}` : ""}
      </span>
    );
  }
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ backgroundColor: "#8A868015", color: "#8A8680" }}
    >
      Partenaire
    </span>
  );
}

function lastContactLabel(days: number) {
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "hier";
  return `il y a ${days} jours`;
}

export function Contacts() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterTab>("tous");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = contacts.filter((c) => {
    const matchSearch =
      !searchQuery ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.company ?? "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchFilter =
      activeFilter === "tous" ||
      (activeFilter === "candidats" && c.type === "candidat") ||
      (activeFilter === "clients" && c.type === "client") ||
      (activeFilter === "partenaires" && c.type === "partenaire");

    return matchSearch && matchFilter;
  });

  return (
    <div
      className="min-h-screen px-6 py-6"
      style={{ backgroundColor: "#FAFAF8" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1
          className="text-2xl"
          style={{ fontFamily: "Georgia, serif", color: "#0F0F0D" }}
        >
          Contacts{" "}
          <span className="text-lg font-normal" style={{ color: "#8A8680" }}>
            · {contacts.length} personnes
          </span>
        </h1>
        <button
          className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#1A9E68", color: "#FFFFFF" }}
        >
          <Plus size={14} />
          Ajouter un contact
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: "#8A8680" }}
        />
        <input
          type="text"
          placeholder="Rechercher un contact..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm outline-none"
          style={{
            backgroundColor: "#FFFFFF",
            borderColor: "#E8E4DC",
            color: "#0F0F0D",
          }}
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

      {/* Contact list */}
      <div className="space-y-3">
        {filtered.map((contact) => {
          const isExpanded = expandedId === contact.id;
          return (
            <div
              key={contact.id}
              className="rounded-xl border overflow-hidden transition-shadow"
              style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E4DC" }}
            >
              <button
                className="w-full text-left px-5 py-4"
                onClick={() => setExpandedId(isExpanded ? null : contact.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span
                        className="font-semibold text-base"
                        style={{ color: "#0F0F0D" }}
                      >
                        {contact.name}
                      </span>
                      {typeBadge(contact.type, contact.company)}
                    </div>

                    <div
                      className="flex items-center gap-1.5 text-xs mb-1.5"
                      style={{ color: "#8A8680" }}
                    >
                      <Clock size={12} />
                      <span>
                        Dernier contact : {lastContactLabel(contact.lastContactDays)} par{" "}
                        <span className="font-medium" style={{ color: "#0F0F0D" }}>
                          {contact.lastContactAgent}
                        </span>{" "}
                        ({contact.lastContactAction})
                      </span>
                    </div>

                    <p className="text-sm" style={{ color: "#8A8680" }}>
                      {contact.profile}
                    </p>

                    {contact.openTasks > 0 && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <AlertCircle size={13} style={{ color: "#C97C0A" }} />
                        <span className="text-xs font-medium" style={{ color: "#C97C0A" }}>
                          {contact.openTasks} tâche ouverte
                          {contact.openTasks > 1 ? "s" : ""}{" "}
                          {contact.openTaskLabel ? `(${contact.openTaskLabel})` : ""}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-none mt-1" style={{ color: "#8A8680" }}>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>
              </button>

              {/* Expanded history */}
              {isExpanded && (
                <div
                  className="px-5 pb-4 pt-0"
                  style={{ borderTop: "1px solid #E8E4DC" }}
                >
                  <p
                    className="text-xs font-medium uppercase tracking-wide pt-4 mb-3"
                    style={{ color: "#8A8680" }}
                  >
                    Historique des interactions
                  </p>
                  <div className="space-y-2.5">
                    {contact.history.map((item, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div
                          className="flex-none w-1.5 h-1.5 rounded-full mt-1.5"
                          style={{ backgroundColor: "#E8E4DC" }}
                        />
                        <div>
                          <span className="text-sm" style={{ color: "#0F0F0D" }}>
                            {item.action}
                          </span>
                          <span className="text-xs ml-2" style={{ color: "#8A8680" }}>
                            par {item.agent} · {item.date}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div
            className="text-center py-12 text-sm"
            style={{ color: "#8A8680" }}
          >
            Aucun contact ne correspond à votre recherche.
          </div>
        )}
      </div>

      {/* V2 notice */}
      <p className="text-xs text-center mt-8" style={{ color: "#8A8680" }}>
        Les fiches contacts détaillées et l'historique complet arrivent dans la prochaine version.
      </p>
    </div>
  );
}

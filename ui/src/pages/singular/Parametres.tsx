import { useState, useEffect } from "react";
import { CheckCircle2, AlertTriangle, ChevronRight, Save, Package, Loader2 } from "lucide-react";
import { useCompany } from "../../context/CompanyContext";
import { companiesApi } from "../../api/companies";
import { useToastActions } from "../../context/ToastContext";
import { useMutation, useQuery } from "@tanstack/react-query";

type Tab = "adn" | "integrations" | "facturation" | "equipe" | "packs";

const tabLabels: { key: Tab; label: string }[] = [
  { key: "adn", label: "ADN de l'entreprise" },
  { key: "integrations", label: "Intégrations" },
  { key: "facturation", label: "Facturation" },
  { key: "equipe", label: "Équipe" },
  { key: "packs", label: "Packs d'agents" },
];

const specialisations = [
  "Recrutement IT & Tech",
  "Recrutement Commerce & Marketing",
  "Recrutement Finance & Comptabilité",
  "Recrutement Industrie & Ingénierie",
  "Recrutement Santé & Médical",
  "Recrutement Généraliste",
];

const zones = [
  "Île-de-France",
  "Auvergne-Rhône-Alpes",
  "Occitanie",
  "Nouvelle-Aquitaine",
  "Hauts-de-France",
  "Bretagne",
  "France entière",
  "Europe",
];

const integrations = [
  {
    name: "Gmail",
    status: "connected" as const,
    detail: "Sophie, Marc, Julien",
  },
  {
    name: "LinkedIn",
    status: "disconnected" as const,
    detail: "",
  },
  {
    name: "Notion",
    status: "disconnected" as const,
    detail: "",
  },
  {
    name: "Google Agenda",
    status: "disconnected" as const,
    detail: "",
  },
];

function ADNTab() {
  const [nom, setNom] = useState("Cabinet Dupont Recrutement");
  const [description, setDescription] = useState(
    "Cabinet de recrutement spécialisé IT fondé en 2018, basé à Paris. Nous accompagnons les scale-ups et PME dans leurs recrutements tech avec une approche personnalisée."
  );
  const [specialisation, setSpecialisation] = useState("Recrutement IT & Tech");
  const [zone, setZone] = useState("Île-de-France");
  const [ton, setTon] = useState("Professionnel et chaleureux");
  const [interdits, setInterdits] = useState("Ne jamais promettre un délai précis de placement");
  const [rgpd, setRgpd] = useState(true);
  const [nonDisc, setNonDisc] = useState(true);
  const [conventions, setConventions] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="space-y-8">
      {/* Section — Votre cabinet */}
      <div>
        <h2
          className="text-base font-semibold mb-4"
          style={{ fontFamily: "Georgia, serif", color: "#0F0F0D" }}
        >
          Votre cabinet
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "#0F0F0D" }}>
              Nom du cabinet
            </label>
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-colors focus:border-[#1A9E68]"
              style={{ borderColor: "#E8E4DC", color: "#0F0F0D" }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "#0F0F0D" }}>
              Description
            </label>
            <p className="text-xs mb-1.5" style={{ color: "#8A8680" }}>
              Comment présenteriez-vous votre cabinet en 2 phrases ?
            </p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none resize-none transition-colors focus:border-[#1A9E68]"
              style={{ borderColor: "#E8E4DC", color: "#0F0F0D" }}
            />
            <p className="text-xs mt-1 text-right" style={{ color: "#8A8680" }}>
              {description.length}/200
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#0F0F0D" }}>
                Spécialisation
              </label>
              <select
                value={specialisation}
                onChange={(e) => setSpecialisation(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none appearance-none"
                style={{ borderColor: "#E8E4DC", color: "#0F0F0D" }}
              >
                {specialisations.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "#0F0F0D" }}>
                Zone géographique
              </label>
              <select
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none appearance-none"
                style={{ borderColor: "#E8E4DC", color: "#0F0F0D" }}
              >
                {zones.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: "1px", backgroundColor: "#E8E4DC" }} />

      {/* Section — Ton de communication */}
      <div>
        <h2
          className="text-base font-semibold mb-4"
          style={{ fontFamily: "Georgia, serif", color: "#0F0F0D" }}
        >
          Votre ton de communication
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "#0F0F0D" }}>
              Ton
            </label>
            <div className="flex flex-col gap-2">
              {["Formel", "Professionnel et chaleureux", "Accessible"].map((t) => (
                <label key={t} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="ton"
                    value={t}
                    checked={ton === t}
                    onChange={() => setTon(t)}
                    className="accent-[#1A9E68]"
                    style={{ accentColor: "#1A9E68" }}
                  />
                  <span className="text-sm" style={{ color: "#0F0F0D" }}>
                    {t}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "#0F0F0D" }}>
              Ce que vous ne dites jamais
            </label>
            <textarea
              value={interdits}
              onChange={(e) => setInterdits(e.target.value)}
              rows={2}
              placeholder="Exemple : Ne jamais promettre un délai précis"
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none resize-none transition-colors focus:border-[#1A9E68]"
              style={{ borderColor: "#E8E4DC", color: "#0F0F0D" }}
            />
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: "1px", backgroundColor: "#E8E4DC" }} />

      {/* Section — Contexte réglementaire */}
      <div>
        <h2
          className="text-base font-semibold mb-4"
          style={{ fontFamily: "Georgia, serif", color: "#0F0F0D" }}
        >
          Contexte réglementaire
        </h2>
        <div className="space-y-3">
          {[
            { label: "RGPD candidats", value: rgpd, set: setRgpd },
            { label: "Loi non-discrimination", value: nonDisc, set: setNonDisc },
            { label: "Conventions collectives spécifiques", value: conventions, set: setConventions },
          ].map(({ label, value, set }) => (
            <label key={label} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={value}
                onChange={(e) => set(e.target.checked)}
                className="w-4 h-4 rounded"
                style={{ accentColor: "#1A9E68" }}
              />
              <span className="text-sm" style={{ color: "#0F0F0D" }}>
                {label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Save button */}
      <div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-xl transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#1A9E68", color: "#FFFFFF" }}
        >
          {saved ? (
            <>
              <CheckCircle2 size={15} />
              Modifications enregistrées
            </>
          ) : (
            <>
              <Save size={15} />
              Enregistrer les modifications
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function IntegrationsTab() {
  return (
    <div className="space-y-3">
      {integrations.map((integ) => (
        <div
          key={integ.name}
          className="flex items-center justify-between px-5 py-4 rounded-xl border"
          style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E4DC" }}
        >
          <div className="flex items-center gap-3">
            {integ.status === "connected" ? (
              <CheckCircle2 size={18} style={{ color: "#1A9E68" }} />
            ) : (
              <AlertTriangle size={18} style={{ color: "#C97C0A" }} />
            )}
            <div>
              <p className="text-sm font-medium" style={{ color: "#0F0F0D" }}>
                {integ.name}
              </p>
              <p className="text-xs" style={{ color: "#8A8680" }}>
                {integ.status === "connected"
                  ? `Connecté — ${integ.detail}`
                  : "Non connecté"}
              </p>
            </div>
          </div>
          {integ.status === "disconnected" && (
            <button
              className="flex items-center gap-1 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ color: "#1A9E68" }}
            >
              Connecter
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function FacturationTab() {
  return (
    <div
      className="rounded-xl border p-6"
      style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E4DC" }}
    >
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "#8A8680" }}>
          Plan actuel
        </p>
        <p
          className="text-xl font-semibold"
          style={{ fontFamily: "Georgia, serif", color: "#0F0F0D" }}
        >
          Croissance
        </p>
        <p className="text-2xl font-bold mt-1" style={{ color: "#1A9E68" }}>
          249 €
          <span className="text-sm font-normal" style={{ color: "#8A8680" }}>
            /mois
          </span>
        </p>
      </div>

      <div className="space-y-2 mb-6">
        {[
          "2 000 tâches/mois",
          "6 agents",
          "20M tokens inclus",
        ].map((item) => (
          <div key={item} className="flex items-center gap-2">
            <CheckCircle2 size={15} style={{ color: "#1A9E68" }} />
            <span className="text-sm" style={{ color: "#0F0F0D" }}>
              {item}
            </span>
          </div>
        ))}
      </div>

      <button
        className="flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80"
        style={{ color: "#1A4E8C" }}
      >
        Gérer l'abonnement
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

function EquipeTab() {
  return (
    <div>
      <div
        className="rounded-xl border px-5 py-4 mb-4 flex items-center justify-between"
        style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E4DC" }}
      >
        <div>
          <p className="text-sm font-medium" style={{ color: "#0F0F0D" }}>
            Luc Boilly
          </p>
          <p className="text-xs" style={{ color: "#8A8680" }}>
            Administrateur
          </p>
        </div>
        <span
          className="text-xs font-medium px-2.5 py-1 rounded-full"
          style={{ backgroundColor: "#1A9E6815", color: "#1A9E68" }}
        >
          Vous
        </span>
      </div>

      <button
        className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl border transition-colors hover:opacity-80"
        style={{ borderColor: "#E8E4DC", color: "#0F0F0D" }}
      >
        <Plus />
        Inviter un membre
      </button>
    </div>
  );
}

function Plus() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M7 1.5v11M1.5 7h11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PacksTab() {
  const { selectedCompanyId } = useCompany();
  const { pushToast } = useToastActions();

  const { data: packs = [], isLoading: packsLoading } = useQuery<any[]>({
    queryKey: ["companies", selectedCompanyId || "", "packs"],
    queryFn: () => companiesApi.listPacks(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const installMutation = useMutation({
    mutationFn: (packSlug: string) => companiesApi.installPack(selectedCompanyId!, packSlug),
    onSuccess: () => {
      pushToast({
        title: "Pack installé!",
        body: "Les agents et compétences sont maintenant disponibles.",
        tone: "success",
      });
    },
    onError: (err) => {
      pushToast({
        title: "Erreur lors de l'installation",
        body: (err as Error).message,
        tone: "error",
      });
    },
  });

  if (packsLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#1A9E68" }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold" style={{ fontFamily: "Georgia, serif", color: "#0F0F0D" }}>
        Packs d'agents disponibles
      </h2>

      {packs.length === 0 ? (
        <div
          className="p-4 rounded-lg text-center"
          style={{ backgroundColor: "#F5F3F0", color: "#8A8680" }}
        >
          Aucun pack disponible pour le moment.
        </div>
      ) : (
        <div className="grid gap-4">
          {(packs as any[]).map((pack: any) => (
            <div
              key={pack.slug}
              className="p-6 rounded-xl border transition-all hover:shadow-sm"
              style={{ borderColor: "#E8E4DC" }}
            >
              <div className="flex items-start gap-4">
                <div className="mt-1 flex-shrink-0">
                  <Package className="w-6 h-6" style={{ color: "#1A9E68" }} />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold mb-1" style={{ color: "#0F0F0D" }}>
                    {pack.name}
                  </h3>
                  <p className="text-sm mb-2" style={{ color: "#8A8680" }}>
                    {pack.description}
                  </p>
                  <p className="text-sm font-medium mb-3" style={{ color: "#1A9E68" }}>
                    {pack.tagline}
                  </p>
                  <ul className="text-sm mb-4 space-y-1" style={{ color: "#8A8680" }}>
                    {(pack.value_proposition || []).map((prop: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-[#1A9E68] mt-0.5">✓</span>
                        <span>{prop}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-3 text-xs" style={{ color: "#8A8680" }}>
                    <span>⏱ ~{pack.estimated_setup_minutes} min</span>
                    <span>Version {pack.version}</span>
                  </div>
                </div>
                <button
                  onClick={() => installMutation.mutate(pack.slug)}
                  disabled={installMutation.isPending}
                  className="flex-shrink-0 px-4 py-2 rounded-lg font-medium text-sm transition-colors"
                  style={{
                    backgroundColor: "#1A9E68",
                    color: "#FFFFFF",
                    opacity: installMutation.isPending ? 0.7 : 1,
                  }}
                >
                  {installMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Installer"
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Parametres() {
  const [activeTab, setActiveTab] = useState<Tab>("adn");

  return (
    <div
      className="min-h-screen px-6 py-6"
      style={{ backgroundColor: "#FAFAF8" }}
    >
      {/* Header */}
      <h1
        className="text-2xl mb-6"
        style={{ fontFamily: "Georgia, serif", color: "#0F0F0D" }}
      >
        Paramètres
      </h1>

      {/* Tabs */}
      <div
        className="flex gap-0 mb-6 border-b"
        style={{ borderColor: "#E8E4DC" }}
      >
        {tabLabels.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="text-sm px-4 py-2.5 -mb-px border-b-2 transition-colors"
            style={
              activeTab === tab.key
                ? {
                    borderColor: "#1A9E68",
                    color: "#1A9E68",
                    fontWeight: 600,
                  }
                : {
                    borderColor: "transparent",
                    color: "#8A8680",
                    fontWeight: 400,
                  }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="max-w-2xl">
        {activeTab === "adn" && <ADNTab />}
        {activeTab === "integrations" && <IntegrationsTab />}
        {activeTab === "facturation" && <FacturationTab />}
        {activeTab === "equipe" && <EquipeTab />}
        {activeTab === "packs" && <PacksTab />}
      </div>
    </div>
  );
}

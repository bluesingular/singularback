import { useState } from "react";
import { CheckCircle2, AlertTriangle, ChevronRight, Save, Package, Loader2, Trash2 } from "lucide-react";
import { useCompany } from "../../context/CompanyContext";
import { companiesApi } from "../../api/companies";
import { useToastActions } from "../../context/ToastContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { membersApi, type Member, type MemberRole } from "@/api/members";
import { useLocale } from "@/hooks/useLocale";
import { notificationsApi, type NotificationPreferences } from "@/api/notifications";

const EU_TIMEZONES = [
  { value: "Europe/Paris",    label: "Paris (CET/CEST)" },
  { value: "Europe/London",   label: "Londres (GMT/BST)" },
  { value: "Europe/Berlin",   label: "Berlin (CET/CEST)" },
  { value: "Europe/Madrid",   label: "Madrid (CET/CEST)" },
  { value: "Europe/Rome",     label: "Rome (CET/CEST)" },
  { value: "Europe/Brussels", label: "Bruxelles (CET/CEST)" },
  { value: "Europe/Amsterdam",label: "Amsterdam (CET/CEST)" },
  { value: "Europe/Zurich",   label: "Zurich (CET/CEST)" },
  { value: "Europe/Warsaw",   label: "Varsovie (CET/CEST)" },
  { value: "Europe/Stockholm",label: "Stockholm (CET/CEST)" },
];

type Tab = "adn" | "integrations" | "facturation" | "equipe" | "packs" | "langue" | "notifications";

const tabLabels: { key: Tab; label: string }[] = [
  { key: "adn", label: "Company DNA" },
  { key: "integrations", label: "Integrations" },
  { key: "facturation", label: "Billing" },
  { key: "equipe", label: "Team" },
  { key: "packs", label: "Agent packs" },
  { key: "langue", label: "Language" },
  { key: "notifications", label: "Notifications" },
];

const specialisations = [
  "Recrutement IT & Tech",
  "Recrutement Commerce & Marketing",
  "Recruitment — Finance & Accounting",
  "Recruitment — Industry & Engineering",
  "Recruitment — Health & Medical",
  "Recruitment — Generalist",
];

const zones = [
  "Île-de-France",
  "Auvergne-Rhône-Alpes",
  "Occitanie",
  "Nouvelle-Aquitaine",
  "Hauts-de-France",
  "Bretagne",
  "All of France",
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
    "Specialised IT recruitment firm founded in 2018, based in Paris. We help scale-ups and SMEs hire top tech talent with a personalised approach."
  );
  const [specialisation, setSpecialisation] = useState("Recrutement IT & Tech");
  const [zone, setZone] = useState("Île-de-France");
  const [ton, setTon] = useState("Professionnel et chaleureux");
  const [interdits, setInterdits] = useState("Never promise a specific placement deadline");
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
      {/* Section — Your company */}
      <div>
        <h2
          className="text-base font-semibold mb-4"
          style={{ fontFamily: "Georgia, serif", color: "#0F0F0D" }}
        >
          Your company
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "#0F0F0D" }}>
              Company name
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
              Describe your company in 2 sentences.
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
                Specialisation
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
                Geographic area
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
          Your communication tone
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
              placeholder="E.g. Never promise a specific deadline"
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
            { label: "Specific collective agreements", value: conventions, set: setConventions },
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
                  : "Not connected"}
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

function BillingTab() {
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
          "2,000 tasks/month",
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

const ROLE_LABELS: Record<string, string> = {
  owner:    "Owner",
  admin:    "Administrateur",
  operator: "Operator",
  viewer:   "Lecteur",
  api:      "API",
};

const ROLE_OPTIONS: MemberRole[] = ["owner", "admin", "operator", "viewer"];

function EquipeTab() {
  const { selectedCompanyId } = useCompany();
  const { pushToast } = useToastActions();
  const { formatDate } = useLocale();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["singular-members", selectedCompanyId],
    queryFn: () => membersApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const rolesMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: MemberRole }) =>
      membersApi.updateRole(selectedCompanyId!, memberId, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["singular-members", selectedCompanyId] });
      pushToast({ title: "Role updated", tone: "success" });
    },
    onError: () => pushToast({ title: "Update failed", tone: "error" }),
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => membersApi.remove(selectedCompanyId!, memberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["singular-members", selectedCompanyId] });
      pushToast({ title: "Member removed", tone: "success" });
    },
    onError: (err: any) =>
      pushToast({ title: err?.message ?? "Erreur lors de la suppression", tone: "error" }),
  });

  const members: Member[] = data?.members ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-[#1A9E68] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E4DC" }}
      >
        {members.length === 0 && (
          <p className="text-sm text-[#8A8680] px-5 py-4">Aucun membre.</p>
        )}
        {members.map((m, i) => (
          <div
            key={m.id}
            className="px-5 py-4 flex items-center gap-3"
            style={{ borderBottom: i < members.length - 1 ? "1px solid #F0EDE6" : undefined }}
          >
            {/* Avatar initial */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0"
              style={{ backgroundColor: "#E8F5EE", color: "#1A9E68" }}
            >
              {(m.name ?? m.email ?? "?")[0].toUpperCase()}
            </div>

            {/* Name + email */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "#0F0F0D" }}>
                {m.name ?? m.email ?? m.userId}
              </p>
              {m.email && m.name && (
                <p className="text-xs truncate" style={{ color: "#8A8680" }}>{m.email}</p>
              )}
              <p className="text-xs" style={{ color: "#CACAC8" }}>
                Rejoint le {formatDate(m.joinedAt)}
              </p>
            </div>

            {/* Role selector */}
            <select
              value={m.role ?? "viewer"}
              onChange={(e) =>
                rolesMutation.mutate({ memberId: m.id, role: e.target.value as MemberRole })
              }
              disabled={rolesMutation.isPending}
              className="text-xs rounded-lg border px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1A9E68]/30"
              style={{ borderColor: "#E8E4DC", color: "#4B4846", backgroundColor: "#FAFAF8" }}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>

            {/* Remove */}
            <button
              onClick={() => {
                if (confirm(`Retirer ${m.name ?? m.email} de l'équipe ?`)) {
                  removeMutation.mutate(m.id);
                }
              }}
              disabled={removeMutation.isPending}
              className="p-1.5 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
              title="Retirer le membre"
            >
              <Trash2 size={13} style={{ color: "#CACAC8" }} />
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs" style={{ color: "#8A8680" }}>
        Pour inviter un nouveau membre, utilisez le flux d'inscription depuis le tableau de bord.
      </p>
    </div>
  );
}

function LanguageTab() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { pushToast } = useToastActions();
  const [timezone, setTimezone] = useState(
    selectedCompany?.timezone ?? "Europe/Paris"
  );

  const timezoneMutation = useMutation({
    mutationFn: (tz: string) =>
      companiesApi.update(selectedCompanyId!, { timezone: tz }),
    onSuccess: () =>
      pushToast({ title: "Timezone saved", tone: "success" }),
    onError: () =>
      pushToast({ title: "Erreur lors de l'enregistrement", tone: "error" }),
  });

  function handleTimezoneChange(tz: string) {
    setTimezone(tz);
    if (selectedCompanyId) timezoneMutation.mutate(tz);
  }

  return (
    <div className="space-y-8">
      <div>
        <h2
          className="text-base font-semibold mb-1"
          style={{ fontFamily: "Georgia, serif", color: "#0F0F0D" }}
        >
          Language d'affichage
        </h2>
        <p className="text-sm mb-4" style={{ color: "#8A8680" }}>
          Choisissez la langue de votre interface
        </p>
        <LanguageSwitcher />
      </div>

      <div style={{ height: "1px", backgroundColor: "#E8E4DC" }} />

      <div>
        <h2
          className="text-base font-semibold mb-1"
          style={{ fontFamily: "Georgia, serif", color: "#0F0F0D" }}
        >
          Fuseau horaire
        </h2>
        <p className="text-sm mb-4" style={{ color: "#8A8680" }}>
          Utilisé pour les notifications et l'intelligence du matin
        </p>
        <select
          value={timezone}
          onChange={(e) => handleTimezoneChange(e.target.value)}
          className="w-full max-w-xs px-3 py-2.5 rounded-xl border text-sm outline-none appearance-none transition-colors focus:border-[#1A9E68]"
          style={{ borderColor: "#E8E4DC", color: "#0F0F0D" }}
        >
          {EU_TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
      </div>
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
        title: "Pack installed!",
        body: "Agents and skills are now available.",
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
        Agent packs disponibles
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

// ── NotificationsTab ─────────────────────────────────────────────────────────

const NOTIF_ROWS: { key: keyof NotificationPreferences; base: string; label: string; desc: string }[] = [
  { key: "approvalInapp",     base: "approval",     label: "Approvals",         desc: "Tasks awaiting your approval" },
  { key: "trustInapp",        base: "trust",        label: "Confiance",            desc: "Propositions d'autonomie et ajustements" },
  { key: "intelligenceInapp", base: "intelligence", label: "Intelligence du matin", desc: "Alertes quotidiennes et insights" },
  { key: "errorInapp",        base: "error",        label: "Errors",              desc: "Incidents detected by your agents" },
  { key: "budgetInapp",       base: "budget",       label: "Budget",               desc: "Budget overage alerts" },
];

function NotificationsTab() {
  const { selectedCompanyId } = useCompany();
  const { pushToast } = useToastActions();
  const qc = useQueryClient();

  const { data: prefs, isLoading } = useQuery({
    queryKey: ["notification-preferences", selectedCompanyId],
    queryFn: () => notificationsApi.getPreferences(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const save = useMutation({
    mutationFn: (patch: Partial<NotificationPreferences>) =>
      notificationsApi.updatePreferences(selectedCompanyId!, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notification-preferences", selectedCompanyId] });
      pushToast({ title: "Preferences saved", tone: "success" });
    },
    onError: () => pushToast({ title: "Erreur lors de la sauvegarde", tone: "error" }),
  });

  function toggle(key: keyof NotificationPreferences) {
    if (!prefs) return;
    save.mutate({ [key]: !prefs[key] });
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-[#8A8680]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Chargement…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-[#4B4846]">
        Choisissez comment vous souhaitez être alerté pour chaque type d'événement.
      </p>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_80px_80px] gap-4 pb-2 border-b border-[#E8E4DC]">
        <span />
        <span className="text-xs font-semibold text-[#8A8680] uppercase tracking-wide text-center">
          In-app
        </span>
        <span className="text-xs font-semibold text-[#8A8680] uppercase tracking-wide text-center">
          E-mail
        </span>
      </div>

      {NOTIF_ROWS.map(({ key, base, label, desc }) => {
        const inappKey  = key as keyof NotificationPreferences;
        const emailKey  = `${base}Email` as keyof NotificationPreferences;
        return (
          <div key={base} className="grid grid-cols-[1fr_80px_80px] gap-4 items-center">
            <div>
              <p className="text-sm font-medium text-[#0F0F0D]">{label}</p>
              <p className="text-xs text-[#8A8680] mt-0.5">{desc}</p>
            </div>
            <div className="flex justify-center">
              <button
                onClick={() => toggle(inappKey)}
                className={`w-10 h-5 rounded-full transition-colors ${
                  prefs?.[inappKey] ? "bg-[#1A9E68]" : "bg-[#D4CFC8]"
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5 ${
                    prefs?.[inappKey] ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
            <div className="flex justify-center">
              <button
                onClick={() => toggle(emailKey)}
                className={`w-10 h-5 rounded-full transition-colors ${
                  prefs?.[emailKey] ? "bg-[#1A9E68]" : "bg-[#D4CFC8]"
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5 ${
                    prefs?.[emailKey] ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>("adn");

  return (
    <div
      className="min-h-full px-6 py-6"
      style={{ backgroundColor: "#FAFAF8" }}
    >
      {/* Header */}
      <h1
        className="text-2xl mb-6"
        style={{ fontFamily: "Georgia, serif", color: "#0F0F0D" }}
      >
        Settings
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
        {activeTab === "facturation" && <BillingTab />}
        {activeTab === "equipe" && <EquipeTab />}
        {activeTab === "packs" && <PacksTab />}
        {activeTab === "langue" && <LanguageTab />}
        {activeTab === "notifications" && <NotificationsTab />}
      </div>
    </div>
  );
}

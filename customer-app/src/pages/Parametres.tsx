import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Settings, Zap, ExternalLink } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { billingApi, costsApi } from "../api/client";

// ── Plan display names & descriptions ────────────────────────────────────────

const PLAN_INFO: Record<string, { label: string; tasks: string; agents: string; sla: string }> = {
  solo:       { label: "Solo",       tasks: "500 tâches/mois",    agents: "2 agents",    sla: "Résolution 24h" },
  growth:     { label: "Croissance", tasks: "2 000 tâches/mois",  agents: "6 agents",    sla: "Résolution 8h"  },
  pro:        { label: "Pro",        tasks: "6 000 tâches/mois",  agents: "15 agents",   sla: "Résolution 4h"  },
  enterprise: { label: "Entreprise", tasks: "Illimité",           agents: "Illimité",    sla: "Résolution 1h"  },
};

function PlanBadge({ plan }: { plan: string }) {
  const info = PLAN_INFO[plan] ?? { label: plan };
  const colours: Record<string, string> = {
    solo:       "bg-[#F5F2EE] text-[#6B6B6B]",
    growth:     "bg-[#E8F5EE] text-[#1A9E68]",
    pro:        "bg-[#E8F0F8] text-[#1A4E8C]",
    enterprise: "bg-[#F3EEF8] text-[#6B2FA0]",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colours[plan] ?? colours.solo}`}>
      {info.label}
    </span>
  );
}

// ── Upgrade card ──────────────────────────────────────────────────────────────

function UpgradeCard({
  plan,
  label,
  price,
  features,
  companyId,
  current,
}: {
  plan: "growth" | "pro";
  label: string;
  price: string;
  features: string[];
  companyId: string;
  current: boolean;
}) {
  const checkout = useMutation({
    mutationFn: () => billingApi.checkout(companyId, plan),
    onSuccess: ({ url }) => {
      if (url) window.location.href = url;
    },
  });

  if (current) {
    return (
      <div className="border-2 border-[#1A9E68] rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm text-[#1A1A1A]">{label}</p>
          <span className="text-xs bg-[#1A9E68] text-white px-2 py-0.5 rounded-full">Actuel</span>
        </div>
        <p className="text-lg font-bold text-[#1A1A1A]">{price}<span className="text-xs font-normal text-[#6B6B6B]">/mois</span></p>
        <ul className="space-y-1">
          {features.map((f) => (
            <li key={f} className="text-xs text-[#6B6B6B] flex items-center gap-1.5">
              <span className="text-[#1A9E68]">✓</span> {f}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="border border-[#E8E4DC] rounded-xl p-4 space-y-3 hover:border-[#1A9E68] transition-colors">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-sm text-[#1A1A1A]">{label}</p>
        {plan === "pro" && (
          <span className="text-xs bg-[#F59E0B] text-white px-2 py-0.5 rounded-full">Populaire</span>
        )}
      </div>
      <p className="text-lg font-bold text-[#1A1A1A]">{price}<span className="text-xs font-normal text-[#6B6B6B]">/mois</span></p>
      <ul className="space-y-1">
        {features.map((f) => (
          <li key={f} className="text-xs text-[#6B6B6B] flex items-center gap-1.5">
            <span className="text-[#1A9E68]">✓</span> {f}
          </li>
        ))}
      </ul>
      <button
        onClick={() => checkout.mutate()}
        disabled={checkout.isPending}
        className="w-full text-sm font-medium bg-[#1A9E68] disabled:opacity-50 hover:bg-[#158a59] text-white py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
      >
        {checkout.isPending ? (
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <Zap className="w-3.5 h-3.5" />
            Passer à {label}
          </>
        )}
      </button>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Parametres() {
  const { user, activeCompany, companyId } = useAuth();
  const [showUpgrade, setShowUpgrade] = useState(false);

  const plan = activeCompany?.plan ?? "solo";
  const planInfo = PLAN_INFO[plan] ?? PLAN_INFO.solo;

  const { data: costs } = useQuery({
    queryKey: ["costs", companyId],
    queryFn: () => costsApi.summary(companyId!),
    enabled: !!companyId,
  });

  const openPortal = useMutation({
    mutationFn: () => billingApi.portal(companyId!),
    onSuccess: ({ url }) => {
      if (url) window.location.href = url;
    },
  });

  const isPaid = plan !== "solo";

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="w-5 h-5 text-[#1A9E68]" />
        <h1 className="font-serif text-2xl text-[#1A1A1A]">Paramètres</h1>
      </div>

      {/* Account */}
      <div className="bg-white border border-[#E8E4DC] rounded-xl divide-y divide-[#F0EDE8]">
        <div className="px-4 py-3">
          <p className="text-xs text-[#6B6B6B]">Compte</p>
          <p className="text-sm font-medium text-[#1A1A1A] mt-0.5">{user?.name ?? "—"}</p>
          <p className="text-xs text-[#6B6B6B]">{user?.email ?? "—"}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-[#6B6B6B]">Entreprise</p>
          <p className="text-sm font-medium text-[#1A1A1A] mt-0.5">{activeCompany?.name ?? "—"}</p>
          <p className="text-xs text-[#6B6B6B]">{activeCompany?.role ?? "—"}</p>
        </div>
      </div>

      {/* Billing section */}
      <div className="bg-white border border-[#E8E4DC] rounded-xl">
        <div className="px-4 py-3 border-b border-[#E8E4DC] flex items-center justify-between">
          <div>
            <p className="text-xs text-[#6B6B6B]">Abonnement</p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-sm font-medium text-[#1A1A1A]">{planInfo.label}</p>
              <PlanBadge plan={plan} />
            </div>
          </div>
          {isPaid ? (
            <button
              onClick={() => openPortal.mutate()}
              disabled={openPortal.isPending}
              className="flex items-center gap-1.5 text-xs text-[#6B6B6B] hover:text-[#1A1A1A] border border-[#E8E4DC] px-3 py-1.5 rounded-md transition-colors"
            >
              {openPortal.isPending
                ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                : <ExternalLink className="w-3 h-3" />
              }
              Gérer l'abonnement
            </button>
          ) : (
            <button
              onClick={() => setShowUpgrade((v) => !v)}
              className="flex items-center gap-1.5 text-xs bg-[#1A9E68] hover:bg-[#158a59] text-white px-3 py-1.5 rounded-md transition-colors"
            >
              <Zap className="w-3 h-3" />
              Mettre à niveau
            </button>
          )}
        </div>

        {/* Usage */}
        {costs && (
          <div className="px-4 py-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-[#6B6B6B]">Tâches ce mois</span>
              <span className="text-xs font-medium text-[#1A1A1A]">
                {costs.tasksThisMonth} / {costs.tasksLimit === 99_999 ? "∞" : costs.tasksLimit.toLocaleString()}
              </span>
            </div>
            <div className="w-full h-1.5 bg-[#F0EDE8] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-[#1A9E68] transition-all"
                style={{
                  width: `${Math.min(100, costs.tasksLimit > 0 ? (costs.tasksThisMonth / costs.tasksLimit) * 100 : 0)}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-[#6B6B6B]">
              <span>{planInfo.agents}</span>
              <span>SLA : {planInfo.sla}</span>
            </div>
          </div>
        )}
      </div>

      {/* Upgrade cards — shown inline when on solo */}
      {showUpgrade && !isPaid && (
        <div className="grid grid-cols-2 gap-3">
          <UpgradeCard
            plan="growth"
            label="Croissance"
            price="299 €"
            features={["2 000 tâches/mois", "6 agents", "Résolution 8h", "Support prioritaire"]}
            companyId={companyId!}
            current={plan as string === "growth"}
          />
          <UpgradeCard
            plan="pro"
            label="Pro"
            price="799 €"
            features={["6 000 tâches/mois", "15 agents", "Résolution 4h", "Accès API", "Support dédié"]}
            companyId={companyId!}
            current={plan as string === "pro"}
          />
        </div>
      )}

      {/* Company DNA note */}
      <div className="bg-white border border-[#E8E4DC] rounded-xl p-4">
        <h2 className="text-sm font-semibold text-[#1A1A1A] mb-2">ADN de l'entreprise</h2>
        <p className="text-xs text-[#6B6B6B]">
          La configuration complète de l'ADN (voix de marque, services, clients clés) est disponible dans l'interface d'administration.
        </p>
      </div>
    </div>
  );
}

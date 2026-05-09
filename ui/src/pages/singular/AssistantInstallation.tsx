/**
 * ui/src/pages/singular/AssistantInstallation.tsx
 *
 * Gap A — Self-service onboarding wizard.
 * 7 steps driven by onboarding.json (P1 recruitment).
 * Collects answers → calls pack install → shows completion screen.
 */

import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams, useParams } from "@/lib/router";
import { useCompany } from "../../context/CompanyContext";
import { companiesApi } from "../../api/companies";
import { queryKeys } from "../../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Check, Loader2, Users, Target, Zap } from "lucide-react";
import { cn } from "../../lib/utils";

// ── Step data (matches onboarding.json) ──────────────────────────────────────

type FieldType = "text" | "select" | "multi_select";

interface Field {
  id: string;
  label: string;
  type: FieldType;
  options?: Array<string | { value: string; label: string }>;
  placeholder?: string;
  required: boolean;
  maps_to: string;
}

interface Step {
  step: number;
  title: string;
  description?: string;
  fields?: Field[];
  type?: string;
  headline?: string;
  subline?: string;
  cta_primary?: string;
}

const STEPS: Step[] = [
  {
    step: 1,
    title: "Dans quel secteur exercez-vous ?",
    fields: [
      {
        id: "specialisation",
        label: "Spécialisation principale",
        type: "select",
        options: ["Généraliste", "IT & Digital", "Finance & Comptabilité", "Marketing & Communication", "Fonctions supports (RH, juridique, achat)", "Cadres dirigeants (executive search)", "Santé & Médical", "Industrie & Ingénierie"],
        required: true,
        maps_to: "company_dna.specialisation",
      },
      {
        id: "zone_geo",
        label: "Zone géographique principale",
        type: "select",
        options: ["Île-de-France", "Auvergne-Rhône-Alpes", "Provence-Alpes-Côte d'Azur", "Occitanie", "Nouvelle-Aquitaine", "Hauts-de-France", "Grand Est", "Pays de la Loire", "National", "International"],
        required: true,
        maps_to: "company_dna.geography",
      },
    ],
  },
  {
    step: 2,
    title: "Parlez-nous de votre cabinet.",
    fields: [
      { id: "cabinet_name", label: "Nom du cabinet", type: "text", placeholder: "Ex : Talentis RH, Cabinet Moreau, RecruitPro...", required: true, maps_to: "company_dna.name" },
      { id: "nb_consultants", label: "Nombre de consultants dans l'équipe", type: "select", options: ["1 (solo)", "2-5", "6-15", "16-50"], required: true, maps_to: "config.team_size" },
      { id: "founded_year", label: "Année de création du cabinet", type: "select", options: ["Moins d'1 an", "1-3 ans", "3-10 ans", "Plus de 10 ans"], required: false, maps_to: "company_dna.seniority" },
    ],
  },
  {
    step: 3,
    title: "Vos clients",
    fields: [
      { id: "client_type", label: "Type de clients principaux", type: "multi_select", options: ["PME (10-250 salariés)", "ETI (250-5000 salariés)", "Grands groupes (>5000 salariés)", "Start-ups & scale-ups", "Secteur public & associatif"], required: true, maps_to: "company_dna.target_clients" },
      { id: "avg_salary_range", label: "Fourchette de salaire des profils placés", type: "select", options: ["< 35k€", "35-55k€", "55-80k€", "80-120k€", "> 120k€"], required: true, maps_to: "config.salary_range" },
      { id: "billing_model", label: "Modèle de facturation", type: "select", options: ["Succès (% du salaire annuel brut)", "Forfait mission", "Abonnement mensuel", "Mixte"], required: false, maps_to: "company_dna.billing_model" },
    ],
  },
  {
    step: 4,
    title: "Connectez vos outils.",
    description: "Sophie et Marc ont besoin de Gmail pour communiquer avec vos candidats et clients. Vous pouvez connecter LinkedIn plus tard.",
    type: "integration_setup",
  },
  {
    step: 5,
    title: "Voici votre équipe IA.",
    description: "Voici les 5 membres de votre équipe. Ils commenceront à travailler dès que vous validerez.",
    type: "team_preview",
  },
  {
    step: 6,
    title: "Quel est votre objectif principal ?",
    fields: [
      {
        id: "primary_goal",
        label: "Quel est votre défi principal en ce moment ?",
        type: "select",
        options: [
          { value: "volume_placements", label: "Trouver plus de candidats qualifiés" },
          { value: "reduce_time_to_shortlist", label: "Réduire le temps de traitement des missions" },
          { value: "improve_client_satisfaction", label: "Améliorer le suivi et la communication client" },
          { value: "develop_visibility", label: "Développer ma visibilité et attirer de nouveaux clients" },
          { value: "reduce_admin_load", label: "Réduire la charge administrative de mon équipe" },
        ],
        required: true,
        maps_to: "initial_goal.type",
      },
    ],
  },
  {
    step: 7,
    title: "Votre équipe est prête.",
    type: "confirmation",
    headline: "Sophie est en train de lire votre boîte mail.",
    subline: "Elle aura quelque chose pour vous dans quelques minutes.",
    cta_primary: "Ouvrir la Console CEO",
  },
];

const AGENTS = [
  { name: "Sophie", role: "Sourcing & Qualification", color: "#1A9E68" },
  { name: "Marc", role: "Relations clients", color: "#1A4E8C" },
  { name: "Clara", role: "Contenu & Visibilité", color: "#C97C0A" },
  { name: "Julien", role: "Administration", color: "#6B7280" },
  { name: "Iris", role: "Veille marché", color: "#7C3AED" },
];

// ── Field components ──────────────────────────────────────────────────────────

function SelectField({ field, value, onChange }: { field: Field; value: string; onChange: (v: string) => void }) {
  const options = field.options ?? [];
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-stone-700">{field.label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 focus:border-[#1A9E68] focus:outline-none focus:ring-1 focus:ring-[#1A9E68]"
      >
        <option value="">Choisir...</option>
        {options.map((opt) => {
          const val = typeof opt === "string" ? opt : opt.value;
          const lbl = typeof opt === "string" ? opt : opt.label;
          return <option key={val} value={val}>{lbl}</option>;
        })}
      </select>
    </div>
  );
}

function TextField({ field, value, onChange }: { field: Field; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-stone-700">{field.label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#1A9E68] focus:outline-none focus:ring-1 focus:ring-[#1A9E68]"
      />
    </div>
  );
}

function MultiSelectField({ field, value, onChange }: { field: Field; value: string; onChange: (v: string) => void }) {
  const selected = value ? value.split("|").filter(Boolean) : [];
  const toggle = (opt: string) => {
    const next = selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt];
    onChange(next.join("|"));
  };
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-stone-700">{field.label}</label>
      <div className="flex flex-wrap gap-2">
        {(field.options ?? []).map((opt) => {
          const val = typeof opt === "string" ? opt : opt.value;
          const lbl = typeof opt === "string" ? opt : opt.label;
          const active = selected.includes(val);
          return (
            <button
              key={val}
              type="button"
              onClick={() => toggle(val)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                active
                  ? "border-[#1A9E68] bg-[#1A9E68] text-white"
                  : "border-stone-200 bg-white text-stone-700 hover:border-[#1A9E68]",
              )}
            >
              {lbl}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step content components ───────────────────────────────────────────────────

function FieldsStep({ step, answers, setAnswer }: {
  step: Step;
  answers: Record<string, string>;
  setAnswer: (id: string, val: string) => void;
}) {
  return (
    <div className="space-y-5">
      {(step.fields ?? []).map((field) => {
        const value = answers[field.id] ?? "";
        if (field.type === "multi_select") return <MultiSelectField key={field.id} field={field} value={value} onChange={(v) => setAnswer(field.id, v)} />;
        if (field.type === "select") return <SelectField key={field.id} field={field} value={value} onChange={(v) => setAnswer(field.id, v)} />;
        return <TextField key={field.id} field={field} value={value} onChange={(v) => setAnswer(field.id, v)} />;
      })}
    </div>
  );
}

function IntegrationStep() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 flex items-start gap-3">
        <div className="mt-0.5 h-8 w-8 rounded-lg bg-white border border-stone-200 flex items-center justify-center text-sm">✉️</div>
        <div>
          <p className="text-sm font-medium text-stone-900">Gmail</p>
          <p className="text-xs text-stone-500 mt-0.5">Pour que Sophie et Marc puissent communiquer avec vos candidats et clients.</p>
          <button className="mt-2 text-xs text-[#1A9E68] font-medium hover:underline">Connecter Gmail →</button>
        </div>
      </div>
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 flex items-start gap-3">
        <div className="mt-0.5 h-8 w-8 rounded-lg bg-white border border-stone-200 flex items-center justify-center text-sm">💼</div>
        <div>
          <p className="text-sm font-medium text-stone-900">LinkedIn <span className="text-xs text-stone-400 font-normal ml-1">Optionnel</span></p>
          <p className="text-xs text-stone-500 mt-0.5">Pour le sourcing de candidats. Vous pouvez connecter LinkedIn après l'installation.</p>
          <button className="mt-2 text-xs text-stone-400 hover:text-stone-600">Connecter plus tard</button>
        </div>
      </div>
      <p className="text-xs text-stone-400">Vous pouvez continuer sans connecter vos outils maintenant. Les agents travailleront en mode limité jusqu'à la connexion.</p>
    </div>
  );
}

function TeamPreviewStep() {
  return (
    <div className="space-y-3">
      {AGENTS.map((agent) => (
        <div key={agent.name} className="flex items-center gap-3 rounded-xl border border-stone-100 bg-stone-50 px-4 py-3">
          <div className="h-9 w-9 rounded-full flex items-center justify-center text-white text-sm font-semibold" style={{ backgroundColor: agent.color }}>
            {agent.name[0]}
          </div>
          <div>
            <p className="text-sm font-medium text-stone-900">{agent.name}</p>
            <p className="text-xs text-stone-500">{agent.role}</p>
          </div>
          <div className="ml-auto">
            <span className="inline-flex items-center gap-1 text-xs text-[#1A9E68]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1A9E68]" />
              Prêt
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function CompletionStep({ headline, subline }: { headline?: string; subline?: string }) {
  return (
    <div className="text-center space-y-4 py-4">
      <div className="flex justify-center">
        <div className="flex -space-x-2">
          {AGENTS.map((agent) => (
            <div key={agent.name} className="h-10 w-10 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-semibold" style={{ backgroundColor: agent.color }}>
              {agent.name[0]}
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="font-serif text-xl text-stone-900">{headline ?? "Votre équipe est prête."}</p>
        <p className="mt-1.5 text-sm text-stone-500">{subline ?? "Elle aura quelque chose pour vous dans quelques minutes."}</p>
      </div>
      <div className="rounded-xl bg-stone-50 border border-stone-100 px-4 py-3 text-sm text-stone-600">
        <div className="flex items-center gap-2 justify-center">
          <Zap className="h-4 w-4 text-[#C97C0A]" />
          <span>0 / 2 000 tâches ce mois — environ 285 qualifications de CV</span>
        </div>
      </div>
    </div>
  );
}

// ── Step progress bar ─────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-1 flex-1 rounded-full transition-colors",
            i < current ? "bg-[#1A9E68]" : "bg-stone-200",
          )}
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AssistantInstallation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectedCompanyId } = useCompany();
  const [searchParams] = useSearchParams();
  const { companyPrefix } = useParams<{ companyPrefix?: string }>();
  const packSlug = searchParams.get("pack") ?? "p1-recruitment";

  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [installError, setInstallError] = useState<string | null>(null);

  const step = STEPS[currentStep];

  const setAnswer = useCallback((id: string, val: string) => {
    setAnswers((prev) => ({ ...prev, [id]: val }));
  }, []);

  const isStepValid = () => {
    if (!step.fields) return true;
    return step.fields.filter((f) => f.required).every((f) => {
      const v = answers[f.id] ?? "";
      return v.trim().length > 0;
    });
  };

  const installMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCompanyId) throw new Error("No company selected");
      const variables: Record<string, string> = { ...answers };
      if (answers.cabinet_name) variables.company_name = answers.cabinet_name;
      return companiesApi.installPack(selectedCompanyId, packSlug, variables);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
      await queryClient.invalidateQueries({ queryKey: ["agents", selectedCompanyId ?? ""] });

      // Attempt Stripe checkout — redirect if URL returned, otherwise stay in wizard
      if (selectedCompanyId) {
        try {
          const res = await fetch(`/api/companies/${selectedCompanyId}/billing/checkout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ plan: "growth" }),
          });
          const { url } = await res.json();
          if (url) {
            window.location.href = url;
            return;
          }
        } catch {
          // Stripe not configured or failed — fall through to completion screen
        }
      }

      setCurrentStep(STEPS.length - 1); // show completion
    },
    onError: (err) => {
      setInstallError(err instanceof Error ? err.message : "Une erreur est survenue. Veuillez réessayer.");
    },
  });

  const handleNext = () => {
    if (currentStep === STEPS.length - 2) {
      // Last step before completion — trigger install
      installMutation.mutate();
      return;
    }
    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setCurrentStep((s) => Math.max(s - 1, 0));
  };

  const isLastContentStep = currentStep === STEPS.length - 2;
  const isCompletionStep = step.type === "confirmation";

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <p className="text-xs font-medium text-stone-400 tracking-widest uppercase mb-6">Swwarm</p>
          {!isCompletionStep && (
            <ProgressBar current={currentStep} total={STEPS.length - 1} />
          )}
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-stone-200 bg-white shadow-sm p-8">
          <h1 className="font-serif text-2xl text-stone-900 mb-6">{step.title}</h1>

          {step.description && (
            <p className="text-sm text-stone-500 mb-6">{step.description}</p>
          )}

          {/* Step content */}
          {step.fields && (
            <FieldsStep step={step} answers={answers} setAnswer={setAnswer} />
          )}
          {step.type === "integration_setup" && <IntegrationStep />}
          {step.type === "team_preview" && <TeamPreviewStep />}
          {step.type === "confirmation" && (
            <CompletionStep headline={step.headline} subline={step.subline} />
          )}

          {/* Error */}
          {installError && (
            <p className="mt-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{installError}</p>
          )}

          {/* Actions */}
          <div className="mt-8 flex items-center justify-between">
            {!isCompletionStep ? (
              <>
                <button
                  onClick={handleBack}
                  disabled={currentStep === 0}
                  className={cn(
                    "flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 transition-colors",
                    currentStep === 0 && "invisible",
                  )}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour
                </button>
                <Button
                  onClick={handleNext}
                  disabled={!isStepValid() || installMutation.isPending}
                  className="bg-[#1A9E68] hover:bg-[#158a5a] text-white flex items-center gap-2"
                >
                  {installMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Installation…
                    </>
                  ) : isLastContentStep ? (
                    <>
                      <Check className="h-4 w-4" />
                      Lancer mon équipe
                    </>
                  ) : (
                    <>
                      Continuer
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </>
            ) : (
              <div className="w-full flex flex-col gap-3">
                <Button
                  onClick={() => navigate(`/${companyPrefix}/console`)}
                  className="w-full bg-[#1A9E68] hover:bg-[#158a5a] text-white"
                >
                  {step.cta_primary ?? "Ouvrir la Console CEO"}
                </Button>
                <button
                  onClick={() => navigate(`/${companyPrefix}/tableau-de-bord`)}
                  className="w-full text-sm text-stone-500 hover:text-stone-700 py-2"
                >
                  Voir le tableau de bord
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Step counter */}
        {!isCompletionStep && (
          <p className="mt-4 text-center text-xs text-stone-400">
            Étape {currentStep + 1} sur {STEPS.length - 1}
          </p>
        )}
      </div>
    </div>
  );
}

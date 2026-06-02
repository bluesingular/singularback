/**
 * ui/src/pages/singular/CataloguePacks.tsx
 *
 * Gap A — Pack selection screen.
 * Shown after signup before the onboarding wizard.
 * Fetches available packs via API and lets the user choose one.
 */

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router";
import { ArrowRight, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { useCompany } from "../../context/CompanyContext";
import { companiesApi } from "../../api/companies";

// ---------------------------------------------------------------------------
// PackCard
// ---------------------------------------------------------------------------

interface Pack {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  estimated_setup_minutes: number;
  value_proposition: string[];
}

function PackCard({ pack, onSelect }: { pack: Pack; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="w-full text-left rounded-2xl border border-[#E8E4DC] bg-white p-6 shadow-sm hover:shadow-md hover:border-[#1A9E68]/40 transition-all group"
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-serif font-semibold text-[#0F0F0D] leading-tight">
            {pack.name}
          </h2>
          <p className="text-sm text-[#8A8680] mt-1">{pack.tagline}</p>
        </div>
        <ArrowRight
          size={18}
          className="flex-shrink-0 mt-1 text-[#8A8680] group-hover:text-[#1A9E68] transition-colors"
        />
      </div>

      <ul className="flex flex-col gap-2 mb-5">
        {pack.value_proposition.map((point, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-[#0F0F0D]">
            <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5 text-[#1A9E68]" />
            {point}
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-[#8A8680]">
          <Clock size={12} />
          Opérationnel en {pack.estimated_setup_minutes} min
        </span>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ backgroundColor: "#1A9E6815", color: "#1A9E68" }}
        >
          Partenaire de lancement — gratuit
        </span>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// ComingSoonCard
// ---------------------------------------------------------------------------

function ComingSoonCard({ name, description }: { name: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#E8E4DC] bg-[#FAFAF8] p-6 opacity-60">
      <h2 className="text-lg font-serif font-semibold text-[#0F0F0D] leading-tight">{name}</h2>
      <p className="text-sm text-[#8A8680] mt-1">{description}</p>
      <span className="mt-4 inline-block text-xs font-medium text-[#8A8680] bg-[#F5F5F3] px-2.5 py-1 rounded-full">
        Bientôt disponible
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function CataloguePacks() {
  const navigate = useNavigate();
  const { selectedCompanyId } = useCompany();

  const { data: packs, isLoading, error } = useQuery({
    queryKey: ["packs", selectedCompanyId],
    queryFn: () => companiesApi.listPacks(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    staleTime: 5 * 60_000,
  });

  return (
    <div className="fixed inset-0 flex bg-[#FAFAF8]">
      {/* Left — catalogue */}
      <div className="w-full md:w-3/5 flex flex-col overflow-y-auto">
        <div className="w-full max-w-xl mx-auto my-auto px-8 py-12">

          {/* Brand */}
          <div className="mb-10">
            <span className="text-2xl font-serif tracking-tight" style={{ color: "#1A4E8C" }}>
              Swwarm
            </span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-3xl font-serif font-semibold leading-snug text-[#0F0F0D]">
              Choisissez votre
              <br />
              équipe IA.
            </h1>
            <p className="mt-2 text-sm text-[#8A8680]">
              Chaque pack est préconfiguré pour votre secteur. Installation en moins de 20 minutes.
            </p>
          </div>

          {/* Pack list */}
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-[#8A8680]">
              <Loader2 size={16} className="animate-spin" />
              Chargement des packs…
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              Impossible de charger les packs. Veuillez recharger la page.
            </p>
          )}

          {packs && (
            <div className="flex flex-col gap-4">
              {packs.map((pack) => (
                <PackCard
                  key={pack.slug}
                  pack={pack}
                  onSelect={() => navigate(`installation?pack=${pack.slug}`)}
                />
              ))}

              {/* Coming soon stubs */}
              <ComingSoonCard
                name="Real estate agency"
                description="Qualification de leads, relances automatiques, comptes-rendus de visite."
              />
              <ComingSoonCard
                name="Cabinet comptable"
                description="Document collection, client follow-up, balance sheet preparation."
              />
            </div>
          )}

          <p className="mt-8 text-xs text-center text-[#8A8680]">
            Vous pourrez changer de pack ou en ajouter d'autres depuis vos paramètres.
          </p>
        </div>
      </div>

      {/* Right — benefit panel */}
      <div
        className="hidden md:flex w-2/5 flex-col items-center justify-center p-12"
        style={{ background: "#1A4E8C" }}
      >
        <div className="max-w-xs text-white flex flex-col gap-8">
          <blockquote className="text-center">
            <p className="text-xl font-serif leading-relaxed">
              "Within 20 minutes Sophie was qualifying my first CVs. I didn't have to configure anything."
            </p>
            <footer className="mt-4 text-sm opacity-70">
              — Isabelle M., Cabinet de recrutement, Lyon
            </footer>
          </blockquote>

          <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3">
              <CheckCircle2 size={16} className="flex-shrink-0 opacity-80" />
              <span>Agents prêts à travailler dès l'installation</span>
            </div>
            <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3">
              <CheckCircle2 size={16} className="flex-shrink-0 opacity-80" />
              <span>Données hébergées en Europe</span>
            </div>
            <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3">
              <CheckCircle2 size={16} className="flex-shrink-0 opacity-80" />
              <span>Sans engagement — résiliable à tout moment</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

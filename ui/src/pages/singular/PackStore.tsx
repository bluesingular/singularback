/**
 * ui/src/pages/singular/PackStore.tsx
 *
 * Public pack store — browsable without login.
 * Shows all available packs with their value propositions.
 * "Install" CTA redirects to signup if not authenticated.
 *
 * Route: /store (no company prefix — public)
 */

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router";
import { CheckCircle2, Clock, ArrowRight, Package, Shield, Globe } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Pack {
  slug:                    string;
  name:                    string;
  version:                 string;
  description:             string;
  tagline:                 string;
  estimated_setup_minutes: number;
  value_proposition:       string[];
}

// ── API ───────────────────────────────────────────────────────────────────────

async function fetchPacks(): Promise<Pack[]> {
  const res = await fetch("/api/packs", { credentials: "include" });
  if (!res.ok) return [];
  const data = await res.json();
  // Handle both { packs: [...] } and { ok: true, data: { packs: [...] } }
  return data.packs ?? data.data?.packs ?? [];
}

// ── Pack card ─────────────────────────────────────────────────────────────────

function PackCard({ pack, onInstall }: { pack: Pack; onInstall: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8E4DC] p-6 flex flex-col gap-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-serif font-semibold text-[#0F0F0D]">{pack.name}</h2>
          {pack.tagline && <p className="text-sm text-[#8A8680] mt-0.5">{pack.tagline}</p>}
        </div>
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex-none"
          style={{ backgroundColor: "#1A9E6815", color: "#1A9E68" }}>
          v{pack.version}
        </span>
      </div>

      {pack.description && (
        <p className="text-sm text-[#8A8680] leading-relaxed">{pack.description}</p>
      )}

      {pack.value_proposition.length > 0 && (
        <ul className="flex flex-col gap-2">
          {pack.value_proposition.map((point, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-[#0F0F0D]">
              <CheckCircle2 size={14} className="flex-none mt-0.5" style={{ color: "#1A9E68" }} />
              {point}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between mt-auto pt-2 border-t" style={{ borderColor: "#F0EDE6" }}>
        <span className="flex items-center gap-1.5 text-xs text-[#8A8680]">
          <Clock size={12} />
          Opérationnel en {pack.estimated_setup_minutes} min
        </span>
        <button
          onClick={onInstall}
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          style={{ backgroundColor: "#1A9E68", color: "#FFFFFF" }}
        >
          Installer
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function PackStore() {
  const navigate = useNavigate();

  const { data: packs = [], isLoading } = useQuery({
    queryKey: ["public-packs"],
    queryFn:  fetchPacks,
    staleTime: 5 * 60_000,
  });

  function handleInstall(slug: string) {
    // If logged in, redirect to catalogue with pack pre-selected
    // If not, redirect to signup
    navigate(`/signup?pack=${slug}`);
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FAFAF8" }}>

      {/* Header */}
      <header className="border-b" style={{ borderColor: "#E8E4DC", backgroundColor: "#FFFFFF" }}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-xl font-serif font-semibold" style={{ color: "#1A4E8C" }}>
            Swwarm
          </span>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/login")}
              className="text-sm text-[#8A8680] hover:text-[#0F0F0D] transition-colors">
              Se connecter
            </button>
            <button onClick={() => navigate("/signup")}
              className="text-sm font-semibold px-4 py-2 rounded-xl"
              style={{ backgroundColor: "#1A9E68", color: "#FFFFFF" }}>
              Commencer
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="max-w-5xl mx-auto px-6 py-16 text-center">
        <div className="inline-flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full mb-6"
          style={{ backgroundColor: "#1A9E6815", color: "#1A9E68" }}>
          <Package size={13} />
          Pack store — EU sovereign AI agents
        </div>
        <h1 className="text-4xl font-serif font-semibold text-[#0F0F0D] leading-tight mb-4">
          Votre équipe IA, prête en 20 minutes
        </h1>
        <p className="text-lg text-[#8A8680] max-w-xl mx-auto">
          Chaque pack configure automatiquement vos agents, vos compétences et vos workflows.
          Données hébergées en Europe. Conforme RGPD.
        </p>

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-6 mt-8 text-sm text-[#8A8680]">
          {[
            { icon: Shield, label: "RGPD & IA Act" },
            { icon: Globe,  label: "EU hosting" },
            { icon: Clock,  label: "En ligne en 20 min" },
          ].map(({ icon: Icon, label }) => (
            <span key={label} className="flex items-center gap-1.5">
              <Icon size={14} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Pack grid */}
      <div className="max-w-5xl mx-auto px-6 pb-20">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-[#E8E4DC] p-6 h-64 animate-pulse" />
            ))}
          </div>
        ) : packs.length === 0 ? (
          <div className="text-center py-20 text-[#8A8680]">
            <Package size={32} className="mx-auto mb-3 opacity-40" />
            <p>Aucun pack disponible pour le moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {packs.map((pack) => (
              <PackCard key={pack.slug} pack={pack} onInstall={() => handleInstall(pack.slug)} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t text-center py-8 text-xs text-[#8A8680]" style={{ borderColor: "#E8E4DC" }}>
        © 2026 Singular.blue SAS — Swwarm est hébergé en Europe.
        Conformité RGPD et IA Act garantie.
      </footer>
    </div>
  );
}

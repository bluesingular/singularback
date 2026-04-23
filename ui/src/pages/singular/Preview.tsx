import { useState } from "react";
import { useNavigate, useLocation, Navigate, Route, Routes } from "@/lib/router";
import {
  LayoutDashboard, Users, ShieldCheck, MessageSquare,
  BarChart2, BookUser, Settings, Zap, Menu, X,
} from "lucide-react";
import TableauDeBord from "./TableauDeBord";
import MonEquipe from "./MonEquipe";
import FicheAgent from "./FicheAgent";
import CentreDeConfiance from "./CentreDeConfiance";
import FilDeTache from "./FilDeTache";
import { ConsoleCEO } from "./ConsoleCEO";
import { Rapports } from "./Rapports";
import { Contacts } from "./Contacts";
import { Parametres } from "./Parametres";
import { cn } from "@/lib/utils";

const NAV = [
  { path: "/preview/tableau-de-bord", label: "Tableau de bord", icon: LayoutDashboard },
  { path: "/preview/mon-equipe",      label: "Mon équipe IA",   icon: Users },
  { path: "/preview/confiance",       label: "Centre de confiance", icon: ShieldCheck },
  { path: "/preview/console",         label: "Console CEO",     icon: MessageSquare },
  null, // divider
  { path: "/preview/rapports",        label: "Rapports & ROI",  icon: BarChart2 },
  { path: "/preview/contacts",        label: "Contacts",        icon: BookUser },
  null, // divider
  { path: "/preview/parametres",      label: "Paramètres",      icon: Settings },
] as const;

function PreviewNav({ onClose }: { onClose?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <aside className="w-56 h-full flex flex-col bg-[#FAFAF8] border-r border-[#E8E4DC]">
      <div className="flex items-center gap-2 px-4 h-12 border-b border-[#E8E4DC] shrink-0">
        <div className="w-2 h-2 rounded-full bg-[#1A9E68]" />
        <span className="flex-1 text-sm font-semibold text-[#0F0F0D] truncate" style={{ fontFamily: "Georgia, serif" }}>
          Cabinet Demo
        </span>
        {onClose && (
          <button onClick={onClose} className="text-[#8A8680] hover:text-[#0F0F0D]">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto flex flex-col gap-0.5 px-2 py-3">
        {NAV.map((item, i) => {
          if (!item) return <div key={i} className="my-1 mx-3 border-t border-[#E8E4DC]" />;
          const Icon = item.icon;
          const active = location.pathname.startsWith(item.path);
          return (
            <button
              key={item.path}
              onClick={() => { navigate(item.path); onClose?.(); }}
              className={cn(
                "flex items-center gap-2.5 w-full px-3 py-2 text-[13px] font-medium rounded transition-colors text-left",
                active
                  ? "bg-[#E8E4DC] text-[#0F0F0D]"
                  : "text-[#8A8680] hover:bg-[#F0ECE4] hover:text-[#0F0F0D]",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-[#E8E4DC] px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-[#8A8680]">
          <Zap className="h-3 w-3 text-[#1A9E68]" />
          <span>Aperçu — singular.blue</span>
        </div>
      </div>
    </aside>
  );
}

export function SingularPreview() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-dvh overflow-hidden bg-[#FAFAF8]">
      {/* Desktop sidebar */}
      <div className="hidden md:flex h-full shrink-0">
        <PreviewNav />
      </div>

      {/* Mobile nav overlay */}
      {mobileNavOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 md:hidden">
            <PreviewNav onClose={() => setMobileNavOpen(false)} />
          </div>
        </>
      )}

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        {/* Mobile topbar */}
        <div className="flex md:hidden items-center gap-3 px-4 h-12 border-b border-[#E8E4DC] bg-[#FAFAF8] shrink-0">
          <button onClick={() => setMobileNavOpen(true)} className="text-[#8A8680]">
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-[#0F0F0D]" style={{ fontFamily: "Georgia, serif" }}>
            singular.blue
          </span>
        </div>

        <main className="flex-1 overflow-auto">
          <Routes>
            <Route index element={<Navigate to="tableau-de-bord" replace />} />
            <Route path="tableau-de-bord" element={<TableauDeBord />} />
            <Route path="mon-equipe" element={<MonEquipe />} />
            <Route path="mon-equipe/:agentSlug" element={<FicheAgent />} />
            <Route path="confiance" element={<CentreDeConfiance />} />
            <Route path="taches/:taskId" element={<FilDeTache />} />
            <Route path="console" element={<ConsoleCEO />} />
            <Route path="rapports" element={<Rapports />} />
            <Route path="contacts" element={<Contacts />} />
            <Route path="parametres" element={<Parametres />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

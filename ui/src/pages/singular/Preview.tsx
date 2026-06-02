import { useState } from "react";
import { useNavigate, useLocation, Navigate, Route, Routes } from "@/lib/router";
import {
  LayoutDashboard, Users, ShieldCheck, MessageSquare,
  BarChart2, BookUser, Settings, Zap, Menu, X,
} from "lucide-react";
import Dashboard from "./Dashboard";
import Team from "./Team";
import AgentProfile from "./AgentProfile";
import TrustCentre from "./TrustCentre";
import TaskThread from "./TaskThread";
import { ConsoleCEO } from "./ConsoleCEO";
import { Reports } from "./Reports";
import { Contacts } from "./Contacts";
import { Settings as SingularSettings } from "./Settings";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const NAV = [
  { path: "/preview/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/preview/team",      label: "My AI team",   icon: Users },
  { path: "/preview/trust",       label: "Trust centre", icon: ShieldCheck },
  { path: "/preview/console",         label: "Console CEO",     icon: MessageSquare },
  null, // divider
  { path: "/preview/reports",        label: "Reports & ROI",  icon: BarChart2 },
  { path: "/preview/contacts",        label: "Contacts",        icon: BookUser },
  null, // divider
  { path: "/preview/settings",      label: "Settings",      icon: Settings },
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

      <div className="border-t border-[#E8E4DC] px-4 py-3 flex flex-col gap-2">
        <LanguageSwitcher />
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
          <span className="flex-1 text-sm font-semibold text-[#0F0F0D]" style={{ fontFamily: "Georgia, serif" }}>
            singular.blue
          </span>
          <LanguageSwitcher />
        </div>

        <main className="flex-1 overflow-auto">
          <Routes>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="team" element={<Team />} />
            <Route path="team/:agentSlug" element={<AgentProfile />} />
            <Route path="trust" element={<TrustCentre />} />
            <Route path="taches/:taskId" element={<TaskThread />} />
            <Route path="console" element={<ConsoleCEO />} />
            <Route path="rapports" element={<Reports />} />
            <Route path="contacts" element={<Contacts />} />
            <Route path="parametres" element={<SingularSettings />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

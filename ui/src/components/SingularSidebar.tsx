import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  MessageSquare,
  BarChart2,
  BookUser,
  Settings,
  Mic,
  FileText,
  TrendingUp,
  PieChart,
  Calendar,
} from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { SidebarNavItem } from "./SidebarNavItem";
import { NotificationBell } from "./NotificationBell";
import { SidebarFooter } from "./SidebarFooter";
import { SessionGapBriefing } from "./singular/SessionGapBriefing";

export function SingularSidebar() {
  const { selectedCompany } = useCompany();
  const prefix = selectedCompany?.issuePrefix ?? "";
  const base = `/${prefix}`;

  // Gap K — session gap briefing: shown once per session mount, dismissed by operator
  const [showGap, setShowGap] = useState(true);

  return (
    <>
      {/* Gap K overlay fires when operator returns after ≥6h (component self-gates) */}
      {showGap && selectedCompany && (
        <SessionGapBriefing onDismiss={() => setShowGap(false)} />
      )}

      <aside className="w-60 h-full min-h-0 border-r border-[#E8E4DC] bg-[#FAFAF8] flex flex-col">
        {/* Company name */}
        <div className="flex items-center gap-2 px-4 h-12 shrink-0 border-b border-[#E8E4DC]">
          <div className="w-2 h-2 rounded-full bg-[#1A9E68] shrink-0" />
          <span className="flex-1 text-sm font-semibold text-[#0F0F0D] truncate font-[Georgia,serif]">
            {selectedCompany?.name ?? "Mon entreprise"}
          </span>
          <NotificationBell />
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1 px-2 py-3">
          {/* Core */}
          <SidebarNavItem to={`/dashboard`}           label="Tableau de bord"  icon={LayoutDashboard} />
          <SidebarNavItem to={`${base}/console`}      label="Console CEO"      icon={MessageSquare} />
          <SidebarNavItem to={`/team`}                label="Mon équipe"       icon={Users} />
          <SidebarNavItem to={`/trust`}               label="Confiance"        icon={ShieldCheck} />

          <div className="my-1 mx-3 border-t border-[#E8E4DC]" />

          {/* Intelligence */}
          <p className="px-3 pt-1 pb-0.5 text-[10px] font-semibold text-[#8A8680] uppercase tracking-wider">
            Intelligence
          </p>
          <SidebarNavItem to={`/reports`}             label="Rapports"          icon={BarChart2} />
          <SidebarNavItem to={`${base}/contacts`}     label="Contacts"          icon={BookUser} />
          <SidebarNavItem to={`/financial-pulse`}     label="Santé financière"  icon={TrendingUp} />
          <SidebarNavItem to={`/ceo-health`}          label="Score CEO"         icon={PieChart} />
          <SidebarNavItem to={`/meeting-briefing`}    label="Briefing réunion"  icon={Calendar} />

          <div className="my-1 mx-3 border-t border-[#E8E4DC]" />

          {/* Outils */}
          <p className="px-3 pt-1 pb-0.5 text-[10px] font-semibold text-[#8A8680] uppercase tracking-wider">
            Outils
          </p>
          <SidebarNavItem to={`/voice`}               label="Note vocale"       icon={Mic} />
          <SidebarNavItem to={`/documents`}           label="Studio documents"  icon={FileText} />

          <div className="my-1 mx-3 border-t border-[#E8E4DC]" />

          <SidebarNavItem to={`/settings`}            label="Paramètres"        icon={Settings} />
        </nav>

        <SidebarFooter
          borderColor="border-[#E8E4DC]"
          textColor="text-[#0F0F0D]"
          mutedColor="text-[#8A8680]"
          activeBg="bg-[#E8E4DC]"
          hoverBg="hover:bg-[#E8E4DC]/60"
        />
      </aside>
    </>
  );
}

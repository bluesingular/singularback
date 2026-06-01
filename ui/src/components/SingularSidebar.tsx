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

export function SingularSidebar() {
  const { selectedCompany } = useCompany();
  const prefix = selectedCompany?.issuePrefix ?? "";
  const base = `/${prefix}`;

  return (
    <aside className="w-60 h-full min-h-0 border-r border-[#E8E4DC] bg-[#FAFAF8] flex flex-col">
      {/* Company name */}
      <div className="flex items-center gap-2 px-4 h-12 shrink-0 border-b border-[#E8E4DC]">
        <div className="w-2 h-2 rounded-full bg-[#1A9E68] shrink-0" />
        <span className="flex-1 text-sm font-semibold text-[#0F0F0D] truncate font-[Georgia,serif]">
          {selectedCompany?.name ?? "My company"}
        </span>
        <NotificationBell />
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1 px-2 py-3">
        {/* Core */}
        <SidebarNavItem to={`${base}/tableau-de-bord`} label="Dashboard"    icon={LayoutDashboard} />
        <SidebarNavItem to={`${base}/console`}         label="CEO Console"  icon={MessageSquare} />
        <SidebarNavItem to={`${base}/mon-equipe`}      label="My team"      icon={Users} />
        <SidebarNavItem to={`${base}/confiance`}       label="Trust"        icon={ShieldCheck} />

        <div className="my-1 mx-3 border-t border-[#E8E4DC]" />

        {/* Intelligence */}
        <p className="px-3 pt-1 pb-0.5 text-[10px] font-semibold text-[#8A8680] uppercase tracking-wider">
          Intelligence
        </p>
        <SidebarNavItem to={`${base}/rapports`}          label="Reports"           icon={BarChart2} />
        <SidebarNavItem to={`${base}/contacts`}          label="Contacts"          icon={BookUser} />
        <SidebarNavItem to={`${base}/sante-financiere`}  label="Financial pulse"   icon={TrendingUp} />
        <SidebarNavItem to={`${base}/ratio-ceo`}         label="CEO health"        icon={PieChart} />
        <SidebarNavItem to={`${base}/briefing-reunion`}  label="Meeting briefing"  icon={Calendar} />

        <div className="my-1 mx-3 border-t border-[#E8E4DC]" />

        {/* Tools */}
        <p className="px-3 pt-1 pb-0.5 text-[10px] font-semibold text-[#8A8680] uppercase tracking-wider">
          Tools
        </p>
        <SidebarNavItem to={`${base}/note-vocale`}      label="Voice note"       icon={Mic} />
        <SidebarNavItem to={`${base}/studio-documents`} label="Document studio"  icon={FileText} />

        <div className="my-1 mx-3 border-t border-[#E8E4DC]" />

        <SidebarNavItem to={`${base}/parametres`} label="Settings" icon={Settings} />
      </nav>

      <SidebarFooter
        borderColor="border-[#E8E4DC]"
        textColor="text-[#0F0F0D]"
        mutedColor="text-[#8A8680]"
        activeBg="bg-[#E8E4DC]"
        hoverBg="hover:bg-[#E8E4DC]/60"
      />
    </aside>
  );
}

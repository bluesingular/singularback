import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  MessageSquare,
  BarChart2,
  BookUser,
  Settings,
  Zap,
} from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { SidebarNavItem } from "./SidebarNavItem";
import { NotificationBell } from "./NotificationBell";

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
          {selectedCompany?.name ?? "Mon cabinet"}
        </span>
        <NotificationBell />
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1 px-2 py-3">
        <SidebarNavItem
          to={`${base}/tableau-de-bord`}
          label="Tableau de bord"
          icon={LayoutDashboard}
        />
        <SidebarNavItem
          to={`${base}/mon-equipe`}
          label="Mon équipe IA"
          icon={Users}
        />
        <SidebarNavItem
          to={`${base}/confiance`}
          label="Centre de confiance"
          icon={ShieldCheck}
        />
        <SidebarNavItem
          to={`${base}/console`}
          label="Console CEO"
          icon={MessageSquare}
        />

        <div className="my-1 mx-3 border-t border-[#E8E4DC]" />

        <SidebarNavItem
          to={`${base}/rapports`}
          label="Rapports & ROI"
          icon={BarChart2}
        />
        <SidebarNavItem
          to={`${base}/contacts`}
          label="Contacts"
          icon={BookUser}
        />

        <div className="my-1 mx-3 border-t border-[#E8E4DC]" />

        <SidebarNavItem
          to={`${base}/parametres`}
          label="Paramètres"
          icon={Settings}
        />
      </nav>

      {/* Footer */}
      <div className="border-t border-[#E8E4DC] px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-[#8A8680]">
          <Zap className="h-3 w-3 text-[#1A9E68]" />
          <span>singular.blue</span>
        </div>
      </div>
    </aside>
  );
}

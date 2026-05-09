import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  MessageSquare,
  BarChart2,
  BookUser,
  Settings,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCompany } from "../context/CompanyContext";
import { SidebarNavItem } from "./SidebarNavItem";
import { NotificationBell } from "./NotificationBell";
import { SidebarFooter } from "./SidebarFooter";

export function SingularSidebar() {
  const { selectedCompany } = useCompany();
  const prefix = selectedCompany?.issuePrefix ?? "";
  const base = `/${prefix}`;

  const { t } = useTranslation("common");

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
          label={t("nav.dashboard")}
          icon={LayoutDashboard}
        />
        <SidebarNavItem
          to={`${base}/mon-equipe`}
          label={t("nav.team")}
          icon={Users}
        />
        <SidebarNavItem
          to={`${base}/confiance`}
          label={t("nav.trust")}
          icon={ShieldCheck}
        />
        <SidebarNavItem
          to={`${base}/console`}
          label={t("nav.console")}
          icon={MessageSquare}
        />

        <div className="my-1 mx-3 border-t border-[#E8E4DC]" />

        <SidebarNavItem
          to={`${base}/rapports`}
          label={t("nav.reports")}
          icon={BarChart2}
        />
        <SidebarNavItem
          to={`${base}/contacts`}
          label={t("nav.contacts")}
          icon={BookUser}
        />

        <div className="my-1 mx-3 border-t border-[#E8E4DC]" />

        <SidebarNavItem
          to={`${base}/parametres`}
          label={t("nav.settings")}
          icon={Settings}
        />
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

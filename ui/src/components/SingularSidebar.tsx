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
  type LucideIcon,
} from "lucide-react";
import { NavLink } from "@/lib/router";
import { useCompany } from "../context/CompanyContext";
import { NotificationBell } from "./NotificationBell";
import { SidebarFooter } from "./SidebarFooter";
import { SessionGapBriefing } from "./singular/SessionGapBriefing";

// ── Swwarm nav item — hardcoded light-theme colors (never inherits dark mode) ──
// SidebarNavItem uses CSS vars that resolve to near-white in dark mode,
// making items invisible on the light #FAFAF8 sidebar background.
// This component uses explicit Swwarm design tokens instead.

function SingularNavItem({
  to,
  label,
  icon: Icon,
}: {
  to:    string
  label: string
  icon:  LucideIcon
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors",
          isActive
            ? "bg-[#0F0F0D]/8 text-[#0F0F0D]"
            : "text-[#8A8680] hover:text-[#0F0F0D] hover:bg-[#0F0F0D]/5",
        ].join(" ")
      }
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export function SingularSidebar() {
  const { selectedCompany } = useCompany();
  const prefix = selectedCompany?.issuePrefix ?? "";
  const base = `/${prefix}`;

  const [showGap, setShowGap] = useState(true);

  return (
    <>
      {showGap && selectedCompany && (
        <SessionGapBriefing onDismiss={() => setShowGap(false)} />
      )}

      <aside className="w-60 h-full min-h-0 border-r border-[#E8E4DC] bg-[#FAFAF8] flex flex-col">
        {/* Company name */}
        <div className="flex items-center gap-2 px-4 h-12 shrink-0 border-b border-[#E8E4DC]">
          <div className="w-2 h-2 rounded-full bg-[#1A9E68] shrink-0" />
          <span className="flex-1 text-sm font-semibold text-[#0F0F0D] truncate font-[Georgia,serif]">
            {selectedCompany?.name ?? "My company"}
          </span>
          <NotificationBell />
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-0.5 px-2 py-3">
          {/* Core */}
          <SingularNavItem to={`${base}/dashboard`}        label="Dashboard"      icon={LayoutDashboard} />
          <SingularNavItem to={`${base}/console`}         label="CEO Console"    icon={MessageSquare} />
          <SingularNavItem to={`${base}/team`}            label="My team"        icon={Users} />
          <SingularNavItem to={`${base}/trust`}           label="Trust"          icon={ShieldCheck} />

          <div className="my-2 mx-1 border-t border-[#E8E4DC]" />

          {/* Intelligence */}
          <p className="px-3 pt-1 pb-1 text-[10px] font-semibold text-[#8A8680] uppercase tracking-wider">
            Intelligence
          </p>
          <SingularNavItem to={`${base}/reports`}          label="Reports"          icon={BarChart2} />
          <SingularNavItem to={`${base}/contacts`}         label="Contacts"         icon={BookUser} />
          <SingularNavItem to={`${base}/financial-pulse`}  label="Financial health" icon={TrendingUp} />
          <SingularNavItem to={`${base}/ceo-health`}       label="CEO health"       icon={PieChart} />
          <SingularNavItem to={`${base}/meeting-briefing`} label="Meeting briefing" icon={Calendar} />

          <div className="my-2 mx-1 border-t border-[#E8E4DC]" />

          {/* Tools */}
          <p className="px-3 pt-1 pb-1 text-[10px] font-semibold text-[#8A8680] uppercase tracking-wider">
            Tools
          </p>
          <SingularNavItem to={`${base}/voice`}     label="Voice note"       icon={Mic} />
          <SingularNavItem to={`${base}/documents`} label="Document studio"  icon={FileText} />

          <div className="my-2 mx-1 border-t border-[#E8E4DC]" />

          <SingularNavItem to={`${base}/settings`} label="Settings" icon={Settings} />
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

import * as React from "react"
import { Outlet } from "react-router-dom"
import { useNavigate, useLocation } from "@/lib/router"
import { BarChart3, Building2, ArrowLeft, GitBranch, Key, Shield, Plug, Webhook, Cpu, CreditCard, Users, ShieldCheck, Bell, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV = [
  { to: "/instance/admin",               label: "Plateforme",   icon: BarChart3, exact: true  },
  { to: "/instance/admin/tenants",       label: "Tenants",      icon: Building2, exact: false },
  { to: "/instance/admin/skills",        label: "Skills",  icon: GitBranch, exact: false },
  { to: "/instance/admin/api-keys",      label: "API keys",     icon: Key,       exact: false },
  { to: "/instance/admin/quality-gates", label: "Security",     icon: Shield,    exact: false },
  { to: "/instance/admin/integrations",  label: "Integrations", icon: Plug,      exact: false },
  { to: "/instance/admin/webhooks",      label: "Webhooks",     icon: Webhook,    exact: false },
  { to: "/instance/admin/llm-models",   label: "LLM models",  icon: Cpu,        exact: false },
  { to: "/instance/admin/billing",      label: "Facturation",  icon: CreditCard, exact: false },
  { to: "/instance/admin/members",       label: "Membres",      icon: Users,      exact: false },
  { to: "/instance/admin/trust",         label: "Confiance",    icon: ShieldCheck, exact: false },
  { to: "/instance/admin/notifications", label: "Notifications", icon: Bell,       exact: false },
  { to: "/instance/admin/gdpr",          label: "RGPD",         icon: FileText,   exact: false },
];

function NavItem({ to, label, icon: Icon, exact }: { to: string; label: string; icon: React.ElementType; exact: boolean }) {
  const navigate = useNavigate()
  const location = useLocation()
  const active = exact ? location.pathname === to : location.pathname.startsWith(to)

  return (
    <button
      onClick={() => navigate(to)}
      className={cn(
        "flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm transition-colors text-left",
        active
          ? "bg-[#0F0F0D] text-white"
          : "text-[#8A8680] hover:text-[#0F0F0D] hover:bg-[#F0EDE6]",
      )}
    >
      <Icon size={15} />
      {label}
    </button>
  )
}

export function AdminLayout() {
  const navigate = useNavigate()

  return (
    <div className="flex h-screen bg-[#FAFAF8] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-52 flex-shrink-0 border-r border-[#E8E4DC] bg-white flex flex-col px-3 py-4 gap-1">
        <div className="px-2 pb-3 mb-2 border-b border-[#F0EDE6]">
          <p className="text-xs font-semibold text-[#8A8680] uppercase tracking-wider">Admin Swwarm</p>
        </div>
        {NAV.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
        <div className="mt-auto pt-3 border-t border-[#F0EDE6]">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#8A8680] hover:text-[#0F0F0D] transition-colors rounded-xl hover:bg-[#F0EDE6]"
          >
            <ArrowLeft size={14} />
            Retour app
          </button>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Outlet />
      </div>
    </div>
  )
}

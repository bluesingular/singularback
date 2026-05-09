import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  CheckSquare,
  BarChart2,
  BookUser,
  Settings,
  Terminal,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import type { MeCompany } from "../api/client";

const NAV = [
  { to: "tableau-de-bord", icon: LayoutDashboard, label: "Tableau de bord" },
  { to: "mon-equipe", icon: Users, label: "Mon équipe" },
  { to: "centre-de-confiance", icon: ShieldCheck, label: "Confiance" },
  { to: "approbations", icon: CheckSquare, label: "Approbations" },
  { to: "console-ceo", icon: Terminal, label: "Console CEO" },
  { to: "rapports", icon: BarChart2, label: "Rapports" },
  { to: "contacts", icon: BookUser, label: "Contacts" },
  { to: "parametres", icon: Settings, label: "Paramètres" },
];

export function Sidebar() {
  const { user, companies, activeCompany, switchCompany, logout } = useAuth();
  const [showPicker, setShowPicker] = useState(false);

  return (
    <aside className="w-56 shrink-0 h-screen flex flex-col bg-[#FAFAF8] border-r border-[#E8E4DC]">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-[#E8E4DC]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#1A9E68] flex items-center justify-center">
            <span className="text-white text-xs font-bold">S</span>
          </div>
          <span className="font-serif text-lg text-[#1A1A1A]">Swwarm</span>
        </div>
      </div>

      {/* Company picker */}
      {companies.length > 0 && (
        <div className="px-3 py-2 border-b border-[#E8E4DC] relative">
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-[#F0EDE8] text-left transition-colors"
          >
            <span className="text-xs font-medium text-[#1A1A1A] truncate">
              {activeCompany?.name ?? "—"}
            </span>
            {companies.length > 1 && (
              <ChevronDown className="w-3.5 h-3.5 text-[#6B6B6B] shrink-0 ml-1" />
            )}
          </button>
          {showPicker && companies.length > 1 && (
            <div className="absolute left-3 right-3 top-full mt-1 bg-white border border-[#E8E4DC] rounded-lg shadow-lg z-50 overflow-hidden">
              {companies.map((c: MeCompany) => (
                <button
                  key={c.id}
                  onClick={() => { switchCompany(c); setShowPicker(false); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-[#F0EDE8] transition-colors"
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-[#1A9E68]/10 text-[#1A9E68] font-medium"
                  : "text-[#4A4A4A] hover:bg-[#F0EDE8] hover:text-[#1A1A1A]"
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div className="px-3 py-3 border-t border-[#E8E4DC]">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#6B6B6B] truncate">
            {user?.email ?? user?.name ?? "—"}
          </span>
          <button
            onClick={logout}
            title="Se déconnecter"
            className="p-1.5 rounded-md hover:bg-[#F0EDE8] text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}

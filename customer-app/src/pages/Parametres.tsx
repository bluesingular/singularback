import { useAuth } from "../auth/AuthContext";
import { Settings } from "lucide-react";

export default function Parametres() {
  const { user, activeCompany } = useAuth();

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="w-5 h-5 text-[#1A9E68]" />
        <h1 className="font-serif text-2xl text-[#1A1A1A]">Paramètres</h1>
      </div>

      <div className="bg-white border border-[#E8E4DC] rounded-xl divide-y divide-[#F0EDE8]">
        <div className="px-4 py-3">
          <p className="text-xs text-[#6B6B6B]">Compte</p>
          <p className="text-sm font-medium text-[#1A1A1A] mt-0.5">{user?.name ?? "—"}</p>
          <p className="text-xs text-[#6B6B6B]">{user?.email ?? "—"}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-[#6B6B6B]">Entreprise</p>
          <p className="text-sm font-medium text-[#1A1A1A] mt-0.5">{activeCompany?.name ?? "—"}</p>
          <p className="text-xs text-[#6B6B6B]">Plan {activeCompany?.plan ?? "—"} · {activeCompany?.role ?? "—"}</p>
        </div>
      </div>

      <div className="bg-white border border-[#E8E4DC] rounded-xl p-4">
        <h2 className="text-sm font-semibold text-[#1A1A1A] mb-3">ADN de l'entreprise</h2>
        <p className="text-xs text-[#6B6B6B]">
          La configuration complète de l'ADN (voix de marque, services, clients clés) est disponible dans l'interface d'administration.
        </p>
      </div>
    </div>
  );
}

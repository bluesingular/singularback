/**
 * WAR-10 — Dispatcher health indicator.
 *
 * Always-visible in the sidebar top area.
 * Three states:
 *   🟢 "Tous les agents actifs"
 *   🟡 "[N] intégrations à vérifier"
 *   🔴 "Agents arrêtés"
 *
 * Polls /api/v1/health every 60s. Click → modal with queue details.
 * Spec: §11.8
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { healthApi, type PlatformHealth } from "../api/client";

function deriveState(health: PlatformHealth): "ok" | "warn" | "error" {
  if (health.redis === "degraded" || health.postgres === "degraded" || health.workers === "degraded") {
    return "error";
  }
  const disconnected = health.integrations.filter((i) => !i.connected).length;
  if (disconnected > 0) return "warn";
  return "ok";
}

const STATE_CONFIG = {
  ok:    { dot: "bg-[#1A9E68]",  label: "Tous les agents actifs" },
  warn:  { dot: "bg-[#D97706]",  label: "Intégrations à vérifier" },
  error: { dot: "bg-[#EF4444]",  label: "Agents arrêtés" },
};

export function DispatcherHealth() {
  const [panelOpen, setPanelOpen] = useState(false);

  const { data, isError } = useQuery({
    queryKey: ["platform-health"],
    queryFn: () => healthApi.platform().then((r) => r.data),
    refetchInterval: 60_000,
    retry: false,
  });

  if (isError || !data) return null;

  const state = deriveState(data);
  const { dot, label } = STATE_CONFIG[state];
  const disconnectedIntegrations = data.integrations.filter((i) => !i.connected);

  return (
    <>
      <button
        onClick={() => setPanelOpen(true)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#F0EDE8] transition-colors text-left"
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot} ${state === "ok" ? "" : "animate-pulse"}`} />
        <span className="text-xs text-[#6B6B6B] truncate">{label}</span>
      </button>

      {panelOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/20">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 mb-4 sm:mb-0 p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#1A1A1A]">État de la plateforme</h3>
              <button onClick={() => setPanelOpen(false)} className="text-[#6B6B6B] hover:text-[#1A1A1A]">
                <X size={16} />
              </button>
            </div>

            {/* Core services */}
            <div className="flex flex-col gap-2">
              {[
                { label: "File de travail", value: data.redis },
                { label: "Base de données", value: data.postgres },
                { label: "Agents", value: data.workers },
              ].map(({ label: l, value }) => (
                <div key={l} className="flex items-center justify-between text-sm">
                  <span className="text-[#3A3A3A]">{l}</span>
                  <span className={`font-medium ${value === "ok" ? "text-[#1A9E68]" : "text-[#EF4444]"}`}>
                    {value === "ok" ? "Actif" : "Problème détecté"}
                  </span>
                </div>
              ))}
            </div>

            {/* Integrations */}
            {data.integrations.length > 0 && (
              <div className="border-t border-[#E8E4DC] pt-3 flex flex-col gap-1.5">
                <p className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wide mb-1">Intégrations</p>
                {data.integrations.map((intg) => (
                  <div key={intg.slug} className="flex items-center justify-between text-sm">
                    <span className="text-[#3A3A3A] capitalize">{intg.slug.replace(/_/g, " ")}</span>
                    <span className={`font-medium ${intg.connected ? "text-[#1A9E68]" : "text-[#EF4444]"}`}>
                      {intg.connected ? "Connectée" : "Déconnectée"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {disconnectedIntegrations.length > 0 && (
              <p className="text-xs text-[#6B6B6B] bg-[#FFF7ED] rounded-lg px-3 py-2">
                Reconnectez vos intégrations dans Paramètres pour que votre équipe continue normalement.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

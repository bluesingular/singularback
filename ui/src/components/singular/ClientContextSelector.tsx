/**
 * ui/src/components/singular/ClientContextSelector.tsx
 *
 * §35 Delivery Partner — client context selector dropdown.
 *
 * Shows only when the company has client contexts (delivery partner accounts).
 * Selecting a context scopes the CEO Console to that client's data.
 * "Firm" = null = show firm-level data (not scoped to any client).
 *
 * Renders nothing if company has no client contexts (standard operator view).
 */

import { useQuery } from "@tanstack/react-query";
import { Building2, ChevronDown, Settings2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { ClientDNAWizard } from "./ClientDNAWizard";

interface ClientContext {
  id:     string;
  name:   string;
  slug:   string;
  status: "active" | "paused" | "archived";
}

async function fetchClientContexts(companyId: string): Promise<ClientContext[]> {
  const res = await fetch(`/api/companies/${companyId}/client-contexts`, {
    credentials: "include",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.contexts ?? []).filter((c: ClientContext) => c.status === "active");
}

interface Props {
  companyId: string;
  value:     string | null;
  onChange:  (id: string | null) => void;
}

export function ClientContextSelector({ companyId, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [wizardContextId, setWizardContextId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const { data: contexts = [] } = useQuery({
    queryKey:  ["client-contexts", companyId],
    queryFn:   () => fetchClientContexts(companyId),
    staleTime: 60_000,
  });

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Don't render if no client contexts (standard operator)
  if (contexts.length === 0) return null;

  const selected = contexts.find((c) => c.id === value);
  const label = selected ? selected.name : "Firm";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium hover:bg-[#F0EDE8] transition-colors"
        style={{ borderColor: "#E8E4DC", color: "#0F0F0D", backgroundColor: "#FFFFFF" }}
      >
        <Building2 size={12} style={{ color: "#8A8680" }} />
        <span className="max-w-[100px] truncate">{label}</span>
        <ChevronDown size={11} style={{ color: "#8A8680" }} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 rounded-xl border shadow-lg overflow-hidden min-w-[160px]"
          style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E4DC" }}
        >
          {/* Firm-level option */}
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            className={`w-full text-left px-3 py-2 text-xs hover:bg-[#FAFAF8] transition-colors flex items-center gap-2 ${!value ? "font-semibold text-[#0F0F0D]" : "text-[#8A8680]"}`}
          >
            <span className="w-1.5 h-1.5 rounded-full flex-none" style={{ backgroundColor: !value ? "#1A9E68" : "transparent" }} />
            Firm (all clients)
          </button>

          <div className="h-px" style={{ backgroundColor: "#E8E4DC" }} />

          {contexts.map((ctx) => (
            <div key={ctx.id} className="flex items-center">
              <button
                onClick={() => { onChange(ctx.id); setOpen(false); }}
                className={`flex-1 text-left px-3 py-2 text-xs hover:bg-[#FAFAF8] transition-colors flex items-center gap-2 ${value === ctx.id ? "font-semibold text-[#0F0F0D]" : "text-[#8A8680]"}`}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-none" style={{ backgroundColor: value === ctx.id ? "#1A9E68" : "transparent" }} />
                <span className="truncate">{ctx.name}</span>
              </button>
              {/* DNA mini-wizard trigger */}
              <button
                onClick={(e) => { e.stopPropagation(); setOpen(false); setWizardContextId(ctx.id); }}
                className="px-2 py-2 hover:bg-[#FAFAF8] transition-colors"
                title="Edit client DNA"
              >
                <Settings2 size={11} style={{ color: "#8A8680" }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Client DNA wizard modal */}
      {wizardContextId && (
        <ClientDNAWizard
          companyId={companyId}
          contextId={wizardContextId}
          onClose={() => setWizardContextId(null)}
        />
      )}
    </div>
  );
}

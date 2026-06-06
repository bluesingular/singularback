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

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, ChevronDown, Settings2, Plus } from "lucide-react";
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

async function createClientContext(companyId: string, name: string): Promise<{ id: string }> {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const res = await fetch(`/api/companies/${companyId}/client-contexts`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, slug: `${slug}-${Date.now().toString(36)}` }),
  });
  if (!res.ok) throw new Error("Failed to create client");
  return res.json();
}

export function ClientContextSelector({ companyId, value, onChange }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [wizardContextId, setWizardContextId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const { data: contexts = [] } = useQuery({
    queryKey:  ["client-contexts", companyId],
    queryFn:   () => fetchClientContexts(companyId),
    staleTime: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => createClientContext(companyId, name),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["client-contexts", companyId] });
      setCreating(false);
      setNewName("");
      onChange(data.id);
      setOpen(false);
      // Open DNA wizard for the new context
      setWizardContextId(data.id);
    },
  });

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setNewName("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const selected = contexts.find((c) => c.id === value);
  const label = selected ? selected.name : contexts.length === 0 ? "Clients" : "Firm";

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
              <button
                onClick={(e) => { e.stopPropagation(); setOpen(false); setWizardContextId(ctx.id); }}
                className="px-2 py-2 hover:bg-[#FAFAF8] transition-colors"
                title="Edit client DNA"
              >
                <Settings2 size={11} style={{ color: "#8A8680" }} />
              </button>
            </div>
          ))}

          {/* New client */}
          <div className="h-px" style={{ backgroundColor: "#E8E4DC" }} />
          {creating ? (
            <div className="px-3 py-2 flex items-center gap-1.5">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newName.trim()) createMutation.mutate(newName.trim());
                  if (e.key === "Escape") { setCreating(false); setNewName(""); }
                }}
                placeholder="Client name…"
                className="flex-1 text-xs px-2 py-1 rounded-md border outline-none focus:border-[#1A9E68]"
                style={{ borderColor: "#E8E4DC" }}
              />
              <button
                onClick={() => { if (newName.trim()) createMutation.mutate(newName.trim()); }}
                disabled={!newName.trim() || createMutation.isPending}
                className="text-xs font-semibold px-2 py-1 rounded-md disabled:opacity-40"
                style={{ backgroundColor: "#1A9E68", color: "#FFFFFF" }}
              >
                {createMutation.isPending ? "…" : "Add"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="w-full text-left px-3 py-2 text-xs text-[#1A9E68] hover:bg-[#FAFAF8] transition-colors flex items-center gap-1.5 font-medium"
            >
              <Plus size={11} />
              New client
            </button>
          )}
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

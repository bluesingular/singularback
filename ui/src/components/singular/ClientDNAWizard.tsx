/**
 * ui/src/components/singular/ClientDNAWizard.tsx
 *
 * §35 Delivery Partner — client DNA mini-wizard.
 *
 * A compact modal/panel for setting a client context's DNA fields
 * (sector, objectives, constraints, key contacts).
 * Rendered from CEO Console when a client context is active.
 */

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Save, Building2 } from "lucide-react";

interface ClientContext {
  id:        string;
  name:      string;
  slug:      string;
  clientDna: Record<string, string>;
}

async function fetchContext(companyId: string, ctxId: string): Promise<ClientContext> {
  const res = await fetch(`/api/companies/${companyId}/client-contexts/${ctxId}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to load client context");
  return res.json();
}

async function patchDna(companyId: string, ctxId: string, clientDna: Record<string, string>): Promise<void> {
  const res = await fetch(`/api/companies/${companyId}/client-contexts/${ctxId}`, {
    method: "PATCH", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientDna }),
  });
  if (!res.ok) throw new Error("Failed to save");
}

const DNA_FIELDS: Array<{ key: string; label: string; placeholder: string; multiline?: boolean }> = [
  { key: "sector",       label: "Sector / Industry",    placeholder: "e.g. IT Consulting, Retail..." },
  { key: "objectives",   label: "Main objectives",      placeholder: "What this client wants to achieve", multiline: true },
  { key: "constraints",  label: "Constraints",          placeholder: "Budget, timeline, compliance requirements" },
  { key: "key_contacts", label: "Key contacts",         placeholder: "Decision maker names and roles" },
  { key: "notes",        label: "Additional context",   placeholder: "Anything else the team should know", multiline: true },
];

interface Props {
  companyId: string;
  contextId: string;
  onClose:   () => void;
}

export function ClientDNAWizard({ companyId, contextId, onClose }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const { data: ctx, isLoading } = useQuery({
    queryKey: ["client-context", contextId],
    queryFn:  () => fetchContext(companyId, contextId),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (ctx?.clientDna) setForm(ctx.clientDna as Record<string, string>);
  }, [ctx]);

  const mutation = useMutation({
    mutationFn: () => patchDna(companyId, contextId, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-context", contextId] });
      qc.invalidateQueries({ queryKey: ["client-contexts", companyId] });
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1200);
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,15,13,0.4)" }}>
      <div className="w-full max-w-lg rounded-2xl shadow-xl flex flex-col max-h-[90vh]"
        style={{ backgroundColor: "#FFFFFF" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#E8E4DC" }}>
          <div className="flex items-center gap-2">
            <Building2 size={16} color="#8A8680" />
            <div>
              <p className="text-sm font-semibold text-[#0F0F0D]">
                {isLoading ? "Loading…" : ctx?.name ?? "Client context"}
              </p>
              <p className="text-xs text-[#8A8680]">Client DNA — context for your team</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F0EDE8] transition-colors">
            <X size={15} color="#8A8680" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {isLoading ? (
            <p className="text-sm text-[#8A8680] text-center py-8">Loading…</p>
          ) : DNA_FIELDS.map(({ key, label, placeholder, multiline }) => (
            <div key={key}>
              <label className="text-xs font-medium text-[#8A8680] block mb-1">{label}</label>
              {multiline ? (
                <textarea
                  value={form[key] ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  rows={3}
                  className="w-full text-sm px-3 py-2 rounded-lg border outline-none focus:border-[#1A9E68] resize-none"
                  style={{ borderColor: "#E8E4DC" }}
                />
              ) : (
                <input
                  type="text"
                  value={form[key] ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full text-sm px-3 py-2 rounded-lg border outline-none focus:border-[#1A9E68]"
                  style={{ borderColor: "#E8E4DC" }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: "#E8E4DC" }}>
          <button onClick={onClose} className="text-xs font-medium px-4 py-2 rounded-lg text-[#8A8680] hover:bg-[#F0EDE8]">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-40"
            style={{ backgroundColor: "#1A9E68", color: "#FFFFFF" }}>
            <Save size={12} />
            {saved ? "Saved ✓" : mutation.isPending ? "Saving…" : "Save DNA"}
          </button>
        </div>
      </div>
    </div>
  );
}

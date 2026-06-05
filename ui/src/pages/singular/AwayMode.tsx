import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Moon, Sun, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { useCompany } from "../../context/CompanyContext";
import { useToastActions } from "../../context/ToastContext";
import { awayModeApi } from "../../api/awayMode";

function pad(n: number) { return String(n).padStart(2, "0"); }
function toDatetimeLocal(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function toISO(s: string) { return new Date(s).toISOString(); }

export function AwayMode() {
  const { selectedCompanyId } = useCompany();
  const { pushToast } = useToastActions();
  const qc = useQueryClient();

  const now   = new Date();
  const later = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [startsAt, setStartsAt] = useState(toDatetimeLocal(now));
  const [endsAt,   setEndsAt]   = useState(toDatetimeLocal(later));

  const { data, isLoading } = useQuery({
    queryKey: ["away-mode", selectedCompanyId],
    queryFn:  () => awayModeApi.get(selectedCompanyId!),
    enabled:  !!selectedCompanyId,
  });

  const { data: briefingData } = useQuery({
    queryKey: ["away-mode-briefing", selectedCompanyId],
    queryFn:  () => awayModeApi.briefing(selectedCompanyId!),
    enabled:  !!selectedCompanyId && data?.away === false && !!data?.period,
  });

  const setMutation = useMutation({
    mutationFn: () => awayModeApi.set(selectedCompanyId!, toISO(startsAt), toISO(endsAt)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["away-mode", selectedCompanyId] });
      pushToast({ title: "Away mode activated", tone: "success" });
    },
    onError: () => pushToast({ title: "Could not activate away mode", tone: "error" }),
  });

  const cancelMutation = useMutation({
    mutationFn: () => awayModeApi.cancel(selectedCompanyId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["away-mode", selectedCompanyId] });
      pushToast({ title: "Away mode cancelled", tone: "success" });
    },
    onError: () => pushToast({ title: "Could not cancel", tone: "error" }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#1A9E68" }} />
      </div>
    );
  }

  const isAway = data?.away ?? false;

  return (
    <div className="min-h-full px-6 py-6" style={{ backgroundColor: "#FAFAF8" }}>
      <h1 className="text-2xl mb-2" style={{ fontFamily: "Georgia, serif", color: "#0F0F0D" }}>
        Away mode
      </h1>
      <p className="text-sm mb-8" style={{ color: "#8A8680" }}>
        When you're away, your agents act within pre-approved parameters. Non-routine items queue for your return.
      </p>

      {/* Status card */}
      <div
        className="rounded-2xl border p-6 mb-6 max-w-xl"
        style={{
          backgroundColor: isAway ? "#F0F9F4" : "#FFFFFF",
          borderColor:     isAway ? "#C6E9D8" : "#E8E4DC",
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          {isAway
            ? <Moon size={20} style={{ color: "#1A9E68" }} />
            : <Sun  size={20} style={{ color: "#C97C0A" }} />}
          <p className="text-base font-semibold" style={{ color: "#0F0F0D" }}>
            {isAway ? "Away mode active" : "You are present"}
          </p>
        </div>

        {isAway && data?.period && (
          <p className="text-sm mb-4" style={{ color: "#4B4846" }}>
            Until{" "}
            <strong>{new Date(data.period.endsAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</strong>
          </p>
        )}

        {isAway ? (
          <button
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
            className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl border transition-colors hover:bg-red-50 hover:border-red-200 hover:text-red-600 disabled:opacity-50"
            style={{ borderColor: "#E8E4DC", color: "#8A8680" }}
          >
            {cancelMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sun size={14} />}
            Cancel away mode
          </button>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#8A8680" }}>From</label>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={e => setStartsAt(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border text-sm outline-none focus:border-[#1A9E68]"
                  style={{ borderColor: "#E8E4DC", color: "#0F0F0D" }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#8A8680" }}>Until</label>
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={e => setEndsAt(e.target.value)}
                  min={startsAt}
                  className="w-full px-3 py-2 rounded-xl border text-sm outline-none focus:border-[#1A9E68]"
                  style={{ borderColor: "#E8E4DC", color: "#0F0F0D" }}
                />
              </div>
            </div>
            <button
              onClick={() => setMutation.mutate()}
              disabled={setMutation.isPending || !startsAt || !endsAt}
              className="flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-xl transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "#0F0F0D", color: "#FFFFFF" }}
            >
              {setMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Moon size={14} />}
              Activate away mode
            </button>
          </div>
        )}
      </div>

      {/* What happens during away mode */}
      <div className="max-w-xl space-y-3">
        <h2 className="text-sm font-semibold" style={{ color: "#0F0F0D" }}>What your team does while you're away</h2>
        {[
          { icon: CheckCircle2, color: "#1A9E68", text: "Routine tasks continue automatically within approved parameters" },
          { icon: CheckCircle2, color: "#1A9E68", text: "Low-risk actions execute without waiting for your approval" },
          { icon: AlertTriangle, color: "#C97C0A", text: "Non-routine items are queued — nothing sensitive happens without you" },
          { icon: CheckCircle2, color: "#1A9E68", text: "On your return: a briefing of what was handled and what needs you" },
        ].map(({ icon: Icon, color, text }, i) => (
          <div key={i} className="flex items-start gap-3">
            <Icon size={15} className="mt-0.5 flex-shrink-0" style={{ color }} />
            <p className="text-sm" style={{ color: "#4B4846" }}>{text}</p>
          </div>
        ))}
      </div>

      {/* Catch-up briefing on return */}
      {briefingData?.briefing && (
        <div
          className="mt-8 max-w-xl rounded-2xl border p-5"
          style={{ backgroundColor: "#FFFFFF", borderColor: "#E8E4DC" }}
        >
          <h2 className="text-sm font-semibold mb-3" style={{ color: "#0F0F0D" }}>
            Catch-up briefing
          </h2>
          <pre className="text-sm whitespace-pre-wrap" style={{ color: "#4B4846", fontFamily: "inherit" }}>
            {briefingData.briefing}
          </pre>
        </div>
      )}
    </div>
  );
}

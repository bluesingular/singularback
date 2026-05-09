import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, X, Check, CheckCheck, ChevronRight } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { notificationsApi, type Notification } from "../api/notifications";
import { useNavigate } from "@/lib/router";
import { cn } from "../lib/utils";

const TYPE_LABELS: Record<Notification["type"], string> = {
  approval_pending: "Approbation requise",
  trust_proposal:   "Proposition de confiance",
  trust_downgrade:  "Supervision augmentée",
  intelligence:     "Intelligence",
  agent_error:      "Erreur agent",
  budget_alert:     "Alerte budget",
};

const TYPE_COLOR: Record<Notification["type"], string> = {
  approval_pending: "bg-[#C97C0A]",
  trust_proposal:   "bg-[#1A4E8C]",
  trust_downgrade:  "bg-[#C97C0A]",
  intelligence:     "bg-[#1A9E68]",
  agent_error:      "bg-red-500",
  budget_alert:     "bg-[#C97C0A]",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs} h`;
  return `il y a ${Math.floor(hrs / 24)} j`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { selectedCompanyId } = useCompany();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications", "unread", selectedCompanyId],
    queryFn: () => notificationsApi.listUnread(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 30_000,
  });

  const { data: allData } = useQuery({
    queryKey: ["notifications", "all", selectedCompanyId],
    queryFn: () => notificationsApi.listAll(selectedCompanyId!),
    enabled: !!selectedCompanyId && open,
  });

  // selectedCompanyId is guaranteed non-null here: this component only renders
  // inside the authenticated SingularSidebar, which requires a resolved company.
  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(selectedCompanyId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications", "unread", selectedCompanyId] });
      qc.invalidateQueries({ queryKey: ["notifications", "all", selectedCompanyId] });
    },
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => notificationsApi.dismiss(selectedCompanyId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications", "unread", selectedCompanyId] });
      qc.invalidateQueries({ queryKey: ["notifications", "all", selectedCompanyId] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(selectedCompanyId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications", "unread", selectedCompanyId] });
      qc.invalidateQueries({ queryKey: ["notifications", "all", selectedCompanyId] });
    },
  });

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const unreadCount = data?.unreadCount ?? 0;
  const items = allData?.notifications ?? data?.notifications ?? [];

  function handleNotificationClick(n: Notification) {
    if (n.status === "unread") markRead.mutate(n.id);
    if (n.actionUrl) {
      navigate(n.actionUrl);
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg hover:bg-[#F0EDE6] text-[#4B4846] transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-[#C97C0A] text-white text-[10px] font-semibold leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-full top-0 ml-2 w-80 bg-white border border-[#E8E4DC] rounded-xl shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8E4DC]">
            <span className="text-sm font-semibold text-[#0F0F0D] font-[Georgia,serif]">
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="flex items-center gap-1 text-xs text-[#1A9E68] hover:underline"
              >
                <CheckCheck className="h-3 w-3" />
                Tout lire
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-[#F0EDE6]">
            {items.length === 0 ? (
              <div className="py-8 text-center text-sm text-[#8A8680]">
                Aucune notification pour l'instant
              </div>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "flex gap-3 px-4 py-3 group hover:bg-[#FAFAF8] transition-colors",
                    n.status === "unread" && "bg-[#F7F6F2]",
                  )}
                >
                  {/* Type dot */}
                  <span
                    className={cn(
                      "mt-1 flex-shrink-0 w-2 h-2 rounded-full",
                      TYPE_COLOR[n.type],
                    )}
                  />

                  {/* Content */}
                  <button
                    className="flex-1 text-left min-w-0"
                    onClick={() => handleNotificationClick(n)}
                  >
                    <p className="text-xs font-medium text-[#8A8680] uppercase tracking-wide mb-0.5">
                      {TYPE_LABELS[n.type]}
                    </p>
                    <p className="text-sm font-medium text-[#0F0F0D] leading-snug">
                      {n.title}
                    </p>
                    <p className="text-xs text-[#4B4846] mt-0.5 line-clamp-2 leading-relaxed">
                      {n.body}
                    </p>
                    <p className="text-xs text-[#8A8680] mt-1">{timeAgo(n.createdAt)}</p>
                  </button>

                  {/* Actions */}
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {n.actionUrl && (
                      <button
                        onClick={() => handleNotificationClick(n)}
                        className="p-1 rounded hover:bg-[#E8E4DC] text-[#4B4846]"
                        title="Ouvrir"
                      >
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      onClick={() => dismiss.mutate(n.id)}
                      className="p-1 rounded hover:bg-[#E8E4DC] text-[#4B4846]"
                      title="Ignorer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    {n.status === "unread" && (
                      <button
                        onClick={() => markRead.mutate(n.id)}
                        className="p-1 rounded hover:bg-[#E8E4DC] text-[#4B4846]"
                        title="Marquer lu"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

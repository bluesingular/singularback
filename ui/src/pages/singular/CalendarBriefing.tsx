/**
 * ui/src/pages/singular/CalendarBriefing.tsx
 *
 * §19 — Calendar Intelligence: pre-meeting briefing.
 *
 * This page is surfaced two ways:
 *   1. Directly (path: "briefing-reunion") — operator pastes/enters an event
 *   2. As a card triggered 30 min before a calendar event (future: push notification)
 *
 * Shows: last contact, open items, relationship health indicator,
 *         context notes, and "watch for" points from org memory.
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Calendar, CheckCircle2, Clock, AlertCircle,
  ChevronRight, RotateCcw, MessageCircle,
} from "lucide-react";
import { useCompany } from "../../context/CompanyContext";
import { calendarIntelligenceApi, type PreMeetingBriefing } from "../../api/calendarIntelligence";

function HealthBadge({ h }: { h: "good" | "needs_attention" | "at_risk" }) {
  const map = {
    good:             { label: "Healthy",       cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    needs_attention:  { label: "Needs attention",          cls: "bg-amber-50 text-amber-700 border-amber-200" },
    at_risk:          { label: "Relationship at risk",    cls: "bg-red-50 text-red-700 border-red-200" },
  };
  const { label, cls } = map[h];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {label}
    </span>
  );
}

function BriefingView({ b }: { b: PreMeetingBriefing }) {
  const lastDate = b.lastContact
    ? new Date(b.lastContact.date)
    : null;
  const daysAgo = lastDate
    ? Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Contact header */}
      <div className="rounded-2xl bg-white border border-stone-100 p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#1A4E8C]/10 flex items-center justify-center">
              <span className="text-sm font-semibold text-[#1A4E8C]">
                {b.contactName.charAt(0).toUpperCase()}
              </span>
            </div>
            <p className="font-semibold text-[#0F0F0D]">{b.contactName}</p>
          </div>
          <HealthBadge h={b.relationshipHealth} />
        </div>

        {/* Last contact */}
        <div className="flex items-center gap-2 text-sm text-stone-500">
          <Clock size={12} />
          {daysAgo !== null
            ? `Last contact ${daysAgo} jour${daysAgo > 1 ? "s" : ""}`
            : "No contact on record"}
        </div>

        {b.lastContact && (
          <div className="rounded-lg bg-stone-50 border border-stone-100 p-3">
            <p className="text-xs text-stone-400 mb-1">Last exchange</p>
            <p className="text-sm text-stone-600 italic">"{b.lastContact.summary}"</p>
          </div>
        )}
      </div>

      {/* Open items */}
      {b.openItems.length > 0 && (
        <div className="rounded-xl bg-white border border-stone-100 p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={13} className="text-[#1A4E8C]" />
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Open items</p>
          </div>
          <div className="flex flex-col gap-1.5">
            {b.openItems.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-[#0F0F0D]">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#1A4E8C] flex-shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Context notes */}
      {b.contextNotes.length > 0 && (
        <div className="rounded-xl bg-white border border-stone-100 p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <MessageCircle size={13} className="text-stone-400" />
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Remembered context</p>
          </div>
          <div className="flex flex-col gap-1.5">
            {b.contextNotes.slice(0, 3).map((note, i) => (
              <p key={i} className="text-sm text-stone-600">— {note}</p>
            ))}
          </div>
        </div>
      )}

      {/* Watch for */}
      {b.watchFor.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle size={13} className="text-amber-500" />
            <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">Watch for</p>
          </div>
          <div className="flex flex-col gap-1.5">
            {b.watchFor.map((w, i) => (
              <p key={i} className="text-sm text-amber-700">• {w}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CalendarBriefing() {
  const { selectedCompanyId } = useCompany();

  const [contactName, setContactName]   = useState("");
  const [eventTitle,  setEventTitle]    = useState("");
  const [startAt,     setStartAt]       = useState("");
  const [briefing,    setBriefing]      = useState<PreMeetingBriefing | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      const start = startAt ? new Date(startAt).toISOString() : new Date().toISOString();
      const end   = new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString();
      return calendarIntelligenceApi.briefing(selectedCompanyId!, {
        id:          Date.now().toString(),
        title:       eventTitle || `Meeting with ${contactName}`,
        startAt:     start,
        endAt:       end,
        attendees:   [],
        contactName: contactName,
      });
    },
    onSuccess: (res) => setBriefing(res.data),
  });

  const canSubmit = contactName.trim().length > 0;

  return (
    <div className="min-h-screen bg-[#FAFAF7] px-4 py-8 flex flex-col items-center">
      <div className="w-full max-w-md flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1A4E8C]/10 flex items-center justify-center">
            <Calendar size={18} className="text-[#1A4E8C]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[#0F0F0D]">Pre-meeting briefing</h1>
            <p className="text-sm text-stone-500">Full context before your meeting.</p>
          </div>
        </div>

        {!briefing ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                Contact name *
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Marie Dupont"
                className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-[#0F0F0D] placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-[#1A4E8C]/30"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                Meeting title
              </label>
              <input
                type="text"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder="Point mensuel"
                className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-[#0F0F0D] placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-[#1A4E8C]/30"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                Meeting time
              </label>
              <input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-[#0F0F0D] focus:outline-none focus:ring-2 focus:ring-[#1A4E8C]/30"
              />
            </div>

            <button
              onClick={() => mutation.mutate()}
              disabled={!canSubmit || mutation.isPending}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1A4E8C] text-white font-medium text-sm hover:bg-[#153F70] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {mutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Preparing…
                </>
              ) : (
                <>Prepare briefing <ChevronRight size={16} /></>
              )}
            </button>

            {mutation.isError && (
              <p className="text-sm text-red-600 text-center">
                Preparation failed. Please try again.
              </p>
            )}
          </div>
        ) : (
          <>
            <BriefingView b={briefing} />
            <button
              onClick={() => { setBriefing(null); setContactName(""); setEventTitle(""); setStartAt(""); }}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-sm hover:bg-stone-50 transition-colors"
            >
              <RotateCcw size={13} /> New briefing
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * ui/src/pages/singular/PartnerDashboard.tsx
 *
 * §34 Partner Programme — partner dashboard.
 *
 * Shows: partner profile, referred companies, per-company health metrics.
 * SECURITY: displays health metrics only — NO operational data, NO agent outputs.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../../context/CompanyContext";
import { Building2, BadgeCheck, TrendingUp, Users, AlertTriangle, ChevronRight, Palette, Save } from "lucide-react";
import { useState, useEffect } from "react";

// ── API helpers ───────────────────────────────────────────────────────────────

interface WhiteLabelConfig {
  brandName:     string;
  logoUrl?:      string;
  primaryColour?: string;
  supportEmail?: string;
  customDomain?: string;
  showPoweredBy: boolean;
}

async function fetchWhiteLabel(): Promise<WhiteLabelConfig | null> {
  const res = await fetch("/api/partners/me/white-label", { credentials: "include" });
  if (!res.ok) return null;
  const data = await res.json();
  return data.config ?? null;
}

async function saveWhiteLabel(config: WhiteLabelConfig): Promise<void> {
  const res = await fetch("/api/partners/me/white-label", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error("Failed to save");
}

async function fetchPartnerProfile() {
  const res = await fetch("/api/partners/me", { credentials: "include" });
  if (!res.ok) throw new Error("Not a partner account");
  return res.json() as Promise<{
    ok: boolean;
    partner: { isPartner: boolean; partnerCertifiedAt: string | null; partnerTier: string | null };
  }>;
}

async function fetchReferrals() {
  const res = await fetch("/api/partners/me/referrals", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load referrals");
  return res.json() as Promise<{
    ok: boolean;
    referrals: Array<{
      id: string;
      name: string;
      plan: string;
      createdAt: string;
      referralFeePaid: boolean;
    }>;
  }>;
}

async function fetchCompanyHealth(companyId: string) {
  const res = await fetch(`/api/partners/me/referrals/${companyId}/health`, {
    credentials: "include",
  });
  if (!res.ok) return null;
  return res.json();
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, string> = {
    solo:       "bg-gray-100 text-gray-600",
    growth:     "bg-blue-100 text-blue-700",
    pro:        "bg-purple-100 text-purple-700",
    enterprise: "bg-amber-100 text-amber-700",
  };
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${colors[plan] ?? colors.growth}`}>
      {plan}
    </span>
  );
}

function CompanyHealthRow({ company }: { company: { id: string; name: string; plan: string; createdAt: string; referralFeePaid: boolean } }) {
  const [expanded, setExpanded] = useState(false);

  const { data: health } = useQuery({
    queryKey: ["partner-health", company.id],
    queryFn: () => fetchCompanyHealth(company.id),
    enabled: expanded,
    staleTime: 5 * 60_000,
  });

  const daysSinceJoined = Math.floor(
    (Date.now() - new Date(company.createdAt).getTime()) / 86_400_000,
  );
  const feeEligible = daysSinceJoined >= 60 && !company.referralFeePaid;

  return (
    <div className="border rounded-xl overflow-hidden" style={{ borderColor: "#E8E4DC" }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#FAFAF8] transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#1A9E6815] flex items-center justify-center">
            <Building2 size={15} color="#1A9E68" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#0F0F0D]">{company.name}</p>
            <p className="text-xs text-[#8A8680]">
              Joined {daysSinceJoined}d ago
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PlanBadge plan={company.plan} />
          {feeEligible && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              Fee due
            </span>
          )}
          {company.referralFeePaid && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
              Paid
            </span>
          )}
          <ChevronRight size={14} className={`text-[#8A8680] transition-transform ${expanded ? "rotate-90" : ""}`} />
        </div>
      </button>

      {expanded && (
        <div className="border-t px-4 py-3 bg-[#FAFAF8]" style={{ borderColor: "#E8E4DC" }}>
          {!health ? (
            <p className="text-xs text-[#8A8680]">Loading health metrics…</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Metric label="Tasks this month" value={`${health.tasksUsedMonth ?? 0} / ${health.tasksLimitMonth ?? 0}`} />
              <Metric label="Autonomous %" value={health.autonomousPct != null ? `${Math.round(health.autonomousPct)}%` : "—"} />
              <Metric label="Embedding score" value={health.embeddingScore != null ? `${health.embeddingScore}/100` : "—"} />
              <Metric label="Status" value={health.embeddingScore >= 60 ? "Healthy" : health.embeddingScore >= 20 ? "Growing" : "At risk"}
                highlight={health.embeddingScore < 20 ? "amber" : "green"} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: "green" | "amber" }) {
  return (
    <div>
      <p className="text-[11px] text-[#8A8680] mb-0.5">{label}</p>
      <p className={`text-sm font-semibold ${
        highlight === "amber" ? "text-amber-600" :
        highlight === "green" ? "text-[#1A9E68]" :
        "text-[#0F0F0D]"
      }`}>{value}</p>
    </div>
  );
}

// ── White-label config form ───────────────────────────────────────────────────

function WhiteLabelForm() {
  const qc = useQueryClient();
  const { data: current } = useQuery({
    queryKey: ["partner-white-label"],
    queryFn: fetchWhiteLabel,
    retry: false,
  });

  const [form, setForm] = useState<WhiteLabelConfig>({
    brandName: "", logoUrl: "", primaryColour: "", supportEmail: "", customDomain: "", showPoweredBy: true,
  });
  const [saved, setSaved] = useState(false);

  // Sync form with fetched data
  useEffect(() => { if (current) setForm(current); }, [current]);

  const mutation = useMutation({
    mutationFn: saveWhiteLabel,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partner-white-label"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  function field(label: string, key: keyof WhiteLabelConfig, type = "text", placeholder = "") {
    return (
      <div>
        <label className="text-xs font-medium text-[#8A8680] block mb-1">{label}</label>
        {type === "checkbox" ? (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form[key] as boolean}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
              className="w-4 h-4 rounded" />
            <span className="text-sm text-[#0F0F0D]">Show "Powered by Swwarm"</span>
          </label>
        ) : (
          <input type={type} value={(form[key] as string) ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            placeholder={placeholder}
            className="w-full text-sm px-3 py-2 rounded-lg border outline-none focus:border-[#1A9E68]"
            style={{ borderColor: "#E8E4DC", backgroundColor: "#FFFFFF" }} />
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border p-5 space-y-4" style={{ borderColor: "#E8E4DC", backgroundColor: "#FFFFFF" }}>
      <div className="flex items-center gap-2 mb-1">
        <Palette size={16} color="#8A8680" />
        <h2 className="text-sm font-semibold text-[#0F0F0D]">White-label configuration</h2>
      </div>
      <p className="text-xs text-[#8A8680]">
        Compliance and AI Act documentation always identifies Swwarm (Singular.blue) as processor — white-label does not extend to compliance.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {field("Brand name", "brandName", "text", "My Platform")}
        {field("Logo URL", "logoUrl", "url", "https://...")}
        {field("Primary colour", "primaryColour", "text", "#1A9E68")}
        {field("Support email", "supportEmail", "email", "support@example.com")}
        {field("Custom domain", "customDomain", "text", "app.myplatform.com")}
        <div className="sm:col-span-2">{field("", "showPoweredBy", "checkbox")}</div>
      </div>
      <button
        onClick={() => mutation.mutate(form)}
        disabled={mutation.isPending || !form.brandName}
        className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-40"
        style={{ backgroundColor: "#1A9E68", color: "#FFFFFF" }}>
        <Save size={12} />
        {saved ? "Saved" : mutation.isPending ? "Saving…" : "Save configuration"}
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PartnerDashboard() {
  const { data: profileData, isLoading: profileLoading, error: profileError } = useQuery({
    queryKey: ["partner-profile"],
    queryFn:  fetchPartnerProfile,
    retry: false,
  });

  const { data: referralsData, isLoading: referralsLoading } = useQuery({
    queryKey: ["partner-referrals"],
    queryFn:  fetchReferrals,
    enabled:  profileData?.partner?.isPartner === true,
  });

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-[#8A8680]">Loading…</p>
      </div>
    );
  }

  if (profileError || !profileData?.partner?.isPartner) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertTriangle size={32} color="#C97C0A" />
        <p className="text-sm font-medium text-[#0F0F0D]">Partner access required</p>
        <p className="text-xs text-[#8A8680] text-center max-w-xs">
          Your account is not registered as a Swwarm partner. Contact us to join the programme.
        </p>
      </div>
    );
  }

  const { partner } = profileData;
  const referrals = referralsData?.referrals ?? [];
  const paidCount = referrals.filter((r) => r.referralFeePaid).length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F0F0D]" style={{ fontFamily: "Georgia, serif" }}>
            Partner dashboard
          </h1>
          <p className="text-sm text-[#8A8680] mt-1">
            Health metrics for your referred accounts — no operational data shown.
          </p>
        </div>
        {partner.partnerTier && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1A9E6815] border border-[#1A9E6830]">
            <BadgeCheck size={14} color="#1A9E68" />
            <span className="text-xs font-semibold text-[#1A9E68] capitalize">{partner.partnerTier}</span>
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Users,      label: "Referred accounts", value: referrals.length },
          { icon: TrendingUp, label: "Active (paid)",      value: referrals.filter((r) => r.plan !== "solo").length },
          { icon: BadgeCheck, label: "Fees paid",          value: paidCount },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-xl border p-4 text-center" style={{ borderColor: "#E8E4DC", backgroundColor: "#FFFFFF" }}>
            <Icon size={18} className="mx-auto mb-2 text-[#8A8680]" />
            <p className="text-2xl font-bold text-[#0F0F0D]">{value}</p>
            <p className="text-xs text-[#8A8680] mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Referred companies */}
      <div>
        <h2 className="text-sm font-semibold text-[#0F0F0D] mb-3">Referred accounts</h2>
        {referralsLoading ? (
          <p className="text-sm text-[#8A8680]">Loading…</p>
        ) : referrals.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center" style={{ borderColor: "#E8E4DC" }}>
            <Building2 size={24} className="mx-auto mb-2 text-[#8A8680]" />
            <p className="text-sm text-[#8A8680]">No referred accounts yet.</p>
            <p className="text-xs text-[#8A8680] mt-1">Share your referral link to start earning.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {referrals.map((company) => (
              <CompanyHealthRow key={company.id} company={company} />
            ))}
          </div>
        )}
      </div>

      {/* White-label config */}
      <WhiteLabelForm />

      {/* Compliance note */}
      <p className="text-[11px] text-[#8A8680] border-t pt-4" style={{ borderColor: "#E8E4DC" }}>
        GDPR & AI Act compliance documentation always identifies Swwarm (Singular.blue) as data processor,
        regardless of white-label configuration.
      </p>
    </div>
  );
}

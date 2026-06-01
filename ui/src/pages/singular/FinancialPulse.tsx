/**
 * ui/src/pages/singular/FinancialPulse.tsx
 *
 * §18 — Financial Pulse screen.
 *
 * Displays: MRR equivalent, outstanding invoices with aging buckets,
 * top 5 clients, cash projection (30/60/90 days), at-risk invoices.
 *
 * Shows a "connect source" prompt when no financial integration is active.
 * All numbers in EUR, formatted fr-FR.
 */

import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, AlertTriangle, Link2, RefreshCw } from "lucide-react";
import { useCompany } from "../../context/CompanyContext";
import { financialPulseApi, type FinancialPulse } from "../../api/financialPulse";

function eur(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function AgingBar({ aging }: { aging: FinancialPulse["aging"] }) {
  const total = aging.current + aging.days30 + aging.days60 + aging.days90plus;
  if (total === 0) return <div className="h-2 rounded-full bg-stone-100" />;
  const pct = (v: number) => `${Math.round((v / total) * 100)}%`;
  return (
    <div className="flex h-2 rounded-full overflow-hidden gap-px">
      <div style={{ width: pct(aging.current) }}    className="bg-emerald-400" title={`Courant: ${eur(aging.current)}`} />
      <div style={{ width: pct(aging.days30) }}     className="bg-amber-300"   title={`30 jours: ${eur(aging.days30)}`} />
      <div style={{ width: pct(aging.days60) }}     className="bg-orange-400"  title={`60 jours: ${eur(aging.days60)}`} />
      <div style={{ width: pct(aging.days90plus) }} className="bg-red-500"     title={`90+ jours: ${eur(aging.days90plus)}`} />
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl bg-white border border-stone-100 p-4 flex flex-col gap-1">
      <p className="text-xs text-stone-400 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-semibold ${color ?? "text-[#0F0F0D]"}`}>{value}</p>
      {sub && <p className="text-xs text-stone-400">{sub}</p>}
    </div>
  );
}

function Pulse({ data }: { data: FinancialPulse }) {
  const cashIn90 = data.cashProjection?.days90 ?? null;

  return (
    <div className="flex flex-col gap-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Total outstanding"
          value={eur(data.outstandingTotal)}
          sub="unpaid receivables"
        />
        {data.mrrEquivalent !== null ? (
          <StatCard
            label="Weighted pipeline"
            value={eur(data.mrrEquivalent)}
            sub="MRR equivalent"
          />
        ) : (
          <div className="rounded-xl bg-stone-50 border border-stone-100 p-4 flex items-center justify-center">
            <p className="text-xs text-stone-400 text-center">No pipeline connected</p>
          </div>
        )}
      </div>

      {/* Aging buckets */}
      <div className="rounded-xl bg-white border border-stone-100 p-4 flex flex-col gap-3">
        <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Receivables aging</p>
        <AgingBar aging={data.aging} />
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { label: "Courant",  value: data.aging.current,    color: "text-emerald-600" },
            { label: "30 jours", value: data.aging.days30,     color: "text-amber-600" },
            { label: "60 jours", value: data.aging.days60,     color: "text-orange-600" },
            { label: "90+ jours",value: data.aging.days90plus, color: "text-red-600" },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <p className="text-xs text-stone-400">{label}</p>
              <p className={`text-sm font-semibold ${color}`}>{eur(value)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Cash projection */}
      {data.cashProjection && (
        <div className="rounded-xl bg-white border border-stone-100 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Cash projection</p>
            {cashIn90 !== null && cashIn90 < 0
              ? <TrendingDown size={14} className="text-red-500" />
              : <TrendingUp   size={14} className="text-emerald-500" />
            }
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: "30 jours", value: data.cashProjection.days30 },
              { label: "60 jours", value: data.cashProjection.days60 },
              { label: "90 jours", value: data.cashProjection.days90 },
            ].map(({ label, value }) => (
              <div key={label} className={`rounded-lg p-2 ${value < 0 ? "bg-red-50" : "bg-emerald-50"}`}>
                <p className="text-xs text-stone-400">{label}</p>
                <p className={`text-sm font-semibold ${value < 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {eur(value)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* At-risk invoices */}
      {data.invoicesAtRisk.length > 0 && (
        <div className="rounded-xl bg-red-50 border border-red-100 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-500" />
            <p className="text-xs font-medium text-red-700 uppercase tracking-wide">
              Critical overdue invoices ({data.invoicesAtRisk.length})
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {data.invoicesAtRisk.map((inv, i) => (
              <div key={i} className="flex items-center justify-between">
                <p className="text-sm text-red-700">{inv.contactName}</p>
                <div className="text-right">
                  <p className="text-sm font-semibold text-red-700">{eur(inv.amountEur)}</p>
                  <p className="text-xs text-red-500">{inv.daysOverdue} jours</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top 5 clients */}
      {data.top5Clients.length > 0 && (
        <div className="rounded-xl bg-white border border-stone-100 p-4 flex flex-col gap-3">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Top 5 clients (90 days)</p>
          <div className="flex flex-col gap-2">
            {data.top5Clients.map((c, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-400 w-4">{i + 1}</span>
                  <p className="text-sm text-[#0F0F0D]">{c.name}</p>
                </div>
                <p className="text-sm font-semibold text-[#0F0F0D]">{eur(c.revenueEur)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FinancialPulsePage() {
  const { selectedCompanyId } = useCompany();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey:  ["financial-pulse", selectedCompanyId],
    queryFn:   () => financialPulseApi.get(selectedCompanyId!),
    enabled:   !!selectedCompanyId,
    staleTime: 5 * 60 * 1000,
  });

  const pulse = data?.data;

  return (
    <div className="min-h-screen bg-[#FAFAF7] px-4 py-8 flex flex-col items-center">
      <div className="w-full max-w-lg flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[#0F0F0D]">Financial health</h1>
            <p className="text-sm text-stone-400 mt-0.5">
              {pulse ? `Updated at ${new Date(pulse.computedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="p-2 rounded-xl border border-stone-100 hover:bg-stone-50 transition-colors"
          >
            <RefreshCw size={14} className={`text-stone-400 ${isRefetching ? "animate-spin" : ""}`} />
          </button>
        </div>

        {isLoading && (
          <div className="flex flex-col gap-3 animate-pulse">
            <div className="grid grid-cols-2 gap-3">
              {[0, 1].map((i) => <div key={i} className="rounded-xl bg-white border border-stone-100 p-4 h-20" />)}
            </div>
            <div className="rounded-xl bg-white border border-stone-100 p-4 h-24" />
            <div className="rounded-xl bg-white border border-stone-100 p-4 h-32" />
          </div>
        )}

        {!isLoading && pulse && !pulse.hasConnectedSource && (
          <div className="rounded-2xl bg-white border border-stone-100 p-6 flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-stone-50 flex items-center justify-center">
              <Link2 size={20} className="text-stone-400" />
            </div>
            <div>
              <p className="font-semibold text-[#0F0F0D]">No financial source connected</p>
              <p className="text-sm text-stone-500 mt-1">
                Connectez Sage, Pennylane, QuickBooks ou Stripe pour visualiser votre santé financière.
              </p>
            </div>
            <a
              href="/parametres"
              className="px-4 py-2 rounded-xl bg-[#1A4E8C] text-white text-sm font-medium hover:bg-[#153F70] transition-colors"
            >
              Connect a source →
            </a>
          </div>
        )}

        {!isLoading && pulse?.hasConnectedSource && <Pulse data={pulse} />}
      </div>
    </div>
  );
}

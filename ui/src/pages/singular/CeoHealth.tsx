/**
 * ui/src/pages/singular/CeoHealth.tsx
 *
 * §11.7 — CEO Health Score.
 *
 * Shows the monthly CEO delegation ratio with sparkline, trend, and
 * a shareable plain-language card. Never shows the raw score as a number —
 * always in human terms (per §31 cognitive compression rules).
 */

import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Minus, Share2 } from "lucide-react";
import { useCompany } from "../../context/CompanyContext";
import { ceoHealthApi, type CeoHealthScore } from "../../api/ceoHealth";

function TrendIcon({ trend }: { trend: number }) {
  if (trend > 3)  return <TrendingUp  size={16} className="text-emerald-500" />;
  if (trend < -3) return <TrendingDown size={16} className="text-red-500" />;
  return <Minus size={16} className="text-stone-400" />;
}

function RatioGauge({ pct }: { pct: number }) {
  const color = pct >= 50 ? "#1A9E68" : pct >= 25 ? "#F59E0B" : "#EF4444";
  const r = 54;
  const circ = 2 * Math.PI * r;
  const offset = circ - (circ * Math.min(pct, 100)) / 100;

  return (
    <div className="relative flex items-center justify-center">
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={r} fill="none" stroke="#f1f0ec" strokeWidth="10" />
        <circle
          cx="65" cy="65" r={r} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 65 65)"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-semibold text-[#0F0F0D]">{pct}%</span>
        <span className="text-xs text-stone-400">ratio CEO</span>
      </div>
    </div>
  );
}

function Sparkline({ data }: { data: { month: string; ratio: number }[] }) {
  if (data.length < 2) return null;
  const max  = Math.max(...data.map((d) => d.ratio), 0.01);
  const w    = 220;
  const h    = 40;
  const step = w / (data.length - 1);

  const pts = data.map((d, i) => ({
    x: i * step,
    y: h - (d.ratio / max) * h * 0.85 - 2,
  }));

  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-stone-400 uppercase tracking-wide">6-month trend</p>
      <div className="overflow-x-auto">
        <svg width={w} height={h + 16} viewBox={`0 0 ${w} ${h + 16}`}>
          <path d={path} fill="none" stroke="#1A4E8C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {pts.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="3" fill="#1A4E8C" />
              <text x={p.x} y={h + 13} textAnchor="middle" fontSize="9" fill="#78716c">
                {data[i].month}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

function ScoreCard({ score }: { score: CeoHealthScore }) {
  const trendLabel = score.trend > 3
    ? `Up ${score.trend}%`
    : score.trend < -3
    ? `Down ${Math.abs(score.trend)}%`
    : "Stable";

  const copy = {
    high:   "Your team handles l'essentiel of your day-to-day operations.",
    medium: "Your team covers a significant share of your operations.",
    low:    "Your team could take on more operational tasks.",
  };
  const level = score.ceoRatioPct >= 50 ? "high" : score.ceoRatioPct >= 25 ? "medium" : "low";

  return (
    <div className="flex flex-col gap-6">
      {/* Gauge */}
      <div className="rounded-2xl bg-white border border-stone-100 p-6 flex flex-col items-center gap-4">
        <RatioGauge pct={score.ceoRatioPct} />
        <div className="flex items-center gap-2">
          <TrendIcon trend={score.trend} />
          <span className="text-sm text-stone-500">{trendLabel} this month</span>
        </div>
        <p className="text-sm text-stone-600 text-center">{copy[level]}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white border border-stone-100 p-4">
          <p className="text-xs text-stone-400 uppercase tracking-wide mb-1">Delegated tasks</p>
          <p className="text-xl font-semibold text-[#0F0F0D]">{score.taskCount}</p>
          <p className="text-xs text-stone-400">this month</p>
        </div>
        <div className="rounded-xl bg-white border border-stone-100 p-4">
          <p className="text-xs text-stone-400 uppercase tracking-wide mb-1">Hours freed</p>
          <p className="text-xl font-semibold text-[#1A9E68]">{score.delegatedHours}h</p>
          <p className="text-xs text-stone-400">estimated</p>
        </div>
      </div>

      {/* Sparkline */}
      <div className="rounded-xl bg-white border border-stone-100 p-4">
        <Sparkline data={score.sparkline} />
      </div>

      {/* Shareable card */}
      <div className="rounded-xl bg-[#1A4E8C]/5 border border-[#1A4E8C]/15 p-4 flex items-start justify-between gap-3">
        <p className="text-sm text-[#1A4E8C] leading-relaxed">{score.shareableCard}</p>
        <button
          onClick={() => navigator.clipboard?.writeText(score.shareableCard)}
          className="p-1.5 rounded-lg hover:bg-[#1A4E8C]/10 transition-colors flex-shrink-0"
          title="Copier"
        >
          <Share2 size={13} className="text-[#1A4E8C]" />
        </button>
      </div>
    </div>
  );
}

export default function CeoHealth() {
  const { selectedCompanyId } = useCompany();

  const { data, isLoading } = useQuery({
    queryKey:  ["ceo-health", selectedCompanyId],
    queryFn:   () => ceoHealthApi.get(selectedCompanyId!),
    enabled:   !!selectedCompanyId,
    staleTime: 60 * 60 * 1000,
  });

  const score = data?.data;

  return (
    <div className="min-h-screen bg-[#FAFAF7] px-4 py-8 flex flex-col items-center">
      <div className="w-full max-w-sm flex flex-col gap-6">

        <div>
          <h1 className="text-xl font-semibold text-[#0F0F0D]">CEO ratio</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {score ? score.periodLabel : "This month"}
          </p>
        </div>

        {isLoading && (
          <div className="flex flex-col gap-4 animate-pulse">
            <div className="rounded-2xl bg-white border border-stone-100 p-6 flex flex-col items-center gap-4">
              <div className="w-32 h-32 rounded-full bg-stone-100" />
              <div className="h-4 bg-stone-100 rounded w-32" />
              <div className="h-3 bg-stone-100 rounded w-48" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[0, 1].map((i) => <div key={i} className="rounded-xl bg-white border border-stone-100 p-4 h-16" />)}
            </div>
          </div>
        )}

        {score && <ScoreCard score={score} />}
      </div>
    </div>
  );
}

import * as React from "react"
import { X, ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// ---------------------------------------------------------------------------
// TrustDot
// ---------------------------------------------------------------------------

interface TrustDotProps {
  level: "trusted" | "upgrade" | "building" | "error"
  className?: string
}

export function TrustDot({ level, className }: TrustDotProps) {
  const colourMap: Record<TrustDotProps["level"], string> = {
    trusted: "bg-[#1A9E68]",
    upgrade: "bg-[#1A4E8C]",
    building: "bg-[#8A8680]",
    error: "bg-[#B91C1C]",
  }
  return (
    <span
      className={cn(
        "inline-block w-2.5 h-2.5 rounded-full flex-shrink-0",
        colourMap[level],
        className
      )}
      aria-hidden="true"
    />
  )
}

// ---------------------------------------------------------------------------
// TrustBar
// ---------------------------------------------------------------------------

interface TrustBarProps {
  score: number // 0–5
  label: string
  className?: string
}

export function TrustBar({ score, label, className }: TrustBarProps) {
  const segments = 10
  const filled = Math.round((score / 5) * segments)

  const barColour =
    score >= 4.5
      ? "bg-[#1A9E68]"
      : score >= 4.0
        ? "bg-[#1A9E68]"
        : score >= 3.0
          ? "bg-[#C97C0A]"
          : "bg-[#8A8680]"

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex gap-0.5 flex-1">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-2 flex-1 rounded-sm transition-colors",
              i < filled ? barColour : "bg-[#E8E4DC]"
            )}
          />
        ))}
      </div>
      <span className="text-xs text-[#8A8680] whitespace-nowrap font-[DM_Sans,sans-serif]">
        {label}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AgentStatusBadge
// ---------------------------------------------------------------------------

interface AgentStatusBadgeProps {
  status: "actif" | "pause" | "erreur" | "en_attente"
  className?: string
}

export function AgentStatusBadge({ status, className }: AgentStatusBadgeProps) {
  const config: Record<
    AgentStatusBadgeProps["status"],
    { label: string; classes: string }
  > = {
    actif: {
      label: "Actif",
      classes: "bg-[#ECFBF4] text-[#1A9E68] border border-[#1A9E68]/20",
    },
    pause: {
      label: "En pause",
      classes: "bg-[#F5F5F3] text-[#8A8680] border border-[#E8E4DC]",
    },
    erreur: {
      label: "Erreur",
      classes: "bg-[#FEF2F2] text-[#B91C1C] border border-[#B91C1C]/20",
    },
    en_attente: {
      label: "En attente",
      classes: "bg-[#FFF8EC] text-[#C97C0A] border border-[#C97C0A]/20",
    },
  }

  const { label, classes } = config[status]

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        classes,
        className
      )}
    >
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// IntelCard
// ---------------------------------------------------------------------------

interface IntelCardProps {
  type: "insight" | "trust_proposal" | "relationship_gap" | "goal_alert"
  headline: string
  body: string
  cta: string
  onCta: () => void
  onDismiss: () => void
  urgency: number // 1–3
  className?: string
}

export function IntelCard({
  type,
  headline,
  body,
  cta,
  onCta,
  onDismiss,
  urgency,
  className,
}: IntelCardProps) {
  const iconMap: Record<IntelCardProps["type"], React.ReactNode> = {
    insight: <span className="text-base">📊</span>,
    trust_proposal: <span className="text-base">🔵</span>,
    relationship_gap: <span className="text-base">🤝</span>,
    goal_alert: <span className="text-base">🎯</span>,
  }

  const borderColour =
    urgency === 3
      ? "border-l-[#B91C1C]"
      : urgency === 2
        ? "border-l-[#C97C0A]"
        : "border-l-[#1A4E8C]"

  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-[#E8E4DC] border-l-4 p-4 shadow-sm flex flex-col gap-3",
        borderColour,
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex-shrink-0">{iconMap[type]}</span>
          <div>
            <p className="text-sm font-semibold text-[#0F0F0D] leading-snug">
              {headline}
            </p>
            <p className="text-sm text-[#8A8680] mt-0.5 leading-snug">{body}</p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="text-[#8A8680] hover:text-[#0F0F0D] flex-shrink-0 mt-0.5 transition-colors"
          aria-label="Ignorer"
        >
          <X size={14} />
        </button>
      </div>
      <div>
        <button
          onClick={onCta}
          className="inline-flex items-center gap-1 text-sm font-medium text-[#1A4E8C] hover:underline"
        >
          {cta} <ArrowRight size={13} />
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// UsageGauge
// ---------------------------------------------------------------------------

interface UsageGaugeProps {
  used: number
  limit: number
  translation: string // e.g. "environ 95 sélections de CV restantes"
  className?: string
}

export function UsageGauge({ used, limit, translation, className }: UsageGaugeProps) {
  const pct = Math.min((used / limit) * 100, 100)
  const barColour =
    pct > 85 ? "bg-[#B91C1C]" : pct > 65 ? "bg-[#C97C0A]" : "bg-[#1A9E68]"

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between text-xs text-[#8A8680]">
        <span>
          {used.toLocaleString("fr-FR")} / {limit.toLocaleString("fr-FR")} tâches
        </span>
        <span className="font-medium text-[#0F0F0D]">{Math.round(pct)} %</span>
      </div>
      <div className="h-2 bg-[#E8E4DC] rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", barColour)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-[#8A8680]">{translation}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ActivityItem
// ---------------------------------------------------------------------------

interface ActivityItemProps {
  agentName: string
  action: string
  detail?: string
  time: string
  isLive?: boolean
  outcome?: "approved" | "pending" | "sent"
  className?: string
}

export function ActivityItem({
  agentName,
  action,
  detail,
  time,
  isLive,
  outcome,
  className,
}: ActivityItemProps) {
  const outcomeConfig: Record<
    NonNullable<ActivityItemProps["outcome"]>,
    { label: string; classes: string }
  > = {
    approved: {
      label: "Approved",
      classes: "bg-[#ECFBF4] text-[#1A9E68]",
    },
    pending: {
      label: "En attente",
      classes: "bg-[#FFF8EC] text-[#C97C0A]",
    },
    sent: {
      label: "Sent",
      classes: "bg-[#EFF3FA] text-[#1A4E8C]",
    },
  }

  return (
    <div className={cn("flex items-start gap-3 py-2.5", className)}>
      {/* Avatar */}
      <div
        className={cn(
          "w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-semibold",
          isLive ? "bg-[#1A9E68]" : "bg-[#E8E4DC] text-[#8A8680]"
        )}
      >
        {agentName.charAt(0)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#0F0F0D] leading-snug">
          <span className="font-medium">{agentName}</span>{" "}
          {isLive ? (
            <span className="text-[#8A8680] italic">{action}</span>
          ) : (
            <span className="text-[#8A8680]">{action}</span>
          )}
          {detail && (
            <span className="ml-1 text-[#C97C0A] font-medium">{detail}</span>
          )}
        </p>
        <p className="text-xs text-[#8A8680] mt-0.5">{time}</p>
      </div>

      {/* Outcome badge or live indicator */}
      <div className="flex-shrink-0 flex items-center gap-1.5 pt-0.5">
        {isLive ? (
          <span className="flex items-center gap-1 text-xs font-medium text-[#1A9E68]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1A9E68] animate-pulse" />
            direct
          </span>
        ) : (
          outcome && (
            <span
              className={cn(
                "text-xs px-2 py-0.5 rounded-full font-medium",
                outcomeConfig[outcome].classes
              )}
            >
              {outcomeConfig[outcome].label}
            </span>
          )
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ApprovalBanner
// ---------------------------------------------------------------------------

interface ApprovalBannerProps {
  count: number
  onClick: () => void
  className?: string
}

export function ApprovalBanner({ count, onClick, className }: ApprovalBannerProps) {
  return (
    <div
      className={cn(
        "bg-[#FFF8EC] border border-[#C97C0A]/30 rounded-xl px-4 py-3 flex items-center justify-between gap-3",
        className
      )}
    >
      <div className="flex items-center gap-2.5">
        <AlertTriangle size={16} className="text-[#C97C0A] flex-shrink-0" />
        <p className="text-sm font-medium text-[#0F0F0D]">
          {count === 1
            ? "1 action attend votre validation"
            : `${count} actions attendent votre validation`}
        </p>
      </div>
      <button
        onClick={onClick}
        className="flex items-center gap-1 text-sm font-semibold text-[#C97C0A] hover:underline flex-shrink-0"
      >
        Voir <ArrowRight size={13} />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MicroReward
// ---------------------------------------------------------------------------

interface MicroRewardProps {
  message: string
  className?: string
}

export function MicroReward({ message, className }: MicroRewardProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 bg-[#ECFBF4] border border-[#1A9E68]/20 rounded-xl px-4 py-3",
        className
      )}
    >
      <CheckCircle2 size={16} className="text-[#1A9E68] flex-shrink-0 mt-0.5" />
      <p className="text-sm text-[#1A9E68] font-medium leading-snug">{message}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// HandoffIndicator
// ---------------------------------------------------------------------------

interface HandoffIndicatorProps {
  from: string
  to: string
  summary: string
  className?: string
}

export function HandoffIndicator({ from, to, summary, className }: HandoffIndicatorProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 bg-[#EFF3FA] border border-[#1A4E8C]/15 rounded-xl px-4 py-3",
        className
      )}
    >
      <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
        <span className="text-xs font-semibold text-[#1A4E8C] bg-[#1A4E8C]/10 px-2 py-0.5 rounded-full">
          {from}
        </span>
        <ArrowRight size={13} className="text-[#1A4E8C]" />
        <span className="text-xs font-semibold text-[#1A4E8C] bg-[#1A4E8C]/10 px-2 py-0.5 rounded-full">
          {to}
        </span>
      </div>
      <p className="text-sm text-[#1A4E8C] leading-snug">{summary}</p>
    </div>
  )
}

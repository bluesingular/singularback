import * as React from "react"
import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { adminApi, type EmbeddingMetric } from "@/api/admin"
import { Building2, CheckSquare, Euro, RefreshCw, AlertTriangle, TrendingUp, Minus } from "lucide-react"
import { useLocale } from "@/hooks/useLocale"
import { cn } from "@/lib/utils"

function KpiCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-5 flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-[#F0EDE6] flex items-center justify-center flex-shrink-0">
        <Icon size={18} className="text-[#4B4846]" />
      </div>
      <div>
        <p className="text-xs text-[#8A8680] mb-0.5">{label}</p>
        <p className="text-2xl font-[Georgia,serif] text-[#0F0F0D]">{value}</p>
      </div>
    </div>
  )
}

function EmbeddingScoreBadge({ score }: { score: number }) {
  const color = score > 60
    ? "bg-[#E8F5EE] text-[#1A9E68]"
    : score >= 20
    ? "bg-[#FEF3C7] text-[#C97C0A]"
    : "bg-[#FEE2E2] text-[#DC2626]"
  return (
    <span className={cn("px-2 py-0.5 rounded text-xs font-semibold tabular-nums", color)}>
      {score}
    </span>
  )
}

function TrendIcon({ current, prev }: { current: number; prev: number | null }) {
  if (prev === null) return <Minus size={12} className="text-[#CACAC8]" />
  if (current > prev) return <TrendingUp size={12} className="text-[#1A9E68]" />
  if (current < prev) return <TrendingUp size={12} className="text-[#DC2626] rotate-180" />
  return <Minus size={12} className="text-[#8A8680]" />
}

function EmbeddingFlag({ score, prev }: { score: number; prev: number | null }) {
  const declining = prev !== null && score < prev
  if (score < 20 && (declining || prev === null)) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#FEF3C7] text-[#C97C0A]">
        <AlertTriangle size={9} />
        À risque
      </span>
    )
  }
  if (score > 60 && !declining) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#E8F5EE] text-[#1A9E68]">
        ↗ Expansion
      </span>
    )
  }
  return null
}

function RestartWorkersButton() {
  const [showConfirm, setShowConfirm] = useState(false)
  const restart = useMutation({ mutationFn: () => adminApi.restartWorkers() })

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#8A8680]">Confirmer ?</span>
        <button
          onClick={() => { restart.mutate(); setShowConfirm(false) }}
          className="text-xs px-2.5 py-1 rounded-lg bg-[#DC2626] text-white hover:bg-[#B91C1C] transition-colors"
        >
          Oui, redémarrer
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          className="text-xs px-2.5 py-1 rounded-lg border border-[#E8E4DC] text-[#4B4846] hover:bg-[#F0EDE6] transition-colors"
        >
          Annuler
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      disabled={restart.isPending}
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[#E8E4DC] text-[#4B4846] hover:bg-[#F0EDE6] transition-colors disabled:opacity-50"
    >
      <RefreshCw size={12} className={restart.isPending ? "animate-spin" : ""} />
      Redémarrer les agents
    </button>
  )
}

export function AdminHealth() {
  const { formatNumber, formatEuros } = useLocale()

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "health"],
    queryFn: () => adminApi.health(),
    refetchInterval: 30_000,
  })

  const { data: embeddingData } = useQuery({
    queryKey: ["admin", "embedding-metrics"],
    queryFn: () => adminApi.listEmbeddingMetrics().catch(() => ({ metrics: [] as EmbeddingMetric[] })),
    refetchInterval: 120_000,
  })

  const { data: queueData } = useQuery({
    queryKey: ["admin", "queue-stats"],
    queryFn: () => adminApi.getQueueStats().catch(() => null),
    refetchInterval: 15_000,
  })

  if (isLoading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#1A9E68] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const metrics = embeddingData?.metrics ?? []
  const queueTotal = queueData ? queueData.waiting + queueData.active + queueData.delayed : null

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAFAF8]">
      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-6">

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-[Georgia,serif] text-[#0F0F0D]">Plateforme</h1>
          <RestartWorkersButton />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard icon={Building2} label="Tenants actifs" value={data.tenants} />
          <KpiCard icon={CheckSquare} label="Tâches (total)" value={formatNumber(data.tasksAllTime)} />
          <KpiCard icon={Euro} label="Coût 30 jours" value={formatEuros(data.costLast30Days)} />
        </div>

        <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-6 flex items-center justify-between gap-4">
          <p className="text-sm text-[#8A8680]">
            Bull Board disponible sur <code className="text-xs font-mono bg-[#F0EDE6] px-1 py-0.5 rounded">/internal/queues</code>
          </p>
          {queueTotal !== null && (
            <span className="text-xs text-[#4B4846] bg-[#F0EDE6] px-2.5 py-1 rounded-lg font-medium whitespace-nowrap">
              File : {queueTotal} tâche{queueTotal !== 1 ? "s" : ""} en attente
            </span>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-[#F0EDE6] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#0F0F0D]">Intégration opérationnelle par tenant</h2>
            {metrics.length === 0 && (
              <span className="text-xs text-[#8A8680]">Requiert 30+ tâches par entreprise</span>
            )}
          </div>

          {metrics.length === 0 ? (
            <div className="px-5 py-6 text-sm text-[#8A8680]">
              Aucune métrique disponible — les scores s'affichent après 30 tâches par tenant.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#F0EDE6]">
                  <th className="px-5 py-2.5 text-left text-[#8A8680] font-medium">Entreprise</th>
                  <th className="px-5 py-2.5 text-center text-[#8A8680] font-medium">Score (0-100)</th>
                  <th className="px-5 py-2.5 text-center text-[#8A8680] font-medium">Tendance</th>
                  <th className="px-5 py-2.5 text-left text-[#8A8680] font-medium">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EDE6]">
                {metrics.map((m) => (
                  <tr key={m.companyId} className="hover:bg-[#FAFAF8] transition-colors">
                    <td className="px-5 py-3 font-medium text-[#0F0F0D]">{m.companyName}</td>
                    <td className="px-5 py-3 text-center">
                      <EmbeddingScoreBadge score={m.embeddingScore} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-center">
                        <TrendIcon current={m.embeddingScore} prev={m.prevScore} />
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <EmbeddingFlag score={m.embeddingScore} prev={m.prevScore} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  )
}

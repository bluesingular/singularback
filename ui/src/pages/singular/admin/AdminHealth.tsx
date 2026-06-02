import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { adminApi } from "@/api/admin"
import { Building2, CheckSquare, Euro } from "lucide-react"
import { useLocale } from "@/hooks/useLocale"

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

export function AdminHealth() {
  const { formatNumber, formatEuros } = useLocale()
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "health"],
    queryFn: () => adminApi.health(),
    refetchInterval: 30_000,
  })

  if (isLoading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#1A9E68] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAFAF8]">
      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-6">
        <h1 className="text-2xl font-[Georgia,serif] text-[#0F0F0D]">Plateforme</h1>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard icon={Building2} label="Tenants actifs" value={data.tenants} />
          <KpiCard icon={CheckSquare} label="Tasks (total)" value={formatNumber(data.tasksAllTime)} />
          <KpiCard icon={Euro} label="Cost (30 days)" value={formatEuros(data.costLast30Days)} />
        </div>

        <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-6">
          <p className="text-sm text-[#8A8680]">
            Bull Board disponible sur <code className="text-xs font-mono bg-[#F0EDE6] px-1 py-0.5 rounded">/internal/queues</code>
          </p>
        </div>
      </div>
    </div>
  )
}

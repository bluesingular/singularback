/**
 * Admin MCP & A2A management page.
 *
 * Central control for the platform operator:
 *   - See all MCP API keys across every tenant
 *   - Create / revoke keys on behalf of any tenant
 *   - Per-tenant usage summary (active keys, last call)
 *   - A2A endpoint reference per tenant
 */

import * as React from "react"
import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Copy, Check, Key, Plus, Trash2, Globe, ChevronDown, ChevronRight, Loader2, AlertTriangle } from "lucide-react"
import { adminApi } from "@/api/admin"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminMcpKey {
  id:          string
  companyId:   string
  companyName: string | null
  name:        string
  lastUsedAt:  string | null
  revokedAt:   string | null
  createdAt:   string
}

interface TenantMcpStat {
  companyId:   string
  companyName: string | null
  activeKeys:  number
  totalKeys:   number
  lastUsedAt:  string | null
}

interface CreatedKey {
  id:        string
  name:      string
  key:       string
  createdAt: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="p-1 rounded hover:bg-[#F0EDE6] transition-colors"
    >
      {copied ? <Check size={12} style={{ color: "#1A9E68" }} /> : <Copy size={12} style={{ color: "#8A8680" }} />}
    </button>
  )
}

function KeyRow({
  k,
  onRevoke,
  revoking,
}: {
  k: AdminMcpKey
  onRevoke: (id: string, name: string) => void
  revoking: boolean
}) {
  const isRevoked = !!k.revokedAt
  return (
    <div className={cn("flex items-center gap-3 px-4 py-3 border-b border-[#F0EDE6] last:border-0", isRevoked && "opacity-50")}>
      <Key size={13} className="flex-shrink-0 text-[#8A8680]" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#0F0F0D] truncate">{k.name}</p>
        <p className="text-xs text-[#8A8680]">
          {k.companyName ?? k.companyId}
          {" · "}Created {new Date(k.createdAt).toLocaleDateString()}
          {k.lastUsedAt && ` · Last used ${new Date(k.lastUsedAt).toLocaleDateString()}`}
          {isRevoked && <span className="ml-1 text-[#C97C0A]">· Revoked</span>}
        </p>
      </div>
      {!isRevoked && (
        <button
          onClick={() => onRevoke(k.id, k.name)}
          disabled={revoking}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-[#E8E4DC] text-[#8A8680] hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <Trash2 size={11} />
          Revoke
        </button>
      )}
    </div>
  )
}

// ── Create key modal ──────────────────────────────────────────────────────────

function CreateKeyModal({
  tenants,
  onClose,
  onCreated,
}: {
  tenants: TenantMcpStat[]
  onClose: () => void
  onCreated: (key: CreatedKey, companyName: string) => void
}) {
  const [companyId, setCompanyId] = useState(tenants[0]?.companyId ?? "")
  const [name, setName]           = useState("")

  const create = useMutation({
    mutationFn: () => adminApi.post<{ ok: true; data: CreatedKey }>("/admin/mcp/keys", { companyId, name }),
    onSuccess: (res) => {
      const company = tenants.find(t => t.companyId === companyId)
      onCreated(res.data, company?.companyName ?? companyId)
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
        <h2 className="text-base font-semibold text-[#0F0F0D]" style={{ fontFamily: "Georgia, serif" }}>
          Create MCP key
        </h2>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-[#4B4846] mb-1.5 block">Tenant</label>
            <select
              value={companyId}
              onChange={e => setCompanyId(e.target.value)}
              className="w-full border border-[#E8E4DC] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A9E68]/30"
            >
              {tenants.map(t => (
                <option key={t.companyId} value={t.companyId}>
                  {t.companyName ?? t.companyId}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-[#4B4846] mb-1.5 block">Key name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Claude Desktop, Dust"
              className="w-full border border-[#E8E4DC] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A9E68]/30"
              onKeyDown={e => { if (e.key === "Enter" && name.trim()) create.mutate() }}
            />
          </div>
        </div>

        {create.isError && (
          <p className="text-xs text-red-600">Failed to create key.</p>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[#8A8680] hover:bg-[#F5F3F0]">
            Cancel
          </button>
          <button
            onClick={() => create.mutate()}
            disabled={!name.trim() || !companyId || create.isPending}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#1A9E68] text-white disabled:opacity-50 flex items-center gap-2"
          >
            {create.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            Create
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Revealed key banner ───────────────────────────────────────────────────────

function RevealedKeyBanner({
  created,
  companyName,
  onDismiss,
}: {
  created: CreatedKey
  companyName: string
  onDismiss: () => void
}) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="rounded-xl border border-[#F0D070] bg-[#FFFBEB] p-4 space-y-2">
      <p className="text-sm font-medium text-[#92600A] flex items-center gap-2">
        <AlertTriangle size={14} />
        Copy this key now — it will not be shown again
      </p>
      <p className="text-xs text-[#8A8680]">
        Tenant: <span className="font-medium text-[#4B4846]">{companyName}</span>
        {" · "}Key name: <span className="font-medium text-[#4B4846]">{created.name}</span>
      </p>
      <div className="flex items-center gap-2 rounded-lg border border-[#E8E4DC] bg-[#F5F3F0] px-3 py-2">
        <code className="flex-1 text-xs font-mono truncate text-[#4B4846]">{created.key}</code>
        <button
          onClick={() => { navigator.clipboard.writeText(created.key); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
          className="p-1 rounded hover:bg-[#E8E4DC]"
        >
          {copied ? <Check size={12} style={{ color: "#1A9E68" }} /> : <Copy size={12} style={{ color: "#8A8680" }} />}
        </button>
      </div>
      <button onClick={onDismiss} className="text-xs text-[#8A8680] underline">
        I've saved it, dismiss
      </button>
    </div>
  )
}

// ── Stats row ─────────────────────────────────────────────────────────────────

function TenantStatRow({
  stat,
  baseUrl,
  expanded,
  onToggle,
}: {
  stat: TenantMcpStat
  baseUrl: string
  expanded: boolean
  onToggle: () => void
}) {
  const agentCardUrl = `${baseUrl}/a2a/${stat.companyId}/agent.json`
  const a2aEndpoint  = `${baseUrl}/a2a/${stat.companyId}`
  const mcpEndpoint  = `${baseUrl}/mcp/${stat.companyId}`

  return (
    <div className="border-b border-[#F0EDE6] last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#FAFAF8] text-left transition-colors"
      >
        {expanded ? <ChevronDown size={13} className="text-[#8A8680]" /> : <ChevronRight size={13} className="text-[#8A8680]" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#0F0F0D]">{stat.companyName ?? stat.companyId}</p>
          <p className="text-xs text-[#8A8680]">
            {stat.activeKeys} active key{stat.activeKeys !== 1 ? "s" : ""}
            {stat.lastUsedAt && ` · Last call ${new Date(stat.lastUsedAt).toLocaleDateString()}`}
            {!stat.lastUsedAt && stat.activeKeys > 0 && " · Never called"}
            {stat.activeKeys === 0 && " · No active keys"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "px-2 py-0.5 rounded text-xs font-medium",
            stat.activeKeys > 0 ? "bg-[#E8F5EE] text-[#1A9E68]" : "bg-[#F0EDE6] text-[#8A8680]"
          )}>
            MCP {stat.activeKeys > 0 ? "enabled" : "off"}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2 bg-[#FAFAF8]">
          {/* Endpoints */}
          <div className="grid grid-cols-1 gap-2">
            {[
              { label: "MCP endpoint", value: mcpEndpoint },
              { label: "A2A endpoint", value: a2aEndpoint },
              { label: "A2A agent card (public)", value: agentCardUrl },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center gap-2 rounded-lg border border-[#E8E4DC] bg-white px-3 py-2">
                <p className="text-xs text-[#8A8680] w-36 flex-shrink-0">{label}</p>
                <code className="flex-1 text-xs font-mono text-[#4B4846] truncate">{value}</code>
                <CopyButton value={value} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AdminMcp() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate]   = useState(false)
  const [revealedKey, setRevealedKey] = useState<{ key: CreatedKey; company: string } | null>(null)
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"keys" | "tenants">("tenants")

  const baseUrl = window.location.origin

  const keysQuery = useQuery({
    queryKey: ["admin", "mcp", "keys"],
    queryFn: () => adminApi.get<{ ok: true; data: { keys: AdminMcpKey[] } }>("/admin/mcp/keys"),
  })

  const statsQuery = useQuery({
    queryKey: ["admin", "mcp", "stats"],
    queryFn: () => adminApi.get<{ ok: true; data: { tenants: TenantMcpStat[] } }>("/admin/mcp/stats"),
  })

  const revokeMutation = useMutation({
    mutationFn: (keyId: string) => adminApi.delete(`/admin/mcp/keys/${keyId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "mcp"] })
    },
  })

  const keys    = keysQuery.data?.data?.keys ?? []
  const tenants = statsQuery.data?.data?.tenants ?? []
  const activeKeys = keys.filter(k => !k.revokedAt)

  function handleRevoke(keyId: string, name: string) {
    if (confirm(`Revoke key "${name}"? This cannot be undone.`)) {
      revokeMutation.mutate(keyId)
    }
  }

  return (
    <div className="flex-1 overflow-auto p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl text-[#0F0F0D]" style={{ fontFamily: "Georgia, serif" }}>
            MCP &amp; A2A
          </h1>
          <p className="text-sm text-[#8A8680] mt-1">
            Manage API access for external AI tools across all tenants
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-[#1A9E68] text-white hover:opacity-90 transition-opacity"
        >
          <Plus size={14} />
          Create key
        </button>
      </div>

      {/* Revealed key banner */}
      {revealedKey && (
        <RevealedKeyBanner
          created={revealedKey.key}
          companyName={revealedKey.company}
          onDismiss={() => setRevealedKey(null)}
        />
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active keys", value: activeKeys.length },
          { label: "Tenants with MCP", value: tenants.filter(t => t.activeKeys > 0).length },
          { label: "Total tenants", value: tenants.length },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-[#E8E4DC] bg-white px-5 py-4">
            <p className="text-2xl font-semibold text-[#0F0F0D]">{value}</p>
            <p className="text-xs text-[#8A8680] mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-[#E8E4DC]">
        {(["tenants", "keys"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="text-sm px-4 py-2.5 -mb-px border-b-2 transition-colors capitalize"
            style={activeTab === tab
              ? { borderColor: "#1A9E68", color: "#1A9E68", fontWeight: 600 }
              : { borderColor: "transparent", color: "#8A8680" }}
          >
            {tab === "tenants" ? "By tenant" : "All keys"}
          </button>
        ))}
      </div>

      {/* By tenant tab */}
      {activeTab === "tenants" && (
        <div className="rounded-xl border border-[#E8E4DC] bg-white overflow-hidden">
          {statsQuery.isLoading ? (
            <div className="flex items-center gap-2 px-5 py-6 text-sm text-[#8A8680]">
              <Loader2 size={14} className="animate-spin" /> Loading…
            </div>
          ) : tenants.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[#8A8680]">No tenants found.</p>
          ) : (
            tenants.map(stat => (
              <TenantStatRow
                key={stat.companyId}
                stat={stat}
                baseUrl={baseUrl}
                expanded={expandedTenant === stat.companyId}
                onToggle={() => setExpandedTenant(expandedTenant === stat.companyId ? null : stat.companyId)}
              />
            ))
          )}
        </div>
      )}

      {/* All keys tab */}
      {activeTab === "keys" && (
        <div className="rounded-xl border border-[#E8E4DC] bg-white overflow-hidden">
          {keysQuery.isLoading ? (
            <div className="flex items-center gap-2 px-5 py-6 text-sm text-[#8A8680]">
              <Loader2 size={14} className="animate-spin" /> Loading…
            </div>
          ) : keys.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[#8A8680]">No keys created yet.</p>
          ) : (
            keys.map(k => (
              <KeyRow
                key={k.id}
                k={k}
                onRevoke={handleRevoke}
                revoking={revokeMutation.isPending}
              />
            ))
          )}
        </div>
      )}

      {/* A2A info banner */}
      <div className="rounded-xl border border-[#C6E9D8] bg-[#F0F9F4] p-5 flex gap-4">
        <Globe size={16} className="flex-shrink-0 mt-0.5 text-[#1A9E68]" />
        <div>
          <p className="text-sm font-medium text-[#0F0F0D] mb-1">A2A Protocol (G14)</p>
          <p className="text-sm text-[#4B4846]">
            Each tenant's agent card is publicly discoverable at{" "}
            <code className="text-xs bg-white px-1 rounded border border-[#E8E4DC]">/a2a/:companyId/agent.json</code>.
            A2A tasks use the same Public API keys as MCP — no separate key management needed.
            External agents call <code className="text-xs bg-white px-1 rounded border border-[#E8E4DC]">tasks/send</code> on
            the A2A endpoint; Swwarm routes to the right agent automatically.
          </p>
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <CreateKeyModal
          tenants={tenants}
          onClose={() => setShowCreate(false)}
          onCreated={(key, company) => setRevealedKey({ key, company })}
        />
      )}
    </div>
  )
}

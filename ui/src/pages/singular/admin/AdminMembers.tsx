import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { adminApi } from "@/api/admin"
import { membersApi, type Member, type MemberRole } from "@/api/members"
import { UserX, UserCog, Mail } from "lucide-react"
import { cn } from "@/lib/utils"

const ROLE_LABELS: Record<MemberRole, string> = {
  owner:    "Propriétaire",
  admin:    "Admin",
  operator: "Opérateur",
  viewer:   "Lecteur",
  api:      "API",
}

const ROLE_COLORS: Record<MemberRole, string> = {
  owner:    "bg-[#FEE2E2] text-[#DC2626]",
  admin:    "bg-[#EDE9FE] text-[#7C3AED]",
  operator: "bg-[#E6F4ED] text-[#1A9E68]",
  viewer:   "bg-[#F0EDE6] text-[#8A8680]",
  api:      "bg-[#FEF3C7] text-[#C97C0A]",
}

const ALL_ROLES: MemberRole[] = ["owner", "admin", "operator", "viewer", "api"]

function MemberRow({ member, companyId }: { member: Member; companyId: string }) {
  const qc = useQueryClient()
  const [editRole, setEditRole] = React.useState<MemberRole | null>(null)

  const updateRole = useMutation({
    mutationFn: (role: MemberRole) => membersApi.updateRole(companyId, member.id, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "members", companyId] })
      setEditRole(null)
    },
  })

  const remove = useMutation({
    mutationFn: () => membersApi.remove(companyId, member.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "members", companyId] }),
  })

  const role = member.role as MemberRole | null

  return (
    <div className="flex items-center gap-3 py-3 border-b border-[#F0EDE6] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#0F0F0D] truncate">{member.name ?? member.email ?? member.userId}</p>
        {member.email && member.name && (
          <p className="text-xs text-[#8A8680] truncate">{member.email}</p>
        )}
        <p className="text-xs text-[#8A8680]">Membre depuis {new Date(member.joinedAt).toLocaleDateString("fr-FR")}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {editRole !== null ? (
          <div className="flex items-center gap-2">
            <select
              value={editRole}
              onChange={(e) => setEditRole(e.target.value as MemberRole)}
              className="text-xs border border-[#E8E4DC] rounded-lg px-2 py-1 bg-white text-[#0F0F0D] focus:outline-none"
            >
              {ALL_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            <button
              onClick={() => updateRole.mutate(editRole)}
              disabled={updateRole.isPending}
              className="text-xs px-2 py-1 rounded-lg bg-[#0F0F0D] text-white hover:bg-[#1A1A18] disabled:opacity-50"
            >
              OK
            </button>
            <button onClick={() => setEditRole(null)} className="text-xs text-[#8A8680] hover:text-[#0F0F0D]">
              Annuler
            </button>
          </div>
        ) : (
          <>
            {role && (
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", ROLE_COLORS[role])}>
                {ROLE_LABELS[role]}
              </span>
            )}
            <button
              onClick={() => setEditRole(role ?? "viewer")}
              title="Modifier le rôle"
              className="p-1 text-[#8A8680] hover:text-[#0F0F0D] transition-colors"
            >
              <UserCog size={14} />
            </button>
            <button
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
              title="Retirer le membre"
              className="p-1 text-[#8A8680] hover:text-red-600 transition-colors disabled:opacity-50"
            >
              <UserX size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function InviteForm({ companyId }: { companyId: string }) {
  const qc = useQueryClient()
  const [email, setEmail] = React.useState("")
  const [role, setRole] = React.useState<MemberRole>("operator")
  const [sent, setSent] = React.useState(false)

  const invite = useMutation({
    mutationFn: () => membersApi.invite(companyId, email, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "members", companyId] })
      setEmail("")
      setSent(true)
      setTimeout(() => setSent(false), 3000)
    },
  })

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); invite.mutate() }}
      className="flex items-center gap-2 pt-4 border-t border-[#F0EDE6]"
    >
      <Mail size={14} className="text-[#8A8680] shrink-0" />
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email@entreprise.com"
        className="flex-1 text-sm border border-[#E8E4DC] rounded-xl px-3 py-2 bg-white text-[#0F0F0D] focus:outline-none focus:ring-2 focus:ring-[#1A9E68] min-w-0"
      />
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as MemberRole)}
        className="text-sm border border-[#E8E4DC] rounded-xl px-2 py-2 bg-white text-[#0F0F0D] focus:outline-none"
      >
        {ALL_ROLES.filter((r) => r !== "owner").map((r) => (
          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
        ))}
      </select>
      <button
        type="submit"
        disabled={invite.isPending}
        className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#0F0F0D] text-white hover:bg-[#1A1A18] disabled:opacity-50 transition-colors whitespace-nowrap"
      >
        {invite.isPending ? "Envoi…" : sent ? "Envoyé ✓" : "Inviter"}
      </button>
    </form>
  )
}

export function AdminMembers() {
  const [selectedCompanyId, setSelectedCompanyId] = React.useState<string>("")

  const { data: tenants } = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: () => adminApi.listTenants().then((r) => r.tenants),
  })

  React.useEffect(() => {
    if (tenants?.length && !selectedCompanyId) setSelectedCompanyId(tenants[0].id)
  }, [tenants, selectedCompanyId])

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "members", selectedCompanyId],
    queryFn: () => membersApi.list(selectedCompanyId),
    enabled: !!selectedCompanyId,
  })

  const members = data?.members ?? []

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-serif text-[#0F0F0D]">Membres</h1>
          <p className="text-sm text-[#8A8680] mt-1">Gestion des accès par tenant</p>
        </div>

        {tenants && (
          <div className="mb-5">
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="text-sm border border-[#E8E4DC] rounded-xl px-3 py-2 bg-white text-[#0F0F0D] focus:outline-none focus:ring-2 focus:ring-[#1A9E68] w-full max-w-xs"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}

        {isLoading && <div className="text-sm text-[#8A8680]">Chargement…</div>}

        {selectedCompanyId && (
          <div className="bg-white border border-[#E8E4DC] rounded-2xl p-5 flex flex-col gap-0">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-[#0F0F0D]">
                {members.length} membre{members.length !== 1 ? "s" : ""}
              </p>
            </div>

            {members.length === 0 && !isLoading && (
              <p className="text-sm text-[#8A8680] py-3">Aucun membre pour ce tenant.</p>
            )}

            {members.map((m) => (
              <MemberRow key={m.id} member={m} companyId={selectedCompanyId} />
            ))}

            <InviteForm companyId={selectedCompanyId} />
          </div>
        )}
      </div>
    </div>
  )
}

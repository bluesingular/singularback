import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { adminApi } from "@/api/admin"
import { membersApi, type Member } from "@/api/members"
import { gdprApi } from "@/api/gdpr"
import { Shield, Download, Trash2, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
  danger,
}: {
  title: string
  body: string
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
  danger?: boolean
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full flex flex-col gap-4 shadow-xl">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="text-[#DC2626] mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-[#0F0F0D]">{title}</p>
            <p className="text-sm text-[#8A8680] mt-1">{body}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl text-sm border border-[#E8E4DC] text-[#0F0F0D] hover:bg-[#F0EDE6] transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              "flex-1 py-2 rounded-xl text-sm font-semibold text-white transition-colors",
              danger ? "bg-[#DC2626] hover:bg-red-700" : "bg-[#0F0F0D] hover:bg-[#1A1A18]",
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function MemberEraseRow({ member, companyId }: { member: Member; companyId: string }) {
  const [confirm, setConfirm] = React.useState(false)
  const [result, setResult] = React.useState<string | null>(null)

  const erase = useMutation({
    mutationFn: () => gdprApi.eraseUser(companyId, member.userId),
    onSuccess: (r) => setResult(`${r.recordsDeleted} enreg. supprimés/anonymisés.`),
  })

  return (
    <>
      <div className="flex items-center gap-3 py-3 border-b border-[#F0EDE6] last:border-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#0F0F0D] truncate">{member.name ?? member.email ?? member.userId}</p>
          {member.email && member.name && (
            <p className="text-xs text-[#8A8680] truncate">{member.email}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {result && <span className="text-xs text-[#1A9E68]">{result}</span>}
          <a
            href={gdprApi.exportUser(companyId, member.userId)}
            download
            className="p-1.5 text-[#8A8680] hover:text-[#1A4E8C] transition-colors"
            title="Exporter (Art. 20)"
          >
            <Download size={14} />
          </a>
          <button
            onClick={() => setConfirm(true)}
            disabled={erase.isPending}
            className="p-1.5 text-[#8A8680] hover:text-red-600 transition-colors disabled:opacity-50"
            title="Effacer (Art. 17)"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {confirm && (
        <ConfirmDialog
          title="Effacer les données utilisateur"
          body={`Anonymiser toutes les données personnelles de ${member.name ?? member.email ?? member.userId} dans ce tenant (Art. 17 RGPD). Cette action est irréversible.`}
          confirmLabel="Effacer"
          danger
          onConfirm={() => { setConfirm(false); erase.mutate() }}
          onClose={() => setConfirm(false)}
        />
      )}
    </>
  )
}

export function AdminGdpr() {
  const [selectedCompanyId, setSelectedCompanyId] = React.useState<string>("")
  const [contactId, setContactId] = React.useState("")
  const [contactConfirm, setContactConfirm] = React.useState(false)
  const [contactResult, setContactResult] = React.useState<string | null>(null)

  const { data: tenants } = useQuery({
    queryKey: ["admin", "tenants"],
    queryFn: () => adminApi.listTenants().then((r) => r.tenants),
  })

  React.useEffect(() => {
    if (tenants?.length && !selectedCompanyId) setSelectedCompanyId(tenants[0].id)
  }, [tenants, selectedCompanyId])

  const { data: membersData } = useQuery({
    queryKey: ["admin", "members", selectedCompanyId],
    queryFn: () => membersApi.list(selectedCompanyId),
    enabled: !!selectedCompanyId,
  })

  const eraseContact = useMutation({
    mutationFn: () => gdprApi.eraseContact(selectedCompanyId, contactId),
    onSuccess: (r) => {
      setContactResult(`${r.recordsDeleted} enreg. supprimés.`)
      setContactId("")
    },
  })

  const members = membersData?.members ?? []

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-serif text-[#0F0F0D]">RGPD & Données personnelles</h1>
          <p className="text-sm text-[#8A8680] mt-1">Droit à l'effacement (Art. 17) et portabilité (Art. 20) par tenant</p>
        </div>

        {tenants && (
          <div className="mb-6">
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

        {selectedCompanyId && (
          <div className="flex flex-col gap-6">
            {/* Audit trail export */}
            <div className="bg-white border border-[#E8E4DC] rounded-2xl p-5 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Shield size={16} className="text-[#1A4E8C] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-[#0F0F0D]">Journal d'audit</p>
                  <p className="text-xs text-[#8A8680] mt-0.5">Export CSV de toutes les actions enregistrées — requis pour les demandes CNIL</p>
                </div>
              </div>
              <a
                href={gdprApi.auditCsvUrl(selectedCompanyId)}
                download
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-[#E8E4DC] text-[#0F0F0D] hover:bg-[#F0EDE6] transition-colors whitespace-nowrap"
              >
                <Download size={13} />
                Télécharger CSV
              </a>
            </div>

            {/* Contact erasure */}
            <div className="bg-white border border-[#E8E4DC] rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <Trash2 size={16} className="text-[#DC2626] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-[#0F0F0D]">Effacement contact (Art. 17)</p>
                  <p className="text-xs text-[#8A8680] mt-0.5">Supprime toutes les données d'un contact par son ID</p>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={contactId}
                  onChange={(e) => { setContactId(e.target.value); setContactResult(null) }}
                  placeholder="ID du contact (UUID)"
                  className="flex-1 text-sm border border-[#E8E4DC] rounded-xl px-3 py-2 bg-white text-[#0F0F0D] focus:outline-none focus:ring-2 focus:ring-[#DC2626] font-mono"
                />
                <a
                  href={contactId ? gdprApi.exportContact(selectedCompanyId, contactId) : "#"}
                  download
                  onClick={(e) => !contactId && e.preventDefault()}
                  className={cn(
                    "p-2.5 rounded-xl border border-[#E8E4DC] text-[#8A8680] hover:text-[#1A4E8C] transition-colors",
                    !contactId && "opacity-40 pointer-events-none",
                  )}
                  title="Exporter (Art. 20)"
                >
                  <Download size={14} />
                </a>
                <button
                  disabled={!contactId || eraseContact.isPending}
                  onClick={() => setContactConfirm(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-[#DC2626] text-white hover:bg-red-700 disabled:opacity-40 transition-colors"
                >
                  <Trash2 size={13} />
                  Effacer
                </button>
              </div>
              {contactResult && <p className="text-xs text-[#1A9E68]">{contactResult}</p>}
              {eraseContact.isError && <p className="text-xs text-red-600">Erreur lors de l'effacement.</p>}
            </div>

            {/* Member erasure */}
            <div className="bg-white border border-[#E8E4DC] rounded-2xl p-5 flex flex-col gap-0">
              <div className="flex items-start gap-3 mb-4">
                <Trash2 size={16} className="text-[#C97C0A] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-[#0F0F0D]">Effacement utilisateur (Art. 17)</p>
                  <p className="text-xs text-[#8A8680] mt-0.5">Anonymise les données personnelles d'un membre de ce tenant</p>
                </div>
              </div>
              {members.length === 0 ? (
                <p className="text-sm text-[#8A8680]">Aucun membre pour ce tenant.</p>
              ) : (
                members.map((m) => (
                  <MemberEraseRow key={m.id} member={m} companyId={selectedCompanyId} />
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {contactConfirm && (
        <ConfirmDialog
          title="Effacer les données du contact"
          body={`Supprimer définitivement toutes les données du contact ${contactId} (notes, événements, fiche). Cette action est irréversible.`}
          confirmLabel="Effacer"
          danger
          onConfirm={() => { setContactConfirm(false); eraseContact.mutate() }}
          onClose={() => setContactConfirm(false)}
        />
      )}
    </div>
  )
}

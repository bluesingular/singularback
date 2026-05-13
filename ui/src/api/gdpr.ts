import { api } from "./client";

export interface ErasureResult {
  ok: boolean;
  recordsDeleted: number;
  anonymised?: boolean;
  retainedNote: string;
}

export interface GdprErasureLogEntry {
  id: string;
  companyId: string;
  subjectType: "contact" | "user";
  subjectId: string;
  subjectLabel: string;
  requestedBy: string;
  recordsDeleted: number;
  retainedNote: string | null;
  erasedAt: string;
}

export const gdprApi = {
  eraseContact: (companyId: string, contactId: string): Promise<ErasureResult> =>
    api.post(`/companies/${companyId}/gdpr/contacts/${contactId}/erase`, {}),

  eraseUser: (companyId: string, userId: string): Promise<ErasureResult> =>
    api.post(`/companies/${companyId}/gdpr/users/${userId}/erase`, {}),

  exportContact: (companyId: string, contactId: string): string =>
    `/api/companies/${companyId}/gdpr/portability/contacts/${contactId}`,

  exportUser: (companyId: string, userId: string): string =>
    `/api/companies/${companyId}/gdpr/portability/users/${userId}`,

  auditCsvUrl: (companyId: string): string =>
    `/api/companies/${companyId}/gdpr/audit.csv`,
};

import { api } from "./client";

export type DocumentType =
  | "commercial_proposal"
  | "client_progress_report"
  | "meeting_summary"
  | "market_research_brief"
  | "administrative_template"
  | "custom";

export interface DocumentTypeInfo {
  slug:     DocumentType;
  label:    string;
  maxPages: number;
}

export interface GeneratedDocument {
  taskId:         string;
  title:          string;
  content:        string;
  documentType:   DocumentType;
  wordCount:      number;
  legalValid:     boolean;
  missingClauses: string[];
}

export const documentStudioApi = {
  types: (companyId: string) =>
    api.get<{ ok: true; data: DocumentTypeInfo[] }>(`/companies/${companyId}/documents/types`),

  generate: (
    companyId: string,
    body: {
      documentType:    DocumentType;
      title:           string;
      brief:           string;
      customStructure?: string[];
      assigneeAgentId?: string;
    },
  ) =>
    api.post<{ ok: true; data: GeneratedDocument }>(
      `/companies/${companyId}/documents/generate`,
      body,
    ),
};

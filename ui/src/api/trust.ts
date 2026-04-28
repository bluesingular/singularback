import { api } from "./client";

export interface TrustScore {
  agentId: string;
  agentName?: string;
  skillType: string;
  score: number;
  autonomyLevel: string;
  approvalStreak: number;
  taskCountWindow: number;
  qualityRatingAvg: number | null;
  updatedAt: string;
}

export interface TrustProposal {
  id: string;
  agentId: string;
  agentName?: string;
  skillType: string;
  currentLevel: string;
  proposedLevel: string;
  trustScore: number;
  approvalStreak: number;
  evidence: {
    taskCount: number;
    avgRating: number;
    gatePassRate: number;
    schemaPassRate: number;
  };
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface CompanyTrust {
  scores: TrustScore[];
  proposals: TrustProposal[];
}

export const trustApi = {
  getCompanyTrust: (companyId: string) =>
    api.get<CompanyTrust>(`/companies/${companyId}/trust`),

  approveProposal: (companyId: string, proposalId: string) =>
    api.post<{ ok: boolean }>(`/companies/${companyId}/trust/proposals/${proposalId}/approve`, {}),

  rejectProposal: (companyId: string, proposalId: string) =>
    api.post<{ ok: boolean }>(`/companies/${companyId}/trust/proposals/${proposalId}/reject`, {}),
};

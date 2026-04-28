import { api } from "./client";

export interface ConsoleCard {
  id: string;
  type: string;
  headline: string;
  body: string;
  urgency: number;
  taskId?: string;
  agentId?: string;
  createdAt: string;
}

export interface TrustSummary {
  agentId: string;
  agentName: string;
  skillType: string;
  autonomyLevel: string;
  score: number;
}

export interface ConsoleContext {
  cards: ConsoleCard[];
  queueDepth: number;
  trustState: TrustSummary[];
}

export interface ApproveCardResult {
  ok: boolean;
  cardId: string;
  taskId: string;
}

export const consoleApi = {
  getContext: (companyId: string) =>
    api.get<ConsoleContext>(`/companies/${companyId}/console`),

  approveCard: (companyId: string, cardId: string, userId: string) =>
    api.post<ApproveCardResult>(`/companies/${companyId}/console/approve`, {
      cardId,
      userId,
    }),
};

import { api } from "./client";

export interface IntelligenceCard {
  id: string;
  cardType: "anomaly" | "trust" | "relationship" | "goal";
  title: string;
  body: string;
  urgency: number;
  actionUrl: string | null;
  status: "unread" | "read" | "dismissed";
  createdAt: string;
}

export const intelligenceApi = {
  list: (companyId: string) =>
    api.get<IntelligenceCard[]>(`/companies/${companyId}/intelligence-cards`),
  markRead: (companyId: string, cardId: string) =>
    api.patch<{ id: string }>(`/companies/${companyId}/intelligence-cards/${cardId}/read`, {}),
};

import { api } from "./client";

export interface Notification {
  id: string;
  companyId: string;
  userId: string | null;
  type: "approval_pending" | "trust_proposal" | "trust_downgrade" | "intelligence" | "agent_error" | "budget_alert";
  title: string;
  body: string;
  actionUrl: string | null;
  status: "unread" | "read" | "dismissed";
  metadata: Record<string, unknown> | null;
  channelsDelivered: string;
  createdAt: string;
  expiresAt: string | null;
}

export interface NotificationPreferences {
  approvalInapp: boolean; approvalEmail: boolean;
  trustInapp: boolean;    trustEmail: boolean;
  intelligenceInapp: boolean; intelligenceEmail: boolean;
  errorInapp: boolean;    errorEmail: boolean;
  budgetInapp: boolean;   budgetEmail: boolean;
}

export const notificationsApi = {
  listUnread: (companyId: string) =>
    api.get<{ notifications: Notification[]; unreadCount: number }>(
      `/companies/${companyId}/notifications`,
    ),

  listAll: (companyId: string) =>
    api.get<{ notifications: Notification[] }>(
      `/companies/${companyId}/notifications/all`,
    ),

  markRead: (companyId: string, id: string) =>
    api.patch<{ id: string }>(`/companies/${companyId}/notifications/${id}/read`, {}),

  dismiss: (companyId: string, id: string) =>
    api.patch<{ id: string }>(`/companies/${companyId}/notifications/${id}/dismiss`, {}),

  markAllRead: (companyId: string) =>
    api.post<{ ok: boolean }>(`/companies/${companyId}/notifications/mark-all-read`, {}),

  getPreferences: (companyId: string) =>
    api.get<NotificationPreferences>(`/companies/${companyId}/notification-preferences`),

  updatePreferences: (companyId: string, patch: Partial<NotificationPreferences>) =>
    api.put<NotificationPreferences>(`/companies/${companyId}/notification-preferences`, patch),
};

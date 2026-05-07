import { api } from "./client";

export type MemberRole = "owner" | "admin" | "operator" | "viewer" | "api";

export interface Member {
  id: string;
  userId: string;
  role: MemberRole | null;
  status: string;
  joinedAt: string;
  email: string | null;
  name: string | null;
}

export const membersApi = {
  list(companyId: string): Promise<{ members: Member[] }> {
    return api(`/companies/${companyId}/singular/members`);
  },

  updateRole(companyId: string, memberId: string, role: MemberRole): Promise<{ id: string; role: MemberRole }> {
    return api(`/companies/${companyId}/singular/members/${memberId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
  },

  remove(companyId: string, memberId: string): Promise<{ ok: boolean }> {
    return api(`/companies/${companyId}/singular/members/${memberId}`, {
      method: "DELETE",
    });
  },
};

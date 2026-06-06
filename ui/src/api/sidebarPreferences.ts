import type { SidebarOrderPreference, UpsertSidebarOrderPreference } from "@paperclipai/shared";
import { api } from "./client";

export interface CompanySidebarPrefs {
  projectOrder:      string[];
  hiddenAgentIds:    string[];
  hiddenProjectIds:  string[];
  collapsedSections: string[];
}

export const sidebarPreferencesApi = {
  getCompanyOrder: () => api.get<SidebarOrderPreference>("/sidebar-preferences/me"),
  updateCompanyOrder: (data: UpsertSidebarOrderPreference) =>
    api.put<SidebarOrderPreference>("/sidebar-preferences/me", data),
  getProjectOrder: (companyId: string) =>
    api.get<SidebarOrderPreference>(`/companies/${companyId}/sidebar-preferences/me`),
  updateProjectOrder: (companyId: string, data: UpsertSidebarOrderPreference) =>
    api.put<SidebarOrderPreference>(`/companies/${companyId}/sidebar-preferences/me`, data),
  // Hide/collapse preferences
  getCompanyPrefs: (companyId: string) =>
    api.get<CompanySidebarPrefs>(`/companies/${companyId}/sidebar-preferences/me`),
  updateCompanyPrefs: (companyId: string, data: Partial<CompanySidebarPrefs>) =>
    api.put<CompanySidebarPrefs>(`/companies/${companyId}/sidebar-preferences/me`, data),
};

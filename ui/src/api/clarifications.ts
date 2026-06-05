/**
 * ui/src/api/clarifications.ts
 *
 * G5 — Human clarification flow API client.
 */

export interface ClarificationRequest {
  id:        string;
  issueId:   string;
  agentId:   string | null;
  question:  string;
  status:    "pending" | "answered" | "timed_out" | "cancelled";
  answer:    string | null;
  askedAt:   string;
  answeredAt: string | null;
}

async function list(companyId: string, status = "pending"): Promise<ClarificationRequest[]> {
  const res = await fetch(
    `/api/companies/${companyId}/clarifications?status=${status}`,
    { credentials: "include" },
  );
  if (!res.ok) return [];
  return res.json();
}

async function reply(companyId: string, clarificationId: string, answer: string): Promise<void> {
  const res = await fetch(
    `/api/companies/${companyId}/clarifications/${clarificationId}/reply`,
    {
      method:      "POST",
      credentials: "include",
      headers:     { "Content-Type": "application/json" },
      body:        JSON.stringify({ answer }),
    },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "Failed to submit answer");
  }
}

export const clarificationsApi = { list, reply };

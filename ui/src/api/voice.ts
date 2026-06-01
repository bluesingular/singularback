import { api } from "./client";

export interface VoiceResult {
  type:       "mission" | "task" | "clarification";
  id:         string | null;
  title:      string;
  transcript: string;
  confidence: "high" | "medium" | "low";
}

export const voiceApi = {
  transcribe: (companyId: string, audio: FormData) =>
    api.postForm<{ ok: true; data: VoiceResult }>(`/companies/${companyId}/voice`, audio),
};

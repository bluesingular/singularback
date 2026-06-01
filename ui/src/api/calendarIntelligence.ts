import { api } from "./client";

export interface CalendarEventInput {
  id:           string;
  title:        string;
  startAt:      string;   // ISO
  endAt:        string;
  attendees:    string[];
  contactId?:   string;
  contactName?: string;
}

export interface PreMeetingBriefing {
  eventId:            string;
  contactName:        string;
  lastContact:        { date: string; summary: string } | null;
  openItems:          string[];
  relationshipHealth: "good" | "needs_attention" | "at_risk";
  contextNotes:       string[];
  watchFor:           string[];
  briefingMd:         string;
}

export const calendarIntelligenceApi = {
  briefing: (companyId: string, event: CalendarEventInput) =>
    api.post<{ ok: true; data: PreMeetingBriefing }>(
      `/companies/${companyId}/calendar/briefing`,
      { event },
    ),
};

import { api, type ApiEnvelope } from "./api";

export type GoogleCalendarStatus = {
  connected: boolean;
  googleAccountId: string | null;
  calendarId: string | null;
  scope: string | null;
  connectedAt: string | null;
  expiresAt: string | null;
};

export type GoogleConnectResponse = {
  authorizationUrl: string;
};

export type GoogleDisconnectResponse = {
  success: boolean;
};

export async function getGoogleCalendarStatus() {
  const response =
    await api.get<ApiEnvelope<GoogleCalendarStatus>>("/integrations/google/status");
  return response.data;
}

export async function connectGoogleCalendar() {
  const response =
    await api.get<ApiEnvelope<GoogleConnectResponse>>("/integrations/google/connect");
  return response.data;
}

export async function disconnectGoogleCalendar() {
  const response =
    await api.post<ApiEnvelope<GoogleDisconnectResponse>>("/integrations/google/disconnect");
  return response.data;
}

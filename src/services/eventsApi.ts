import { api, type ApiEnvelope } from "./api";
import type {
  CreateEventPayload,
  EventItem,
  RecurrenceEventResponse,
  UpdateEventPayload,
} from "../types/domain";

export async function listEvents() {
  const response = await api.get<ApiEnvelope<EventItem[]>>("/events");
  return response.data;
}

export async function createEvent(payload: CreateEventPayload) {
  const response = await api.post<
    ApiEnvelope<EventItem | RecurrenceEventResponse>
  >("/events", payload);
  return response.data;
}

export async function updateEvent(id: string, payload: UpdateEventPayload) {
  const response = await api.patch<ApiEnvelope<EventItem>>(
    `/events/${id}`,
    payload,
  );
  return response.data;
}

export async function deleteEvent(id: string) {
  const response = await api.delete<ApiEnvelope<EventItem>>(`/events/${id}`);
  return response.data;
}

export async function seedDefaultEvents() {
  const response = await api.post<ApiEnvelope<EventItem[]>>(
    "/events/seed-defaults",
  );
  return response.data;
}

export async function listRecurrenceGroup(groupId: string) {
  const response = await api.get<ApiEnvelope<EventItem[]>>(
    `/events/recurrence-group/${groupId}`,
  );
  return response.data;
}

import type { AttendanceStatus, AttendanceItem } from "../types/domain";
import { api, type ApiEnvelope } from "./api";

export async function listMyAttendance() {
  const response =
    await api.get<ApiEnvelope<AttendanceItem[]>>("/attendance/my");
  return response.data;
}

export async function listAttendanceByEvent(eventId: string) {
  const response = await api.get<ApiEnvelope<AttendanceItem[]>>(
    `/attendance/event/${eventId}`,
  );
  return response.data;
}

export async function confirmAttendance(scheduleId: string) {
  const response = await api.post<ApiEnvelope<{ attendance: AttendanceItem }>>(
    `/attendance/${scheduleId}/confirm`,
  );
  return response.data;
}

export async function checkInAttendance(scheduleId: string) {
  const response = await api.post<ApiEnvelope<{ attendance: AttendanceItem }>>(
    `/attendance/${scheduleId}/check-in`,
  );
  return response.data;
}

export async function markAttendanceStatus(
  scheduleId: string,
  payload: { status: AttendanceStatus; note?: string },
) {
  const response = await api.patch<ApiEnvelope<AttendanceItem>>(
    `/attendance/${scheduleId}/status`,
    payload,
  );
  return response.data;
}

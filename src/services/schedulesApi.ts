import { api, type ApiEnvelope } from "./api";
import type {
  CreateSchedulePayload,
  ScheduleItem,
  SchedulesFilters,
  UpdateSchedulePayload,
} from "../types/domain";

export async function listSchedules(filters: SchedulesFilters = {}) {
  const response = await api.get<ApiEnvelope<ScheduleItem[]>>("/schedules", {
    params: filters,
  });
  return response.data;
}

export async function createSchedule(payload: CreateSchedulePayload) {
  const response = await api.post<ApiEnvelope<ScheduleItem>>(
    "/schedules",
    payload,
  );
  return response.data;
}

export async function updateSchedule(
  id: string,
  payload: UpdateSchedulePayload,
) {
  const response = await api.patch<ApiEnvelope<ScheduleItem>>(
    `/schedules/${id}`,
    payload,
  );
  return response.data;
}

export async function cancelSchedule(id: string) {
  const response = await api.patch<ApiEnvelope<ScheduleItem>>(
    `/schedules/${id}/cancel`,
  );
  return response.data;
}

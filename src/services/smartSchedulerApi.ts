import { api, type ApiEnvelope } from "./api";
import type {
  ManualSmartSuggestions,
  SmartSchedulerGeneration,
  SmartSchedulerInsights,
} from "../types/domain";

type GenerateSmartSchedulePayload = {
  ministryIds?: string[];
  slotsPerMinistry?: number;
};

export async function getSmartSchedulerInsights(eventId: string) {
  const response = await api.get<ApiEnvelope<SmartSchedulerInsights>>(
    `/smart-scheduler/insights/${eventId}`,
  );
  return response.data;
}

export async function getManualSmartSuggestions(params: {
  eventId: string;
  ministryId: string;
  limit?: number;
}) {
  const response = await api.get<ApiEnvelope<ManualSmartSuggestions>>(
    "/smart-scheduler/suggestions",
    {
      params,
    },
  );

  return response.data;
}

export async function generateSmartSchedule(
  eventId: string,
  payload: GenerateSmartSchedulePayload,
) {
  const response = await api.post<ApiEnvelope<SmartSchedulerGeneration>>(
    `/smart-scheduler/generate/${eventId}`,
    payload,
  );
  return response.data;
}

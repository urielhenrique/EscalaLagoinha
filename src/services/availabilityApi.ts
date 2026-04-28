import { api, type ApiEnvelope } from "./api";
import type {
  BlockedDateItem,
  MinistryPreferenceItem,
  SaveAvailabilityPayload,
  SaveMinistryPreferencesPayload,
  VolunteerAvailabilityItem,
} from "../types/domain";

type AvailabilityMeResponse = {
  weekly: VolunteerAvailabilityItem[];
  blockedDates: BlockedDateItem[];
  ministryPreferences: Array<
    MinistryPreferenceItem & {
      ministry: {
        id: string;
        nome: string;
        descricao: string;
        leaderId: string | null;
      };
    }
  >;
};

export async function getMyAvailability() {
  const response =
    await api.get<ApiEnvelope<AvailabilityMeResponse>>("/availability/me");
  return response.data;
}

export async function saveWeeklyAvailability(payload: SaveAvailabilityPayload) {
  const response = await api.put<ApiEnvelope<VolunteerAvailabilityItem[]>>(
    "/availability/me/weekly",
    payload,
  );
  return response.data;
}

export async function saveMinistryPreferences(
  payload: SaveMinistryPreferencesPayload,
) {
  const response = await api.put<ApiEnvelope<MinistryPreferenceItem[]>>(
    "/availability/me/ministry-preferences",
    payload,
  );
  return response.data;
}

export async function addBlockedDate(payload: {
  date: string;
  reason: string;
}) {
  const response = await api.post<ApiEnvelope<BlockedDateItem>>(
    "/availability/me/blocked-dates",
    payload,
  );
  return response.data;
}

export async function removeBlockedDate(id: string) {
  const response = await api.delete<ApiEnvelope<BlockedDateItem>>(
    `/availability/me/blocked-dates/${id}`,
  );
  return response.data;
}

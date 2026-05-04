import { api, type ApiEnvelope } from "./api";
import type {
  CreateMinistryPayload,
  MinistryItem,
  UpdateMinistryPayload,
} from "../types/domain";

export async function listVisibleMinistries() {
  const response = await api.get<ApiEnvelope<MinistryItem[]>>("/ministries");
  return response.data;
}

export async function createMinistry(payload: CreateMinistryPayload) {
  const response = await api.post<ApiEnvelope<MinistryItem>>(
    "/ministries",
    payload,
  );
  return response.data;
}

export async function updateMinistry(
  id: string,
  payload: UpdateMinistryPayload,
) {
  const response = await api.patch<ApiEnvelope<MinistryItem>>(
    `/ministries/${id}`,
    payload,
  );
  return response.data;
}

export async function deleteMinistry(id: string) {
  const response = await api.delete<ApiEnvelope<MinistryItem>>(
    `/ministries/${id}`,
  );
  return response.data;
}

export async function seedDefaultMinistries() {
  const response = await api.post<ApiEnvelope<MinistryItem[]>>(
    "/ministries/seed-defaults",
  );
  return response.data;
}

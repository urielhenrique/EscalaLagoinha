import { api, type ApiEnvelope } from "./api";
import type {
  CreateSwapRequestPayload,
  ScheduleItem,
  SwapRequestItem,
} from "../types/domain";

export async function listEligibleSwapCandidates(requesterShiftId: string) {
  const response = await api.get<ApiEnvelope<ScheduleItem[]>>(
    `/swap-requests/eligible/${requesterShiftId}`,
  );
  return response.data;
}

export async function createSwapRequest(payload: CreateSwapRequestPayload) {
  const response = await api.post<ApiEnvelope<SwapRequestItem>>(
    "/swap-requests",
    payload,
  );
  return response.data;
}

export async function listMySwapRequests() {
  const response = await api.get<ApiEnvelope<SwapRequestItem[]>>(
    "/swap-requests/my-requests",
  );
  return response.data;
}

export async function listReceivedSwapRequests() {
  const response = await api.get<ApiEnvelope<SwapRequestItem[]>>(
    "/swap-requests/received",
  );
  return response.data;
}

export async function listSwapHistory() {
  const response = await api.get<ApiEnvelope<SwapRequestItem[]>>(
    "/swap-requests/history",
  );
  return response.data;
}

export async function approveSwapRequest(id: string) {
  const response = await api.patch<ApiEnvelope<SwapRequestItem>>(
    `/swap-requests/${id}/approve`,
  );
  return response.data;
}

export async function rejectSwapRequest(id: string) {
  const response = await api.patch<ApiEnvelope<SwapRequestItem>>(
    `/swap-requests/${id}/reject`,
  );
  return response.data;
}

export async function cancelSwapRequest(id: string) {
  const response = await api.patch<ApiEnvelope<SwapRequestItem>>(
    `/swap-requests/${id}/cancel`,
  );
  return response.data;
}

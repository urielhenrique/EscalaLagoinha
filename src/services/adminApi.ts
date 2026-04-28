import { api, type ApiEnvelope } from "./api";
import type { UserItem } from "../types/domain";

export async function listPendingUsers() {
  const response = await api.get<ApiEnvelope<UserItem[]>>("/users/pending");
  return response.data;
}

export async function approveUser(id: string) {
  const response = await api.patch<ApiEnvelope<UserItem>>(
    `/users/${id}/approve`,
  );
  return response.data;
}

export async function rejectUser(id: string) {
  const response = await api.patch<ApiEnvelope<UserItem>>(
    `/users/${id}/reject`,
  );
  return response.data;
}

export async function listAllUsers(params?: {
  perfil?: string;
  status?: string;
}) {
  const query = new URLSearchParams();
  if (params?.perfil) query.set("perfil", params.perfil);
  if (params?.status) query.set("status", params.status);

  const response = await api.get<ApiEnvelope<UserItem[]>>(
    `/users?${query.toString()}`,
  );
  return response.data;
}

export async function updateUserProfile(
  id: string,
  perfil: "VOLUNTARIO" | "ADMIN" | "MASTER_ADMIN" | "MASTER_PLATFORM_ADMIN",
) {
  const response = await api.patch<ApiEnvelope<UserItem>>(`/users/${id}`, {
    perfil,
  });
  return response.data;
}

export async function deactivateUser(id: string) {
  const response = await api.delete<ApiEnvelope<UserItem>>(`/users/${id}`);
  return response.data;
}

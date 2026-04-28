import { api, type ApiEnvelope } from "./api";
import type { NotificationItem } from "../types/domain";

export async function listNotifications(
  unreadOnly = false,
  signal?: AbortSignal,
) {
  const response = await api.get<ApiEnvelope<NotificationItem[]>>(
    "/notifications",
    {
      params: { unreadOnly },
      signal,
    },
  );
  return response.data;
}

export async function getUnreadNotificationsCount() {
  const response = await api.get<ApiEnvelope<{ count: number }>>(
    "/notifications/unread-count",
  );
  return response.data;
}

export async function markNotificationAsRead(id: string) {
  const response = await api.patch<ApiEnvelope<NotificationItem>>(
    `/notifications/${id}/read`,
  );
  return response.data;
}

export async function markAllNotificationsAsRead() {
  const response = await api.patch<ApiEnvelope<{ updated: number }>>(
    "/notifications/read-all",
  );
  return response.data;
}

export async function deleteNotification(id: string) {
  const response = await api.delete<ApiEnvelope<NotificationItem>>(
    `/notifications/${id}`,
  );
  return response.data;
}

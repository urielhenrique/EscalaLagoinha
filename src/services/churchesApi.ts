import axios from "axios";
import { getAuthToken } from "./authStorage";
import { ApiError, api, type ApiEnvelope } from "./api";
import type { ChurchItem, ChurchSettingsItem, UserItem } from "../types/domain";

export type CreateChurchPayload = {
  nome: string;
  slug: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  logo?: string;
  responsavelPrincipal?: string;
};

export type UpdateChurchSettingsPayload = {
  customChurchName?: string;
  customPlatformName?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  defaultEmailFrom?: string;
  approvalPolicy?: "MANUAL" | "AUTO";
  reminderLeadMinutes?: number;
  swapRules?: Record<string, unknown>;
  scoreRules?: Record<string, unknown>;
  defaultServiceDays?: string[];
  customDomain?: string;
};

export type CreateInviteLinkPayload = {
  ministryName?: string;
};

export type CreateInviteLinkResponse = {
  churchId: string;
  churchName: string;
  inviteUrl: string;
};

const primaryBaseUrl = api.defaults.baseURL?.toString() ?? "";
const fallbackBaseUrl = primaryBaseUrl.endsWith("/api")
  ? primaryBaseUrl.slice(0, -4)
  : null;

type ApiErrorBody = {
  message?: string;
  errors?: string[];
};

function toApiError(error: unknown, fallbackMessage: string) {
  if (error instanceof ApiError) {
    return error;
  }

  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return new ApiError(
      error.response?.data?.message || error.message || fallbackMessage,
      error.response?.status,
      error.response?.data?.errors,
    );
  }

  if (error instanceof Error) {
    return new ApiError(error.message, undefined);
  }

  return new ApiError(fallbackMessage, undefined);
}

function shouldRetryWithoutApiPrefix(error: ApiError) {
  return (
    error.status === 404 &&
    Boolean(fallbackBaseUrl) &&
    error.message === "Request failed with status code 404"
  );
}

async function requestChurchesApi<T>(params: {
  method: "get" | "post" | "patch";
  path: string;
  data?: unknown;
}) {
  try {
    const response = await api.request<ApiEnvelope<T>>({
      method: params.method,
      url: params.path,
      data: params.data,
    });
    return response.data;
  } catch (error) {
    const normalizedError = toApiError(
      error,
      "Erro inesperado ao consultar igrejas.",
    );

    if (!shouldRetryWithoutApiPrefix(normalizedError) || !fallbackBaseUrl) {
      throw normalizedError;
    }

    const token = getAuthToken();

    try {
      const fallbackResponse = await axios.request<ApiEnvelope<T>>({
        method: params.method,
        url: `${fallbackBaseUrl}${params.path}`,
        data: params.data,
        timeout: 15000,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      return fallbackResponse.data;
    } catch (fallbackError) {
      throw toApiError(fallbackError, "Erro inesperado ao consultar igrejas.");
    }
  }
}

export async function listVisibleChurches() {
  return requestChurchesApi<ChurchItem[]>({
    method: "get",
    path: "/churches",
  });
}

export async function getCurrentChurch() {
  try {
    return await requestChurchesApi<ChurchItem>({
      method: "get",
      path: "/churches/current",
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      const fallback = await requestChurchesApi<ChurchItem[]>({
        method: "get",
        path: "/churches",
      });
      const firstChurch = fallback.data[0];

      if (!firstChurch) {
        throw new ApiError("Nenhuma igreja encontrada para o usuário.", 404);
      }

      return {
        success: fallback.success,
        message: fallback.message,
        data: firstChurch,
      };
    }

    throw error;
  }
}

export async function createChurch(payload: CreateChurchPayload) {
  return requestChurchesApi<ChurchItem>({
    method: "post",
    path: "/churches",
    data: payload,
  });
}

export async function updateCurrentChurchSettings(
  payload: UpdateChurchSettingsPayload,
) {
  return requestChurchesApi<ChurchSettingsItem>({
    method: "patch",
    path: "/churches/current/settings",
    data: payload,
  });
}

export async function listChurchAdmins(churchId: string) {
  return requestChurchesApi<UserItem[]>({
    method: "get",
    path: `/churches/${churchId}/admins`,
  });
}

export async function changeChurchAdminRole(
  churchId: string,
  userId: string,
  perfil: "VOLUNTARIO" | "ADMIN" | "MASTER_ADMIN",
) {
  return requestChurchesApi<UserItem>({
    method: "patch",
    path: `/churches/${churchId}/admins/${userId}/profile`,
    data: { perfil },
  });
}

export async function createCurrentChurchInviteLink(
  payload: CreateInviteLinkPayload,
) {
  return requestChurchesApi<CreateInviteLinkResponse>({
    method: "post",
    path: "/churches/current/invite-link",
    data: payload,
  });
}

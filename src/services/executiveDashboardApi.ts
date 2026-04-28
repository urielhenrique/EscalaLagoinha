import { api, type ApiEnvelope } from "./api";
import type {
  AdminExecutiveDashboard,
  RankingResponse,
  StrategicDashboard,
  VolunteerExecutiveDashboard,
} from "../types/domain";

export async function getRanking(limit = 30) {
  const response = await api.get<ApiEnvelope<RankingResponse>>(
    "/smart-scheduler/ranking",
    {
      params: { limit },
    },
  );

  return response.data;
}

export async function getAdminExecutiveDashboard() {
  const response = await api.get<ApiEnvelope<AdminExecutiveDashboard>>(
    "/smart-scheduler/dashboard/admin",
  );

  return response.data;
}

export async function getVolunteerExecutiveDashboard() {
  const response = await api.get<ApiEnvelope<VolunteerExecutiveDashboard>>(
    "/smart-scheduler/dashboard/me",
  );

  return response.data;
}

export async function getStrategicDashboard() {
  const response = await api.get<ApiEnvelope<StrategicDashboard>>(
    "/smart-scheduler/strategic",
  );
  return response.data;
}

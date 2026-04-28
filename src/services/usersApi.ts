import { api, type ApiEnvelope } from "./api";
import type { UserItem } from "../types/domain";

export async function listActiveVolunteers() {
  const response = await api.get<ApiEnvelope<UserItem[]>>("/users", {
    params: {
      ativo: true,
      perfil: "VOLUNTARIO",
    },
  });

  return response.data;
}

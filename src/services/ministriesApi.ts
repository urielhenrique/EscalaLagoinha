import { api, type ApiEnvelope } from "./api";
import type { MinistryItem } from "../types/domain";

export async function listVisibleMinistries() {
  const response = await api.get<ApiEnvelope<MinistryItem[]>>("/ministries");
  return response.data;
}

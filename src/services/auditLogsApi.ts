import type { AuditLogItem } from "../types/domain";
import { api, type ApiEnvelope } from "./api";

export type AuditLogsFilters = {
  userId?: string;
  action?: string;
  module?: string;
  search?: string;
  targetId?: string;
  from?: string;
  to?: string;
  limit?: number;
};

export async function listAuditLogs(filters: AuditLogsFilters = {}) {
  const response = await api.get<ApiEnvelope<AuditLogItem[]>>("/audit-logs", {
    params: filters,
  });
  return response.data;
}

import { api, type ApiEnvelope } from "./api";
import type { ReportsOverviewResponse } from "../types/domain";

export type ReportsFilters = {
  from?: string;
  to?: string;
  ministryId?: string;
  volunteerId?: string;
};

export async function getReportsOverview(filters: ReportsFilters = {}) {
  const response = await api.get<ApiEnvelope<ReportsOverviewResponse>>(
    "/reports/overview",
    {
      params: filters,
    },
  );
  return response.data;
}

export async function exportReports(
  format: "csv" | "xlsx" | "pdf",
  filters: ReportsFilters = {},
) {
  const response = await api.get("/reports/export", {
    params: { ...filters, format },
    responseType: "blob",
  });

  const url = window.URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = `relatorio-presenca.${format}`;
  link.click();
  window.URL.revokeObjectURL(url);
}

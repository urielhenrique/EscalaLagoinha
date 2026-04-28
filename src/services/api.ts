import axios, { AxiosError } from "axios";
import { getAuthToken } from "./authStorage";

export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

type ApiErrorBody = {
  success?: boolean;
  message?: string;
  errors?: string[];
};

export class ApiError extends Error {
  status?: number;
  errors?: string[];

  constructor(message: string, status?: number, errors?: string[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

if (import.meta.env.PROD && !configuredApiUrl) {
  throw new Error(
    "VITE_API_URL não configurada para build de produção do frontend.",
  );
}

const apiBaseUrl = configuredApiUrl || "http://localhost:3000/api";

export const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorBody>) => {
    const status = error.response?.status;
    const message =
      error.response?.data?.message ||
      error.message ||
      "Erro inesperado na API.";
    const errors = error.response?.data?.errors;

    return Promise.reject(new ApiError(message, status, errors));
  },
);

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

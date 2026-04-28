import { api, type ApiEnvelope } from "./api";
import type {
  AuthLoginResponse,
  AuthMeResponse,
  LoginPayload,
  OnboardingChurchPayload,
  OnboardingChurchResponse,
  RegisterPayload,
  RegisterResponse,
} from "../types/auth";

type RegisterRequestPayload = {
  nome: string;
  email: string;
  telefone: string;
  senha: string;
  churchSlug?: string;
};

export async function loginRequest(payload: LoginPayload) {
  const response = await api.post<ApiEnvelope<AuthLoginResponse>>(
    "/auth/login",
    payload,
  );
  return response.data;
}

export async function registerRequest(payload: RegisterPayload) {
  const requestBody: RegisterRequestPayload = {
    nome: payload.nomeCompleto,
    email: payload.email,
    telefone: payload.telefone,
    senha: payload.senha,
    churchSlug: payload.churchSlug,
  };

  const response = await api.post<ApiEnvelope<RegisterResponse>>(
    "/auth/register",
    requestBody,
  );

  return response.data;
}

export async function meRequest() {
  const response = await api.get<ApiEnvelope<AuthMeResponse>>("/auth/me");
  return response.data;
}

export async function updateMyProfileRequest(payload: {
  nome?: string;
  telefone?: string;
  foto?: string;
}) {
  const response = await api.patch<ApiEnvelope<AuthMeResponse>>(
    "/auth/me",
    payload,
  );
  return response.data;
}

export async function onboardingChurchRequest(
  payload: OnboardingChurchPayload,
) {
  const response = await api.post<ApiEnvelope<OnboardingChurchResponse>>(
    "/auth/onboarding",
    payload,
  );
  return response.data;
}

export async function forgotPasswordRequest(email: string) {
  const response = await api.post<ApiEnvelope<null>>("/auth/forgot-password", {
    email,
  });
  return response.data;
}

export async function resetPasswordRequest(token: string, novaSenha: string) {
  const response = await api.post<ApiEnvelope<null>>("/auth/reset-password", {
    token,
    novaSenha,
  });
  return response.data;
}

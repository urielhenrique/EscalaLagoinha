import type { AuthUser } from "../types/auth";

const AUTH_USER_KEY = "escala_lagoinha_auth_user";
const AUTH_TOKEN_KEY = "escala_lagoinha_auth_token";

export function saveAuthUser(user: AuthUser): void {
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export function saveAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function getAuthUser(): AuthUser | null {
  const value = localStorage.getItem(AUTH_USER_KEY);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as AuthUser;
  } catch {
    localStorage.removeItem(AUTH_USER_KEY);
    return null;
  }
}

export function clearAuthUser(): void {
  localStorage.removeItem(AUTH_USER_KEY);
}

export function getAuthToken(): string | null {
  const value = localStorage.getItem(AUTH_TOKEN_KEY);
  return value && value.trim().length > 0 ? value : null;
}

export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function clearAuthStorage(): void {
  clearAuthUser();
  clearAuthToken();
}

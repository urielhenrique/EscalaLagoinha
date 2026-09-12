import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { AuthProvider } from "./AuthContext";
import { useAuth } from "../hooks/useAuth";

vi.mock("../services/authStorage", () => ({
  getAuthToken: vi.fn().mockReturnValue(null),
  getAuthUser: vi.fn().mockReturnValue(null),
  saveAuthToken: vi.fn(),
  saveAuthUser: vi.fn(),
  clearAuthStorage: vi.fn(),
  clearAuthUser: vi.fn(),
}));

vi.mock("../services/authApi", () => ({
  loginRequest: vi.fn(),
  meRequest: vi.fn(),
  registerRequest: vi.fn(),
  forgotPasswordRequest: vi.fn(),
  resetPasswordRequest: vi.fn(),
}));

vi.mock("../services/authMapper", () => ({
  profileToAuthUser: vi.fn(),
}));

describe("AuthContext", () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should start with isLoading true, then become false", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it("should start with user null after bootstrap", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.user).toBeNull();
  });

  it("should start with isAuthenticated false after bootstrap", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("should expose login function", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(typeof result.current.login).toBe("function");
  });

  it("should expose logout function", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(typeof result.current.logout).toBe("function");
  });
});

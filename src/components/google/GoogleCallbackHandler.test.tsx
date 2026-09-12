import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { GoogleCallbackHandler } from "./GoogleCallbackHandler";

const mockSuccess = vi.fn();
const mockError = vi.fn();

vi.mock("../../context/ToastContext", () => ({
  useToast: () => ({
    success: mockSuccess,
    error: mockError,
  }),
}));

describe("GoogleCallbackHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "history", {
      value: { replaceState: vi.fn() },
      writable: true,
      configurable: true,
    });
  });

  describe("callback de sucesso", () => {
    it("should show success toast when google_calendar=connected", () => {
      render(
        <MemoryRouter initialEntries={["/?google_calendar=connected"]}>
          <GoogleCallbackHandler />
        </MemoryRouter>,
      );

      expect(mockSuccess).toHaveBeenCalledWith(
        "Google Calendar conectado com sucesso.",
      );
    });

    it("should clean query params from URL", () => {
      render(
        <MemoryRouter initialEntries={["/?google_calendar=connected"]}>
          <GoogleCallbackHandler />
        </MemoryRouter>,
      );

      expect(window.history.replaceState).toHaveBeenCalledWith(
        {},
        "",
        "/",
      );
    });
  });

  describe("callback de erro", () => {
    it("should show error toast when google_calendar=error", () => {
      render(
        <MemoryRouter
          initialEntries={[
            "/?google_calendar=error&google_error=Auth+cancelada",
          ]}
        >
          <GoogleCallbackHandler />
        </MemoryRouter>,
      );

      expect(mockError).toHaveBeenCalledWith("Auth cancelada");
    });

    it("should show default error message when no google_error param", () => {
      render(
        <MemoryRouter initialEntries={["/?google_calendar=error"]}>
          <GoogleCallbackHandler />
        </MemoryRouter>,
      );

      expect(mockError).toHaveBeenCalledWith(
        "Erro ao conectar com o Google Calendar.",
      );
    });
  });

  describe("atualização do status após callback", () => {
    it("should not show any toast when no google_calendar param", () => {
      render(
        <MemoryRouter initialEntries={["/"]}>
          <GoogleCallbackHandler />
        </MemoryRouter>,
      );

      expect(mockSuccess).not.toHaveBeenCalled();
      expect(mockError).not.toHaveBeenCalled();
    });

    it("should clean URL params on success", () => {
      render(
        <MemoryRouter initialEntries={["/?google_calendar=connected"]}>
          <GoogleCallbackHandler />
        </MemoryRouter>,
      );

      expect(window.history.replaceState).toHaveBeenCalledWith(
        {},
        "",
        "/",
      );
    });
  });

  describe("comportamento quando status retorna erro", () => {
    it("should not crash when search params are empty", () => {
      expect(() => {
        render(
          <MemoryRouter initialEntries={["/"]}>
            <GoogleCallbackHandler />
          </MemoryRouter>,
        );
      }).not.toThrow();
    });
  });
});

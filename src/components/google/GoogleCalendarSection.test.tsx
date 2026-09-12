import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { GoogleCalendarSection } from "./GoogleCalendarSection";

const mockGetStatus = vi.fn();
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();

vi.mock("../../services/googleCalendarApi", () => ({
  getGoogleCalendarStatus: (...args: unknown[]) => mockGetStatus(...args),
  connectGoogleCalendar: (...args: unknown[]) => mockConnect(...args),
  disconnectGoogleCalendar: (...args: unknown[]) => mockDisconnect(...args),
}));

const mockSuccess = vi.fn();
const mockError = vi.fn();

vi.mock("../../context/ToastContext", () => ({
  useToast: () => ({
    success: mockSuccess,
    error: mockError,
  }),
}));

describe("GoogleCalendarSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(false);
  });

  describe("renderização do estado não conectado", () => {
    it("should render disconnected state", async () => {
      mockGetStatus.mockResolvedValue({
        data: {
          connected: false,
          googleAccountId: null,
          calendarId: null,
          scope: null,
          connectedAt: null,
          expiresAt: null,
        },
      });

      render(<GoogleCalendarSection />);

      await waitFor(() => {
        expect(screen.getByText("Não conectado")).toBeTruthy();
      });

      expect(
        screen.getByText("Conectar Google Calendar"),
      ).toBeTruthy();
    });

    it("should show description text", async () => {
      mockGetStatus.mockResolvedValue({
        data: {
          connected: false,
          googleAccountId: null,
          calendarId: null,
          scope: null,
          connectedAt: null,
          expiresAt: null,
        },
      });

      render(<GoogleCalendarSection />);

      await waitFor(() => {
        expect(
          screen.getByText(
            "Conecte sua conta Google para integrar seus eventos ao Google Calendar.",
          ),
        ).toBeTruthy();
      });
    });
  });

  describe("renderização do estado conectado", () => {
    it("should render connected state", async () => {
      mockGetStatus.mockResolvedValue({
        data: {
          connected: true,
          googleAccountId: "google-123",
          calendarId: "primary",
          scope: "calendar.events",
          connectedAt: "2026-01-01T00:00:00.000Z",
          expiresAt: "2026-01-02T00:00:00.000Z",
        },
      });

      render(<GoogleCalendarSection />);

      await waitFor(() => {
        expect(
          screen.getByText("Google Calendar conectado"),
        ).toBeTruthy();
      });

      expect(
        screen.getByText("Desconectar Google Calendar"),
      ).toBeTruthy();
    });
  });

  describe("chamada GET /status", () => {
    it("should call getGoogleCalendarStatus on mount", async () => {
      mockGetStatus.mockResolvedValue({
        data: {
          connected: false,
          googleAccountId: null,
          calendarId: null,
          scope: null,
          connectedAt: null,
          expiresAt: null,
        },
      });

      render(<GoogleCalendarSection />);

      await waitFor(() => {
        expect(mockGetStatus).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("botão conectar", () => {
    it("should show connect button when disconnected", async () => {
      mockGetStatus.mockResolvedValue({
        data: {
          connected: false,
          googleAccountId: null,
          calendarId: null,
          scope: null,
          connectedAt: null,
          expiresAt: null,
        },
      });

      render(<GoogleCalendarSection />);

      await waitFor(() => {
        expect(screen.getByText("Conectar Google Calendar")).toBeTruthy();
      });
    });
  });

  describe("chamada /connect autenticada", () => {
    it("should call connectGoogleCalendar when connect button is clicked", async () => {
      mockGetStatus.mockResolvedValue({
        data: {
          connected: false,
          googleAccountId: null,
          calendarId: null,
          scope: null,
          connectedAt: null,
          expiresAt: null,
        },
      });
      mockConnect.mockResolvedValue({
        data: { authorizationUrl: "https://accounts.google.com/o/oauth2/auth?..." },
      });

      Object.defineProperty(window, "location", {
        value: { href: "" },
        writable: true,
        configurable: true,
      });

      render(<GoogleCalendarSection />);

      await waitFor(() => {
        expect(screen.getByText("Conectar Google Calendar")).toBeTruthy();
      });

      screen.getByText("Conectar Google Calendar").click();

      await waitFor(() => {
        expect(mockConnect).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("redirecionamento para authorizationUrl", () => {
    it("should redirect to authorizationUrl returned by backend", async () => {
      mockGetStatus.mockResolvedValue({
        data: {
          connected: false,
          googleAccountId: null,
          calendarId: null,
          scope: null,
          connectedAt: null,
          expiresAt: null,
        },
      });
      mockConnect.mockResolvedValue({
        data: {
          authorizationUrl:
            "https://accounts.google.com/o/oauth2/auth?client_id=abc",
        },
      });

      const originalHref = window.location.href;
      Object.defineProperty(window, "location", {
        value: { href: originalHref },
        writable: true,
        configurable: true,
      });

      render(<GoogleCalendarSection />);

      await waitFor(() => {
        expect(screen.getByText("Conectar Google Calendar")).toBeTruthy();
      });

      screen.getByText("Conectar Google Calendar").click();

      await waitFor(() => {
        expect(window.location.href).toBe(
          "https://accounts.google.com/o/oauth2/auth?client_id=abc",
        );
      });
    });
  });

  describe("loading do connect", () => {
    it("should show loading state during connect", async () => {
      mockGetStatus.mockResolvedValue({
        data: {
          connected: false,
          googleAccountId: null,
          calendarId: null,
          scope: null,
          connectedAt: null,
          expiresAt: null,
        },
      });

      let resolveConnect: (v: unknown) => void;
      mockConnect.mockImplementation(
        () => new Promise((r) => { resolveConnect = r; }),
      );

      render(<GoogleCalendarSection />);

      await waitFor(() => {
        expect(screen.getByText("Conectar Google Calendar")).toBeTruthy();
      });

      screen.getByText("Conectar Google Calendar").click();

      await waitFor(() => {
        expect(screen.getByText("Conectando...")).toBeTruthy();
      });

      resolveConnect!({
        data: { authorizationUrl: "https://accounts.google.com/o/oauth2/auth?..." },
      });
    });
  });

  describe("erro no connect", () => {
    it("should show toast error when connect fails", async () => {
      mockGetStatus.mockResolvedValue({
        data: {
          connected: false,
          googleAccountId: null,
          calendarId: null,
          scope: null,
          connectedAt: null,
          expiresAt: null,
        },
      });
      mockConnect.mockRejectedValue(new Error("Falha na conexão"));

      render(<GoogleCalendarSection />);

      await waitFor(() => {
        expect(screen.getByText("Conectar Google Calendar")).toBeTruthy();
      });

      screen.getByText("Conectar Google Calendar").click();

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith("Falha na conexão");
      });
    });
  });

  describe("botão desconectar", () => {
    it("should show disconnect button when connected", async () => {
      mockGetStatus.mockResolvedValue({
        data: {
          connected: true,
          googleAccountId: "google-123",
          calendarId: "primary",
          scope: "calendar.events",
          connectedAt: "2026-01-01T00:00:00.000Z",
          expiresAt: "2026-01-02T00:00:00.000Z",
        },
      });

      render(<GoogleCalendarSection />);

      await waitFor(() => {
        expect(
          screen.getByText("Desconectar Google Calendar"),
        ).toBeTruthy();
      });
    });
  });

  describe("chamada POST /disconnect", () => {
    it("should call disconnectGoogleCalendar when confirmed", async () => {
      mockGetStatus.mockResolvedValue({
        data: {
          connected: true,
          googleAccountId: "google-123",
          calendarId: "primary",
          scope: "calendar.events",
          connectedAt: "2026-01-01T00:00:00.000Z",
          expiresAt: "2026-01-02T00:00:00.000Z",
        },
      });
      mockDisconnect.mockResolvedValue({ data: { success: true } });
      vi.spyOn(window, "confirm").mockReturnValue(true);

      render(<GoogleCalendarSection />);

      await waitFor(() => {
        expect(
          screen.getByText("Desconectar Google Calendar"),
        ).toBeTruthy();
      });

      screen.getByText("Desconectar Google Calendar").click();

      await waitFor(() => {
        expect(mockDisconnect).toHaveBeenCalledTimes(1);
      });
    });

    it("should not call disconnect when user cancels confirmation", async () => {
      mockGetStatus.mockResolvedValue({
        data: {
          connected: true,
          googleAccountId: "google-123",
          calendarId: "primary",
          scope: "calendar.events",
          connectedAt: "2026-01-01T00:00:00.000Z",
          expiresAt: "2026-01-02T00:00:00.000Z",
        },
      });
      vi.spyOn(window, "confirm").mockReturnValue(false);

      render(<GoogleCalendarSection />);

      await waitFor(() => {
        expect(
          screen.getByText("Desconectar Google Calendar"),
        ).toBeTruthy();
      });

      screen.getByText("Desconectar Google Calendar").click();

      await waitFor(() => {
        expect(mockDisconnect).not.toHaveBeenCalled();
      });
    });
  });

  describe("loading do disconnect", () => {
    it("should show loading state during disconnect", async () => {
      mockGetStatus.mockResolvedValue({
        data: {
          connected: true,
          googleAccountId: "google-123",
          calendarId: "primary",
          scope: "calendar.events",
          connectedAt: "2026-01-01T00:00:00.000Z",
          expiresAt: "2026-01-02T00:00:00.000Z",
        },
      });

      let resolveDisconnect: (v: unknown) => void;
      mockDisconnect.mockImplementation(
        () => new Promise((r) => { resolveDisconnect = r; }),
      );
      vi.spyOn(window, "confirm").mockReturnValue(true);

      render(<GoogleCalendarSection />);

      await waitFor(() => {
        expect(
          screen.getByText("Desconectar Google Calendar"),
        ).toBeTruthy();
      });

      screen.getByText("Desconectar Google Calendar").click();

      await waitFor(() => {
        expect(screen.getByText("Desconectando...")).toBeTruthy();
      });

      resolveDisconnect!({ data: { success: true } });

      await waitFor(() => {
        expect(mockSuccess).toHaveBeenCalledWith(
          "Google Calendar desconectado com sucesso.",
        );
      });
    });
  });

  describe("erro no disconnect", () => {
    it("should show toast error when disconnect fails", async () => {
      mockGetStatus.mockResolvedValue({
        data: {
          connected: true,
          googleAccountId: "google-123",
          calendarId: "primary",
          scope: "calendar.events",
          connectedAt: "2026-01-01T00:00:00.000Z",
          expiresAt: "2026-01-02T00:00:00.000Z",
        },
      });
      mockDisconnect.mockRejectedValue(new Error("Falha ao desconectar"));
      vi.spyOn(window, "confirm").mockReturnValue(true);

      render(<GoogleCalendarSection />);

      await waitFor(() => {
        expect(
          screen.getByText("Desconectar Google Calendar"),
        ).toBeTruthy();
      });

      screen.getByText("Desconectar Google Calendar").click();

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith("Falha ao desconectar");
      });
    });
  });

  describe("comportamento quando status retorna erro", () => {
    it("should show error message when status fetch fails", async () => {
      mockGetStatus.mockRejectedValue(new Error("Servidor indisponível"));

      render(<GoogleCalendarSection />);

      await waitFor(() => {
        expect(
          screen.getByText("Servidor indisponível"),
        ).toBeTruthy();
      });

      expect(screen.getByText("Tentar novamente")).toBeTruthy();
    });

    it("should retry status fetch when retry button is clicked", async () => {
      mockGetStatus
        .mockRejectedValueOnce(new Error("Servidor indisponível"))
        .mockResolvedValueOnce({
          data: {
            connected: false,
            googleAccountId: null,
            calendarId: null,
            scope: null,
            connectedAt: null,
            expiresAt: null,
          },
        });

      render(<GoogleCalendarSection />);

      await waitFor(() => {
        expect(screen.getByText("Tentar novamente")).toBeTruthy();
      });

      screen.getByText("Tentar novamente").click();

      await waitFor(() => {
        expect(mockGetStatus).toHaveBeenCalledTimes(2);
        expect(screen.getByText("Não conectado")).toBeTruthy();
      });
    });
  });
});

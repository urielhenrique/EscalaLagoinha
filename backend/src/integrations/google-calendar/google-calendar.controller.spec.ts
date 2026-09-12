import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { GoogleCalendarController } from "./google-calendar.controller";
import { GoogleCalendarService } from "./google-calendar.service";
import { GoogleOAuthStateService } from "./google-oauth-state.service";
import { IS_PUBLIC_KEY } from "../../auth/guards/jwt-auth.guard";

describe("GoogleCalendarController", () => {
  let controller: GoogleCalendarController;

  const mockService = {
    getAuthorizationUrl: jest.fn(),
    exchangeCode: jest.fn(),
    getFrontendRedirectUrl: jest.fn(),
    getStatus: jest.fn(),
    disconnect: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockService.getFrontendRedirectUrl.mockReturnValue(
      "http://localhost:5173?google_calendar=error",
    );

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GoogleCalendarController],
      providers: [
        { provide: GoogleCalendarService, useValue: mockService },
        GoogleOAuthStateService,
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();

    controller = module.get<GoogleCalendarController>(GoogleCalendarController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("connect", () => {
    it("should NOT be @Public() — requires JWT", () => {
      const reflector = new Reflector();
      const isPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        controller.connect,
        GoogleCalendarController,
      ]);
      expect(isPublic).toBeFalsy();
    });

    it("should return authorization URL", () => {
      mockService.getAuthorizationUrl.mockReturnValue(
        "https://accounts.google.com/o/oauth2/auth?...",
      );

      const result = controller.connect({ sub: "user-123" } as any);
      expect(result).toHaveProperty("authorizationUrl");
      expect(mockService.getAuthorizationUrl).toHaveBeenCalledWith("user-123");
    });
  });

  describe("callback", () => {
    it("should be marked as @Public() so Google can redirect without JWT", () => {
      const reflector = new Reflector();
      const isPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        controller.callback,
        GoogleCalendarController,
      ]);
      expect(isPublic).toBe(true);
    });

    it("should redirect on error from Google", async () => {
      const res = { redirect: jest.fn() } as any;

      await controller.callback(undefined, undefined, "access_denied", res);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining("google_calendar=error"),
      );
    });

    it("should redirect on missing code", async () => {
      const res = { redirect: jest.fn() } as any;

      await controller.callback(undefined, "state", undefined, res);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining("google_calendar=error"),
      );
    });

    it("should redirect on missing state", async () => {
      const res = { redirect: jest.fn() } as any;

      await controller.callback("code", undefined, undefined, res);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining("google_calendar=error"),
      );
    });

    it("should redirect on successful exchange", async () => {
      mockService.exchangeCode.mockResolvedValue({ userId: "user-123" });
      mockService.getFrontendRedirectUrl.mockReturnValue(
        "http://localhost:5173?google_calendar=connected",
      );

      const res = { redirect: jest.fn() } as any;

      await controller.callback("code", "state", undefined, res);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining("google_calendar=connected"),
      );
    });

    it("should redirect on failed exchange", async () => {
      mockService.exchangeCode.mockRejectedValue(
        new BadRequestException("State inválido."),
      );
      mockService.getFrontendRedirectUrl.mockReturnValue(
        "http://localhost:5173?google_calendar=error",
      );

      const res = { redirect: jest.fn() } as any;

      await controller.callback("code", "invalid-state", undefined, res);

      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining("google_calendar=error"),
      );
    });

    it("should not expose access_token in redirect", async () => {
      mockService.exchangeCode.mockResolvedValue({ userId: "user-123" });
      mockService.getFrontendRedirectUrl.mockReturnValue(
        "http://localhost:5173?google_calendar=connected",
      );

      const res = { redirect: jest.fn() } as any;

      await controller.callback("code", "state", undefined, res);

      const redirectUrl = res.redirect.mock.calls[0][0];
      expect(redirectUrl).not.toContain("access_token");
      expect(redirectUrl).not.toContain("refresh_token");
    });
  });

  describe("status", () => {
    it("should NOT be @Public() — requires JWT", () => {
      const reflector = new Reflector();
      const isPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        controller.getStatus,
        GoogleCalendarController,
      ]);
      expect(isPublic).toBeFalsy();
    });

    it("should return connected status", async () => {
      mockService.getStatus.mockResolvedValue({
        connected: true,
        googleAccountId: "google-123",
        calendarId: "primary",
        scope: "calendar.events",
        connectedAt: new Date(),
        expiresAt: new Date(),
      });

      const result = await controller.getStatus({ sub: "user-123" } as any);
      expect(result.connected).toBe(true);
      expect(mockService.getStatus).toHaveBeenCalledWith("user-123");
    });

    it("should return disconnected status", async () => {
      mockService.getStatus.mockResolvedValue({
        connected: false,
        googleAccountId: null,
        calendarId: null,
        scope: null,
        connectedAt: null,
        expiresAt: null,
      });

      const result = await controller.getStatus({ sub: "user-123" } as any);
      expect(result.connected).toBe(false);
    });

    it("should not return tokens in status response", async () => {
      mockService.getStatus.mockResolvedValue({
        connected: true,
        googleAccountId: "google-123",
        calendarId: "primary",
        scope: "calendar.events",
        connectedAt: new Date(),
        expiresAt: new Date(),
      });

      const result = await controller.getStatus({ sub: "user-123" } as any);
      expect(result).not.toHaveProperty("accessToken");
      expect(result).not.toHaveProperty("refreshToken");
      expect(result).not.toHaveProperty("accessTokenEnc");
      expect(result).not.toHaveProperty("refreshTokenEnc");
    });
  });

  describe("disconnect", () => {
    it("should NOT be @Public() — requires JWT", () => {
      const reflector = new Reflector();
      const isPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        controller.disconnect,
        GoogleCalendarController,
      ]);
      expect(isPublic).toBeFalsy();
    });

    it("should disconnect successfully", async () => {
      mockService.disconnect.mockResolvedValue({ success: true });

      const result = await controller.disconnect({ sub: "user-123" } as any);
      expect(result.success).toBe(true);
      expect(mockService.disconnect).toHaveBeenCalledWith("user-123");
    });
  });
});

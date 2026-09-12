import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GoogleOAuthStateService } from "./google-oauth-state.service";
import { GoogleCalendarService } from "./google-calendar.service";
import { GoogleEncryptionService } from "./google-encryption.service";
import { PrismaService } from "../../prisma/prisma.service";

describe("GoogleOAuthStateService", () => {
  let service: GoogleOAuthStateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GoogleOAuthStateService],
    }).compile();

    service = module.get<GoogleOAuthStateService>(GoogleOAuthStateService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    it("should create a state string", () => {
      const state = service.create("user-123");
      expect(typeof state).toBe("string");
      expect(state.length).toBeGreaterThan(0);
    });

    it("should create unique states", () => {
      const state1 = service.create("user-123");
      const state2 = service.create("user-123");
      expect(state1).not.toBe(state2);
    });
  });

  describe("consume", () => {
    it("should accept valid state and return userId", () => {
      const state = service.create("user-123");
      const result = service.consume(state);
      expect(result).toEqual({ userId: "user-123" });
    });

    it("should reject invalid state", () => {
      const result = service.consume("invalid-state");
      expect(result).toEqual({ error: "State inválido." });
    });

    it("should reject used state", () => {
      const state = service.create("user-123");
      service.consume(state);
      const result = service.consume(state);
      expect(result).toEqual({ error: "State já utilizado." });
    });

    it("should reject expired state", () => {
      const state = service.create("user-123");
      const entry = (service as any).states.get(state);
      entry.createdAt = Date.now() - 11 * 60 * 1000;

      const result = service.consume(state);
      expect(result).toEqual({ error: "State expirado." });
    });
  });
});

describe("GoogleCalendarService", () => {
  let service: GoogleCalendarService;
  let stateService: GoogleOAuthStateService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        GOOGLE_CLIENT_ID: "test-client-id",
        GOOGLE_CLIENT_SECRET: "test-client-secret",
        GOOGLE_REDIRECT_URI:
          "http://localhost:3000/api/integrations/google/callback",
        FRONTEND_URL: "http://localhost:5173",
      };
      return config[key];
    }),
  };

  const mockPrismaService = {
    googleCalendarConnection: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockEncryptionService = {
    encrypt: jest.fn((val: string) => `encrypted:${val}`),
    decrypt: jest.fn((val: string) => val.replace("encrypted:", "")),
    isConfigured: jest.fn(() => true),
    assertConfigured: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleCalendarService,
        GoogleOAuthStateService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: GoogleEncryptionService, useValue: mockEncryptionService },
      ],
    }).compile();

    service = module.get<GoogleCalendarService>(GoogleCalendarService);
    stateService = module.get<GoogleOAuthStateService>(GoogleOAuthStateService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getAuthorizationUrl", () => {
    it("should return an authorization URL", () => {
      const url = service.getAuthorizationUrl("user-123");
      expect(url).toContain("accounts.google.com");
      expect(url).toContain("calendar.events");
    });
  });

  describe("exchangeCode", () => {
    it("should reject invalid state", async () => {
      await expect(
        service.exchangeCode("test-code", "invalid-state"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject expired state", async () => {
      const state = stateService.create("user-123");
      const entry = (stateService as any).states.get(state);
      entry.createdAt = Date.now() - 11 * 60 * 1000;

      await expect(
        service.exchangeCode("test-code", state),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("getFrontendRedirectUrl", () => {
    it("should build connected URL", () => {
      const url = service.getFrontendRedirectUrl("connected");
      expect(url).toContain("google_calendar=connected");
      expect(url).toContain("localhost:5173");
    });

    it("should build error URL", () => {
      const url = service.getFrontendRedirectUrl("error", "test error");
      expect(url).toContain("google_calendar=error");
      expect(url).toContain("google_error=test+error");
    });
  });

  describe("getStatus", () => {
    it("should return disconnected status when no connection exists", async () => {
      mockPrismaService.googleCalendarConnection.findUnique.mockResolvedValue(
        null,
      );

      const result = await service.getStatus("user-123");
      expect(result.connected).toBe(false);
      expect(result.googleAccountId).toBeNull();
      expect(result.calendarId).toBeNull();
      expect(result.scope).toBeNull();
      expect(result.connectedAt).toBeNull();
      expect(result.expiresAt).toBeNull();
    });

    it("should return connected status with connection data", async () => {
      const mockConnection = {
        googleAccountId: "google-acc-123",
        calendarId: "primary",
        scope: "https://www.googleapis.com/auth/calendar.events",
        createdAt: new Date("2026-01-01"),
        expiresAt: new Date("2026-01-02"),
      };
      mockPrismaService.googleCalendarConnection.findUnique.mockResolvedValue(
        mockConnection,
      );

      const result = await service.getStatus("user-123");
      expect(result.connected).toBe(true);
      expect(result.googleAccountId).toBe("google-acc-123");
      expect(result.calendarId).toBe("primary");
      expect(result.scope).toContain("calendar.events");
      expect(result.connectedAt).toEqual(new Date("2026-01-01"));
      expect(result.expiresAt).toEqual(new Date("2026-01-02"));
    });
  });

  describe("disconnect", () => {
    it("should return success when no connection exists", async () => {
      mockPrismaService.googleCalendarConnection.findUnique.mockResolvedValue(
        null,
      );

      const result = await service.disconnect("user-123");
      expect(result.success).toBe(true);
    });

    it("should delete connection and revoke token", async () => {
      mockPrismaService.googleCalendarConnection.findUnique.mockResolvedValue({
        refreshTokenEnc: "encrypted:refresh-token",
      });
      mockPrismaService.googleCalendarConnection.delete.mockResolvedValue({});

      const result = await service.disconnect("user-123");
      expect(result.success).toBe(true);
      expect(
        mockPrismaService.googleCalendarConnection.delete,
      ).toHaveBeenCalledWith({ where: { userId: "user-123" } });
    });
  });

  describe("configuration", () => {
    it("should throw if not configured", async () => {
      const unconfiguredService = new GoogleCalendarService(
        { get: () => undefined } as any,
        stateService,
        mockPrismaService as any,
        mockEncryptionService as any,
      );

      await expect(
        unconfiguredService.exchangeCode("code", "state"),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

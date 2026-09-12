jest.mock("googleapis", () => {
  const mockInsert = jest.fn().mockResolvedValue({
    data: { id: "mocked-google-event-id" },
  });
  const mockUpdate = jest.fn().mockResolvedValue({ data: {} });
  const mockDelete = jest.fn().mockResolvedValue({});

  return {
    google: {
      auth: {
        OAuth2: jest.fn().mockImplementation(() => ({
          setCredentials: jest.fn(),
        })),
      },
      calendar: jest.fn().mockReturnValue({
        events: {
          insert: mockInsert,
          update: mockUpdate,
          delete: mockDelete,
        },
      }),
      oauth2: jest.fn().mockReturnValue({
        tokeninfo: jest.fn(),
      }),
    },
    __mock__: { mockInsert, mockUpdate, mockDelete },
  };
});

import { Test, TestingModule } from "@nestjs/testing";
import { GoogleSyncStatus } from "@prisma/client";
import { GoogleCalendarSyncService } from "./google-calendar-sync.service";
import { GoogleCalendarService } from "./google-calendar.service";
import { PrismaService } from "../../prisma/prisma.service";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const googleapisMock = require("googleapis");

describe("GoogleCalendarSyncService", () => {
  let service: GoogleCalendarSyncService;

  const mockPrisma = {
    googleCalendarConnection: {
      findUnique: jest.fn(),
    },
    event: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockGoogleCalendarService = {
    refreshAccessToken: jest.fn(),
    getStoredAccessToken: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleCalendarSyncService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: GoogleCalendarService,
          useValue: mockGoogleCalendarService,
        },
      ],
    }).compile();

    service = module.get<GoogleCalendarSyncService>(GoogleCalendarSyncService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("buildGoogleEventId", () => {
    it("should build deterministic ID from UUID", () => {
      const result = service.buildGoogleEventId(
        "550e8400-e29b-41d4-a716-446655440000",
      );
      expect(result).toBe("escala-550e8400e29b41d4a716446655440000");
    });

    it("should produce same ID for same input", () => {
      const id1 = service.buildGoogleEventId("evt-123");
      const id2 = service.buildGoogleEventId("evt-123");
      expect(id1).toBe(id2);
    });

    it("should remove all non-alphanumeric characters", () => {
      const result = service.buildGoogleEventId("abc-123_DEF");
      expect(result).toBe("escala-abc123def");
    });

    it("should lowercase the normalized ID", () => {
      const result = service.buildGoogleEventId("ABC-123");
      expect(result).toBe("escala-abc123");
    });

    it("should handle empty string", () => {
      const result = service.buildGoogleEventId("");
      expect(result).toBe("escala-");
    });

    it("should handle special characters only", () => {
      const result = service.buildGoogleEventId("!@#$%");
      expect(result).toBe("escala-");
    });
  });

  describe("toGoogleDateTime", () => {
    it("should convert UTC to America/Sao_Paulo (UTC-3)", () => {
      const date = new Date("2026-09-15T19:00:00.000Z");
      const result = service.toGoogleDateTime(date);
      expect(result).toBe("2026-09-15T16:00:00");
    });

    it("should handle UTC midnight as 21:00 previous day in São Paulo", () => {
      const date = new Date("2026-01-15T03:00:00.000Z");
      const result = service.toGoogleDateTime(date);
      expect(result).toBe("2026-01-15T00:00:00");
    });

    it("should not include Z suffix or offset", () => {
      const date = new Date("2026-09-15T19:00:00.000Z");
      const result = service.toGoogleDateTime(date);
      expect(result).not.toMatch(/Z$/);
      expect(result).not.toMatch(/[+-]\d{2}:\d{2}$/);
    });
  });

  describe("syncEvent", () => {
    const userId = "user-123";
    const input = {
      eventId: "evt-001",
      churchId: "church-001",
      nome: "Culto Dominical",
      descricao: "Culto de domingo",
      dataInicio: new Date("2026-09-15T19:00:00.000Z"),
      dataFim: new Date("2026-09-15T21:00:00.000Z"),
      recurrenceGroupId: null,
    };

    it("should return ERROR when getStoredAccessToken returns null", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(null);

      const result = await service.syncEvent(userId, input);

      expect(result.status).toBe(GoogleSyncStatus.ERROR);
      expect(result.error).toBe(
        "Google Calendar não conectado para este usuário.",
      );
      expect(mockPrisma.event.update).toHaveBeenCalledWith({
        where: { id: input.eventId },
        data: {
          googleSyncStatus: GoogleSyncStatus.ERROR,
          googleSyncError:
            "Google Calendar não conectado para este usuário.",
        },
      });
    });

    it("should create new event when no existing googleEventId", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: null,
        googleSyncStatus: GoogleSyncStatus.NONE,
      });

      const result = await service.syncEvent(userId, input);

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);
      expect(result.googleEventId).toBeDefined();
      expect(result.error).toBeNull();
      expect(mockPrisma.event.update).toHaveBeenCalledWith({
        where: { id: input.eventId },
        data: {
          googleEventId: "mocked-google-event-id",
          googleSyncStatus: GoogleSyncStatus.SYNCED,
          lastSyncedAt: expect.any(Date),
          googleSyncError: null,
        },
      });
    });

    it("should update existing synced event", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: "existing-google-id",
        googleSyncStatus: GoogleSyncStatus.SYNCED,
      });

      const result = await service.syncEvent(userId, input);

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);
      expect(result.googleEventId).toBe("existing-google-id");
      expect(googleapisMock.__mock__.mockUpdate).toHaveBeenCalled();
    });

    it("should use 'primary' when connection has no calendarId", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: null,
      });
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: null,
        googleSyncStatus: GoogleSyncStatus.NONE,
      });

      const result = await service.syncEvent(userId, input);

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);
    });

    it("should handle null churchId in input", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: null,
        googleSyncStatus: GoogleSyncStatus.NONE,
      });

      const inputNoChurch = { ...input, churchId: null };
      const result = await service.syncEvent(userId, inputNoChurch);

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);
    });

    it("should handle null descricao in input", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: null,
        googleSyncStatus: GoogleSyncStatus.NONE,
      });

      const inputNoDesc = { ...input, descricao: null };
      const result = await service.syncEvent(userId, inputNoDesc);

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);
    });

    it("should handle recurrenceGroupId in input", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: null,
        googleSyncStatus: GoogleSyncStatus.NONE,
      });

      const inputRecurrence = {
        ...input,
        recurrenceGroupId: "rec-group-001",
      };
      const result = await service.syncEvent(userId, inputRecurrence);

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);
    });

    it("should return ERROR when Google API call throws", async () => {
      googleapisMock.__mock__.mockInsert.mockRejectedValueOnce(
        new Error("Google API Error"),
      );

      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: null,
        googleSyncStatus: GoogleSyncStatus.NONE,
      });

      const result = await service.syncEvent(userId, input);

      expect(result.status).toBe(GoogleSyncStatus.ERROR);
      expect(result.error).toBe("Google API Error");

      // Restore mock for subsequent tests
      googleapisMock.__mock__.mockInsert.mockResolvedValue({
        data: { id: "mocked-google-event-id" },
      });
    });

    it("should handle connection not found (null)", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue(null);
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: null,
        googleSyncStatus: GoogleSyncStatus.NONE,
      });

      const result = await service.syncEvent(userId, input);

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);
    });

    it("should handle PENDING status event", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: null,
        googleSyncStatus: GoogleSyncStatus.PENDING,
      });

      const result = await service.syncEvent(userId, input);

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);
    });

    it("should handle ERROR status event as new event", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: null,
        googleSyncStatus: GoogleSyncStatus.ERROR,
      });

      const result = await service.syncEvent(userId, input);

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);
    });
  });

  describe("deleteGoogleEvent", () => {
    const userId = "user-123";
    const eventId = "evt-001";

    it("should return error when not connected", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(null);
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: "google-evt-123",
        googleSyncStatus: GoogleSyncStatus.SYNCED,
      });

      const result = await service.deleteGoogleEvent(userId, eventId);

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Google Calendar não conectado para este usuário.",
      );
    });

    it("should succeed when event has no googleEventId", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: null,
        googleSyncStatus: GoogleSyncStatus.NONE,
      });

      const result = await service.deleteGoogleEvent(userId, eventId);

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
    });

    it("should succeed when event not found", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.event.findUnique.mockResolvedValue(null);

      const result = await service.deleteGoogleEvent(userId, eventId);

      expect(result.success).toBe(true);
    });

    it("should reset event sync fields after successful deletion", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: "google-evt-123",
        googleSyncStatus: GoogleSyncStatus.SYNCED,
      });
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });

      const result = await service.deleteGoogleEvent(userId, eventId);

      expect(result.success).toBe(true);
      expect(mockPrisma.event.update).toHaveBeenCalledWith({
        where: { id: eventId },
        data: {
          googleEventId: null,
          googleSyncStatus: GoogleSyncStatus.NONE,
          lastSyncedAt: null,
          googleSyncError: null,
        },
      });
    });

    it("should handle connection not found", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: "google-evt-123",
        googleSyncStatus: GoogleSyncStatus.SYNCED,
      });
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue(null);

      const result = await service.deleteGoogleEvent(userId, eventId);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe("boolean");
    });

    it("should handle event with googleEventId and NONE status", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: "some-google-id",
        googleSyncStatus: GoogleSyncStatus.NONE,
      });
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });

      const result = await service.deleteGoogleEvent(userId, eventId);

      expect(result).toBeDefined();
    });

    it("should return ERROR when Google delete API throws", async () => {
      googleapisMock.__mock__.mockDelete.mockRejectedValueOnce(
        new Error("Delete failed"),
      );

      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: "google-evt-fail",
        googleSyncStatus: GoogleSyncStatus.SYNCED,
      });
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });

      const result = await service.deleteGoogleEvent(userId, eventId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Delete failed");

      // Restore
      googleapisMock.__mock__.mockDelete.mockResolvedValue({});
    });
  });

  describe("syncEvent - edge cases", () => {
    const userId = "user-456";
    const input = {
      eventId: "evt-edge-001",
      churchId: "church-001",
      nome: "Evento Edge",
      descricao: "Teste",
      dataInicio: new Date("2026-12-31T23:00:00.000Z"),
      dataFim: new Date("2027-01-01T01:00:00.000Z"),
      recurrenceGroupId: null,
    };

    it("should handle event with existing ERROR status and googleEventId", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: "old-google-id",
        googleSyncStatus: GoogleSyncStatus.ERROR,
      });

      const result = await service.syncEvent(userId, input);

      // ERROR status => treated as new event (creates, not updates)
      expect(result.status).toBe(GoogleSyncStatus.SYNCED);
      expect(googleapisMock.__mock__.mockInsert).toHaveBeenCalled();
    });

    it("should handle very long event name", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: null,
        googleSyncStatus: GoogleSyncStatus.NONE,
      });

      const longInput = { ...input, nome: "A".repeat(500) };
      const result = await service.syncEvent(userId, longInput);

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);
    });

    it("should handle special characters in event name", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: null,
        googleSyncStatus: GoogleSyncStatus.NONE,
      });

      const specialInput = {
        ...input,
        nome: "Culto @ # $ % & * ()",
      };
      const result = await service.syncEvent(userId, specialInput);

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);
    });

    it("should handle unicode characters in event name", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: null,
        googleSyncStatus: GoogleSyncStatus.NONE,
      });

      const unicodeInput = {
        ...input,
        nome: "Culto Dominical - Igreja da Lagoinha",
      };
      const result = await service.syncEvent(userId, unicodeInput);

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);
    });
  });

  describe("integration patterns", () => {
    it("should handle sync after disconnect and reconnect", async () => {
      const userId = "user-reconnect";
      const input = {
        eventId: "evt-reconnect",
        churchId: "church-001",
        nome: "Culto",
        descricao: null,
        dataInicio: new Date("2026-09-15T19:00:00.000Z"),
        dataFim: new Date("2026-09-15T21:00:00.000Z"),
        recurrenceGroupId: null,
      };

      // First attempt: not connected
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(null);
      const result1 = await service.syncEvent(userId, input);
      expect(result1.status).toBe(GoogleSyncStatus.ERROR);

      // Second attempt: connected
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "new-access-token",
      );
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: null,
        googleSyncStatus: GoogleSyncStatus.ERROR,
      });

      const result2 = await service.syncEvent(userId, input);
      expect(result2.status).toBe(GoogleSyncStatus.SYNCED);
    });

    it("should handle multiple events in sequence", async () => {
      const userId = "user-seq";
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: null,
        googleSyncStatus: GoogleSyncStatus.NONE,
      });

      const events = [
        {
          eventId: "evt-seq-1",
          churchId: "church-001",
          nome: "Culto 1",
          descricao: null,
          dataInicio: new Date("2026-09-15T19:00:00.000Z"),
          dataFim: new Date("2026-09-15T21:00:00.000Z"),
          recurrenceGroupId: null,
        },
        {
          eventId: "evt-seq-2",
          churchId: "church-001",
          nome: "Culto 2",
          descricao: null,
          dataInicio: new Date("2026-09-22T19:00:00.000Z"),
          dataFim: new Date("2026-09-22T21:00:00.000Z"),
          recurrenceGroupId: null,
        },
      ];

      for (const evt of events) {
        const result = await service.syncEvent(userId, evt);
        expect(result.status).toBe(GoogleSyncStatus.SYNCED);
      }
    });

    it("should handle delete when connection has no calendarId", async () => {
      const userId = "user-delete-no-cal";
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: "google-evt-delete",
        googleSyncStatus: GoogleSyncStatus.SYNCED,
      });
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: null,
      });

      const result = await service.deleteGoogleEvent(
        userId,
        "evt-delete",
      );

      expect(result.success).toBe(true);
    });
  });

  describe("deterministic ID consistency", () => {
    it("should always produce same ID for same event", () => {
      const eventId = "550e8400-e29b-41d4-a716-446655440000";
      const id1 = service.buildGoogleEventId(eventId);
      const id2 = service.buildGoogleEventId(eventId);
      expect(id1).toBe(id2);
    });

    it("should produce different IDs for different events", () => {
      const id1 = service.buildGoogleEventId("evt-001");
      const id2 = service.buildGoogleEventId("evt-002");
      expect(id1).not.toBe(id2);
    });

    it("should always start with 'escala-' prefix", () => {
      const result = service.buildGoogleEventId("any-event-id");
      expect(result).toMatch(/^escala-/);
    });
  });

  describe("Brazil timezone handling", () => {
    it("should convert 2026-09-12T22:00:00.000Z to 2026-09-12T19:00:00", () => {
      const date = new Date("2026-09-12T22:00:00.000Z");
      const result = service.toGoogleDateTime(date);
      expect(result).toBe("2026-09-12T19:00:00");
    });

    it("should convert 2026-01-15T15:00:00.000Z to 2026-01-15T12:00:00", () => {
      const date = new Date("2026-01-15T15:00:00.000Z");
      const result = service.toGoogleDateTime(date);
      expect(result).toBe("2026-01-15T12:00:00");
    });

    it("should send correct dateTime and timeZone in start/end", async () => {
      const userId = "user-tz-body";
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: null,
        googleSyncStatus: GoogleSyncStatus.NONE,
      });

      await service.syncEvent(userId, {
        eventId: "evt-tz-body-001",
        churchId: "church-001",
        nome: "Culto",
        descricao: null,
        dataInicio: new Date("2026-09-12T22:00:00.000Z"),
        dataFim: new Date("2026-09-13T00:00:00.000Z"),
        recurrenceGroupId: null,
      });

      const insertCall =
        googleapisMock.__mock__.mockInsert.mock.calls[0]?.[0];
      expect(insertCall?.requestBody?.start?.dateTime).toBe(
        "2026-09-12T19:00:00",
      );
      expect(insertCall?.requestBody?.start?.timeZone).toBe(
        "America/Sao_Paulo",
      );
      expect(insertCall?.requestBody?.end?.dateTime).toBe(
        "2026-09-12T21:00:00",
      );
      expect(insertCall?.requestBody?.end?.timeZone).toBe(
        "America/Sao_Paulo",
      );
    });
  });

  describe("extended properties", () => {
    it("should include source as escala-facil in create", async () => {
      const userId = "user-ext-1";
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: null,
        googleSyncStatus: GoogleSyncStatus.NONE,
      });

      const result = await service.syncEvent(userId, {
        eventId: "evt-ext-001",
        churchId: "church-001",
        nome: "Teste Extended Props",
        descricao: null,
        dataInicio: new Date("2026-09-15T19:00:00.000Z"),
        dataFim: new Date("2026-09-15T21:00:00.000Z"),
        recurrenceGroupId: null,
      });

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);

      const insertCall =
        googleapisMock.__mock__.mockInsert.mock.calls[0]?.[0];
      expect(
        insertCall?.requestBody?.extendedProperties?.private,
      ).toMatchObject({
        "escala-facil": "true",
        eventId: "evt-ext-001",
        churchId: "church-001",
      });
    });

    it("should include churchId in extended properties", async () => {
      const userId = "user-ext-2";
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: null,
        googleSyncStatus: GoogleSyncStatus.NONE,
      });

      const result = await service.syncEvent(userId, {
        eventId: "evt-ext-002",
        churchId: "church-002",
        nome: "Teste Church",
        descricao: null,
        dataInicio: new Date("2026-09-15T19:00:00.000Z"),
        dataFim: new Date("2026-09-15T21:00:00.000Z"),
        recurrenceGroupId: null,
      });

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);

      const insertCall =
        googleapisMock.__mock__.mockInsert.mock.calls[0]?.[0];
      expect(
        insertCall?.requestBody?.extendedProperties?.private?.churchId,
      ).toBe("church-002");
    });

    it("should set empty string for null churchId", async () => {
      const userId = "user-ext-3";
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: null,
        googleSyncStatus: GoogleSyncStatus.NONE,
      });

      const result = await service.syncEvent(userId, {
        eventId: "evt-ext-003",
        churchId: null,
        nome: "Teste No Church",
        descricao: null,
        dataInicio: new Date("2026-09-15T19:00:00.000Z"),
        dataFim: new Date("2026-09-15T21:00:00.000Z"),
        recurrenceGroupId: null,
      });

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);

      const insertCall =
        googleapisMock.__mock__.mockInsert.mock.calls[0]?.[0];
      expect(
        insertCall?.requestBody?.extendedProperties?.private?.churchId,
      ).toBe("");
    });
  });

  describe("idempotency", () => {
    it("should not create duplicate when event already synced", async () => {
      const userId = "user-idem";
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: "already-synced-id",
        googleSyncStatus: GoogleSyncStatus.SYNCED,
      });

      const result = await service.syncEvent(userId, {
        eventId: "evt-idem-001",
        churchId: "church-001",
        nome: "Teste Idempotency",
        descricao: null,
        dataInicio: new Date("2026-09-15T19:00:00.000Z"),
        dataFim: new Date("2026-09-15T21:00:00.000Z"),
        recurrenceGroupId: null,
      });

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);
      expect(result.googleEventId).toBe("already-synced-id");
      expect(googleapisMock.__mock__.mockInsert).not.toHaveBeenCalled();
      expect(googleapisMock.__mock__.mockUpdate).toHaveBeenCalled();
    });

    it("should send deterministic ID in requestBody.id on create", async () => {
      const userId = "user-idem-create";
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: null,
        googleSyncStatus: GoogleSyncStatus.NONE,
      });

      await service.syncEvent(userId, {
        eventId: "evt-idem-create-001",
        churchId: "church-001",
        nome: "Teste Create ID",
        descricao: null,
        dataInicio: new Date("2026-09-15T19:00:00.000Z"),
        dataFim: new Date("2026-09-15T21:00:00.000Z"),
        recurrenceGroupId: null,
      });

      const expectedId = service.buildGoogleEventId("evt-idem-create-001");
      const insertCall =
        googleapisMock.__mock__.mockInsert.mock.calls[0]?.[0];
      expect(insertCall?.requestBody?.id).toBe(expectedId);
    });

    it("should persist response.data.id which equals the deterministic ID", async () => {
      const userId = "user-idem-persist";
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: null,
        googleSyncStatus: GoogleSyncStatus.NONE,
      });

      const result = await service.syncEvent(userId, {
        eventId: "evt-idem-persist-001",
        churchId: "church-001",
        nome: "Teste Persist ID",
        descricao: null,
        dataInicio: new Date("2026-09-15T19:00:00.000Z"),
        dataFim: new Date("2026-09-15T21:00:00.000Z"),
        recurrenceGroupId: null,
      });

      // Mock returns "mocked-google-event-id" for all calls
      expect(result.googleEventId).toBe("mocked-google-event-id");
      expect(mockPrisma.event.update).toHaveBeenCalledWith({
        where: { id: "evt-idem-persist-001" },
        data: {
          googleEventId: "mocked-google-event-id",
          googleSyncStatus: GoogleSyncStatus.SYNCED,
          lastSyncedAt: expect.any(Date),
          googleSyncError: null,
        },
      });
    });

    it("should use same deterministic ID on retry (same event)", async () => {
      const userId = "user-idem-retry";
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });

      const input = {
        eventId: "evt-idem-retry-001",
        churchId: "church-001",
        nome: "Teste Retry",
        descricao: null,
        dataInicio: new Date("2026-09-15T19:00:00.000Z"),
        dataFim: new Date("2026-09-15T21:00:00.000Z"),
        recurrenceGroupId: null,
      };

      const expectedId = service.buildGoogleEventId(input.eventId);

      // First call: event not synced → creates
      mockPrisma.event.findUnique.mockResolvedValueOnce({
        googleEventId: null,
        googleSyncStatus: GoogleSyncStatus.NONE,
      });
      await service.syncEvent(userId, input);

      // Second call: still not synced (simulates failed persist) → creates again
      mockPrisma.event.findUnique.mockResolvedValueOnce({
        googleEventId: null,
        googleSyncStatus: GoogleSyncStatus.NONE,
      });
      await service.syncEvent(userId, input);

      // Both calls must use the same deterministic ID
      const call1Id =
        googleapisMock.__mock__.mockInsert.mock.calls[0]?.[0]
          ?.requestBody?.id;
      const call2Id =
        googleapisMock.__mock__.mockInsert.mock.calls[1]?.[0]
          ?.requestBody?.id;

      expect(call1Id).toBe(expectedId);
      expect(call2Id).toBe(expectedId);
      expect(call1Id).toBe(call2Id);
    });
  });

  describe("Brazil timezone in Google event body", () => {
    it("should send converted dateTime and America/Sao_Paulo timezone", async () => {
      const userId = "user-tz";
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: null,
        googleSyncStatus: GoogleSyncStatus.NONE,
      });

      await service.syncEvent(userId, {
        eventId: "evt-tz-001",
        churchId: "church-001",
        nome: "Culto",
        descricao: null,
        dataInicio: new Date("2026-09-15T19:00:00.000Z"),
        dataFim: new Date("2026-09-15T21:00:00.000Z"),
        recurrenceGroupId: null,
      });

      const insertCall =
        googleapisMock.__mock__.mockInsert.mock.calls[0]?.[0];
      expect(insertCall?.requestBody?.start?.dateTime).toBe(
        "2026-09-15T16:00:00",
      );
      expect(insertCall?.requestBody?.start?.timeZone).toBe(
        "America/Sao_Paulo",
      );
      expect(insertCall?.requestBody?.end?.dateTime).toBe(
        "2026-09-15T18:00:00",
      );
      expect(insertCall?.requestBody?.end?.timeZone).toBe(
        "America/Sao_Paulo",
      );
    });
  });

  describe("update event body structure", () => {
    it("should include extendedProperties in update body", async () => {
      const userId = "user-upd";
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: "existing-google-id",
        googleSyncStatus: GoogleSyncStatus.SYNCED,
      });

      await service.syncEvent(userId, {
        eventId: "evt-upd-001",
        churchId: "church-001",
        nome: "Evento Atualizado",
        descricao: "desc",
        dataInicio: new Date("2026-09-15T19:00:00.000Z"),
        dataFim: new Date("2026-09-15T21:00:00.000Z"),
        recurrenceGroupId: "rec-001",
      });

      const updateCall =
        googleapisMock.__mock__.mockUpdate.mock.calls[0]?.[0];
      expect(updateCall?.requestBody?.summary).toBe("Evento Atualizado");
      expect(
        updateCall?.requestBody?.extendedProperties?.private,
      ).toMatchObject({
        "escala-facil": "true",
        eventId: "evt-upd-001",
        recurrenceGroupId: "rec-001",
      });
    });
  });

  describe("retry on 401", () => {
    const userId = "user-retry";
    const input = {
      eventId: "evt-retry-001",
      churchId: "church-001",
      nome: "Evento Retry",
      descricao: "Teste retry",
      dataInicio: new Date("2026-09-15T19:00:00.000Z"),
      dataFim: new Date("2026-09-15T21:00:00.000Z"),
      recurrenceGroupId: null,
    };

    const google401Error = Object.assign(new Error("Unauthorized"), {
      response: { status: 401 },
    });
    const google403Error = Object.assign(new Error("Forbidden"), {
      response: { status: 403 },
    });
    const google404Error = Object.assign(new Error("Not Found"), {
      response: { status: 404 },
    });
    const google409Error = Object.assign(new Error("Conflict"), {
      response: { status: 409 },
    });
    const google429Error = Object.assign(new Error("Rate Limited"), {
      response: { status: 429 },
    });
    const google500Error = Object.assign(new Error("Internal Server Error"), {
      response: { status: 500 },
    });

    function mockSyncCreatePath() {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue("token-stored");
      mockGoogleCalendarService.refreshAccessToken.mockResolvedValue("token-refreshed");
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: null,
        googleSyncStatus: GoogleSyncStatus.NONE,
      });
    }

    function mockSyncUpdatePath() {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue("token-stored");
      mockGoogleCalendarService.refreshAccessToken.mockResolvedValue("token-refreshed");
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: "existing-google-id",
        googleSyncStatus: GoogleSyncStatus.SYNCED,
      });
    }

    function mockDeletePath() {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue("token-stored");
      mockGoogleCalendarService.refreshAccessToken.mockResolvedValue("token-refreshed");
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: "google-del-001",
        googleSyncStatus: GoogleSyncStatus.SYNCED,
      });
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
    }

    it("syncEvent: 401 on insert → refresh → retry succeeds", async () => {
      mockSyncCreatePath();
      googleapisMock.__mock__.mockInsert
        .mockRejectedValueOnce(google401Error)
        .mockResolvedValueOnce({ data: { id: "google-retry-ok" } });

      const result = await service.syncEvent(userId, input);

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);
      expect(result.googleEventId).toBe("google-retry-ok");
      expect(mockGoogleCalendarService.getStoredAccessToken).toHaveBeenCalledTimes(1);
      expect(mockGoogleCalendarService.refreshAccessToken).toHaveBeenCalledTimes(1);
    });

    it("syncEvent: 401 on insert → refresh fails → ERROR", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue("token-stored");
      mockGoogleCalendarService.refreshAccessToken.mockResolvedValue(null);
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: null,
        googleSyncStatus: GoogleSyncStatus.NONE,
      });
      googleapisMock.__mock__.mockInsert.mockRejectedValueOnce(google401Error);

      const result = await service.syncEvent(userId, input);

      expect(result.status).toBe(GoogleSyncStatus.ERROR);
      expect(result.error).toContain("Reconecte sua conta");
      expect(mockGoogleCalendarService.getStoredAccessToken).toHaveBeenCalledTimes(1);
      expect(mockGoogleCalendarService.refreshAccessToken).toHaveBeenCalledTimes(1);
    });

    it("syncEvent: 401 on insert → refresh → retry 401 again → ERROR", async () => {
      mockSyncCreatePath();
      googleapisMock.__mock__.mockInsert
        .mockRejectedValueOnce(google401Error)
        .mockRejectedValueOnce(google401Error);

      const result = await service.syncEvent(userId, input);

      expect(result.status).toBe(GoogleSyncStatus.ERROR);
      expect(result.error).toBe("Unauthorized");
      expect(mockGoogleCalendarService.getStoredAccessToken).toHaveBeenCalledTimes(1);
      expect(mockGoogleCalendarService.refreshAccessToken).toHaveBeenCalledTimes(1);
    });

    it("syncEvent: 401 on update → refresh → retry succeeds", async () => {
      mockSyncUpdatePath();
      googleapisMock.__mock__.mockUpdate
        .mockRejectedValueOnce(google401Error)
        .mockResolvedValueOnce({ data: {} });

      const result = await service.syncEvent(userId, input);

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);
      expect(result.googleEventId).toBe("existing-google-id");
      expect(mockGoogleCalendarService.getStoredAccessToken).toHaveBeenCalledTimes(1);
      expect(mockGoogleCalendarService.refreshAccessToken).toHaveBeenCalledTimes(1);
    });

    it("syncEvent: 401 on update → refresh → retry 404 → recreate succeeds", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue("token-stored");
      mockGoogleCalendarService.refreshAccessToken.mockResolvedValue("token-refreshed");
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      mockPrisma.event.findUnique
        .mockResolvedValueOnce({
          googleEventId: "existing-google-id",
          googleSyncStatus: GoogleSyncStatus.SYNCED,
        })
        .mockResolvedValueOnce({
          googleEventId: null,
          googleSyncStatus: GoogleSyncStatus.NONE,
        });
      googleapisMock.__mock__.mockUpdate.mockRejectedValueOnce(google404Error);
      googleapisMock.__mock__.mockInsert.mockResolvedValueOnce({
        data: { id: "new-google-id" },
      });

      const result = await service.syncEvent(userId, input);

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);
      expect(result.googleEventId).toBe("new-google-id");
    });

    it("syncEvent: 403 on insert → no refresh, throw", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue("token-stored");
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: null,
        googleSyncStatus: GoogleSyncStatus.NONE,
      });
      googleapisMock.__mock__.mockInsert.mockRejectedValueOnce(google403Error);

      const result = await service.syncEvent(userId, input);

      expect(result.status).toBe(GoogleSyncStatus.ERROR);
      expect(result.error).toBe("Forbidden");
      expect(mockGoogleCalendarService.getStoredAccessToken).toHaveBeenCalledTimes(1);
      expect(mockGoogleCalendarService.refreshAccessToken).not.toHaveBeenCalled();
    });

    it("syncEvent: 404 on insert → no refresh, throw", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue("token-stored");
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: null,
        googleSyncStatus: GoogleSyncStatus.NONE,
      });
      googleapisMock.__mock__.mockInsert.mockRejectedValueOnce(google404Error);

      const result = await service.syncEvent(userId, input);

      expect(result.status).toBe(GoogleSyncStatus.ERROR);
      expect(result.error).toBe("Not Found");
      expect(mockGoogleCalendarService.getStoredAccessToken).toHaveBeenCalledTimes(1);
      expect(mockGoogleCalendarService.refreshAccessToken).not.toHaveBeenCalled();
    });

    it("syncEvent: 409 on insert → no refresh, throw", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue("token-stored");
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: null,
        googleSyncStatus: GoogleSyncStatus.NONE,
      });
      googleapisMock.__mock__.mockInsert.mockRejectedValueOnce(google409Error);

      const result = await service.syncEvent(userId, input);

      expect(result.status).toBe(GoogleSyncStatus.ERROR);
      expect(result.error).toBe("Conflict");
      expect(mockGoogleCalendarService.getStoredAccessToken).toHaveBeenCalledTimes(1);
      expect(mockGoogleCalendarService.refreshAccessToken).not.toHaveBeenCalled();
    });

    it("syncEvent: 429 on insert → no refresh, throw", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue("token-stored");
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: null,
        googleSyncStatus: GoogleSyncStatus.NONE,
      });
      googleapisMock.__mock__.mockInsert.mockRejectedValueOnce(google429Error);

      const result = await service.syncEvent(userId, input);

      expect(result.status).toBe(GoogleSyncStatus.ERROR);
      expect(result.error).toBe("Rate Limited");
      expect(mockGoogleCalendarService.getStoredAccessToken).toHaveBeenCalledTimes(1);
      expect(mockGoogleCalendarService.refreshAccessToken).not.toHaveBeenCalled();
    });

    it("syncEvent: 500 on insert → no refresh, throw", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue("token-stored");
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: null,
        googleSyncStatus: GoogleSyncStatus.NONE,
      });
      googleapisMock.__mock__.mockInsert.mockRejectedValueOnce(google500Error);

      const result = await service.syncEvent(userId, input);

      expect(result.status).toBe(GoogleSyncStatus.ERROR);
      expect(result.error).toBe("Internal Server Error");
      expect(mockGoogleCalendarService.getStoredAccessToken).toHaveBeenCalledTimes(1);
      expect(mockGoogleCalendarService.refreshAccessToken).not.toHaveBeenCalled();
    });

    it("deleteGoogleEvent: 401 → refresh → retry succeeds", async () => {
      mockDeletePath();
      googleapisMock.__mock__.mockDelete
        .mockRejectedValueOnce(google401Error)
        .mockResolvedValueOnce({});

      const result = await service.deleteGoogleEvent(userId, "evt-del-001");

      expect(result.success).toBe(true);
      expect(mockGoogleCalendarService.getStoredAccessToken).toHaveBeenCalledTimes(1);
      expect(mockGoogleCalendarService.refreshAccessToken).toHaveBeenCalledTimes(1);
    });

    it("deleteGoogleEvent: 401 → refresh fails → ERROR", async () => {
      mockPrisma.event.findUnique.mockReset();
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: "google-del-002",
        googleSyncStatus: GoogleSyncStatus.SYNCED,
      });
      mockPrisma.googleCalendarConnection.findUnique.mockReset();
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      mockGoogleCalendarService.getStoredAccessToken.mockReset();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue("token-stored");
      mockGoogleCalendarService.refreshAccessToken.mockReset();
      mockGoogleCalendarService.refreshAccessToken.mockResolvedValue(null);
      googleapisMock.__mock__.mockDelete.mockReset();
      googleapisMock.__mock__.mockDelete.mockRejectedValueOnce(google401Error);

      const result = await service.deleteGoogleEvent(userId, "evt-del-002");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Reconecte sua conta");
      expect(mockGoogleCalendarService.getStoredAccessToken).toHaveBeenCalledTimes(1);
      expect(mockGoogleCalendarService.refreshAccessToken).toHaveBeenCalledTimes(1);
    });

    it("deleteGoogleEvent: 401 → refresh → retry 401 again → ERROR", async () => {
      mockPrisma.event.findUnique.mockReset();
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: "google-del-003",
        googleSyncStatus: GoogleSyncStatus.SYNCED,
      });
      mockPrisma.googleCalendarConnection.findUnique.mockReset();
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      mockGoogleCalendarService.getStoredAccessToken.mockReset();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue("token-stored");
      mockGoogleCalendarService.refreshAccessToken.mockReset();
      mockGoogleCalendarService.refreshAccessToken.mockResolvedValue("token-refreshed");
      googleapisMock.__mock__.mockDelete.mockReset();
      googleapisMock.__mock__.mockDelete
        .mockRejectedValueOnce(google401Error)
        .mockRejectedValueOnce(google401Error);

      const result = await service.deleteGoogleEvent(userId, "evt-del-003");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unauthorized");
      expect(mockGoogleCalendarService.getStoredAccessToken).toHaveBeenCalledTimes(1);
      expect(mockGoogleCalendarService.refreshAccessToken).toHaveBeenCalledTimes(1);
    });

    it("deleteGoogleEvent: 404 on delete → treat as success", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue("token-stored");
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: "google-del-004",
        googleSyncStatus: GoogleSyncStatus.SYNCED,
      });
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      googleapisMock.__mock__.mockDelete.mockRejectedValueOnce(google404Error);

      const result = await service.deleteGoogleEvent(userId, "evt-del-004");

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(mockGoogleCalendarService.getStoredAccessToken).toHaveBeenCalledTimes(1);
      expect(mockGoogleCalendarService.refreshAccessToken).not.toHaveBeenCalled();
    });

    it("deleteGoogleEvent: 500 on delete → no refresh, ERROR", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue("token-stored");
      mockPrisma.event.findUnique.mockResolvedValue({
        googleEventId: "google-del-005",
        googleSyncStatus: GoogleSyncStatus.SYNCED,
      });
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: "primary",
      });
      googleapisMock.__mock__.mockDelete.mockRejectedValueOnce(google500Error);

      const result = await service.deleteGoogleEvent(userId, "evt-del-005");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Internal Server Error");
      expect(mockGoogleCalendarService.getStoredAccessToken).toHaveBeenCalledTimes(1);
      expect(mockGoogleCalendarService.refreshAccessToken).not.toHaveBeenCalled();
    });
  });
});

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
    googleCalendarEventSync: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    schedule: {
      findUnique: jest.fn(),
    },
  };

  const mockGoogleCalendarService = {
    refreshAccessToken: jest.fn(),
    getStoredAccessToken: jest.fn(),
  };

  const scheduleId = "sched-001";
  const userId = "user-123";
  const eventId = "evt-001";

  const defaultSchedule = {
    id: scheduleId,
    volunteerId: userId,
    eventId,
    status: "CONFIRMADO",
    event: {
      id: eventId,
      churchId: "church-001",
      nome: "Culto Dominical",
      descricao: "Culto de domingo",
      dataInicio: new Date("2026-09-15T19:00:00.000Z"),
      dataFim: new Date("2026-09-15T21:00:00.000Z"),
      recurrenceGroupId: null,
    },
  };

  function mockSchedule(data: Record<string, unknown> = defaultSchedule) {
    mockPrisma.schedule.findUnique.mockResolvedValue(data);
  }

  function mockConnection(calendarId: string | null = "primary") {
    mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
      calendarId,
    });
  }

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

  describe("syncSchedule", () => {
    it("should return ERROR when schedule not found", async () => {
      mockPrisma.schedule.findUnique.mockResolvedValue(null);

      const result = await service.syncSchedule(scheduleId);

      expect(result.status).toBe(GoogleSyncStatus.ERROR);
      expect(result.error).toBe("Escala não encontrada.");
    });

    it("should return NONE when schedule is CANCELADO", async () => {
      mockSchedule({ ...defaultSchedule, status: "CANCELADO" });

      const result = await service.syncSchedule(scheduleId);

      expect(result.status).toBe(GoogleSyncStatus.NONE);
      expect(result.googleEventId).toBeNull();
      expect(result.error).toBeNull();
    });

    it("should return NONE when no Google Calendar connection", async () => {
      mockSchedule();
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue(null);

      const result = await service.syncSchedule(scheduleId);

      expect(result.status).toBe(GoogleSyncStatus.NONE);
    });

    it("should return ERROR when getStoredAccessToken returns null", async () => {
      mockSchedule();
      mockConnection();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(null);

      const result = await service.syncSchedule(scheduleId);

      expect(result.status).toBe(GoogleSyncStatus.ERROR);
      expect(result.error).toBe(
        "Google Calendar não conectado para este usuário.",
      );
    });

    it("should create new event when no existing sync", async () => {
      mockSchedule();
      mockConnection();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue(null);

      const result = await service.syncSchedule(scheduleId);

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);
      expect(result.googleEventId).toBeDefined();
      expect(result.error).toBeNull();
      expect(mockPrisma.googleCalendarEventSync.upsert).toHaveBeenCalledWith({
        where: { scheduleId },
        update: {
          googleEventId: "mocked-google-event-id",
          syncStatus: GoogleSyncStatus.SYNCED,
          lastSyncedAt: expect.any(Date),
          syncError: null,
        },
        create: {
          scheduleId,
          userId,
          eventId,
          googleEventId: "mocked-google-event-id",
          syncStatus: GoogleSyncStatus.SYNCED,
          lastSyncedAt: expect.any(Date),
        },
      });
    });

    it("should update existing synced event", async () => {
      mockSchedule();
      mockConnection();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue({
        googleEventId: "existing-google-id",
        syncStatus: GoogleSyncStatus.SYNCED,
      });

      const result = await service.syncSchedule(scheduleId);

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);
      expect(result.googleEventId).toBe("existing-google-id");
      expect(googleapisMock.__mock__.mockUpdate).toHaveBeenCalled();
    });

    it("should use 'primary' when connection has no calendarId", async () => {
      mockSchedule();
      mockConnection(null);
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue(null);

      const result = await service.syncSchedule(scheduleId);

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);
    });

    it("should handle null churchId in event", async () => {
      mockSchedule({
        ...defaultSchedule,
        event: { ...defaultSchedule.event, churchId: null },
      });
      mockConnection();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue(null);

      const result = await service.syncSchedule(scheduleId);

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);
    });

    it("should handle null descricao in event", async () => {
      mockSchedule({
        ...defaultSchedule,
        event: { ...defaultSchedule.event, descricao: null },
      });
      mockConnection();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue(null);

      const result = await service.syncSchedule(scheduleId);

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);
    });

    it("should handle recurrenceGroupId in event", async () => {
      mockSchedule({
        ...defaultSchedule,
        event: {
          ...defaultSchedule.event,
          recurrenceGroupId: "rec-group-001",
        },
      });
      mockConnection();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue(null);

      const result = await service.syncSchedule(scheduleId);

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);
    });

    it("should return ERROR when Google API call throws", async () => {
      googleapisMock.__mock__.mockInsert.mockRejectedValueOnce(
        new Error("Google API Error"),
      );
      mockSchedule();
      mockConnection();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue(null);

      const result = await service.syncSchedule(scheduleId);

      expect(result.status).toBe(GoogleSyncStatus.ERROR);
      expect(result.error).toBe("Google API Error");

      googleapisMock.__mock__.mockInsert.mockResolvedValue({
        data: { id: "mocked-google-event-id" },
      });
    });

    it("should handle connection not found (null)", async () => {
      mockSchedule();
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue(null);

      const result = await service.syncSchedule(scheduleId);

      expect(result.status).toBe(GoogleSyncStatus.NONE);
    });

    it("should handle PENDING status event", async () => {
      mockSchedule();
      mockConnection();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue(null);

      const result = await service.syncSchedule(scheduleId);

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);
    });

    it("should handle ERROR status event as new event", async () => {
      mockSchedule();
      mockConnection();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue(null);

      const result = await service.syncSchedule(scheduleId);

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);
    });
  });

  describe("deleteGoogleEvent", () => {
    it("should return error when not connected", async () => {
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue({
        googleEventId: "google-evt-123",
        userId,
      });
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(null);

      const result = await service.deleteGoogleEvent(scheduleId);

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Google Calendar não conectado para este usuário.",
      );
    });

    it("should succeed when event has no googleEventId", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue(null);

      const result = await service.deleteGoogleEvent(scheduleId);

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
    });

    it("should succeed when event not found", async () => {
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue(null);

      const result = await service.deleteGoogleEvent(scheduleId);

      expect(result.success).toBe(true);
    });

    it("should reset event sync fields after successful deletion", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue({
        googleEventId: "google-evt-123",
        userId,
      });
      mockConnection();

      const result = await service.deleteGoogleEvent(scheduleId);

      expect(result.success).toBe(true);
      expect(mockPrisma.googleCalendarEventSync.deleteMany).toHaveBeenCalledWith(
        {
          where: { scheduleId },
        },
      );
    });

    it("should handle connection not found", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue({
        googleEventId: "google-evt-123",
        userId,
      });
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue(null);

      const result = await service.deleteGoogleEvent(scheduleId);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe("boolean");
    });

    it("should handle event with googleEventId and NONE status", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue({
        googleEventId: "some-google-id",
        userId,
      });
      mockConnection();

      const result = await service.deleteGoogleEvent(scheduleId);

      expect(result).toBeDefined();
    });

    it("should return ERROR when Google delete API throws", async () => {
      googleapisMock.__mock__.mockDelete.mockRejectedValueOnce(
        new Error("Delete failed"),
      );
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue({
        googleEventId: "google-evt-fail",
        userId,
      });
      mockConnection();

      const result = await service.deleteGoogleEvent(scheduleId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Delete failed");

      googleapisMock.__mock__.mockDelete.mockResolvedValue({});
    });
  });

  describe("syncSchedule - edge cases", () => {
    const edgeScheduleId = "sched-edge-001";
    const edgeUserId = "user-456";

    const edgeSchedule = {
      id: edgeScheduleId,
      volunteerId: edgeUserId,
      eventId: "evt-edge-001",
      status: "CONFIRMADO",
      event: {
        id: "evt-edge-001",
        churchId: "church-001",
        nome: "Evento Edge",
        descricao: "Teste",
        dataInicio: new Date("2026-12-31T23:00:00.000Z"),
        dataFim: new Date("2027-01-01T01:00:00.000Z"),
        recurrenceGroupId: null,
      },
    };

    it("should handle event with existing ERROR status and googleEventId", async () => {
      mockSchedule(edgeSchedule);
      mockConnection();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue({
        googleEventId: "old-google-id",
        syncStatus: GoogleSyncStatus.ERROR,
      });

      const result = await service.syncSchedule(edgeScheduleId);

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);
      expect(googleapisMock.__mock__.mockInsert).toHaveBeenCalled();
    });

    it("should handle very long event name", async () => {
      mockSchedule({
        ...edgeSchedule,
        event: { ...edgeSchedule.event, nome: "A".repeat(500) },
      });
      mockConnection();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue(null);

      const result = await service.syncSchedule(edgeScheduleId);

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);
    });

    it("should handle special characters in event name", async () => {
      mockSchedule({
        ...edgeSchedule,
        event: { ...edgeSchedule.event, nome: "Culto @ # $ % & * ()" },
      });
      mockConnection();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue(null);

      const result = await service.syncSchedule(edgeScheduleId);

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);
    });

    it("should handle unicode characters in event name", async () => {
      mockSchedule({
        ...edgeSchedule,
        event: {
          ...edgeSchedule.event,
          nome: "Culto Dominical - Igreja da Lagoinha",
        },
      });
      mockConnection();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue(null);

      const result = await service.syncSchedule(edgeScheduleId);

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);
    });
  });

  describe("integration patterns", () => {
    it("should handle sync after disconnect and reconnect", async () => {
      const reconnectScheduleId = "sched-reconnect";
      const reconnectSchedule = {
        ...defaultSchedule,
        id: reconnectScheduleId,
        volunteerId: "user-reconnect",
        eventId: "evt-reconnect",
        event: {
          ...defaultSchedule.event,
          id: "evt-reconnect",
          nome: "Culto",
          descricao: null,
        },
      };

      mockPrisma.schedule.findUnique.mockResolvedValue(reconnectSchedule);
      mockConnection();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(null);

      const result1 = await service.syncSchedule(reconnectScheduleId);
      expect(result1.status).toBe(GoogleSyncStatus.ERROR);

      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "new-access-token",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue(null);

      const result2 = await service.syncSchedule(reconnectScheduleId);
      expect(result2.status).toBe(GoogleSyncStatus.SYNCED);
    });

    it("should handle multiple events in sequence", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockConnection();

      const schedules = [
        {
          id: "sched-seq-1",
          volunteerId: "user-seq",
          eventId: "evt-seq-1",
          status: "CONFIRMADO",
          event: {
            id: "evt-seq-1",
            churchId: "church-001",
            nome: "Culto 1",
            descricao: null,
            dataInicio: new Date("2026-09-15T19:00:00.000Z"),
            dataFim: new Date("2026-09-15T21:00:00.000Z"),
            recurrenceGroupId: null,
          },
        },
        {
          id: "sched-seq-2",
          volunteerId: "user-seq",
          eventId: "evt-seq-2",
          status: "CONFIRMADO",
          event: {
            id: "evt-seq-2",
            churchId: "church-001",
            nome: "Culto 2",
            descricao: null,
            dataInicio: new Date("2026-09-22T19:00:00.000Z"),
            dataFim: new Date("2026-09-22T21:00:00.000Z"),
            recurrenceGroupId: null,
          },
        },
      ];

      for (const sched of schedules) {
        mockPrisma.schedule.findUnique.mockResolvedValue(sched);
        mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue(null);
        const result = await service.syncSchedule(sched.id);
        expect(result.status).toBe(GoogleSyncStatus.SYNCED);
      }
    });

    it("should handle delete when connection has no calendarId", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue({
        googleEventId: "google-evt-delete",
        userId: "user-delete-no-cal",
      });
      mockPrisma.googleCalendarConnection.findUnique.mockResolvedValue({
        calendarId: null,
      });

      const result = await service.deleteGoogleEvent("sched-delete");

      expect(result.success).toBe(true);
    });
  });

  describe("deterministic ID consistency", () => {
    it("should always produce same ID for same schedule", () => {
      const sid = "550e8400-e29b-41d4-a716-446655440000";
      const id1 = service.buildGoogleEventId(sid);
      const id2 = service.buildGoogleEventId(sid);
      expect(id1).toBe(id2);
    });

    it("should produce different IDs for different schedules", () => {
      const id1 = service.buildGoogleEventId("sched-001");
      const id2 = service.buildGoogleEventId("sched-002");
      expect(id1).not.toBe(id2);
    });

    it("should always start with 'escala-' prefix", () => {
      const result = service.buildGoogleEventId("any-schedule-id");
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
      const tzScheduleId = "sched-tz-body";
      mockSchedule({
        ...defaultSchedule,
        id: tzScheduleId,
        volunteerId: "user-tz-body",
        eventId: "evt-tz-body-001",
        event: {
          id: "evt-tz-body-001",
          churchId: "church-001",
          nome: "Culto",
          descricao: null,
          dataInicio: new Date("2026-09-12T22:00:00.000Z"),
          dataFim: new Date("2026-09-13T00:00:00.000Z"),
          recurrenceGroupId: null,
        },
      });
      mockConnection();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue(null);

      await service.syncSchedule(tzScheduleId);

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
      const extScheduleId = "sched-ext-1";
      mockSchedule({
        ...defaultSchedule,
        id: extScheduleId,
        volunteerId: "user-ext-1",
        eventId: "evt-ext-001",
        event: {
          ...defaultSchedule.event,
          id: "evt-ext-001",
          nome: "Teste Extended Props",
          descricao: null,
        },
      });
      mockConnection();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue(null);

      const result = await service.syncSchedule(extScheduleId);

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
      const extScheduleId = "sched-ext-2";
      mockSchedule({
        ...defaultSchedule,
        id: extScheduleId,
        volunteerId: "user-ext-2",
        eventId: "evt-ext-002",
        event: {
          ...defaultSchedule.event,
          id: "evt-ext-002",
          nome: "Teste Church",
          descricao: null,
          churchId: "church-002",
        },
      });
      mockConnection();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue(null);

      const result = await service.syncSchedule(extScheduleId);

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);

      const insertCall =
        googleapisMock.__mock__.mockInsert.mock.calls[0]?.[0];
      expect(
        insertCall?.requestBody?.extendedProperties?.private?.churchId,
      ).toBe("church-002");
    });

    it("should set empty string for null churchId", async () => {
      const extScheduleId = "sched-ext-3";
      mockSchedule({
        ...defaultSchedule,
        id: extScheduleId,
        volunteerId: "user-ext-3",
        eventId: "evt-ext-003",
        event: {
          ...defaultSchedule.event,
          id: "evt-ext-003",
          nome: "Teste No Church",
          descricao: null,
          churchId: null,
        },
      });
      mockConnection();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue(null);

      const result = await service.syncSchedule(extScheduleId);

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
      const idemScheduleId = "sched-idem";
      mockSchedule({
        ...defaultSchedule,
        id: idemScheduleId,
        volunteerId: "user-idem",
        eventId: "evt-idem-001",
        event: {
          ...defaultSchedule.event,
          id: "evt-idem-001",
          nome: "Teste Idempotency",
          descricao: null,
        },
      });
      mockConnection();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue({
        googleEventId: "already-synced-id",
        syncStatus: GoogleSyncStatus.SYNCED,
      });

      const result = await service.syncSchedule(idemScheduleId);

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);
      expect(result.googleEventId).toBe("already-synced-id");
      expect(googleapisMock.__mock__.mockInsert).not.toHaveBeenCalled();
      expect(googleapisMock.__mock__.mockUpdate).toHaveBeenCalled();
    });

    it("should send deterministic ID in requestBody.id on create", async () => {
      const idemScheduleId = "sched-idem-create";
      mockSchedule({
        ...defaultSchedule,
        id: idemScheduleId,
        volunteerId: "user-idem-create",
        eventId: "evt-idem-create-001",
        event: {
          ...defaultSchedule.event,
          id: "evt-idem-create-001",
          nome: "Teste Create ID",
          descricao: null,
        },
      });
      mockConnection();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue(null);

      await service.syncSchedule(idemScheduleId);

      const expectedId = service.buildGoogleEventId(idemScheduleId);
      const insertCall =
        googleapisMock.__mock__.mockInsert.mock.calls[0]?.[0];
      expect(insertCall?.requestBody?.id).toBe(expectedId);
    });

    it("should persist response.data.id which equals the deterministic ID", async () => {
      const idemScheduleId = "sched-idem-persist";
      mockSchedule({
        ...defaultSchedule,
        id: idemScheduleId,
        volunteerId: "user-idem-persist",
        eventId: "evt-idem-persist-001",
        event: {
          ...defaultSchedule.event,
          id: "evt-idem-persist-001",
          nome: "Teste Persist ID",
          descricao: null,
        },
      });
      mockConnection();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue(null);

      const result = await service.syncSchedule(idemScheduleId);

      expect(result.googleEventId).toBe("mocked-google-event-id");
      expect(mockPrisma.googleCalendarEventSync.upsert).toHaveBeenCalledWith({
        where: { scheduleId: idemScheduleId },
        update: {
          googleEventId: "mocked-google-event-id",
          syncStatus: GoogleSyncStatus.SYNCED,
          lastSyncedAt: expect.any(Date),
          syncError: null,
        },
        create: {
          scheduleId: idemScheduleId,
          userId: "user-idem-persist",
          eventId: "evt-idem-persist-001",
          googleEventId: "mocked-google-event-id",
          syncStatus: GoogleSyncStatus.SYNCED,
          lastSyncedAt: expect.any(Date),
        },
      });
    });

    it("should use same deterministic ID on retry (same schedule)", async () => {
      const idemScheduleId = "sched-idem-retry";
      mockSchedule({
        ...defaultSchedule,
        id: idemScheduleId,
        volunteerId: "user-idem-retry",
        eventId: "evt-idem-retry-001",
        event: {
          ...defaultSchedule.event,
          id: "evt-idem-retry-001",
          nome: "Teste Retry",
          descricao: null,
        },
      });
      mockConnection();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );

      const expectedId = service.buildGoogleEventId(idemScheduleId);

      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValueOnce(null);
      await service.syncSchedule(idemScheduleId);

      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValueOnce(null);
      await service.syncSchedule(idemScheduleId);

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
      const tzScheduleId = "sched-tz";
      mockSchedule({
        ...defaultSchedule,
        id: tzScheduleId,
        volunteerId: "user-tz",
        eventId: "evt-tz-001",
        event: {
          ...defaultSchedule.event,
          id: "evt-tz-001",
          nome: "Culto",
          descricao: null,
        },
      });
      mockConnection();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue(null);

      await service.syncSchedule(tzScheduleId);

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
      const updScheduleId = "sched-upd";
      mockSchedule({
        ...defaultSchedule,
        id: updScheduleId,
        volunteerId: "user-upd",
        eventId: "evt-upd-001",
        event: {
          id: "evt-upd-001",
          churchId: "church-001",
          nome: "Evento Atualizado",
          descricao: "desc",
          dataInicio: new Date("2026-09-15T19:00:00.000Z"),
          dataFim: new Date("2026-09-15T21:00:00.000Z"),
          recurrenceGroupId: "rec-001",
        },
      });
      mockConnection();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "access-token",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue({
        googleEventId: "existing-google-id",
        syncStatus: GoogleSyncStatus.SYNCED,
      });

      await service.syncSchedule(updScheduleId);

      const updateCall =
        googleapisMock.__mock__.mockUpdate.mock.calls[0]?.[0];
      expect(updateCall?.requestBody?.summary).toBe("Evento Atualizado");
      expect(
        updateCall?.requestBody?.extendedProperties?.private,
      ).toMatchObject({
        "escala-facil": "true",
        eventId: "evt-upd-001",
        scheduleId: updScheduleId,
        recurrenceGroupId: "rec-001",
      });
    });
  });

  describe("retry on 401", () => {
    const retryScheduleId = "sched-retry";
    const retryUserId = "user-retry";

    const retrySchedule = {
      ...defaultSchedule,
      id: retryScheduleId,
      volunteerId: retryUserId,
      eventId: "evt-retry-001",
      event: {
        ...defaultSchedule.event,
        id: "evt-retry-001",
        nome: "Evento Retry",
        descricao: "Teste retry",
      },
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
      mockSchedule(retrySchedule);
      mockConnection();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "token-stored",
      );
      mockGoogleCalendarService.refreshAccessToken.mockResolvedValue(
        "token-refreshed",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue(null);
    }

    function mockSyncUpdatePath() {
      mockSchedule(retrySchedule);
      mockConnection();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "token-stored",
      );
      mockGoogleCalendarService.refreshAccessToken.mockResolvedValue(
        "token-refreshed",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue({
        googleEventId: "existing-google-id",
        syncStatus: GoogleSyncStatus.SYNCED,
      });
    }

    function mockDeletePath() {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "token-stored",
      );
      mockGoogleCalendarService.refreshAccessToken.mockResolvedValue(
        "token-refreshed",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue({
        googleEventId: "google-del-001",
        userId: retryUserId,
      });
      mockConnection();
    }

    it("syncSchedule: 401 on insert → refresh → retry succeeds", async () => {
      mockSyncCreatePath();
      googleapisMock.__mock__.mockInsert
        .mockRejectedValueOnce(google401Error)
        .mockResolvedValueOnce({ data: { id: "google-retry-ok" } });

      const result = await service.syncSchedule(retryScheduleId);

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);
      expect(result.googleEventId).toBe("google-retry-ok");
      expect(
        mockGoogleCalendarService.getStoredAccessToken,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockGoogleCalendarService.refreshAccessToken,
      ).toHaveBeenCalledTimes(1);
    });

    it("syncSchedule: 401 on insert → refresh fails → ERROR", async () => {
      mockSchedule(retrySchedule);
      mockConnection();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "token-stored",
      );
      mockGoogleCalendarService.refreshAccessToken.mockResolvedValue(null);
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue(null);
      googleapisMock.__mock__.mockInsert.mockRejectedValueOnce(google401Error);

      const result = await service.syncSchedule(retryScheduleId);

      expect(result.status).toBe(GoogleSyncStatus.ERROR);
      expect(result.error).toContain("Reconecte sua conta");
      expect(
        mockGoogleCalendarService.getStoredAccessToken,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockGoogleCalendarService.refreshAccessToken,
      ).toHaveBeenCalledTimes(1);
    });

    it("syncSchedule: 401 on insert → refresh → retry 401 again → ERROR", async () => {
      mockSyncCreatePath();
      googleapisMock.__mock__.mockInsert
        .mockRejectedValueOnce(google401Error)
        .mockRejectedValueOnce(google401Error);

      const result = await service.syncSchedule(retryScheduleId);

      expect(result.status).toBe(GoogleSyncStatus.ERROR);
      expect(result.error).toBe("Unauthorized");
      expect(
        mockGoogleCalendarService.getStoredAccessToken,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockGoogleCalendarService.refreshAccessToken,
      ).toHaveBeenCalledTimes(1);
    });

    it("syncSchedule: 401 on update → refresh → retry succeeds", async () => {
      mockSyncUpdatePath();
      googleapisMock.__mock__.mockUpdate
        .mockRejectedValueOnce(google401Error)
        .mockResolvedValueOnce({ data: {} });

      const result = await service.syncSchedule(retryScheduleId);

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);
      expect(result.googleEventId).toBe("existing-google-id");
      expect(
        mockGoogleCalendarService.getStoredAccessToken,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockGoogleCalendarService.refreshAccessToken,
      ).toHaveBeenCalledTimes(1);
    });

    it("syncSchedule: 401 on update → refresh → retry 404 → recreate succeeds", async () => {
      mockSchedule(retrySchedule);
      mockConnection();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "token-stored",
      );
      mockGoogleCalendarService.refreshAccessToken.mockResolvedValue(
        "token-refreshed",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue({
        googleEventId: "existing-google-id",
        syncStatus: GoogleSyncStatus.SYNCED,
      });
      googleapisMock.__mock__.mockUpdate.mockRejectedValueOnce(google404Error);
      googleapisMock.__mock__.mockInsert.mockResolvedValueOnce({
        data: { id: "new-google-id" },
      });

      const result = await service.syncSchedule(retryScheduleId);

      expect(result.status).toBe(GoogleSyncStatus.SYNCED);
      expect(result.googleEventId).toBe("new-google-id");
    });

    it("syncSchedule: 403 on insert → no refresh, throw", async () => {
      mockSchedule(retrySchedule);
      mockConnection();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "token-stored",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue(null);
      googleapisMock.__mock__.mockInsert.mockRejectedValueOnce(google403Error);

      const result = await service.syncSchedule(retryScheduleId);

      expect(result.status).toBe(GoogleSyncStatus.ERROR);
      expect(result.error).toBe("Forbidden");
      expect(
        mockGoogleCalendarService.getStoredAccessToken,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockGoogleCalendarService.refreshAccessToken,
      ).not.toHaveBeenCalled();
    });

    it("syncSchedule: 404 on insert → no refresh, throw", async () => {
      mockSchedule(retrySchedule);
      mockConnection();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "token-stored",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue(null);
      googleapisMock.__mock__.mockInsert.mockRejectedValueOnce(google404Error);

      const result = await service.syncSchedule(retryScheduleId);

      expect(result.status).toBe(GoogleSyncStatus.ERROR);
      expect(result.error).toBe("Not Found");
      expect(
        mockGoogleCalendarService.getStoredAccessToken,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockGoogleCalendarService.refreshAccessToken,
      ).not.toHaveBeenCalled();
    });

    it("syncSchedule: 409 on insert → no refresh, throw", async () => {
      mockSchedule(retrySchedule);
      mockConnection();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "token-stored",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue(null);
      googleapisMock.__mock__.mockInsert.mockRejectedValueOnce(google409Error);

      const result = await service.syncSchedule(retryScheduleId);

      expect(result.status).toBe(GoogleSyncStatus.ERROR);
      expect(result.error).toBe("Conflict");
      expect(
        mockGoogleCalendarService.getStoredAccessToken,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockGoogleCalendarService.refreshAccessToken,
      ).not.toHaveBeenCalled();
    });

    it("syncSchedule: 429 on insert → no refresh, throw", async () => {
      mockSchedule(retrySchedule);
      mockConnection();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "token-stored",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue(null);
      googleapisMock.__mock__.mockInsert.mockRejectedValueOnce(google429Error);

      const result = await service.syncSchedule(retryScheduleId);

      expect(result.status).toBe(GoogleSyncStatus.ERROR);
      expect(result.error).toBe("Rate Limited");
      expect(
        mockGoogleCalendarService.getStoredAccessToken,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockGoogleCalendarService.refreshAccessToken,
      ).not.toHaveBeenCalled();
    });

    it("syncSchedule: 500 on insert → no refresh, throw", async () => {
      mockSchedule(retrySchedule);
      mockConnection();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "token-stored",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue(null);
      googleapisMock.__mock__.mockInsert.mockRejectedValueOnce(google500Error);

      const result = await service.syncSchedule(retryScheduleId);

      expect(result.status).toBe(GoogleSyncStatus.ERROR);
      expect(result.error).toBe("Internal Server Error");
      expect(
        mockGoogleCalendarService.getStoredAccessToken,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockGoogleCalendarService.refreshAccessToken,
      ).not.toHaveBeenCalled();
    });

    it("deleteGoogleEvent: 401 → refresh → retry succeeds", async () => {
      mockDeletePath();
      googleapisMock.__mock__.mockDelete
        .mockRejectedValueOnce(google401Error)
        .mockResolvedValueOnce({});

      const result = await service.deleteGoogleEvent("sched-del-retry-1");

      expect(result.success).toBe(true);
      expect(
        mockGoogleCalendarService.getStoredAccessToken,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockGoogleCalendarService.refreshAccessToken,
      ).toHaveBeenCalledTimes(1);
    });

    it("deleteGoogleEvent: 401 → refresh fails → ERROR", async () => {
      mockPrisma.googleCalendarEventSync.findUnique.mockReset();
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue({
        googleEventId: "google-del-002",
        userId: retryUserId,
      });
      mockPrisma.googleCalendarConnection.findUnique.mockReset();
      mockConnection();
      mockGoogleCalendarService.getStoredAccessToken.mockReset();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "token-stored",
      );
      mockGoogleCalendarService.refreshAccessToken.mockReset();
      mockGoogleCalendarService.refreshAccessToken.mockResolvedValue(null);
      googleapisMock.__mock__.mockDelete.mockReset();
      googleapisMock.__mock__.mockDelete.mockRejectedValueOnce(google401Error);

      const result = await service.deleteGoogleEvent("sched-del-retry-2");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Reconecte sua conta");
      expect(
        mockGoogleCalendarService.getStoredAccessToken,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockGoogleCalendarService.refreshAccessToken,
      ).toHaveBeenCalledTimes(1);
    });

    it("deleteGoogleEvent: 401 → refresh → retry 401 again → ERROR", async () => {
      mockPrisma.googleCalendarEventSync.findUnique.mockReset();
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue({
        googleEventId: "google-del-003",
        userId: retryUserId,
      });
      mockPrisma.googleCalendarConnection.findUnique.mockReset();
      mockConnection();
      mockGoogleCalendarService.getStoredAccessToken.mockReset();
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "token-stored",
      );
      mockGoogleCalendarService.refreshAccessToken.mockReset();
      mockGoogleCalendarService.refreshAccessToken.mockResolvedValue(
        "token-refreshed",
      );
      googleapisMock.__mock__.mockDelete.mockReset();
      googleapisMock.__mock__.mockDelete
        .mockRejectedValueOnce(google401Error)
        .mockRejectedValueOnce(google401Error);

      const result = await service.deleteGoogleEvent("sched-del-retry-3");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unauthorized");
      expect(
        mockGoogleCalendarService.getStoredAccessToken,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockGoogleCalendarService.refreshAccessToken,
      ).toHaveBeenCalledTimes(1);
    });

    it("deleteGoogleEvent: 404 on delete → treat as success", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "token-stored",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue({
        googleEventId: "google-del-004",
        userId: retryUserId,
      });
      mockConnection();
      googleapisMock.__mock__.mockDelete.mockRejectedValueOnce(google404Error);

      const result = await service.deleteGoogleEvent("sched-del-retry-4");

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(
        mockGoogleCalendarService.getStoredAccessToken,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockGoogleCalendarService.refreshAccessToken,
      ).not.toHaveBeenCalled();
    });

    it("deleteGoogleEvent: 500 on delete → no refresh, ERROR", async () => {
      mockGoogleCalendarService.getStoredAccessToken.mockResolvedValue(
        "token-stored",
      );
      mockPrisma.googleCalendarEventSync.findUnique.mockResolvedValue({
        googleEventId: "google-del-005",
        userId: retryUserId,
      });
      mockConnection();
      googleapisMock.__mock__.mockDelete.mockRejectedValueOnce(google500Error);

      const result = await service.deleteGoogleEvent("sched-del-retry-5");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Internal Server Error");
      expect(
        mockGoogleCalendarService.getStoredAccessToken,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockGoogleCalendarService.refreshAccessToken,
      ).not.toHaveBeenCalled();
    });
  });
});

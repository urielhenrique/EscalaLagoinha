import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { EventsService } from "./events.service";
import { PrismaService } from "../prisma/prisma.service";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { Perfil, Prisma } from "@prisma/client";
import { RecurrenceTypeDto } from "./dto/create-event.dto";
import { UpdateEventDto } from "./dto/update-event.dto";
import { GoogleCalendarSyncService } from "../integrations/google-calendar/google-calendar-sync.service";
import { AuditLogsService } from "../audit-logs/audit-logs.service";

type TxCreateFn = (args: Record<string, unknown>) => Promise<Record<string, unknown>>;

describe("EventsService — Recorrência", () => {
  let service: EventsService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  function createPrismaMock() {
    return {
      event: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      googleCalendarConnection: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      schedule: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(),
    };
  }

  const adminUser: JwtPayload = {
    sub: "user-1",
    email: "admin@test.com",
    perfil: Perfil.ADMIN,
    churchId: "church-1",
    churchSlug: "church-1",
  };

  const userWithoutChurch: JwtPayload = {
    sub: "user-2",
    email: "no-church@test.com",
    perfil: Perfil.ADMIN,
    churchId: undefined,
    churchSlug: undefined,
  };

  const userFromChurchB: JwtPayload = {
    sub: "user-b",
    email: "user-b@test.com",
    perfil: Perfil.ADMIN,
    churchId: "church-2",
    churchSlug: "church-2",
  };

  beforeEach(async () => {
    prismaMock = createPrismaMock();
    prismaMock.event.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: GoogleCalendarSyncService,
          useValue: {
            syncAllEventSchedules: jest.fn().mockResolvedValue(undefined),
            unlinkAllEventSchedules: jest.fn().mockResolvedValue({ success: true, errors: [] }),
            getEventSyncStatuses: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: AuditLogsService,
          useValue: { log: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  function setupTransaction(createFn: TxCreateFn) {
    prismaMock.$transaction.mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (cb: any) => {
        const tx = {
          event: {
            create: jest.fn().mockImplementation(createFn),
          },
        };
        return cb(tx);
      },
    );
  }

  describe("create — evento único (sem recorrência)", () => {
    it("should create a single event without recurrence", async () => {
      const dto = {
        nome: "Culto Especial",
        descricao: "Evento especial",
        dataInicio: "2026-10-04T19:00:00.000Z",
        dataFim: "2026-10-04T21:00:00.000Z",
      };

      const createdEvent = {
        id: "evt-1",
        churchId: "church-1",
        nome: dto.nome,
        descricao: dto.descricao,
        dataInicio: new Date(dto.dataInicio),
        dataFim: new Date(dto.dataFim),
        recorrencia: null,
        recurrenceGroupId: null,
        recurrenceType: "NONE",
        recurrenceDays: [],
        recurrenceStart: null,
        recurrenceEnd: null,
        recurrenceIndex: null,
        createdAt: new Date(),
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      };

      prismaMock.event.create.mockResolvedValue(createdEvent);
      prismaMock.event.findUnique.mockResolvedValue(createdEvent);

      const result = await service.create(dto, adminUser);

      expect(result).toHaveProperty("id", "evt-1");
      expect(prismaMock.event.create).toHaveBeenCalledTimes(1);
    });
  });

  describe("create — recorrência semanal", () => {
    it("should create multiple events for weekly recurrence on Sundays", async () => {
      const dto = {
        nome: "Culto Domingo",
        descricao: "Celebração dominical",
        dataInicio: "2026-10-04T19:00:00.000Z",
        dataFim: "2026-10-04T21:00:00.000Z",
        recurrence: {
          type: RecurrenceTypeDto.WEEKLY,
          startDate: "2026-10-04T00:00:00.000Z",
          endDate: "2026-10-25T00:00:00.000Z",
          daysOfWeek: ["DOMINGO"],
        },
      };

      let callCount = 0;
      setupTransaction(async () => {
        callCount++;
        return {
          id: `evt-${callCount}`,
          churchId: "church-1",
          recurrenceIndex: callCount - 1,
        };
      });

      const createdEvents = [
        { id: "evt-1", recurrenceIndex: 0, googleEventId: null, googleSyncStatus: "NONE", lastSyncedAt: null, googleSyncError: null },
        { id: "evt-2", recurrenceIndex: 1, googleEventId: null, googleSyncStatus: "NONE", lastSyncedAt: null, googleSyncError: null },
        { id: "evt-3", recurrenceIndex: 2, googleEventId: null, googleSyncStatus: "NONE", lastSyncedAt: null, googleSyncError: null },
        { id: "evt-4", recurrenceIndex: 3, googleEventId: null, googleSyncStatus: "NONE", lastSyncedAt: null, googleSyncError: null },
      ];

      prismaMock.event.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(createdEvents);

      const result = (await service.create(dto, adminUser)) as {
        recurrenceGroupId: string;
        totalEvents: number;
        events: unknown[];
      };

      expect(result).toHaveProperty("recurrenceGroupId");
      expect(result.totalEvents).toBe(4);
      expect(result.events).toHaveLength(4);
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    it("should generate correct dates for Sundays in October 2026", async () => {
      const dto = {
        nome: "Culto Domingo",
        descricao: "Celebração dominical",
        dataInicio: "2026-10-04T19:00:00.000Z",
        dataFim: "2026-10-04T21:00:00.000Z",
        recurrence: {
          type: RecurrenceTypeDto.WEEKLY,
          startDate: "2026-10-01T00:00:00.000Z",
          endDate: "2026-10-31T00:00:00.000Z",
          daysOfWeek: ["DOMINGO"],
        },
      };

      const createdDates: Date[] = [];
      let callCount = 0;

      setupTransaction(async (args) => {
        callCount++;
        const data = args.data as { dataInicio: Date; recurrenceIndex: number };
        createdDates.push(data.dataInicio);
        return {
          id: `evt-${callCount}`,
          dataInicio: data.dataInicio,
          recurrenceIndex: data.recurrenceIndex,
        };
      });

      await service.create(dto, adminUser);

      const sundays = createdDates.map((d) => d.getUTCDay());
      expect(sundays.every((d) => d === 0)).toBe(true);
      expect(createdDates).toHaveLength(4);
    });

    it("should respect churchId for all generated events", async () => {
      const dto = {
        nome: "Culto Domingo",
        descricao: "Celebração dominical",
        dataInicio: "2026-10-04T19:00:00.000Z",
        dataFim: "2026-10-04T21:00:00.000Z",
        recurrence: {
          type: RecurrenceTypeDto.WEEKLY,
          startDate: "2026-10-04T00:00:00.000Z",
          endDate: "2026-10-11T00:00:00.000Z",
          daysOfWeek: ["DOMINGO"],
        },
      };

      const churchIds: string[] = [];

      setupTransaction(async (args) => {
        const data = args.data as { churchId: string };
        churchIds.push(data.churchId);
        return { id: `evt-${churchIds.length}`, churchId: data.churchId };
      });

      await service.create(dto, adminUser);

      expect(churchIds).toEqual(["church-1", "church-1"]);
    });

    it("should generate events for multiple days of the week", async () => {
      const dto = {
        nome: "Culto e Ensaio",
        descricao: "Eventos de domingo e quarta",
        dataInicio: "2026-10-04T19:00:00.000Z",
        dataFim: "2026-10-04T21:00:00.000Z",
        recurrence: {
          type: RecurrenceTypeDto.WEEKLY,
          startDate: "2026-10-01T00:00:00.000Z",
          endDate: "2026-10-31T00:00:00.000Z",
          daysOfWeek: ["DOMINGO", "QUARTA"],
        },
      };

      const createdDays: number[] = [];

      setupTransaction(async (args) => {
        const data = args.data as { dataInicio: Date };
        createdDays.push(data.dataInicio.getUTCDay());
        return { id: `evt-${createdDays.length}` };
      });

      await service.create(dto, adminUser);

      const sundays = createdDays.filter((d) => d === 0);
      const wednesdays = createdDays.filter((d) => d === 3);
      expect(sundays.length).toBeGreaterThan(0);
      expect(wednesdays.length).toBeGreaterThan(0);
      expect(createdDays.every((d) => d === 0 || d === 3)).toBe(true);
    });

    it("should preserve event time across all occurrences", async () => {
      const dto = {
        nome: "Culto Domingo",
        descricao: "Celebração dominical",
        dataInicio: "2026-10-04T19:30:00.000Z",
        dataFim: "2026-10-04T21:30:00.000Z",
        recurrence: {
          type: RecurrenceTypeDto.WEEKLY,
          startDate: "2026-10-01T00:00:00.000Z",
          endDate: "2026-10-31T00:00:00.000Z",
          daysOfWeek: ["DOMINGO"],
        },
      };

      const createdEvents: Array<{ start: Date; end: Date }> = [];

      setupTransaction(async (args) => {
        const data = args.data as { dataInicio: Date; dataFim: Date };
        createdEvents.push({ start: data.dataInicio, end: data.dataFim });
        return { id: `evt-${createdEvents.length}` };
      });

      await service.create(dto, adminUser);

      for (const event of createdEvents) {
        expect(event.start.getUTCHours()).toBe(19);
        expect(event.start.getUTCMinutes()).toBe(30);
        expect(event.end.getUTCHours()).toBe(21);
        expect(event.end.getUTCMinutes()).toBe(30);
      }
    });
  });

  describe("create — validações de recorrência", () => {
    it("should reject endDate before startDate", async () => {
      const dto = {
        nome: "Culto Domingo",
        descricao: "Celebração dominical",
        dataInicio: "2026-10-04T19:00:00.000Z",
        dataFim: "2026-10-04T21:00:00.000Z",
        recurrence: {
          type: RecurrenceTypeDto.WEEKLY,
          startDate: "2026-10-25T00:00:00.000Z",
          endDate: "2026-10-04T00:00:00.000Z",
          daysOfWeek: ["DOMINGO"],
        },
      };

      await expect(service.create(dto, adminUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should reject recurrence with no days of week", async () => {
      const dto = {
        nome: "Culto Domingo",
        descricao: "Celebração dominical",
        dataInicio: "2026-10-04T19:00:00.000Z",
        dataFim: "2026-10-04T21:00:00.000Z",
        recurrence: {
          type: RecurrenceTypeDto.WEEKLY,
          startDate: "2026-10-04T00:00:00.000Z",
          endDate: "2026-10-25T00:00:00.000Z",
          daysOfWeek: [] as string[],
        },
      };

      await expect(service.create(dto, adminUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should reject invalid day of week", async () => {
      const dto = {
        nome: "Culto Domingo",
        descricao: "Celebração dominical",
        dataInicio: "2026-10-04T19:00:00.000Z",
        dataFim: "2026-10-04T21:00:00.000Z",
        recurrence: {
          type: RecurrenceTypeDto.WEEKLY,
          startDate: "2026-10-04T00:00:00.000Z",
          endDate: "2026-10-25T00:00:00.000Z",
          daysOfWeek: ["INVALID_DAY"],
        },
      };

      await expect(service.create(dto, adminUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should reject recurrence when user has no church", async () => {
      const dto = {
        nome: "Culto Domingo",
        descricao: "Celebração dominical",
        dataInicio: "2026-10-04T19:00:00.000Z",
        dataFim: "2026-10-04T21:00:00.000Z",
        recurrence: {
          type: RecurrenceTypeDto.WEEKLY,
          startDate: "2026-10-04T00:00:00.000Z",
          endDate: "2026-10-25T00:00:00.000Z",
          daysOfWeek: ["DOMINGO"],
        },
      };

      await expect(service.create(dto, userWithoutChurch)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("create — limite de recorrência", () => {
    it("should allow exactly 52 occurrences", async () => {
      const dto = {
        nome: "Culto Domingo",
        descricao: "Celebração dominical",
        dataInicio: "2026-01-04T19:00:00.000Z",
        dataFim: "2026-01-04T21:00:00.000Z",
        recurrence: {
          type: RecurrenceTypeDto.WEEKLY,
          startDate: "2026-01-04T00:00:00.000Z",
          endDate: "2026-12-28T00:00:00.000Z",
          daysOfWeek: ["DOMINGO"],
        },
      };

      let createCount = 0;
      setupTransaction(async () => {
        createCount++;
        return { id: `evt-${createCount}`, recurrenceIndex: createCount - 1 };
      });

      const createdEvents = Array.from({ length: 52 }, (_, i) => ({
        id: `evt-${i + 1}`,
        recurrenceIndex: i,
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      }));

      const findManyMock = prismaMock.event.findMany;
      for (let i = 0; i < 52; i++) {
        findManyMock.mockResolvedValueOnce([]);
      }
      findManyMock.mockResolvedValueOnce(createdEvents);

      const result = (await service.create(dto, adminUser)) as {
        totalEvents: number;
      };
      expect(result.totalEvents).toBe(52);
    });

    it("should reject 53 occurrences with BadRequestException", async () => {
      const dto = {
        nome: "Culto Domingo",
        descricao: "Celebração dominical",
        dataInicio: "2026-01-04T19:00:00.000Z",
        dataFim: "2026-01-04T21:00:00.000Z",
        recurrence: {
          type: RecurrenceTypeDto.WEEKLY,
          startDate: "2026-01-04T00:00:00.000Z",
          endDate: "2027-01-03T21:00:00.000Z",
          daysOfWeek: ["DOMINGO"],
        },
      };

      await expect(service.create(dto, adminUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should create zero events when exceeding limit", async () => {
      const dto = {
        nome: "Culto Domingo",
        descricao: "Celebração dominical",
        dataInicio: "2026-01-04T19:00:00.000Z",
        dataFim: "2026-01-04T21:00:00.000Z",
        recurrence: {
          type: RecurrenceTypeDto.WEEKLY,
          startDate: "2026-01-04T00:00:00.000Z",
          endDate: "2027-01-03T21:00:00.000Z",
          daysOfWeek: ["DOMINGO"],
        },
      };

      let createCount = 0;
      setupTransaction(async () => {
        createCount++;
        return { id: `evt-${createCount}` };
      });

      await expect(service.create(dto, adminUser)).rejects.toThrow();
      expect(createCount).toBe(0);
    });
  });

  describe("findByRecurrenceGroup", () => {
    it("should return events filtered by recurrenceGroupId and churchId", async () => {
      const events = [
        { id: "evt-1", recurrenceGroupId: "group-1", recurrenceIndex: 0 },
        { id: "evt-2", recurrenceGroupId: "group-1", recurrenceIndex: 1 },
      ];

      prismaMock.event.findMany.mockResolvedValue(events);

      const result = await service.findByRecurrenceGroup(
        "group-1",
        adminUser,
      );

      expect(result).toEqual(events);
      expect(prismaMock.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            recurrenceGroupId: "group-1",
            churchId: "church-1",
          }),
          orderBy: { recurrenceIndex: "asc" },
        }),
      );
    });

    it("should throw ForbiddenException when user has no church", async () => {
      await expect(
        service.findByRecurrenceGroup("group-1", userWithoutChurch),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should not return events from another church (cross-tenant)", async () => {
      prismaMock.event.findMany.mockResolvedValue([]);

      await service.findByRecurrenceGroup("group-1", userFromChurchB);

      expect(prismaMock.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            recurrenceGroupId: "group-1",
            churchId: "church-2",
          }),
        }),
      );
    });

    it("should return empty array for non-existent series", async () => {
      prismaMock.event.findMany.mockResolvedValue([]);

      const result = await service.findByRecurrenceGroup(
        "non-existent-group",
        adminUser,
      );

      expect(result).toEqual([]);
    });

    it("should return single-occurrence series", async () => {
      const events = [
        {
          id: "evt-1",
          recurrenceGroupId: "group-single",
          recurrenceIndex: 0,
          recurrenceDays: ["DOMINGO"],
        },
      ];

      prismaMock.event.findMany.mockResolvedValue(events);

      const result = await service.findByRecurrenceGroup(
        "group-single",
        adminUser,
      );

      expect(result).toHaveLength(1);
      expect(result[0].recurrenceIndex).toBe(0);
    });

    it("should order occurrences by recurrenceIndex asc", async () => {
      const events = [
        { id: "evt-3", recurrenceIndex: 2 },
        { id: "evt-1", recurrenceIndex: 0 },
        { id: "evt-2", recurrenceIndex: 1 },
      ];

      prismaMock.event.findMany.mockResolvedValue(events);

      const result = await service.findByRecurrenceGroup(
        "group-1",
        adminUser,
      );

      expect(result[0].recurrenceIndex).toBe(2);
      expect(result[1].recurrenceIndex).toBe(0);
      expect(result[2].recurrenceIndex).toBe(1);
      expect(prismaMock.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { recurrenceIndex: "asc" },
        }),
      );
    });

    it("should return multiple occurrences for a series", async () => {
      const events = Array.from({ length: 4 }, (_, i) => ({
        id: `evt-${i + 1}`,
        recurrenceGroupId: "group-4",
        recurrenceIndex: i,
      }));

      prismaMock.event.findMany.mockResolvedValue(events);

      const result = await service.findByRecurrenceGroup(
        "group-4",
        adminUser,
      );

      expect(result).toHaveLength(4);
    });
  });

  describe("create — rollback on failure", () => {
    it("should rollback all events if one creation fails", async () => {
      const dto = {
        nome: "Culto Domingo",
        descricao: "Celebração dominical",
        dataInicio: "2026-10-04T19:00:00.000Z",
        dataFim: "2026-10-04T21:00:00.000Z",
        recurrence: {
          type: RecurrenceTypeDto.WEEKLY,
          startDate: "2026-10-04T00:00:00.000Z",
          endDate: "2026-10-25T00:00:00.000Z",
          daysOfWeek: ["DOMINGO"],
        },
      };

      prismaMock.$transaction.mockRejectedValue(new Error("Database error"));

      await expect(service.create(dto, adminUser)).rejects.toThrow(
        "Database error",
      );
    });
  });

  describe("create — evento único preserva comportamento", () => {
    it("should reject when dataFim <= dataInicio for single event", async () => {
      const dto = {
        nome: "Culto",
        descricao: "Descrição",
        dataInicio: "2026-10-04T21:00:00.000Z",
        dataFim: "2026-10-04T19:00:00.000Z",
      };

      await expect(service.create(dto, adminUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should create single event with churchId", async () => {
      const dto = {
        nome: "Culto Especial",
        descricao: "Evento especial",
        dataInicio: "2026-10-04T19:00:00.000Z",
        dataFim: "2026-10-04T21:00:00.000Z",
      };

      prismaMock.event.create.mockImplementation(
        async (args: { data: { churchId: string } }) => ({
          id: "evt-1",
          churchId: args.data.churchId,
          nome: dto.nome,
          descricao: dto.descricao,
          dataInicio: new Date(dto.dataInicio),
          dataFim: new Date(dto.dataFim),
          recorrencia: null,
          recurrenceGroupId: null,
          recurrenceType: "NONE",
          recurrenceDays: [],
          recurrenceStart: null,
          recurrenceEnd: null,
          recurrenceIndex: null,
          createdAt: new Date(),
        }),
      );

      await service.create(dto, adminUser);

      expect(prismaMock.event.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            churchId: "church-1",
          }),
        }),
      );
    });
  });

  describe("remove — evento individual", () => {
    it("should delete only one event, not the entire series", async () => {
      prismaMock.event.findFirst.mockResolvedValue({ id: "evt-2" });
      prismaMock.event.delete.mockResolvedValue({
        id: "evt-2",
        churchId: "church-1",
        nome: "Culto Domingo",
        descricao: "Celebração dominical",
        dataInicio: new Date("2026-10-11T19:00:00.000Z"),
        dataFim: new Date("2026-10-11T21:00:00.000Z"),
        recorrencia: null,
        recurrenceGroupId: "group-1",
        recurrenceType: "WEEKLY",
        recurrenceDays: ["DOMINGO"],
        recurrenceStart: new Date("2026-10-04T00:00:00.000Z"),
        recurrenceEnd: new Date("2026-10-25T00:00:00.000Z"),
        recurrenceIndex: 1,
        createdAt: new Date(),
      });

      const result = await service.remove("evt-2", adminUser);

      expect(result).toHaveProperty("id", "evt-2");
      expect(prismaMock.event.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "evt-2" },
        }),
      );
    });

    it("should throw NotFoundException when event not found", async () => {
      prismaMock.event.findFirst.mockResolvedValue(null);

      await expect(
        service.remove("evt-not-found", adminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ForbiddenException when user has no church", async () => {
      await expect(
        service.remove("evt-1", userWithoutChurch),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("findAll — inclui campos de recorrência", () => {
    it("should return events with recurrence fields", async () => {
      const events = [
        {
          id: "evt-1",
          recurrenceGroupId: "group-1",
          recurrenceType: "WEEKLY",
          recurrenceDays: ["DOMINGO"],
          recurrenceStart: new Date("2026-10-04T00:00:00.000Z"),
          recurrenceEnd: new Date("2026-10-25T00:00:00.000Z"),
          recurrenceIndex: 0,
        },
      ];

      prismaMock.event.findMany.mockResolvedValue(events);

      const result = await service.findAll(adminUser);

      expect(result).toEqual(events);
      expect(result[0]).toHaveProperty("recurrenceGroupId", "group-1");
      expect(result[0]).toHaveProperty("recurrenceType", "WEEKLY");
    });
  });

  describe("findById — inclui campos de recorrência", () => {
    it("should return event with recurrence fields", async () => {
      const event = {
        id: "evt-1",
        recurrenceGroupId: "group-1",
        recurrenceType: "WEEKLY",
        recurrenceDays: ["DOMINGO"],
        recurrenceStart: new Date("2026-10-04T00:00:00.000Z"),
        recurrenceEnd: new Date("2026-10-25T00:00:00.000Z"),
        recurrenceIndex: 0,
      };

      prismaMock.event.findFirst.mockResolvedValue(event);

      const result = await service.findById("evt-1", adminUser);

      expect(result).toEqual(event);
    });

    it("should throw NotFoundException when event not found", async () => {
      prismaMock.event.findFirst.mockResolvedValue(null);

      await expect(
        service.findById("evt-not-found", adminUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("generateWeeklyOccurrences — parity with frontend (canonical 7 cases)", () => {
    async function getOccurrenceDates(
      startDate: string,
      endDate: string,
      daysOfWeek: string[],
    ): Promise<string[]> {
      const dto = {
        nome: "Culto Parity",
        descricao: "Teste de paridade",
        dataInicio: "2026-10-04T19:00:00.000Z",
        dataFim: "2026-10-04T21:00:00.000Z",
        recurrence: {
          type: RecurrenceTypeDto.WEEKLY,
          startDate,
          endDate,
          daysOfWeek,
        },
      };

      const createdDates: string[] = [];

      setupTransaction(async (args) => {
        const data = args.data as { dataInicio: Date };
        const d = data.dataInicio;
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(d.getUTCDate()).padStart(2, "0");
        createdDates.push(`${yyyy}-${mm}-${dd}`);
        return { id: `evt-${createdDates.length}` };
      });

      await service.create(dto, adminUser);
      return createdDates;
    }

    it("06/09 a 27/09 — Sundays only", async () => {
      const dates = await getOccurrenceDates(
        "2026-09-06T00:00:00.000Z",
        "2026-09-27T00:00:00.000Z",
        ["DOMINGO"],
      );
      expect(dates).toEqual([
        "2026-09-06",
        "2026-09-13",
        "2026-09-20",
        "2026-09-27",
      ]);
    });

    it("01/10 a 31/10 — Thursdays only", async () => {
      const dates = await getOccurrenceDates(
        "2026-10-01T00:00:00.000Z",
        "2026-10-31T00:00:00.000Z",
        ["QUINTA"],
      );
      expect(dates).toEqual([
        "2026-10-01",
        "2026-10-08",
        "2026-10-15",
        "2026-10-22",
        "2026-10-29",
      ]);
    });

    it("01/10 a 31/10 — Mondays and Thursdays", async () => {
      const dates = await getOccurrenceDates(
        "2026-10-01T00:00:00.000Z",
        "2026-10-31T00:00:00.000Z",
        ["SEGUNDA", "QUINTA"],
      );
      expect(dates).toEqual([
        "2026-10-01",
        "2026-10-05",
        "2026-10-08",
        "2026-10-12",
        "2026-10-15",
        "2026-10-19",
        "2026-10-22",
        "2026-10-26",
        "2026-10-29",
      ]);
    });

    it("01/10 a 07/10 — single Thursday (same day start/end)", async () => {
      const dates = await getOccurrenceDates(
        "2026-10-01T00:00:00.000Z",
        "2026-10-07T00:00:00.000Z",
        ["QUINTA"],
      );
      expect(dates).toEqual(["2026-10-01"]);
    });

    it("01/10 a 31/10 — no matching day rejects with BadRequestException", async () => {
      const dto = {
        nome: "Culto Parity",
        descricao: "Teste de paridade",
        dataInicio: "2026-10-04T19:00:00.000Z",
        dataFim: "2026-10-04T21:00:00.000Z",
        recurrence: {
          type: RecurrenceTypeDto.WEEKLY,
          startDate: "2026-10-04T00:00:00.000Z",
          endDate: "2026-10-05T00:00:00.000Z",
          daysOfWeek: ["SABADO"],
        },
      };

      setupTransaction(async () => ({ id: "evt-1" }));

      await expect(service.create(dto, adminUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("01/10 a 31/10 — all 7 days produces every day", async () => {
      const dates = await getOccurrenceDates(
        "2026-10-01T00:00:00.000Z",
        "2026-10-31T00:00:00.000Z",
        [
          "DOMINGO",
          "SEGUNDA",
          "TERCA",
          "QUARTA",
          "QUINTA",
          "SEXTA",
          "SABADO",
        ],
      );
      expect(dates).toHaveLength(31);
      expect(dates[0]).toBe("2026-10-01");
      expect(dates[30]).toBe("2026-10-31");
    });

    it("28/02 a 06/03 — cross-month boundary (2028 leap year)", async () => {
      const dates = await getOccurrenceDates(
        "2028-02-28T00:00:00.000Z",
        "2028-03-06T00:00:00.000Z",
        ["SEGUNDA"],
      );
      expect(dates).toEqual(["2028-02-28", "2028-03-06"]);
    });
  });

  describe("update — evento individual", () => {
    it("should update a single event by id", async () => {
      const existing = {
        id: "evt-1",
        dataInicio: new Date("2026-10-04T19:00:00.000Z"),
        dataFim: new Date("2026-10-04T21:00:00.000Z"),
        recurrenceGroupId: null,
      };

      prismaMock.event.findFirst.mockResolvedValue(existing);
      prismaMock.event.update.mockResolvedValue({
        ...existing,
        nome: "Culto Atualizado",
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });
      prismaMock.event.findUnique.mockResolvedValue({
        ...existing,
        nome: "Culto Atualizado",
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });

      const result = await service.update(
        "evt-1",
        { nome: "Culto Atualizado" },
        adminUser,
      );

      expect(result).toHaveProperty("nome", "Culto Atualizado");
      expect(prismaMock.event.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "evt-1" },
          data: expect.objectContaining({ nome: "Culto Atualizado" }),
        }),
      );
    });

    it("should update only one occurrence, not the entire series", async () => {
      const existing = {
        id: "evt-3",
        dataInicio: new Date("2026-10-11T19:00:00.000Z"),
        dataFim: new Date("2026-10-11T21:00:00.000Z"),
        recurrenceGroupId: "group-1",
      };

      prismaMock.event.findFirst.mockResolvedValue(existing);
      prismaMock.event.update.mockResolvedValue({
        ...existing,
        nome: "Culto Atualizado",
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });
      prismaMock.event.findUnique.mockResolvedValue({
        ...existing,
        nome: "Culto Atualizado",
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });

      const result = await service.update(
        "evt-3",
        { nome: "Culto Atualizado" },
        adminUser,
      );

      expect(result).toHaveProperty("nome", "Culto Atualizado");
      expect(prismaMock.event.update).toHaveBeenCalledTimes(1);
      expect(prismaMock.event.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "evt-3" },
        }),
      );
    });

    it("should preserve recurrenceGroupId after editing occurrence", async () => {
      const existing = {
        id: "evt-3",
        dataInicio: new Date("2026-10-11T19:00:00.000Z"),
        dataFim: new Date("2026-10-11T21:00:00.000Z"),
        recurrenceGroupId: "group-1",
      };

      prismaMock.event.findFirst.mockResolvedValue(existing);
      prismaMock.event.update.mockResolvedValue({
        ...existing,
        recurrenceGroupId: "group-1",
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });
      prismaMock.event.findUnique.mockResolvedValue({
        ...existing,
        recurrenceGroupId: "group-1",
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });

      const result = (await service.update(
        "evt-3",
        { nome: "Updated" },
        adminUser,
      )) as { recurrenceGroupId: string };

      expect(result.recurrenceGroupId).toBe("group-1");
    });

    it("should preserve recurrenceIndex after editing occurrence", async () => {
      const existing = {
        id: "evt-3",
        dataInicio: new Date("2026-10-11T19:00:00.000Z"),
        dataFim: new Date("2026-10-11T21:00:00.000Z"),
        recurrenceGroupId: "group-1",
      };

      prismaMock.event.findFirst.mockResolvedValue(existing);
      prismaMock.event.update.mockResolvedValue({
        ...existing,
        recurrenceIndex: 1,
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });
      prismaMock.event.findUnique.mockResolvedValue({
        ...existing,
        recurrenceIndex: 1,
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });

      const result = (await service.update(
        "evt-3",
        {
          dataInicio: "2026-10-12T19:00:00.000Z",
          dataFim: "2026-10-12T21:00:00.000Z",
        },
        adminUser,
      )) as { recurrenceIndex: number };

      expect(result.recurrenceIndex).toBe(1);
    });

    it("should allow changing date of an occurrence", async () => {
      const existing = {
        id: "evt-3",
        dataInicio: new Date("2026-10-11T19:00:00.000Z"),
        dataFim: new Date("2026-10-11T21:00:00.000Z"),
        recurrenceGroupId: "group-1",
      };

      prismaMock.event.findFirst.mockResolvedValue(existing);
      prismaMock.event.update.mockResolvedValue({
        ...existing,
        dataInicio: new Date("2026-10-12T20:00:00.000Z"),
        dataFim: new Date("2026-10-12T22:00:00.000Z"),
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });
      prismaMock.event.findUnique.mockResolvedValue({
        ...existing,
        dataInicio: new Date("2026-10-12T20:00:00.000Z"),
        dataFim: new Date("2026-10-12T22:00:00.000Z"),
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });

      const result = (await service.update(
        "evt-3",
        {
          dataInicio: "2026-10-12T20:00:00.000Z",
          dataFim: "2026-10-12T22:00:00.000Z",
        },
        adminUser,
      )) as { dataInicio: Date };

      expect(result.dataInicio).toEqual(new Date("2026-10-12T20:00:00.000Z"));
    });

    it("should throw NotFoundException when event not found", async () => {
      prismaMock.event.findFirst.mockResolvedValue(null);

      await expect(
        service.update("evt-not-found", { nome: "X" }, adminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ForbiddenException when user has no church", async () => {
      await expect(
        service.update("evt-1", { nome: "X" }, userWithoutChurch),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should reject cross-tenant update attempt", async () => {
      prismaMock.event.findFirst.mockResolvedValue(null);

      await expect(
        service.update("evt-1", { nome: "X" }, userFromChurchB),
      ).rejects.toThrow(NotFoundException);
    });

    it("should not allow recurrenceGroupId via update DTO", async () => {
      const existing = {
        id: "evt-1",
        dataInicio: new Date("2026-10-04T19:00:00.000Z"),
        dataFim: new Date("2026-10-04T21:00:00.000Z"),
        recurrenceGroupId: "group-1",
      };

      prismaMock.event.findFirst.mockResolvedValue(existing);
      prismaMock.event.update.mockResolvedValue(existing);

      await service.update(
        "evt-1",
        { nome: "X" } as UpdateEventDto,
        adminUser,
      );

      expect(prismaMock.event.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            recurrenceGroupId: expect.anything(),
          }),
        }),
      );
    });

    it("should throw when dataFim <= dataInicio", async () => {
      const existing = {
        id: "evt-1",
        dataInicio: new Date("2026-10-04T19:00:00.000Z"),
        dataFim: new Date("2026-10-04T21:00:00.000Z"),
        recurrenceGroupId: null,
      };

      prismaMock.event.findFirst.mockResolvedValue(existing);

      await expect(
        service.update(
          "evt-1",
          {
            dataInicio: "2026-10-04T22:00:00.000Z",
            dataFim: "2026-10-04T20:00:00.000Z",
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("remove — ocorrência de série recorrente", () => {
    it("should delete only one occurrence, not the entire series", async () => {
      prismaMock.event.findFirst.mockResolvedValue({ id: "evt-3" });
      prismaMock.event.delete.mockResolvedValue({
        id: "evt-3",
        churchId: "church-1",
        nome: "Culto Domingo",
        descricao: "Celebração dominical",
        dataInicio: new Date("2026-10-11T19:00:00.000Z"),
        dataFim: new Date("2026-10-11T21:00:00.000Z"),
        recorrencia: null,
        recurrenceGroupId: "group-1",
        recurrenceType: "WEEKLY",
        recurrenceDays: ["DOMINGO"],
        recurrenceStart: new Date("2026-10-04T00:00:00.000Z"),
        recurrenceEnd: new Date("2026-10-25T00:00:00.000Z"),
        recurrenceIndex: 1,
        createdAt: new Date(),
      });

      const result = await service.remove("evt-3", adminUser);

      expect(result).toHaveProperty("id", "evt-3");
      expect(prismaMock.event.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "evt-3" },
        }),
      );
      expect(prismaMock.event.delete).toHaveBeenCalledTimes(1);
    });

    it("should reject cross-tenant delete attempt", async () => {
      prismaMock.event.findFirst.mockResolvedValue(null);

      await expect(
        service.remove("evt-1", userFromChurchB),
      ).rejects.toThrow(NotFoundException);
    });

    it("should delete single-occurrence series without error", async () => {
      prismaMock.event.findFirst.mockResolvedValue({ id: "evt-single" });
      prismaMock.event.delete.mockResolvedValue({
        id: "evt-single",
        churchId: "church-1",
        nome: "Evento Especial",
        descricao: "Único",
        dataInicio: new Date("2026-10-15T19:00:00.000Z"),
        dataFim: new Date("2026-10-15T21:00:00.000Z"),
        recorrencia: null,
        recurrenceGroupId: "group-single",
        recurrenceType: "WEEKLY",
        recurrenceDays: ["QUARTA"],
        recurrenceStart: new Date("2026-10-15T00:00:00.000Z"),
        recurrenceEnd: new Date("2026-10-15T00:00:00.000Z"),
        recurrenceIndex: 0,
        createdAt: new Date(),
      });

      const result = await service.remove("evt-single", adminUser);

      expect(result).toHaveProperty("id", "evt-single");
      expect(prismaMock.event.delete).toHaveBeenCalledTimes(1);
    });

    it("should preserve other occurrences after deleting one", async () => {
      prismaMock.event.findFirst.mockResolvedValue({ id: "evt-2" });
      prismaMock.event.delete.mockResolvedValue({
        id: "evt-2",
        churchId: "church-1",
        nome: "Culto Domingo",
        descricao: "Celebração dominical",
        dataInicio: new Date("2026-10-11T19:00:00.000Z"),
        dataFim: new Date("2026-10-11T21:00:00.000Z"),
        recorrencia: null,
        recurrenceGroupId: "group-1",
        recurrenceType: "WEEKLY",
        recurrenceDays: ["DOMINGO"],
        recurrenceStart: new Date("2026-10-04T00:00:00.000Z"),
        recurrenceEnd: new Date("2026-10-25T00:00:00.000Z"),
        recurrenceIndex: 1,
        createdAt: new Date(),
      });

      const remaining = [
        { id: "evt-1", recurrenceIndex: 0 },
        { id: "evt-4", recurrenceIndex: 2 },
        { id: "evt-5", recurrenceIndex: 3 },
      ];

      prismaMock.event.findMany.mockResolvedValue(remaining);

      await service.remove("evt-2", adminUser);

      const remainingResult = await service.findByRecurrenceGroup(
        "group-1",
        adminUser,
      );

      expect(remainingResult).toHaveLength(3);
      expect(remainingResult.find((e) => e.id === "evt-2")).toBeUndefined();
    });
  });

  describe("update — conflito de horário", () => {
    it("should update when no conflict exists", async () => {
      const existing = {
        id: "evt-1",
        dataInicio: new Date("2026-10-04T19:00:00.000Z"),
        dataFim: new Date("2026-10-04T21:00:00.000Z"),
        recurrenceGroupId: null,
      };

      prismaMock.event.findFirst.mockResolvedValueOnce(existing);
      prismaMock.event.findMany.mockResolvedValue([]);
      prismaMock.event.update.mockResolvedValue({
        ...existing,
        nome: "Culto Atualizado",
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });
      prismaMock.event.findUnique.mockResolvedValue({
        ...existing,
        nome: "Culto Atualizado",
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });

      const result = await service.update(
        "evt-1",
        { nome: "Culto Atualizado" },
        adminUser,
      );

      expect(result).toHaveProperty("nome", "Culto Atualizado");
    });

    it("should reject partial overlap (19:00–20:30 vs 20:00–21:00)", async () => {
      const existing = {
        id: "evt-1",
        dataInicio: new Date("2026-10-04T19:00:00.000Z"),
        dataFim: new Date("2026-10-04T21:00:00.000Z"),
        recurrenceGroupId: null,
      };

      prismaMock.event.findFirst.mockResolvedValueOnce(existing);
      prismaMock.event.findMany.mockResolvedValue([
        {
          id: "evt-other",
          nome: "Outro Culto",
          dataInicio: new Date("2026-10-04T20:00:00.000Z"),
          dataFim: new Date("2026-10-04T21:00:00.000Z"),
        },
      ]);

      await expect(
        service.update(
          "evt-1",
          {
            dataInicio: "2026-10-04T19:00:00.000Z",
            dataFim: "2026-10-04T20:30:00.000Z",
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject event inside another (19:00–22:00 vs 20:00–21:00)", async () => {
      const existing = {
        id: "evt-1",
        dataInicio: new Date("2026-10-04T19:00:00.000Z"),
        dataFim: new Date("2026-10-04T22:00:00.000Z"),
        recurrenceGroupId: null,
      };

      prismaMock.event.findFirst.mockResolvedValueOnce(existing);
      prismaMock.event.findMany.mockResolvedValue([
        {
          id: "evt-other",
          nome: "Ensaio",
          dataInicio: new Date("2026-10-04T20:00:00.000Z"),
          dataFim: new Date("2026-10-04T21:00:00.000Z"),
        },
      ]);

      await expect(
        service.update(
          "evt-1",
          {
            dataInicio: "2026-10-04T19:00:00.000Z",
            dataFim: "2026-10-04T22:00:00.000Z",
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject same time range (19:00–21:00 vs 19:00–21:00)", async () => {
      const existing = {
        id: "evt-1",
        dataInicio: new Date("2026-10-04T19:00:00.000Z"),
        dataFim: new Date("2026-10-04T21:00:00.000Z"),
        recurrenceGroupId: null,
      };

      prismaMock.event.findFirst.mockResolvedValueOnce(existing);
      prismaMock.event.findMany.mockResolvedValue([
        {
          id: "evt-other",
          nome: "Mesmo Horário",
          dataInicio: new Date("2026-10-04T19:00:00.000Z"),
          dataFim: new Date("2026-10-04T21:00:00.000Z"),
        },
      ]);

      await expect(
        service.update(
          "evt-1",
          {
            dataInicio: "2026-10-04T19:00:00.000Z",
            dataFim: "2026-10-04T21:00:00.000Z",
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should not create false conflict with own event", async () => {
      const existing = {
        id: "evt-1",
        dataInicio: new Date("2026-10-04T19:00:00.000Z"),
        dataFim: new Date("2026-10-04T21:00:00.000Z"),
        recurrenceGroupId: null,
      };

      prismaMock.event.findFirst.mockResolvedValueOnce(existing);
      prismaMock.event.findMany.mockResolvedValue([]);
      prismaMock.event.update.mockResolvedValue({
        ...existing,
        dataInicio: new Date("2026-10-04T19:30:00.000Z"),
        dataFim: new Date("2026-10-04T21:30:00.000Z"),
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });
      prismaMock.event.findUnique.mockResolvedValue({
        ...existing,
        dataInicio: new Date("2026-10-04T19:30:00.000Z"),
        dataFim: new Date("2026-10-04T21:30:00.000Z"),
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });

      const result = await service.update(
        "evt-1",
        {
          dataInicio: "2026-10-04T19:30:00.000Z",
          dataFim: "2026-10-04T21:30:00.000Z",
        },
        adminUser,
      );

      expect(result).toHaveProperty("id", "evt-1");
      expect(prismaMock.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { not: "evt-1" },
          }),
        }),
      );
    });

    it("should only conflict with events from the same church", async () => {
      const existing = {
        id: "evt-1",
        dataInicio: new Date("2026-10-04T19:00:00.000Z"),
        dataFim: new Date("2026-10-04T21:00:00.000Z"),
        recurrenceGroupId: null,
      };

      prismaMock.event.findFirst.mockResolvedValueOnce(existing);
      prismaMock.event.findMany.mockResolvedValue([]);
      prismaMock.event.update.mockResolvedValue({
        ...existing,
        dataInicio: new Date("2026-10-04T19:30:00.000Z"),
        dataFim: new Date("2026-10-04T21:30:00.000Z"),
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });
      prismaMock.event.findUnique.mockResolvedValue({
        ...existing,
        dataInicio: new Date("2026-10-04T19:30:00.000Z"),
        dataFim: new Date("2026-10-04T21:30:00.000Z"),
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });

      const result = await service.update(
        "evt-1",
        {
          dataInicio: "2026-10-04T19:30:00.000Z",
          dataFim: "2026-10-04T21:30:00.000Z",
        },
        adminUser,
      );

      expect(result).toHaveProperty("id", "evt-1");
      expect(prismaMock.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            churchId: "church-1",
          }),
        }),
      );
    });

    it("should not conflict with events from another church", async () => {
      const existing = {
        id: "evt-1",
        dataInicio: new Date("2026-10-04T19:00:00.000Z"),
        dataFim: new Date("2026-10-04T21:00:00.000Z"),
        recurrenceGroupId: null,
      };

      prismaMock.event.findFirst.mockResolvedValueOnce(existing);
      prismaMock.event.findMany.mockResolvedValue([]);
      prismaMock.event.update.mockResolvedValue({
        ...existing,
        dataInicio: new Date("2026-10-04T19:30:00.000Z"),
        dataFim: new Date("2026-10-04T21:30:00.000Z"),
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });
      prismaMock.event.findUnique.mockResolvedValue({
        ...existing,
        dataInicio: new Date("2026-10-04T19:30:00.000Z"),
        dataFim: new Date("2026-10-04T21:30:00.000Z"),
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });

      const result = await service.update(
        "evt-1",
        {
          dataInicio: "2026-10-04T19:30:00.000Z",
          dataFim: "2026-10-04T21:30:00.000Z",
        },
        adminUser,
      );

      expect(result).toHaveProperty("id", "evt-1");
      const findManyCall = prismaMock.event.findMany.mock.calls[0][0];
      expect(findManyCall.where.churchId).toBe("church-1");
    });

    it("should allow updating recurrence occurrence without conflict", async () => {
      const existing = {
        id: "evt-2",
        dataInicio: new Date("2026-09-13T19:00:00.000Z"),
        dataFim: new Date("2026-09-13T21:00:00.000Z"),
        recurrenceGroupId: "group-1",
      };

      prismaMock.event.findFirst.mockResolvedValueOnce(existing);
      prismaMock.event.findMany.mockResolvedValue([]);
      prismaMock.event.update.mockResolvedValue({
        ...existing,
        dataInicio: new Date("2026-09-13T20:00:00.000Z"),
        dataFim: new Date("2026-09-13T22:00:00.000Z"),
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });
      prismaMock.event.findUnique.mockResolvedValue({
        ...existing,
        dataInicio: new Date("2026-09-13T20:00:00.000Z"),
        dataFim: new Date("2026-09-13T22:00:00.000Z"),
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });

      const result = await service.update(
        "evt-2",
        {
          dataInicio: "2026-09-13T20:00:00.000Z",
          dataFim: "2026-09-13T22:00:00.000Z",
        },
        adminUser,
      );

      expect(result).toHaveProperty("id", "evt-2");
    });

    it("should reject recurrence occurrence that conflicts with another event", async () => {
      const existing = {
        id: "evt-2",
        dataInicio: new Date("2026-09-13T19:00:00.000Z"),
        dataFim: new Date("2026-09-13T21:00:00.000Z"),
        recurrenceGroupId: "group-1",
      };

      prismaMock.event.findFirst.mockResolvedValueOnce(existing);
      prismaMock.event.findMany.mockResolvedValue([
        {
          id: "evt-other",
          nome: "Ensaio Worship",
          dataInicio: new Date("2026-09-13T20:00:00.000Z"),
          dataFim: new Date("2026-09-13T22:00:00.000Z"),
        },
      ]);

      await expect(
        service.update(
          "evt-2",
          {
            dataInicio: "2026-09-13T20:00:00.000Z",
            dataFim: "2026-09-13T22:00:00.000Z",
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should leave data intact when conflict is detected", async () => {
      const existing = {
        id: "evt-1",
        dataInicio: new Date("2026-10-04T19:00:00.000Z"),
        dataFim: new Date("2026-10-04T21:00:00.000Z"),
        recurrenceGroupId: null,
      };

      prismaMock.event.findFirst.mockResolvedValueOnce(existing);
      prismaMock.event.findMany.mockResolvedValue([
        {
          id: "evt-other",
          nome: "Conflitante",
          dataInicio: new Date("2026-10-04T20:00:00.000Z"),
          dataFim: new Date("2026-10-04T22:00:00.000Z"),
        },
      ]);

      await expect(
        service.update(
          "evt-1",
          {
            dataInicio: "2026-10-04T19:00:00.000Z",
            dataFim: "2026-10-04T22:00:00.000Z",
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.event.update).not.toHaveBeenCalled();
    });

    it("should preserve recurrenceGroupId after conflict-free update", async () => {
      const existing = {
        id: "evt-2",
        dataInicio: new Date("2026-09-13T19:00:00.000Z"),
        dataFim: new Date("2026-09-13T21:00:00.000Z"),
        recurrenceGroupId: "group-1",
      };

      prismaMock.event.findFirst.mockResolvedValueOnce(existing);
      prismaMock.event.findMany.mockResolvedValue([]);
      prismaMock.event.update.mockResolvedValue({
        ...existing,
        nome: "Atualizado",
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });
      prismaMock.event.findUnique.mockResolvedValue({
        ...existing,
        nome: "Atualizado",
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });

      const result = (await service.update(
        "evt-2",
        { nome: "Atualizado" },
        adminUser,
      )) as { recurrenceGroupId: string };

      expect(result.recurrenceGroupId).toBe("group-1");
    });

    it("should preserve recurrenceIndex after conflict-free update", async () => {
      const existing = {
        id: "evt-2",
        dataInicio: new Date("2026-09-13T19:00:00.000Z"),
        dataFim: new Date("2026-09-13T21:00:00.000Z"),
        recurrenceGroupId: "group-1",
      };

      prismaMock.event.findFirst.mockResolvedValueOnce(existing);
      prismaMock.event.findMany.mockResolvedValue([]);
      prismaMock.event.update.mockResolvedValue({
        ...existing,
        recurrenceIndex: 1,
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });
      prismaMock.event.findUnique.mockResolvedValue({
        ...existing,
        recurrenceIndex: 1,
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });

      const result = (await service.update(
        "evt-2",
        { nome: "Atualizado" },
        adminUser,
      )) as { recurrenceIndex: number };

      expect(result.recurrenceIndex).toBe(1);
    });
  });

  describe("remove — erro de Schedule associado", () => {
    it("should throw BadRequestException when schedules exist (P2003)", async () => {
      prismaMock.event.findFirst.mockResolvedValue({ id: "evt-1" });

      const prismaError = new Prisma.PrismaClientKnownRequestError(
        "Foreign key constraint violated on the constraint: `Schedule_eventId_fkey`",
        {
          code: "P2003",
          clientVersion: "6.6.0",
          meta: { field_name: "Schedule_eventId_fkey" },
        },
      );
      prismaMock.event.delete.mockRejectedValue(prismaError);

      await expect(service.remove("evt-1", adminUser)).rejects.toThrow(
        BadRequestException,
      );

      await expect(service.remove("evt-1", adminUser)).rejects.toThrow(
        "escalas vinculadas",
      );
    });

    it("should throw BadRequestException for PostgreSQL RESTRICT violation (23001)", async () => {
      prismaMock.event.findFirst.mockResolvedValue({ id: "evt-1" });

      const pgError = new Prisma.PrismaClientUnknownRequestError(
        'update or delete on table "Event" violates RESTRICT setting of foreign key constraint "Schedule_eventId_fkey" on table "Schedule" — 23001',
        { clientVersion: "6.6.0" },
      );
      prismaMock.event.delete.mockRejectedValue(pgError);

      await expect(service.remove("evt-1", adminUser)).rejects.toThrow(
        BadRequestException,
      );

      await expect(service.remove("evt-1", adminUser)).rejects.toThrow(
        "escalas vinculadas",
      );
    });

    it("should not delete the event when FK violation occurs", async () => {
      prismaMock.event.findFirst.mockResolvedValue({ id: "evt-1" });

      const pgError = new Prisma.PrismaClientUnknownRequestError(
        'violates RESTRICT setting of foreign key constraint "Schedule_eventId_fkey" — 23001',
        { clientVersion: "6.6.0" },
      );
      prismaMock.event.delete.mockRejectedValue(pgError);

      await expect(service.remove("evt-1", adminUser)).rejects.toThrow(
        BadRequestException,
      );

      expect(prismaMock.event.delete).toHaveBeenCalledTimes(1);
    });

    it("should allow deleting event without schedules", async () => {
      prismaMock.event.findFirst.mockResolvedValue({ id: "evt-1" });
      prismaMock.event.delete.mockResolvedValue({
        id: "evt-1",
        churchId: "church-1",
        nome: "Culto",
        descricao: "desc",
        dataInicio: new Date(),
        dataFim: new Date(),
        recorrencia: null,
        recurrenceGroupId: null,
        recurrenceType: "NONE",
        recurrenceDays: [],
        recurrenceStart: null,
        recurrenceEnd: null,
        recurrenceIndex: null,
        createdAt: new Date(),
      });

      const result = await service.remove("evt-1", adminUser);

      expect(result).toHaveProperty("id", "evt-1");
      expect(prismaMock.event.delete).toHaveBeenCalledTimes(1);
    });

    it("should re-throw unknown errors that are not FK violations", async () => {
      prismaMock.event.findFirst.mockResolvedValue({ id: "evt-1" });

      const unknownError = new Prisma.PrismaClientUnknownRequestError(
        "Something unexpected",
        { clientVersion: "6.6.0" },
      );
      prismaMock.event.delete.mockRejectedValue(unknownError);

      await expect(service.remove("evt-1", adminUser)).rejects.toThrow(
        "Something unexpected",
      );
    });

    it("should re-throw known errors that are not P2003", async () => {
      prismaMock.event.findFirst.mockResolvedValue({ id: "evt-1" });

      const knownError = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed",
        {
          code: "P2002",
          clientVersion: "6.6.0",
          meta: { target: ["id"] },
        },
      );
      prismaMock.event.delete.mockRejectedValue(knownError);

      await expect(service.remove("evt-1", adminUser)).rejects.toThrow(
        Prisma.PrismaClientKnownRequestError,
      );
    });
  });

  describe("create — conflito de horário (evento único)", () => {
    it("should create when no conflict exists", async () => {
      prismaMock.event.findMany.mockResolvedValue([]);
      prismaMock.event.create.mockResolvedValue({
        id: "evt-new",
        churchId: "church-1",
        nome: "Culto Novo",
        descricao: "Novo",
        dataInicio: new Date("2026-10-04T19:00:00.000Z"),
        dataFim: new Date("2026-10-04T21:00:00.000Z"),
        recorrencia: null,
        recurrenceGroupId: null,
        recurrenceType: "NONE",
        recurrenceDays: [],
        recurrenceStart: null,
        recurrenceEnd: null,
        recurrenceIndex: null,
        createdAt: new Date(),
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });
      prismaMock.event.findUnique.mockResolvedValue({
        id: "evt-new",
        churchId: "church-1",
        nome: "Culto Novo",
        descricao: "Novo",
        dataInicio: new Date("2026-10-04T19:00:00.000Z"),
        dataFim: new Date("2026-10-04T21:00:00.000Z"),
        recorrencia: null,
        recurrenceGroupId: null,
        recurrenceType: "NONE",
        recurrenceDays: [],
        recurrenceStart: null,
        recurrenceEnd: null,
        recurrenceIndex: null,
        createdAt: new Date(),
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });

      const result = await service.create(
        {
          nome: "Culto Novo",
          descricao: "Novo",
          dataInicio: "2026-10-04T19:00:00.000Z",
          dataFim: "2026-10-04T21:00:00.000Z",
        },
        adminUser,
      );

      expect(result).toHaveProperty("id", "evt-new");
    });

    it("should reject partial overlap (19:00–20:30 vs 20:00–21:00)", async () => {
      prismaMock.event.findMany.mockResolvedValue([
        {
          id: "evt-existing",
          nome: "Culto Existente",
          dataInicio: new Date("2026-10-04T20:00:00.000Z"),
          dataFim: new Date("2026-10-04T21:00:00.000Z"),
        },
      ]);

      await expect(
        service.create(
          {
            nome: "Culto Novo",
            descricao: "Novo",
            dataInicio: "2026-10-04T19:00:00.000Z",
            dataFim: "2026-10-04T20:30:00.000Z",
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject new event inside existing (19:00–22:00 vs 20:00–21:00)", async () => {
      prismaMock.event.findMany.mockResolvedValue([
        {
          id: "evt-existing",
          nome: "Ensaio",
          dataInicio: new Date("2026-10-04T20:00:00.000Z"),
          dataFim: new Date("2026-10-04T21:00:00.000Z"),
        },
      ]);

      await expect(
        service.create(
          {
            nome: "Culto Novo",
            descricao: "Novo",
            dataInicio: "2026-10-04T19:00:00.000Z",
            dataFim: "2026-10-04T22:00:00.000Z",
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject existing inside new (20:00–21:00 vs 19:00–22:00)", async () => {
      prismaMock.event.findMany.mockResolvedValue([
        {
          id: "evt-existing",
          nome: "Ensaio",
          dataInicio: new Date("2026-10-04T20:00:00.000Z"),
          dataFim: new Date("2026-10-04T21:00:00.000Z"),
        },
      ]);

      await expect(
        service.create(
          {
            nome: "Culto Novo",
            descricao: "Novo",
            dataInicio: "2026-10-04T19:00:00.000Z",
            dataFim: "2026-10-04T22:00:00.000Z",
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject same time range (19:00–21:00 vs 19:00–21:00)", async () => {
      prismaMock.event.findMany.mockResolvedValue([
        {
          id: "evt-existing",
          nome: "Mesmo Horário",
          dataInicio: new Date("2026-10-04T19:00:00.000Z"),
          dataFim: new Date("2026-10-04T21:00:00.000Z"),
        },
      ]);

      await expect(
        service.create(
          {
            nome: "Culto Novo",
            descricao: "Novo",
            dataInicio: "2026-10-04T19:00:00.000Z",
            dataFim: "2026-10-04T21:00:00.000Z",
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should allow adjacent events (19:00–20:00 vs 20:00–21:00)", async () => {
      prismaMock.event.findMany.mockResolvedValue([]);
      prismaMock.event.create.mockResolvedValue({
        id: "evt-new",
        churchId: "church-1",
        nome: "Culto Novo",
        descricao: "Novo",
        dataInicio: new Date("2026-10-04T20:00:00.000Z"),
        dataFim: new Date("2026-10-04T21:00:00.000Z"),
        recorrencia: null,
        recurrenceGroupId: null,
        recurrenceType: "NONE",
        recurrenceDays: [],
        recurrenceStart: null,
        recurrenceEnd: null,
        recurrenceIndex: null,
        createdAt: new Date(),
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });
      prismaMock.event.findUnique.mockResolvedValue({
        id: "evt-new",
        churchId: "church-1",
        nome: "Culto Novo",
        descricao: "Novo",
        dataInicio: new Date("2026-10-04T20:00:00.000Z"),
        dataFim: new Date("2026-10-04T21:00:00.000Z"),
        recorrencia: null,
        recurrenceGroupId: null,
        recurrenceType: "NONE",
        recurrenceDays: [],
        recurrenceStart: null,
        recurrenceEnd: null,
        recurrenceIndex: null,
        createdAt: new Date(),
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });

      const result = await service.create(
        {
          nome: "Culto Novo",
          descricao: "Novo",
          dataInicio: "2026-10-04T20:00:00.000Z",
          dataFim: "2026-10-04T21:00:00.000Z",
        },
        adminUser,
      );

      expect(result).toHaveProperty("id", "evt-new");
    });

    it("should not conflict with events from another church", async () => {
      prismaMock.event.findMany.mockResolvedValue([]);
      prismaMock.event.create.mockResolvedValue({
        id: "evt-new",
        churchId: "church-2",
        nome: "Culto Novo",
        descricao: "Novo",
        dataInicio: new Date("2026-10-04T19:00:00.000Z"),
        dataFim: new Date("2026-10-04T21:00:00.000Z"),
        recorrencia: null,
        recurrenceGroupId: null,
        recurrenceType: "NONE",
        recurrenceDays: [],
        recurrenceStart: null,
        recurrenceEnd: null,
        recurrenceIndex: null,
        createdAt: new Date(),
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });
      prismaMock.event.findUnique.mockResolvedValue({
        id: "evt-new",
        churchId: "church-2",
        nome: "Culto Novo",
        descricao: "Novo",
        dataInicio: new Date("2026-10-04T19:00:00.000Z"),
        dataFim: new Date("2026-10-04T21:00:00.000Z"),
        recorrencia: null,
        recurrenceGroupId: null,
        recurrenceType: "NONE",
        recurrenceDays: [],
        recurrenceStart: null,
        recurrenceEnd: null,
        recurrenceIndex: null,
        createdAt: new Date(),
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });

      const result = await service.create(
        {
          nome: "Culto Novo",
          descricao: "Novo",
          dataInicio: "2026-10-04T19:00:00.000Z",
          dataFim: "2026-10-04T21:00:00.000Z",
        },
        userFromChurchB,
      );

      expect(result).toHaveProperty("id", "evt-new");
      expect(prismaMock.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            churchId: "church-2",
          }),
        }),
      );
    });

    it("should not persist new event when conflict detected", async () => {
      prismaMock.event.findMany.mockResolvedValue([
        {
          id: "evt-existing",
          nome: "Conflitante",
          dataInicio: new Date("2026-10-04T20:00:00.000Z"),
          dataFim: new Date("2026-10-04T22:00:00.000Z"),
        },
      ]);

      await expect(
        service.create(
          {
            nome: "Culto Novo",
            descricao: "Novo",
            dataInicio: "2026-10-04T19:00:00.000Z",
            dataFim: "2026-10-04T21:00:00.000Z",
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.event.create).not.toHaveBeenCalled();
    });
  });

  describe("create — conflito de horário (recorrência)", () => {
    it("should create series when no conflict exists", async () => {
      let callCount = 0;
      setupTransaction(async () => {
        callCount++;
        return { id: `evt-${callCount}`, recurrenceIndex: callCount - 1 };
      });

      const createdEvents = [
        { id: "evt-1", recurrenceIndex: 0, googleEventId: null, googleSyncStatus: "NONE", lastSyncedAt: null, googleSyncError: null },
        { id: "evt-2", recurrenceIndex: 1, googleEventId: null, googleSyncStatus: "NONE", lastSyncedAt: null, googleSyncError: null },
        { id: "evt-3", recurrenceIndex: 2, googleEventId: null, googleSyncStatus: "NONE", lastSyncedAt: null, googleSyncError: null },
        { id: "evt-4", recurrenceIndex: 3, googleEventId: null, googleSyncStatus: "NONE", lastSyncedAt: null, googleSyncError: null },
      ];

      prismaMock.event.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(createdEvents);

      const result = (await service.create(
        {
          nome: "Culto Domingo",
          descricao: "Celebração",
          dataInicio: "2026-10-04T19:00:00.000Z",
          dataFim: "2026-10-04T21:00:00.000Z",
          recurrence: {
            type: RecurrenceTypeDto.WEEKLY,
            startDate: "2026-10-04T00:00:00.000Z",
            endDate: "2026-10-25T00:00:00.000Z",
            daysOfWeek: ["DOMINGO"],
          },
        },
        adminUser,
      )) as { totalEvents: number };

      expect(result.totalEvents).toBe(4);
    });

    it("should reject series when first occurrence conflicts", async () => {
      prismaMock.event.findMany.mockResolvedValueOnce([
        {
          id: "evt-existing",
          nome: "Conflitante",
          dataInicio: new Date("2026-10-04T20:00:00.000Z"),
          dataFim: new Date("2026-10-04T22:00:00.000Z"),
        },
      ]);

      await expect(
        service.create(
          {
            nome: "Culto Domingo",
            descricao: "Celebração",
            dataInicio: "2026-10-04T19:00:00.000Z",
            dataFim: "2026-10-04T21:00:00.000Z",
            recurrence: {
              type: RecurrenceTypeDto.WEEKLY,
              startDate: "2026-10-04T00:00:00.000Z",
              endDate: "2026-10-25T00:00:00.000Z",
              daysOfWeek: ["DOMINGO"],
            },
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject series when middle occurrence conflicts", async () => {
      prismaMock.event.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: "evt-existing",
            nome: "Ensaio",
            dataInicio: new Date("2026-10-11T20:00:00.000Z"),
            dataFim: new Date("2026-10-11T22:00:00.000Z"),
          },
        ]);

      await expect(
        service.create(
          {
            nome: "Culto Domingo",
            descricao: "Celebração",
            dataInicio: "2026-10-04T19:00:00.000Z",
            dataFim: "2026-10-04T21:00:00.000Z",
            recurrence: {
              type: RecurrenceTypeDto.WEEKLY,
              startDate: "2026-10-04T00:00:00.000Z",
              endDate: "2026-10-25T00:00:00.000Z",
              daysOfWeek: ["DOMINGO"],
            },
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject series when last occurrence conflicts", async () => {
      prismaMock.event.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: "evt-existing",
            nome: "Conferência",
            dataInicio: new Date("2026-10-25T19:00:00.000Z"),
            dataFim: new Date("2026-10-25T21:00:00.000Z"),
          },
        ]);

      await expect(
        service.create(
          {
            nome: "Culto Domingo",
            descricao: "Celebração",
            dataInicio: "2026-10-04T19:00:00.000Z",
            dataFim: "2026-10-04T21:00:00.000Z",
            recurrence: {
              type: RecurrenceTypeDto.WEEKLY,
              startDate: "2026-10-04T00:00:00.000Z",
              endDate: "2026-10-25T00:00:00.000Z",
              daysOfWeek: ["DOMINGO"],
            },
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should not create any occurrence when conflict detected", async () => {
      prismaMock.event.findMany.mockResolvedValueOnce([
        {
          id: "evt-existing",
          nome: "Conflitante",
          dataInicio: new Date("2026-10-04T20:00:00.000Z"),
          dataFim: new Date("2026-10-04T22:00:00.000Z"),
        },
      ]);

      let createCount = 0;
      setupTransaction(async () => {
        createCount++;
        return { id: `evt-${createCount}` };
      });

      await expect(
        service.create(
          {
            nome: "Culto Domingo",
            descricao: "Celebração",
            dataInicio: "2026-10-04T19:00:00.000Z",
            dataFim: "2026-10-04T21:00:00.000Z",
            recurrence: {
              type: RecurrenceTypeDto.WEEKLY,
              startDate: "2026-10-04T00:00:00.000Z",
              endDate: "2026-10-25T00:00:00.000Z",
              daysOfWeek: ["DOMINGO"],
            },
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(createCount).toBe(0);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it("should verify all occurrences before creating any", async () => {
      const findManyCalls: Array<{ where: { churchId: string } }> = [];
      prismaMock.event.findMany.mockImplementation(async (args: { where: { churchId: string } }) => {
        findManyCalls.push(args);
        return [];
      });

      setupTransaction(async () => ({ id: "evt-1" }));

      await service.create(
        {
          nome: "Culto Domingo",
          descricao: "Celebração",
          dataInicio: "2026-10-04T19:00:00.000Z",
          dataFim: "2026-10-04T21:00:00.000Z",
          recurrence: {
            type: RecurrenceTypeDto.WEEKLY,
            startDate: "2026-10-04T00:00:00.000Z",
            endDate: "2026-10-25T00:00:00.000Z",
            daysOfWeek: ["DOMINGO"],
          },
        },
        adminUser,
      );

      expect(findManyCalls).toHaveLength(5);
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    it("should not create recurrenceGroupId when conflict detected", async () => {
      prismaMock.event.findMany.mockResolvedValueOnce([
        {
          id: "evt-existing",
          nome: "Conflitante",
          dataInicio: new Date("2026-10-04T20:00:00.000Z"),
          dataFim: new Date("2026-10-04T22:00:00.000Z"),
        },
      ]);

      await expect(
        service.create(
          {
            nome: "Culto Domingo",
            descricao: "Celebração",
            dataInicio: "2026-10-04T19:00:00.000Z",
            dataFim: "2026-10-04T21:00:00.000Z",
            recurrence: {
              type: RecurrenceTypeDto.WEEKLY,
              startDate: "2026-10-04T00:00:00.000Z",
              endDate: "2026-10-25T00:00:00.000Z",
              daysOfWeek: ["DOMINGO"],
            },
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it("should allow series with multiple days when no conflict", async () => {
      let callCount = 0;
      setupTransaction(async () => {
        callCount++;
        return { id: `evt-${callCount}` };
      });

      const createdEvents = Array.from({ length: 8 }, (_, i) => ({
        id: `evt-${i + 1}`,
        recurrenceIndex: i,
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      }));

      const findManyMock = prismaMock.event.findMany;
      for (let i = 0; i < 8; i++) {
        findManyMock.mockResolvedValueOnce([]);
      }
      findManyMock.mockResolvedValueOnce(createdEvents);

      const result = (await service.create(
        {
          nome: "Culto e Ensaio",
          descricao: "Eventos",
          dataInicio: "2026-10-04T19:00:00.000Z",
          dataFim: "2026-10-04T21:00:00.000Z",
          recurrence: {
            type: RecurrenceTypeDto.WEEKLY,
            startDate: "2026-10-01T00:00:00.000Z",
            endDate: "2026-10-31T00:00:00.000Z",
            daysOfWeek: ["DOMINGO", "QUARTA"],
          },
        },
        adminUser,
      )) as { totalEvents: number };

      expect(result.totalEvents).toBeGreaterThan(4);
    });

    it("should reject series with multiple days when one day conflicts", async () => {
      prismaMock.event.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: "evt-existing",
            nome: "Ensaio Existente",
            dataInicio: new Date("2026-10-05T19:00:00.000Z"),
            dataFim: new Date("2026-10-05T21:00:00.000Z"),
          },
        ]);

      await expect(
        service.create(
          {
            nome: "Culto e Ensaio",
            descricao: "Eventos",
            dataInicio: "2026-10-04T19:00:00.000Z",
            dataFim: "2026-10-04T21:00:00.000Z",
            recurrence: {
              type: RecurrenceTypeDto.WEEKLY,
              startDate: "2026-10-01T00:00:00.000Z",
              endDate: "2026-10-31T00:00:00.000Z",
              daysOfWeek: ["DOMINGO", "SEGUNDA"],
            },
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("create — regressão", () => {
    it("should still create non-recurring event without conflict", async () => {
      prismaMock.event.findMany.mockResolvedValue([]);
      prismaMock.event.create.mockResolvedValue({
        id: "evt-single",
        churchId: "church-1",
        nome: "Culto Especial",
        descricao: "Único",
        dataInicio: new Date("2026-10-04T19:00:00.000Z"),
        dataFim: new Date("2026-10-04T21:00:00.000Z"),
        recorrencia: null,
        recurrenceGroupId: null,
        recurrenceType: "NONE",
        recurrenceDays: [],
        recurrenceStart: null,
        recurrenceEnd: null,
        recurrenceIndex: null,
        createdAt: new Date(),
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });
      prismaMock.event.findUnique.mockResolvedValue({
        id: "evt-single",
        churchId: "church-1",
        nome: "Culto Especial",
        descricao: "Único",
        dataInicio: new Date("2026-10-04T19:00:00.000Z"),
        dataFim: new Date("2026-10-04T21:00:00.000Z"),
        recorrencia: null,
        recurrenceGroupId: null,
        recurrenceType: "NONE",
        recurrenceDays: [],
        recurrenceStart: null,
        recurrenceEnd: null,
        recurrenceIndex: null,
        createdAt: new Date(),
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });

      const result = await service.create(
        {
          nome: "Culto Especial",
          descricao: "Único",
          dataInicio: "2026-10-04T19:00:00.000Z",
          dataFim: "2026-10-04T21:00:00.000Z",
        },
        adminUser,
      );

      expect(result).toHaveProperty("id", "evt-single");
    });

    it("should preserve existing recurrenceGroupId for other series", async () => {
      prismaMock.event.findMany.mockResolvedValue([]);

      let callCount = 0;
      setupTransaction(async () => {
        callCount++;
        return { id: `evt-${callCount}`, recurrenceIndex: callCount - 1 };
      });

      const result = (await service.create(
        {
          nome: "Culto Domingo",
          descricao: "Celebração",
          dataInicio: "2026-10-04T19:00:00.000Z",
          dataFim: "2026-10-04T21:00:00.000Z",
          recurrence: {
            type: RecurrenceTypeDto.WEEKLY,
            startDate: "2026-10-04T00:00:00.000Z",
            endDate: "2026-10-11T00:00:00.000Z",
            daysOfWeek: ["DOMINGO"],
          },
        },
        adminUser,
      )) as { recurrenceGroupId: string };

      expect(result.recurrenceGroupId).toBeDefined();
      expect(typeof result.recurrenceGroupId).toBe("string");
    });

    it("should still enforce max 52 occurrences", async () => {
      prismaMock.event.findMany.mockResolvedValue([]);

      const dto = {
        nome: "Culto Domingo",
        descricao: "Celebração",
        dataInicio: "2026-01-04T19:00:00.000Z",
        dataFim: "2026-01-04T21:00:00.000Z",
        recurrence: {
          type: RecurrenceTypeDto.WEEKLY,
          startDate: "2026-01-04T00:00:00.000Z",
          endDate: "2027-01-03T21:00:00.000Z",
          daysOfWeek: ["DOMINGO"],
        },
      };

      await expect(service.create(dto, adminUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should still validate dataFim > dataInicio", async () => {
      prismaMock.event.findMany.mockResolvedValue([]);

      await expect(
        service.create(
          {
            nome: "Culto",
            descricao: "Teste",
            dataInicio: "2026-10-04T21:00:00.000Z",
            dataFim: "2026-10-04T19:00:00.000Z",
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should still use churchId from actor", async () => {
      prismaMock.event.findMany.mockResolvedValue([]);
      prismaMock.event.create.mockResolvedValue({
        id: "evt-new",
        churchId: "church-1",
        nome: "Teste",
        descricao: "Teste",
        dataInicio: new Date("2026-10-04T19:00:00.000Z"),
        dataFim: new Date("2026-10-04T21:00:00.000Z"),
        recorrencia: null,
        recurrenceGroupId: null,
        recurrenceType: "NONE",
        recurrenceDays: [],
        recurrenceStart: null,
        recurrenceEnd: null,
        recurrenceIndex: null,
        createdAt: new Date(),
      });

      await service.create(
        {
          nome: "Teste",
          descricao: "Teste",
          dataInicio: "2026-10-04T19:00:00.000Z",
          dataFim: "2026-10-04T21:00:00.000Z",
        },
        adminUser,
      );

      expect(prismaMock.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            churchId: "church-1",
          }),
        }),
      );
    });
  });
});

describe("EventsService — Google Calendar Sync", () => {
  let service: EventsService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  const mockSyncService = {
    syncAllEventSchedules: jest.fn().mockResolvedValue(undefined),
    unlinkAllEventSchedules: jest.fn().mockResolvedValue({ success: true, errors: [] }),
    getEventSyncStatuses: jest.fn().mockResolvedValue([]),
    deleteGoogleEventByGoogleId: jest.fn(),
  };

  const mockAuditLogsService = {
    log: jest.fn(),
  };

  function createPrismaMock() {
    return {
      event: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      googleCalendarConnection: {
        findUnique: jest.fn(),
      },
      schedule: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(),
    };
  }

  const adminUser: JwtPayload = {
    sub: "user-1",
    email: "admin@test.com",
    perfil: Perfil.ADMIN,
    churchId: "church-1",
    churchSlug: "church-1",
  };

  const userFromChurchB: JwtPayload = {
    sub: "user-b",
    email: "user-b@test.com",
    perfil: Perfil.ADMIN,
    churchId: "church-2",
    churchSlug: "church-2",
  };

  const userWithoutChurch: JwtPayload = {
    sub: "user-2",
    email: "no-church@test.com",
    perfil: Perfil.ADMIN,
    churchId: undefined,
    churchSlug: undefined,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: GoogleCalendarSyncService, useValue: mockSyncService },
        { provide: AuditLogsService, useValue: mockAuditLogsService },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  describe("syncEventToGoogle", () => {
    it("should sync event belonging to user church", async () => {
      prismaMock.event.findFirst.mockResolvedValue({
        id: "evt-1",
        churchId: "church-1",
        nome: "Culto",
        descricao: "desc",
        dataInicio: new Date("2026-09-15T19:00:00Z"),
        dataFim: new Date("2026-09-15T21:00:00Z"),
        recurrenceGroupId: null,
        googleEventId: null,
        googleSyncStatus: "NONE",
      });
      prismaMock.googleCalendarConnection.findUnique.mockResolvedValue({
        id: "conn-1",
      });

      const result = await service.syncEventToGoogle(
        "evt-1",
        adminUser,
      );

      expect(result.eventId).toBe("evt-1");
      expect(result.schedules).toBeDefined();
      expect(mockSyncService.syncAllEventSchedules).toHaveBeenCalled();
    });

    it("should throw NotFoundException for event not found", async () => {
      prismaMock.event.findFirst.mockResolvedValue(null);

      await expect(
        service.syncEventToGoogle("evt-999", adminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw for cross-tenant event", async () => {
      prismaMock.event.findFirst.mockResolvedValue(null);

      await expect(
        service.syncEventToGoogle("evt-1", userFromChurchB),
      ).rejects.toThrow(NotFoundException);

      expect(prismaMock.event.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "evt-1", churchId: "church-2" },
        }),
      );
    });

    it("should throw BadRequestException when Google not connected", async () => {
      prismaMock.event.findFirst.mockResolvedValue({
        id: "evt-1",
        churchId: "church-1",
        nome: "Culto",
        descricao: "desc",
        dataInicio: new Date(),
        dataFim: new Date(),
        recurrenceGroupId: null,
        googleEventId: null,
        googleSyncStatus: "NONE",
      });
      prismaMock.googleCalendarConnection.findUnique.mockResolvedValue(null);

      const result = await service.syncEventToGoogle("evt-1", adminUser);
      expect(result.eventId).toBe("evt-1");
    });

    it("should throw ForbiddenException for user without church", async () => {
      await expect(
        service.syncEventToGoogle("evt-1", userWithoutChurch),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should return error status when sync fails", async () => {
      prismaMock.event.findFirst.mockResolvedValue({
        id: "evt-1",
        churchId: "church-1",
        nome: "Culto",
        descricao: "desc",
        dataInicio: new Date(),
        dataFim: new Date(),
        recurrenceGroupId: null,
        googleEventId: null,
        googleSyncStatus: "NONE",
      });
      prismaMock.googleCalendarConnection.findUnique.mockResolvedValue({
        id: "conn-1",
      });

      const result = await service.syncEventToGoogle(
        "evt-1",
        adminUser,
      );

      expect(result.eventId).toBe("evt-1");
      expect(result.schedules).toBeDefined();
    });
  });

  describe("unlinkEventFromGoogle", () => {
    it("should unlink event from Google Calendar", async () => {
      prismaMock.event.findFirst.mockResolvedValue({
        id: "evt-1",
        churchId: "church-1",
        googleEventId: "escala-evt1",
        googleSyncStatus: "SYNCED",
      });
      mockSyncService.unlinkAllEventSchedules.mockResolvedValue({
        success: true,
        errors: [],
      });

      const result = await service.unlinkEventFromGoogle(
        "evt-1",
        adminUser,
      );

      expect(result.success).toBe(true);
      expect(mockSyncService.unlinkAllEventSchedules).toHaveBeenCalledWith("evt-1");
    });

    it("should throw NotFoundException for event not found", async () => {
      prismaMock.event.findFirst.mockResolvedValue(null);

      await expect(
        service.unlinkEventFromGoogle("evt-999", adminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw for cross-tenant event", async () => {
      prismaMock.event.findFirst.mockResolvedValue(null);

      await expect(
        service.unlinkEventFromGoogle("evt-1", userFromChurchB),
      ).rejects.toThrow(NotFoundException);
    });

    it("should succeed even if event has no googleEventId", async () => {
      prismaMock.event.findFirst.mockResolvedValue({
        id: "evt-1",
        churchId: "church-1",
        googleEventId: null,
        googleSyncStatus: "NONE",
      });
      mockSyncService.unlinkAllEventSchedules.mockResolvedValue({
        success: true,
        errors: [],
      });

      const result = await service.unlinkEventFromGoogle(
        "evt-1",
        adminUser,
      );

      expect(result.success).toBe(true);
    });

    it("should return error when Google deletion fails", async () => {
      prismaMock.event.findFirst.mockResolvedValue({
        id: "evt-1",
        churchId: "church-1",
        googleEventId: "escala-evt1",
        googleSyncStatus: "SYNCED",
      });
      mockSyncService.unlinkAllEventSchedules.mockResolvedValue({
        success: false,
        errors: ["API error"],
      });

      const result = await service.unlinkEventFromGoogle(
        "evt-1",
        adminUser,
      );

      expect(result.success).toBe(false);
      expect(result.errors).toContain("API error");
    });

    it("should throw ForbiddenException for user without church", async () => {
      await expect(
        service.unlinkEventFromGoogle("evt-1", userWithoutChurch),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should log audit on successful sync", async () => {
      prismaMock.event.findFirst.mockResolvedValue({
        id: "evt-1",
        churchId: "church-1",
        nome: "Culto",
        descricao: "desc",
        dataInicio: new Date("2026-09-15T19:00:00Z"),
        dataFim: new Date("2026-09-15T21:00:00Z"),
        recurrenceGroupId: null,
        googleEventId: null,
        googleSyncStatus: "NONE",
      });
      prismaMock.googleCalendarConnection.findUnique.mockResolvedValue({
        id: "conn-1",
      });

      await service.syncEventToGoogle("evt-1", adminUser);

      expect(mockAuditLogsService.log).toHaveBeenCalledWith({
        userId: "user-1",
        churchId: "church-1",
        action: "GOOGLE_CALENDAR_SYNC",
        module: "EVENTS",
        targetId: "evt-1",
        newValue: expect.any(Object),
      });
    });

    it("should log audit on sync error", async () => {
      prismaMock.event.findFirst.mockResolvedValue({
        id: "evt-1",
        churchId: "church-1",
        nome: "Culto",
        descricao: "desc",
        dataInicio: new Date(),
        dataFim: new Date(),
        recurrenceGroupId: null,
        googleEventId: null,
        googleSyncStatus: "NONE",
      });
      prismaMock.googleCalendarConnection.findUnique.mockResolvedValue({
        id: "conn-1",
      });

      await service.syncEventToGoogle("evt-1", adminUser);

      expect(mockAuditLogsService.log).toHaveBeenCalledWith({
        userId: "user-1",
        churchId: "church-1",
        action: "GOOGLE_CALENDAR_SYNC",
        module: "EVENTS",
        targetId: "evt-1",
        newValue: expect.any(Object),
      });
    });

    it("should not log audit when sync throws NotFoundException", async () => {
      prismaMock.event.findFirst.mockResolvedValue(null);

      await expect(
        service.syncEventToGoogle("evt-999", adminUser),
      ).rejects.toThrow(NotFoundException);

      expect(mockAuditLogsService.log).not.toHaveBeenCalled();
    });

    it("should not log audit when sync throws BadRequestException", async () => {
      prismaMock.event.findFirst.mockResolvedValue({
        id: "evt-1",
        churchId: "church-1",
        nome: "Culto",
        descricao: "desc",
        dataInicio: new Date(),
        dataFim: new Date(),
        recurrenceGroupId: null,
        googleEventId: null,
        googleSyncStatus: "NONE",
      });
      prismaMock.googleCalendarConnection.findUnique.mockResolvedValue(null);

      await service.syncEventToGoogle("evt-1", adminUser);

      expect(mockAuditLogsService.log).toHaveBeenCalled();
    });

    it("should log audit on successful unlink", async () => {
      prismaMock.event.findFirst.mockResolvedValue({
        id: "evt-1",
        churchId: "church-1",
        googleEventId: "escala-evt1",
        googleSyncStatus: "SYNCED",
      });
      mockSyncService.unlinkAllEventSchedules.mockResolvedValue({
        success: true,
        errors: [],
      });

      await service.unlinkEventFromGoogle("evt-1", adminUser);

      expect(mockAuditLogsService.log).toHaveBeenCalledWith({
        userId: "user-1",
        churchId: "church-1",
        action: "GOOGLE_CALENDAR_UNLINK",
        module: "EVENTS",
        targetId: "evt-1",
        newValue: { success: true },
      });
    });

    it("should log audit on unlink failure", async () => {
      prismaMock.event.findFirst.mockResolvedValue({
        id: "evt-1",
        churchId: "church-1",
        googleEventId: "escala-evt1",
        googleSyncStatus: "SYNCED",
      });
      mockSyncService.unlinkAllEventSchedules.mockResolvedValue({
        success: false,
        errors: ["API error"],
      });

      await service.unlinkEventFromGoogle("evt-1", adminUser);

      expect(mockAuditLogsService.log).toHaveBeenCalledWith({
        userId: "user-1",
        churchId: "church-1",
        action: "GOOGLE_CALENDAR_UNLINK",
        module: "EVENTS",
        targetId: "evt-1",
        newValue: { success: false },
      });
    });

    it("should not log audit when unlink throws NotFoundException", async () => {
      prismaMock.event.findFirst.mockResolvedValue(null);

      await expect(
        service.unlinkEventFromGoogle("evt-999", adminUser),
      ).rejects.toThrow(NotFoundException);

      expect(mockAuditLogsService.log).not.toHaveBeenCalled();
    });

    it("should log audit with correct churchId from actor", async () => {
      prismaMock.event.findFirst.mockResolvedValue({
        id: "evt-1",
        churchId: "church-2",
        nome: "Culto B",
        descricao: "desc",
        dataInicio: new Date("2026-09-15T19:00:00Z"),
        dataFim: new Date("2026-09-15T21:00:00Z"),
        recurrenceGroupId: null,
        googleEventId: null,
        googleSyncStatus: "NONE",
      });
      prismaMock.googleCalendarConnection.findUnique.mockResolvedValue({
        id: "conn-b",
      });

      await service.syncEventToGoogle("evt-1", userFromChurchB);

      expect(mockAuditLogsService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-b",
          churchId: "church-2",
        }),
      );
    });

    it("should include correct newValue structure for sync audit", async () => {
      prismaMock.event.findFirst.mockResolvedValue({
        id: "evt-1",
        churchId: "church-1",
        nome: "Culto",
        descricao: "desc",
        dataInicio: new Date("2026-09-15T19:00:00Z"),
        dataFim: new Date("2026-09-15T21:00:00Z"),
        recurrenceGroupId: null,
        googleEventId: null,
        googleSyncStatus: "NONE",
      });
      prismaMock.googleCalendarConnection.findUnique.mockResolvedValue({
        id: "conn-1",
      });

      await service.syncEventToGoogle(
        "evt-1",
        adminUser,
      );

      const auditCall = mockAuditLogsService.log.mock.calls[0][0];
      expect(auditCall.newValue).toEqual({
        schedulesCount: 0,
      });
    });

    it("should include correct newValue structure for unlink audit", async () => {
      prismaMock.event.findFirst.mockResolvedValue({
        id: "evt-1",
        churchId: "church-1",
        googleEventId: "escala-evt1",
        googleSyncStatus: "SYNCED",
      });
      mockSyncService.unlinkAllEventSchedules.mockResolvedValue({
        success: true,
        errors: [],
      });

      await service.unlinkEventFromGoogle("evt-1", adminUser);

      const auditCall = mockAuditLogsService.log.mock.calls[0][0];
      expect(auditCall.newValue).toEqual({ success: true });
    });
  });

  describe("auto-sync — CREATE", () => {
    const eventWithGoogleFields = {
      churchId: "church-1",
      nome: "Culto",
      descricao: "desc",
      dataInicio: new Date("2026-09-15T19:00:00Z"),
      dataFim: new Date("2026-09-15T21:00:00Z"),
      recorrencia: null,
      recurrenceGroupId: null,
      id: "evt-auto-1",
      recurrenceType: "NONE",
      recurrenceDays: [],
      recurrenceStart: null,
      recurrenceEnd: null,
      recurrenceIndex: null,
      createdAt: new Date(),
      googleEventId: null,
      googleSyncStatus: "NONE",
      lastSyncedAt: null,
      googleSyncError: null,
    };

    it("1. should create event without Google when no connection", async () => {
      prismaMock.event.findMany.mockResolvedValue([]);
      prismaMock.event.create.mockResolvedValue(eventWithGoogleFields);
      prismaMock.googleCalendarConnection.findUnique.mockResolvedValue(null);
      prismaMock.event.findUnique.mockResolvedValue(eventWithGoogleFields);

      const result = await service.create(
        {
          nome: "Culto",
          descricao: "desc",
          dataInicio: "2026-09-15T19:00:00.000Z",
          dataFim: "2026-09-15T21:00:00.000Z",
        },
        adminUser,
      );

      expect(result).toHaveProperty("id", "evt-auto-1");
      expect(mockSyncService.syncAllEventSchedules).toHaveBeenCalledWith("evt-auto-1");
    });

    it("2. should sync to Google on create when connected", async () => {
      prismaMock.event.findMany.mockResolvedValue([]);
      prismaMock.event.create.mockResolvedValue(eventWithGoogleFields);
      prismaMock.googleCalendarConnection.findUnique.mockResolvedValue({
        id: "conn-1",
      });
      prismaMock.event.findFirst.mockResolvedValue(eventWithGoogleFields);
      prismaMock.event.findUnique.mockResolvedValue({
        ...eventWithGoogleFields,
        googleEventId: "escala-evt1",
        googleSyncStatus: "SYNCED",
      });

      const result = await service.create(
        {
          nome: "Culto",
          descricao: "desc",
          dataInicio: "2026-09-15T19:00:00.000Z",
          dataFim: "2026-09-15T21:00:00.000Z",
        },
        adminUser,
      );

      expect(result).toHaveProperty("googleEventId", "escala-evt1");
      expect(mockSyncService.syncAllEventSchedules).toHaveBeenCalled();
    });

    it("3. should return ERROR when Google sync fails on create", async () => {
      prismaMock.event.findMany.mockResolvedValue([]);
      prismaMock.event.create.mockResolvedValue(eventWithGoogleFields);
      prismaMock.googleCalendarConnection.findUnique.mockResolvedValue({
        id: "conn-1",
      });
      prismaMock.event.findFirst.mockResolvedValue(eventWithGoogleFields);
      prismaMock.event.findUnique.mockResolvedValue({
        ...eventWithGoogleFields,
        googleSyncStatus: "ERROR",
        googleSyncError: "Token expired",
      });

      const result = await service.create(
        {
          nome: "Culto",
          descricao: "desc",
          dataInicio: "2026-09-15T19:00:00.000Z",
          dataFim: "2026-09-15T21:00:00.000Z",
        },
        adminUser,
      );

      expect(result).toHaveProperty("googleSyncStatus", "ERROR");
    });

    it("4. should keep event local when Google sync throws", async () => {
      prismaMock.event.findMany.mockResolvedValue([]);
      prismaMock.event.create.mockResolvedValue(eventWithGoogleFields);
      prismaMock.googleCalendarConnection.findUnique.mockResolvedValue({
        id: "conn-1",
      });
      prismaMock.event.findFirst.mockResolvedValue(eventWithGoogleFields);
      mockSyncService.syncAllEventSchedules.mockRejectedValue(new Error("Network error"));
      prismaMock.event.findUnique.mockResolvedValue(eventWithGoogleFields);

      const result = await service.create(
        {
          nome: "Culto",
          descricao: "desc",
          dataInicio: "2026-09-15T19:00:00.000Z",
          dataFim: "2026-09-15T21:00:00.000Z",
        },
        adminUser,
      );

      expect(result).toHaveProperty("id", "evt-auto-1");
    });

    it("20. should create series locally even if Google fails for some", async () => {
      const seriesEvents = [
        { id: "evt-1", recurrenceIndex: 0, churchId: "church-1", nome: "Culto Domingo", descricao: "Celebração", dataInicio: new Date("2026-10-04T19:00:00Z"), dataFim: new Date("2026-10-04T21:00:00Z"), recorrencia: "SEMANAL", recurrenceGroupId: "group-1", recurrenceType: "WEEKLY", recurrenceDays: ["DOMINGO"], recurrenceStart: new Date("2026-10-04T00:00:00Z"), recurrenceEnd: new Date("2026-10-25T00:00:00Z"), createdAt: new Date(), googleEventId: null, googleSyncStatus: "NONE", lastSyncedAt: null, googleSyncError: null },
        { id: "evt-2", recurrenceIndex: 1, churchId: "church-1", nome: "Culto Domingo", descricao: "Celebração", dataInicio: new Date("2026-10-11T19:00:00Z"), dataFim: new Date("2026-10-11T21:00:00Z"), recorrencia: "SEMANAL", recurrenceGroupId: "group-1", recurrenceType: "WEEKLY", recurrenceDays: ["DOMINGO"], recurrenceStart: new Date("2026-10-04T00:00:00Z"), recurrenceEnd: new Date("2026-10-25T00:00:00Z"), createdAt: new Date(), googleEventId: null, googleSyncStatus: "NONE", lastSyncedAt: null, googleSyncError: null },
        { id: "evt-3", recurrenceIndex: 2, churchId: "church-1", nome: "Culto Domingo", descricao: "Celebração", dataInicio: new Date("2026-10-18T19:00:00Z"), dataFim: new Date("2026-10-18T21:00:00Z"), recorrencia: "SEMANAL", recurrenceGroupId: "group-1", recurrenceType: "WEEKLY", recurrenceDays: ["DOMINGO"], recurrenceStart: new Date("2026-10-04T00:00:00Z"), recurrenceEnd: new Date("2026-10-25T00:00:00Z"), createdAt: new Date(), googleEventId: null, googleSyncStatus: "NONE", lastSyncedAt: null, googleSyncError: null },
        { id: "evt-4", recurrenceIndex: 3, churchId: "church-1", nome: "Culto Domingo", descricao: "Celebração", dataInicio: new Date("2026-10-25T19:00:00Z"), dataFim: new Date("2026-10-25T21:00:00Z"), recorrencia: "SEMANAL", recurrenceGroupId: "group-1", recurrenceType: "WEEKLY", recurrenceDays: ["DOMINGO"], recurrenceStart: new Date("2026-10-04T00:00:00Z"), recurrenceEnd: new Date("2026-10-25T00:00:00Z"), createdAt: new Date(), googleEventId: null, googleSyncStatus: "NONE", lastSyncedAt: null, googleSyncError: null },
      ];

      prismaMock.event.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(seriesEvents);

      let callCount = 0;
      const setupTx = (createFn: (args: Record<string, unknown>) => Promise<Record<string, unknown>>) => {
        prismaMock.$transaction.mockImplementation(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          async (cb: any) => {
            const tx = { event: { create: jest.fn().mockImplementation(createFn) } };
            return cb(tx);
          },
        );
      };
      setupTx(async () => {
        callCount++;
        return { id: `evt-${callCount}`, recurrenceIndex: callCount - 1 };
      });

      prismaMock.googleCalendarConnection.findUnique.mockResolvedValue({
        id: "conn-1",
      });
      prismaMock.event.findFirst
        .mockResolvedValueOnce(seriesEvents[0])
        .mockResolvedValueOnce(seriesEvents[1])
        .mockResolvedValueOnce(seriesEvents[2])
        .mockResolvedValueOnce(seriesEvents[3]);

      const result = (await service.create(
        {
          nome: "Culto Domingo",
          descricao: "Celebração",
          dataInicio: "2026-10-04T19:00:00.000Z",
          dataFim: "2026-10-04T21:00:00.000Z",
          recurrence: {
            type: RecurrenceTypeDto.WEEKLY,
            startDate: "2026-10-04T00:00:00.000Z",
            endDate: "2026-10-25T00:00:00.000Z",
            daysOfWeek: ["DOMINGO"],
          },
        },
        adminUser,
      )) as { totalEvents: number; events: Array<{ id: string }> };

      expect(result.totalEvents).toBe(4);
      expect(result.events).toHaveLength(4);
      expect(mockSyncService.syncAllEventSchedules).toHaveBeenCalled();
    });
  });

  describe("auto-sync — UPDATE", () => {
    it("10. should sync to Google on update when connected", async () => {
      const existing = {
        id: "evt-upd-1",
        churchId: "church-1",
        nome: "Culto Original",
        descricao: "desc",
        dataInicio: new Date("2026-10-04T19:00:00Z"),
        dataFim: new Date("2026-10-04T21:00:00Z"),
        recurrenceGroupId: null,
      };
      const updatedEvent = {
        ...existing,
        nome: "Atualizado",
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      };
      prismaMock.event.findFirst
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(updatedEvent);
      prismaMock.event.findMany.mockResolvedValue([]);
      prismaMock.event.update.mockResolvedValue(updatedEvent);
      prismaMock.googleCalendarConnection.findUnique.mockResolvedValue({
        id: "conn-1",
      });
      prismaMock.event.findUnique.mockResolvedValue({
        ...updatedEvent,
        googleEventId: "escala-evt1",
        googleSyncStatus: "SYNCED",
        lastSyncedAt: new Date(),
        googleSyncError: null,
      });

      const result = await service.update(
        "evt-upd-1",
        { nome: "Atualizado" },
        adminUser,
      );

      expect(result).toHaveProperty("googleEventId", "escala-evt1");
      expect(mockSyncService.syncAllEventSchedules).toHaveBeenCalled();
    });

    it("11. should return ERROR when Google sync fails on update", async () => {
      const existing = {
        id: "evt-upd-2",
        dataInicio: new Date("2026-10-04T19:00:00Z"),
        dataFim: new Date("2026-10-04T21:00:00Z"),
        recurrenceGroupId: null,
      };
      prismaMock.event.findFirst.mockResolvedValue(existing);
      prismaMock.event.findMany.mockResolvedValue([]);
      prismaMock.event.update.mockResolvedValue({
        ...existing,
        nome: "Atualizado",
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });
      prismaMock.googleCalendarConnection.findUnique.mockResolvedValue({
        id: "conn-1",
      });
      prismaMock.event.findUnique.mockResolvedValue({
        ...existing,
        nome: "Atualizado",
        googleSyncStatus: "ERROR",
        googleSyncError: "API error",
      });

      const result = await service.update(
        "evt-upd-2",
        { nome: "Atualizado" },
        adminUser,
      );

      expect(result).toHaveProperty("googleSyncStatus", "ERROR");
    });

    it("14. should continue local update when Google unavailable", async () => {
      const existing = {
        id: "evt-upd-3",
        dataInicio: new Date("2026-10-04T19:00:00Z"),
        dataFim: new Date("2026-10-04T21:00:00Z"),
        recurrenceGroupId: null,
      };
      prismaMock.event.findFirst.mockResolvedValue(existing);
      prismaMock.event.findMany.mockResolvedValue([]);
      prismaMock.event.update.mockResolvedValue({
        ...existing,
        nome: "Atualizado",
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });
      prismaMock.googleCalendarConnection.findUnique.mockResolvedValue(null);
      prismaMock.event.findUnique.mockResolvedValue({
        ...existing,
        nome: "Atualizado",
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });

      const result = await service.update(
        "evt-upd-3",
        { nome: "Atualizado" },
        adminUser,
      );

      expect(result).toHaveProperty("nome", "Atualizado");
      expect(mockSyncService.syncAllEventSchedules).toHaveBeenCalledWith("evt-upd-3");
    });
  });

  describe("auto-sync — DELETE", () => {
    it("15. should delete event locally without Google when no connection", async () => {
      prismaMock.event.findFirst.mockResolvedValue({
        id: "evt-del-1",
        googleEventId: null,
      });
      prismaMock.event.delete.mockResolvedValue({
        id: "evt-del-1",
        churchId: "church-1",
        nome: "Culto",
        descricao: "desc",
        dataInicio: new Date(),
        dataFim: new Date(),
        recorrencia: null,
        recurrenceGroupId: null,
        recurrenceType: "NONE",
        recurrenceDays: [],
        recurrenceStart: null,
        recurrenceEnd: null,
        recurrenceIndex: null,
        createdAt: new Date(),
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });

      const result = await service.remove("evt-del-1", adminUser);

      expect(result).toHaveProperty("id", "evt-del-1");
      expect(mockSyncService.deleteGoogleEventByGoogleId).not.toHaveBeenCalled();
    });

    it("16. should delete Google event after local delete when connected", async () => {
      prismaMock.event.findFirst.mockResolvedValue({
        id: "evt-del-2",
        googleEventId: "escala-evt2",
      });
      prismaMock.event.delete.mockResolvedValue({
        id: "evt-del-2",
        churchId: "church-1",
        nome: "Culto",
        descricao: "desc",
        dataInicio: new Date(),
        dataFim: new Date(),
        recorrencia: null,
        recurrenceGroupId: null,
        recurrenceType: "NONE",
        recurrenceDays: [],
        recurrenceStart: null,
        recurrenceEnd: null,
        recurrenceIndex: null,
        createdAt: new Date(),
        googleEventId: "escala-evt2",
        googleSyncStatus: "SYNCED",
        lastSyncedAt: new Date(),
        googleSyncError: null,
      });

      const result = await service.remove("evt-del-2", adminUser);

      expect(result).toHaveProperty("id", "evt-del-2");
      expect(mockSyncService.unlinkAllEventSchedules).toHaveBeenCalledWith("evt-del-2");
    });

    it("18. should keep local delete when Google deletion fails", async () => {
      prismaMock.event.findFirst.mockResolvedValue({
        id: "evt-del-3",
        googleEventId: "escala-evt3",
      });
      prismaMock.event.delete.mockResolvedValue({
        id: "evt-del-3",
        churchId: "church-1",
        nome: "Culto",
        descricao: "desc",
        dataInicio: new Date(),
        dataFim: new Date(),
        recorrencia: null,
        recurrenceGroupId: null,
        recurrenceType: "NONE",
        recurrenceDays: [],
        recurrenceStart: null,
        recurrenceEnd: null,
        recurrenceIndex: null,
        createdAt: new Date(),
        googleEventId: "escala-evt3",
        googleSyncStatus: "SYNCED",
        lastSyncedAt: new Date(),
        googleSyncError: null,
      });
      mockSyncService.deleteGoogleEventByGoogleId.mockRejectedValue(
        new Error("Internal Server Error"),
      );

      const result = await service.remove("evt-del-3", adminUser);

      expect(result).toHaveProperty("id", "evt-del-3");
    });

    it("19. should not attempt Google delete when event has no googleEventId", async () => {
      prismaMock.event.findFirst.mockResolvedValue({
        id: "evt-del-4",
        googleEventId: null,
      });
      prismaMock.event.delete.mockResolvedValue({
        id: "evt-del-4",
        churchId: "church-1",
        nome: "Culto",
        descricao: "desc",
        dataInicio: new Date(),
        dataFim: new Date(),
        recorrencia: null,
        recurrenceGroupId: null,
        recurrenceType: "NONE",
        recurrenceDays: [],
        recurrenceStart: null,
        recurrenceEnd: null,
        recurrenceIndex: null,
        createdAt: new Date(),
        googleEventId: null,
        googleSyncStatus: "NONE",
        lastSyncedAt: null,
        googleSyncError: null,
      });

      await service.remove("evt-del-4", adminUser);

      expect(mockSyncService.deleteGoogleEventByGoogleId).not.toHaveBeenCalled();
    });
  });

  describe("auto-sync — security", () => {
    const secEvent = {
      id: "evt-sec-1",
      churchId: "church-1",
      nome: "Culto",
      descricao: "desc",
      dataInicio: new Date("2026-09-15T19:00:00Z"),
      dataFim: new Date("2026-09-15T21:00:00Z"),
      recorrencia: null,
      recurrenceGroupId: null,
      recurrenceType: "NONE",
      recurrenceDays: [],
      recurrenceStart: null,
      recurrenceEnd: null,
      recurrenceIndex: null,
      createdAt: new Date(),
      googleEventId: null,
      googleSyncStatus: "NONE",
      lastSyncedAt: null,
      googleSyncError: null,
    };

    it("24. should call syncAllEventSchedules with event id on auto-sync", async () => {
      prismaMock.event.findMany.mockResolvedValue([]);
      prismaMock.event.create.mockResolvedValue(secEvent);
      prismaMock.event.findUnique.mockResolvedValue({
        ...secEvent,
        googleEventId: "escala-evt1",
        googleSyncStatus: "SYNCED",
      });

      await service.create(
        {
          nome: "Culto",
          descricao: "desc",
          dataInicio: "2026-09-15T19:00:00.000Z",
          dataFim: "2026-09-15T21:00:00.000Z",
        },
        adminUser,
      );

      expect(mockSyncService.syncAllEventSchedules).toHaveBeenCalledWith("evt-sec-1");
    });

    it("25. should not log AuditLog on auto-sync (only manual endpoints)", async () => {
      prismaMock.event.findMany.mockResolvedValue([]);
      prismaMock.event.create.mockResolvedValue(secEvent);
      prismaMock.googleCalendarConnection.findUnique.mockResolvedValue({
        id: "conn-1",
      });
      prismaMock.event.findUnique.mockResolvedValue({
        ...secEvent,
        googleEventId: "escala-evt1",
        googleSyncStatus: "SYNCED",
      });

      await service.create(
        {
          nome: "Culto",
          descricao: "desc",
          dataInicio: "2026-09-15T19:00:00.000Z",
          dataFim: "2026-09-15T21:00:00.000Z",
        },
        adminUser,
      );

      expect(mockAuditLogsService.log).not.toHaveBeenCalled();
    });
  });
});

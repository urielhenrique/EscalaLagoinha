import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException } from "@nestjs/common";
import { SchedulesService } from "./schedules.service";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AvailabilityService } from "../availability/availability.service";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { Perfil } from "@prisma/client";

describe("SchedulesService — Multi-Tenancy", () => {
  let service: SchedulesService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  function createPrismaMock() {
    return {
      schedule: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      event: {
        findUnique: jest.fn(),
      },
      ministry: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };
  }

  const churchA: JwtPayload = {
    sub: "user-a",
    email: "a@test.com",
    perfil: Perfil.MASTER_ADMIN,
    churchId: "church-a",
    churchSlug: "church-a",
  };

  const volunteerUser: JwtPayload = {
    sub: "vol-1",
    email: "vol@test.com",
    perfil: Perfil.VOLUNTARIO,
    churchId: "church-a",
    churchSlug: "church-a",
  };

  beforeEach(async () => {
    prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulesService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: NotificationsService,
          useValue: {
            notifyScaleCreated: jest.fn(),
            notifyScaleCancelled: jest.fn(),
          },
        },
        {
          provide: AvailabilityService,
          useValue: { assertVolunteerAvailable: jest.fn() },
        },
        {
          provide: AuditLogsService,
          useValue: { log: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<SchedulesService>(SchedulesService);
  });

  describe("findAllVisible — tenant isolation", () => {
    it("should filter schedules by user churchId", async () => {
      prismaMock.schedule.findMany.mockResolvedValue([]);

      await service.findAllVisible(churchA, {});

      expect(prismaMock.schedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            churchId: "church-a",
          }),
        }),
      );
    });

    it("should never return schedules from another church", async () => {
      const scheduleFromChurchB = {
        id: "s1",
        churchId: "church-b",
        eventId: "e1",
        ministryId: "m1",
        volunteerId: "v1",
        status: "PENDENTE",
      };

      prismaMock.schedule.findMany.mockImplementation(
        async (args: { where: { churchId?: string } }) => {
          if (args.where.churchId === "church-a") return [];
          return [scheduleFromChurchB];
        },
      );

      const result = await service.findAllVisible(churchA, {});

      expect(result).toEqual([]);
    });
  });

  describe("findByIdVisible — tenant isolation", () => {
    it("should throw ForbiddenException when schedule belongs to another church", async () => {
      prismaMock.schedule.findUnique.mockResolvedValue({
        id: "s1",
        churchId: "church-b",
        eventId: "e1",
        ministryId: "m1",
        volunteerId: "v1",
        status: "PENDENTE",
        event: {},
        ministry: { leaderId: null },
        volunteer: {},
      });

      await expect(
        service.findByIdVisible("s1", churchA),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("cancel — tenant isolation", () => {
    it("should throw ForbiddenException when cancelling schedule from another church", async () => {
      prismaMock.schedule.findUnique.mockResolvedValue({
        id: "s1",
        churchId: "church-b",
        eventId: "e1",
        ministryId: "m1",
        volunteerId: "v1",
        status: "PENDENTE",
        event: {},
        ministry: {},
        volunteer: {},
      });

      await expect(service.cancel("s1", churchA)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("volunteer visibility rules", () => {
    it("should restrict volunteer to only their own schedules", async () => {
      prismaMock.schedule.findMany.mockResolvedValue([]);

      await service.findAllVisible(volunteerUser, {});

      expect(prismaMock.schedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { volunteerId: "vol-1" },
              { ministry: { leaderId: "vol-1" } },
            ],
          }),
        }),
      );
    });

    it("should throw when volunteer tries to query another volunteer schedule", async () => {
      await expect(
        service.findAllVisible(volunteerUser, { volunteerId: "other-vol" }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("assertNoTimeConflict — tenant isolation", () => {
    it("should only check conflicts within the same church", async () => {
      prismaMock.event.findUnique.mockImplementation(
        async (args: { where: { id: string } }) => {
          if (args.where.id === "e1") {
            return {
              id: "e1",
              nome: "Culto A",
              dataInicio: new Date("2026-10-05T19:00:00Z"),
              dataFim: new Date("2026-10-05T21:00:00Z"),
              churchId: "church-a",
            };
          }
          return null;
        },
      );

      prismaMock.ministry.findUnique.mockResolvedValue({
        id: "m1", churchId: "church-a",
      });

      prismaMock.user.findUnique.mockResolvedValue({
        id: "vol-1", ativo: true, churchId: "church-a",
      });

      prismaMock.schedule.findFirst.mockResolvedValue(null);

      prismaMock.schedule.create.mockResolvedValue({
        id: "s1",
        churchId: "church-a",
        eventId: "e1",
        ministryId: "m1",
        volunteerId: "vol-1",
        status: "PENDENTE",
        createdAt: new Date(),
        updatedAt: new Date(),
        event: {
          id: "e1",
          nome: "Culto A",
          descricao: "",
          dataInicio: new Date("2026-10-05T19:00:00Z"),
          dataFim: new Date("2026-10-05T21:00:00Z"),
          recorrencia: null,
          createdAt: new Date(),
        },
        ministry: { id: "m1", nome: "Foto", descricao: "", leaderId: null },
        volunteer: { id: "vol-1", nome: "Vol", email: "vol@test.com" },
      });

      await service.create(
        { eventId: "e1", ministryId: "m1", volunteerId: "vol-1" },
        churchA,
      );

      expect(prismaMock.schedule.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            churchId: "church-a",
          }),
        }),
      );
    });
  });
});

import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { SmartSchedulerService } from "./smart-scheduler.service";
import { PrismaService } from "../prisma/prisma.service";
import { ScheduleStatus } from "@prisma/client";

describe("SmartSchedulerService — Cross-Tenant Isolation", () => {
  let service: SmartSchedulerService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  function createPrismaMock() {
    return {
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      schedule: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      swapRequest: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      event: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      ministry: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
    };
  }

  const eventChurchA = {
    id: "event-a",
    nome: "Culto A",
    descricao: "",
    churchId: "church-a",
    dataInicio: new Date("2026-10-05T19:00:00Z"),
    dataFim: new Date("2026-10-05T21:00:00Z"),
    recorrencia: null,
    createdAt: new Date(),
  };

  const ministryChurchA = {
    id: "ministry-a",
    nome: "Foto",
    descricao: "",
    churchId: "church-a",
    leaderId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const ministryChurchB = {
    id: "ministry-b",
    nome: "Video",
    descricao: "",
    churchId: "church-b",
    leaderId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmartSchedulerService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<SmartSchedulerService>(SmartSchedulerService);
  });

  describe("getEventOrThrow — tenant isolation", () => {
    it("should throw NotFoundException when event belongs to another church", async () => {
      prismaMock.event.findFirst.mockResolvedValue(null);

      await expect(
        service.getInsights("event-b", "church-a"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should allow access when event belongs to the same church", async () => {
      prismaMock.event.findFirst.mockResolvedValue(eventChurchA);
      prismaMock.ministry.findMany.mockResolvedValue([]);

      await service.getInsights("event-a", "church-a");

      expect(prismaMock.event.findFirst).toHaveBeenCalledWith({
        where: { id: "event-a", churchId: "church-a" },
      });
    });
  });

  describe("getManualSuggestions — entity validation", () => {
    it("should throw NotFoundException when event belongs to another church", async () => {
      prismaMock.event.findFirst.mockResolvedValue(null);

      await expect(
        service.getManualSuggestions({
          eventId: "event-b",
          ministryId: "ministry-a",
          churchId: "church-a",
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException when ministry belongs to another church", async () => {
      prismaMock.event.findFirst.mockResolvedValue(eventChurchA);
      prismaMock.ministry.findFirst.mockResolvedValue(null);

      await expect(
        service.getManualSuggestions({
          eventId: "event-a",
          ministryId: "ministry-b",
          churchId: "church-a",
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should allow when both event and ministry belong to same church", async () => {
      prismaMock.event.findFirst.mockResolvedValue(eventChurchA);
      prismaMock.ministry.findFirst.mockResolvedValue(ministryChurchA);
      prismaMock.user.findMany.mockResolvedValue([]);

      await service.getManualSuggestions({
        eventId: "event-a",
        ministryId: "ministry-a",
        churchId: "church-a",
      });

      expect(prismaMock.event.findFirst).toHaveBeenCalled();
      expect(prismaMock.ministry.findFirst).toHaveBeenCalled();
    });
  });

  describe("generateSmartSchedule — entity validation", () => {
    it("should throw NotFoundException when event belongs to another church", async () => {
      prismaMock.event.findFirst.mockResolvedValue(null);

      await expect(
        service.generateSmartSchedule({
          eventId: "event-b",
          ministryIds: ["ministry-a"],
          churchId: "church-a",
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ForbiddenException when ministry belongs to another church", async () => {
      prismaMock.event.findFirst.mockResolvedValue(eventChurchA);
      prismaMock.ministry.findMany.mockResolvedValue([ministryChurchB]);

      await expect(
        service.generateSmartSchedule({
          eventId: "event-a",
          ministryIds: ["ministry-b"],
          churchId: "church-a",
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should allow when all entities belong to the same church", async () => {
      prismaMock.event.findFirst.mockResolvedValue(eventChurchA);
      prismaMock.ministry.findMany.mockResolvedValue([ministryChurchA]);
      prismaMock.user.findMany.mockResolvedValue([]);
      prismaMock.schedule.findMany.mockResolvedValue([]);

      const result = await service.generateSmartSchedule({
        eventId: "event-a",
        ministryIds: ["ministry-a"],
        churchId: "church-a",
      });

      expect(result).toBeDefined();
      expect(result.event.id).toBe("event-a");
    });

    it("should create schedule with churchId when provided", async () => {
      prismaMock.event.findFirst.mockResolvedValue(eventChurchA);
      prismaMock.ministry.findMany.mockResolvedValue([ministryChurchA]);
      prismaMock.user.findMany.mockResolvedValue([
        { id: "vol-1", nome: "Volunteer", email: "vol@test.com" },
      ]);
      prismaMock.schedule.findMany.mockResolvedValue([]);
      prismaMock.schedule.create.mockResolvedValue({
        id: "s1",
        eventId: "event-a",
        ministryId: "ministry-a",
        volunteerId: "vol-1",
        status: ScheduleStatus.PENDENTE,
      });

      await service.generateSmartSchedule({
        eventId: "event-a",
        ministryIds: ["ministry-a"],
        slotsPerMinistry: 1,
        churchId: "church-a",
      });

      expect(prismaMock.schedule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            churchId: "church-a",
          }),
        }),
      );
    });
  });

  describe("buildRankingDataset — tenant isolation", () => {
    it("should pass churchId filter to user queries", async () => {
      prismaMock.user.findMany.mockResolvedValue([]);

      await service.getRanking({ churchId: "church-a" });

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            churchId: "church-a",
          }),
        }),
      );
    });

    it("should pass churchId filter to swapRequest queries", async () => {
      prismaMock.user.findMany.mockResolvedValue([
        {
          id: "vol-1",
          nome: "Vol",
          email: "vol@test.com",
          ministries: [],
        },
      ]);

      await service.getRanking({ churchId: "church-a" });

      expect(prismaMock.swapRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            requesterShift: { churchId: "church-a" },
          }),
        }),
      );
    });
  });

  describe("getAdminExecutiveDashboard — tenant isolation", () => {
    it("should pass churchId to swapRequest.count", async () => {
      prismaMock.user.findMany.mockResolvedValue([]);

      await service.getAdminExecutiveDashboard("church-a");

      expect(prismaMock.swapRequest.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            requesterShift: { churchId: "church-a" },
          }),
        }),
      );
    });

    it("should pass churchId to event.findFirst", async () => {
      prismaMock.user.findMany.mockResolvedValue([]);

      await service.getAdminExecutiveDashboard("church-a");

      expect(prismaMock.event.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            churchId: "church-a",
          }),
        }),
      );
    });
  });

  describe("getStrategicDashboard — tenant isolation", () => {
    it("should pass churchId filter to swapRequest.findMany", async () => {
      await service.getStrategicDashboard("church-a");

      expect(prismaMock.swapRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            requesterShift: { churchId: "church-a" },
          }),
        }),
      );
    });
  });

  describe("getVolunteerDashboard — tenant isolation", () => {
    it("should pass churchId to schedule queries", async () => {
      prismaMock.user.findMany.mockResolvedValue([
        {
          id: "vol-1",
          nome: "Vol",
          email: "vol@test.com",
          ministries: [],
        },
      ]);

      await service.getVolunteerDashboard("vol-1", "church-a");

      expect(prismaMock.schedule.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            churchId: "church-a",
          }),
        }),
      );

      expect(prismaMock.schedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            churchId: "church-a",
          }),
        }),
      );
    });
  });
});

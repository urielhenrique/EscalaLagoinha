import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { SwapRequestsService } from "./swap-requests.service";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AvailabilityService } from "../availability/availability.service";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { Perfil } from "@prisma/client";

describe("SwapRequestsService — Business Rules", () => {
  let service: SwapRequestsService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  function createPrismaMock() {
    return {
      schedule: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      swapRequest: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    };
  }

  const userA: JwtPayload = {
    sub: "user-a",
    email: "a@test.com",
    perfil: Perfil.VOLUNTARIO,
    churchId: "church-a",
    churchSlug: "church-a",
  };

  const userB: JwtPayload = {
    sub: "user-b",
    email: "b@test.com",
    perfil: Perfil.VOLUNTARIO,
    churchId: "church-a",
    churchSlug: "church-a",
  };

  beforeEach(async () => {
    prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SwapRequestsService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: NotificationsService,
          useValue: {
            notifySwapRequest: jest.fn(),
            notifySwapApproved: jest.fn(),
            notifySwapDeclined: jest.fn(),
            notifySwapAutoCompletedToLeader: jest.fn(),
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

    service = module.get<SwapRequestsService>(SwapRequestsService);
  });

  describe("create — business rules", () => {
    it("should reject self-swap", async () => {
      prismaMock.schedule.findUnique
        .mockResolvedValueOnce({
          id: "s1",
          churchId: "church-a",
          volunteerId: "user-a",
          ministryId: "m1",
          status: "CONFIRMADO",
          event: { dataInicio: new Date("2026-10-01T19:00:00Z"), dataFim: new Date("2026-10-01T21:00:00Z") },
        })
        .mockResolvedValueOnce({
          id: "s2",
          churchId: "church-a",
          volunteerId: "user-a",
          ministryId: "m1",
          status: "CONFIRMADO",
          event: { dataInicio: new Date("2026-10-02T19:00:00Z"), dataFim: new Date("2026-10-02T21:00:00Z") },
        });

      await expect(
        service.create(
          {
            requesterShiftId: "s1",
            requestedShiftId: "s2",
            requestedVolunteerId: "user-a",
          },
          userA,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject swap with different ministry", async () => {
      prismaMock.schedule.findUnique
        .mockResolvedValueOnce({
          id: "s1",
          churchId: "church-a",
          volunteerId: "user-a",
          ministryId: "m-foto",
          status: "CONFIRMADO",
          event: { dataInicio: new Date("2026-10-01T19:00:00Z"), dataFim: new Date("2026-10-01T21:00:00Z") },
        })
        .mockResolvedValueOnce({
          id: "s2",
          churchId: "church-a",
          volunteerId: "user-b",
          ministryId: "m-video",
          status: "CONFIRMADO",
          event: { dataInicio: new Date("2026-10-02T19:00:00Z"), dataFim: new Date("2026-10-02T21:00:00Z") },
        });

      await expect(
        service.create(
          {
            requesterShiftId: "s1",
            requestedShiftId: "s2",
            requestedVolunteerId: "user-b",
          },
          userA,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject swap of cancelled schedule", async () => {
      prismaMock.schedule.findUnique
        .mockResolvedValueOnce({
          id: "s1",
          churchId: "church-a",
          volunteerId: "user-a",
          ministryId: "m1",
          status: "CANCELADO",
          event: { dataInicio: new Date("2026-10-01T19:00:00Z"), dataFim: new Date("2026-10-01T21:00:00Z") },
        })
        .mockResolvedValueOnce({
          id: "s2",
          churchId: "church-a",
          volunteerId: "user-b",
          ministryId: "m1",
          status: "CONFIRMADO",
          event: { dataInicio: new Date("2026-10-02T19:00:00Z"), dataFim: new Date("2026-10-02T21:00:00Z") },
        });

      await expect(
        service.create(
          {
            requesterShiftId: "s1",
            requestedShiftId: "s2",
            requestedVolunteerId: "user-b",
          },
          userA,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("create — tenant isolation", () => {
    it("should reject swap request from schedules of different churches", async () => {
      prismaMock.schedule.findUnique
        .mockResolvedValueOnce({
          id: "s1",
          churchId: "church-a",
          volunteerId: "user-a",
          ministryId: "m1",
          status: "CONFIRMADO",
          event: { dataInicio: new Date("2026-10-01T19:00:00Z"), dataFim: new Date("2026-10-01T21:00:00Z") },
        })
        .mockResolvedValueOnce(null);

      await expect(
        service.create(
          {
            requesterShiftId: "s1",
            requestedShiftId: "s2-from-church-b",
            requestedVolunteerId: "user-c",
          },
          userA,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("approve — authorization", () => {
    it("should reject approval from non-requested volunteer", async () => {
      prismaMock.swapRequest.findFirst.mockResolvedValue({
        id: "swap-1",
        requesterShiftId: "s1",
        requesterId: "user-a",
        requestedShiftId: "s2",
        requestedVolunteerId: "user-b",
        status: "PENDENTE",
        requesterShift: {},
        requestedShift: {},
        requester: { nome: "User A" },
        requestedVolunteer: { nome: "User B" },
      });

      await expect(service.approve("swap-1", userA)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("cancel — authorization", () => {
    it("should reject cancel from non-requester", async () => {
      prismaMock.swapRequest.findFirst.mockResolvedValue({
        id: "swap-1",
        requesterShiftId: "s1",
        requesterId: "user-a",
        requestedShiftId: "s2",
        requestedVolunteerId: "user-b",
        status: "PENDENTE",
        requesterShift: {},
        requestedShift: {},
        requester: { nome: "User A" },
        requestedVolunteer: { nome: "User B" },
      });

      await expect(service.cancel("swap-1", userB)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("assertNoEventConflict — tenant isolation", () => {
    it("should only check conflicts within the same church", async () => {
      prismaMock.swapRequest.findFirst.mockResolvedValue({
        id: "swap-1",
        requesterShiftId: "s1",
        requesterId: "user-a",
        requestedShiftId: "s2",
        requestedVolunteerId: "user-b",
        status: "PENDENTE",
        requesterShift: {
          id: "s1",
          churchId: "church-a",
          volunteerId: "user-a",
          ministryId: "m1",
          status: "CONFIRMADO",
          event: { dataInicio: new Date("2026-10-01T19:00:00Z"), dataFim: new Date("2026-10-01T21:00:00Z"), nome: "Culto A" },
          ministry: { id: "m1", nome: "Foto" },
        },
        requestedShift: {
          id: "s2",
          churchId: "church-a",
          volunteerId: "user-b",
          ministryId: "m1",
          status: "CONFIRMADO",
          event: { dataInicio: new Date("2026-10-02T19:00:00Z"), dataFim: new Date("2026-10-02T21:00:00Z"), nome: "Culto B" },
          ministry: { id: "m1", nome: "Foto" },
        },
        requester: { nome: "User A" },
        requestedVolunteer: { nome: "User B" },
      });

      prismaMock.schedule.findUnique
        .mockResolvedValueOnce({
          id: "s1", churchId: "church-a", volunteerId: "user-a", ministryId: "m1", status: "CONFIRMADO",
          event: { dataInicio: new Date("2026-10-01T19:00:00Z"), dataFim: new Date("2026-10-01T21:00:00Z") },
        })
        .mockResolvedValueOnce({
          id: "s2", churchId: "church-a", volunteerId: "user-b", ministryId: "m1", status: "CONFIRMADO",
          event: { dataInicio: new Date("2026-10-02T19:00:00Z"), dataFim: new Date("2026-10-02T21:00:00Z") },
        });

      prismaMock.user.findUnique.mockResolvedValue({
        id: "user-b", ativo: true, churchId: "church-a",
      });

      prismaMock.schedule.findFirst.mockResolvedValue(null);

      prismaMock.$transaction.mockImplementation(async (cb: (tx: Record<string, Record<string, jest.Mock>>) => Promise<unknown>) => {
        return cb({
          schedule: { update: jest.fn().mockResolvedValue({}) },
          swapRequest: { update: jest.fn().mockResolvedValue({ id: "swap-1", status: "APROVADO" }) },
        });
      });

      await service.approve("swap-1", userB);

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

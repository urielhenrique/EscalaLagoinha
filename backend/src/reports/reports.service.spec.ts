import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { Perfil } from "@prisma/client";

describe("ReportsService — Cross-Tenant Isolation", () => {
  let service: ReportsService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  function createPrismaMock() {
    return {
      schedule: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
  }

  const churchA: JwtPayload = {
    sub: "admin-a",
    email: "admin-a@test.com",
    perfil: Perfil.ADMIN,
    churchId: "church-a",
    churchSlug: "church-a",
  };

  beforeEach(async () => {
    prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: AuditLogsService,
          useValue: { log: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  describe("getOverview — tenant isolation", () => {
    it("should use churchId from JWT, not from client", async () => {
      await service.getOverview({}, churchA);

      expect(prismaMock.schedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            churchId: "church-a",
          }),
        }),
      );
    });

    it("should never return data from another church", async () => {
      prismaMock.schedule.findMany.mockResolvedValue([]);

      const result = await service.getOverview({}, churchA);

      expect(result.totals.schedules).toBe(0);
    });

    it("should use churchId from JWT even if query has ministryId", async () => {
      await service.getOverview({ ministryId: "ministry-a" }, churchA);

      expect(prismaMock.schedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            churchId: "church-a",
            ministryId: "ministry-a",
          }),
        }),
      );
    });

    it("should filter volunteers by churchId", async () => {
      await service.getOverview({}, churchA);

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            churchId: "church-a",
          }),
        }),
      );
    });
  });

  describe("getChurchIdOrThrow — security", () => {
    it("should throw ForbiddenException when user has no churchId", async () => {
      const userWithoutChurch: JwtPayload = {
        sub: "user-1",
        email: "user@test.com",
        perfil: Perfil.MASTER_PLATFORM_ADMIN,
      };

      await expect(
        service.getOverview({}, userWithoutChurch),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("logExport — tenant attribution", () => {
    it("should pass churchId to audit log", async () => {
      const auditLogsService = {
        log: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ReportsService,
          { provide: PrismaService, useValue: prismaMock },
          { provide: AuditLogsService, useValue: auditLogsService },
        ],
      }).compile();

      const svc = module.get<ReportsService>(ReportsService);

      await svc.logExport("user-1", "csv", {}, "church-a");

      expect(auditLogsService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          churchId: "church-a",
        }),
      );
    });
  });
});

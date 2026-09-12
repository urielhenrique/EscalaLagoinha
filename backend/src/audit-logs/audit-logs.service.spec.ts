import { Test, TestingModule } from "@nestjs/testing";
import { AuditLogsService } from "./audit-logs.service";
import { PrismaService } from "../prisma/prisma.service";

describe("AuditLogsService — Tenant Isolation", () => {
  let service: AuditLogsService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  function createPrismaMock() {
    return {
      auditLog: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
  }

  beforeEach(async () => {
    prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<AuditLogsService>(AuditLogsService);
  });

  describe("list — tenant isolation", () => {
    it("should filter logs by churchId when provided", async () => {
      await service.list({ churchId: "church-a" });

      expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            churchId: "church-a",
          }),
        }),
      );
    });

    it("should not filter by churchId when undefined (MASTER_PLATFORM_ADMIN)", async () => {
      await service.list({ churchId: undefined });

      expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            churchId: undefined,
          }),
        }),
      );
    });

    it("should never return logs from another church", async () => {
      const logFromChurchB = {
        id: "log-1",
        userId: "user-b",
        churchId: "church-b",
        action: "LOGIN",
        module: "AUTH",
        targetId: null,
        oldValue: null,
        newValue: null,
        createdAt: new Date(),
      };

      prismaMock.auditLog.findMany.mockImplementation(async (args: { where: { churchId?: string } }) => {
        if (args.where.churchId === "church-a") return [];
        return [logFromChurchB];
      });

      const result = await service.list({ churchId: "church-a" });

      expect(result).toEqual([]);
    });
  });

  describe("log — churchId attribution", () => {
    it("should save churchId when provided", async () => {
      await service.log({
        userId: "user-1",
        churchId: "church-a",
        action: "LOGIN",
        module: "AUTH",
      });

      expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          churchId: "church-a",
        }),
      });
    });
  });
});

import { Test, TestingModule } from "@nestjs/testing";
import { HelpCenterService } from "./help-center.service";
import { PrismaService } from "../prisma/prisma.service";
import { FeedbackType } from "@prisma/client";

describe("HelpCenterService — Cross-Tenant Isolation", () => {
  let service: HelpCenterService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  function createPrismaMock() {
    return {
      helpArticle: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      userFeedback: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
  }

  beforeEach(async () => {
    prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HelpCenterService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<HelpCenterService>(HelpCenterService);
  });

  describe("listFeedbacks — tenant isolation", () => {
    it("should filter feedback by churchId when provided", async () => {
      await service.listFeedbacks(undefined, undefined, "church-a");

      expect(prismaMock.userFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            churchId: "church-a",
          }),
        }),
      );
    });

    it("should not filter by churchId when undefined (MASTER_PLATFORM_ADMIN)", async () => {
      await service.listFeedbacks(undefined, undefined, undefined);

      expect(prismaMock.userFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            churchId: expect.anything(),
          }),
        }),
      );
    });

    it("should never return feedback from another church", async () => {
      const feedbackFromChurchB = {
        id: "fb-1",
        userId: "user-b",
        churchId: "church-b",
        tipo: "BUG",
        titulo: "Bug from church B",
        descricao: "...",
        status: "PENDENTE",
        createdAt: new Date(),
        user: { id: "user-b", nome: "User B", email: "b@test.com" },
        church: { id: "church-b", nome: "Church B" },
      };

      prismaMock.userFeedback.findMany.mockImplementation(
        async (args: { where: { churchId?: string } }) => {
          if (args.where.churchId === "church-a") return [];
          return [feedbackFromChurchB];
        },
      );

      const result = await service.listFeedbacks(
        undefined,
        undefined,
        "church-a",
      );

      expect(result).toEqual([]);
    });
  });

  describe("submitFeedback — churchId stamping", () => {
    it("should stamp churchId from user on feedback creation", async () => {
      prismaMock.userFeedback.create.mockResolvedValue({});

      await service.submitFeedback(
        { tipo: FeedbackType.BUG_REPORT, titulo: "Test", descricao: "Test desc" },
        {
          sub: "user-1",
          email: "user@test.com",
          perfil: "VOLUNTARIO",
          churchId: "church-a",
          churchSlug: "church-a",
        },
      );

      expect(prismaMock.userFeedback.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          churchId: "church-a",
        }),
      });
    });
  });
});

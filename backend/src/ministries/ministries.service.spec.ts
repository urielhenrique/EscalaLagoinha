import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { Perfil } from "@prisma/client";
import { MinistriesService } from "./ministries.service";
import { PrismaService } from "../prisma/prisma.service";
import { JwtPayload } from "../auth/strategies/jwt.strategy";

describe("MinistriesService", () => {
  let service: MinistriesService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  function createPrismaMock() {
    return {
      ministry: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };
  }

  const adminUser: JwtPayload = {
    sub: "admin-1",
    email: "admin@test.com",
    perfil: Perfil.ADMIN,
    churchId: "church-1",
    churchSlug: "church-1",
  };

  const masterAdminUser: JwtPayload = {
    sub: "master-1",
    email: "master@test.com",
    perfil: Perfil.MASTER_ADMIN,
    churchId: "church-1",
    churchSlug: "church-1",
  };

  const leaderUser: JwtPayload = {
    sub: "leader-1",
    email: "leader@test.com",
    perfil: Perfil.LEADER,
    churchId: "church-1",
    churchSlug: "church-1",
  };

  const volunteerUser: JwtPayload = {
    sub: "vol-1",
    email: "vol@test.com",
    perfil: Perfil.VOLUNTARIO,
    churchId: "church-1",
    churchSlug: "church-1",
  };

  const leaderFromOtherChurch: JwtPayload = {
    sub: "leader-other",
    email: "leader-other@test.com",
    perfil: Perfil.LEADER,
    churchId: "church-2",
    churchSlug: "church-2",
  };

  const ministry = {
    id: "ministry-1",
    churchId: "church-1",
    nome: "Projeção",
    descricao: "Ministério de projeção",
    leaderId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    leader: null,
    members: [],
  };

  beforeEach(async () => {
    prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MinistriesService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<MinistriesService>(MinistriesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("update() — leader assignment", () => {
    beforeEach(() => {
      prismaMock.ministry.findFirst.mockResolvedValue(ministry);
      prismaMock.ministry.update.mockResolvedValue(ministry);
    });

    it("should assign a LEADER as ministry leader", async () => {
      prismaMock.user.findFirst.mockResolvedValue({
        id: "leader-1",
        perfil: Perfil.LEADER,
      });
      prismaMock.ministry.update.mockResolvedValue({
        ...ministry,
        leaderId: "leader-1",
      });

      const result = await service.update(
        "ministry-1",
        { leaderId: "leader-1" },
        adminUser,
      );

      expect(result.leaderId).toBe("leader-1");
      expect(prismaMock.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: "leader-1",
            ativo: true,
            churchId: "church-1",
          }),
        }),
      );
    });

    it("should reject VOLUNTARIO as ministry leader", async () => {
      prismaMock.user.findFirst.mockResolvedValue({
        id: "vol-1",
        perfil: Perfil.VOLUNTARIO,
      });

      await expect(
        service.update("ministry-1", { leaderId: "vol-1" }, adminUser),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject ADMIN as ministry leader", async () => {
      prismaMock.user.findFirst.mockResolvedValue({
        id: "admin-2",
        perfil: Perfil.ADMIN,
      });

      await expect(
        service.update("ministry-1", { leaderId: "admin-2" }, adminUser),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject MASTER_ADMIN as ministry leader", async () => {
      prismaMock.user.findFirst.mockResolvedValue({
        id: "master-1",
        perfil: Perfil.MASTER_ADMIN,
      });

      await expect(
        service.update("ministry-1", { leaderId: "master-1" }, adminUser),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject MASTER_PLATFORM_ADMIN as ministry leader", async () => {
      prismaMock.user.findFirst.mockResolvedValue({
        id: "master-platform-1",
        perfil: Perfil.MASTER_PLATFORM_ADMIN,
      });

      await expect(
        service.update(
          "ministry-1",
          { leaderId: "master-platform-1" },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should reject non-existent user as ministry leader", async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(
        service.update("ministry-1", { leaderId: "nonexistent" }, adminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it("should reject LEADER from another church", async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(
        service.update(
          "ministry-1",
          { leaderId: "leader-other" },
          adminUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("should remove leader with leaderId = null", async () => {
      prismaMock.ministry.update.mockResolvedValue({
        ...ministry,
        leaderId: null,
      });

      const result = await service.update(
        "ministry-1",
        { leaderId: null },
        adminUser,
      );

      expect(result.leaderId).toBeNull();
      expect(prismaMock.ministry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            leaderId: null,
          }),
        }),
      );
    });

    it("should keep leaderId unchanged when field is not sent", async () => {
      prismaMock.ministry.findFirst.mockResolvedValue({
        ...ministry,
        leaderId: "existing-leader",
      });
      prismaMock.ministry.update.mockResolvedValue({
        ...ministry,
        leaderId: "existing-leader",
      });

      await service.update(
        "ministry-1",
        { nome: "Novo Nome" },
        adminUser,
      );

      expect(prismaMock.ministry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            leaderId: undefined,
          }),
        }),
      );
    });

    it("should reject update when ministry not found", async () => {
      prismaMock.ministry.findFirst.mockResolvedValue(null);

      await expect(
        service.update("nonexistent", { leaderId: "leader-1" }, adminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it("should reject update when ministry belongs to another church", async () => {
      prismaMock.ministry.findFirst.mockResolvedValue(null);

      const otherChurchUser: JwtPayload = {
        sub: "admin-2",
        email: "admin2@test.com",
        perfil: Perfil.ADMIN,
        churchId: "church-2",
        churchSlug: "church-2",
      };

      await expect(
        service.update("ministry-1", { leaderId: "leader-1" }, otherChurchUser),
      ).rejects.toThrow(NotFoundException);
    });

    it("should swap LEADER for another LEADER", async () => {
      prismaMock.user.findFirst.mockResolvedValue({
        id: "leader-2",
        perfil: Perfil.LEADER,
      });
      prismaMock.ministry.update.mockResolvedValue({
        ...ministry,
        leaderId: "leader-2",
      });

      const result = await service.update(
        "ministry-1",
        { leaderId: "leader-2" },
        adminUser,
      );

      expect(result.leaderId).toBe("leader-2");
    });
  });

  describe("findAllVisible()", () => {
    it("should return all ministries for ADMIN", async () => {
      prismaMock.ministry.findMany.mockResolvedValue([ministry]);

      const result = await service.findAllVisible(adminUser);

      expect(result).toHaveLength(1);
      expect(prismaMock.ministry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ churchId: "church-1" }),
        }),
      );
    });

    it("should return all ministries for MASTER_ADMIN", async () => {
      prismaMock.ministry.findMany.mockResolvedValue([ministry]);

      const result = await service.findAllVisible(masterAdminUser);

      expect(result).toHaveLength(1);
    });

    it("should return only led ministries for LEADER", async () => {
      const ledMinistry = { ...ministry, leaderId: "leader-1" };
      prismaMock.ministry.findMany.mockResolvedValue([ledMinistry]);

      const result = await service.findAllVisible(leaderUser);

      expect(result).toHaveLength(1);
      expect(prismaMock.ministry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            churchId: "church-1",
            OR: [
              { leaderId: "leader-1" },
              { members: { some: { id: "leader-1" } } },
            ],
          }),
        }),
      );
    });

    it("should return only member ministries for VOLUNTARIO", async () => {
      const memberMinistry = { ...ministry, leaderId: "leader-other" };
      prismaMock.ministry.findMany.mockResolvedValue([memberMinistry]);

      const result = await service.findAllVisible(volunteerUser);

      expect(result).toHaveLength(1);
      expect(prismaMock.ministry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            churchId: "church-1",
            OR: [
              { leaderId: "vol-1" },
              { members: { some: { id: "vol-1" } } },
            ],
          }),
        }),
      );
    });

    it("should not return ministries from another church", async () => {
      prismaMock.ministry.findMany.mockResolvedValue([]);

      const result = await service.findAllVisible(leaderFromOtherChurch);

      expect(result).toHaveLength(0);
      expect(prismaMock.ministry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ churchId: "church-2" }),
        }),
      );
    });
  });
});

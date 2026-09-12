import { Test, TestingModule } from "@nestjs/testing";
import { ConflictException, ForbiddenException } from "@nestjs/common";
import { AvailabilityService } from "./availability.service";
import { PrismaService } from "../prisma/prisma.service";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import {
  Perfil,
  AvailabilityPreference,
  MinistryPreferenceType,
} from "@prisma/client";

describe("AvailabilityService — Business Rules", () => {
  let service: AvailabilityService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  function createPrismaMock() {
    return {
      user: {
        findUnique: jest.fn(),
      },
      volunteerAvailability: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      blockedDate: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        createMany: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      volunteerMinistryPreference: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      ministry: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((fns: unknown[]) =>
        Promise.all(fns),
      ),
    };
  }

  const adminUser: JwtPayload = {
    sub: "admin-1",
    email: "admin@test.com",
    perfil: Perfil.ADMIN,
    churchId: "church-a",
    churchSlug: "church-a",
  };

  beforeEach(async () => {
    prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<AvailabilityService>(AvailabilityService);
  });

  describe("ensureVolunteer — role restriction", () => {
    it("should throw ForbiddenException for ADMIN users", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: "admin-1",
        perfil: Perfil.ADMIN,
        ativo: true,
        churchId: "church-a",
      });

      await expect(
        service.upsertWeekly(adminUser, { slots: [] }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw ForbiddenException for MASTER_ADMIN users", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: "master-1",
        perfil: Perfil.MASTER_ADMIN,
        ativo: true,
        churchId: "church-a",
      });

      const masterUser: JwtPayload = {
        ...adminUser,
        sub: "master-1",
        perfil: Perfil.MASTER_ADMIN,
      };

      await expect(
        service.upsertWeekly(masterUser, { slots: [] }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("assertVolunteerAvailable — business rules", () => {
    it("should throw ConflictException when date is blocked", async () => {
      prismaMock.blockedDate.findFirst.mockResolvedValue({
        id: "bd-1",
        reason: "Férias",
        date: new Date("2026-10-05"),
      });
      prismaMock.volunteerAvailability.findMany.mockResolvedValue([]);
      prismaMock.volunteerAvailability.count.mockResolvedValue(0);
      prismaMock.volunteerMinistryPreference.findMany.mockResolvedValue([]);

      await expect(
        service.assertVolunteerAvailable({
          volunteerId: "vol-1",
          eventStart: new Date("2026-10-05T19:00:00Z"),
          eventEnd: new Date("2026-10-05T21:00:00Z"),
          ministryId: "m1",
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("should allow scheduling when no availability configured (default: available)", async () => {
      prismaMock.blockedDate.findFirst.mockResolvedValue(null);
      prismaMock.volunteerAvailability.findMany.mockResolvedValue([]);
      prismaMock.volunteerAvailability.count.mockResolvedValue(0);
      prismaMock.volunteerMinistryPreference.findMany.mockResolvedValue([]);

      await expect(
        service.assertVolunteerAvailable({
          volunteerId: "vol-1",
          eventStart: new Date("2026-10-05T19:00:00Z"),
          eventEnd: new Date("2026-10-05T21:00:00Z"),
          ministryId: "m1",
        }),
      ).resolves.toBeUndefined();
    });

    it("should throw ConflictException when day/period is INDISPONIVEL", async () => {
      prismaMock.blockedDate.findFirst.mockResolvedValue(null);
      prismaMock.volunteerAvailability.findMany.mockResolvedValue([
        { preference: AvailabilityPreference.INDISPONIVEL },
      ]);
      prismaMock.volunteerAvailability.count.mockResolvedValue(1);
      prismaMock.volunteerMinistryPreference.findMany.mockResolvedValue([]);

      await expect(
        service.assertVolunteerAvailable({
          volunteerId: "vol-1",
          eventStart: new Date("2026-10-05T19:00:00Z"),
          eventEnd: new Date("2026-10-05T21:00:00Z"),
          ministryId: "m1",
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("should throw ConflictException when ministry is INDISPONIVEL", async () => {
      prismaMock.blockedDate.findFirst.mockResolvedValue(null);
      prismaMock.volunteerAvailability.findMany.mockResolvedValue([]);
      prismaMock.volunteerAvailability.count.mockResolvedValue(0);
      prismaMock.volunteerMinistryPreference.findMany.mockResolvedValue([
        { type: MinistryPreferenceType.INDISPONIVEL },
      ]);

      await expect(
        service.assertVolunteerAvailable({
          volunteerId: "vol-1",
          eventStart: new Date("2026-10-05T19:00:00Z"),
          eventEnd: new Date("2026-10-05T21:00:00Z"),
          ministryId: "m1",
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});

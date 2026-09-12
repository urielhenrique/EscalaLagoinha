import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { EmailService } from "../email/email.service";
import { PasswordResetService } from "./password-reset.service";
import { OnboardingChurchDto } from "./dto/onboarding-church.dto";

describe("AuthService - Onboarding Restriction", () => {
  let service: AuthService;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  const mockOnboardingDto: OnboardingChurchDto = {
    churchName: "Test Church",
    churchSlug: "test-church",
    churchAddress: "123 Main St",
    churchCity: "Test City",
    churchState: "TS",
    responsibleName: "Pastor Test",
    adminName: "Admin Test",
    adminEmail: "admin@test.com",
    adminPhone: "(11) 99999-9999",
    adminPassword: "Admin@123",
  };

  function createPrismaMock() {
    return {
      church: {
        count: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      ministry: {
        create: jest.fn(),
      },
      notification: {
        create: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((fns: unknown[]) =>
        Promise.all(fns),
      ),
    };
  }

  beforeEach(async () => {
    prismaMock = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest
              .fn()
              .mockReturnValue("test-secret-key-at-least-32-chars-long"),
            get: jest.fn().mockReturnValue("7d"),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendPasswordReset: jest.fn(),
            sendVolunteerWelcome: jest.fn(),
            sendVolunteerRejection: jest.fn(),
            sendSwapRequest: jest.fn(),
            sendSwapAccepted: jest.fn(),
            sendSwapRejected: jest.fn(),
          },
        },
        {
          provide: PasswordResetService,
          useValue: {
            generateToken: jest.fn(),
            validateToken: jest.fn(),
            markAsUsed: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe("onboardChurch", () => {
    it("should throw BadRequestException when churches already exist", async () => {
      prismaMock.church.count.mockResolvedValue(1);

      await expect(service.onboardChurch(mockOnboardingDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.onboardChurch(mockOnboardingDto)).rejects.toThrow(
        "Onboarding público indisponível",
      );
    });

    it("should proceed when no churches exist and slug is available", async () => {
      prismaMock.church.count.mockResolvedValue(0);
      prismaMock.church.findUnique.mockResolvedValue(null);
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.church.create.mockResolvedValue({
        id: "church-id",
        slug: "test-church",
      });
      prismaMock.user.create.mockResolvedValue({
        id: "user-id",
        email: "admin@test.com",
      });
      prismaMock.ministry.create.mockResolvedValue({});

      try {
        await service.onboardChurch(mockOnboardingDto);
      } catch (error) {
        expect(error).not.toBeInstanceOf(BadRequestException);
      }
    });
  });
});

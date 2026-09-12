import { Test, TestingModule } from "@nestjs/testing";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { RolesGuard } from "./roles.guard";
import { Reflector } from "@nestjs/core";
import { Perfil } from "@prisma/client";

describe("RolesGuard", () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  it("should be defined", () => {
    expect(guard).toBeDefined();
  });

  describe("canActivate", () => {
    it("should allow access when no roles are required", () => {
      jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(undefined);
      const context = createMockContext({ perfil: Perfil.ADMIN });
      expect(guard.canActivate(context)).toBe(true);
    });

    it("should allow access when user has required role", () => {
      jest
        .spyOn(reflector, "getAllAndOverride")
        .mockReturnValue([Perfil.ADMIN]);
      const context = createMockContext({ perfil: Perfil.ADMIN });
      expect(guard.canActivate(context)).toBe(true);
    });

    it("should throw ForbiddenException when user lacks required role", () => {
      jest
        .spyOn(reflector, "getAllAndOverride")
        .mockReturnValue([Perfil.MASTER_PLATFORM_ADMIN]);
      const context = createMockContext({ perfil: Perfil.ADMIN });
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it("should throw ForbiddenException when user has no perfil", () => {
      jest
        .spyOn(reflector, "getAllAndOverride")
        .mockReturnValue([Perfil.ADMIN]);
      const context = createMockContext({});
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it("should allow MASTER_PLATFORM_ADMIN access to any role", () => {
      jest
        .spyOn(reflector, "getAllAndOverride")
        .mockReturnValue([Perfil.ADMIN]);
      const context = createMockContext({
        perfil: Perfil.MASTER_PLATFORM_ADMIN,
      });
      expect(guard.canActivate(context)).toBe(true);
    });
  });
});

function createMockContext(user: Partial<{ perfil: Perfil }>): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({ user }),
    }),
  } as unknown as ExecutionContext;
}

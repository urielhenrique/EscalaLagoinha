import { Test, TestingModule } from "@nestjs/testing";
import { ExecutionContext } from "@nestjs/common";
import { JwtAuthGuard, IS_PUBLIC_KEY } from "./jwt-auth.guard";
import { Reflector } from "@nestjs/core";

describe("JwtAuthGuard", () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  it("should be defined", () => {
    expect(guard).toBeDefined();
  });

  describe("canActivate", () => {
    it("should return true when @Public() decorator is present", () => {
      jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(true);
      const context = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as unknown as ExecutionContext;

      expect(guard.canActivate(context)).toBe(true);
    });

    it("should call super.canActivate when @Public() is not present", () => {
      jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(false);
      const context = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            headers: { authorization: "Bearer test-token" },
          }),
        }),
      } as unknown as ExecutionContext;

      const superCanActivate = jest
        .spyOn(
          Object.getPrototypeOf(Object.getPrototypeOf(guard)),
          "canActivate",
        )
        .mockReturnValue(true);

      guard.canActivate(context);
      expect(superCanActivate).toHaveBeenCalled();
    });

    it("should pass IS_PUBLIC_KEY to reflector correctly", () => {
      jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(true);
      const context = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as unknown as ExecutionContext;

      guard.canActivate(context);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
    });
  });
});

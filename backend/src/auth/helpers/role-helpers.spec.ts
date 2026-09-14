import { ForbiddenException } from "@nestjs/common";
import { Perfil } from "@prisma/client";
import {
  isGlobalAdmin,
  isChurchAdmin,
  isLeader,
  getChurchIdOrThrow,
} from "./role-helpers";
import type { JwtPayload } from "../strategies/jwt.strategy";

function makeUser(overrides: Partial<JwtPayload>): JwtPayload {
  return {
    sub: "user-1",
    email: "test@test.com",
    perfil: Perfil.VOLUNTARIO,
    churchId: "church-1",
    ...overrides,
  };
}

describe("role-helpers", () => {
  describe("isGlobalAdmin", () => {
    it("should return true for MASTER_PLATFORM_ADMIN", () => {
      expect(isGlobalAdmin(makeUser({ perfil: Perfil.MASTER_PLATFORM_ADMIN }))).toBe(true);
    });

    it("should return true for MASTER_ADMIN", () => {
      expect(isGlobalAdmin(makeUser({ perfil: Perfil.MASTER_ADMIN }))).toBe(true);
    });

    it("should return false for ADMIN", () => {
      expect(isGlobalAdmin(makeUser({ perfil: Perfil.ADMIN }))).toBe(false);
    });

    it("should return false for LEADER", () => {
      expect(isGlobalAdmin(makeUser({ perfil: Perfil.LEADER }))).toBe(false);
    });

    it("should return false for VOLUNTARIO", () => {
      expect(isGlobalAdmin(makeUser({ perfil: Perfil.VOLUNTARIO }))).toBe(false);
    });
  });

  describe("isChurchAdmin", () => {
    it("should return true for MASTER_PLATFORM_ADMIN", () => {
      expect(isChurchAdmin(makeUser({ perfil: Perfil.MASTER_PLATFORM_ADMIN }))).toBe(true);
    });

    it("should return true for MASTER_ADMIN", () => {
      expect(isChurchAdmin(makeUser({ perfil: Perfil.MASTER_ADMIN }))).toBe(true);
    });

    it("should return true for ADMIN", () => {
      expect(isChurchAdmin(makeUser({ perfil: Perfil.ADMIN }))).toBe(true);
    });

    it("should return false for LEADER", () => {
      expect(isChurchAdmin(makeUser({ perfil: Perfil.LEADER }))).toBe(false);
    });

    it("should return false for VOLUNTARIO", () => {
      expect(isChurchAdmin(makeUser({ perfil: Perfil.VOLUNTARIO }))).toBe(false);
    });
  });

  describe("isLeader", () => {
    it("should return true for LEADER", () => {
      expect(isLeader(makeUser({ perfil: Perfil.LEADER }))).toBe(true);
    });

    it("should return false for ADMIN", () => {
      expect(isLeader(makeUser({ perfil: Perfil.ADMIN }))).toBe(false);
    });

    it("should return false for MASTER_ADMIN", () => {
      expect(isLeader(makeUser({ perfil: Perfil.MASTER_ADMIN }))).toBe(false);
    });

    it("should return false for MASTER_PLATFORM_ADMIN", () => {
      expect(isLeader(makeUser({ perfil: Perfil.MASTER_PLATFORM_ADMIN }))).toBe(false);
    });

    it("should return false for VOLUNTARIO", () => {
      expect(isLeader(makeUser({ perfil: Perfil.VOLUNTARIO }))).toBe(false);
    });
  });

  describe("getChurchIdOrThrow", () => {
    it("should return churchId when present", () => {
      const user = makeUser({ churchId: "church-1" });
      expect(getChurchIdOrThrow(user)).toBe("church-1");
    });

    it("should throw ForbiddenException when churchId is undefined", () => {
      const user = makeUser({ churchId: undefined });
      expect(() => getChurchIdOrThrow(user)).toThrow(ForbiddenException);
    });

    it("should throw ForbiddenException when churchId is null", () => {
      const user = makeUser({ churchId: null as unknown as string });
      expect(() => getChurchIdOrThrow(user)).toThrow(ForbiddenException);
    });
  });
});

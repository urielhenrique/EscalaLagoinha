import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { GoogleEncryptionService } from "./google-encryption.service";

describe("GoogleEncryptionService", () => {
  let service: GoogleEncryptionService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        GOOGLE_ENCRYPTION_KEY:
          "test-encryption-key-that-is-long-enough-for-64-chars-minimum-requirement-ok",
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleEncryptionService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<GoogleEncryptionService>(GoogleEncryptionService);
    service.onModuleInit();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("encrypt/decrypt", () => {
    it("should return original value after encrypt then decrypt", () => {
      const plaintext = "ya29.test-access-token-12345";
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("should generate different ciphertext for same plaintext (random IV)", () => {
      const plaintext = "ya29.test-access-token-12345";
      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);
      expect(encrypted1).not.toBe(encrypted2);
    });

    it("should fail to decrypt ciphertext with wrong key", () => {
      const plaintext = "ya29.test-access-token-12345";
      const encrypted = service.encrypt(plaintext);

      const wrongService = new GoogleEncryptionService({
        get: (key: string) => {
          if (key === "GOOGLE_ENCRYPTION_KEY") {
            return "completely-different-key-for-testing-purposes-64chars-min";
          }
          return undefined;
        },
      } as any);
      wrongService.onModuleInit();

      expect(() => wrongService.decrypt(encrypted)).toThrow();
    });

    it("should fail to decrypt tampered ciphertext", () => {
      const plaintext = "ya29.test-access-token-12345";
      const encrypted = service.encrypt(plaintext);

      const parts = encrypted.split(":");
      const tampered = parts[0] + ":" + "AAAA" + ":" + parts[2];
      expect(() => service.decrypt(tampered)).toThrow();
    });

    it("should fail to decrypt with invalid auth tag", () => {
      const plaintext = "ya29.test-access-token-12345";
      const encrypted = service.encrypt(plaintext);

      const parts = encrypted.split(":");
      const tampered = parts[0] + ":" + parts[1] + ":" + "AAAA";
      expect(() => service.decrypt(tampered)).toThrow();
    });

    it("should fail with invalid format (not enough parts)", () => {
      expect(() => service.decrypt("invalid")).toThrow();
    });

    it("should encrypt empty string", () => {
      const plaintext = "";
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("should encrypt long strings", () => {
      const plaintext = "a".repeat(10000);
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("should never store plaintext in encrypted output", () => {
      const plaintext = "ya29.super-secret-token";
      const encrypted = service.encrypt(plaintext);
      expect(encrypted).not.toContain(plaintext);
    });
  });

  describe("isConfigured", () => {
    it("should return true when key is set", () => {
      expect(service.isConfigured()).toBe(true);
    });

    it("should return false when key is not set", () => {
      const unconfiguredService = new GoogleEncryptionService({
        get: () => undefined,
      } as any);
      unconfiguredService.onModuleInit();
      expect(unconfiguredService.isConfigured()).toBe(false);
    });
  });

  describe("assertConfigured", () => {
    it("should not throw when configured", () => {
      expect(() => service.assertConfigured()).not.toThrow();
    });

    it("should throw when not configured", () => {
      const unconfiguredService = new GoogleEncryptionService({
        get: () => undefined,
      } as any);
      unconfiguredService.onModuleInit();
      expect(() => unconfiguredService.assertConfigured()).toThrow(
        "GOOGLE_ENCRYPTION_KEY is not configured",
      );
    });
  });
});

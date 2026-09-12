import {
  Injectable,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const SALT = "google-calendar-encryption";

const SEPARATOR = ":";

@Injectable()
export class GoogleEncryptionService implements OnModuleInit {
  private readonly logger = new Logger(GoogleEncryptionService.name);
  private encryptionKey: Buffer | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const rawKey = this.config.get<string>("GOOGLE_ENCRYPTION_KEY");

    if (!rawKey) {
      this.logger.warn(
        "GOOGLE_ENCRYPTION_KEY not set. Google Calendar token encryption disabled.",
      );
      return;
    }

    this.encryptionKey = scryptSync(rawKey, SALT, KEY_LENGTH);
    this.logger.log("Google Calendar encryption key loaded.");
  }

  encrypt(plaintext: string): string {
    this.assertKeyLoaded();

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(
      ALGORITHM,
      this.encryptionKey!,
      iv,
    );

    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return [
      iv.toString("base64"),
      encrypted.toString("base64"),
      authTag.toString("base64"),
    ].join(SEPARATOR);
  }

  decrypt(encryptedPayload: string): string {
    this.assertKeyLoaded();

    const parts = encryptedPayload.split(SEPARATOR);
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted payload format.");
    }

    const [ivB64, ciphertextB64, authTagB64] = parts;

    const iv = Buffer.from(ivB64, "base64");
    const ciphertext = Buffer.from(ciphertextB64, "base64");
    const authTag = Buffer.from(authTagB64, "base64");

    const decipher = createDecipheriv(
      ALGORITHM,
      this.encryptionKey!,
      iv,
    );
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  }

  isConfigured(): boolean {
    return this.encryptionKey !== null;
  }

  assertConfigured(): void {
    if (!this.encryptionKey) {
      throw new Error(
        "GOOGLE_ENCRYPTION_KEY is not configured. Cannot encrypt/decrypt tokens.",
      );
    }
  }

  private assertKeyLoaded(): void {
    if (!this.encryptionKey) {
      throw new Error(
        "GOOGLE_ENCRYPTION_KEY is not configured. Cannot encrypt/decrypt tokens.",
      );
    }
  }
}

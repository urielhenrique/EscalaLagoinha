import { Injectable, Logger } from "@nestjs/common";
import { randomBytes } from "crypto";

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface PendingState {
  userId: string;
  createdAt: number;
  used: boolean;
}

@Injectable()
export class GoogleOAuthStateService {
  private readonly logger = new Logger(GoogleOAuthStateService.name);
  private readonly states = new Map<string, PendingState>();

  create(userId: string): string {
    this.cleanup();

    const state = randomBytes(32).toString("hex");

    this.states.set(state, {
      userId,
      createdAt: Date.now(),
      used: false,
    });

    this.logger.debug(`OAuth state created for user ${userId}`);
    return state;
  }

  consume(
    state: string,
  ): { userId: string } | { error: string } {
    const entry = this.states.get(state);

    if (!entry) {
      this.cleanup();
      return { error: "State inválido." };
    }

    if (entry.used) {
      return { error: "State já utilizado." };
    }

    if (Date.now() - entry.createdAt > STATE_TTL_MS) {
      this.states.delete(state);
      return { error: "State expirado." };
    }

    entry.used = true;

    return { userId: entry.userId };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.states) {
      if (
        entry.used ||
        now - entry.createdAt > STATE_TTL_MS
      ) {
        this.states.delete(key);
      }
    }
  }
}

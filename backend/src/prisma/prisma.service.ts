import {
  INestApplication,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    const maxRetries = Number(process.env.PRISMA_CONNECT_MAX_RETRIES ?? "10");
    const retryDelayMs = Number(
      process.env.PRISMA_CONNECT_RETRY_DELAY_MS ?? "5000",
    );

    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.$connect();
        this.logger.log("Conexão com PostgreSQL estabelecida.");
        return;
      } catch (error) {
        lastError = error;
        this.logger.error(
          `Falha ao conectar no PostgreSQL (tentativa ${attempt}/${maxRetries}).`,
        );

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }
      }
    }

    throw lastError;
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async enableShutdownHooks(app: INestApplication) {
    process.once("beforeExit", async () => {
      this.logger.warn("Prisma beforeExit recebido. Encerrando aplicação...");
      await app.close();
    });
  }
}

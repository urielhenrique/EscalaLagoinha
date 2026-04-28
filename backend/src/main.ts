import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory, Reflector } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { PrismaService } from "./prisma/prisma.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ["log", "warn", "error", "fatal"],
  });
  const logger = new Logger("Bootstrap");
  const configService = app.get(ConfigService);
  const isProduction = configService.get<string>("NODE_ENV") === "production";
  app.enableShutdownHooks();
  await app.get(PrismaService).enableShutdownHooks(app);

  // ─── Segurança: HTTP headers ────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: isProduction,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // ─── CORS ────────────────────────────────────────────────────────────────────
  const corsOriginsEnv = configService.get<string>("CORS_ORIGINS");
  const frontendUrl = configService.get<string>("FRONTEND_URL");
  const allowedOrigins = corsOriginsEnv
    ? corsOriginsEnv.split(",").map((origin) => origin.trim())
    : frontendUrl
      ? [frontendUrl]
      : ["http://localhost:5173", "http://localhost:5174"];

  if (isProduction && !corsOriginsEnv && !frontendUrl) {
    throw new Error(
      "Defina CORS_ORIGINS ou FRONTEND_URL em produção para habilitar CORS seguro.",
    );
  }

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) {
        if (!isProduction) {
          callback(null, true);
          return;
        }
        callback(new Error("CORS: origem ausente não permitida em produção."));
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origem não permitida — ${origin}`));
      }
    },
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });

  // ─── Proxy confiável (Nginx / Railway / Render) ───────────────────────────
  if (isProduction) {
    app.getHttpAdapter().getInstance().set("trust proxy", 1);
  }

  // ─── Prefixo global + pipes + interceptors + filtros ─────────────────────
  app.setGlobalPrefix("api", {
    exclude: ["health"],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      disableErrorMessages: isProduction,
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new HttpExceptionFilter());

  // ─── Swagger (apenas fora de produção, ou se habilitado) ─────────────────
  if (!isProduction || configService.get<string>("ENABLE_SWAGGER") === "true") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Escala Lagoinha API")
      .setDescription(
        "API para gestão de voluntários, ministérios, eventos e escalas.",
      )
      .setVersion("1.0")
      .addBearerAuth(
        {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Informe o token JWT no formato: Bearer <token>",
        },
        "JWT-auth",
      )
      .addTag("Auth", "Autenticação e sessão")
      .addTag("Users", "Gestão de usuários")
      .addTag("Ministries", "Gestão de ministérios")
      .addTag("Events", "Gestão de eventos")
      .addTag("Schedules", "Gestão de escalas")
      .addTag("Notifications", "Notificações automáticas")
      .addTag("Health", "Health check")
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("docs", app, document);
    logger.log(`Swagger disponível em /docs`);
  }

  const port = configService.get<number>("PORT", 3000);
  await app.listen(port, "0.0.0.0");
  logger.log(
    `Ambiente: ${isProduction ? "PRODUÇÃO" : "desenvolvimento"} | Porta: ${port}`,
  );
  logger.log(`API disponível em http://localhost:${port}/api`);
  logger.log(`Health check em http://localhost:${port}/health`);
}

bootstrap();

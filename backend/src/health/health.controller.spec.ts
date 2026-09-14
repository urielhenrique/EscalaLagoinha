import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";
import { PrismaService } from "../prisma/prisma.service";

describe("CORS bypass for paths without Origin header", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: { $queryRaw: jest.fn().mockResolvedValue([{ "?": 1n }]) },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api", { exclude: ["health"] });

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cors = require("cors");
    const corsFn = cors({
      origin: (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void,
      ) => {
        if (!origin) {
          callback(
            new Error(
              "CORS: origem não informada não é permitida em produção.",
            ),
          );
          return;
        }
        if (origin === "https://app.example.com") {
          callback(null, true);
        } else {
          callback(new Error(`CORS: origem não permitida — ${origin}`));
        }
      },
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    });

    const CORS_BYPASS_PATHS = ["/health", "/api/integrations/google/callback"];

    app.use(
      (
        req: { path?: string; headers?: Record<string, string | undefined> },
        res: unknown,
        next: () => void,
      ) => {
        if (
          CORS_BYPASS_PATHS.includes(req.path ?? "") &&
          !req.headers?.origin
        ) {
          return next();
        }
        corsFn(req, res, next);
      },
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /health", () => {
    it("without Origin → 200 (CORS bypassed)", async () => {
      const res = await request(app.getHttpServer()).get("/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
    });

    it("with allowed Origin → 200 (CORS passes)", async () => {
      const res = await request(app.getHttpServer())
        .get("/health")
        .set("Origin", "https://app.example.com");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
    });

    it("with disallowed Origin → CORS error", async () => {
      const res = await request(app.getHttpServer())
        .get("/health")
        .set("Origin", "https://evil.com");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /api/integrations/google/callback", () => {
    it("without Origin → not blocked by CORS (Google redirect)", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/integrations/google/callback?code=test&state=test");
      expect(res.status).not.toBe(500);
    });

    it("with allowed Origin → CORS passes", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/integrations/google/callback?code=test&state=test")
        .set("Origin", "https://app.example.com");
      expect(res.status).not.toBe(500);
    });

    it("with disallowed Origin → CORS blocked", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/integrations/google/callback?code=test&state=test")
        .set("Origin", "https://evil.com");
      expect(res.status).toBe(500);
    });
  });

  describe("Other API routes", () => {
    it("GET /api/health without Origin → CORS blocked (not bypassed)", async () => {
      const res = await request(app.getHttpServer()).get("/api/health");
      expect(res.status).toBe(500);
    });

    it("GET /api/events without Origin → CORS blocked", async () => {
      const res = await request(app.getHttpServer()).get("/api/events");
      expect(res.status).toBe(500);
    });
  });
});

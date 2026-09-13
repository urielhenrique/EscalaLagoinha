import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";
import { PrismaService } from "../prisma/prisma.service";

describe("Health endpoint — CORS bypass for internal checks", () => {
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

    app.use(
      (
        req: { path?: string; headers?: Record<string, string | undefined> },
        res: unknown,
        next: () => void,
      ) => {
        if (req.path === "/health" && !req.headers?.origin) {
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

  it("GET /health without Origin → 200 (CORS bypassed)", async () => {
    const res = await request(app.getHttpServer()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("GET /health with allowed Origin → 200 (CORS passes)", async () => {
    const res = await request(app.getHttpServer())
      .get("/health")
      .set("Origin", "https://app.example.com");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("GET /health with disallowed Origin → CORS error", async () => {
    const res = await request(app.getHttpServer())
      .get("/health")
      .set("Origin", "https://evil.com");
    expect(res.status).toBe(500);
  });

  it("GET /api/health without Origin → CORS blocked (not bypassed for non-/health path)", async () => {
    const res = await request(app.getHttpServer()).get("/api/health");
    expect(res.status).toBe(500);
  });
});

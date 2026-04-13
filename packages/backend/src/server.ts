import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import { registerAuthRoutes } from "./auth/login.js";
import { registerImportRoutes } from "./import/routes.js";
import { registerMonthlyInputRoutes } from "./routes/monthly-input.js";
import { registerReceivablesRoutes } from "./routes/receivables.js";
import { registerPayablesRoutes } from "./routes/payables.js";
import { registerLiabilitiesRoutes } from "./routes/liabilities.js";
import { registerForecastRoutes } from "./routes/forecast.js";
import { registerWarehouseRoutes } from "./routes/warehouse.js";
import { registerDashboardSummaryRoutes } from "./routes/dashboard-summary.js";
import { registerViktorRoutes } from "./routes/viktor.js";
import { registerCashflowRoutes } from "./routes/cashflow.js";
import { registerManualEntryRoutes } from "./routes/manual-entries.js";
import { JWT_EXPIRY } from "./auth/constants.js";
import { checkConnection, sql } from "./db/connection.js";
import { runMigrations } from "./db/migrate.js";
import { seedEntities } from "./db/seed-entities.js";
import { seedLiabilities } from "./db/seed-liabilities.js";

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || "0.0.0.0";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return secret;
}

export async function buildApp() {
  const isProduction = process.env.NODE_ENV === "production";

  const loggerConfig = isProduction
    ? { level: "info" }
    : {
        transport: {
          target: "pino-pretty",
          options: { translateTime: "HH:MM:ss Z", ignore: "pid,hostname" },
        },
      };

  const app = Fastify({
    logger: loggerConfig,
  });

  await app.register(rateLimit, {
    global: false,
  });

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  });

  await app.register(cookie);

  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
      files: 14,
    },
  });

  await app.register(jwt, {
    secret: getJwtSecret(),
    sign: { expiresIn: JWT_EXPIRY },
  });

  app.get("/api/health", async (_request, reply) => {
    const dbConnected = await checkConnection();
    const status = dbConnected ? "ok" : "degraded";
    const statusCode = dbConnected ? 200 : 503;

    return reply.status(statusCode).send({
      status,
      timestamp: new Date().toISOString(),
      checks: {
        database: dbConnected ? "connected" : "disconnected",
      },
    });
  });

  await registerAuthRoutes(app);

  // Encapsulate protected routes so their onRequest auth hooks
  // don't leak into the auth routes above
  await app.register(async (protectedScope) => {
    await registerImportRoutes(protectedScope);
    await registerMonthlyInputRoutes(protectedScope);
    await registerReceivablesRoutes(protectedScope);
    await registerPayablesRoutes(protectedScope);
    await registerLiabilitiesRoutes(protectedScope);
    await registerForecastRoutes(protectedScope);
    await registerWarehouseRoutes(protectedScope);
    await registerDashboardSummaryRoutes(protectedScope);
    await registerViktorRoutes(protectedScope);
    await registerCashflowRoutes(protectedScope);
    await registerManualEntryRoutes(protectedScope);
  });

  return app;
}

async function bootstrap(): Promise<void> {
  const migrations = await runMigrations(sql);
  if (migrations.length > 0) {
    console.log(`Applied migrations: ${migrations.join(", ")}`);
  }
  await seedEntities(sql);
  await seedLiabilities(sql);
}

async function start() {
  try {
    await bootstrap();
  } catch (err) {
    console.error("Database bootstrap failed:", err);
    process.exit(1);
  }

  const app = await buildApp();

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`Server listening on http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import { registerAuthRoutes } from "./auth/login.js";
import { registerImportRoutes } from "./import/routes.js";
import { JWT_EXPIRY } from "./auth/constants.js";

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

  app.get("/api/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  await registerAuthRoutes(app);
  await registerImportRoutes(app);

  return app;
}

async function start() {
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

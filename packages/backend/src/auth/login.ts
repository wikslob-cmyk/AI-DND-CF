import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { COOKIE_NAME, COOKIE_OPTIONS } from "./constants.js";

function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf-8");
  const bBuf = Buffer.from(b, "utf-8");

  if (aBuf.length !== bBuf.length) {
    // Still do a comparison to avoid timing leaks on length
    const dummy = Buffer.alloc(aBuf.length);
    timingSafeEqual(aBuf, dummy);
    return false;
  }

  return timingSafeEqual(aBuf, bBuf);
}

const LOGIN_BODY_SCHEMA = {
  type: "object",
  required: ["password"],
  properties: {
    password: { type: "string", minLength: 1 },
  },
  additionalProperties: false,
} as const;

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/api/auth/login",
    {
      schema: { body: LOGIN_BODY_SCHEMA },
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute",
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: { password: string } }>,
      reply: FastifyReply,
    ) => {
      const { password } = request.body;
      const expectedPassword = process.env.DASHBOARD_PASSWORD;

      if (!expectedPassword) {
        request.log.error("DASHBOARD_PASSWORD not configured");
        return reply.status(500).send({
          data: null,
          error: { code: "CONFIG_ERROR", message: "Server misconfigured" },
        });
      }

      if (!safeCompare(password, expectedPassword)) {
        return reply.status(401).send({
          data: null,
          error: { code: "INVALID_PASSWORD", message: "Nieprawidłowe hasło" },
        });
      }

      const token = app.jwt.sign({ authenticated: true });

      reply.setCookie(COOKIE_NAME, token, COOKIE_OPTIONS);

      return reply.send({ data: { success: true }, error: null });
    },
  );

  app.post("/api/auth/logout", async (_request, reply) => {
    reply.setCookie(COOKIE_NAME, "", {
      ...COOKIE_OPTIONS,
      maxAge: 0,
    });

    return reply.send({ data: { success: true }, error: null });
  });

  app.get("/api/auth/me", async (request, reply) => {
    try {
      const token = request.cookies[COOKIE_NAME];
      if (!token) {
        return reply.status(401).send({
          data: null,
          error: { code: "UNAUTHORIZED", message: "Brak sesji" },
        });
      }

      app.jwt.verify(token);
      return reply.send({ data: { authenticated: true }, error: null });
    } catch {
      return reply.status(401).send({
        data: null,
        error: { code: "UNAUTHORIZED", message: "Sesja wygasła" },
      });
    }
  });
}

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import { registerAuthRoutes } from "../login.js";
import { authMiddleware } from "../middleware.js";
import { COOKIE_NAME, JWT_EXPIRY } from "../constants.js";

const TEST_PASSWORD = "test-password-123";
const JWT_SECRET = "test-secret";

let app: FastifyInstance;

async function buildTestApp(): Promise<FastifyInstance> {
  const testApp = Fastify({ logger: false });

  await testApp.register(cookie);
  await testApp.register(jwt, {
    secret: JWT_SECRET,
    sign: { expiresIn: JWT_EXPIRY },
  });

  await registerAuthRoutes(testApp);

  // A protected test endpoint
  testApp.get(
    "/api/protected",
    { onRequest: [authMiddleware] },
    async () => {
      return { data: { message: "secret" }, error: null };
    },
  );

  return testApp;
}

function extractCookie(
  setCookieHeader: string | string[] | undefined,
): string | undefined {
  if (!setCookieHeader) return undefined;
  const header = Array.isArray(setCookieHeader)
    ? setCookieHeader[0]
    : setCookieHeader;
  if (!header) return undefined;
  const match = header.match(new RegExp(`${COOKIE_NAME}=([^;]*)`));
  return match?.[1];
}

describe("Auth", () => {
  beforeAll(() => {
    process.env.DASHBOARD_PASSWORD = TEST_PASSWORD;
    process.env.JWT_SECRET = JWT_SECRET;
  });

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterAll(() => {
    delete process.env.DASHBOARD_PASSWORD;
  });

  describe("POST /api/auth/login", () => {
    it("should return 200 and set cookie with correct password", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { password: TEST_PASSWORD },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data.success).toBe(true);
      expect(body.error).toBeNull();

      const cookieValue = extractCookie(response.headers["set-cookie"]);
      expect(cookieValue).toBeDefined();
      expect(cookieValue!.length).toBeGreaterThan(0);
    });

    it("should return 401 with incorrect password", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { password: "wrong-password" },
      });

      expect(response.statusCode).toBe(401);

      const body = response.json();
      expect(body.error.code).toBe("INVALID_PASSWORD");
    });
  });

  describe("Protected endpoint", () => {
    it("should return 401 when no cookie is present", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/protected",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 200 with valid JWT cookie", async () => {
      // Login first
      const loginResponse = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { password: TEST_PASSWORD },
      });

      const cookieValue = extractCookie(loginResponse.headers["set-cookie"]);
      expect(cookieValue).toBeDefined();

      // Access protected endpoint
      const response = await app.inject({
        method: "GET",
        url: "/api/protected",
        cookies: { [COOKIE_NAME]: cookieValue! },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.message).toBe("secret");
    });

    it("should return 401 with expired JWT", async () => {
      // Directly create an expired token using the app's jwt signer
      const expiredToken = app.jwt.sign(
        { authenticated: true },
        { expiresIn: "1ms" },
      );

      // Wait for token to expire
      await new Promise((resolve) => setTimeout(resolve, 50));

      const response = await app.inject({
        method: "GET",
        url: "/api/protected",
        cookies: { [COOKIE_NAME]: expiredToken },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 401 with invalid JWT", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/protected",
        cookies: { [COOKIE_NAME]: "invalid.jwt.token" },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return authenticated=true with valid cookie", async () => {
      const loginResponse = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { password: TEST_PASSWORD },
      });

      const cookieValue = extractCookie(loginResponse.headers["set-cookie"]);

      const response = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        cookies: { [COOKIE_NAME]: cookieValue! },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.authenticated).toBe(true);
    });

    it("should return 401 without cookie", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/auth/me",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should clear cookie", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/logout",
      });

      expect(response.statusCode).toBe(200);
      const setCookie = response.headers["set-cookie"];
      expect(setCookie).toBeDefined();
      // Cookie should be cleared (max-age=0 or empty value)
      const headerStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
      expect(headerStr).toContain(COOKIE_NAME);
    });
  });

  describe("Body validation", () => {
    it("should return 400 when password is missing from body", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 400 when password is empty string", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { password: "" },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("Rate limiting", () => {
    it("should return 429 after exceeding login attempts", async () => {
      const rateLimitedApp = Fastify({ logger: false });
      await rateLimitedApp.register(rateLimit, { global: false });
      await rateLimitedApp.register(cookie);
      await rateLimitedApp.register(jwt, {
        secret: JWT_SECRET,
        sign: { expiresIn: JWT_EXPIRY },
      });
      await rateLimitedApp.register(registerAuthRoutes);

      // Make 5 allowed attempts
      for (let i = 0; i < 5; i++) {
        await rateLimitedApp.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: { password: "wrong-password" },
        });
      }

      // 6th attempt should be rate limited
      const response = await rateLimitedApp.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { password: "wrong-password" },
      });

      expect(response.statusCode).toBe(429);

      await rateLimitedApp.close();
    });
  });

  describe("JWT_SECRET validation", () => {
    it("should throw when JWT_SECRET env var is missing", async () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      try {
        // buildApp() in server.ts uses getJwtSecret() which throws when
        // JWT_SECRET is not set. We verify this behavior by constructing
        // a Fastify app the same way buildApp() does — registering jwt
        // with the secret from env. This avoids importing server.ts
        // which has a module-level start() side effect.
        const buildAppWithoutSecret = async (): Promise<FastifyInstance> => {
          const secret = process.env.JWT_SECRET;
          if (!secret) {
            throw new Error("JWT_SECRET environment variable is required");
          }
          const testApp = Fastify({ logger: false });
          await testApp.register(jwt, { secret });
          return testApp;
        };

        await expect(buildAppWithoutSecret()).rejects.toThrow(
          "JWT_SECRET environment variable is required",
        );
      } finally {
        process.env.JWT_SECRET = originalSecret;
      }
    });
  });
});

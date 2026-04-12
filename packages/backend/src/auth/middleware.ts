import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { COOKIE_NAME } from "./constants.js";

export async function authMiddleware(
  this: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const token = request.cookies[COOKIE_NAME];

  if (!token) {
    return reply.status(401).send({
      data: null,
      error: { code: "UNAUTHORIZED", message: "Wymagane zalogowanie" },
    });
  }

  try {
    this.jwt.verify(token);
  } catch {
    return reply.status(401).send({
      data: null,
      error: { code: "UNAUTHORIZED", message: "Sesja wygasła" },
    });
  }
}

import type { FastifyReply } from "fastify";
import { ENTITY_CODES } from "@dnd/shared";

const VALID_ENTITY_VALUES = new Set<string>(["all", ...ENTITY_CODES]);

/**
 * Validates entity query param. Returns the entity string if valid,
 * or sends a 400 response and returns null if invalid.
 */
export function validateEntity(
  entityParam: string | undefined,
  reply: FastifyReply,
): string | null {
  const entity = entityParam || "all";

  if (!VALID_ENTITY_VALUES.has(entity)) {
    reply.status(400).send({
      data: null,
      error: {
        code: "VALIDATION_ERROR",
        message: `Nieprawidlowy parametr entity: '${entity}'. Dozwolone wartosci: all, ${ENTITY_CODES.join(", ")}`,
      },
    });
    return null;
  }

  return entity;
}

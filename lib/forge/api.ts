import { ZodError } from "zod";
import { ForgeError } from "./openai";

export function notFound(): Response {
  return Response.json(
    { error: { code: "CHARACTER_NOT_FOUND", message: "Character not found." } },
    { status: 404 },
  );
}

export function forgeError(error: unknown): Response {
  if (error instanceof ForgeError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return Response.json(
      {
        error: {
          code: "INVALID_INPUT",
          message: error.issues[0]?.message ?? "That request is invalid.",
        },
      },
      { status: 400 },
    );
  }
  console.error(error);
  return Response.json(
    {
      error: {
        code: "FORGE_ERROR",
        message: "Something went wrong. Please try again.",
      },
    },
    { status: 500 },
  );
}

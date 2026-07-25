import { ZodError } from "zod";
import { CommandError } from "../domain/commands";

export class ApiError extends Error {
  status: number;
  code: string;
  retryable: boolean;

  constructor(
    status: number,
    code: string,
    message: string,
    retryable = false,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
        },
      },
      { status: error.status },
    );
  }

  if (error instanceof CommandError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          retryable: false,
        },
      },
      { status: error.code === "CHOICE_NOT_FOUND" ? 404 : 409 },
    );
  }

  if (error instanceof ZodError) {
    return Response.json(
      {
        error: {
          code: "INVALID_SETUP",
          message: error.issues[0]?.message ?? "The request is invalid.",
          retryable: false,
        },
      },
      { status: 400 },
    );
  }

  if (
    error instanceof Error &&
    "status" in error &&
    "code" in error &&
    typeof error.status === "number" &&
    typeof error.code === "string"
  ) {
    return Response.json(
      {
        error: {
          code: error.code,
          message:
            "publicMessage" in error && typeof error.publicMessage === "string"
              ? error.publicMessage
              : error.message,
          retryable: false,
        },
      },
      { status: error.status },
    );
  }

  console.error(error);
  return Response.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "The world could not be updated. Please try again.",
        retryable: true,
      },
    },
    { status: 500 },
  );
}

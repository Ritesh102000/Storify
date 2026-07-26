import { ZodError } from "zod";
import { DetectiveError } from "./errors";

export function detectiveErrorResponse(error: unknown): Response {
  if (error instanceof DetectiveError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          retryable: error.status >= 500,
        },
      },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return Response.json(
      {
        error: {
          code: "INVALID_DETECTIVE_REQUEST",
          message: error.issues[0]?.message ?? "The case request is invalid.",
          retryable: false,
        },
      },
      { status: 400 },
    );
  }

  if (error instanceof SyntaxError) {
    return Response.json(
      {
        error: {
          code: "INVALID_JSON",
          message: "The request body is not valid JSON.",
          retryable: false,
        },
      },
      { status: 400 },
    );
  }

  console.error("Detective request failed", error);
  return Response.json(
    {
      error: {
        code: "DETECTIVE_INTERNAL_ERROR",
        message: "The case file could not be updated. Please try again.",
        retryable: true,
      },
    },
    { status: 500 },
  );
}

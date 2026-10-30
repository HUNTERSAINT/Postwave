import { z, ZodError, type ZodType } from "zod";
import { logger } from "@/lib/logger";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly headers?: HeadersInit,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function jsonResponse(
  body: unknown,
  status = 200,
  headers?: HeadersInit,
) {
  return Response.json(body, { status, headers });
}

export async function parseJson<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }

  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new HttpError(
        400,
        error.issues[0]?.message ?? "Request body is invalid.",
      );
    }
    throw error;
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return jsonResponse(
      { message: error.message },
      error.status,
      error.headers,
    );
  }

  const detail =
    error instanceof Error
      ? {
          errorName: error.name,
          errorMessage: error.message
            .replace(/(key|token|secret|password|authorization)[^\s,;]*/gi, "$1[redacted]")
            .slice(0, 400),
          errorCause:
            error.cause instanceof Error
              ? error.cause.message.slice(0, 300)
              : undefined,
          errorStack: error.stack
            ?.split("\n")
            .slice(1, 4)
            .map((line) => line.trim())
            .join(" | "),
        }
      : { errorName: "UnknownError" };
  logger.error(detail, "Postwave request failed");
  return jsonResponse({ message: "Something went wrong. Please try again." }, 500);
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof HttpError ? error.message : fallback;
}

export function parseUuid(value: string) {
  const parsed = z.string().uuid().safeParse(value);
  if (!parsed.success) throw new HttpError(400, "That id is not valid.");
  return parsed.data;
}

import { NextResponse } from "next/server";
import { ZodError, ZodType } from "zod";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ success: false, error: { message, status } }, { status });
}

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export async function parseBody<T>(schema: ZodType<T>, body: unknown) {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ApiError(
      result.error.issues[0]?.message ?? "Invalid request data",
      400,
    );
  }
  return result.data;
}

export function handleError(error: unknown, fallbackMessage = "Unexpected server error") {
  if (error instanceof ApiError) {
    return errorResponse(error.message, error.status);
  }
  if (error instanceof ZodError) {
    return errorResponse(error.issues[0]?.message ?? fallbackMessage, 400);
  }
  console.error("[api] Unhandled error:", error);
  return errorResponse(fallbackMessage, 500);
}

import { NextResponse } from "next/server";
import { AppError, hasCode, isAppError, rateLimitReset } from "@/lib/errors";

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function errorResponse(error: unknown) {
  if (isAppError(error)) {
    const headers: Record<string, string> = {};
    if (error.code === "too_many_requests" && typeof error.details?.retryAfterSeconds === "number") {
      headers["Retry-After"] = String(error.details.retryAfterSeconds);
    }
    const resetAt = hasCode(error, "rate_limited") ? rateLimitReset(error) : null;
    if (resetAt) headers["Retry-After"] = String(Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000)));
    return NextResponse.json({ error: { code: error.code, message: error.message, ...error.details } }, { status: error.status, headers });
  }
  console.error("[api] unexpected error", error);
  return NextResponse.json({ error: { code: "internal", message: "Something went wrong." } }, { status: 500 });
}

type Handler<C> = (request: Request, context: C) => Promise<Response>;

export function route<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/**
 * Rejects cross-site state-changing requests (CSRF defence in depth on top of SameSite=Lax).
 * The Origin must match the Host the request arrived on, the forwarded host set by a reverse
 * proxy, or the configured APP_URL.
 */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AppError("forbidden", "Invalid origin.");
  }
  const allowed = new Set<string>();
  for (const name of ["host", "x-forwarded-host"]) {
    const value = request.headers.get(name);
    if (value) allowed.add(value.split(",")[0].trim().toLowerCase());
  }
  try {
    allowed.add(new URL(process.env.APP_URL ?? "").host.toLowerCase());
  } catch {
    // APP_URL not set or invalid
  }
  if (!allowed.has(originHost.toLowerCase())) throw new AppError("forbidden", "Cross-origin requests are not allowed.");
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError("invalid_input", "Request body must be valid JSON.");
  }
}

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
 * proxy, or the configured APP_URL. The scheme must match too wherever it is known: APP_URL's
 * for its host, X-Forwarded-Proto's for the request hosts.
 */
export function assertSameOrigin(request: Request) {
  const header = request.headers.get("origin");
  if (!header) return;
  let origin: URL;
  try {
    origin = new URL(header);
  } catch {
    throw new AppError("forbidden", "Invalid origin.");
  }
  const first = (name: string) => request.headers.get(name)?.split(",")[0].trim().toLowerCase() || undefined;
  let appUrl: URL | undefined;
  try {
    appUrl = new URL(process.env.APP_URL ?? "");
  } catch {
    // APP_URL not set or invalid
  }

  let allowed: boolean;
  if (appUrl && origin.host === appUrl.host) {
    allowed = origin.protocol === appUrl.protocol;
  } else {
    const proto = first("x-forwarded-proto");
    allowed = [first("host"), first("x-forwarded-host")].includes(origin.host) && (!proto || origin.protocol === `${proto}:`);
  }
  if (!allowed) throw new AppError("forbidden", "Cross-origin requests are not allowed.");
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError("invalid_input", "Request body must be valid JSON.");
  }
}

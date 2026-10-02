import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { completeLogin, OAUTH_COOKIE, readOAuthCookie, SESSION_COOKIE, sessionCookieOptions } from "@/services/auth-service";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isAppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const base = env().APP_URL;
  const fail = (reason: string) => {
    const response = NextResponse.redirect(new URL(`/login?error=${reason}`, base));
    response.cookies.delete(OAUTH_COOKIE);
    return response;
  };

  try {
    enforceRateLimit(request, "auth-callback", 20);
  } catch {
    return fail("too_many_requests");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = readOAuthCookie(request.headers.get("cookie")?.match(new RegExp(`${OAUTH_COOKIE}=([^;]+)`))?.[1]);
  if (url.searchParams.get("error")) return fail("access_denied");
  if (!code || !state || !cookie || cookie.state !== state) return fail("invalid_state");

  try {
    const token = await completeLogin(code);
    const response = NextResponse.redirect(new URL(cookie.next, base));
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    response.cookies.delete(OAUTH_COOKIE);
    return response;
  } catch (error) {
    if (!isAppError(error)) console.error("[auth] login failed", error);
    return fail("login_failed");
  }
}

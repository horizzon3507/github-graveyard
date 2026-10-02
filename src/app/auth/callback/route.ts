import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { isAppError } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { AI_ATTEMPT_COOKIE, AI_COOKIE, aiCookieOptions, completeChatGPT, findConnection, getCookie, readAttempt } from "@/services/ai-connection-service";

export const dynamic = "force-dynamic";

/**
 * Loopback callback used when the app runs locally and is opened at http://127.0.0.1:<port>.
 * (`/auth/callback` is the path OpenAI's open-source sign-in flow requires.)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const base = `${url.protocol}//${request.headers.get("host") ?? new URL(env().APP_URL).host}`;
  const back = (query: string) => {
    const response = NextResponse.redirect(`${base}/settings/ai?${query}`);
    response.cookies.delete(AI_ATTEMPT_COOKIE);
    return response;
  };
  try {
    enforceRateLimit(request, "ai-callback", 20);
    const pending = readAttempt(getCookie(request, AI_ATTEMPT_COOKIE));
    const existing = await findConnection(getCookie(request, AI_COOKIE));
    const result = await completeChatGPT(existing, pending, {
      code: url.searchParams.get("code"),
      state: url.searchParams.get("state"),
      clientId: url.searchParams.get("client_id"),
      error: url.searchParams.get("error"),
    });
    const response = back("connected=chatgpt");
    if (result.cookieValue) response.cookies.set(AI_COOKIE, result.cookieValue, aiCookieOptions());
    return response;
  } catch (error) {
    if (!isAppError(error)) console.error("[ai] chatgpt callback failed", error);
    return back(`error=${encodeURIComponent(isAppError(error) ? error.message : "ChatGPT sign-in failed.")}`);
  }
}
